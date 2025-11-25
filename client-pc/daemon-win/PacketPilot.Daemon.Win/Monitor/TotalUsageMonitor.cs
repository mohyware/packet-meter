using PacketPilot.Config;
using PacketPilot.Daemon.Win.Logger;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using PacketPilot.Daemon.Win.Utils;
namespace PacketPilot.Daemon.Win.Monitor
{
    public class InterfaceUsage
    {
        public string Interface { get; set; } = "";
        public long TotalRx { get; set; }
        public long TotalTx { get; set; }
        public long LastRx { get; set; }
        public long LastTx { get; set; }
    }

    public class TotalUsage
    {
        public string UtcKey { get; set; } = "";
        public Dictionary<string, InterfaceUsage> Interfaces { get; set; } = new();
    }

    public class TrafficMonitor
    {
        private readonly Logger.Logger _logger;
        private readonly MonitorConfig _config;
        private readonly string _usageFile;
        private readonly List<string> _interfaces = new();
        private TotalUsage? _totalUsage;
        private readonly ReaderWriterLockSlim _UsageLock = new();
        private CancellationTokenSource? _cancellationTokenSource;

        public TrafficMonitor(MonitorConfig config, Logger.Logger logger)
        {
            _config = config;
            _logger = logger;
            _usageFile = Path.Combine(UtilsHelper.GetAppDataDirectory(), "process_usage.json");

        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            _logger.Info("Starting total usage monitor", "interface", _config.Interface);

            // Find network interfaces to monitor
            if (!DiscoverInterfaces())
            {
                throw new InvalidOperationException("Failed to discover network interfaces");
            }

            _logger.Info("Monitoring interfaces", "interfaces", string.Join(", ", _interfaces));

            // Load or initialize total usage snapshot
            if (!LoadUsageSnapshot())
            {
                _logger.Warn("Failed to load total usage snapshot, starting fresh");
                InitUsageSnapshot();
            }

            // Update usage + clear usage every hour
            _ = Task.Run(() => UpdateUsageTaskAsync(_cancellationTokenSource.Token), _cancellationTokenSource.Token);

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
                // avoid non-active interfaces // TODO: we can make this focus only on wifi and ethernet interfaces
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

        private bool LoadUsageSnapshot()
        {
            try
            {
                if (!File.Exists(_usageFile))
                    return false;

                var json = File.ReadAllText(_usageFile);
                var usage = JsonSerializer.Deserialize(json, PacketPilotJsonContext.Default.TotalUsage);
                if (usage == null)
                    return false;

                // Check if it's a new window of time
                var currentUtcKey = UtilsHelper.GetCurrentUtcKey();
                if (usage.UtcKey != currentUtcKey)
                {
                    _logger.Info("New window of time detected, resetting total usage snapshot", "old_utc_key", usage.UtcKey, "new_utc_key", currentUtcKey);
                    InitUsageSnapshot();
                    return true;
                }

                // Check if we have data for all current interfaces
                var missingInterfaces = _interfaces.Where(iface => !usage.Interfaces.ContainsKey(iface)).ToList();

                if (missingInterfaces.Count > 0)
                {
                    _logger.Info("Found new interfaces, initializing them", "interfaces", string.Join(", ", missingInterfaces));
                    _UsageLock.EnterWriteLock();
                    try
                    {
                        _totalUsage = usage;
                        foreach (var iface in missingInterfaces)
                        {
                            InitInterfaceUsageLocked(iface);
                        }
                    }
                    finally
                    {
                        _UsageLock.ExitWriteLock();
                    }
                    SaveUsageSnapshot();
                }
                else
                {
                    _UsageLock.EnterWriteLock();
                    try
                    {
                        _totalUsage = usage;
                    }
                    finally
                    {
                        _UsageLock.ExitWriteLock();
                    }
                }

                // Log loaded usage for each interface
                foreach (var iface in _interfaces.OrderBy(x => x))
                {
                    if (usage.Interfaces.TryGetValue(iface, out var stats))
                    {
                        _logger.Info("Loaded usage for interface",
                            "interface", iface,
                            "UtcKey", usage.UtcKey,
                            "total_rx_mb", (double)stats.TotalRx / (1024 * 1024),
                            "total_tx_mb", (double)stats.TotalTx / (1024 * 1024));
                    }
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to load total usage snapshot", "error", ex.Message);
                return false;
            }
        }

        private void InitUsageSnapshot()
        {
            var currentUtcKey = UtilsHelper.GetCurrentUtcKey();

            _UsageLock.EnterWriteLock();
            try
            {
                _totalUsage = new TotalUsage
                {
                    UtcKey = currentUtcKey,
                    Interfaces = new Dictionary<string, InterfaceUsage>()
                };

                foreach (var iface in _interfaces)
                {
                    InitInterfaceUsageLocked(iface);
                }
            }
            finally
            {
                _UsageLock.ExitWriteLock();
            }

            SaveUsageSnapshot();
            _logger.Info("Initialized usage for all interfaces", "utc_key", currentUtcKey, "interfaces", string.Join(", ", _interfaces));
        }

        private void InitInterfaceUsageLocked(string iface)
        {
            var (rx, tx) = ReadInterfaceCounters(iface);
            if (rx == 0 && tx == 0)
            {
                _logger.Warn("Failed to read interface counters, starting with zeros", "interface", iface);
            }

            _totalUsage!.Interfaces[iface] = new InterfaceUsage
            {
                Interface = iface,
                TotalRx = 0,
                TotalTx = 0,
                LastRx = rx,
                LastTx = tx
            };

            _logger.Info("Initialized interface usage", "interface", iface, "last_rx", rx, "last_tx", tx);
        }

        private async Task UpdateUsageTaskAsync(CancellationToken cancellationToken)
        {
            try
            {
                await AsyncTask.RunPeriodicAsync(
                    UtilsHelper.ParseTimeSpan(_config.UpdateInterval),
                    token =>
                    {
                        try
                        {
                            var currentUtcKey = UtilsHelper.GetCurrentUtcKey();
                            _UsageLock.EnterReadLock();
                            try
                            {
                                if (_totalUsage != null && _totalUsage.UtcKey != currentUtcKey)
                                {
                                    _logger.Info("Window of time changed, resetting total usage snapshot", "old_utc_key", _totalUsage.UtcKey, "new_utc_key", currentUtcKey);
                                    _UsageLock.ExitReadLock();
                                    InitUsageSnapshot();
                                    return Task.CompletedTask;
                                }
                            }
                            finally
                            {
                                if (_UsageLock.IsReadLockHeld)
                                    _UsageLock.ExitReadLock();
                            }

                            UpdateTotalUsage();
                        }
                        catch (Exception ex)
                        {
                            _logger.Error("Error in total usage tracking", "error", ex.Message);
                        }

                        return Task.CompletedTask;
                    },
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                _logger.Info("Total usage monitor stopped");
            }
        }

        private void UpdateTotalUsage()
        {
            _UsageLock.EnterWriteLock();
            try
            {
                if (_totalUsage == null)
                    return;

                foreach (var kvp in _totalUsage.Interfaces)
                {
                    UpdateInterfaceUsage(kvp.Key, kvp.Value);
                }

                SaveUsageSnapshot();
            }
            finally
            {
                _UsageLock.ExitWriteLock();
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

            // Add to hourly totals
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

        private (long rx, long tx) ReadInterfaceCounters(string iface)
        {
            try
            {
                var networkInterface = NetworkInterface.GetAllNetworkInterfaces()
                    .FirstOrDefault(ni => ni.Name == iface);

                if (networkInterface == null)
                    return (0, 0);

                var stats = networkInterface.GetIPStatistics();
                return ((long)stats.BytesReceived, (long)stats.BytesSent);
            }
            catch (Exception ex)
            {
                _logger.Debug("Failed to read interface counters", "interface", iface, "error", ex.Message);
                return (0, 0);
            }
        }

        private void SaveUsageSnapshot()
        {
            try
            {
                var dir = Path.GetDirectoryName(_usageFile);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                var json = JsonSerializer.Serialize(_totalUsage, PacketPilotJsonContext.Default.TotalUsage);
                File.WriteAllText(_usageFile, json);
            }
            catch (Exception ex)
            {
                _logger.Warn("Failed to save total usage snapshot", "error", ex.Message);
            }
        }

        public TotalUsage? GetTotalUsage()
        {
            _UsageLock.EnterReadLock();
            try
            {
                if (_totalUsage == null)
                    return null;

                // Return a copy
                var usage = new TotalUsage
                {
                    UtcKey = _totalUsage.UtcKey,
                    Interfaces = new Dictionary<string, InterfaceUsage>()
                };

                foreach (var kvp in _totalUsage.Interfaces.OrderBy(x => x.Key))
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
                _UsageLock.ExitReadLock();
            }
        }

        public void ResetStats()
        {
            _UsageLock.EnterWriteLock();
            try
            {
                if (_totalUsage != null)
                {
                    foreach (var stats in _totalUsage.Interfaces.Values)
                    {
                        stats.TotalRx = 0;
                        stats.TotalTx = 0;
                    }
                    SaveUsageSnapshot();
                }
            }
            finally
            {
                _UsageLock.ExitWriteLock();
            }

            _logger.Info("Total usage statistics reset for all interfaces");
        }

        public void Dispose()
        {
            _UsageLock?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
}