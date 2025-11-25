using System;

namespace Daemon.Models
{
    public class AppUsage
    {
        public string Identifier { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string IconHash { get; set; } = "";
        public long TotalRx { get; set; }
        public long TotalTx { get; set; }
        public DateTime LastSeen { get; set; }
    }
}

