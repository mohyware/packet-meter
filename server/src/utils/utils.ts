export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
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

  const match = /PacketPilot-(\w+)-Daemon/.exec(userAgent);
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
