import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './googleCalendarConnector';
import { db } from './db';
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

/**
 * Get business hours from settings
 */
async function getBusinessHours() {
  const [settings] = await db.select().from(businessSettings).limit(1);
  
  if (!settings) {
    // Default business hours
    return {
      start: '8:00 AM',
      end: '5:00 PM',
      lunchStart: '12:00 PM',
      lunchEnd: '1:00 PM',
      hasLunchBreak: true,
    };
  }

  return {
    start: '8:00 AM', // TODO: Add to business settings schema
    end: '5:00 PM',
    lunchStart: settings.lunchBreakStart || '12:00 PM',
    lunchEnd: settings.lunchBreakEnd || '1:00 PM',
    hasLunchBreak: settings.lunchBreakEnabled || false,
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
 * Fetch Google Calendar events for date range
 */
async function getCalendarEvents(startDate: Date, endDate: Date): Promise<calendar_v3.Schema$Event[]> {
  try {
    const calendarService = await getGoogleCalendarClient();
    
    if (!calendarService) {
      console.log('[CALENDAR AVAILABILITY] Calendar service not initialized');
      return [];
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

    return response.data.items || [];
  } catch (error) {
    console.error('[CALENDAR AVAILABILITY] Error fetching calendar events:', error);
    return [];
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
 * Get calendar availability for a date range
 */
export async function getCalendarAvailability(
  request: AvailabilityRequest
): Promise<CalendarDay[]> {
  try {
    const startDate = parse(request.startDate, 'yyyy-MM-dd', new Date());
    const endDate = parse(request.endDate, 'yyyy-MM-dd', new Date());

    // Get business hours
    const businessHours = await getBusinessHours();

    // Fetch calendar events
    const events = await getCalendarEvents(
      startOfDay(startDate),
      endOfDay(endDate)
    );

    // Generate availability for each day
    const calendarDays: CalendarDay[] = [];
    let currentDate = startDate;

    while (isBefore(currentDate, addDays(endDate, 1))) {
      // Skip Sundays (0 = Sunday)
      if (currentDate.getDay() === 0) {
        calendarDays.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          isAvailable: false,
          reason: 'closed',
        });
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // Generate time slots for the day
      const timeSlots = generateDayTimeSlots(
        currentDate,
        request.serviceDurationMinutes,
        businessHours,
        events
      );

      // Check if any slots are available
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
  } catch (error) {
    console.error('[CALENDAR AVAILABILITY] Error generating availability:', error);
    throw new Error('Failed to generate calendar availability');
  }
}

/**
 * Check if specific dates are available
 */
export async function checkDatesAvailable(
  dates: string[], // Array of YYYY-MM-DD dates
  serviceDurationMinutes: number
): Promise<{ date: string; available: boolean; reason?: string }[]> {
  try {
    const businessHours = await getBusinessHours();
    const results: { date: string; available: boolean; reason?: string }[] = [];

    // Fetch events for the date range
    const parsedDates = dates.map(d => parse(d, 'yyyy-MM-dd', new Date()));
    const minDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));

    const events = await getCalendarEvents(
      startOfDay(minDate),
      endOfDay(maxDate)
    );

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
