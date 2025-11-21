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
using PacketPilot.Daemon.Win.Utils;
using System.Threading;
using System.Threading.Tasks;
using PacketPilot.Daemon.Win.Models;
namespace PacketPilot.Daemon.Win.Reporter
{
    public class Reporter
    {
        private readonly ReporterConfig _config;
        private readonly Logger.Logger _logger;
        private readonly HttpClient _httpClient;
        private readonly ProcessNetworkMonitor _processMonitor;
        private readonly TrafficMonitor _trafficMonitor;
        private readonly ReporterMode _reportMode;
        private CancellationTokenSource? _cancellationTokenSource;

        public Reporter(ReporterConfig config, Logger.Logger logger, ProcessNetworkMonitor processMonitor, TrafficMonitor trafficMonitor, ReporterMode reportMode = ReporterMode.TotalUsage)
        {
            _config = config;
            _logger = logger;
            // TODO: Create strategy class for different modes
            _processMonitor = processMonitor;
            _trafficMonitor = trafficMonitor;
            _reportMode = reportMode;
            _httpClient = new HttpClient { Timeout = UtilsHelper.ParseTimeSpan(_config.ReportInterval) };
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            _logger.Info("Starting daily usage reporter",
                "server", $"{_config.ServerHost}:{_config.ServerPort}",
                "interval", _config.ReportInterval);

            // Send initial health check when starting
            await SendHealthCheckRequest();

            var interval = UtilsHelper.ParseTimeSpan(_config.ReportInterval);
            try
            {
                await AsyncTask.RunPeriodicAsync(
                    interval,
                    async token =>
                    {
                        try
                        {
                            await SendReportAsync().ConfigureAwait(false);
                        }
                        catch (Exception ex)
                        {
                            _logger.Error("Failed to send report", "error", ex.ToString());
                        }
                    },
                    _cancellationTokenSource.Token);
            }
            catch (OperationCanceledException)
            {
                _logger.Info("Daily usage reporter stopped");
            }
        }

        public void Stop()
        {
            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource?.Dispose();
        }

        private async Task<bool> SendHealthCheckRequest()
        {
            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/device/health-check";

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                request.Headers.Add("User-Agent", "PacketPilot-Windows-Daemon/1.0");

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
            if (_reportMode == ReporterMode.TotalUsage)
            {
                await CreateTotalUsagePayload();
            }
            else
            {
                await CreatePerProcessUsagePayload();
            }
        }

        private async Task CreatePerProcessUsagePayload()
        {
            var processUsage = _processMonitor.GetProcessUsage();

            if (processUsage == null || processUsage.Count == 0)
            {
                _logger.Debug("No usage data to report");
                return;
            }
            var usageApps = new Dictionary<string, AppUsage>();

            foreach (var kvp in processUsage)
            {
                var identifier = kvp.Key;
                var process = kvp.Value;

                usageApps[identifier] = new AppUsage
                {
                    Identifier = identifier,
                    DisplayName = process.ProcessName,
                    IconHash = process.ProcessIconBase64,
                    TotalRx = process.TotalRxBytes,
                    TotalTx = process.TotalTxBytes,
                    LastSeen = process.LastSeen
                };
            }

            if (usageApps == null || usageApps.Count == 0)
            {
                _logger.Debug("No usage data to report");
                return;
            }

            // Register or update apps first
            var appsToRegister = usageApps.Values
                .Select(app => new AppRegistration
                {
                    Identifier = app.Identifier,
                    DisplayName = string.IsNullOrEmpty(app.DisplayName) ? null : app.DisplayName,
                    IconHash = string.IsNullOrEmpty(app.IconHash) ? null : app.IconHash
                })
                .ToList();

            if (appsToRegister.Count > 0)
            {
                await RegisterAppsRequest(appsToRegister);
            }

            // Send usage reports
            long totalRx = 0, totalTx = 0;
            var appUsageData = new List<AppUsageData>();

            foreach (var kvp in usageApps.OrderBy(x => x.Key))
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
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var usageReport = new UsageReportRequest
            {
                Timestamp = DateTime.UtcNow.ToString("o"),
                Date = today,
                Apps = appUsageData
            };

            await SendPerProcessReportRequest(usageReport, today, appUsageData.Count, totalRx, totalTx);
        }

        private async Task CreateTotalUsagePayload()
        {
            var hourlyUsage = _trafficMonitor.GetTotalUsage();
            if (hourlyUsage == null || hourlyUsage.Interfaces.Count == 0)
            {
                _logger.Debug("No total usage data to report");
                return;
            }

            long totalRx = 0;
            long totalTx = 0;

            foreach (var iface in hourlyUsage.Interfaces.Values)
            {
                totalRx += iface.TotalRx;
                totalTx += iface.TotalTx;
            }

            if (totalRx == 0 && totalTx == 0)
            {
                _logger.Debug("Total usage counters are zero, skipping report");
                return;
            }

            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var totalUsageReport = new TotalUsageReportRequest
            {
                Timestamp = DateTime.UtcNow.ToString("o"),
                Date = today,
                TotalRx = totalRx,
                TotalTx = totalTx
            };

            await SendTotalUsageReportRequest(totalUsageReport, today, totalRx, totalTx);
        }

        private async Task RegisterAppsRequest(List<AppRegistration> apps)
        {
            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/traffic/register-apps";

            var appsPayload = new RegisterAppsRequest
            {
                Apps = apps
            };

            var jsonData = JsonSerializer.Serialize(appsPayload);

            try
            {
                using var content = new StringContent(jsonData, Encoding.UTF8, "application/json");
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = content
                };
                request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                request.Headers.Add("User-Agent", "PacketPilot-Windows-Daemon/1.0");

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
                }
            }
            catch (Exception ex)
            {
                _logger.Warn("Error registering apps", "error", ex.Message);
            }
        }

        private async Task SendPerProcessReportRequest(UsageReportRequest usageReport, string date, int appsCount, long totalRx, long totalTx)
        {
            var jsonData = JsonSerializer.Serialize(usageReport);

            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/traffic/per-process";

            Exception? lastException = null;
            for (int attempt = 1; attempt <= _config.RetryAttempts; attempt++)
            {
                try
                {
                    using var content = new StringContent(jsonData, Encoding.UTF8, "application/json");
                    using var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = content
                    };
                    request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                    request.Headers.Add("User-Agent", "PacketPilot-Windows-Daemon/1.0");

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

                        await SendHealthCheckRequest();

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
                    var delay = UtilsHelper.ParseTimeSpan(_config.RetryDelay);
                    await Task.Delay(delay, _cancellationTokenSource?.Token ?? CancellationToken.None);
                }
            }

            if (lastException != null)
            {
                _logger.Error("All report attempts failed", "error", lastException.Message);
                throw lastException;
            }
        }

        private async Task SendTotalUsageReportRequest(TotalUsageReportRequest totalUsageReport, string date, long totalRx, long totalTx)
        {
            var jsonData = JsonSerializer.Serialize(totalUsageReport);

            var protocol = _config.UseTls ? "https" : "http";
            var url = $"{protocol}://{_config.ServerHost}:{_config.ServerPort}/api/v1/traffic/total-usage";

            Exception? lastException = null;
            for (int attempt = 1; attempt <= _config.RetryAttempts; attempt++)
            {
                try
                {
                    using var content = new StringContent(jsonData, Encoding.UTF8, "application/json");
                    using var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = content
                    };
                    request.Headers.Add("Authorization", $"Bearer {_config.ApiKey}");
                    request.Headers.Add("User-Agent", "PacketPilot-Windows-Daemon/1.0");

                    var totalRxMB = (double)totalRx / (1024 * 1024);
                    var totalTxMB = (double)totalTx / (1024 * 1024);

                    _logger.Debug("Sending total usage report", "attempt", attempt, "url", url,
                        "date", date, "total_rx_mb", totalRxMB, "total_tx_mb", totalTxMB);

                    using var response = await _httpClient.SendAsync(request, _cancellationTokenSource?.Token ?? CancellationToken.None);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        var serverResp = JsonSerializer.Deserialize<ServerResponse>(responseContent);

                        if (serverResp != null)
                        {
                            _logger.Info("Total usage report sent successfully",
                                "message", serverResp.Message,
                                "date", date,
                                "total_rx_mb", totalRxMB,
                                "total_tx_mb", totalTxMB);
                        }

                        return;
                    }
                    else if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        _logger.Warn("Device not activated - total usage report rejected",
                            "status", (int)response.StatusCode,
                            "message", responseContent);

                        await SendHealthCheckRequest();

                        lastException = new HttpRequestException("Device not activated. Please wait for user approval.");
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
                    _logger.Warn("Total usage report attempt failed", "attempt", attempt, "error", ex.Message);
                }

                if (attempt < _config.RetryAttempts)
                {
                    var delay = UtilsHelper.ParseTimeSpan(_config.RetryDelay);
                    await Task.Delay(delay, _cancellationTokenSource?.Token ?? CancellationToken.None);
                }
            }

            if (lastException != null)
            {
                _logger.Error("All total usage report attempts failed", "error", lastException.Message);
                throw lastException;
            }
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
}
