using PacketMeter.Config;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace PacketMeter.UI.Services
{
    public sealed class ConfigService
    {
        private readonly SemaphoreSlim _fileSemaphore = new(1, 1);
        private readonly string _configPath;

        public ConfigService()
        {
            _configPath = ConfigLoader.EnsureConfigFile();
        }

        public Task<Config.Config> GetCurrentConfigAsync(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(ConfigLoader.LoadFromPath(_configPath));
        }

        public async Task SaveReporterSettingsAsync(string apiKey, string serverHost, int serverPort, string reportInterval, bool reportPerProcess, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(serverHost))
            {
                throw new ArgumentException("Server host cannot be empty.", nameof(serverHost));
            }

            if (string.IsNullOrWhiteSpace(reportInterval))
            {
                throw new ArgumentException("Report interval cannot be empty.", nameof(reportInterval));
            }

            cancellationToken.ThrowIfCancellationRequested();

            await _fileSemaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                var config = ConfigLoader.LoadFromPath(_configPath);

                if (!string.IsNullOrWhiteSpace(apiKey))
                {
                    config.Reporter.ApiKey = apiKey;
                }

                config.Reporter.ServerHost = serverHost;
                config.Reporter.ServerPort = serverPort;
                config.Reporter.ReportInterval = reportInterval;
                config.Reporter.ReportPerProcess = reportPerProcess;

                ConfigLoader.Save(config, _configPath);
            }
            finally
            {
                _fileSemaphore.Release();
            }
        }
    }
}

