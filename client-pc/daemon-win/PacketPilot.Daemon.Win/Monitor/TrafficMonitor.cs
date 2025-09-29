using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Logger;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win.Monitor
{
    public class InterfaceUsage
    {
        public string Interface { get; set; } = "";
        public ulong TotalRx { get; set; }
        public ulong TotalTx { get; set; }
        public ulong LastRx { get; set; }
        public ulong LastTx { get; set; }
    }

    public class DailyUsage
    {
        public string Date { get; set; } = ""; // YYYY-MM-DD
        public Dictionary<string, InterfaceUsage> Interfaces { get; set; } = new();
    }

    public class TrafficMonitor
    {
        private readonly MonitorConfig _config;
        private readonly Logger.Logger _logger;
        private readonly string _usageFile;
        private readonly List<string> _interfaces = new();
        private DailyUsage? _dailyUsage;
        private readonly ReaderWriterLockSlim _dailyMutex = new();
        private CancellationTokenSource? _cancellationTokenSource;

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

            _logger.Info("Starting daily usage monitor", "interface", _config.Interface);

            // Find network interfaces to monitor
            if (!DiscoverInterfaces())
            {
                throw new InvalidOperationException("Failed to discover network interfaces");
            }

            _logger.Info("Monitoring interfaces", "interfaces", string.Join(", ", _interfaces));

            // Load or initialize daily usage
            if (!LoadDailyUsage())
            {
                _logger.Warn("Failed to load daily usage, starting fresh");
                InitDailyUsage();
            }

            // Start daily usage tracking
            _ = Task.Run(() => TrackDailyUsageAsync(_cancellationTokenSource.Token), _cancellationTokenSource.Token);

            await Task.CompletedTask;
        }

        public void Stop()
        {
            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource?.Dispose();
        }

        private bool DiscoverInterfaces()
        {
            try
            {
                // avoid non-active interfaces
                var networkInterfaces = NetworkInterface.GetAllNetworkInterfaces()
                    .Where(ni => ni.OperationalStatus == OperationalStatus.Up &&
                                (ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ||
                                ni.NetworkInterfaceType == NetworkInterfaceType.Ethernet))
                    .Where(ni => !ni.Name.Contains("QoS") &&
                                !ni.Name.Contains("WFP") &&
                                !ni.Name.Contains("Filter") &&
                                !ni.Name.Contains("Packet Scheduler") &&
                                !ni.Name.Contains("Virtual") &&
                                (ni.GetIPv4Statistics().BytesReceived > 0 ||
                                 ni.GetIPv4Statistics().BytesSent > 0))
                    .Select(ni => ni.Name)
                    .Distinct()
                    .ToList();

                if (_config.Interface == "any")
                {
                    _interfaces.AddRange(networkInterfaces);
                }
                else
                {
                    if (networkInterfaces.Contains(_config.Interface))
                    {
                        _interfaces.Add(_config.Interface);
                    }
                    else
                    {
                        _logger.Error("Interface not found", "interface", _config.Interface);
                        return false;
                    }
                }

                if (_interfaces.Count == 0)
                {
                    _logger.Error("No suitable network interfaces found");
                    return false;
                }

                _interfaces.Sort();
                return true;
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to discover interfaces", "error", ex.Message);
                return false;
            }
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

                // Check if we have data for all current interfaces
                var missingInterfaces = _interfaces.Where(iface => !usage.Interfaces.ContainsKey(iface)).ToList();

                if (missingInterfaces.Count > 0)
                {
                    _logger.Info("Found new interfaces, initializing them", "interfaces", string.Join(", ", missingInterfaces));
                    _dailyMutex.EnterWriteLock();
                    try
                    {
                        _dailyUsage = usage;
                        foreach (var iface in missingInterfaces)
                        {
                            InitInterfaceUsageLocked(iface);
                        }
                    }
                    finally
                    {
                        _dailyMutex.ExitWriteLock();
                    }
                    SaveDailyUsage();
                }
                else
                {
                    _dailyMutex.EnterWriteLock();
                    try
                    {
                        _dailyUsage = usage;
                    }
                    finally
                    {
                        _dailyMutex.ExitWriteLock();
                    }
                }

                // Log loaded usage for each interface
                foreach (var iface in _interfaces.OrderBy(x => x))
                {
                    if (usage.Interfaces.TryGetValue(iface, out var stats))
                    {
                        _logger.Info("Loaded daily usage for interface",
                            "interface", iface,
                            "date", usage.Date,
                            "total_rx_mb", (double)stats.TotalRx / (1024 * 1024),
                            "total_tx_mb", (double)stats.TotalTx / (1024 * 1024));
                    }
                }

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
                    Interfaces = new Dictionary<string, InterfaceUsage>()
                };

                foreach (var iface in _interfaces)
                {
                    InitInterfaceUsageLocked(iface);
                }
            }
            finally
            {
                _dailyMutex.ExitWriteLock();
            }

            SaveDailyUsage();
            _logger.Info("Initialized daily usage for all interfaces", "date", today, "interfaces", string.Join(", ", _interfaces));
        }

        private void InitInterfaceUsageLocked(string iface)
        {
            var (rx, tx) = ReadInterfaceCounters(iface);
            if (rx == 0 && tx == 0)
            {
                _logger.Warn("Failed to read interface counters, starting with zeros", "interface", iface);
            }

            _dailyUsage!.Interfaces[iface] = new InterfaceUsage
            {
                Interface = iface,
                TotalRx = 0,
                TotalTx = 0,
                LastRx = rx,
                LastTx = tx
            };

            _logger.Info("Initialized interface usage", "interface", iface, "last_rx", rx, "last_tx", tx);
        }

        private async Task TrackDailyUsageAsync(CancellationToken cancellationToken)
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
                    UpdateDailyUsage();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.Error("Error in daily usage tracking", "error", ex.Message);
                }
            }

            _logger.Info("Daily usage monitor stopped");
        }

        private void UpdateDailyUsage()
        {
            _dailyMutex.EnterWriteLock();
            try
            {
                if (_dailyUsage == null)
                    return;

                foreach (var kvp in _dailyUsage.Interfaces)
                {
                    UpdateInterfaceUsage(kvp.Key, kvp.Value);
                }

                SaveDailyUsage();
            }
            finally
            {
                _dailyMutex.ExitWriteLock();
            }
        }

        private void UpdateInterfaceUsage(string iface, InterfaceUsage stats)
        {
            var (rx, tx) = ReadInterfaceCounters(iface);
            _logger.Debug("Read interface counters", "interface", iface, "rx", rx, "tx", tx);
            if (rx == 0 && tx == 0)
            {
                _logger.Warn("Failed to read interface counters", "interface", iface);
                return;
            }

            // Calculate delta since last read
            var deltaRx = rx - stats.LastRx;
            var deltaTx = tx - stats.LastTx;

            // Add to daily totals
            stats.TotalRx += deltaRx;
            stats.TotalTx += deltaTx;
            stats.LastRx = rx;
            stats.LastTx = tx;

            _logger.Debug("Interface usage updated",
                "interface", iface,
                "delta_rx_kb", (double)deltaRx / 1024,
                "delta_tx_kb", (double)deltaTx / 1024,
                "total_rx_mb", (double)stats.TotalRx / (1024 * 1024),
                "total_tx_mb", (double)stats.TotalTx / (1024 * 1024));
        }

        private (ulong rx, ulong tx) ReadInterfaceCounters(string iface)
        {
            try
            {
                var networkInterface = NetworkInterface.GetAllNetworkInterfaces()
                    .FirstOrDefault(ni => ni.Name == iface);

                if (networkInterface == null)
                    return (0, 0);

                var stats = networkInterface.GetIPStatistics();
                return ((ulong)stats.BytesReceived, (ulong)stats.BytesSent);
            }
            catch (Exception ex)
            {
                _logger.Debug("Failed to read interface counters", "interface", iface, "error", ex.Message);
                return (0, 0);
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
                    Interfaces = new Dictionary<string, InterfaceUsage>()
                };

                foreach (var kvp in _dailyUsage.Interfaces.OrderBy(x => x.Key))
                {
                    usage.Interfaces[kvp.Key] = new InterfaceUsage
                    {
                        Interface = kvp.Value.Interface,
                        TotalRx = kvp.Value.TotalRx,
                        TotalTx = kvp.Value.TotalTx,
                        LastRx = kvp.Value.LastRx,
                        LastTx = kvp.Value.LastTx
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
                    foreach (var stats in _dailyUsage.Interfaces.Values)
                    {
                        stats.TotalRx = 0;
                        stats.TotalTx = 0;
                    }
                    SaveDailyUsage();
                }
            }
            finally
            {
                _dailyMutex.ExitWriteLock();
            }

            _logger.Info("Daily usage statistics reset for all interfaces");
        }

        public void Dispose()
        {
            _dailyMutex?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
}
