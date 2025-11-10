using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace PacketPilot.Daemon.Win.Daemon
{
    public class HostedDaemon : IHostedService
    {
        private readonly Daemon _daemon;

        public HostedDaemon(Daemon daemon)
        {
            _daemon = daemon;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            return _daemon.StartAsync(cancellationToken);
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _daemon.Stop();
            return Task.CompletedTask;
        }
    }
}



