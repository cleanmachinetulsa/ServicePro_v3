import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, customers, services } from '@shared/schema';
import type { BookingDraft } from '@shared/bookingDraft';
import { eq } from 'drizzle-orm';
import { conversationState } from '../conversationState';
import { normalizeTimePreference } from './timePreferenceParser';
import { resolveServiceFromNaturalText } from './serviceNameResolver';
import { findOrCreateVehicleCard } from './vehicleCardService';
import { extractNotesFromConversationState } from './notesExtractor';
import { generateRouteSuggestion } from './routeOptimizer';
import { geocodeAddress } from './geocodeService';
import { evaluateServiceArea } from './serviceAreaEvaluator';

/**
 * SMS Booking State - persisted in behaviorSettings.smsBookingState
 * Tracks slot offerings and selections to prevent "looping" behavior
 */
export interface SmsBookingState {
  service?: string;
  vehicle?: string;
  address?: string;
  needsPower?: boolean;
  needsWater?: boolean;
  lastOfferedSlots?: Array<{ label: string; iso?: string }>;
  chosenSlotLabel?: string;
  chosenSlotIso?: string;
  stage?: string; // 'selecting_service', 'confirming_address', 'choosing_slot', 'booked'
  lastResetReason?: string; // For tracking why state was reset
  lastResetTimestamp?: number; // For detecting stale bookings
  // Session tracking - prevents old history from poisoning new bookings
  bookingSessionId?: string;
  bookingSessionStartedAt?: number; // Unix timestamp - only include messages after this
  verifiedAddressPhone?: string; // Phone that confirmed the address - preserve if recent
  verifiedAddressTimestamp?: number; // When address was last confirmed
  // Availability horizon expansion (for smart slot presentation)
  horizonDays?: number; // Default 10, max 90. Set by parseAvailabilityHorizonDays
  lastAvailabilityMeta?: Record<string, any>; // Store minimal meta like rangeStart, rangeEnd, earliestIso
}

interface HistoryMessage {
  sender: string;
  content: string;
  metadata?: Record<string, any> | null;
}

// Time patterns for slot selection
const TIME_PATTERNS = [
  { pattern: /\b9\s*(?:am|:00\s*am?|oclock|o'clock)?\b/i, hour: 9 },
  { pattern: /\b10\s*(?:am|:00\s*am?|oclock|o'clock)?\b/i, hour: 10 },
  { pattern: /\b11\s*(?:am|:00\s*am?|oclock|o'clock)?\b/i, hour: 11 },
  { pattern: /\b(?:12|noon)\s*(?:pm|:00\s*pm?|oclock|o'clock)?\b/i, hour: 12 },
  { pattern: /\b1\s*(?:pm|:00\s*pm?|oclock|o'clock)?\b/i, hour: 13 },
  { pattern: /\b2\s*(?:pm|:00\s*pm?|oclock|o'clock)?\b/i, hour: 14 },
  { pattern: /\b3\s*(?:pm|:00\s*pm?|oclock|o'clock)?\b/i, hour: 15 },
  { pattern: /\b4\s*(?:pm|:00\s*pm?|oclock|o'clock)?\b/i, hour: 16 },
];

/**
 * Detect if user text is selecting one of the previously offered slots
 */
export function detectSlotSelection(userText: string, state: SmsBookingState): { chosenSlotLabel: string; chosenSlotIso?: string } | null {
  if (!state.lastOfferedSlots || state.lastOfferedSlots.length === 0) {
    return null;
  }
  
  const text = userText.toLowerCase().trim();
  
  // Check for direct time mentions (e.g., "9am", "10:00", "1pm")
  let matchedHour: number | null = null;
  for (const { pattern, hour } of TIME_PATTERNS) {
    if (pattern.test(text)) {
      matchedHour = hour;
      break;
    }
  }
  
  // If we found a time, try to match it against offered slots
  if (matchedHour !== null) {
    const hourStr = matchedHour > 12 ? `${matchedHour - 12}` : `${matchedHour}`;
    const amPm = matchedHour >= 12 ? 'pm' : 'am';
    
    for (const slot of state.lastOfferedSlots) {
      const slotLower = slot.label.toLowerCase();
      
      // Check if slot contains this hour
      const hourPatterns = [
        `${hourStr}:00 ${amPm}`,
        `${hourStr} ${amPm}`,
        `${hourStr}:00${amPm}`,
        `${hourStr}${amPm}`,
      ];
      
      const matchesHour = hourPatterns.some(hp => slotLower.includes(hp));
      
      if (matchesHour) {
        return { chosenSlotLabel: slot.label, chosenSlotIso: slot.iso };
      }
    }
  }
  
  // Check for ordinal selection (e.g., "the first one", "second option")
  if (/\b(first|1st|option\s*1)\b/i.test(text)) {
    return { chosenSlotLabel: state.lastOfferedSlots[0].label, chosenSlotIso: state.lastOfferedSlots[0].iso };
  }
  if (/\b(second|2nd|option\s*2)\b/i.test(text) && state.lastOfferedSlots.length > 1) {
    return { chosenSlotLabel: state.lastOfferedSlots[1].label, chosenSlotIso: state.lastOfferedSlots[1].iso };
  }
  if (/\b(third|3rd|option\s*3)\b/i.test(text) && state.lastOfferedSlots.length > 2) {
    return { chosenSlotLabel: state.lastOfferedSlots[2].label, chosenSlotIso: state.lastOfferedSlots[2].iso };
  }
  
  // Check for affirmative responses when only one slot was offered
  if (state.lastOfferedSlots.length === 1) {
    if (/\b(yes|yeah|yep|sure|ok|okay|perfect|great|sounds\s*good|that\s*works|works\s*for\s*me)\b/i.test(text)) {
      return { chosenSlotLabel: state.lastOfferedSlots[0].label, chosenSlotIso: state.lastOfferedSlots[0].iso };
    }
  }
  
  return null;
}

/**
 * Extract slot labels from an assistant message that listed availability
 */
export function extractSlotsFromMessage(content: string): Array<{ label: string; iso?: string }> {
  const slots: Array<{ label: string; iso?: string }> = [];
  
  // Pattern to match slot listings like:
  // "Saturday, December 14 at 9:00 AM"
  // "Sat Dec 14 at 9am"
  // "December 14th at 10:00 AM"
  const slotPattern = /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*)?(?:December|January|February|March|April|May|June|July|August|September|October|November|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov)\s+\d{1,2}(?:st|nd|rd|th)?\s*(?:at|@)?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)/gi;
  
  const matches = content.match(slotPattern);
  if (matches) {
    for (const match of matches) {
      slots.push({ label: match.trim() });
    }
  }
  
  // Also try simpler time patterns if message mentions specific times with "available"
  if (slots.length === 0 && content.toLowerCase().includes('available')) {
    const timeOnlyPattern = /\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b/gi;
    const timeMatches = content.match(timeOnlyPattern);
    if (timeMatches && timeMatches.length > 0) {
      for (const match of timeMatches) {
        slots.push({ label: match.trim() });
      }
    }
  }
  
  return slots;
}

/**
 * Extract SMS booking state from conversation history
 */
export function extractSmsBookingStateFromHistory(historyMessages: HistoryMessage[]): SmsBookingState {
  const state: SmsBookingState = {};
  
  // Service keywords mapping
  const SERVICE_PATTERNS: Array<{ pattern: RegExp; service: string }> = [
    { pattern: /\b(full\s*detail|full\s*service)\b/i, service: 'Full Detail' },
    { pattern: /\b(interior\s*detail|interior\s*only|inside\s*only|interior)\b/i, service: 'Interior Detail' },
    { pattern: /\b(exterior|outside\s*only|wash\s*and\s*wax)\b/i, service: 'Exterior Detail' },
    { pattern: /\b(premium\s*wash)\b/i, service: 'Premium Wash' },
    { pattern: /\b(maintenance\s*detail|maintenance\s*program)\b/i, service: 'Maintenance Detail' },
    { pattern: /\b(ceramic\s*coat)/i, service: 'Ceramic Coating' },
    { pattern: /\b(paint\s*correction|polish)/i, service: 'Paint Enhancement' },
  ];

  // Vehicle pattern: year make model or make model year
  const VEHICLE_PATTERN = /\b(20\d{2}|19\d{2})?\s*([A-Za-z]{2,})\s+([A-Za-z0-9]{2,})\s*(20\d{2}|19\d{2})?\b/i;

  // Address pattern: number + street name (loose match)
  const ADDRESS_PATTERN = /\b(\d{2,5})\s+([A-Za-z0-9\s]{3,40})\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|cir|circle)\b/i;
  
  for (const msg of historyMessages) {
    const content = msg.content || '';
    const isCustomer = msg.sender === 'customer';
    
    // Extract service from customer messages
    if (isCustomer && !state.service) {
      for (const { pattern, service } of SERVICE_PATTERNS) {
        if (pattern.test(content)) {
          state.service = service;
          break;
        }
      }
    }
    
    // Extract vehicle from customer messages
    if (isCustomer && !state.vehicle) {
      const vehicleMatch = content.match(VEHICLE_PATTERN);
      if (vehicleMatch) {
        const year = vehicleMatch[1] || vehicleMatch[4] || '';
        const make = vehicleMatch[2];
        const model = vehicleMatch[3];
        state.vehicle = `${year} ${make} ${model}`.trim();
      }
    }
    
    // Extract address from customer messages
    if (isCustomer && !state.address) {
      const addressMatch = content.match(ADDRESS_PATTERN);
      if (addressMatch) {
        state.address = addressMatch[0];
      }
    }
    
    // Check for power/water mentions
    if (isCustomer) {
      if (/\b(power|outlet|electric|plug)\b/i.test(content)) {
        if (/\b(yes|have|got|available)\b/i.test(content)) {
          state.needsPower = true;
        } else if (/\b(no|don't|dont|not)\b/i.test(content)) {
          state.needsPower = false;
        }
      }
      if (/\b(water|hose|spigot)\b/i.test(content)) {
        if (/\b(yes|have|got|available)\b/i.test(content)) {
          state.needsWater = true;
        } else if (/\b(no|don't|dont|not)\b/i.test(content)) {
          state.needsWater = false;
        }
      }
    }
    
    // Extract offered slots from assistant messages
    if (msg.sender === 'ai' || msg.sender === 'assistant') {
      const slots = extractSlotsFromMessage(content);
      if (slots.length > 0) {
        state.lastOfferedSlots = slots;
      }
    }
  }
  
  return state;
}

/**
 * Get SMS booking state from conversation's behaviorSettings
 */
export async function getSmsBookingState(tenantDb: any, conversationId: number): Promise<SmsBookingState> {
  const [conv] = await tenantDb
    .select({ behaviorSettings: conversations.behaviorSettings })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  
  const settings = conv?.behaviorSettings as Record<string, any> | null;
  return settings?.smsBookingState || {};
}

/**
 * Update SMS booking state in conversation's behaviorSettings
 */
export async function updateSmsBookingState(
  tenantDb: any, 
  conversationId: number, 
  patch: Partial<SmsBookingState>
): Promise<void> {
  // Get current settings
  const [conv] = await tenantDb
    .select({ behaviorSettings: conversations.behaviorSettings })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  
  const currentSettings = (conv?.behaviorSettings as Record<string, any>) || {};
  const currentState = currentSettings.smsBookingState || {};
  
  // Merge patch into current state
  const newState = { ...currentState, ...patch };
  
  // Update with merged settings
  await tenantDb
    .update(conversations)
    .set({
      behaviorSettings: {
        ...currentSettings,
        smsBookingState: newState,
      },
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Get a summary of the SMS booking state for logging
 */
export function getSmsBookingStateSummary(state: SmsBookingState): string {
  const parts: string[] = [];
  if (state.service) parts.push(`service=${state.service}`);
  if (state.vehicle) parts.push(`vehicle=${state.vehicle}`);
  if (state.address) parts.push(`address=${state.address.substring(0, 20)}...`);
  if (state.chosenSlotLabel) parts.push(`slot=${state.chosenSlotLabel}`);
  if (state.lastOfferedSlots?.length) parts.push(`offered=${state.lastOfferedSlots.length} slots`);
  if (state.stage) parts.push(`stage=${state.stage}`);
  return parts.length > 0 ? parts.join(', ') : 'empty';
}

// Session staleness thresholds
const SESSION_STALE_HOURS = 24;
const ADDRESS_VERIFICATION_HOURS = 24;

/**
 * Generate a short session ID for tracking
 */
function generateSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Determine if booking state should be reset based on user message
 * Returns reset reason or null if no reset needed
 */
export function shouldResetBookingState(
  userMessage: string, 
  currentState: SmsBookingState,
  fromPhone?: string
): { shouldReset: boolean; reason?: string; newService?: string } {
  const text = userMessage.toLowerCase().trim();
  
  // Booking intent keywords
  const BOOKING_INTENT_PATTERNS = [
    /\b(book|schedule|appointment|reserve|need\s+an?\s+appointment|set\s+up|sign\s+me\s+up)\b/i,
    /\b(when\s+can|available|availability)\b/i,
  ];
  
  // Check if this is a new booking intent when state is already 'booked' or stale
  const hasBookingIntent = BOOKING_INTENT_PATTERNS.some(p => p.test(text));
  const staleThreshold = Date.now() - (SESSION_STALE_HOURS * 60 * 60 * 1000);
  
  // Stale session detection - use session start time if available, else fall back to reset timestamp
  const sessionTimestamp = currentState.bookingSessionStartedAt || currentState.lastResetTimestamp || 0;
  const isStale = sessionTimestamp > 0 && sessionTimestamp < staleThreshold;
  const isBooked = currentState.stage === 'booked';
  const hasNoSession = !currentState.bookingSessionId;
  
  // Start new session if: booking intent + (completed/stale/no session)
  if (hasBookingIntent && (isBooked || isStale || hasNoSession)) {
    return { 
      shouldReset: true, 
      reason: isBooked ? 'new_booking_after_completed' : (isStale ? 'stale_session' : 'new_session')
    };
  }
  
  // Service change detection
  const SERVICE_PATTERNS: Array<{ pattern: RegExp; service: string }> = [
    { pattern: /\b(full\s*detail|full\s*service)\b/i, service: 'Full Detail' },
    { pattern: /\b(interior\s*detail|interior\s*only|inside\s*only|interior)\b/i, service: 'Interior Detail' },
    { pattern: /\b(exterior|outside\s*only|wash\s*and\s*wax)\b/i, service: 'Exterior Detail' },
    { pattern: /\b(premium\s*wash)\b/i, service: 'Premium Wash' },
    { pattern: /\b(maintenance\s*detail|maintenance\s*program)\b/i, service: 'Maintenance Detail' },
    { pattern: /\b(ceramic\s*coat)/i, service: 'Ceramic Coating' },
    { pattern: /\b(paint\s*correction|polish)/i, service: 'Paint Enhancement' },
  ];
  
  for (const { pattern, service } of SERVICE_PATTERNS) {
    if (pattern.test(text)) {
      // User mentioned a service
      if (currentState.service && currentState.service !== service) {
        // Service changed - reset service-specific fields but keep address
        return {
          shouldReset: true,
          reason: 'service_changed',
          newService: service,
        };
      }
    }
  }
  
  return { shouldReset: false };
}

/**
 * Reset booking state with new session, preserving address by default unless explicitly clearing
 * 
 * Address preservation rules:
 * - Always preserve if explicitly passed
 * - Preserve if old address exists and was set within 24h (even without verification metadata)
 * - Clear only if oldState is missing or address was set more than 24h ago
 */
export function createResetBookingState(
  reason: string,
  preserveAddress?: string,
  newService?: string,
  fromPhone?: string,
  oldState?: SmsBookingState
): SmsBookingState {
  const now = Date.now();
  const sessionId = generateSessionId();
  
  // Preserve address more liberally - only clear if truly stale
  let addressToPreserve = preserveAddress;
  if (!addressToPreserve && oldState?.address) {
    const addressStaleThreshold = now - (ADDRESS_VERIFICATION_HOURS * 60 * 60 * 1000);
    
    // Check verified timestamp first, fall back to lastResetTimestamp, then session start
    const addressTimestamp = oldState.verifiedAddressTimestamp || 
      oldState.lastResetTimestamp || 
      oldState.bookingSessionStartedAt || 0;
    
    const isAddressRecent = addressTimestamp > addressStaleThreshold || addressTimestamp === 0;
    const samePhone = !fromPhone || !oldState.verifiedAddressPhone || 
      oldState.verifiedAddressPhone === fromPhone;
    
    // Preserve address if it's recent OR if no timestamp info (assume fresh)
    if (isAddressRecent && samePhone) {
      addressToPreserve = oldState.address;
      console.log(`[SMS SESSION] Preserving address: ${addressToPreserve?.substring(0, 25)}...`);
    } else {
      console.log(`[SMS SESSION] Clearing stale address (timestamp=${addressTimestamp} threshold=${addressStaleThreshold})`);
    }
  }
  
  console.log(`[SMS SESSION] started id=${sessionId} reason=${reason}`);
  
  return {
    service: newService,
    address: addressToPreserve,
    lastResetReason: reason,
    lastResetTimestamp: now,
    stage: newService ? 'selecting_service' : undefined,
    bookingSessionId: sessionId,
    bookingSessionStartedAt: now,
    verifiedAddressPhone: addressToPreserve ? (fromPhone || oldState?.verifiedAddressPhone) : undefined,
    verifiedAddressTimestamp: addressToPreserve ? (oldState?.verifiedAddressTimestamp || now) : undefined,
  };
}

/**
 * Get session context window start timestamp
 * Returns the timestamp after which messages should be included in LLM context
 */
export function getSessionContextWindowStart(state: SmsBookingState): number | undefined {
  return state.bookingSessionStartedAt;
}

export async function buildBookingDraftFromConversation(
  tenantId: string,
  conversationId: number
): Promise<BookingDraft | null> {
  const tenantDb = wrapTenantDb(db, tenantId);

  // 1) Load conversation row
  const [conversation] = await tenantDb
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) return null;

  // 2) Load customer info if available
  let customer: any = null;
  if (conversation.customerId) {
    const [cust] = await tenantDb
      .select()
      .from(customers)
      .where(eq(customers.id, conversation.customerId))
      .limit(1);
    customer = cust || null;
  }

  // 3) Load conversation state from in-memory state manager
  // Use customerPhone from conversation (already in E.164 format)
  const phone = conversation.customerPhone;
  const state = phone ? conversationState.getState(phone) : null;

  // 3.1) Vehicle Auto-Create: Detect vehicle from conversation state and create/link vehicle card
  let vehicleSummary: string | null = null;
  
  if (state?.vehicles?.length && conversation.customerId) {
    try {
      // Get the first vehicle from conversation state
      const v = state.vehicles[0];
      
      // Auto-create or find vehicle card in database
      const vehicleCard = await findOrCreateVehicleCard(
        tenantId,
        conversation.customerId,
        v.year,
        v.make,
        v.model,
        v.color
      );
      
      // Build summary from the created/found vehicle card
      if (vehicleCard) {
        const parts = [
          vehicleCard.year,
          vehicleCard.make,
          vehicleCard.model,
          vehicleCard.color
        ].filter(Boolean);
        vehicleSummary = parts.join(' ').trim() || null;
      }
    } catch (error) {
      // Vehicle creation failed - fall back to text summary from state
      console.warn('[BOOKING DRAFT] Vehicle auto-create failed:', error);
      vehicleSummary = state.vehicles
        .map((v: any) => {
          const parts = [v.year, v.make, v.model, v.color].filter(Boolean);
          return parts.join(' ');
        })
        .join(' | ');
    }
  }

  // 3.5) Smart service resolution: Use fuzzy matching to resolve natural language service descriptions
  let inferredServiceId: number | null = null;
  let inferredServiceName: string | null = null;
  
  if (state?.service) {
    const result = await resolveServiceFromNaturalText(tenantId, state.service);
    inferredServiceId = result.id;
    inferredServiceName = result.name;
  }

  // 4) Time window intelligence: normalize natural language time preferences
  // Extract raw time preference from conversation state (selectedTimeSlot or preferredTime)
  const rawTimePreference: string | null =
    state?.selectedTimeSlot ??
    (state as any)?.preferredTime ??
    null;

  let normalizedDate: string | null = null;
  let normalizedWindow: string | null = null;
  let normalizedStart: string | null = null;
  let normalizedEnd: string | null = null;

  if (rawTimePreference) {
    // Check if this is already an ISO timestamp (e.g. "2025-11-25T14:00:00Z")
    // vs natural language (e.g. "tomorrow morning")
    const isISOTimestamp = !isNaN(Date.parse(rawTimePreference)) && 
                           (rawTimePreference.includes('T') || rawTimePreference.includes('-'));
    
    if (isISOTimestamp) {
      // Preserve existing behavior: use ISO timestamp directly
      const timestamp = new Date(rawTimePreference);
      normalizedDate = timestamp.toISOString().split('T')[0]; // Extract YYYY-MM-DD
      normalizedStart = timestamp.toTimeString().slice(0, 5); // Extract HH:MM
      // Keep rawTimePreference for context
    } else {
      // Natural language: parse with time window intelligence
      try {
        const normalized = normalizeTimePreference(rawTimePreference);
        normalizedDate = normalized.date;
        normalizedWindow = normalized.windowLabel;
        normalizedStart = normalized.startTime;
        normalizedEnd = normalized.endTime;
      } catch (error) {
        // Parsing failed; leave fields as null
        console.warn('[BOOKING DRAFT] Time preference parsing failed:', error);
      }
    }
  }

  // 5) Smart Notes Injection: Extract AI-suggested notes from conversation context
  const aiSuggestedNotes = extractNotesFromConversationState(state);

  // 6) Address Geocoding: Convert address to coordinates if not already available
  let addressLat: number | null = state?.addressLat ?? null;
  let addressLng: number | null = state?.addressLng ?? null;
  let formattedAddress: string | null = null;
  
  const customerAddress = state?.address ?? customer?.address ?? null;
  
  // If we have an address but no coordinates, geocode it
  if (customerAddress && (!addressLat || !addressLng)) {
    try {
      const geo = await geocodeAddress(customerAddress);
      addressLat = geo.lat;
      addressLng = geo.lng;
      formattedAddress = geo.formatted;
    } catch (error) {
      console.warn('[BOOKING DRAFT] Geocoding failed:', error);
    }
  }

  // 7) Service Area Evaluation: Check if location is within service area
  let inServiceArea: boolean | null = null;
  let travelMinutes: number | null = null;
  let serviceAreaSoftDeclineMessage: string | null = null;
  let requiresManualApproval = false;
  
  if (addressLat && addressLng) {
    try {
      const serviceArea = await evaluateServiceArea(tenantId, addressLat, addressLng);
      inServiceArea = serviceArea.inServiceArea;
      travelMinutes = serviceArea.travelMinutes;
      serviceAreaSoftDeclineMessage = serviceArea.softDeclineMessage;
      
      // Special behavior for Clean Machine root-tenant
      if (tenantId === 'root-cleanmachine') {
        if (travelMinutes != null && travelMinutes > 25) {
          requiresManualApproval = true;
        }
      }
    } catch (error) {
      console.warn('[BOOKING DRAFT] Service area evaluation failed:', error);
    }
  }

  // 8) Route Optimization: Generate route-aware booking suggestions based on location
  let routeSuggestion = null;
  
  // Use geocoded coordinates or conversation state coordinates
  if (addressLat && addressLng && customerAddress) {
    try {
      routeSuggestion = await generateRouteSuggestion(
        tenantId,
        customerAddress,
        addressLat,
        addressLng
      );
    } catch (error) {
      // Route suggestion failed - non-blocking
      console.warn('[BOOKING DRAFT] Route suggestion failed:', error);
    }
  }

  // Build draft with data from conversation state, customer record, and conversation
  const draft: BookingDraft = {
    conversationId: conversation.id,
    customerId: conversation.customerId ?? null,
    customerName: state?.customerName ?? customer?.name ?? conversation.customerName ?? null,
    customerPhone: conversation.customerPhone ?? customer?.phone ?? null,
    customerEmail: state?.customerEmail ?? customer?.email ?? null,
    address: formattedAddress ?? customerAddress,
    serviceName: inferredServiceName ?? state?.service ?? null,
    serviceId: inferredServiceId,

    // Time intelligence fields
    preferredDate: normalizedDate,
    preferredTimeWindow: normalizedWindow,
    rawTimePreference,
    normalizedStartTime: normalizedStart,
    normalizedEndTime: normalizedEnd,

    vehicleSummary,
    notes: null,
    aiSuggestedNotes,
    routeSuggestion,
    
    // Geocoding and service area fields
    addressLat,
    addressLng,
    formattedAddress,
    inServiceArea,
    travelMinutes,
    serviceAreaSoftDeclineMessage,
    requiresManualApproval,
  };

  return draft;
}
