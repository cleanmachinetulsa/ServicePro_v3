import { formatInTimeZone } from 'date-fns-tz';

/**
 * Get tenant timezone from config or environment
 */
export function getTenantTimeZone(tenant?: any): string {
  return tenant?.timezone || process.env.DEFAULT_TIMEZONE || 'America/Chicago';
}

/**
 * Format a date/ISO string to human-readable local time
 * Examples: "Sat Dec 13 at 9:00 AM", "Fri Dec 12 at 12:46 PM"
 */
export function formatLocalDateTime(
  date: Date | string,
  tz: string,
  style: 'short' | 'long' = 'long'
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      console.warn('[TIMEZONE] Invalid date:', date);
      return 'Invalid date';
    }
    
    if (style === 'short') {
      // "Dec 13 at 9am"
      return formatInTimeZone(dateObj, tz, 'MMM d \'at\' h:mma');
    }
    
    // "Sat Dec 13 at 9:00 AM"
    return formatInTimeZone(dateObj, tz, 'EEE MMM d \'at\' h:mm a');
  } catch (error) {
    console.error('[TIMEZONE] Format error:', error);
    // Fallback: try basic formatting
    try {
      return dateObj.toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return 'Time unavailable';
    }
  }
}

/**
 * Format for SMS (ultra-compact): "Fri 2pm" or "Fri 2:30pm"
 */
export function formatSmsTime(date: Date | string, tz: string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const min = formatInTimeZone(dateObj, tz, 'm');
    const minNum = parseInt(min, 10);
    
    // If minutes are :00, just show hour
    if (minNum === 0) {
      return formatInTimeZone(dateObj, tz, 'EEE h:mma');
    }
    
    return formatInTimeZone(dateObj, tz, 'EEE h:mma');
  } catch (error) {
    console.error('[TIMEZONE] SMS format error:', error);
    return 'time';
  }
}
