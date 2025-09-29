using Serilog;
using Serilog.Events;
using System;
using System.Collections.Generic;
using System.IO;

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
                var logFields = ConvertToLogFields(fields);
                _logger.Information(message, logFields);
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
                var logFields = ConvertToLogFields(fields);
                _logger.Error(message, logFields);
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
                var logFields = ConvertToLogFields(fields);
                _logger.Debug(message, logFields);
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
                var logFields = ConvertToLogFields(fields);
                _logger.Warning(message, logFields);
            }
            else
            {
                _logger.Warning(message);
            }
        }

        private object[] ConvertToLogFields(object[] fields)
        {
            if (fields.Length % 2 != 0)
                throw new ArgumentException("Fields must be in key-value pairs");

            var logFields = new List<object>();
            for (int i = 0; i < fields.Length; i += 2)
            {
                if (i + 1 < fields.Length)
                {
                    logFields.Add(fields[i]);
                    logFields.Add(fields[i + 1]);
                }
            }
            return logFields.ToArray();
        }
    }

    public static class LoggerFactory
    {
        public static Logger CreateLogger(Config.LoggingConfig config)
        {
            var logConfig = new LoggerConfiguration()
                .MinimumLevel.Is(ParseLogLevel(config.Level))
                .WriteTo.Console()
                .WriteTo.Logger(lc => lc
                    .WriteTo.File(
                        path: config.File,
                        rollingInterval: RollingInterval.Day,
                        retainedFileCountLimit: config.MaxAge,
                        fileSizeLimitBytes: config.MaxSize * 1024 * 1024,
                        rollOnFileSizeLimit: true,
                        buffered: false));

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
