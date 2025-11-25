using System;
using System.ServiceProcess;
using System.Threading;
using System.Threading.Tasks;

namespace PacketMeter.UI.Services
{
    public sealed class ServiceControlService
    {
        private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

        public Task RestartAsync(string serviceName, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(serviceName))
            {
                throw new ArgumentException("Service name cannot be empty.", nameof(serviceName));
            }

            return Task.Run(() =>
            {
                using var controller = new ServiceController(serviceName);

                controller.Refresh();

                if (controller.Status != ServiceControllerStatus.Stopped &&
                    controller.Status != ServiceControllerStatus.StopPending)
                {
                    controller.Stop();
                }

                controller.WaitForStatus(ServiceControllerStatus.Stopped, DefaultTimeout);

                cancellationToken.ThrowIfCancellationRequested();

                controller.Start();
                controller.WaitForStatus(ServiceControllerStatus.Running, DefaultTimeout);
            }, cancellationToken);
        }
    }
}

