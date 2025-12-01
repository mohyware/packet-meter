import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import logger from '../utils/logger';
import * as deviceService from './device.service';
import { db, subscriptions, devices, settings } from '../db';
import { and, eq, desc } from 'drizzle-orm';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { bytesToMB, formatMB } from '../utils/utils';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } from '../config/env';

interface DeviceStats {
  deviceId: string;
  deviceName: string;
  isActivated: boolean;
  totalReports: number;
  lastReportDate: Date | null;
  totalRxMB: number;
  totalTxMB: number;
  totalCombinedMB: number;
  usagePercentage: number;
}

interface UserEmailData {
  userId: string;
  email: string;
  username: string;
  timezone: string;
  devices: DeviceStats[];
}

/**
 * Create a nodemailer transporter based on SMTP env vars
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
function createTransporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    logger.warn(
      'SMTP configuration incomplete. Email sending will be disabled.'
    );
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Get device stats for a user
 */
async function getDeviceStatsForUser(
  userId: string,
  timezone: string,
  lookbackDays = 1
): Promise<DeviceStats[]> {
  const userDevices = await db.query.devices.findMany({
    where: eq(devices.userId, userId),
    orderBy: desc(devices.createdAt),
  });

  const deviceStats: Omit<DeviceStats, 'usagePercentage'>[] = [];

  for (const device of userDevices) {
    const deviceWithUsage = await deviceService.getDeviceWithUsage(device.id);

    // Get recent reports (last lookbackDays days) to calculate totals
    const reports = await deviceService.getDeviceReports(
      device.id,
      timezone,
      1000,
      'days',
      lookbackDays
    );

    let totalRxMB = 0;
    let totalTxMB = 0;

    for (const report of reports) {
      totalRxMB += bytesToMB(report.totalRx);
      totalTxMB += bytesToMB(report.totalTx);
    }

    deviceStats.push({
      deviceId: device.id,
      deviceName: device.name,
      isActivated: device.isActivated,
      totalReports: deviceWithUsage?.totalReports ?? 0,
      lastReportDate: deviceWithUsage?.lastReportDate ?? null,
      totalRxMB,
      totalTxMB,
      totalCombinedMB: totalRxMB + totalTxMB,
    });
  }

  const totalUsage =
    deviceStats.reduce((sum, stat) => sum + stat.totalCombinedMB, 0) || 0;

  const statsWithPercentage =
    totalUsage === 0
      ? deviceStats.map((stat) => ({
          ...stat,
          usagePercentage: 0,
        }))
      : deviceStats.map((stat) => ({
          ...stat,
          usagePercentage: (stat.totalCombinedMB / totalUsage) * 100,
        }));

  return statsWithPercentage.sort(
    (a, b) => b.totalCombinedMB - a.totalCombinedMB
  );
}

/**
 * Generate HTML email content
 */
function generateEmailHTML(userData: UserEmailData): string {
  const { username, devices, timezone } = userData;
  const now = new Date();
  const zonedDate = toZonedTime(now, timezone);
  const formattedDate = format(zonedDate, 'MMMM d, yyyy');

  let devicesHTML = '';
  if (devices.length === 0) {
    devicesHTML = '<p>No devices connected yet.</p>';
  } else {
    devicesHTML = devices
      .map(
        (device) => `
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid ${device.isActivated ? '#10b981' : '#ef4444'};">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">${device.deviceName}</h3>
        <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
          Status: <strong style="color: ${device.isActivated ? '#10b981' : '#ef4444'}">${device.isActivated ? 'Active' : 'Inactive'}</strong>
        </p>
        ${device.lastReportDate ? `<p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Last Report: <strong>${format(toZonedTime(device.lastReportDate, timezone), 'MMM d, yyyy HH:mm')}</strong></p>` : ''}
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            <span style="color: #3b82f6;">↓ Received:</span> <strong>${formatMB(device.totalRxMB)}</strong>
          </p>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            <span style="color: #10b981;">↑ Sent:</span> <strong>${formatMB(device.totalTxMB)}</strong>
          </p>
          <p style="margin: 5px 0; color: #1f2937; font-size: 16px; font-weight: bold;">
            Total: <strong>${formatMB(device.totalCombinedMB)}</strong>
          </p>
          <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">
            Share of total usage: <strong>${device.usagePercentage.toFixed(1)}%</strong>
          </p>
        </div>
      </div>
    `
      )
      .join('');
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #4f46e5; margin-top: 0;">PacketMeter Device Report</h1>
    <p style="color: #6b7280; margin-bottom: 30px;">Hello ${username},</p>
    <p style="color: #6b7280;">Here's a summary of your device statistics as of ${formattedDate}:</p>
    
    ${devicesHTML}
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        This is an automated email from PacketMeter. You can manage your email preferences in your account settings.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send email report to a user
 */
export async function sendDeviceStatsEmail(
  userData: UserEmailData
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('Cannot send email: SMTP not configured');
    return false;
  }

  try {
    const htmlContent = generateEmailHTML(userData);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await transporter.sendMail({
      from: SMTP_USER,
      to: userData.email,
      subject: 'PacketMeter - Your Device Statistics Report',
      html: htmlContent,
    });

    logger.info(`Device stats email sent to ${userData.email}`);
    return true;
  } catch (error: unknown) {
    logger.error(`Failed to send email to ${userData.email}:`, error);
    return false;
  }
}

/**
 * Get all users with email reports enabled
 */
export async function getUsersWithEmailReportsEnabled(): Promise<
  UserEmailData[]
> {
  const allUsers = await db.query.users.findMany();

  const usersWithEmailReports: UserEmailData[] = [];

  for (const user of allUsers) {
    // Get user's subscription
    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, user.id),
        eq(subscriptions.status, 'active')
      ),
      with: {
        plan: true,
      },
      orderBy: desc(subscriptions.currentPeriodEnd),
    });

    // Load user settings (if any)
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userId, user.id),
    });

    const emailReportsEnabledForUser =
      userSettings?.emailReportsEnabled ??
      subscription?.plan?.emailReportsEnabled ??
      false;

    if (!emailReportsEnabledForUser) {
      continue;
    }

    const lookbackDays =
      userSettings?.emailInterval ??
      subscription?.plan?.maxClearReportsInterval ??
      1;

    const deviceStats = await getDeviceStatsForUser(
      user.id,
      user.timezone,
      lookbackDays
    );

    usersWithEmailReports.push({
      userId: user.id,
      email: user.email,
      username: user.username,
      timezone: user.timezone,
      devices: deviceStats,
    });
  }

  return usersWithEmailReports;
}

/**
 * Send device stats emails to all eligible users
 */
export async function sendDeviceStatsEmailsToAllUsers(): Promise<{
  total: number;
  sent: number;
  failed: number;
}> {
  const users = await getUsersWithEmailReportsEnabled();
  let sent = 0;
  let failed = 0;

  logger.info(`Sending device stats emails to ${users.length} users`);

  for (const user of users) {
    const success = await sendDeviceStatsEmail(user);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.info(
    `Email sending complete: ${sent} sent, ${failed} failed out of ${users.length} total`
  );

  return {
    total: users.length,
    sent,
    failed,
  };
}
