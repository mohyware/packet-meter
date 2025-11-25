using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Logger;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using PacketPilot.Daemon.Win.Daemon;
using System.Threading.Tasks;
using System;
using System.IO;

namespace PacketPilot.Daemon.Win
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

                // Ensure log directory exists before creating logger
                if (!string.IsNullOrEmpty(config.Logging.File))
                {
                    var logDir = Path.GetDirectoryName(config.Logging.File);
                    if (!string.IsNullOrEmpty(logDir) && !Directory.Exists(logDir))
                    {
                        Directory.CreateDirectory(logDir);
                    }
                }

                var logger = LoggerFactory.CreateLogger(config.Logging);

                logger.Info("Starting PacketPilot daemon", "version", Version);

                using var host = Host.CreateDefaultBuilder(args)
                    .UseWindowsService(options => options.ServiceName = "PacketPilot Daemon")
                    .ConfigureServices(services =>
                    {
                        services.AddSingleton(config);
                        services.AddSingleton(logger);
                        services.AddSingleton(new ConfigPathProvider(configPath));
                        services.AddHostedService<Daemon.Daemon>();
                    })
                    .Build();

                await host.RunAsync();

                logger.Info("PacketPilot daemon stopped");
            }
            catch (Exception ex)
            {
                // Write to Event Log as fallback if logger creation fails
                try
                {
                    System.Diagnostics.EventLog.WriteEntry("PacketPilot Daemon",
                        $"Failed to start: {ex.Message}\nStack trace: {ex.StackTrace}",
                        System.Diagnostics.EventLogEntryType.Error);
                }
                catch
                {
                    // If Event Log also fails, write to console (visible in service logs)
                    Console.WriteLine($"FATAL ERROR: Failed to start PacketPilot Daemon: {ex.Message}");
                    Console.WriteLine($"Stack trace: {ex.StackTrace}");
                }
                throw;
            }
        }
    }
}
