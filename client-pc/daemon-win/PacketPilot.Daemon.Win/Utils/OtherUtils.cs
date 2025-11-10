namespace PacketPilot.Daemon.Win.Utils
{
    public static class OtherUtils
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
    }
}