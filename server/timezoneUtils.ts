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
 * @param date - The base date (typically in UTC)
 * @param hours - Hour (0-23)
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
  const zonedDate = toZonedTime(date, timezone);
  zonedDate.setHours(hours, minutes, 0, 0);
  return fromZonedTime(zonedDate, timezone);
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
