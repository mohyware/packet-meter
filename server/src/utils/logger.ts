import winston from 'winston';
import { NODE_ENV } from '../config/env';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    if (info.level.includes('http')) {
      // Morgan already formats the message nicely, just add timestamp and level
      return `${info.timestamp as string} ${info.level}: ${info.message as string}`;
    }
    return `${info.timestamp as string} ${info.level}: ${info.message as string}${info.stack ? '\n' + (info.stack as string) : ''}`;
  })
);

// Determine which transports to use
const transports: winston.transport[] = [
  // Console transport (always enabled)
  new winston.transports.Console({
    format: NODE_ENV === 'production' ? format : consoleFormat,
    level: NODE_ENV === 'production' ? 'info' : 'debug',
  }),
];

// Add file transports in production
if (NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, '../../logs');

  // Create logs directory if it doesn't exist
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    // Remove trailing newline from Morgan's message
    const trimmedMessage = message.trim();
    // Use http level for HTTP request logs
    logger.http(trimmedMessage);
  },
};

export default logger;
