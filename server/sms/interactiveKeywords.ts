/**
 * SMS Interactive Keywords Handler
 * 
 * Centralizes handling of standard SMS command keywords (RESCHEDULE, CANCEL, KEEP)
 * for consistent behavior across inbound SMS flows.
 */

export const SMS_KEYWORDS = {
  RESCHEDULE: "RESCHEDULE",
  CANCEL: "CANCEL",
  KEEP: "KEEP",
} as const;

export type SmsKeyword = typeof SMS_KEYWORDS[keyof typeof SMS_KEYWORDS];

/**
 * Normalize incoming SMS body to detect standard keywords
 * Returns the matched keyword or null if no match
 */
export function normalizeIncomingSmsKeyword(body: string): SmsKeyword | null {
  if (!body) return null;
  
  const normalized = body.trim().toUpperCase();
  
  if (normalized === "RESCHEDULE") return SMS_KEYWORDS.RESCHEDULE;
  if (normalized === "CANCEL") return SMS_KEYWORDS.CANCEL;
  if (normalized === "KEEP") return SMS_KEYWORDS.KEEP;
  
  return null;
}
