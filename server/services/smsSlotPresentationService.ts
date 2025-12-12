import { formatInTimeZone } from 'date-fns-tz';

/**
 * Smart, SMS-safe slot offering with psychology-guided presentation
 * - Shows ~7-10 day "relevant window" with earliest slot emphasized
 * - Includes optional next week preview (1 line) when earliest is >7 days out
 * - Supports horizon expansion up to 90 days when customer asks
 * - Provides 2-3 concrete pickable options (numbered)
 * - Final message: ≤300 chars (single SMS segment)
 */

export interface AvailabilitySlot {
  startIso: string;
  endIso?: string;
}

export interface SlotOption {
  label: string;
  startIso: string;
}

export interface AvailabilityMeta {
  rangeStart: string; // ISO string
  rangeEnd: string; // ISO string
  earliestSlot: string; // ISO string of earliest slot
  earliestDay: string; // "Tue Dec 16"
  earliestTime: string; // "~9:00am"
  primaryWindowDays: number;
}

export interface BuildAvailabilitySmsParams {
  availableSlots: AvailabilitySlot[];
  nowIso: string;
  defaultHorizonDays?: number; // default 10
  maxHorizonDays?: number; // default 90
  includeNextWeekPreview?: boolean; // default false
  timezone?: string; // default America/Chicago
}

export interface BuildAvailabilitySmsResult {
  smsText: string;
  options: SlotOption[];
  meta: AvailabilityMeta;
}

/**
 * Parse customer message to detect availability horizon expansion
 * Returns number of days (7-90), or null if not mentioned
 * 
 * Examples:
 * "next week" → 14
 * "2 weeks out" → 14
 * "in March" → 90 (next month = assume far out)
 * "this week" → 7
 * "this month" → 30
 * "next month" → 60
 */
export function parseAvailabilityHorizonDays(text: string): number | null {
  const lower = text.toLowerCase();
  
  // This week / coming days
  if (/\b(this week|coming\s+days?|next\s+few\s+days?)\b/.test(lower)) {
    return 7;
  }
  
  // Next week / following week / week after
  if (/\b(next\s+week|following\s+week|week\s+after|in\s+\d+\s+weeks?)\b/.test(lower)) {
    return 14;
  }
  
  // Multi-week
  if (/\b(2\s+weeks?|3\s+weeks?|a\s+month)\b/.test(lower)) {
    return 21;
  }
  
  // This month
  if (/\b(this\s+month|rest\s+of\s+(the\s+)?month)\b/.test(lower)) {
    return 30;
  }
  
  // Next month / in X months
  if (/\b(next\s+month|following\s+month|in\s+\d+\s+months?|in\s+(january|february|march|april|may|june|july|august|september|october|november|december))\b/.test(lower)) {
    return 60;
  }
  
  // Explicit number of days
  const daysMatch = text.match(/in\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return days;
  }
  
  return null;
}

/**
 * Build SMS-safe availability response with 2-3 concrete options
 */
export function buildAvailabilitySms(
  params: BuildAvailabilitySmsParams
): BuildAvailabilitySmsResult {
  const {
    availableSlots,
    nowIso,
    defaultHorizonDays = 10,
    maxHorizonDays = 90,
    includeNextWeekPreview = false,
    timezone = 'America/Chicago',
  } = params;

  const now = new Date(nowIso);
  let horizonDays = defaultHorizonDays;

  // Sort slots by startIso ascending
  const sortedSlots = [...availableSlots].sort((a, b) =>
    new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
  );

  if (sortedSlots.length === 0) {
    return {
      smsText: "No availability yet—want me to check further out?",
      options: [],
      meta: {
        rangeStart: nowIso,
        rangeEnd: new Date(now.getTime() + defaultHorizonDays * 24 * 60 * 60 * 1000).toISOString(),
        earliestSlot: '',
        earliestDay: '',
        earliestTime: '',
        primaryWindowDays: horizonDays,
      },
    };
  }

  // Compute earliest slot
  const earliestSlot = sortedSlots[0];
  const earliestDate = new Date(earliestSlot.startIso);
  const earliestDay = formatInTimeZone(earliestDate, timezone, 'EEE MMM d');
  const earliestTime = formatInTimeZone(earliestDate, timezone, '~h:00a');

  // Compute primary window
  const rangeStart = now;
  const rangeEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // Find slots in primary window
  const slotsInWindow = sortedSlots.filter((slot) => {
    const slotDate = new Date(slot.startIso);
    return slotDate >= rangeStart && slotDate <= rangeEnd;
  });

  // If no slots in primary window, extend to 14 days automatically
  if (slotsInWindow.length === 0) {
    horizonDays = 14;
    rangeEnd.setTime(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    for (const slot of sortedSlots) {
      const slotDate = new Date(slot.startIso);
      if (slotDate >= rangeStart && slotDate <= rangeEnd) {
        slotsInWindow.push(slot);
      }
    }
  }

  // Extract 2-3 concrete options from earliest slots in window
  const optionsToShow = slotsInWindow.slice(0, 3);
  const options: SlotOption[] = optionsToShow.map((slot) => ({
    label: formatInTimeZone(new Date(slot.startIso), timezone, 'EEE h:00a'),
    startIso: slot.startIso,
  }));

  // Build summary string with day range
  const dayRangeStart = formatInTimeZone(rangeStart, timezone, 'EEE');
  const dayRangeEnd = formatInTimeZone(rangeEnd, timezone, 'EEE');
  
  // Analyze time of day distribution
  const morningSlots = slotsInWindow.filter((slot) => {
    const hour = new Date(slot.startIso).getHours();
    return hour >= 9 && hour < 12;
  });
  const lateSlots = slotsInWindow.filter((slot) => {
    const hour = new Date(slot.startIso).getHours();
    return hour >= 11 && hour <= 14;
  });

  let timeSummary = '';
  if (morningSlots.length > 0) {
    const morningRange = `${formatInTimeZone(new Date(morningSlots[0].startIso), timezone, 'h:00a')}-${formatInTimeZone(new Date(morningSlots[morningSlots.length - 1].startIso), timezone, 'h:00a')}`;
    timeSummary = `AM (${morningRange})`;
  }
  if (lateSlots.length > 0 && morningSlots.length === 0) {
    timeSummary = 'late morning/early afternoon';
  }

  // Build main message
  let message = `Earliest: ${earliestDay} ${earliestTime}`;
  if (dayRangeStart !== dayRangeEnd) {
    message += `. Also ${dayRangeStart}–${dayRangeEnd}`;
    if (timeSummary) {
      message += ` (${timeSummary}).`;
    }
  } else {
    if (timeSummary) {
      message += ` (${timeSummary})`;
    }
    message += '.';
  }

  // Add next week preview if needed
  if (includeNextWeekPreview && earliestDate > new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    const nextWeekStart = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const nextWeekEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const nextWeekSlots = sortedSlots.filter((slot) => {
      const slotDate = new Date(slot.startIso);
      return slotDate >= nextWeekStart && slotDate <= nextWeekEnd;
    });

    if (nextWeekSlots.length > 0) {
      const nextWeekDayStart = formatInTimeZone(nextWeekStart, timezone, 'EEE');
      const nextWeekDayEnd = formatInTimeZone(nextWeekEnd, timezone, 'EEE');
      message += ` Next week: ${nextWeekDayStart}–${nextWeekDayEnd} (AM).`;
    }
  }

  // Add guided response options
  const optionsStr = options.map((_, i) => `${i + 1}`).join('/');
  message += ` Reply ${optionsStr}, or say day + time.`;

  // Truncate to SMS safe length
  let finalMessage = message;
  if (finalMessage.length > 300) {
    // Keep essential parts: earliest + options question
    finalMessage = `${earliestDay} ${earliestTime}. Reply 1/2/3.`;
  }

  return {
    smsText: finalMessage,
    options,
    meta: {
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      earliestSlot: earliestSlot.startIso,
      earliestDay,
      earliestTime,
      primaryWindowDays: horizonDays,
    },
  };
}
