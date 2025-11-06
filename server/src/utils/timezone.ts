import { getErrorMessage } from './errors';
import logger from './logger';

/**
 * Convert a date to user's timezone and return YYYY-MM-DD format
 */
export function getDateInTimezone(date: Date, timezone: string): string {
  try {
    // Use Intl.DateTimeFormat to convert to user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // Format returns YYYY-MM-DD in user's timezone
    return formatter.format(date);
  } catch (error) {
    // If timezone is invalid, fallback to UTC
    logger.warn(
      `Invalid timezone: ${timezone}, falling back to UTC ${getErrorMessage(error)}`
    );
    return date.toISOString().split('T')[0];
  }
}

/**
 * Get current date in user's timezone (YYYY-MM-DD)
 */
export function getCurrentDateInTimezone(timezone: string): string {
  return getDateInTimezone(new Date(), timezone);
}
