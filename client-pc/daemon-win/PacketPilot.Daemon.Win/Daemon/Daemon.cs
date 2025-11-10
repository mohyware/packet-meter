using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Logger;
using PacketPilot.Daemon.Win.Monitor;
using PacketPilot.Daemon.Win.Reporter;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win.Daemon
{
    public class Daemon
    {
        private readonly Config.Config _config;
        private readonly Logger.Logger _logger;
        private readonly ProcessNetworkMonitor _processMonitor;
        private readonly PacketPilot.Daemon.Win.Reporter.Reporter _reporter;
        private CancellationTokenSource? _cancellationTokenSource;

        public Daemon(Config.Config config, Logger.Logger logger)
        {
            _config = config;
            _logger = logger;

            // Create monitor
            _processMonitor = new ProcessNetworkMonitor(_logger, _config.Monitor);

            // Create reporter
            var reporterConfig = new ReporterConfig
            {
                ServerHost = _config.Server.Host,
                ServerPort = _config.Server.Port,
                UseTls = _config.Server.UseTls,
                ApiKey = _config.Server.ApiKey,
                DeviceId = _config.Server.DeviceId,
                ReportInterval = _config.Reporter.ReportInterval,
                BatchSize = _config.Reporter.BatchSize,
                RetryAttempts = _config.Reporter.RetryAttempts,
                RetryDelay = _config.Reporter.RetryDelay
            };

            _reporter = new PacketPilot.Daemon.Win.Reporter.Reporter(reporterConfig, _logger, _processMonitor);
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            _logger.Info("Starting PacketPilot daemon components");

            try
            {
                // Start traffic monitor
                var monitorTask = _processMonitor.StartAsync(_cancellationTokenSource.Token);

                // Start reporter
                var reporterTask = _reporter.StartAsync(_cancellationTokenSource.Token);

                // Wait for both tasks
                await Task.WhenAll(monitorTask, reporterTask);
            }
            catch (OperationCanceledException)
            {
                _logger.Info("Daemon shutdown requested");
            }
            catch (Exception ex)
            {
                _logger.Error("Daemon failed", "error", ex.Message);
                throw;
            }
            finally
            {
                _logger.Info("Shutting down daemon components");
                Stop();
            }
        }

        public void Stop()
        {
            _cancellationTokenSource?.Cancel();
            _processMonitor?.Stop();
            _reporter?.Stop();
        }

        // public void ResetStats()
        // {
        //     _processMonitor?.ResetStats();
        // }

        public void Dispose()
        {
            _cancellationTokenSource?.Dispose();
            _processMonitor?.Dispose();
            _reporter?.Dispose();
        }
    }
}
