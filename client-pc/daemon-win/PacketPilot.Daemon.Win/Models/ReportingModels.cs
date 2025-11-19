using System.Collections.Generic;

namespace PacketPilot.Daemon.Win.Models
{
    public class AppRegistration
    {
        public string Identifier { get; set; } = "";
        public string? DisplayName { get; set; }
        public string? IconHash { get; set; }
    }

    public class AppUsageData
    {
        public string Identifier { get; set; } = "";
        public long TotalRx { get; set; }
        public long TotalTx { get; set; }
    }

    public class AppUsageReport
    {
        public string Identifier { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string IconHash { get; set; } = "";
        public long TotalRx { get; set; }
        public long TotalTx { get; set; }
        public double TotalRxMB { get; set; }
        public double TotalTxMB { get; set; }
    }

    public class RegisterAppsRequest
    {
        public List<AppRegistration> Apps { get; set; } = new();
    }

    public class UsageReportRequest
    {
        public string Timestamp { get; set; } = "";
        public string Date { get; set; } = "";
        public List<AppUsageData> Apps { get; set; } = new();
    }

    public class TotalUsageReportRequest
    {
        public string Timestamp { get; set; } = "";
        public string Date { get; set; } = "";
        public long TotalRx { get; set; }
        public long TotalTx { get; set; }
    }

    public enum ReporterMode
    {
        TotalUsage,
        PerProcess
    }

    public class ServerResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
    }

}

