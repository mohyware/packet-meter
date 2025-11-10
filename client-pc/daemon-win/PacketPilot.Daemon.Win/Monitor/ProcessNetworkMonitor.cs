using PacketPilot.Daemon.Win.Logger;
using Microsoft.Diagnostics.Tracing;
using Microsoft.Diagnostics.Tracing.Session;
using Microsoft.Diagnostics.Tracing.Parsers;
using Microsoft.Diagnostics.Tracing.Parsers.Kernel;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Net;

namespace PacketPilot.Daemon.Win.Monitor
{
    public class ProcessNetworkUsage
    {
        public int ProcessId { get; set; }
        public string ProcessName { get; set; } = "";
        public string ProcessPath { get; set; } = "";
        public string ProcessIconBase64 { get; set; } = "";
        public ulong TotalRxBytes { get; set; }
        public ulong TotalTxBytes { get; set; }
        public DateTime LastSeen { get; set; }
    }

    public class ProcessInfo
    {
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";
        public string IconBase64 { get; set; } = "";
    }


    public class ProcessNetworkMonitor : IDisposable
    {
        private readonly Logger.Logger _logger;
        private TraceEventSession? _etwSession;
        private Task? _processingTask;
        private readonly ConcurrentDictionary<int, ProcessNetworkUsage> _processUsage = new();
        private readonly ReaderWriterLockSlim _processUsageLock = new();
        private CancellationTokenSource? _cancellationTokenSource;
        private readonly object _sessionLock = new object();
        private bool _disposed = false;

        // Process info cache to avoid repeated Process.GetProcessById calls
        private readonly ConcurrentDictionary<int, ProcessInfo> _processInfoCache = new();
        private readonly System.Timers.Timer? _processNameRefreshTimer;

        public ProcessNetworkMonitor(Logger.Logger logger)
        {
            _logger = logger;

            // Refresh process name cache every 5 seconds to handle process name changes
            _processNameRefreshTimer = new System.Timers.Timer(5000);
            _processNameRefreshTimer.Elapsed += (sender, e) => RefreshProcessNames();
            _processNameRefreshTimer.AutoReset = true;
            _processNameRefreshTimer.Start();
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            try
            {
                lock (_sessionLock)
                {
                    if (_etwSession != null)
                    {
                        _logger.Warn("ETW session already started");
                        return;
                    }

                    // Create ETW session for real-time processing
                    // Use a unique session name with process ID to avoid conflicts
                    var sessionName = $"PacketPilotProcessMonitor_{Process.GetCurrentProcess().Id}";

                    // Stop any existing session with the same name (cleanup from previous runs)
                    try
                    {
                        var existingSession = TraceEventSession.GetActiveSession(sessionName);
                        if (existingSession != null)
                        {
                            existingSession.Stop();
                            existingSession.Dispose();
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.Warn("Error stopping existing ETW session", "error", ex.Message);
                        // Ignore if session doesn't exist or can't be stopped
                    }

                    _etwSession = new TraceEventSession(sessionName);

                    // Enable Microsoft-Windows-Kernel-Network provider for network events
                    // This provider gives us TCP/IP send and receive events with process information
                    // NetworkTCPIP includes both TCP and UDP events
                    _etwSession.EnableKernelProvider(
                        KernelTraceEventParser.Keywords.NetworkTCPIP
                    );

                    _logger.Info("ETW session started for process network monitoring");

                    // Start processing events in a separate task
                    _processingTask = Task.Run(() => ProcessEvents(_cancellationTokenSource.Token), _cancellationTokenSource.Token);
                }

                // Start periodic logging of process usage
                _ = Task.Run(() => LogProcessUsagePeriodically(_cancellationTokenSource.Token), _cancellationTokenSource.Token);

                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to start process network monitor", "error", ex.Message, "stack_trace", ex.StackTrace ?? "N/A");
                throw;
            }
        }

        public void Stop()
        {
            _cancellationTokenSource?.Cancel();
            _processNameRefreshTimer?.Stop();

            lock (_sessionLock)
            {
                try
                {
                    // Stop processing events first
                    _etwSession?.Source?.StopProcessing();
                }
                catch (Exception ex)
                {
                    _logger.Debug("Error stopping ETW source processing", "error", ex.Message);
                }

                try
                {
                    _etwSession?.Stop();
                }
                catch (Exception ex)
                {
                    _logger.Error("Error stopping ETW session", "error", ex.Message);
                }
                finally
                {
                    _etwSession?.Dispose();
                    _etwSession = null;
                }
            }

            try
            {
                _processingTask?.Wait(TimeSpan.FromSeconds(5));
            }
            catch (Exception ex)
            {
                _logger.Debug("Error waiting for processing task", "error", ex.Message);
            }

            _logger.Info("Process network monitor stopped");
        }

        private void ProcessEvents(CancellationToken cancellationToken)
        {
            if (_etwSession == null)
                return;

            try
            {
                var source = _etwSession.Source;
                var kernelParser = new KernelTraceEventParser(source);

                // Handle TCP/IP send events (outgoing data)
                kernelParser.TcpIpSend += data =>
                {
                    if (cancellationToken.IsCancellationRequested)
                        return;

                    // Skip localhost / loopback
                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                    {
                        _logger.Debug("Skipping localhost / loopback TCP send event", "process_id", data.ProcessID);
                        return;
                    }

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: (ulong)size, rxBytes: 0);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.Debug("Error processing TCP send event", "error", ex.Message, "event_name", data.EventName);
                    }
                };

                // Handle TCP/IP receive events (incoming data)
                kernelParser.TcpIpRecv += data =>
                {
                    if (cancellationToken.IsCancellationRequested)
                        return;

                    // Skip localhost / loopback
                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                        return;

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: 0, rxBytes: (ulong)size);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.Debug("Error processing TCP receive event", "error", ex.Message, "event_name", data.EventName);
                    }
                };

                // Handle UDP send events
                kernelParser.UdpIpSend += data =>
                {
                    if (cancellationToken.IsCancellationRequested)
                        return;

                    // Skip localhost / loopback
                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                        return;

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: (ulong)size, rxBytes: 0);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.Debug("Error processing UDP send event", "error", ex.Message, "event_name", data.EventName);
                    }
                };

                // Handle UDP receive events
                kernelParser.UdpIpRecv += data =>
                {
                    if (cancellationToken.IsCancellationRequested)
                        return;

                    // Skip localhost / loopback
                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                        return;

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: 0, rxBytes: (ulong)size);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.Debug("Error processing UDP receive event", "error", ex.Message, "event_name", data.EventName);
                    }
                };

                _logger.Info("Starting ETW event processing");

                // Process events - this blocks until source.StopProcessing() is called
                // We'll stop it when cancellation is requested from the Stop() method
                try
                {
                    source.Process();
                }
                catch (Exception ex)
                {
                    if (!cancellationToken.IsCancellationRequested)
                    {
                        _logger.Error("Error in ETW event processing loop", "error", ex.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                if (!cancellationToken.IsCancellationRequested)
                {
                    _logger.Error("Error in ETW event processing", "error", ex.Message, "stack_trace", ex.StackTrace ?? "N/A");
                }
            }
        }

        private static bool IsLocalAddress(IPAddress ipAddress)
        {
            var address = ipAddress.ToString();

            if (string.IsNullOrWhiteSpace(address))
                return false;

            if (IPAddress.TryParse(address, out var ip))
            {
                return IPAddress.IsLoopback(ip);
            }

            return false;
        }

        private void UpdateProcessUsage(int processId, ulong txBytes, ulong rxBytes)
        {
            _processUsageLock.EnterUpgradeableReadLock();
            try
            {
                if (!_processUsage.TryGetValue(processId, out var usage))
                {
                    _processUsageLock.EnterWriteLock();
                    try
                    {
                        var processInfo = GetProcessInfo(processId);
                        usage = new ProcessNetworkUsage
                        {
                            ProcessId = processId,
                            ProcessName = processInfo.Name,
                            ProcessPath = processInfo.Path,
                            ProcessIconBase64 = processInfo.IconBase64,
                            TotalRxBytes = 0,
                            TotalTxBytes = 0,
                            LastSeen = DateTime.Now
                        };
                        _processUsage[processId] = usage;
                    }
                    finally
                    {
                        _processUsageLock.ExitWriteLock();
                    }
                }

                usage.TotalRxBytes += rxBytes;
                usage.TotalTxBytes += txBytes;
                usage.LastSeen = DateTime.Now;
            }
            finally
            {
                _processUsageLock.ExitUpgradeableReadLock();
            }
        }

        private string ExtractIconAsBase64(string exePath)
        {
            try
            {
                // Extract icon using Icon.ExtractAssociatedIcon - much simpler!
                var icon = System.Drawing.Icon.ExtractAssociatedIcon(exePath);
                if (icon == null)
                {
                    return "";
                }

                using (icon)
                {
                    // Convert icon to base64
                    using var ms = new MemoryStream();
                    icon.Save(ms);
                    byte[] iconBytes = ms.ToArray();
                    return Convert.ToBase64String(iconBytes);
                }
            }
            catch
            {
                return "";
            }
        }

        private ProcessInfo GetProcessInfo(int processId)
        {
            // Check cache first
            if (_processInfoCache.TryGetValue(processId, out var cachedInfo))
            {
                return cachedInfo;
            }

            try
            {
                using var process = Process.GetProcessById(processId);
                var name = process.ProcessName;
                string path = "";

                try
                {
                    // Try to get the main module path
                    // Note: This requires appropriate permissions and may fail for system processes
                    if (process.MainModule != null && !string.IsNullOrEmpty(process.MainModule.FileName))
                    {
                        path = process.MainModule.FileName;
                    }
                }
                catch (System.ComponentModel.Win32Exception)
                {
                    // Access denied - some processes (especially system processes) may not allow access to MainModule
                    // Leave path empty for these processes
                    path = "";
                }
                catch (InvalidOperationException)
                {
                    // Process has exited or MainModule is not available
                    path = "";
                }
                catch
                {
                    // Other exceptions - leave path empty
                    path = "";
                }

                // Extract icon if path is available
                string iconBase64 = "";
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                {
                    try
                    {
                        iconBase64 = ExtractIconAsBase64(path);
                    }
                    catch
                    {
                        // If icon extraction fails, leave it empty
                        iconBase64 = "";
                    }
                }

                var info = new ProcessInfo
                {
                    Name = name,
                    Path = path,
                    IconBase64 = iconBase64
                };

                _processInfoCache[processId] = info;
                return info;
            }
            catch (ArgumentException)
            {
                // Process no longer exists
                var info = new ProcessInfo
                {
                    Name = $"PID_{processId}",
                    Path = ""
                };
                return info;
            }
            catch (Exception ex)
            {
                _logger.Debug("Failed to get process info", "pid", processId, "error", ex.Message);
                var info = new ProcessInfo
                {
                    Name = $"PID_{processId}",
                    Path = ""
                };
                return info;
            }
        }

        private void RefreshProcessNames()
        {
            var pidsToRefresh = new List<int>();

            _processUsageLock.EnterReadLock();
            try
            {
                pidsToRefresh.AddRange(_processUsage.Keys);
            }
            finally
            {
                _processUsageLock.ExitReadLock();
            }

            foreach (var pid in pidsToRefresh)
            {
                try
                {
                    if (_processUsage.TryGetValue(pid, out var usage))
                    {
                        var processInfo = GetProcessInfo(pid);
                        if (usage.ProcessName != processInfo.Name || usage.ProcessPath != processInfo.Path || usage.ProcessIconBase64 != processInfo.IconBase64)
                        {
                            usage.ProcessName = processInfo.Name;
                            usage.ProcessPath = processInfo.Path;
                            usage.ProcessIconBase64 = processInfo.IconBase64;
                        }
                    }
                }
                catch
                {
                    // Ignore errors during refresh
                }
            }

            // Clean up old process info cache entries
            var validPids = new HashSet<int>(pidsToRefresh);
            var cacheKeysToRemove = _processInfoCache.Keys.Where(k => !validPids.Contains(k)).ToList();
            foreach (var key in cacheKeysToRemove)
            {
                _processInfoCache.TryRemove(key, out _);
            }
        }

        private async Task LogProcessUsagePeriodically(CancellationToken cancellationToken)
        {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await timer.WaitForNextTickAsync(cancellationToken);
                    LogProcessUsage();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.Error("Error in periodic process usage logging", "error", ex.Message);
                }
            }
        }

        private void LogProcessUsage()
        {
            _processUsageLock.EnterReadLock();
            try
            {
                // Clean up processes that haven't been seen in the last 5 minutes
                var cutoffTime = DateTime.Now.Subtract(TimeSpan.FromMinutes(5));
                var staleProcesses = _processUsage
                    .Where(kvp => kvp.Value.LastSeen < cutoffTime)
                    .Select(kvp => kvp.Key)
                    .ToList();

                if (staleProcesses.Count > 0)
                {
                    _processUsageLock.ExitReadLock();
                    _processUsageLock.EnterWriteLock();
                    try
                    {
                        foreach (var pid in staleProcesses)
                        {
                            if (_processUsage.TryRemove(pid, out var usage))
                            {
                                _logger.Info("Removed stale process from monitoring",
                                    "pid", pid,
                                    "process_name", usage.ProcessName,
                                    "process_path", usage.ProcessPath,
                                    "process_icon_base64", usage.ProcessIconBase64,
                                    "total_rx_mb", (double)usage.TotalRxBytes / (1024 * 1024),
                                    "total_tx_mb", (double)usage.TotalTxBytes / (1024 * 1024));
                            }
                        }
                    }
                    finally
                    {
                        _processUsageLock.ExitWriteLock();
                        _processUsageLock.EnterReadLock();
                    }
                }

                // Calculate total usage across all processes
                ulong totalRxBytes = 0;
                ulong totalTxBytes = 0;
                foreach (var process in _processUsage.Values)
                {
                    totalRxBytes += process.TotalRxBytes;
                    totalTxBytes += process.TotalTxBytes;
                }

                // Log total process usage
                if (totalRxBytes > 0 || totalTxBytes > 0)
                {
                    _logger.Info("Total process network usage",
                        "total_rx_bytes", totalRxBytes,
                        "total_tx_bytes", totalTxBytes,
                        "total_rx_mb", (double)totalRxBytes / (1024 * 1024),
                        "total_tx_mb", (double)totalTxBytes / (1024 * 1024),
                        "total_mb", (double)(totalRxBytes + totalTxBytes) / (1024 * 1024),
                        "process_count", _processUsage.Count);
                }

                // Log active processes with significant network usage
                var activeProcesses = _processUsage.Values
                    .Where(p => p.TotalRxBytes > 0 || p.TotalTxBytes > 0)
                    .OrderByDescending(p => p.TotalRxBytes + p.TotalTxBytes)
                    .Take(20) // Log top 20 processes
                    .ToList();

                if (activeProcesses.Count > 0)
                {
                    _logger.Info("Process network usage summary",
                        "active_processes", activeProcesses.Count);

                    foreach (var process in activeProcesses)
                    {
                        _logger.Info("Process network usage",
                            "pid", process.ProcessId,
                            "process_name", process.ProcessName,
                            "rx_bytes", process.TotalRxBytes,
                            "tx_bytes", process.TotalTxBytes,
                            "total_mb", (double)(process.TotalRxBytes + process.TotalTxBytes) / (1024 * 1024));
                    }
                }
            }
            finally
            {
                _processUsageLock.ExitReadLock();
            }
        }

        public Dictionary<int, ProcessNetworkUsage> GetProcessUsage()
        {
            _processUsageLock.EnterReadLock();
            try
            {
                return _processUsage.ToDictionary(kvp => kvp.Key, kvp => new ProcessNetworkUsage
                {
                    ProcessId = kvp.Value.ProcessId,
                    ProcessName = kvp.Value.ProcessName,
                    ProcessPath = kvp.Value.ProcessPath,
                    ProcessIconBase64 = kvp.Value.ProcessIconBase64,
                    TotalRxBytes = kvp.Value.TotalRxBytes,
                    TotalTxBytes = kvp.Value.TotalTxBytes,
                    LastSeen = kvp.Value.LastSeen
                });
            }
            finally
            {
                _processUsageLock.ExitReadLock();
            }
        }

        public void Dispose()
        {
            if (_disposed)
                return;

            Stop();
            _processNameRefreshTimer?.Dispose();
            _processUsageLock?.Dispose();
            _cancellationTokenSource?.Dispose();
            _disposed = true;
        }
    }
}

