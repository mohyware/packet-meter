import { Router, Request, Response } from 'express';
import * as deviceService from '../services/device.service';
import { requireDeviceAuth } from '../middleware/auth';
import { dailyUsageReportSchema, registerAppsSchema } from './validation';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/traffic/apps
 * Register or update apps for a device
 * Requires: Valid device token AND device must be activated
 */
router.post('/apps', requireDeviceAuth, async (req: Request, res: Response) => {
  try {
    const parse = registerAppsSchema.safeParse(req.body);
    if (!parse.success) {
      logger.warn(parse.error.errors);
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten(),
      });
    }

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

    // Check if device is activated
    if (!device.isActivated) {
      return res.status(403).json({
        success: false,
        message: 'device_not_activated',
        error:
          'Device must be approved and activated before it can register apps. Please wait for user approval.',
      });
    }

    // Register or update each app
    const registeredApps = [];
    for (const app of parse.data.Apps) {
      const registeredApp = await deviceService.findOrCreateApp(
        device.id,
        app.Identifier,
        app.DisplayName,
        app.IconHash ?? undefined
      );
      registeredApps.push(registeredApp);
    }

    logger.debug(
      `Device: ${device.id}, Registered/Updated ${registeredApps.length} apps`
    );

    return res.json({
      success: true,
      message: 'apps registered',
      apps: registeredApps.map((app) => ({
        id: app.id,
        identifier: app.identifier,
        displayName: app.displayName,
      })),
    });
  } catch (error: unknown) {
    logger.error('Register apps error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  }
});

/**
 * POST /api/v1/traffic/report
 * Submit a daily usage report from device
 * Requires: Valid device token AND device must be activated
 * Note: Apps should be registered first using /apps endpoint
 */
router.post(
  '/report',
  requireDeviceAuth,
  async (req: Request, res: Response) => {
    try {
      const parse = dailyUsageReportSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({
          success: false,
          message: 'invalid payload',
          error: parse.error.flatten(),
        });
      }

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

      // Check if device is activated - require activation before allowing traffic reports
      if (!device.isActivated) {
        return res.status(403).json({
          success: false,
          message: 'device_not_activated',
          error:
            'Device must be approved and activated before it can send usage reports. Please wait for user approval.',
        });
      }

      const report = parse.data;

      // Parse timestamp from report (device should send UTC timestamp)
      const timestampDate = new Date(report.Timestamp);

      // Create reports in database (one per app, grouped by UTC hour)
      // The timestamp will be rounded to UTC hour for storage
      await deviceService.createUsageReport({
        deviceId: device.id,
        timestamp: timestampDate,
        apps: report.Apps.map((app) => ({
          identifier: app.Identifier,
          totalRx: app.TotalRx,
          totalTx: app.TotalTx,
        })),
      });

      // Calculate total for logging (convert bytes to MB)
      const totalRxBytes = report.Apps.reduce(
        (sum, app) => sum + app.TotalRx,
        0
      );
      const totalTxBytes = report.Apps.reduce(
        (sum, app) => sum + app.TotalTx,
        0
      );
      const totalRxMB = totalRxBytes / (1024 * 1024);
      const totalTxMB = totalTxBytes / (1024 * 1024);

      logger.debug(
        `Device: ${device.id}, Timestamp: ${timestampDate.toISOString()}, Apps: ${report.Apps.length}, Total Combined: ${(totalRxMB + totalTxMB).toFixed(2)} MB`
      );

      return res.json({ success: true, message: 'received', commands: [] });
    } catch (error: unknown) {
      logger.error('Traffic report error:', error);
      return res
        .status(500)
        .json({ success: false, message: 'internal server error' });
    }
  }
);

export default router;
