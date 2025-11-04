import { PORT, SESSION_SECRET, DATABASE_URL, NODE_ENV } from './config/env';
import express, { Request, Response } from 'express';
import morgan from 'morgan';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { z } from 'zod';
import QRCode from 'qrcode';
import postgres from 'postgres';
import { requireAuth, requireDeviceAuth } from './middleware/auth';
import * as userService from './services/user.service';
import * as deviceService from './services/device.service';
import './db'; // Initialize database connection

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Session configuration with PostgreSQL store
const PgSession = connectPg(session);
const pgPool = postgres(DATABASE_URL);
const sessionStore = new PgSession({
  pool: pgPool as any,
  tableName: 'session',
  createTableIfMissing: true,
});

app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
});

const deviceHealthCheckSchema = z.object({
  deviceId: z.string().uuid(),
});

const interfaceUsageSchema = z.object({
  Interface: z.string(),
  TotalRx: z.number().nonnegative(),
  TotalTx: z.number().nonnegative(),
  TotalRxMB: z.number().nonnegative(),
  TotalTxMB: z.number().nonnegative(),
});

const dailyUsageReportSchema = z.object({
  DeviceId: z.string().uuid(),
  Timestamp: z.string(),
  Date: z.string(), // YYYY-MM-DD
  Interfaces: z.array(interfaceUsageSchema),
  TotalRxMB: z.number().nonnegative(),
  TotalTxMB: z.number().nonnegative(),
});

// ==================== Auth Routes ====================

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten()
      });
    }

    const user = await userService.registerUser(parse.data);

    // Store userId in session
    req.session!.userId = user.id;

    return res.json({
      success: true,
      message: 'user created',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: any) {
    if (error.message === 'Username or email already exists') {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login a user
 */
app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parse.error.flatten()
      });
    }

    const user = await userService.verifyUser(parse.data);

    if (!user) {
      return res.status(401).json({ success: false, message: 'invalid credentials' });
    }

    // Store userId in session
    req.session!.userId = user.id;

    return res.json({
      success: true,
      message: 'login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout current user
 */
app.post('/api/v1/auth/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    req.session?.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ success: false, message: 'internal server error' });
      }
      res.json({ success: true, message: 'logout successful' });
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
app.get('/api/v1/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    // User info is available from session
    return res.json({
      success: true,
      userId: req.userId,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
});

// ==================== Device Routes ====================

/**
 * POST /api/v1/devices
 * Create a new device
 */
app.post('/api/v1/devices', requireAuth, async (req: Request, res: Response) => {
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
app.get('/api/v1/devices', requireAuth, async (req: Request, res: Response) => {
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
 * GET /api/v1/devices/:deviceId/usage
 * Get usage reports for a device
 */
app.get('/api/v1/devices/:deviceId/usage', requireAuth, async (req: Request, res: Response) => {
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

// ==================== Device Health Check ====================

/**
 * POST /api/v1/device/health-check
 * Device health check endpoint (activates device)
 */
app.post('/api/v1/device/health-check', requireDeviceAuth, async (req: Request, res: Response) => {
  try {
    const token = (req as any).deviceToken;

    // Find device by token
    const device = await deviceService.getDeviceByToken(token);

    if (!device) {
      return res.status(401).json({ success: false, message: 'invalid device token' });
    }

    // Update last health check
    await deviceService.updateDeviceHealthCheck(device.id);

    // Activate device if not already activated
    if (!device.isActivated) {
      await deviceService.activateDevice(device.id);
    }

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

// ==================== Traffic Report ====================

/**
 * POST /api/v1/traffic/report
 * Submit a daily usage report from device
 */
app.post('/api/v1/traffic/report', requireDeviceAuth, async (req: Request, res: Response) => {
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

    // Create report in database
    await deviceService.createUsageReport({
      deviceId: report.DeviceId,
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

    console.log(`[${new Date().toISOString()}] Daily usage report from device ${report.DeviceId}:`);
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

// ==================== Health Check ====================

/**
 * GET /health
 * Server health check
 */
app.get('/health', (_req, res) => res.json({ ok: true }));

// ==================== Start Server ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PacketPilot TS server listening on :${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Database: ${DATABASE_URL ? 'connected' : 'not configured'}`);
});
