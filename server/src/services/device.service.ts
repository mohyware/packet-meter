import { eq, desc, and, InferSelectModel } from 'drizzle-orm';
import { db, devices, reports, apps } from '../db';
import {
  generateDeviceToken,
  hashDeviceToken,
  verifyDeviceToken,
} from '../utils/auth';
import { roundToUTCHour } from '../utils/timezone';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfDay, subDays, startOfMonth, subMonths } from 'date-fns';

export interface CreateDeviceInput {
  userId: string;
  name: string;
}

export async function countUserDevices(userId: string) {
  const userDevices = await db.query.devices.findMany({
    where: eq(devices.userId, userId),
    columns: {
      id: true,
    },
  });

  return userDevices.length;
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
 * Update device type
 */
export async function updateDeviceType(
  deviceId: string,
  deviceType: 'windows' | 'android' | 'linux' | 'unknown'
) {
  const [updatedDevice] = await db
    .update(devices)
    .set({
      deviceType,
      updatedAt: new Date(),
    })
    .where(eq(devices.id, deviceId))
    .returning();

  return updatedDevice;
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
 */
export async function getDeviceReports(
  deviceId: string,
  timezone: string,
  limit = 100,
  period?: 'hours' | 'days' | 'months',
  count?: number
) {
  // Calculate start date based on period and count
  // Use UTC methods since timestamps are stored in UTC and rounded to hour boundaries
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  if (period && count && count > 0) {
    const now = new Date();

    switch (period) {
      case 'hours': {
        // For "last N hours", we want the current hour plus the previous (N-1) hours
        const currentHour = roundToUTCHour(now);
        startDate = new Date(currentHour);
        startDate.setUTCHours(startDate.getUTCHours() - (count - 1));
        endDate = new Date(currentHour);
        endDate.setUTCHours(endDate.getUTCHours() + 1);
        endDate.setUTCMinutes(0);
        endDate.setUTCSeconds(0);
        endDate.setUTCMilliseconds(0);
        break;
      }
      case 'days': {
        // For "last N days", we want the current day plus the previous (N-1) days
        // Use timezone-aware calculation: get start of current day in user's timezone,
        const nowInTimezone = toZonedTime(now, timezone);
        const startOfCurrentDay = startOfDay(nowInTimezone);
        const startOfTargetDay = subDays(startOfCurrentDay, count - 1);
        // Convert back to UTC for comparison with database timestamps (stored in UTC)
        startDate = fromZonedTime(startOfTargetDay, timezone);
        break;
      }
      case 'months': {
        const nowInTimezone = toZonedTime(now, timezone);
        const startOfCurrentMonth = startOfMonth(nowInTimezone);
        const startOfTargetMonth = subMonths(startOfCurrentMonth, count - 1);
        startDate = fromZonedTime(startOfTargetMonth, timezone);
        break;
      }
    }
  }

  // Get all reports for this device with app information, ordered by timestamp
  // We fetch a large limit and filter in memory for time-based filtering
  const fetchLimit = startDate ? limit * 1000 : limit * 100; // Fetch more if filtering by time
  const allReports = await db.query.reports.findMany({
    where: eq(reports.deviceId, deviceId),
    with: {
      app: true,
    },
    orderBy: desc(reports.timestamp),
    limit: fetchLimit,
  });

  // Filter by time period if specified
  const filteredReports = startDate
    ? allReports.filter((report) => {
        if (period === 'hours' && endDate) {
          // For hours, compare timestamps directly but ensure we're working with hour boundaries
          const reportTime = report.timestamp.getTime();
          const startTime = startDate.getTime();
          const endTime = endDate.getTime();
          return reportTime >= startTime && reportTime < endTime;
        }
        // For days and months, use simple >= comparison
        return report.timestamp.getTime() >= startDate.getTime();
      })
    : allReports;

  // Group by UTC hour and aggregate
  const reportsByHour = new Map<
    string,
    {
      timestamp: Date;
      apps: {
        id: string;
        identifier: string;
        displayName: string | null;
        iconHash: string | null;
        totalRx: string;
        totalTx: string;
      }[];
      totalRxBytes: bigint;
      totalTxBytes: bigint;
    }
  >();

  for (const report of filteredReports) {
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
      iconHash: report.app.iconHash ?? null,
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
    const app = await db.query.apps.findFirst({
      where: and(
        eq(apps.deviceId, data.deviceId),
        eq(apps.identifier, appData.identifier)
      ),
    });

    if (!app) {
      throw new Error(
        `App not found for device ${data.deviceId}, identifier: ${appData.identifier}`
      );
    }

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
