import { Router, Request, Response } from 'express';
import * as deviceService from '../services/device.service';
import { requireDeviceAuth } from '../middleware/auth';
import logger from '../utils/logger';
import { extractDeviceTypeFromUserAgent } from '../utils/utils';

const router = Router();

/**
 * POST /api/v1/device/health-check
 * Device health check endpoint (activates device)
 */
router.post(
  '/health-check',
  requireDeviceAuth,
  async (req: Request, res: Response) => {
    try {
      const token = req.deviceToken;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'unauthorized - no token provided',
        });
      }

      // Find device by token
      const device = await deviceService.getDeviceByToken(token);

      if (!device) {
        return res
          .status(401)
          .json({ success: false, message: 'invalid device token' });
      }

      // Update last health check
      await deviceService.updateDeviceHealthCheck(device.id);

      // Update device type if unknown
      if (device.deviceType === 'unknown') {
        const userAgent = req.header('User-Agent');
        if (!userAgent) {
          return res.status(400).json({
            success: false,
            message: 'user agent not provided',
          });
        }
        const extractedDeviceType = extractDeviceTypeFromUserAgent(userAgent);
        await deviceService.updateDeviceType(device.id, extractedDeviceType);
        logger.info(`Device type updated to ${extractedDeviceType}`);
      }

      return res.json({
        success: true,
        message: 'health check received',
        device: {
          id: device.id,
          name: device.name,
        },
      });
    } catch (error: unknown) {
      logger.error('Health check error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

export default router;
