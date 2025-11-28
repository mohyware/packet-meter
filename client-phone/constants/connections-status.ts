import type { DeviceStatus } from '@/types/reports';

export const CONNECTION_STATUS_META: Record<
  DeviceStatus,
  { label: string; description: string; accent: string }
> = {
  not_connected: {
    label: 'Not connected',
    description: 'Scan a device token to start reporting to the server.',
    accent: '#F87171',
  },
  pending: {
    label: 'Pending approval',
    description:
      'Connected to the server. Waiting for approval after the health check.',
    accent: '#FBBF24',
  },
  authed: {
    label: 'Connected',
    description: 'Reports are reaching the server successfully.',
    accent: '#34D399',
  },
};
