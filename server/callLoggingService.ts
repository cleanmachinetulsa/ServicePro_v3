import { db } from './db';
import { callEvents, conversations } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface CallEventData {
  callSid: string;
  direction: 'inbound' | 'outbound' | 'technician_outbound';
  from: string;
  to: string;
  customerPhone?: string; // Optional: The actual customer's phone number for bridge preservation
  status: string;
  duration?: number;
  recordingUrl?: string;
  recordingSid?: string;
  transcriptionText?: string;
  transcriptionStatus?: string;
  answeredBy?: string;
  price?: string;
  priceUnit?: string;
  startedAt?: Date;
  endedAt?: Date;
  technicianId?: number;
  appointmentId?: number;
}

/**
 * Creates a new call event log
 */
export async function logCallEvent(callData: CallEventData): Promise<number> {
  try {
    // Find or create conversation for this phone number
    let conversationId: number | null = null;
    
    // For inbound calls, the customer is calling FROM a number
    // For outbound/technician calls, the customer is being called TO a number
    const customerPhone = callData.customerPhone || (callData.direction === 'inbound' ? callData.from : callData.to);
    
    // Try to find existing conversation
    const [existingConv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.customerPhone, customerPhone))
      .limit(1);
    
    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      // Create new conversation for this phone number
      const { getOrCreateConversation } = await import('./conversationService');
      const newConv = await getOrCreateConversation(customerPhone, null, 'sms');
      conversationId = newConv.id;
    }
    
    // Insert call event with customer phone metadata for bridge preservation
    const [callEvent] = await db.insert(callEvents).values({
      conversationId,
      callSid: callData.callSid,
      direction: callData.direction,
      from: callData.from,
      to: callData.to,
      customerPhone, // Store for hold/mute operations
      status: callData.status,
      duration: callData.duration,
      recordingUrl: callData.recordingUrl,
      recordingSid: callData.recordingSid,
      transcriptionText: callData.transcriptionText,
      transcriptionStatus: callData.transcriptionStatus,
      answeredBy: callData.answeredBy,
      price: callData.price,
      priceUnit: callData.priceUnit || 'USD',
      startedAt: callData.startedAt,
      endedAt: callData.endedAt,
      technicianId: callData.technicianId,
      appointmentId: callData.appointmentId,
    }).returning({ id: callEvents.id });
    
    console.log(`[CALL LOG] Created call event ${callEvent.id} for call ${callData.callSid}`);
    
    return callEvent.id;
  } catch (error) {
    console.error('[CALL LOG] Error logging call event:', error);
    throw error;
  }
}

/**
 * Updates an existing call event with new information
 * Only updates fields that are defined in the updates object (prevents NULL overwrites)
 */
export async function updateCallEvent(
  callSid: string,
  updates: Partial<CallEventData>
): Promise<void> {
  try {
    // Build update object with only defined fields to prevent NULL overwrites
    const updateData: any = {};
    
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.recordingUrl !== undefined) updateData.recordingUrl = updates.recordingUrl;
    if (updates.recordingSid !== undefined) updateData.recordingSid = updates.recordingSid;
    if (updates.transcriptionText !== undefined) updateData.transcriptionText = updates.transcriptionText;
    if (updates.transcriptionStatus !== undefined) updateData.transcriptionStatus = updates.transcriptionStatus;
    if (updates.answeredBy !== undefined) updateData.answeredBy = updates.answeredBy;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.startedAt !== undefined) updateData.startedAt = updates.startedAt;
    if (updates.endedAt !== undefined) updateData.endedAt = updates.endedAt;
    
    // Only update if there are fields to update
    if (Object.keys(updateData).length > 0) {
      await db.update(callEvents)
        .set(updateData)
        .where(eq(callEvents.callSid, callSid));
      
      console.log(`[CALL LOG] Updated call event for ${callSid} with fields:`, Object.keys(updateData));
    } else {
      console.log(`[CALL LOG] No fields to update for ${callSid}`);
    }
  } catch (error) {
    console.error('[CALL LOG] Error updating call event:', error);
    throw error;
  }
}

/**
 * Gets all call events for a conversation
 */
export async function getCallEventsForConversation(conversationId: number) {
  try {
    const events = await db
      .select()
      .from(callEvents)
      .where(eq(callEvents.conversationId, conversationId))
      .orderBy(callEvents.createdAt);
    
    return events;
  } catch (error) {
    console.error('[CALL LOG] Error fetching call events:', error);
    return [];
  }
}
