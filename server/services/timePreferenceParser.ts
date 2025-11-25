export interface NormalizedTimePreference {
  date: string | null;               // "YYYY-MM-DD"
  windowLabel: string | null;        // "morning" | "afternoon" | "evening" | "anytime" | null
  startTime: string | null;          // "HH:MM" 24h local
  endTime: string | null;            // "HH:MM" 24h local
}

/**
 * Normalize a conversational time preference like:
 * - "today"
 * - "tomorrow morning"
 * - "friday after 3"
 * - "next tuesday afternoon"
 *
 * into a concrete date + time window using a simple rule-based approach.
 *
 * Assumes local time zone; does not use external libraries.
 */
export function normalizeTimePreference(text: string, now: Date = new Date()): NormalizedTimePreference {
  if (!text) {
    return { date: null, windowLabel: null, startTime: null, endTime: null };
  }

  const raw = text.toLowerCase().trim();

  // Basic windows
  // You can fine-tune these time ranges later if needed.
  const WINDOWS = {
    morning: { start: '08:00', end: '12:00' },
    afternoon: { start: '12:00', end: '16:00' },
    evening: { start: '16:00', end: '19:00' },
    anytime: { start: '08:00', end: '17:00' },
  } as const;

  // Helper to format date as YYYY-MM-DD
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Basic date resolution
  let target = new Date(now.getTime());
  let matchedDate = false;

  if (raw.includes('today')) {
    matchedDate = true;
  } else if (raw.includes('tomorrow')) {
    target.setDate(target.getDate() + 1);
    matchedDate = true;
  } else {
    // Check weekday names within the next 14 days
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const foundIndex = weekdays.findIndex((day) => raw.includes(day));
    if (foundIndex !== -1) {
      // Move forward until we hit that weekday, within a reasonable window
      const searchLimitDays = 14;
      const probe = new Date(now.getTime());
      for (let i = 0; i < searchLimitDays; i++) {
        if (probe.getDay() === foundIndex) {
          target = probe;
          matchedDate = true;
          break;
        }
        probe.setDate(probe.getDate() + 1);
      }
    }
  }

  const date = matchedDate ? formatDate(target) : null;

  // Time window resolution
  let windowLabel: string | null = null;
  if (raw.includes('morning')) windowLabel = 'morning';
  else if (raw.includes('afternoon')) windowLabel = 'afternoon';
  else if (raw.includes('evening')) windowLabel = 'evening';
  else if (raw.includes('any') || raw.includes('whenever') || raw.includes('no preference')) {
    windowLabel = 'anytime';
  }

  // If they mention "before" or "after" a certain hour, you could expand this later.
  // For now we keep it simple and only use coarse windows.

  let startTime: string | null = null;
  let endTime: string | null = null;

  if (windowLabel && windowLabel in WINDOWS) {
    startTime = WINDOWS[windowLabel as keyof typeof WINDOWS].start;
    endTime = WINDOWS[windowLabel as keyof typeof WINDOWS].end;
  }

  // If we got a date but no explicit window, default to "anytime" business hours
  if (date && !windowLabel) {
    windowLabel = 'anytime';
    startTime = WINDOWS.anytime.start;
    endTime = WINDOWS.anytime.end;
  }

  return {
    date,
    windowLabel,
    startTime,
    endTime,
  };
}
