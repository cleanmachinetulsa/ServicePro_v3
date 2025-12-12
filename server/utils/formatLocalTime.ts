/**
 * Format appointment time to local "America/Chicago" time
 * Output: "Sat Dec 13 at 9:00 AM"
 */
export function formatApptLocal(input: any): string {
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return String(input);
    
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(d);
    
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    
    // Format: "Sat Dec 13 at 9:00 AM"
    return `${get("weekday")} ${get("month")} ${get("day")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")}`.replace("  ", " ");
  } catch {
    return String(input);
  }
}
