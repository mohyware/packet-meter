import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import * as deviceService from '../services/device.service';
import { requireAuth } from '../middleware/auth';
import { createDeviceSchema } from './validation';

const router = Router();

/**
 * POST /api/v1/devices
 * Create a new device
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const parse = createDeviceSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                message: 'invalid payload',
                error: parse.error.flatten()
            });
        }

        const device = await deviceService.createDevice({
            userId: req.userId!,
            name: parse.data.name,
        });

        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(device.deviceToken);

        return res.json({
            success: true,
            message: 'device created',
            device: {
                id: device.id,
                name: device.name,
                isActivated: device.isActivated,
                createdAt: device.createdAt,
            },
            token: device.deviceToken,
            qrCode: qrCodeDataURL,
        });
    } catch (error: any) {
        console.error('Create device error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

/**
 * GET /api/v1/devices
 * Get all user devices
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const devices = await deviceService.getUserDevices(req.userId!);

        return res.json({
            success: true,
            devices: devices.map(device => ({
                id: device.id,
                name: device.name,
                isActivated: device.isActivated,
                lastHealthCheck: device.lastHealthCheck,
                createdAt: device.createdAt,
            })),
        });
    } catch (error: any) {
        console.error('Get devices error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

/**
 * POST /api/v1/devices/:deviceId/activate
 * Activate a device after user approval
 */
router.post('/:deviceId/activate', requireAuth, async (req: Request, res: Response) => {
    try {
        const deviceId = req.params.deviceId;
        const device = await deviceService.getDeviceById(deviceId);

        if (!device || device.userId !== req.userId) {
            return res.status(404).json({ success: false, message: 'device not found' });
        }

        if (device.isActivated) {
            return res.json({ success: true, message: 'device already activated' });
        }

        const updated = await deviceService.activateDevice(deviceId);

        return res.json({
            success: true, message: 'device activated', device: {
                id: updated.id,
                name: updated.name,
                isActivated: updated.isActivated,
                lastHealthCheck: updated.lastHealthCheck,
                createdAt: updated.createdAt,
            }
        });
    } catch (error: any) {
        console.error('Activate device error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

/**
 * GET /api/v1/devices/:deviceId/usage
 * Get usage reports for a device
 */
router.get('/:deviceId/usage', requireAuth, async (req: Request, res: Response) => {
    try {
        const deviceId = req.params.deviceId;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

        const reports = await deviceService.getDeviceReports(deviceId, limit);

        return res.json({
            success: true,
            reports,
        });
    } catch (error: any) {
        console.error('Get device usage error:', error);
        return res.status(500).json({ success: false, message: 'internal server error' });
    }
});

export default router;

