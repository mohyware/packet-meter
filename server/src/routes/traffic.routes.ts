import { Router, Request, Response } from 'express';
import * as deviceService from '../services/device.service';
import { requireDeviceAuth } from '../middleware/auth';
import { dailyUsageReportSchema } from './validation';

const router = Router();

/**
 * POST /api/v1/traffic/report
 * Submit a daily usage report from device
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

        const report = parse.data;

        // Use device.id from token lookup (not from payload)
        // Create report in database
        await deviceService.createUsageReport({
            deviceId: device.id,
            timestamp: new Date(report.Timestamp),
            date: report.Date,
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
