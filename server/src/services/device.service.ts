import { eq, desc, and, InferSelectModel } from 'drizzle-orm';
import { db, devices, reports, interfaces, Device } from '../db';
import { generateDeviceToken, hashDeviceToken, verifyDeviceToken } from '../utils/auth';

export interface CreateDeviceInput {
  userId: string;
  name: string;
}

export interface DeviceWithUsage extends InferSelectModel<typeof devices> {
  totalReports?: number;
  lastReportDate?: Date | null;
  activatedAt?: Date | null;
}

/**
 * Create a new device for a user
 */
export async function createDevice(input: CreateDeviceInput) {
  const deviceToken = generateDeviceToken();
  const deviceTokenHash = await hashDeviceToken(deviceToken);

  const [device] = await db.insert(devices).values({
    userId: input.userId,
    name: input.name,
    deviceToken,
    deviceTokenHash,
    isActivated: false,
  }).returning();

  return {
    ...device,
    // Only return the plain token on creation
    deviceToken,
  };
}

/**
 * Get all devices for a user
 */
export async function getUserDevices(userId: string) {
  return db.query.devices.findMany({
    where: eq(devices.userId, userId),
    orderBy: desc(devices.createdAt),
  });
}

/**
 * Get device by token
 */
export async function getDeviceByToken(token: string) {
  const allDevices = await db.query.devices.findMany();

  // Find device by verifying token
  for (const device of allDevices) {
    const isValid = await verifyDeviceToken(token, device.deviceTokenHash);
    if (isValid) {
      return device;
    }
  }

  return null;
}

/**
 * Activate a device
 */
export async function activateDevice(deviceId: string) {
  const [updatedDevice] = await db.update(devices)
    .set({
      isActivated: true,
      updatedAt: new Date(),
    })
    .where(eq(devices.id, deviceId))
    .returning();

  return updatedDevice;
}

/**
 * Update device last health check
 */
export async function updateDeviceHealthCheck(deviceId: string) {
  await db.update(devices)
    .set({
      lastHealthCheck: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(devices.id, deviceId));
}

/**
 * Get device with usage statistics
 */
export async function getDeviceWithUsage(deviceId: string) {
  const device = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
    with: {
      reports: {
        orderBy: desc(reports.timestamp),
        limit: 1,
      },
    },
  });

  if (!device) {
    return null;
  }

  // Get total report count
  const reportsList = await db.query.reports.findMany({
    where: eq(reports.deviceId, deviceId),
  });

  return {
    ...device,
    totalReports: reportsList.length,
    lastReportDate: device.reports[0]?.timestamp || null,
    activatedAt: device.isActivated ? device.createdAt : null,
  };
}

/**
 * Get device usage reports
 */
export async function getDeviceReports(deviceId: string, limit = 100) {
  return db.query.reports.findMany({
    where: eq(reports.deviceId, deviceId),
    orderBy: desc(reports.timestamp),
    limit,
    with: {
      interfaces: true,
    },
  });
}

/**
 * Create a usage report
 */
export async function createUsageReport(data: {
  deviceId: string;
  timestamp: Date;
  date: string;
  interfaces: Array<{
    name: string;
    totalRx: number;
    totalTx: number;
    totalRxMB: number;
    totalTxMB: number;
  }>;
  totalRxMB: number;
  totalTxMB: number;
}) {
  // Create report
  const [report] = await db.insert(reports).values({
    deviceId: data.deviceId,
    timestamp: data.timestamp,
    date: data.date,
    totalRxMB: data.totalRxMB.toString(),
    totalTxMB: data.totalTxMB.toString(),
  }).returning();

  // Create interfaces
  const interfaceInserts = data.interfaces.map(iface => ({
    deviceId: data.deviceId,
    reportId: report.id,
    name: iface.name,
    totalRx: iface.totalRx.toString(),
    totalTx: iface.totalTx.toString(),
    totalRxMB: iface.totalRxMB.toString(),
    totalTxMB: iface.totalTxMB.toString(),
  }));

  await db.insert(interfaces).values(interfaceInserts);

  return report;
}

