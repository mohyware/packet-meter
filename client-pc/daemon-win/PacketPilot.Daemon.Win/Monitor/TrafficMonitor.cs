using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Logger;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win.Monitor
{
    public class AppUsage
    {
        public string Identifier { get; set; } = ""; // Process path (e.g., C:\Program Files\chrome.exe)
        public string DisplayName { get; set; } = ""; // Process name (e.g., chrome)
        public string IconHash { get; set; } = ""; // Base64 encoded icon (optional)
        public ulong TotalRx { get; set; }
        public ulong TotalTx { get; set; }
        public DateTime LastSeen { get; set; }
    }

    public class DailyUsage
    {
        public string Date { get; set; } = ""; // YYYY-MM-DD
        public Dictionary<string, AppUsage> Apps { get; set; } = new(); // Key: process path (identifier)
    }

    public class TrafficMonitor
    {
        private readonly MonitorConfig _config;
        private readonly Logger.Logger _logger;
        private readonly string _usageFile;
        private DailyUsage? _dailyUsage;
        private readonly ReaderWriterLockSlim _dailyMutex = new();
        private CancellationTokenSource? _cancellationTokenSource;
        private ProcessNetworkMonitor? _processMonitor;

        public TrafficMonitor(MonitorConfig config, Logger.Logger logger)
        {
            _config = config;
            _logger = logger;
            _usageFile = string.IsNullOrEmpty(config.UsageFile)
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PacketPilot", "daily_usage.json")
                : config.UsageFile;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            _logger.Info("Starting app-based usage monitor");

            // Load or initialize daily usage
            if (!LoadDailyUsage())
            {
                _logger.Warn("Failed to load daily usage, starting fresh");
                InitDailyUsage();
            }

            // Start process network monitoring using ETW (required for app-based monitoring)
            try
            {
                _processMonitor = new ProcessNetworkMonitor(_logger);
                await _processMonitor.StartAsync(_cancellationTokenSource.Token);
                _logger.Info("Process network monitoring started");
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to start process network monitoring", "error", ex.Message, "note", "Process monitoring requires administrator privileges");
                throw; // Fail if process monitoring is not available
            }

            // Start periodic aggregation of process usage into app usage
            _ = Task.Run(() => AggregateAppUsageAsync(_cancellationTokenSource.Token), _cancellationTokenSource.Token);

            await Task.CompletedTask;
        }

        public void Stop()
        {
            _cancellationTokenSource?.Cancel();
            _processMonitor?.Stop();
            _cancellationTokenSource?.Dispose();
        }

        private bool LoadDailyUsage()
        {
            try
            {
                if (!File.Exists(_usageFile))
                    return false;

                var json = File.ReadAllText(_usageFile);
                var usage = JsonSerializer.Deserialize<DailyUsage>(json);
                if (usage == null)
                    return false;

                // Check if it's a new day
                var today = DateTime.Now.ToString("yyyy-MM-dd");
                if (usage.Date != today)
                {
                    _logger.Info("New day detected, resetting daily usage", "old_date", usage.Date, "new_date", today);
                    InitDailyUsage();
                    return true;
                }

                // Load existing usage
                _dailyMutex.EnterWriteLock();
                try
                {
                    _dailyUsage = usage;
                }
                finally
                {
                    _dailyMutex.ExitWriteLock();
                }

                // Log loaded usage
                _logger.Info("Loaded daily usage", "date", usage.Date, "apps", usage.Apps.Count);

                return true;
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to load daily usage", "error", ex.Message);
                return false;
            }
        }

        private void InitDailyUsage()
        {
            var today = DateTime.Now.ToString("yyyy-MM-dd");

            _dailyMutex.EnterWriteLock();
            try
            {
                _dailyUsage = new DailyUsage
                {
                    Date = today,
                    Apps = new Dictionary<string, AppUsage>()
                };
            }
            finally
            {
                _dailyMutex.ExitWriteLock();
            }

            SaveDailyUsage();
            _logger.Info("Initialized daily usage for apps", "date", today);
        }

        private async Task AggregateAppUsageAsync(CancellationToken cancellationToken)
        {
            TimeSpan interval = _config.UpdateInterval.Last() switch
            {
                's' => TimeSpan.FromSeconds(int.Parse(_config.UpdateInterval.TrimEnd('s'))),
                'm' => TimeSpan.FromMinutes(int.Parse(_config.UpdateInterval.TrimEnd('m'))),
                'h' => TimeSpan.FromHours(int.Parse(_config.UpdateInterval.TrimEnd('h'))),
                _ => TimeSpan.FromSeconds(5)
            };
            using var timer = new PeriodicTimer(interval);

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await timer.WaitForNextTickAsync(cancellationToken);
                    UpdateAppUsage();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.Error("Error in app usage aggregation", "error", ex.Message);
                }
            }

            _logger.Info("App usage aggregation stopped");
        }

        private void UpdateAppUsage()
        {
            if (_processMonitor == null)
                return;

            _dailyMutex.EnterWriteLock();
            try
            {
                if (_dailyUsage == null)
                    return;

                // Get current process usage from ProcessNetworkMonitor
                var processUsage = _processMonitor.GetProcessUsage();

                // Aggregate process usage by app (process path)
                // ProcessNetworkMonitor tracks cumulative usage since monitor started
                // We'll use these values directly for reporting (server handles hourly grouping)
                foreach (var process in processUsage.Values)
                {
                    // Use process path as identifier, fallback to process name if path is empty
                    var identifier = !string.IsNullOrEmpty(process.ProcessPath)
                        ? process.ProcessPath
                        : process.ProcessName;

                    if (!_dailyUsage.Apps.TryGetValue(identifier, out var appUsage))
                    {
                        // Create new app entry
                        appUsage = new AppUsage
                        {
                            Identifier = identifier,
                            DisplayName = process.ProcessName,
                            IconHash = process.ProcessIconBase64,
                            TotalRx = 0,
                            TotalTx = 0,
                            LastSeen = DateTime.Now
                        };
                        _dailyUsage.Apps[identifier] = appUsage;
                    }

                    // Update app usage - store current process usage values
                    // Note: These are cumulative since ProcessNetworkMonitor started, not daily totals
                    // The server will handle proper hourly/daily aggregation
                    appUsage.TotalRx = process.TotalRxBytes;
                    appUsage.TotalTx = process.TotalTxBytes;
                    appUsage.LastSeen = process.LastSeen;

                    // Update display name and icon if process info is available
                    if (!string.IsNullOrEmpty(process.ProcessName))
                        appUsage.DisplayName = process.ProcessName;
                    if (!string.IsNullOrEmpty(process.ProcessIconBase64))
                        appUsage.IconHash = process.ProcessIconBase64;
                }

                SaveDailyUsage();
            }
            finally
            {
                _dailyMutex.ExitWriteLock();
            }
        }

        private void SaveDailyUsage()
        {
            try
            {
                var dir = Path.GetDirectoryName(_usageFile);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                var json = JsonSerializer.Serialize(_dailyUsage, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_usageFile, json);
            }
            catch (Exception ex)
            {
                _logger.Warn("Failed to save daily usage", "error", ex.Message);
            }
        }

        public DailyUsage? GetDailyUsage()
        {
            _dailyMutex.EnterReadLock();
            try
            {
                if (_dailyUsage == null)
                    return null;

                // Return a copy
                var usage = new DailyUsage
                {
                    Date = _dailyUsage.Date,
                    Apps = new Dictionary<string, AppUsage>()
                };

                foreach (var kvp in _dailyUsage.Apps.OrderBy(x => x.Key))
                {
                    usage.Apps[kvp.Key] = new AppUsage
                    {
                        Identifier = kvp.Value.Identifier,
                        DisplayName = kvp.Value.DisplayName,
                        IconHash = kvp.Value.IconHash,
                        TotalRx = kvp.Value.TotalRx,
                        TotalTx = kvp.Value.TotalTx,
                        LastSeen = kvp.Value.LastSeen
                    };
                }

                return usage;
            }
            finally
            {
                _dailyMutex.ExitReadLock();
            }
        }

        public void ResetStats()
        {
            _dailyMutex.EnterWriteLock();
            try
            {
                if (_dailyUsage != null)
                {
                    foreach (var app in _dailyUsage.Apps.Values)
                    {
                        app.TotalRx = 0;
                        app.TotalTx = 0;
                    }
                    SaveDailyUsage();
                }
            }
            finally
            {
                _dailyMutex.ExitWriteLock();
            }

            _logger.Info("Daily usage statistics reset for all apps");
        }

        public void Dispose()
        {
            _processMonitor?.Dispose();
            _dailyMutex?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
}
