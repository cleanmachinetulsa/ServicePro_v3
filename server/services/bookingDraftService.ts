import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, customers, services } from '@shared/schema';
import type { BookingDraft } from '@shared/bookingDraft';
import { eq } from 'drizzle-orm';
import { conversationState } from '../conversationState';
import { normalizeTimePreference } from './timePreferenceParser';

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

  // Helper to build a vehicle summary string if state.vehicles exists
  const vehicleSummary = state?.vehicles?.length
    ? state.vehicles
        .map((v: any) => {
          const parts = [v.year, v.make, v.model, v.color].filter(Boolean);
          return parts.join(' ');
        })
        .join(' | ')
    : null;

  // Try to derive a "serviceId" if the state.service matches a service name
  let inferredServiceId: number | null = null;
  if (state?.service) {
    const [svc] = await tenantDb
      .select()
      .from(services)
      .where(eq(services.name, state.service))
      .limit(1);
    inferredServiceId = svc?.id ?? null;
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

  // Build draft with data from conversation state, customer record, and conversation
  const draft: BookingDraft = {
    conversationId: conversation.id,
    customerId: conversation.customerId ?? null,
    customerName: state?.customerName ?? customer?.name ?? conversation.customerName ?? null,
    customerPhone: conversation.customerPhone ?? customer?.phone ?? null,
    customerEmail: state?.customerEmail ?? customer?.email ?? null,
    address: state?.address ?? customer?.address ?? null,
    serviceName: state?.service ?? null,
    serviceId: inferredServiceId,

    // Time intelligence fields
    preferredDate: normalizedDate,
    preferredTimeWindow: normalizedWindow,
    rawTimePreference,
    normalizedStartTime: normalizedStart,
    normalizedEndTime: normalizedEnd,

    vehicleSummary,
    notes: null,
  };

  return draft;
}
