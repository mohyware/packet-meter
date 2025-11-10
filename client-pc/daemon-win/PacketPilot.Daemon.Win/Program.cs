using PacketPilot.Daemon.Win.Config;
using PacketPilot.Daemon.Win.Daemon;
using PacketPilot.Daemon.Win.Logger;
using System;
using System.CommandLine;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Linq;
using System.Reflection;

namespace PacketPilot.Daemon.Win
{
    internal class Program
    {
        private static readonly string Version = "0.1.0";
        private static readonly string Build = "dev";

        public static async Task<int> Main(string[] args)
        {
            // TODO: hard code cmd args for now
            // bool daemon = true;
            // string logLevel = "debug";
            // string configPath = "";
            // await RunDaemon(configPath, daemon, logLevel);
            // return 0;

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

            var logger = LoggerFactory.CreateLogger(config.Logging);

            var builder = Host.CreateDefaultBuilder()
                .ConfigureServices(services =>
                {
                    services.AddSingleton(config);
                    services.AddSingleton(logger);
                    services.AddSingleton<Daemon.Daemon>();
                    services.AddHostedService<Daemon.HostedDaemon>();
                })
                .UseWindowsService(); // enables service mode when started by SCM

            if (Environment.UserInteractive)
            {
                // Console mode
                logger.Info("Starting PacketPilot daemon (console mode)", "version", Version, "build", Build);

                var daemonService = new Daemon.Daemon(config, logger);
                using var cts = new CancellationTokenSource();

                Console.CancelKeyPress += (sender, e) =>
                {
                    e.Cancel = true;
                    logger.Info("Received signal, shutting down gracefully");
                    cts.Cancel();
                };

                await daemonService.StartAsync(cts.Token);
                daemonService.Dispose();
                logger.Info("PacketPilot daemon stopped");
            }
            else
            {
                // Service mode
                await builder.Build().RunAsync();
            }

            // logger.Info("Starting PacketPilot daemon", "version", Version, "build", Build);

            // // Console mode: run until Ctrl+C
            // var daemonService = new Daemon.Daemon(config, logger);
            // using var cts = new CancellationTokenSource();

            // Console.CancelKeyPress += (sender, e) =>
            // {
            //     e.Cancel = true;
            //     logger.Info("Received signal, shutting down gracefully");
            //     cts.Cancel();
            // };

            // await daemonService.StartAsync(cts.Token);
            // daemonService.Dispose();
            // logger.Info("PacketPilot daemon stopped");
        }

        private static IHostBuilder TryEnableWindowsService(IHostBuilder builder)
        {
            try
            {
                var assembly = AppDomain.CurrentDomain.GetAssemblies()
                    .FirstOrDefault(a => a.GetName().Name == "Microsoft.Extensions.Hosting.WindowsServices")
                    ?? Assembly.Load("Microsoft.Extensions.Hosting.WindowsServices");
                var type = assembly?.GetType("Microsoft.Extensions.Hosting.WindowsServices.WindowsServiceLifetimeHostBuilderExtensions");
                var method = type?.GetMethods(BindingFlags.Public | BindingFlags.Static)
                    .FirstOrDefault(m => m.Name == "UseWindowsService");
                if (method != null)
                {
                    var result = method.Invoke(null, new object?[] { builder, null });
                    if (result is IHostBuilder hb)
                    {
                        return hb;
                    }
                }
            }
            catch
            {
                // ignore and fall back to console hosting
            }
            return builder;
        }
    }
}
