import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { TenantDb } from './tenantDb';
import { businessSettings } from '@shared/schema';

const DEFAULT_TIMEZONE = 'America/Chicago';

export interface TenantTimezoneInfo {
  timezone: string;
}

/**
 * Get the timezone for a tenant from their business settings.
 * Falls back to America/Chicago if not set.
 */
export async function getTenantTimezone(tenantDb: TenantDb): Promise<string> {
  try {
    const settings = await tenantDb.query.businessSettings.findFirst({
      where: tenantDb.withTenantFilter(businessSettings),
    });
    return settings?.timezone || DEFAULT_TIMEZONE;
  } catch (error) {
    console.error('[TIMEZONE] Error fetching tenant timezone:', error);
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Format a UTC date/time in the tenant's local timezone.
 * This is the primary function for all customer-facing time displays.
 * 
 * @param utcDate - The date in UTC (as stored in database)
 * @param timezone - The tenant's timezone (e.g., 'America/Chicago')
 * @param options - Formatting options
 * @returns Formatted date string like "Thu Dec 12 at 9:00 AM"
 */
export function formatTenantLocalTime(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
  options: {
    includeDate?: boolean;
    includeWeekday?: boolean;
    format?: 'short' | 'long' | 'time-only';
  } = {}
): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  const { includeDate = true, includeWeekday = true, format: formatType = 'short' } = options;

  if (formatType === 'time-only') {
    return formatInTimeZone(date, timezone, 'h:mm a');
  }

  if (formatType === 'long') {
    return formatInTimeZone(date, timezone, "EEEE, MMMM d, yyyy 'at' h:mm a");
  }

  if (includeWeekday && includeDate) {
    return formatInTimeZone(date, timezone, "EEE MMM d 'at' h:mm a");
  }
  
  if (includeDate) {
    return formatInTimeZone(date, timezone, "MMM d 'at' h:mm a");
  }
  
  return formatInTimeZone(date, timezone, 'h:mm a');
}

/**
 * Parse a local time string (e.g., from user input or booking UI) into UTC.
 * Use this when saving appointment times to the database.
 * 
 * @param localDateStr - The date/time string in tenant's local timezone
 * @param timezone - The tenant's timezone (e.g., 'America/Chicago')
 * @returns Date object in UTC
 */
export function parseTenantLocalToUtc(
  localDateStr: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const localDate = parseISO(localDateStr);
  return fromZonedTime(localDate, timezone);
}

/**
 * Convert a UTC date to the tenant's local timezone for display or manipulation.
 * 
 * @param utcDate - The date in UTC
 * @param timezone - The tenant's timezone
 * @returns Date object adjusted to the local timezone
 */
export function utcToTenantLocal(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, timezone);
}

/**
 * Set specific hours/minutes on a date in tenant's local timezone,
 * then return the result as UTC for database storage.
 * 
 * Useful for recurring scheduler when parsing "9:00 AM" preferred times.
 * 
 * IMPORTANT: This function preserves the calendar date from the input,
 * sets the specified local time, and converts to UTC. For example:
 * - Input: 2025-12-12 (any time), hours=9, minutes=0, timezone=America/Chicago
 * - Output: UTC time that represents 2025-12-12 09:00:00 America/Chicago
 * - Stored as: 2025-12-12T15:00:00Z (or 14:00:00Z during DST)
 * 
 * @param date - The base date (we extract year/month/day from this)
 * @param hours - Hour (0-23) in tenant's local timezone
 * @param minutes - Minutes (0-59)
 * @param timezone - The tenant's timezone
 * @returns Date object in UTC with the specified local time
 */
export function setLocalTimeAndConvertToUtc(
  date: Date,
  hours: number,
  minutes: number,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  // Extract the date components from the input date
  // We use the UTC date to get the calendar date (since nextScheduledDate is stored as date-only)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  
  // Construct an ISO-like string representing the local time
  // This represents "December 12, 2025 at 9:00 AM in America/Chicago"
  const localDateTimeStr = `${year}-${month}-${day}T${hoursStr}:${minutesStr}:00`;
  
  // Parse as if it were in the tenant's timezone, then convert to UTC
  // fromZonedTime interprets the input as being in the specified timezone
  const localDate = parseISO(localDateTimeStr);
  return fromZonedTime(localDate, timezone);
}

/**
 * Format a date for SMS messages - short and friendly format.
 * Example: "Thu Dec 12 at 9:00 AM"
 */
export function formatForSms(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatTenantLocalTime(utcDate, timezone, { format: 'short' });
}

/**
 * Format just the date portion (no time) for tenant's timezone.
 * Example: "December 12, 2024"
 */
export function formatDateOnly(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, timezone, 'MMMM d, yyyy');
}

/**
 * Format date for push notifications - includes weekday for context.
 * Example: "Thu, Dec 12, 9:00 AM"
 */
export function formatForPush(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, timezone, "EEE, MMM d, h:mm a");
}
