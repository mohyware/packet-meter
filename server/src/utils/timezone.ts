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

/**
 * Round a date to the nearest UTC hour (floor)
 * Returns a new Date with minutes, seconds, and milliseconds set to 0 in UTC
 */
export function roundToUTCHour(date: Date): Date {
  const utcDate = new Date(date);
  utcDate.setUTCMinutes(0);
  utcDate.setUTCSeconds(0);
  utcDate.setUTCMilliseconds(0);
  return utcDate;
}

/**
 * Get UTC hour range for a date in a local timezone
 * Returns start and end UTC hours that cover the entire day in the local timezone
 * 
 * Strategy: Use Intl.DateTimeFormat to get what a UTC timestamp looks like in the target timezone,
 * then work backwards to find the UTC timestamps that correspond to midnight and end of day in that timezone.
 */
export function getUTCHourRangeForLocalDay(
  localDate: Date,
  timezone: string
): { start: Date; end: Date } {
  try {
    // Get the date components in the target timezone for the input date
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(localDate);

    const year = parseInt(localParts.find((p) => p.type === 'year')?.value ?? '0');
    const month = parseInt(localParts.find((p) => p.type === 'month')?.value ?? '0') - 1;
    const day = parseInt(localParts.find((p) => p.type === 'day')?.value ?? '0');

    // Create a UTC date for midnight on this date (treating it as if it were UTC)
    // Then we'll find what UTC time actually shows as midnight in the target timezone
    const candidateStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

    // Find the UTC time that shows as 00:00 in the target timezone
    // We'll do a simple search by checking nearby hours
    let bestStart = candidateStart;
    let minDiff = Infinity;

    // Check 48 hours around the candidate (to handle DST and timezone offsets up to +/-12 hours)
    for (let h = -12; h <= 12; h++) {
      const testDate = new Date(Date.UTC(year, month, day, h, 0, 0, 0));
      const localHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          hour12: false,
        }).format(testDate)
      );
      const localDay = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          day: '2-digit',
        }).format(testDate)
      );

      if (localDay === day && localHour === 0) {
        const diff = Math.abs(testDate.getTime() - candidateStart.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          bestStart = testDate;
        }
      }
    }

    const startUTC = bestStart;

    // Find the UTC time that shows as 23:59 (or start of next day) in the target timezone
    let bestEnd = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
    minDiff = Infinity;

    for (let h = 12; h <= 36; h++) {
      const testDate = new Date(Date.UTC(year, month, day, h, 0, 0, 0));
      const localDay = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          day: '2-digit',
        }).format(testDate)
      );

      if (localDay === day + 1) {
        const diff = Math.abs(testDate.getTime() - bestEnd.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          bestEnd = testDate;
        }
        break; // Found the start of next day
      }
    }

    // Round to hours
    return {
      start: roundToUTCHour(startUTC),
      end: roundToUTCHour(bestEnd),
    };
  } catch (error) {
    logger.warn(
      `Error getting UTC hour range: ${getErrorMessage(error)}, falling back to simple UTC conversion`
    );
    // Fallback: treat as UTC date
    const utcDate = roundToUTCHour(new Date(localDate));
    return {
      start: utcDate,
      end: new Date(utcDate.getTime() + 24 * 60 * 60 * 1000),
    };
  }
}

/**
 * Convert a date/time in local timezone to UTC hour
 * Useful for converting a specific timestamp from device to UTC hour for storage
 */
export function convertLocalTimeToUTCHour(
  date: Date,
  _timezone: string
): Date {
  try {
    // The date is already a JavaScript Date (which is UTC internally)
    // But if it represents a time in a specific timezone, we need to convert it
    // For now, just round the date to UTC hour
    // In practice, the device should send UTC timestamps
    return roundToUTCHour(date);
  } catch (error) {
    logger.warn(
      `Error converting local time to UTC hour: ${getErrorMessage(error)}, using date as-is`
    );
    return roundToUTCHour(date);
  }
}
