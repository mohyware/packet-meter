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
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using PacketPilot.Daemon.Win.Models;
using PacketPilot.Daemon.Win.Utils;
using System.Text.Json;

namespace PacketPilot.Daemon.Win.Monitor
{
    public class ProcessInfo
    {
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";
        public string IconBase64 { get; set; } = "";
    }


    public class ProcessNetworkMonitor : IDisposable
    {
        private readonly Logger.Logger _logger;

        private readonly Config.MonitorConfig _config;
        private TraceEventSession? _etwSession;
        private Task? _processingTask;
        private readonly ConcurrentDictionary<string, ProcessNetworkUsage> _processUsage = new();
        private readonly ReaderWriterLockSlim _processUsageLock = new();
        private CancellationTokenSource? _cancellationTokenSource;
        private readonly object _sessionLock = new object();
        private bool _disposed = false;

        // Process info cache to avoid repeated Process.GetProcessById calls
        private readonly ConcurrentDictionary<int, ProcessInfo> _processInfoCache = new();

        public ProcessNetworkMonitor(Logger.Logger logger, Config.MonitorConfig config)
        {
            _logger = logger;
            _config = config;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            try
            {
                LoadUsageSnapshot();

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
                // Start periodic cache clearing (hourly)
                _ = Task.Run(() => ClearCachesPeriodically(_cancellationTokenSource.Token), _cancellationTokenSource.Token);

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

            lock (_sessionLock)
            {
                try
                {
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
                        return;
                    }

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: (long)size, rxBytes: 0);
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

                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                        return;

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: 0, rxBytes: (long)size);
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

                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                        return;

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: (long)size, rxBytes: 0);
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

                    if (IsLocalAddress(data.saddr) && IsLocalAddress(data.daddr))
                        return;

                    try
                    {
                        int pid = data.ProcessID;
                        int size = data.size;

                        if (pid > 0 && size > 0)
                        {
                            UpdateProcessUsage(pid, txBytes: 0, rxBytes: (long)size);
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

        private static bool IsLocalAddress(IPAddress? address)
        {
            return address != null && IPAddress.IsLoopback(address);
        }

        private void UpdateProcessUsage(int processId, long txBytes, long rxBytes)
        {
            _processUsageLock.EnterUpgradeableReadLock();
            try
            {
                var processInfo = GetProcessInfo(processId);
                var identifier = !string.IsNullOrEmpty(processInfo.Path) ? processInfo.Path : processInfo.Name;

                if (!_processUsage.TryGetValue(identifier, out var usage))
                {
                    _processUsageLock.EnterWriteLock();
                    try
                    {
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
                        _processUsage[identifier] = usage;
                    }
                    finally
                    {
                        _processUsageLock.ExitWriteLock();
                    }
                }

                // Update latest pid and metadata; keep cumulative totals
                usage.ProcessId = processId;
                usage.ProcessName = processInfo.Name;
                usage.ProcessPath = processInfo.Path;
                usage.ProcessIconBase64 = processInfo.IconBase64;
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
                var icon = System.Drawing.Icon.ExtractAssociatedIcon(exePath);
                if (icon == null)
                {
                    return "";
                }

                using (icon)
                {
                    // Convert icon to bitmap, then to PNG base64
                    // Resize to 64x64 for better performance and smaller size
                    int size = 64;
                    using var bitmap = icon.ToBitmap();
                    using var resized = new Bitmap(size, size);
                    using (var g = Graphics.FromImage(resized))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.DrawImage(bitmap, 0, 0, size, size);
                    }

                    using var ms = new MemoryStream();
                    resized.Save(ms, ImageFormat.Png);
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
                    if (process.MainModule != null && !string.IsNullOrEmpty(process.MainModule.FileName))
                    {
                        path = process.MainModule.FileName;
                    }
                }
                catch
                {
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

        private async Task LogProcessUsagePeriodically(CancellationToken cancellationToken)
        {
            try
            {
                await AsyncTask.RunPeriodicAsync(
                    OtherUtils.ParseTimeSpan(_config.UpdateInterval),
                    token =>
                    {
                        try
                        {
                            LogProcessUsage();
                        }
                        catch (Exception ex)
                        {
                            _logger.Error("Error in periodic process usage logging", "error", ex.Message);
                        }

                        return Task.CompletedTask;
                    },
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                _logger.Info("Process usage logging stopped");
            }
        }

        private async Task ClearCachesPeriodically(CancellationToken cancellationToken)
        {
            try
            {
                // Clear caches every utc hour
                var now = DateTime.UtcNow;
                var nextHour = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc).AddHours(1);
                var initialDelay = nextHour - now;

                if (initialDelay > TimeSpan.Zero)
                {
                    await Task.Delay(initialDelay, cancellationToken);
                }

                while (!cancellationToken.IsCancellationRequested)
                {
                    try
                    {
                        ClearCaches();
                    }
                    catch (Exception ex)
                    {
                        _logger.Error("Error in periodic cache clearing", "error", ex.Message);
                    }

                    await Task.Delay(TimeSpan.FromHours(1), cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                _logger.Info("Periodic cache clearing stopped");
            }
        }

        private void ClearCaches()
        {
            _processUsageLock.EnterWriteLock();
            try
            {
                _processUsage.Clear();
            }
            finally
            {
                _processUsageLock.ExitWriteLock();
            }

            _processInfoCache.Clear();

            _logger.Debug("Cleared process usage and process info caches");
        }

        private void LogProcessUsage()
        {
            _processUsageLock.EnterReadLock();
            try
            {
                SaveUsageSnapshot();

                // Calculate total usage across all processes
                long totalRxBytes = 0;
                long totalTxBytes = 0;
                foreach (var process in _processUsage.Values)
                {
                    totalRxBytes += process.TotalRxBytes;
                    totalTxBytes += process.TotalTxBytes;
                }

                if (totalRxBytes > 0 || totalTxBytes > 0)
                {
                    _logger.Info("Total process network usage",
                        "total_mb", (double)(totalRxBytes + totalTxBytes) / (1024 * 1024),
                        "process_count", _processUsage.Count);
                }

                // Log top 20 processes
                var activeProcesses = _processUsage.Values
                    .Where(p => p.TotalRxBytes > 0 || p.TotalTxBytes > 0)
                    .OrderByDescending(p => p.TotalRxBytes + p.TotalTxBytes)
                    .Take(20)
                    .ToList();

                if (activeProcesses.Count > 0)
                {
                    _logger.Debug("Process network usage summary",
                        "active_processes", activeProcesses.Count);

                    foreach (var process in activeProcesses)
                    {
                        _logger.Debug("Process network usage",
                            "process_name", process.ProcessName,
                            "total_mb", (double)(process.TotalRxBytes + process.TotalTxBytes) / (1024 * 1024));
                    }
                }
            }
            finally
            {
                _processUsageLock.ExitReadLock();
            }
        }

        public Dictionary<string, ProcessNetworkUsage> GetProcessUsage()
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

        private string GetAppDataDirectory()
        {
            var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var dir = Path.Combine(baseDir, "PacketPilot");
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            return dir;
        }

        private string GetPersistFilePath()
        {
            return Path.Combine(GetAppDataDirectory(), "process_usage.json");
        }

        private static string GetCurrentUtcKey()
        {
            var now = DateTime.UtcNow;
            return $"{now:yyyy-MM-ddTHH}Z";
        }

        private void SaveUsageSnapshot()
        {
            try
            {
                // Take a consistent snapshot under read lock
                Dictionary<string, ProcessNetworkUsage> items;
                items = _processUsage.ToDictionary(kvp => kvp.Key, kvp => new ProcessNetworkUsage
                {
                    ProcessId = kvp.Value.ProcessId,
                    ProcessName = kvp.Value.ProcessName,
                    ProcessPath = kvp.Value.ProcessPath,
                    ProcessIconBase64 = kvp.Value.ProcessIconBase64,
                    TotalRxBytes = kvp.Value.TotalRxBytes,
                    TotalTxBytes = kvp.Value.TotalTxBytes,
                    LastSeen = kvp.Value.LastSeen
                });

                var snapshot = new PersistedUsage
                {
                    UtcKey = GetCurrentUtcKey(),
                    Items = items
                };

                var options = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(snapshot, options);
                File.WriteAllText(GetPersistFilePath(), json);

                _logger.Info("Saved persisted usage snapshot", "path", GetPersistFilePath());
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to save persisted usage snapshot", "error", ex.Message);
            }
        }

        private void LoadUsageSnapshot()
        {
            try
            {
                var path = GetPersistFilePath();
                if (!File.Exists(path))
                {
                    _logger.Info("No persisted usage snapshot found", "Cause:", "file not found");
                    return;
                }

                var json = File.ReadAllText(path);
                var data = JsonSerializer.Deserialize<PersistedUsage>(json);
                if (data == null || string.IsNullOrEmpty(data.UtcKey))
                {
                    _logger.Info("No persisted usage snapshot found", "Cause:", "data is null or utc key is empty");
                    return;
                }

                if (!string.Equals(data.UtcKey, GetCurrentUtcKey(), StringComparison.Ordinal))
                {
                    _logger.Info("Different utc window; ignore", "Cause:", "different utc key");
                    return;
                }

                if (data.Items == null || data.Items.Count == 0)
                {
                    _logger.Info("No items in persisted usage snapshot", "Cause:", "no items in data");
                    return;
                }

                _logger.Info("Loading persisted usage snapshot", "path", path);
                _processUsageLock.EnterWriteLock();
                try
                {
                    foreach (var kvp in data.Items)
                    {
                        var identifier = kvp.Key;
                        var item = kvp.Value;

                        _processUsage[identifier] = new ProcessNetworkUsage
                        {
                            ProcessId = item.ProcessId,
                            ProcessName = item.ProcessName,
                            ProcessPath = item.ProcessPath,
                            ProcessIconBase64 = item.ProcessIconBase64,
                            TotalRxBytes = item.TotalRxBytes,
                            TotalTxBytes = item.TotalTxBytes,
                            LastSeen = DateTime.Now
                        };
                    }
                }
                finally
                {
                    _processUsageLock.ExitWriteLock();
                }
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to load persisted usage snapshot", "error", ex.Message);
            }
        }

        private class PersistedUsage
        {
            public string UtcKey { get; set; } = "";
            public Dictionary<string, ProcessNetworkUsage> Items { get; set; } = new Dictionary<string, ProcessNetworkUsage>();
        }

        public void Dispose()
        {
            if (_disposed)
                return;

            Stop();
            _processUsageLock?.Dispose();
            _cancellationTokenSource?.Dispose();
            _disposed = true;
        }
    }
}

