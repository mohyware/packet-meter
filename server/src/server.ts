import {
  PORT,
  SESSION_SECRET,
  DATABASE_URL,
  NODE_ENV,
  EMAIL_SCHEDULE,
  REPORT_CLEANUP_SCHEDULE,
} from './config/env';
import express, { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import compression from 'compression';
import cors from 'cors';
import { Pool } from 'pg';
import logger, { morganStream } from './utils/logger';
import './db';

// Import routes
import authRoutes from './routes/auth.routes';
import deviceRoutes from './routes/device.routes';
import deviceHealthRoutes from './routes/device-health.routes';
import trafficRoutes from './routes/traffic.routes';
import healthRoutes from './routes/health.routes';
import emailRoutes from './routes/email.routes';
import settingsRoutes from './routes/settings.routes';

// Import services
import { startEmailScheduler } from './services/email-scheduler.service';
import { startReportCleanerScheduler } from './services/report-cleaner.service';

const app = express();

// CORS configuration
app.use(
  cors({
    origin:
      NODE_ENV === 'production'
        ? (process.env.FRONTEND_URL ?? 'http://localhost:3000')
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(compression());

app.use(
  morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: morganStream,
  })
);

// Session configuration with PostgreSQL store
const PgSession = connectPg(session);
const pgPool = new Pool({
  connectionString: DATABASE_URL,
});
const sessionStore = new PgSession({
  pool: pgPool,
  tableName: 'session',
  createTableIfMissing: true,
});

app.use(
  session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === 'production',
      httpOnly: true,
      sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
      domain: NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/device', deviceHealthRoutes);
app.use('/api/v1/traffic', trafficRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/health', healthRoutes);
app.use((err: Error, req: Request, res: Response, _: NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({ success: false, message: 'internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`PacketPilot server listening on :${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`Database: ${DATABASE_URL ? 'connected' : 'not configured'}`);

  const emailSchedule = EMAIL_SCHEDULE;
  if (emailSchedule !== 'disabled') {
    startEmailScheduler(emailSchedule);
  } else {
    logger.info('Email scheduler is disabled');
  }

  const reportCleanupSchedule = REPORT_CLEANUP_SCHEDULE;
  if (reportCleanupSchedule !== 'disabled') {
    startReportCleanerScheduler(reportCleanupSchedule);
  } else {
    logger.info('Report cleanup scheduler is disabled');
  }
});
