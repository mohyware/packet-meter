import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import * as deviceService from '../services/device.service';
import { requireDeviceAuth } from '../middleware/auth';
import { dailyUsageReportSchema } from './validation';
import { getDateInTimezone } from '../utils/timezone';
import { db, users } from '../db';

const router = Router();

/**
 * POST /api/v1/traffic/report
 * Submit a daily usage report from device
 * Requires: Valid device token AND device must be activated
 */
router.post('/report', requireDeviceAuth, async (req: Request, res: Response) => {
    try {
        const parse = dailyUsageReportSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                message: 'invalid payload',
                error: parse.error.flatten()
            });
        }

        const token = (req as any).deviceToken;

        // Find device by token
        const device = await deviceService.getDeviceByToken(token);

        if (!device) {
            return res.status(401).json({ success: false, message: 'invalid device token' });
        }

        // Check if device is activated - require activation before allowing traffic reports
        if (!device.isActivated) {
            return res.status(403).json({
                success: false,
                message: 'device_not_activated',
                error: 'Device must be approved and activated before it can send usage reports. Please wait for user approval.'
            });
        }

        const report = parse.data;

        // Get user timezone from device
        const user = await db.query.users.findFirst({
            where: eq(users.id, device.userId),
        });

        const userTimezone = user?.timezone || 'UTC';

        // Convert the timestamp to user's timezone and get the date
        const timestampDate = new Date(report.Timestamp);
        const dateInUserTimezone = getDateInTimezone(timestampDate, userTimezone);

        // Create report in database with date in user's timezone
        await deviceService.createUsageReport({
            deviceId: device.id,
            timestamp: timestampDate,
            date: dateInUserTimezone, // Use date in user's timezone instead of device's date
            interfaces: report.Interfaces.map(iface => ({
                name: iface.Interface,
                totalRx: iface.TotalRx,
                totalTx: iface.TotalTx,
                totalRxMB: iface.TotalRxMB,
                totalTxMB: iface.TotalTxMB,
            })),
            totalRxMB: report.TotalRxMB,
            totalTxMB: report.TotalTxMB,
        });

        console.log(`[${new Date().toISOString()}] Daily usage report from device ${device.id}:`);
        console.log(`  Date: ${report.Date}`);
        console.log(`  Total Combined: ${(report.TotalRxMB + report.TotalTxMB).toFixed(2)} MB (RX: ${report.TotalRxMB.toFixed(2)} MB, TX: ${report.TotalTxMB.toFixed(2)} MB)`);
        console.log(`  Interfaces (${report.Interfaces.length}):`);

        for (const iface of report.Interfaces) {
            const combined = iface.TotalRxMB + iface.TotalTxMB;
            console.log(`    ${iface.Interface}: ${combined.toFixed(2)} MB (RX: ${iface.TotalRxMB.toFixed(2)} MB, TX: ${iface.TotalTxMB.toFixed(2)} MB)`);
        }
        console.log('---');

        return res.json({ success: true, message: 'received', commands: [] });
    } catch (error: any) {
        console.error('Traffic report error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

export default router;
