using PacketMeter.Config;
using Daemon.Logger;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Daemon.Daemon;
using System.Threading.Tasks;
using System;
using System.IO;

namespace Daemon
{
    internal class ServiceHost
    {
        private static readonly string Version = "0.1.0";

        public static async Task Main(string[] args)
        {
            try
            {
                var configPath = ConfigLoader.EnsureConfigFile();
                var config = ConfigLoader.LoadFromPath(configPath);

                if (!string.IsNullOrEmpty(config.Logging.File))
                {
                    var logDir = Path.GetDirectoryName(config.Logging.File);
                    if (!string.IsNullOrEmpty(logDir) && !Directory.Exists(logDir))
                    {
                        Directory.CreateDirectory(logDir);
                    }
                }

                var logger = LoggerFactory.CreateLogger(config.Logging);

                logger.Info("Starting PacketMeter daemon", "version", Version);

                using var host = Host.CreateDefaultBuilder(args)
                    .UseWindowsService(options => options.ServiceName = "PacketMeter Daemon")
                    .ConfigureServices(services =>
                    {
                        services.AddSingleton(config);
                        services.AddSingleton(logger);
                        services.AddSingleton(new ConfigPathProvider(configPath));
                        services.AddHostedService<Daemon.Daemon>();
                    })
                    .Build();

                await host.RunAsync();

                logger.Info("PacketMeter daemon stopped");
            }
            catch (Exception ex)
            {
                try
                {
                    System.Diagnostics.EventLog.WriteEntry("PacketMeter Daemon",
                        $"Failed to start: {ex.Message}\nStack trace: {ex.StackTrace}",
                        System.Diagnostics.EventLogEntryType.Error);
                }
                catch
                {
                    Console.WriteLine($"FATAL ERROR: Failed to start PacketMeter Daemon: {ex.Message}");
                    Console.WriteLine($"Stack trace: {ex.StackTrace}");
                }
                throw;
            }
        }
    }
}
