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
    deviceTokenHash,
    isActivated: false,
  }).returning();

  return {
    ...device,
    // Only return the plain token on creation (not stored in DB)
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
 * Get device by id
 */
export async function getDeviceById(deviceId: string) {
  return db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  });
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
 * Create or update a usage report (one per device per day)
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
  // Check if report exists for this device and date
  const existingReport = await db.query.reports.findFirst({
    where: and(
      eq(reports.deviceId, data.deviceId),
      eq(reports.date, data.date)
    ),
  });

  let report;

  if (existingReport) {
    // Update existing report
    const [updatedReport] = await db.update(reports)
      .set({
        timestamp: data.timestamp,
        totalRxMB: data.totalRxMB.toString(),
        totalTxMB: data.totalTxMB.toString(),
        updatedAt: new Date(),
      })
      .where(eq(reports.id, existingReport.id))
      .returning();

    report = updatedReport;
  } else {
    // Create new report
    const [newReport] = await db.insert(reports).values({
      deviceId: data.deviceId,
      timestamp: data.timestamp,
      date: data.date,
      totalRxMB: data.totalRxMB.toString(),
      totalTxMB: data.totalTxMB.toString(),
    }).returning();

    report = newReport;
  }

  // Create/update interfaces (one per report per name)
  for (const iface of data.interfaces) {
    // Check if interface exists for this report and name
    const existingInterface = await db.query.interfaces.findFirst({
      where: and(
        eq(interfaces.reportId, report.id),
        eq(interfaces.name, iface.name)
      ),
    });

    if (existingInterface) {
      // Update existing interface
      await db.update(interfaces)
        .set({
          totalRx: iface.totalRx.toString(),
          totalTx: iface.totalTx.toString(),
          totalRxMB: iface.totalRxMB.toString(),
          totalTxMB: iface.totalTxMB.toString(),
        })
        .where(eq(interfaces.id, existingInterface.id));
    } else {
      // Create new interface
      await db.insert(interfaces).values({
        deviceId: data.deviceId,
        reportId: report.id,
        name: iface.name,
        totalRx: iface.totalRx.toString(),
        totalTx: iface.totalTx.toString(),
        totalRxMB: iface.totalRxMB.toString(),
        totalTxMB: iface.totalTxMB.toString(),
      });
    }
  }

  return report;
}

