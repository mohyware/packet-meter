import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import * as deviceService from '../services/device.service';
import { requireAuth } from '../middleware/auth';
import { requirePlanFeatures } from '../middleware/subscription';
import { createDeviceSchema, updateDeviceSchema } from './validation';
import logger from '../utils/logger';
import * as userService from '../services/user.service';
import { isValidTimeZone } from '../utils/timezone';

const router = Router();

/**
 * POST /api/v1/devicesp
 * Create a new device
 */
router.post(
  '/',
  requireAuth,
  requirePlanFeatures,
  async (req: Request, res: Response) => {
    try {
      const parse = createDeviceSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({
          success: false,
          message: 'invalid payload',
          error: parse.error.flatten(),
        });
      }

      const features = req.planFeatures;
      if (!features) {
        return res.status(500).json({
          success: false,
          message: 'failed to determine plan features',
        });
      }

      const currentDeviceCount = await deviceService.countUserDevices(
        req.userId!
      );
      if (
        features.maxDevices > -1 &&
        currentDeviceCount >= features.maxDevices
      ) {
        return res.status(403).json({
          success: false,
          message: 'device_limit_reached',
          error: `Your ${features.planName} plan allows up to ${features.maxDevices} devices.`,
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
          lastHealthCheck: device.lastHealthCheck,
          createdAt: device.createdAt,
          status: 'pending' as const, // New device is always pending
        },
        token: device.deviceToken,
        qrCode: qrCodeDataURL,
      });
    } catch (error: unknown) {
      logger.error('Create device error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

/**
 * GET /api/v1/devices
 * Get all user devices
 */
router.get(
  '/',
  requireAuth,
  requirePlanFeatures,
  async (req: Request, res: Response) => {
    try {
      const devices = await deviceService.getUserDevices(req.userId!);

      return res.json({
        success: true,
        features: req.planFeatures,
        devices: devices.map((device) => {
          // Determine status: pending, pendingApproval, or active
          let status: 'pending' | 'pendingApproval' | 'active';
          if (device.isActivated) {
            status = 'active';
          } else if (device.lastHealthCheck) {
            status = 'pendingApproval'; // Device has pinged, waiting for approval
          } else {
            status = 'pending'; // Device created but hasn't pinged yet
          }

          return {
            id: device.id,
            name: device.name,
            isActivated: device.isActivated,
            lastHealthCheck: device.lastHealthCheck,
            createdAt: device.createdAt,
            status, // Add status field
          };
        }),
      });
    } catch (error: unknown) {
      logger.error('Get devices error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

/**
 * POST /api/v1/devices/:deviceId/activate
 * Activate a device after user approval
 */
router.post(
  '/:deviceId/activate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const deviceId = req.params.deviceId;
      const device = await deviceService.getDeviceById(deviceId);

      if (!device || device.userId !== req.userId) {
        return res
          .status(404)
          .json({ success: false, message: 'device not found' });
      }

      if (device.isActivated) {
        return res.json({ success: true, message: 'device already activated' });
      }

      const updated = await deviceService.activateDevice(deviceId);

      return res.json({
        success: true,
        message: 'device activated',
        device: {
          id: updated.id,
          name: updated.name,
          isActivated: updated.isActivated,
          lastHealthCheck: updated.lastHealthCheck,
          createdAt: updated.createdAt,
          status: 'active' as const, // Device is now active
        },
      });
    } catch (error: unknown) {
      logger.error('Activate device error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

/**
 * GET /api/v1/devices/:deviceId/usage
 * Get usage reports for a device
 * Results are aggregated by UTC hour and can be filtered by time period
 * Query parameters:
 *   - limit: number of reports to return (default: 100)
 *   - period: 'hours' | 'days' | 'months' (optional)
 *   - count: number of periods to look back (optional, required if period is provided)
 *   - timezone: IANA timezone name from the client (optional, auto-updates user profile)
 */
router.get(
  '/:deviceId/usage',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const deviceId = req.params.deviceId;
      const device = await deviceService.getDeviceById(deviceId);

      if (!device || device.userId !== userId) {
        return res
          .status(404)
          .json({ success: false, message: 'device not found' });
      }

      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 100;

      const period = req.query.period as
        | 'hours'
        | 'days'
        | 'months'
        | undefined;
      const count = req.query.count
        ? parseInt(req.query.count as string, 10)
        : undefined;

      // Validate period and count
      if (period && (!count || count <= 0)) {
        return res.status(400).json({
          success: false,
          message:
            'count is required and must be greater than 0 when period is provided',
        });
      }

      if (period && !['hours', 'days', 'months'].includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'period must be one of: hours, days, months',
        });
      }

      // Update user timezone if changed
      const clientTimezone =
        typeof req.query.timezone === 'string' ? req.query.timezone : undefined;

      let timezone = await userService.findUserTimezone(userId);

      if (
        clientTimezone &&
        clientTimezone !== timezone &&
        isValidTimeZone(clientTimezone)
      ) {
        await userService.updateUserTimezone(userId, clientTimezone);
        timezone = clientTimezone;
      }

      const reports = await deviceService.getDeviceReports(
        deviceId,
        timezone,
        limit,
        period,
        count
      );

      return res.json({
        success: true,
        reports,
      });
    } catch (error: unknown) {
      logger.error('Get device usage error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/devices/:deviceId
 * Update device name
 */
router.patch('/:deviceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;
    const parse = updateDeviceSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten(),
      });
    }

    const device = await deviceService.getDeviceById(deviceId);

    if (!device || device.userId !== req.userId) {
      return res
        .status(404)
        .json({ success: false, message: 'device not found' });
    }

    const updated = await deviceService.updateDeviceName(
      deviceId,
      parse.data.name
    );

    // Determine status
    let status: 'pending' | 'pendingApproval' | 'active';
    if (updated.isActivated) {
      status = 'active';
    } else if (updated.lastHealthCheck) {
      status = 'pendingApproval';
    } else {
      status = 'pending';
    }

    return res.json({
      success: true,
      message: 'device updated',
      device: {
        id: updated.id,
        name: updated.name,
        isActivated: updated.isActivated,
        lastHealthCheck: updated.lastHealthCheck,
        createdAt: updated.createdAt,
        status,
      },
    });
  } catch (error: unknown) {
    logger.error('Update device error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  }
});

/**
 * DELETE /api/v1/devices/:deviceId
 * Delete a device
 */
router.delete(
  '/:deviceId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const deviceId = req.params.deviceId;
      const device = await deviceService.getDeviceById(deviceId);

      if (!device || device.userId !== req.userId) {
        return res
          .status(404)
          .json({ success: false, message: 'device not found' });
      }

      await deviceService.deleteDevice(deviceId);

      return res.json({
        success: true,
        message: 'device deleted',
      });
    } catch (error: unknown) {
      logger.error('Delete device error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

export default router;
