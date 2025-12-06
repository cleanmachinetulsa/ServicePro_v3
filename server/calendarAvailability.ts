import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './googleCalendarConnector';
import { criticalMonitor } from './criticalMonitoring';
import type { TenantDb } from './tenantDb';
import { businessSettings } from '@shared/schema';
import { addDays, addMonths, format, parse, startOfDay, endOfDay, addMinutes, isBefore, isAfter } from 'date-fns';

interface TimeSlot {
  start: string; // ISO 8601 datetime
  end: string;
  available: boolean;
  reason?: string; // If not available: 'booked', 'closed', 'outside_hours', 'conflict'
}

interface AvailabilityRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  serviceDurationMinutes: number;
  preferredTime?: string; // e.g., "9:00 AM"
}

interface CalendarDay {
  date: string; // YYYY-MM-DD
  isAvailable: boolean;
  reason?: string;
  timeSlots?: TimeSlot[];
}

export interface AvailabilityResult {
  days: CalendarDay[];
  usedSource: 'google_calendar' | 'internal_fallback';
  error?: string;
}

/**
 * Format hour and minute as 12-hour time string (e.g., "9:00 AM")
 */
function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Get business hours from settings
 */
async function getBusinessHours(tenantDb: TenantDb) {
  // NOTE: businessSettings is a GLOBAL table (no tenantId) - use db directly
  const { db } = await import('./db');
  const settings = await db.query.businessSettings.findFirst();
  
  if (!settings) {
    // Default business hours (matching schema defaults)
    return {
      start: '9:00 AM',
      end: '3:00 PM',
      lunchStart: '12:00 PM',
      lunchEnd: '1:00 PM',
      hasLunchBreak: true,
    };
  }

  return {
    start: formatTime(settings.startHour, settings.startMinute),
    end: formatTime(settings.endHour, settings.endMinute),
    lunchStart: formatTime(settings.lunchHour, settings.lunchMinute),
    lunchEnd: formatTime(settings.lunchHour + 1, settings.lunchMinute),
    hasLunchBreak: settings.enableLunchBreak,
  };
}

/**
 * Parse time string to 24-hour format
 */
function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const parsed = parse(timeStr, 'h:mm a', new Date());
  return {
    hour: parsed.getHours(),
    minute: parsed.getMinutes(),
  };
}

/**
 * Check if a datetime falls within business hours
 */
function isWithinBusinessHours(
  datetime: Date,
  businessHours: { start: string; end: string; lunchStart: string; lunchEnd: string; hasLunchBreak: boolean }
): boolean {
  const hour = datetime.getHours();
  const minute = datetime.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  const startTime = parseTimeString(businessHours.start);
  const endTime = parseTimeString(businessHours.end);
  const startMinutes = startTime.hour * 60 + startTime.minute;
  const endMinutes = endTime.hour * 60 + endTime.minute;

  // Check if within main business hours
  if (timeInMinutes < startMinutes || timeInMinutes >= endMinutes) {
    return false;
  }

  // Check lunch break if enabled
  if (businessHours.hasLunchBreak) {
    const lunchStart = parseTimeString(businessHours.lunchStart);
    const lunchEnd = parseTimeString(businessHours.lunchEnd);
    const lunchStartMinutes = lunchStart.hour * 60 + lunchStart.minute;
    const lunchEndMinutes = lunchEnd.hour * 60 + lunchEnd.minute;

    if (timeInMinutes >= lunchStartMinutes && timeInMinutes < lunchEndMinutes) {
      return false;
    }
  }

  return true;
}

/**
 * Result type for getCalendarEvents - explicitly communicates success/failure
 */
interface CalendarEventsResult {
  success: boolean;
  events: calendar_v3.Schema$Event[];
  error?: string;
}

/**
 * Fetch Google Calendar events for date range
 * Returns a result object instead of throwing - caller decides how to handle failures
 */
async function getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEventsResult> {
  try {
    const calendarService = await getGoogleCalendarClient();
    
    if (!calendarService) {
      console.log('[CALENDAR AVAILABILITY] Calendar service not initialized');
      await criticalMonitor.reportFailure('Google Calendar', 'Calendar service not initialized');
      return { success: false, events: [], error: 'Calendar service not initialized' };
    }

    // Use configured calendar ID for production consistency
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    
    const response = await calendarService.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    criticalMonitor.reportSuccess('Google Calendar');
    return { success: true, events: response.data.items || [] };
  } catch (error: any) {
    console.error('[CALENDAR AVAILABILITY] Error fetching calendar events:', error);
    await criticalMonitor.reportFailure('Google Calendar', error.message || 'Failed to fetch events');
    return { success: false, events: [], error: error.message || 'Failed to fetch events' };
  }
}

/**
 * Check if a time slot conflicts with existing events
 */
function hasConflict(
  slotStart: Date,
  slotEnd: Date,
  events: calendar_v3.Schema$Event[]
): { hasConflict: boolean; reason?: string } {
  for (const event of events) {
    if (!event.start || !event.end) continue;

    const eventStart = new Date(event.start.dateTime || event.start.date || '');
    const eventEnd = new Date(event.end.dateTime || event.end.date || '');

    // Check for overlap
    if (slotStart < eventEnd && slotEnd > eventStart) {
      return {
        hasConflict: true,
        reason: event.summary || 'Existing appointment',
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Generate time slots for a single day
 */
function generateDayTimeSlots(
  date: Date,
  serviceDurationMinutes: number,
  businessHours: { start: string; end: string; lunchStart: string; lunchEnd: string; hasLunchBreak: boolean },
  events: calendar_v3.Schema$Event[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startTime = parseTimeString(businessHours.start);
  const endTime = parseTimeString(businessHours.end);

  // Start from business opening
  let currentTime = new Date(date);
  currentTime.setHours(startTime.hour, startTime.minute, 0, 0);

  // Generate slots until end of day
  const dayEnd = new Date(date);
  dayEnd.setHours(endTime.hour, endTime.minute, 0, 0);

  while (isBefore(currentTime, dayEnd)) {
    const slotEnd = addMinutes(currentTime, serviceDurationMinutes);

    // Check if slot end exceeds business hours
    if (isAfter(slotEnd, dayEnd)) {
      break;
    }

    // Check if within business hours (including lunch break)
    const isWithinHours = isWithinBusinessHours(currentTime, businessHours);

    if (!isWithinHours) {
      slots.push({
        start: currentTime.toISOString(),
        end: slotEnd.toISOString(),
        available: false,
        reason: 'outside_hours',
      });
    } else {
      // Check for conflicts
      const conflict = hasConflict(currentTime, slotEnd, events);

      slots.push({
        start: currentTime.toISOString(),
        end: slotEnd.toISOString(),
        available: !conflict.hasConflict,
        reason: conflict.hasConflict ? 'conflict' : undefined,
      });
    }

    // Move to next slot (30-minute increments)
    currentTime = addMinutes(currentTime, 30);
  }

  return slots;
}

/**
 * Generate internal fallback slots based on business hours (no Google Calendar)
 */
function generateInternalFallbackDays(
  startDate: Date,
  endDate: Date,
  serviceDurationMinutes: number,
  businessHours: { start: string; end: string; lunchStart: string; lunchEnd: string; hasLunchBreak: boolean }
): CalendarDay[] {
  const calendarDays: CalendarDay[] = [];
  let currentDate = startDate;

  while (isBefore(currentDate, addDays(endDate, 1))) {
    if (currentDate.getDay() === 0) {
      calendarDays.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        isAvailable: false,
        reason: 'closed',
      });
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const timeSlots = generateDayTimeSlots(
      currentDate,
      serviceDurationMinutes,
      businessHours,
      []
    );

    const hasAvailableSlots = timeSlots.some(slot => slot.available);

    calendarDays.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      isAvailable: hasAvailableSlots,
      reason: hasAvailableSlots ? undefined : 'fully_booked',
      timeSlots,
    });

    currentDate = addDays(currentDate, 1);
  }

  return calendarDays;
}

/**
 * Get calendar availability for a date range - with graceful fallback
 * Never throws - always returns a valid result
 */
export async function getCalendarAvailability(
  tenantDb: TenantDb,
  request: AvailabilityRequest
): Promise<AvailabilityResult> {
  const startDate = parse(request.startDate, 'yyyy-MM-dd', new Date());
  const endDate = parse(request.endDate, 'yyyy-MM-dd', new Date());

  let businessHours: { start: string; end: string; lunchStart: string; lunchEnd: string; hasLunchBreak: boolean };
  
  try {
    businessHours = await getBusinessHours(tenantDb);
  } catch (err) {
    console.warn('[CALENDAR AVAILABILITY] Failed to get business hours, using defaults');
    businessHours = {
      start: '9:00 AM',
      end: '5:00 PM',
      lunchStart: '12:00 PM',
      lunchEnd: '1:00 PM',
      hasLunchBreak: true,
    };
  }

  // Try to get events from Google Calendar
  const calendarResult = await getCalendarEvents(
    startOfDay(startDate),
    endOfDay(endDate)
  );

  // If Google Calendar succeeded, use it
  if (calendarResult.success) {
    const calendarDays: CalendarDay[] = [];
    let currentDate = startDate;

    while (isBefore(currentDate, addDays(endDate, 1))) {
      if (currentDate.getDay() === 0) {
        calendarDays.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          isAvailable: false,
          reason: 'closed',
        });
        currentDate = addDays(currentDate, 1);
        continue;
      }

      const timeSlots = generateDayTimeSlots(
        currentDate,
        request.serviceDurationMinutes,
        businessHours,
        calendarResult.events
      );

      const hasAvailableSlots = timeSlots.some(slot => slot.available);

      calendarDays.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        isAvailable: hasAvailableSlots,
        reason: hasAvailableSlots ? undefined : 'fully_booked',
        timeSlots,
      });

      currentDate = addDays(currentDate, 1);
    }

    return {
      days: calendarDays,
      usedSource: 'google_calendar',
    };
  }

  // Google Calendar failed - use internal fallback
  {
    console.warn('[CALENDAR AVAILABILITY] Google Calendar unavailable, using internal fallback:', calendarResult.error);
  }

  console.log('[CALENDAR AVAILABILITY] Using internal fallback availability');
  const fallbackDays = generateInternalFallbackDays(
    startDate,
    endDate,
    request.serviceDurationMinutes,
    businessHours
  );

  return {
    days: fallbackDays,
    usedSource: 'internal_fallback',
    error: 'google_calendar_unavailable',
  };
}

/**
 * Legacy function for backward compatibility - returns CalendarDay[] directly
 */
export async function getCalendarAvailabilityLegacy(
  tenantDb: TenantDb,
  request: AvailabilityRequest
): Promise<CalendarDay[]> {
  const result = await getCalendarAvailability(tenantDb, request);
  return result.days;
}

/**
 * Check if specific dates are available
 */
export async function checkDatesAvailable(
  tenantDb: TenantDb,
  dates: string[], // Array of YYYY-MM-DD dates
  serviceDurationMinutes: number
): Promise<{ date: string; available: boolean; reason?: string }[]> {
  try {
    const businessHours = await getBusinessHours(tenantDb);
    const results: { date: string; available: boolean; reason?: string }[] = [];

    // Fetch events for the date range
    const parsedDates = dates.map(d => parse(d, 'yyyy-MM-dd', new Date()));
    const minDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));

    const calendarResult = await getCalendarEvents(
      startOfDay(minDate),
      endOfDay(maxDate)
    );

    // Use events if available, otherwise use empty array (internal fallback)
    const events = calendarResult.success ? calendarResult.events : [];

    // Check each date
    for (const dateStr of dates) {
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());

      // Check if Sunday
      if (date.getDay() === 0) {
        results.push({
          date: dateStr,
          available: false,
          reason: 'closed',
        });
        continue;
      }

      // Generate slots for the day
      const timeSlots = generateDayTimeSlots(
        date,
        serviceDurationMinutes,
        businessHours,
        events
      );

      const hasAvailableSlots = timeSlots.some(slot => slot.available);

      results.push({
        date: dateStr,
        available: hasAvailableSlots,
        reason: hasAvailableSlots ? undefined : 'fully_booked',
      });
    }

    return results;
  } catch (error) {
    console.error('[CALENDAR AVAILABILITY] Error checking dates:', error);
    throw new Error('Failed to check date availability');
  }
}
