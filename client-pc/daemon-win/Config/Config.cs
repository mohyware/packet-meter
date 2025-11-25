using System;
using System.IO;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace PacketMeter.Config
{
    public class Config
    {
        public LoggingConfig Logging { get; set; } = new();
        public MonitorConfig Monitor { get; set; } = new();
        public ReporterConfig Reporter { get; set; } = new();
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
    }

    public class ReporterConfig
    {
        public string ServerHost { get; set; } = "localhost";
        public int ServerPort { get; set; } = 8080;
        public bool UseTls { get; set; } = false;
        public string ApiKey { get; set; } = "your-device-token";
        public string DeviceId { get; set; } = "";
        public bool ReportPerProcess { get; set; } = false;
        public string ReportInterval { get; set; } = "30s";
        public int RetryAttempts { get; set; } = 3;
        public string RetryDelay { get; set; } = "5s";
    }

    public static class ConfigLoader
    {
        public static string GetDefaultConfigPath()
        {
            var baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PacketMeter");
            return Path.Combine(baseDir, "config.yaml");
        }

        public static string EnsureConfigFile(string? path = null)
        {
            var configPath = string.IsNullOrWhiteSpace(path) ? GetDefaultConfigPath() : path;
            var directory = Path.GetDirectoryName(configPath);

            if (string.IsNullOrEmpty(directory))
            {
                throw new InvalidOperationException("Invalid configuration path");
            }

            try
            {
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                    if (OperatingSystem.IsWindows())
                    {
                        SetFilePermissions(directory);
                    }
                }

                if (!File.Exists(configPath))
                {
                    var defaultConfig = new Config();
                    SetDefaults(defaultConfig);
                    Save(defaultConfig, configPath);

                    if (OperatingSystem.IsWindows())
                    {
                        SetFilePermissions(configPath);
                    }
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to create config file at {configPath}: {ex.Message}", ex);
            }

            return configPath;
        }

        public static Config Load(string? path = null)
        {
            var configPath = EnsureConfigFile(path);
            return LoadFromPath(configPath);
        }

        public static Config LoadFromPath(string configPath)
        {
            var config = new Config();

            if (File.Exists(configPath))
            {
                try
                {
                    var yamlContent = ReadFileWithRetry(configPath);
                    var deserializer = new DeserializerBuilder()
                        .WithNamingConvention(UnderscoredNamingConvention.Instance)
                        .Build();
                    config = deserializer.Deserialize<Config>(yamlContent);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Warning: Failed to load {configPath}: {ex.Message}");
                }
            }

            SetDefaults(config);
            Validate(config);
            return config;
        }

        public static void Save(Config config, string path)
        {
            if (config == null) throw new ArgumentNullException(nameof(config));
            if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException("Path cannot be empty", nameof(path));

            var directory = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var serializer = new SerializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .Build();

            var yaml = serializer.Serialize(config);
            File.WriteAllText(path, yaml);
        }

        private static void SetDefaults(Config config)
        {
            if (string.IsNullOrEmpty(config.Logging.Level))
                config.Logging.Level = "info";

            if (string.IsNullOrEmpty(config.Logging.File))
            {
                var logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PacketMeter", "Logs");
                config.Logging.File = Path.Combine(logDir, "daemon.log");
            }

            if (config.Logging.MaxSize <= 0)
                config.Logging.MaxSize = 100;
            if (config.Logging.MaxAge <= 0)
                config.Logging.MaxAge = 30;

            if (string.IsNullOrEmpty(config.Monitor.Interface))
                config.Monitor.Interface = "any";
            if (string.IsNullOrEmpty(config.Monitor.UpdateInterval))
                config.Monitor.UpdateInterval = "5s";
            if (config.Monitor.BufferSize <= 0)
                config.Monitor.BufferSize = 1000;

            if (string.IsNullOrEmpty(config.Reporter.ReportInterval))
                config.Reporter.ReportInterval = "30s";
            if (config.Reporter.RetryAttempts <= 0)
                config.Reporter.RetryAttempts = 3;
            if (string.IsNullOrEmpty(config.Reporter.RetryDelay))
                config.Reporter.RetryDelay = "5s";
            if (string.IsNullOrEmpty(config.Reporter.ServerHost))
                config.Reporter.ServerHost = "localhost";
            if (config.Reporter.ServerPort <= 0)
                config.Reporter.ServerPort = 8080;
            if (string.IsNullOrEmpty(config.Reporter.DeviceId))
                config.Reporter.DeviceId = GetDeviceId();
        }

        private static void Validate(Config config)
        {
            if (string.IsNullOrEmpty(config.Reporter.ServerHost))
                throw new ArgumentException("Server host cannot be empty");
            if (config.Reporter.ServerPort <= 0 || config.Reporter.ServerPort > 65535)
                throw new ArgumentException("Server port must be between 1 and 65535");
            if (string.IsNullOrEmpty(config.Reporter.DeviceId))
                throw new ArgumentException("Device ID cannot be empty");
        }

        [SupportedOSPlatform("windows")]
        private static string GetDeviceId()
        {
            try
            {
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

        private static string ReadFileWithRetry(string path, int attempts = 3, int delayMilliseconds = 200)
        {
            for (int i = 0; i < attempts; i++)
            {
                try
                {
                    return File.ReadAllText(path);
                }
                catch (IOException) when (i < attempts - 1)
                {
                    Thread.Sleep(delayMilliseconds);
                }
            }

            return File.ReadAllText(path);
        }

        [SupportedOSPlatform("windows")]
        private static void SetFilePermissions(string path)
        {
            try
            {
                var isDirectory = Directory.Exists(path);
                FileSystemSecurity security;

                if (isDirectory)
                {
                    var dirInfo = new DirectoryInfo(path);
                    security = dirInfo.GetAccessControl();
                }
                else
                {
                    var fileInfo = new FileInfo(path);
                    security = fileInfo.GetAccessControl();
                }

                var usersSid = new SecurityIdentifier(WellKnownSidType.WorldSid, null);

                InheritanceFlags inheritanceFlags;
                if (isDirectory)
                {
                    inheritanceFlags = InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;
                }
                else
                {
                    inheritanceFlags = InheritanceFlags.None;
                }

                var accessRule = new FileSystemAccessRule(
                    usersSid,
                    FileSystemRights.Modify,
                    inheritanceFlags,
                    PropagationFlags.None,
                    AccessControlType.Allow);

                security.AddAccessRule(accessRule);

                if (isDirectory)
                {
                    var dirInfo = new DirectoryInfo(path);
                    dirInfo.SetAccessControl((DirectorySecurity)security);
                }
                else
                {
                    var fileInfo = new FileInfo(path);
                    fileInfo.SetAccessControl((FileSecurity)security);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Failed to set permissions for {path}: {ex.Message}");
            }
        }
    }

    public class ConfigPathProvider
    {
        public ConfigPathProvider(string configPath)
        {
            ConfigPath = configPath;
        }

        public string ConfigPath { get; }
    }
}

