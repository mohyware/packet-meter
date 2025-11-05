import { Router, Request, Response } from 'express';
import * as deviceService from '../services/device.service';
import { requireDeviceAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/v1/device/health-check
 * Device health check endpoint (activates device)
 */
router.post('/health-check', requireDeviceAuth, async (req: Request, res: Response) => {
    try {
        const token = (req as any).deviceToken;

        // Find device by token
        const device = await deviceService.getDeviceByToken(token);

        if (!device) {
            return res.status(401).json({ success: false, message: 'invalid device token' });
        }

        // Update last health check
        await deviceService.updateDeviceHealthCheck(device.id);

        // Do NOT auto-activate; user must approve in the web UI

        return res.json({
            success: true,
            message: 'health check received',
            device: {
                id: device.id,
                name: device.name,
            },
        });
    } catch (error: any) {
        console.error('Health check error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

export default router;

