using Microsoft.Extensions.Hosting;
using PacketPilot.Config;
using PacketPilot.Daemon.Win.Logger;
using PacketPilot.Daemon.Win.Models;
using PacketPilot.Daemon.Win.Monitor;
using PacketPilot.Daemon.Win.Reporter;
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win.Daemon
{
    public class Daemon : IHostedService, IDisposable
    {
        private Config.Config _config;
        private readonly Logger.Logger _logger;
        private readonly string _configPath;
        private ProcessNetworkMonitor? _processMonitor;
        private TrafficMonitor? _trafficMonitor;
        private PacketPilot.Daemon.Win.Reporter.Reporter? _reporter;
        private CancellationToken _hostCancellationToken;
        private CancellationTokenSource? _componentCancellation;
        private Task? _componentTask;
        private FileSystemWatcher? _configWatcher;
        private readonly SemaphoreSlim _reloadSemaphore = new(1, 1);
        private int _reloadScheduled;
        private bool _disposed;

        public Daemon(Config.Config config, Logger.Logger logger, ConfigPathProvider configPathProvider)
        {
            _config = config;
            _logger = logger;
            _configPath = configPathProvider.ConfigPath;
            InitializeComponents();
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            _hostCancellationToken = cancellationToken;
            _logger.Info("Starting PacketPilot daemon components");
            StartConfigWatcher();
            return StartComponentsAsync();
        }

        public async Task StopAsync(CancellationToken cancellationToken)
        {
            _ = cancellationToken;
            await StopInternalAsync().ConfigureAwait(false);
        }

        public void Stop()
        {
            StopInternalAsync().GetAwaiter().GetResult();
        }

        private async Task StopInternalAsync()
        {
            StopConfigWatcher();
            await StopComponentsAsync().ConfigureAwait(false);
        }

        private void InitializeComponents()
        {
            DisposeComponents();

            _processMonitor = new ProcessNetworkMonitor(_logger, _config.Monitor);
            _trafficMonitor = new TrafficMonitor(_config.Monitor, _logger);

            var reporterConfig = new ReporterConfig
            {
                ServerHost = _config.Reporter.ServerHost,
                ServerPort = _config.Reporter.ServerPort,
                UseTls = _config.Reporter.UseTls,
                ApiKey = _config.Reporter.ApiKey,
                DeviceId = _config.Reporter.DeviceId,
                ReportInterval = _config.Reporter.ReportInterval,
                RetryAttempts = _config.Reporter.RetryAttempts,
                RetryDelay = _config.Reporter.RetryDelay,
                ReportPerProcess = _config.Reporter.ReportPerProcess
            };

            var reporterMode = _config.Reporter.ReportPerProcess ? ReporterMode.PerProcess : ReporterMode.TotalUsage;
            _reporter = new PacketPilot.Daemon.Win.Reporter.Reporter(reporterConfig, _logger, _processMonitor, _trafficMonitor, reporterMode);
        }

        private Task StartComponentsAsync()
        {
            if (_processMonitor == null || _trafficMonitor == null || _reporter == null)
            {
                throw new InvalidOperationException("Daemon components have not been initialized");
            }

            _componentCancellation = CancellationTokenSource.CreateLinkedTokenSource(_hostCancellationToken);
            var token = _componentCancellation.Token;

            var processMonitorTask = _processMonitor.StartAsync(token);
            var trafficMonitorTask = _trafficMonitor.StartAsync(token);
            var reporterTask = _reporter.StartAsync(token);

            _componentTask = Task.WhenAll(processMonitorTask, trafficMonitorTask, reporterTask);
            _ = _componentTask.ContinueWith(t =>
            {
                if (t.Exception != null)
                {
                    _logger.Error("Daemon components encountered an error", "error", t.Exception.Flatten().Message);
                }
            }, TaskContinuationOptions.OnlyOnFaulted);

            return Task.CompletedTask;
        }

        private async Task StopComponentsAsync()
        {
            if (_componentCancellation == null)
            {
                return;
            }

            _logger.Info("Stopping PacketPilot daemon components");

            try
            {
                _componentCancellation.Cancel();
            }
            catch
            {
                // Ignore cancellation errors
            }

            try
            {
                _processMonitor?.Stop();
            }
            catch (Exception ex)
            {
                _logger.Warn("Failed to stop process monitor", "error", ex.Message);
            }

            try
            {
                _trafficMonitor?.Stop();
            }
            catch (Exception ex)
            {
                _logger.Warn("Failed to stop traffic monitor", "error", ex.Message);
            }

            try
            {
                _reporter?.Stop();
            }
            catch (Exception ex)
            {
                _logger.Warn("Failed to stop reporter", "error", ex.Message);
            }

            if (_componentTask != null)
            {
                try
                {
                    await _componentTask.ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    _logger.Info("Components stopped");
                }
                catch (Exception ex)
                {
                    _logger.Warn("Error while waiting for components to stop", "error", ex.Message);
                }
            }

            _componentCancellation.Dispose();
            _componentCancellation = null;
            _componentTask = null;
        }

        private void StartConfigWatcher()
        {
            var directory = Path.GetDirectoryName(_configPath);
            var fileName = Path.GetFileName(_configPath);

            if (string.IsNullOrEmpty(directory) || string.IsNullOrEmpty(fileName))
            {
                _logger.Warn("Invalid configuration path, skipping watcher setup", "path", _configPath);
                return;
            }

            _configWatcher = new FileSystemWatcher(directory, fileName)
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.FileName | NotifyFilters.CreationTime,
                EnableRaisingEvents = true
            };

            _configWatcher.Changed += HandleConfigChanged;
            _configWatcher.Created += HandleConfigChanged;
            _configWatcher.Deleted += HandleConfigChanged;
            _configWatcher.Renamed += HandleConfigChanged;
        }

        private void StopConfigWatcher()
        {
            if (_configWatcher == null)
            {
                return;
            }

            _configWatcher.EnableRaisingEvents = false;
            _configWatcher.Changed -= HandleConfigChanged;
            _configWatcher.Created -= HandleConfigChanged;
            _configWatcher.Deleted -= HandleConfigChanged;
            _configWatcher.Renamed -= HandleConfigChanged;
            _configWatcher.Dispose();
            _configWatcher = null;
        }

        private void HandleConfigChanged(object sender, FileSystemEventArgs e)
        {
            if (!string.Equals(e.FullPath, _configPath, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (Interlocked.Exchange(ref _reloadScheduled, 1) == 1)
            {
                return;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(500).ConfigureAwait(false);
                    await ReloadConfigurationAsync().ConfigureAwait(false);
                }
                finally
                {
                    Interlocked.Exchange(ref _reloadScheduled, 0);
                }
            });
        }

        private async Task ReloadConfigurationAsync()
        {
            await _reloadSemaphore.WaitAsync().ConfigureAwait(false);
            try
            {
                if (_hostCancellationToken.IsCancellationRequested)
                {
                    return;
                }

                _logger.Info("Detected configuration change, reloading", "path", _configPath);
                var ensuredPath = ConfigLoader.EnsureConfigFile(_configPath);
                var latestConfig = ConfigLoader.LoadFromPath(ensuredPath);

                await StopComponentsAsync().ConfigureAwait(false);

                _config = latestConfig;
                InitializeComponents();

                if (!_hostCancellationToken.IsCancellationRequested)
                {
                    await StartComponentsAsync().ConfigureAwait(false);
                    _logger.Info("Configuration reload completed");
                }
            }
            catch (Exception ex)
            {
                _logger.Error("Failed to reload configuration", "error", ex.Message);
            }
            finally
            {
                _reloadSemaphore.Release();
            }
        }

        private void DisposeComponents()
        {
            _processMonitor?.Dispose();
            _trafficMonitor?.Dispose();
            _reporter?.Dispose();

            _processMonitor = null;
            _trafficMonitor = null;
            _reporter = null;
        }

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            Stop();
            _reloadSemaphore.Dispose();
            DisposeComponents();
            _disposed = true;
        }
    }
}
