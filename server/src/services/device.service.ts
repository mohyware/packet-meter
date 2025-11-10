import { eq, desc, and, InferSelectModel } from 'drizzle-orm';
import { db, devices, reports, apps } from '../db';
import {
  generateDeviceToken,
  hashDeviceToken,
  verifyDeviceToken,
} from '../utils/auth';
import { roundToUTCHour } from '../utils/timezone';

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

  const [device] = await db
    .insert(devices)
    .values({
      userId: input.userId,
      name: input.name,
      deviceTokenHash,
      isActivated: false,
    })
    .returning();

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
  const [updatedDevice] = await db
    .update(devices)
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
  await db
    .update(devices)
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
  });

  if (!device) {
    return null;
  }

  // Get the most recent report timestamp
  const latestReport = await db.query.reports.findFirst({
    where: eq(reports.deviceId, deviceId),
    orderBy: desc(reports.timestamp),
  });

  // Get total report count (unique hours) - get all reports and count unique timestamps
  const allReports = await db.query.reports.findMany({
    where: eq(reports.deviceId, deviceId),
    columns: {
      timestamp: true,
    },
  });

  // Count unique timestamps
  const uniqueHours = new Set(allReports.map((r) => r.timestamp.toISOString()));

  return {
    ...device,
    totalReports: uniqueHours.size,
    lastReportDate: latestReport?.timestamp ?? null,
    activatedAt: device.isActivated ? device.createdAt : null,
  };
}

/**
 * Find or create an app for a device
 */
export async function findOrCreateApp(
  deviceId: string,
  identifier: string,
  displayName?: string,
  iconHash?: string
) {
  // Try to find existing app
  const existingApp = await db.query.apps.findFirst({
    where: and(eq(apps.deviceId, deviceId), eq(apps.identifier, identifier)),
  });

  if (existingApp) {
    // Update display name and icon hash if provided
    if (displayName !== undefined || iconHash !== undefined) {
      const [updatedApp] = await db
        .update(apps)
        .set({
          displayName: displayName ?? existingApp.displayName,
          iconHash: iconHash ?? existingApp.iconHash,
          updatedAt: new Date(),
        })
        .where(eq(apps.id, existingApp.id))
        .returning();
      return updatedApp;
    }
    return existingApp;
  }

  // Create new app
  const [newApp] = await db
    .insert(apps)
    .values({
      deviceId,
      identifier,
      displayName: displayName ?? null,
      iconHash: iconHash ?? null,
    })
    .returning();

  return newApp;
}

/**
 * Get device usage reports
 * Aggregates app-level reports by UTC hour and returns device-level totals
 * Results are grouped by UTC hour and can be filtered by local timezone
 */
export async function getDeviceReports(deviceId: string, limit = 100) {
  // Get all reports for this device with app information, ordered by timestamp
  const allReports = await db.query.reports.findMany({
    where: eq(reports.deviceId, deviceId),
    with: {
      app: true,
    },
    orderBy: desc(reports.timestamp),
    limit: limit * 100, // Get more to account for multiple apps per hour
  });

  // Group by UTC hour and aggregate
  const reportsByHour = new Map<
    string,
    {
      timestamp: Date;
      apps: {
        id: string;
        identifier: string;
        displayName: string | null;
        totalRx: string;
        totalTx: string;
      }[];
      totalRxBytes: bigint;
      totalTxBytes: bigint;
    }
  >();

  for (const report of allReports) {
    const hourKey = report.timestamp.toISOString();
    if (!reportsByHour.has(hourKey)) {
      reportsByHour.set(hourKey, {
        timestamp: report.timestamp,
        apps: [],
        totalRxBytes: BigInt(0),
        totalTxBytes: BigInt(0),
      });
    }

    const hourReport = reportsByHour.get(hourKey)!;
    const rxBytes = BigInt(report.totalRx);
    const txBytes = BigInt(report.totalTx);

    hourReport.apps.push({
      id: report.appId,
      identifier: report.app.identifier,
      displayName: report.app.displayName,
      totalRx: report.totalRx,
      totalTx: report.totalTx,
    });
    hourReport.totalRxBytes += rxBytes;
    hourReport.totalTxBytes += txBytes;
  }

  // Convert to array and sort by timestamp (descending)
  const result = Array.from(reportsByHour.values())
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map((report) => ({
      id: report.timestamp.toISOString(), // Use timestamp as ID for now
      deviceId,
      timestamp: report.timestamp,
      totalRx: report.totalRxBytes.toString(),
      totalTx: report.totalTxBytes.toString(),
      apps: report.apps,
    }));

  return result;
}

/**
 * Update device name
 */
export async function updateDeviceName(deviceId: string, name: string) {
  const [updatedDevice] = await db
    .update(devices)
    .set({
      name,
      updatedAt: new Date(),
    })
    .where(eq(devices.id, deviceId))
    .returning();

  return updatedDevice;
}

/**
 * Delete a device (cascades to reports and apps)
 */
export async function deleteDevice(deviceId: string) {
  await db.delete(devices).where(eq(devices.id, deviceId));
}

/**
 * Create or update usage reports (one per app per UTC hour)
 * Stores reports grouped by UTC hour, with one record per app per hour
 */
export async function createUsageReport(data: {
  deviceId: string;
  timestamp: Date;
  apps: {
    identifier: string;
    totalRx: number;
    totalTx: number;
  }[];
}) {
  // Round timestamp to UTC hour for storage
  const utcHour = roundToUTCHour(data.timestamp);

  // Create or update report for each app
  const createdReports = [];

  for (const appData of data.apps) {
    // Find the app (it should already be registered, but find it anyway)
    // let app = await db.query.apps.findFirst({
    //   where: and(
    //     eq(apps.deviceId, data.deviceId),
    //     eq(apps.identifier, appData.identifier)
    //   ),
    // });

    // if (!app) {
    // App not found - try to create it as a fallback
    // This can happen if app registration failed or was skipped
    // logger.warn(
    //   `App not found for device ${data.deviceId}, identifier: ${appData.identifier}, creating as fallback`
    // );
    const app = await findOrCreateApp(
      data.deviceId,
      appData.identifier,
      undefined,
      undefined
    );

    // }

    // Check if report exists for this device, app, and UTC hour
    const existingReport = await db.query.reports.findFirst({
      where: and(
        eq(reports.deviceId, data.deviceId),
        eq(reports.appId, app.id),
        eq(reports.timestamp, utcHour)
      ),
    });

    if (existingReport) {
      // Update existing report
      const [updatedReport] = await db
        .update(reports)
        .set({
          totalRx: appData.totalRx.toString(),
          totalTx: appData.totalTx.toString(),
          updatedAt: new Date(),
        })
        .where(eq(reports.id, existingReport.id))
        .returning();

      createdReports.push(updatedReport);
    } else {
      // Create new report
      const [newReport] = await db
        .insert(reports)
        .values({
          deviceId: data.deviceId,
          appId: app.id,
          timestamp: utcHour,
          totalRx: appData.totalRx.toString(),
          totalTx: appData.totalTx.toString(),
        })
        .returning();

      createdReports.push(newReport);
    }
  }

  return createdReports;
}
