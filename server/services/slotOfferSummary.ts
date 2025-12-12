import { formatInTimeZone } from 'date-fns-tz';

/**
 * Compact slot summarizer for SMS - intelligently compresses 7-14 day availability into ~2-3 lines
 * 
 * Strategy:
 * 1. Pick earliest slot => "Best: <Day> <time>"
 * 2. Look 7 days ahead for patterns:
 *    - If 2+ days share similar start windows, compress to range: "Tue–Thu starts 9–10am"
 *    - If scattered, show 2-3 additional examples: "Wed 2pm, Fri 10am, etc."
 * 3. Add guidance line: "Tell me if you need a different day/time"
 * 4. Hard SMS length cap
 * 5. Deduplicate slot strings
 */

export interface CompactSlot {
  isoStart: string;
  isoEnd?: string;
}

export interface SlotSummary {
  summary: string; // Compact 2-4 line SMS-safe string
  examples: Array<{ label: string; iso: string }>; // Pickable options
}

/**
 * Format a time as "~9am" or "~2:30pm" for SMS readability
 */
function formatTimeCompact(iso: string, timezone: string): string {
  const hour = formatInTimeZone(new Date(iso), timezone, 'H');
  const min = formatInTimeZone(new Date(iso), timezone, 'm');
  const hourNum = parseInt(hour, 10);
  const minNum = parseInt(min, 10);
  
  // If no minutes or :00, just show hour
  if (minNum === 0) {
    const ampm = hourNum >= 12 ? 'pm' : 'am';
    const display = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
    return `${display}${ampm}`;
  }
  
  // Show with minutes
  const ampm = hourNum >= 12 ? 'pm' : 'am';
  const display = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
  return `${display}:${minNum < 10 ? '0' : ''}${minNum}${ampm}`;
}

/**
 * Format day as "Mon Dec 16" for SMS
 */
function formatDayCompact(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, 'EEE MMM d');
}

/**
 * Summarize available slots into compact SMS format
 */
export function summarizeSlots(
  slots: CompactSlot[],
  timezone: string = 'America/Chicago'
): SlotSummary {
  if (slots.length === 0) {
    return {
      summary: "No availability yet. Want me to check further out?",
      examples: [],
    };
  }

  // Remove duplicates by ISO string
  const uniqueSlots = Array.from(
    new Map(slots.map(s => [s.isoStart, s])).values()
  );

  // Sort by earliest
  const sorted = [...uniqueSlots].sort((a, b) =>
    new Date(a.isoStart).getTime() - new Date(b.isoStart).getTime()
  );

  const now = new Date();
  const earliest = new Date(sorted[0].isoStart);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Split into this week and next week
  const thisWeek = sorted.filter(s => new Date(s.isoStart) <= weekAhead);
  const nextWeek = sorted.filter(
    s => new Date(s.isoStart) > weekAhead && new Date(s.isoStart) <= twoWeeksAhead
  );

  // Build examples list (pick best variety)
  const examples: Array<{ label: string; iso: string }> = [];
  
  // Always include earliest
  const earliestDay = formatDayCompact(earliest.toISOString(), timezone);
  const earliestTime = formatTimeCompact(earliest.toISOString(), timezone);
  examples.push({
    label: `${earliestDay} ${earliestTime}`,
    iso: earliest.toISOString(),
  });

  // Add 2-3 more strategic examples from diverse slots
  const seen = new Set([earliest.toISOString()]);
  const candidates = sorted.slice(1).filter(s => !seen.has(s.isoStart));

  // Prefer different days in this week, then next week
  let added = 0;
  for (const slot of candidates) {
    if (added >= 2) break; // Max 2 more examples
    const slotDate = new Date(slot.isoStart);
    const day = formatDayCompact(slot.isoStart, timezone);
    const time = formatTimeCompact(slot.isoStart, timezone);
    
    // Skip if we already have this exact day from examples
    const dayMatch = examples.find(ex => ex.label.startsWith(day));
    if (!dayMatch) {
      examples.push({
        label: `${day} ${time}`,
        iso: slot.isoStart,
      });
      seen.add(slot.isoStart);
      added++;
    }
  }

  // Detect patterns in this week for compression
  let patternLine = '';
  if (thisWeek.length >= 2) {
    // Group by hour
    const hourGroups = new Map<number, { day: string; iso: string }[]>();
    thisWeek.forEach(slot => {
      const hour = parseInt(
        formatInTimeZone(new Date(slot.isoStart), timezone, 'H'),
        10
      );
      if (!hourGroups.has(hour)) {
        hourGroups.set(hour, []);
      }
      hourGroups.get(hour)!.push({
        day: formatInTimeZone(new Date(slot.isoStart), timezone, 'EEE'),
        iso: slot.isoStart,
      });
    });

    // If we have multiple days at similar times, create a range
    for (const [hour, slotList] of hourGroups) {
      if (slotList.length >= 2) {
        const days = slotList.map(s => s.day);
        const uniqueDays = Array.from(new Set(days));
        if (uniqueDays.length >= 2) {
          const minHour = hour;
          const maxHour = hour + 1; // Approximate window
          const ampm = hour >= 12 ? 'pm' : 'am';
          const minDisplay = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
          const maxDisplay = maxHour > 12 ? maxHour - 12 : (maxHour === 0 ? 12 : maxHour);
          const dayRange = `${uniqueDays[0]}–${uniqueDays[uniqueDays.length - 1]}`;
          patternLine = `Available ${dayRange} around ${minDisplay}${ampm}. `;
          break;
        }
      }
    }
  }

  // Build compact summary
  const lines: string[] = [];

  // Line 1: Best option
  lines.push(`Best: ${earliestDay} at ${earliestTime}`);

  // Line 2: Pattern or extra examples
  if (patternLine) {
    lines.push(patternLine);
  } else if (examples.length > 1) {
    const exampleStrs = examples.slice(1, 3).map(ex => ex.label).join(", ");
    lines.push(`Also available: ${exampleStrs}`);
  }

  // Line 3: Guidance
  lines.push("Tell me if you need a different day or time.");

  const summary = lines.join(" ");

  return { summary, examples };
}

/**
 * Helper: Get SMS-safe slot summary with length cap
 */
export function getCompactSlotsSms(
  slots: CompactSlot[],
  timezone: string = 'America/Chicago',
  truncator?: (text: string) => string
): string {
  const { summary } = summarizeSlots(slots, timezone);
  
  // Apply truncation if provided (uses truncateSmsResponse logic)
  if (truncator) {
    return truncator(summary);
  }
  
  // Fallback: simple length cap at 300 chars (2 SMS segments)
  return summary.length > 300 ? summary.substring(0, 297) + "..." : summary;
}
