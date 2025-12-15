/**
 * Centralized booking status definitions
 * Used consistently across Bookings Inbox UI and server logic
 */

export type BookingStatus = 
  | "CONFIRMED" 
  | "PENDING" 
  | "AWAITING_CONFIRM" 
  | "NEEDS_HUMAN" 
  | "ABANDONED";

export interface BookingStatusMeta {
  label: string;
  colorClass: string;
  sortPriority: number;
}

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  CONFIRMED: {
    label: "Confirmed",
    colorClass: "bg-green-500 text-white",
    sortPriority: 1, // Highest priority - show first
  },
  NEEDS_HUMAN: {
    label: "Needs Human",
    colorClass: "bg-red-500 text-white",
    sortPriority: 2, // Second highest - errors need attention
  },
  AWAITING_CONFIRM: {
    label: "Awaiting Confirm",
    colorClass: "bg-amber-500 text-white",
    sortPriority: 3,
  },
  PENDING: {
    label: "Pending",
    colorClass: "bg-yellow-500 text-white",
    sortPriority: 4,
  },
  ABANDONED: {
    label: "Abandoned",
    colorClass: "bg-gray-400 text-white",
    sortPriority: 5, // Lowest priority
  },
};

export const ALL_BOOKING_STATUSES = Object.keys(BOOKING_STATUS_META) as BookingStatus[];

/**
 * Derives the booking status from a booking record
 * Priority logic:
 * 1. If appointmentId && calendarEventId → CONFIRMED
 * 2. Else if needsHumanAttention=true → NEEDS_HUMAN
 * 3. Else if stage === "awaiting_confirm" || stage === "booked" → AWAITING_CONFIRM
 * 4. Else if status === "closed" && !bookingId → ABANDONED
 * 5. Else → PENDING
 */
export function deriveBookingStatus(record: {
  bookingId: number | null;
  calendarEventId: string | null;
  needsHumanAttention?: boolean;
  needsHuman?: boolean;
  lastErrorCode?: string | null;
  stage?: string | null;
  status?: string | null;
}): BookingStatus {
  // Priority 1: CONFIRMED - both booking and calendar event linked
  if (record.bookingId && record.calendarEventId) {
    return "CONFIRMED";
  }

  // Priority 2: NEEDS_HUMAN - if marked as needing attention or has errors
  if (record.needsHumanAttention || record.needsHuman || record.lastErrorCode) {
    return "NEEDS_HUMAN";
  }

  // Priority 3: AWAITING_CONFIRM - in confirmation stage
  if (record.stage === "awaiting_confirm" || record.stage === "booked") {
    return "AWAITING_CONFIRM";
  }

  // Priority 4: ABANDONED - closed without booking
  if (record.status === "closed" && !record.bookingId) {
    return "ABANDONED";
  }

  // Default: PENDING - still in progress
  return "PENDING";
}
