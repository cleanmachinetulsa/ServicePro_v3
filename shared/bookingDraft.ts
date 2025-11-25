export interface BookingDraft {
  conversationId: number;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  address: string | null;
  serviceName: string | null;
  serviceId: number | null;

  /**
   * Normalized date string in ISO format: "YYYY-MM-DD"
   * e.g. 2025-11-24
   */
  preferredDate: string | null;

  /**
   * Human-friendly label for the time window
   * e.g. "morning", "afternoon", "evening", "anytime", or null
   */
  preferredTimeWindow: string | null;

  /**
   * Raw time preference text from the conversation
   * e.g. "tomorrow morning", "next Friday after 3"
   */
  rawTimePreference?: string | null;

  /**
   * Optional normalized start/end time (local time, 24h "HH:MM" format)
   * e.g. "09:00", "12:00", etc.
   */
  normalizedStartTime?: string | null;
  normalizedEndTime?: string | null;

  vehicleSummary: string | null;
  notes: string | null;

  /**
   * AI-generated notes derived from conversation context.
   * Example:
   * - "Customer mentioned pet hair in back seat."
   * - "Spill on passenger floor mat."
   * - "Needs ASAP, prefers morning. Will leave keys in cupholder."
   * These are optional and fully editable in BookingPanel.
   */
  aiSuggestedNotes?: string | null;

  /**
   * Route-optimized booking suggestion based on location and nearby jobs
   * Helps minimize travel time and maximize efficiency
   */
  routeSuggestion?: import('@shared/routeOptimization').RouteSuggestion | null;
}
