using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using PacketPilot.Daemon.Win.Logger;

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

            // Set defaults
            SetDefaults(config);

            // Validate configuration
            Validate(config);

            return config;
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
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Failed to get machine ID from registry: {ex.Message}");
            }

            try
            {
                return Environment.MachineName;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Failed to get machine name from environment: {ex.Message}");
                return "unknown-device";
            }
        }
    }
}
