import { Request } from 'express';

export function bytesToMB(bytes: number | string): number {
  if (typeof bytes === 'string') {
    bytes = parseFloat(bytes);
  }
  return bytes / (1024 * 1024);
}

/**
 * Format MB to readable string
 */
export function formatMB(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

export type DeviceType = 'windows' | 'android' | 'linux' | 'unknown';

/**
 * Extract device type from User-Agent header
 */
export function extractDeviceTypeFromUserAgent(
  userAgent: string | undefined
): DeviceType {
  if (!userAgent) {
    return 'unknown';
  }

  const match = /PacketMeter-(\w+)-Daemon/.exec(userAgent);
  if (!match) {
    return 'unknown';
  }

  const type = match[1].toLowerCase();
  // Normalize "win" to "windows"
  if (type === 'win') {
    return 'windows';
  }

  if (type === 'windows' || type === 'android' || type === 'linux') {
    return type;
  }

  return 'unknown';
}

export const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};
