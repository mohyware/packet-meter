using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Logger;
using PacketPilot.Daemon.Win.Monitor;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win.Reporter
{
    public class AppRegistration
    {
        public string Identifier { get; set; } = "";
        public string? DisplayName { get; set; }
        public string? IconHash { get; set; }
    }

    public class AppUsageData
    {
        public string Identifier { get; set; } = "";
        public ulong TotalRx { get; set; }
        public ulong TotalTx { get; set; }
    }

    public class AppUsageReport
    {
        public string Identifier { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string IconHash { get; set; } = "";
        public ulong TotalRx { get; set; }
        public ulong TotalTx { get; set; }
        public double TotalRxMB { get; set; }
        public double TotalTxMB { get; set; }
    }

    public class RegisterAppsRequest
    {
        public List<AppRegistration> Apps { get; set; } = new();
    }

    public class UsageReportRequest
    {
        public string Timestamp { get; set; } = "";
        public string Date { get; set; } = "";
        public List<AppUsageData> Apps { get; set; } = new();
    }

    public class ServerResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
        public List<Command> Commands { get; set; } = new();
    }

    public class Command
    {
        public string Type { get; set; } = "";
        public string AppName { get; set; } = "";
        public string Action { get; set; } = "";
    }


    public class Reporter
    {
        private readonly ReporterConfig _config;
        private readonly Logger.Logger _logger;
        private readonly HttpClient _httpClient;
        private readonly TrafficMonitor _monitor;
        private CancellationTokenSource? _cancellationTokenSource;

        public Reporter(ReporterConfig config, Logger.Logger logger, TrafficMonitor monitor)
        {
            _config = config;
            _logger = logger;
            _monitor = monitor;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            _logger.Info("Starting daily usage reporter",
                "server", $"{_config.ServerHost}:{_config.ServerPort}",
                "interval", _config.ReportInterval);

            // Send initial health check when starting
            await SendHealthCheckAsync();

            var interval = ParseTimeSpan(_config.ReportInterval);
            using var timer = new PeriodicTimer(interval);

            while (!_cancellationTokenSource.Token.IsCancellationRequested)
            {
                try
                {
                    await timer.WaitForNextTickAsync(_cancellationTokenSource.Token);
                    await SendReportAsync();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.Error("Failed to send report", "error", ex.ToString());
                }
            }

            _logger.Info("Daily usage reporter stopped");
        }

        public void Stop()
        {
            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource?.Dispose();
        }

        private async Task<bool> SendHealthCheckAsync()
        {
            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/device/health-check";

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                request.Headers.Add("User-Agent", "PacketPilot-Daemon/1.0");

                _logger.Debug("Sending health check", "url", url);

                using var response = await _httpClient.SendAsync(request, _cancellationTokenSource?.Token ?? CancellationToken.None);

                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.Info("Health check sent successfully", "message", responseContent);
                    return true;
                }
                else
                {
                    _logger.Warn("Health check failed", "status", (int)response.StatusCode);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.Error("Health check error", "error", ex.Message);
                return false;
            }
        }

        private async Task SendReportAsync()
        {
            // Get current daily usage from monitor
            var usage = _monitor.GetDailyUsage();
            if (usage == null)
            {
                _logger.Debug("No daily usage data to report");
                return;
            }

            _logger.Debug("Got daily usage data", "apps_count", usage.Apps.Count, "date", usage.Date);

            // Step 1: Register or update apps first
            var appsToRegister = usage.Apps.Values
                .Select(app => new AppRegistration
                {
                    Identifier = app.Identifier,
                    DisplayName = string.IsNullOrEmpty(app.DisplayName) ? null : app.DisplayName,
                    IconHash = string.IsNullOrEmpty(app.IconHash) ? null : app.IconHash
                })
                .ToList();

            if (appsToRegister.Count > 0)
            {
                await RegisterAppsAsync(appsToRegister);
            }

            // Step 2: Send usage reports
            ulong totalRx = 0, totalTx = 0;
            var appUsageData = new List<AppUsageData>();

            foreach (var kvp in usage.Apps.OrderBy(x => x.Key))
            {
                var app = kvp.Value;

                appUsageData.Add(new AppUsageData
                {
                    Identifier = app.Identifier,
                    TotalRx = app.TotalRx,
                    TotalTx = app.TotalTx
                });

                // Add to totals
                totalRx += app.TotalRx;
                totalTx += app.TotalTx;
            }

            _logger.Debug("Created app usage data", "count", appUsageData.Count, "total_rx_mb", (double)totalRx / (1024 * 1024), "total_tx_mb", (double)totalTx / (1024 * 1024));

            // Create usage report (only identifiers and usage data)
            var usageReport = new UsageReportRequest
            {
                Timestamp = DateTime.UtcNow.ToString("o"),
                Date = usage.Date,
                Apps = appUsageData
            };

            await SendUsageReportAsync(usageReport, usage.Date, appUsageData.Count, totalRx, totalTx);
        }

        private async Task RegisterAppsAsync(List<AppRegistration> apps)
        {
            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/traffic/apps";

            var appsPayload = new RegisterAppsRequest
            {
                Apps = apps
            };

            var jsonData = JsonSerializer.Serialize(appsPayload);
            var content = new StringContent(jsonData, Encoding.UTF8, "application/json");

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = content;
                request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                request.Headers.Add("User-Agent", "PacketPilot-Daemon/1.0");

                _logger.Debug("Registering apps", "url", url, "apps_count", apps.Count);

                using var response = await _httpClient.SendAsync(request, _cancellationTokenSource?.Token ?? CancellationToken.None);

                if (response.IsSuccessStatusCode)
                {
                    _logger.Debug("Apps registered successfully", "apps_count", apps.Count);
                }
                else
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.Warn("Failed to register apps", "status", (int)response.StatusCode, "message", responseContent);
                    // Don't throw - we'll still try to send usage reports
                }
            }
            catch (Exception ex)
            {
                _logger.Warn("Error registering apps", "error", ex.Message);
                // Don't throw - we'll still try to send usage reports
            }
        }

        private async Task SendUsageReportAsync(UsageReportRequest usageReport, string date, int appsCount, ulong totalRx, ulong totalTx)
        {
            var jsonData = JsonSerializer.Serialize(usageReport);
            var content = new StringContent(jsonData, Encoding.UTF8, "application/json");

            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/traffic/report";

            Exception? lastException = null;
            for (int attempt = 1; attempt <= _config.RetryAttempts; attempt++)
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, url);
                    request.Content = content;
                    request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                    request.Headers.Add("User-Agent", "PacketPilot-Daemon/1.0");

                    var totalRxMB = (double)totalRx / (1024 * 1024);
                    var totalTxMB = (double)totalTx / (1024 * 1024);

                    _logger.Debug("Sending daily usage report", "attempt", attempt, "url", url,
                        "date", date, "apps", appsCount, "total_rx_mb", totalRxMB, "total_tx_mb", totalTxMB);

                    using var response = await _httpClient.SendAsync(request, _cancellationTokenSource?.Token ?? CancellationToken.None);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        var serverResp = JsonSerializer.Deserialize<ServerResponse>(responseContent);

                        if (serverResp != null)
                        {
                            _logger.Info("Daily usage report sent successfully",
                                "message", serverResp.Message,
                                "date", date,
                                "apps", appsCount,
                                "total_rx_mb", totalRxMB,
                                "total_tx_mb", totalTxMB);

                            if (serverResp.Commands.Count > 0)
                            {
                                HandleCommands(serverResp.Commands);
                            }
                        }

                        return;
                    }
                    else if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        // Device not activated - send health check to notify user
                        var responseContent = await response.Content.ReadAsStringAsync();
                        _logger.Warn("Device not activated - traffic report rejected",
                            "status", (int)response.StatusCode,
                            "message", responseContent);

                        // Send health check to update lastHealthCheck so user sees approval needed
                        await SendHealthCheckAsync();

                        lastException = new HttpRequestException($"Device not activated. Please wait for user approval.");
                        _logger.Info("Health check sent to notify user that device needs approval");
                    }
                    else
                    {
                        lastException = new HttpRequestException($"Server returned status {response.StatusCode}");
                        _logger.Warn("Server returned error status", "status", (int)response.StatusCode);
                    }
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    _logger.Warn("Report attempt failed", "attempt", attempt, "error", ex.Message);
                }

                if (attempt < _config.RetryAttempts)
                {
                    var delay = ParseTimeSpan(_config.RetryDelay);
                    await Task.Delay(delay, _cancellationTokenSource?.Token ?? CancellationToken.None);
                }
            }

            if (lastException != null)
            {
                _logger.Error("All report attempts failed", "error", lastException.Message);
                throw lastException;
            }
        }

        private void HandleCommands(List<Command> commands)
        {
            _logger.Info("Received commands from server", "count", commands.Count);
            foreach (var cmd in commands)
            {
                _logger.Info("Processing command", "type", cmd.Type, "app", cmd.AppName, "action", cmd.Action);
                switch (cmd.Type)
                {
                    case "block_app":
                        HandleBlockApp(cmd.AppName, cmd.Action);
                        break;
                    case "limit_app":
                        HandleLimitApp(cmd.AppName, cmd.Action);
                        break;
                    default:
                        _logger.Warn("Unknown command type", "type", cmd.Type);
                        break;
                }
            }
        }

        private void HandleBlockApp(string appName, string action)
        {
            _logger.Info("Block app command", "app", appName, "action", action);
            // TODO: Implement app blocking logic
        }

        private void HandleLimitApp(string appName, string action)
        {
            _logger.Info("Limit app command", "app", appName, "action", action);
            // TODO: Implement app limiting logic
        }

        private static TimeSpan ParseTimeSpan(string value)
        {
            if (value.EndsWith("s"))
            {
                var seconds = int.Parse(value[..^1]);
                return TimeSpan.FromSeconds(seconds);
            }
            else if (value.EndsWith("m"))
            {
                var minutes = int.Parse(value[..^1]);
                return TimeSpan.FromMinutes(minutes);
            }
            else if (value.EndsWith("h"))
            {
                var hours = int.Parse(value[..^1]);
                return TimeSpan.FromHours(hours);
            }
            else
            {
                return TimeSpan.Parse(value);
            }
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
}
