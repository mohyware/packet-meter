using System;
using System.Threading;
using System.Threading.Tasks;

namespace PacketPilot.Daemon.Win.Utils
{
    public static class AsyncTask
    {
        public static Task RunPeriodicAsync(TimeSpan interval, Func<CancellationToken, Task> callback, CancellationToken cancellationToken, bool runImmediately = false)
        {
            if (callback == null)
                throw new ArgumentNullException(nameof(callback));

            if (interval <= TimeSpan.Zero)
                throw new ArgumentOutOfRangeException(nameof(interval), "Interval must be greater than zero.");

            return Task.Run(async () =>
            {
                if (runImmediately)
                {
                    await callback(cancellationToken).ConfigureAwait(false);
                }

                using var timer = new PeriodicTimer(interval);

                while (await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false))
                {
                    await callback(cancellationToken).ConfigureAwait(false);
                }
            }, cancellationToken);
        }

        public static Task RunPeriodicAsync(TimeSpan interval, Action callback, CancellationToken cancellationToken, bool runImmediately = false)
        {
            if (callback == null)
                throw new ArgumentNullException(nameof(callback));

            return RunPeriodicAsync(interval, token =>
            {
                callback();
                return Task.CompletedTask;
            }, cancellationToken, runImmediately);
        }
    }
}