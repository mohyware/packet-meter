using Serilog;
using Serilog.Events;
using System;
using System.Collections.Generic;

namespace PacketPilot.Daemon.Win.Logger
{
    public class Logger
    {
        private readonly ILogger _logger;

        public Logger(ILogger logger)
        {
            _logger = logger;
        }

        public void Info(string message, params object[] fields)
        {
            if (fields.Length > 0)
            {
                var (template, values) = BuildLogTemplate(message, fields);
                _logger.Information(template, values);
            }
            else
            {
                _logger.Information(message);
            }
        }

        public void Error(string message, params object[] fields)
        {
            if (fields.Length > 0)
            {
                var (template, values) = BuildLogTemplate(message, fields);
                _logger.Error(template, values);
            }
            else
            {
                _logger.Error(message);
            }
        }

        public void Debug(string message, params object[] fields)
        {
            if (fields.Length > 0)
            {
                var (template, values) = BuildLogTemplate(message, fields);
                _logger.Debug(template, values);
            }
            else
            {
                _logger.Debug(message);
            }
        }

        public void Warn(string message, params object[] fields)
        {
            if (fields.Length > 0)
            {
                var (template, values) = BuildLogTemplate(message, fields);
                _logger.Warning(template, values);
            }
            else
            {
                _logger.Warning(message);
            }
        }

        private (string template, object[] values) BuildLogTemplate(string message, object[] fields)
        {
            if (fields.Length % 2 != 0)
                throw new ArgumentException("Fields must be in key-value pairs");

            var templateParts = new List<string> { message };
            var values = new List<object>();

            for (int i = 0; i < fields.Length; i += 2)
            {
                if (i + 1 < fields.Length)
                {
                    var key = fields[i]?.ToString() ?? "";
                    var value = fields[i + 1];
                    templateParts.Add($"{key}={{{key}}}");
                    values.Add(value);
                }
            }

            return (string.Join(" ", templateParts), values.ToArray());
        }
    }

    public static class LoggerFactory
    {
        public static Logger CreateLogger(Config.LoggingConfig config)
        {
            var logConfig = new LoggerConfiguration()
                .MinimumLevel.Is(ParseLogLevel(config.Level))
                .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
                .WriteTo.Logger(lc => lc
                    .WriteTo.File(
                        path: config.File,
                        rollingInterval: RollingInterval.Day,
                        retainedFileCountLimit: config.MaxAge,
                        fileSizeLimitBytes: config.MaxSize * 1024 * 1024,
                        rollOnFileSizeLimit: true,
                        buffered: false,
                        outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} {Level:u3}] {Message:lj}{NewLine}{Exception}"));

            var logger = logConfig.CreateLogger();
            return new Logger(logger);
        }

        private static LogEventLevel ParseLogLevel(string level)
        {
            return level.ToLower() switch
            {
                "debug" => LogEventLevel.Debug,
                "info" => LogEventLevel.Information,
                "warn" => LogEventLevel.Warning,
                "error" => LogEventLevel.Error,
                _ => LogEventLevel.Information
            };
        }
    }
}
