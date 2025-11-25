export interface RouteSuggestion {
  reason: string;
  suggestedDate: string | null;     // ISO date
  suggestedStart: string | null;    // "HH:MM"
  suggestedEnd: string | null;      // "HH:MM"
  confidence: number;               // 0–1
  nearbyJobIds?: number[];          // IDs of nearby bookings
  travelMinutes: number | null;
}
