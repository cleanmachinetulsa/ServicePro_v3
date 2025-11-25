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

  // Build draft with data from conversation state, customer record, and conversation
  const draft: BookingDraft = {
    conversationId: conversation.id,
    customerId: conversation.customerId ?? null,
    customerName: state?.customerName ?? customer?.name ?? conversation.customerName ?? null,
    customerPhone: conversation.customerPhone ?? customer?.phone ?? null,
    customerEmail: state?.customerEmail ?? customer?.email ?? null,
    address: state?.address ?? customer?.address ?? null,
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
  };

  return draft;
}
