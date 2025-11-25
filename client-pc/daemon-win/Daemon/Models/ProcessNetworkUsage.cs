using System;

namespace Daemon.Models
{
    public class ProcessNetworkUsage
    {
        public int ProcessId { get; set; }
        public string ProcessName { get; set; } = "";
        public string ProcessPath { get; set; } = "";
        public string ProcessIconBase64 { get; set; } = "";
        public long TotalRxBytes { get; set; }
        public long TotalTxBytes { get; set; }
        public DateTime LastSeen { get; set; }
    }
}

