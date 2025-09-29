using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Daemon;
using PacketPilot.Daemon.Win.Logger;
using System;
using System.CommandLine;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win
{
    internal class Program
    {
        private static readonly string Version = "0.1.0";
        private static readonly string Build = "dev";

        public static async Task<int> Main(string[] args)
        {
            // TODO: hard code cmd args for now
            bool daemon = true;
            string logLevel = "debug";
            string configPath = "";
            await RunDaemon(configPath, daemon, logLevel);
            return 0;

            var rootCommand = new RootCommand("PacketPilot traffic monitoring daemon")
            {
                Name = "packetpilot-daemon",
                Description = "A daemon service that monitors network traffic per application on Windows systems"
            };

            var configOption = new Option<string?>(
                aliases: new[] { "--config", "-c" },
                description: "Path to config file")
            {
                ArgumentHelpName = "path"
            };

            var daemonOption = new Option<bool>(
                aliases: new[] { "--daemon", "-d" },
                description: "Run as daemon")

            {
                Arity = ArgumentArity.ZeroOrOne
            };

            var logLevelOption = new Option<string>(
                aliases: new[] { "--log-level", "-l" },
                description: "Log level (debug, info, warn, error)")
            {
                ArgumentHelpName = "level"
            };

            var versionCommand = new Command("version", "Print version information");

            rootCommand.AddOption(configOption);
            rootCommand.AddOption(daemonOption);
            rootCommand.AddOption(logLevelOption);
            rootCommand.AddCommand(versionCommand);

            rootCommand.SetHandler(async (string? configPath, bool daemon, string logLevel) =>
            {
                try
                {
                    daemon = true;
                    logLevel = "debug";
                    Console.WriteLine("--------->Starting daemon");
                    await RunDaemon(configPath, daemon, logLevel);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error: {ex.Message}");
                    Environment.Exit(1);
                }
            }, configOption, daemonOption, logLevelOption);

            versionCommand.SetHandler(() =>
            {
                Console.WriteLine($"PacketPilot Daemon v{Version} (build: {Build})");
            });

            return await rootCommand.InvokeAsync(args);
        }

        private static async Task RunDaemon(string? configPath, bool daemon, string logLevel)
        {

            // Load configuration
            var config = ConfigLoader.Load();

            // Override config with command line options
            if (!string.IsNullOrEmpty(configPath))
            {
                // TODO: Load from specific config path
            }

            if (!string.IsNullOrEmpty(logLevel))
            {
                config.Logging.Level = logLevel;
            }

            // Initialize logger
            var logger = LoggerFactory.CreateLogger(config.Logging);

            logger.Info("Starting PacketPilot daemon", "version", Version, "build", Build);

            // Create daemon instance
            var daemonService = new Daemon.Daemon(config, logger);

            // Setup graceful shutdown
            using var cts = new CancellationTokenSource();

            // Handle Ctrl+C
            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                logger.Info("Received signal, shutting down gracefully");
                cts.Cancel();
            };

            try
            {
                // Start daemon

                await daemonService.StartAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                logger.Info("Daemon shutdown completed");
            }
            catch (Exception ex)
            {
                logger.Error("Daemon failed", "error", ex.Message);
                throw;
            }
            finally
            {
                daemonService.Dispose();
            }

            logger.Info("PacketPilot daemon stopped");
        }
    }
}
