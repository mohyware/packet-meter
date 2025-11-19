namespace PacketPilot.Daemon.Win.Utils
{
    public static class UtilsHelper
    {
        public static TimeSpan ParseTimeSpan(string value)
        {
            if (value.EndsWith("s"))
            {
                var seconds = int.Parse(value[..^1]);
                return TimeSpan.FromSeconds(seconds);
            }
            else if (value.EndsWith("m"))
            {
                var minutes = int.Parse(value[..^1]);
                return TimeSpan.FromMinutes(minutes);
            }
            else if (value.EndsWith("h"))
            {
                var hours = int.Parse(value[..^1]);
                return TimeSpan.FromHours(hours);
            }
            else
            {
                return TimeSpan.Parse(value);
            }
        }
        /// <summary>
        /// Gets the current UTC key (hour) in the format of yyyy-MM-ddTHH.
        /// </summary>
        public static string GetCurrentUtcKey()
        {
            var now = DateTime.UtcNow;
            return $"{now:yyyy-MM-ddTHH}";
        }
        public static string GetAppDataDirectory()
        {
            var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var dir = Path.Combine(baseDir, "PacketPilot");
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            return dir;
        }
    }
}