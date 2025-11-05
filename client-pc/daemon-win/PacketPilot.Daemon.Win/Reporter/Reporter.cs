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
    public class InterfaceUsageReport
    {
        public string Interface { get; set; } = "";
        public ulong TotalRx { get; set; }
        public ulong TotalTx { get; set; }
        public double TotalRxMB { get; set; }
        public double TotalTxMB { get; set; }
    }

    public class DailyUsageReport
    {
        public string DeviceId { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public string Date { get; set; } = ""; // YYYY-MM-DD
        public List<InterfaceUsageReport> Interfaces { get; set; } = new();
        public double TotalRxMB { get; set; }
        public double TotalTxMB { get; set; }
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

            _logger.Debug("Got daily usage data", "interfaces_count", usage.Interfaces.Count, "date", usage.Date);

            var interfaceReports = new List<InterfaceUsageReport>();
            ulong totalRx = 0, totalTx = 0;

            foreach (var kvp in usage.Interfaces.OrderBy(x => x.Key))
            {
                var iface = kvp.Key;
                var stats = kvp.Value;

                var interfaceReport = new InterfaceUsageReport
                {
                    Interface = iface,
                    TotalRx = stats.TotalRx,
                    TotalTx = stats.TotalTx,
                    TotalRxMB = (double)stats.TotalRx / (1024 * 1024),
                    TotalTxMB = (double)stats.TotalTx / (1024 * 1024)
                };
                interfaceReports.Add(interfaceReport);

                // Add to totals
                totalRx += stats.TotalRx;
                totalTx += stats.TotalTx;

            }

            _logger.Debug("Created interface reports", "count", interfaceReports.Count, "total_rx_mb", (double)totalRx / (1024 * 1024), "total_tx_mb", (double)totalTx / (1024 * 1024));

            // Create report
            var report = new DailyUsageReport
            {
                DeviceId = _config.DeviceId,
                Timestamp = DateTime.Now,
                Date = usage.Date,
                Interfaces = interfaceReports,
                TotalRxMB = (double)totalRx / (1024 * 1024),
                TotalTxMB = (double)totalTx / (1024 * 1024)
            };

            var jsonData = JsonSerializer.Serialize(report);
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

                    _logger.Debug("Sending daily usage report", "attempt", attempt, "url", url,
                        "date", report.Date, "interfaces", report.Interfaces.Count, "total_rx_mb", report.TotalRxMB, "total_tx_mb", report.TotalTxMB);

                    using var response = await _httpClient.SendAsync(request, _cancellationTokenSource?.Token ?? CancellationToken.None);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        var serverResp = JsonSerializer.Deserialize<ServerResponse>(responseContent);

                        if (serverResp != null)
                        {
                            _logger.Info("Daily usage report sent successfully",
                                "message", serverResp.Message,
                                "date", report.Date,
                                "interfaces", report.Interfaces.Count,
                                "total_rx_mb", report.TotalRxMB,
                                "total_tx_mb", report.TotalTxMB);

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
