import { PORT, SESSION_SECRET, DATABASE_URL, NODE_ENV } from './config/env';
import express from 'express';
import morgan from 'morgan';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Auth routes
app.use('/api/v1/auth', authRoutes);

// Device routes
app.use('/api/v1/devices', deviceRoutes);

// Device health check routes
app.use('/api/v1/device', deviceHealthRoutes);

// Traffic report routes
app.use('/api/v1/traffic', trafficRoutes);

// Health check route
app.use('/health', healthRoutes);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`PacketPilot server listening on :${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`Database: ${DATABASE_URL ? 'connected' : 'not configured'}`);
});
