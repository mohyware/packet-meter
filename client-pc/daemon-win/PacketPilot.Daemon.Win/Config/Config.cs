using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace PacketPilot.Daemon.Win.Config
{
    public class Config
    {
        public ServerConfig Server { get; set; } = new();
        public LoggingConfig Logging { get; set; } = new();
        public MonitorConfig Monitor { get; set; } = new();
        public ReporterConfig Reporter { get; set; } = new();
    }

    public class ServerConfig
    {
        public string Host { get; set; } = "localhost";
        public int Port { get; set; } = 8080;
        public bool UseTls { get; set; } = false;
        public string ApiKey { get; set; } = "";
        public string DeviceId { get; set; } = "";
    }

    public class LoggingConfig
    {
        public string Level { get; set; } = "info";
        public string File { get; set; } = "";
        public int MaxSize { get; set; } = 100;
        public int MaxAge { get; set; } = 30;
        public bool Compress { get; set; } = true;
    }

    public class MonitorConfig
    {
        public string Interface { get; set; } = "any";
        public string UpdateInterval { get; set; } = "5s";
        public int BufferSize { get; set; } = 1000;
        public string UsageFile { get; set; } = "";
    }

    public class ReporterConfig
    {
        public string ServerHost { get; set; } = "localhost";
        public int ServerPort { get; set; } = 8080;
        public bool UseTls { get; set; } = false;
        public string ApiKey { get; set; } = "";
        public string DeviceId { get; set; } = "";
        public string ReportInterval { get; set; } = "30s";
        public int BatchSize { get; set; } = 100;
        public int RetryAttempts { get; set; } = 3;
        public string RetryDelay { get; set; } = "5s";
    }

    public static class ConfigLoader
    {
        public static Config Load()
        {
            var config = new Config();

            // Try to load from YAML file first
            if (File.Exists("config.yaml"))
            {
                try
                {
                    var yamlContent = File.ReadAllText("config.yaml");
                    var deserializer = new DeserializerBuilder()
                        .WithNamingConvention(UnderscoredNamingConvention.Instance)
                        .Build();
                    config = deserializer.Deserialize<Config>(yamlContent);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Warning: Failed to load config.yaml: {ex.Message}");
                }
            }

            // Load environment variables
            // LoadEnvironmentVariables(config);

            // Set defaults
            SetDefaults(config);

            // Validate configuration
            Validate(config);

            return config;
        }

        private static void LoadEnvironmentVariables(Config config)
        {
            // Server config from environment
            if (Environment.GetEnvironmentVariable("PACKETPILOT_SERVER_HOST") is string serverHost)
                config.Server.Host = serverHost;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_SERVER_PORT") is string serverPort && int.TryParse(serverPort, out int port))
                config.Server.Port = port;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_SERVER_USE_TLS") is string useTls && bool.TryParse(useTls, out bool tls))
                config.Server.UseTls = tls;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_SERVER_API_KEY") is string apiKey)
                config.Server.ApiKey = apiKey;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_SERVER_DEVICE_ID") is string deviceId)
                config.Server.DeviceId = deviceId;

            // Logging config from environment
            if (Environment.GetEnvironmentVariable("PACKETPILOT_LOGGING_LEVEL") is string logLevel)
                config.Logging.Level = logLevel;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_LOGGING_FILE") is string logFile)
                config.Logging.File = logFile;

            // Monitor config from environment
            if (Environment.GetEnvironmentVariable("PACKETPILOT_MONITOR_INTERFACE") is string monitorInterface)
                config.Monitor.Interface = monitorInterface;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_MONITOR_UPDATE_INTERVAL") is string updateInterval)
                config.Monitor.UpdateInterval = updateInterval;
            if (Environment.GetEnvironmentVariable("PACKETPILOT_MONITOR_USAGE_FILE") is string usageFile)
                config.Monitor.UsageFile = usageFile;

            // Reporter config from environment
            if (Environment.GetEnvironmentVariable("PACKETPILOT_REPORTER_REPORT_INTERVAL") is string reportInterval)
                config.Reporter.ReportInterval = reportInterval;
        }

        private static void SetDefaults(Config config)
        {
            // Server defaults
            if (string.IsNullOrEmpty(config.Server.Host))
                config.Server.Host = "localhost";
            if (config.Server.Port <= 0)
                config.Server.Port = 8080;
            if (string.IsNullOrEmpty(config.Server.DeviceId))
                config.Server.DeviceId = GetDeviceId();

            // Logging defaults
            if (string.IsNullOrEmpty(config.Logging.Level))
                config.Logging.Level = "info";
            if (string.IsNullOrEmpty(config.Logging.File))
                config.Logging.File = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PacketPilot", "daemon.log");
            if (config.Logging.MaxSize <= 0)
                config.Logging.MaxSize = 100;
            if (config.Logging.MaxAge <= 0)
                config.Logging.MaxAge = 30;

            // Monitor defaults
            if (string.IsNullOrEmpty(config.Monitor.Interface))
                config.Monitor.Interface = "any";
            if (string.IsNullOrEmpty(config.Monitor.UpdateInterval))
                config.Monitor.UpdateInterval = "5s";
            if (config.Monitor.BufferSize <= 0)
                config.Monitor.BufferSize = 1000;
            if (string.IsNullOrEmpty(config.Monitor.UsageFile))
                config.Monitor.UsageFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PacketPilot", "daily_usage.json");

            // Reporter defaults
            if (string.IsNullOrEmpty(config.Reporter.ReportInterval))
                config.Reporter.ReportInterval = "30s";
            if (config.Reporter.BatchSize <= 0)
                config.Reporter.BatchSize = 100;
            if (config.Reporter.RetryAttempts <= 0)
                config.Reporter.RetryAttempts = 3;
            if (string.IsNullOrEmpty(config.Reporter.RetryDelay))
                config.Reporter.RetryDelay = "5s";
        }

        private static void Validate(Config config)
        {
            if (string.IsNullOrEmpty(config.Server.Host))
                throw new ArgumentException("Server host cannot be empty");
            if (config.Server.Port <= 0 || config.Server.Port > 65535)
                throw new ArgumentException("Server port must be between 1 and 65535");
            if (string.IsNullOrEmpty(config.Server.DeviceId))
                throw new ArgumentException("Device ID cannot be empty");
        }

        private static string GetDeviceId()
        {
            try
            {
                // Try to get machine ID from registry
                var machineId = Microsoft.Win32.Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography", "MachineGuid", null);
                if (machineId != null)
                    return machineId.ToString() ?? "unknown-device";
            }
            catch
            {
                // Fallback to computer name
            }

            try
            {
                return Environment.MachineName;
            }
            catch
            {
                return "unknown-device";
            }
        }
    }
}
