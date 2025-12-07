/**
 * CM-Billing-Prep: Usage Recorder
 * 
 * Helper for recording usage events to the global usage_ledger table.
 * All external integrations (Twilio, SendGrid, OpenAI) should call recordUsageEvent
 * to track billable usage.
 * 
 * This is async but non-blocking - usage recording should never slow down
 * the main request/response flow.
 */

import { db } from '../db';
import { usageLedger, UsageSource, UsageEventType, USAGE_SOURCES, USAGE_EVENT_TYPES } from '@shared/schema';

interface UsageEventInput {
  tenantId: string;
  source: UsageSource;
  eventType: UsageEventType;
  units?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export async function recordUsageEvent(input: UsageEventInput): Promise<void> {
  try {
    if (!input.tenantId) {
      console.warn('[USAGE] Missing tenantId, skipping usage event', { source: input.source, eventType: input.eventType });
      return;
    }

    if (!USAGE_SOURCES.includes(input.source as UsageSource)) {
      console.warn('[USAGE] Invalid source', { source: input.source });
      return;
    }

    if (!USAGE_EVENT_TYPES.includes(input.eventType as UsageEventType)) {
      console.warn('[USAGE] Invalid eventType', { eventType: input.eventType });
      return;
    }

    await db.insert(usageLedger).values({
      tenantId: input.tenantId,
      source: input.source,
      eventType: input.eventType,
      units: input.units ?? 1,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
  } catch (error) {
    console.error('[USAGE] Failed to record usage event', {
      error: error instanceof Error ? error.message : String(error),
      input: {
        tenantId: input.tenantId,
        source: input.source,
        eventType: input.eventType,
        units: input.units,
      },
    });
  }
}

export function recordUsageEventAsync(input: UsageEventInput): void {
  void recordUsageEvent(input);
}

export async function recordSmsOutbound(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'sms_outbound',
    units: 1,
    metadata,
  });
}

export async function recordSmsInbound(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'sms_inbound',
    units: 1,
    metadata,
  });
}

export async function recordMmsOutbound(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'mms_outbound',
    units: 1,
    metadata,
  });
}

export async function recordMmsInbound(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'mms_inbound',
    units: 1,
    metadata,
  });
}

export async function recordCallInbound(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'call_inbound',
    units: 1,
    metadata,
  });
}

export async function recordCallOutbound(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'call_outbound',
    units: 1,
    metadata,
  });
}

export async function recordCallMinutes(
  tenantId: string,
  minutes: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'call_minutes',
    units: Math.ceil(minutes),
    metadata,
  });
}

export async function recordIvrStep(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'twilio',
    eventType: 'ivr_step',
    units: 1,
    metadata,
  });
}

export async function recordAiMessage(
  tenantId: string,
  tokenCount: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'openai',
    eventType: 'ai_message',
    units: tokenCount,
    metadata,
  });
}

export async function recordAiVoicemailSummary(
  tenantId: string,
  tokenCount: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'openai',
    eventType: 'ai_voicemail_summary',
    units: tokenCount,
    metadata,
  });
}

export async function recordEmailSent(
  tenantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'sendgrid',
    eventType: 'email_sent',
    units: 1,
    metadata,
  });
}

export async function recordEmailCampaign(
  tenantId: string,
  recipientCount: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent({
    tenantId,
    source: 'sendgrid',
    eventType: 'email_campaign',
    units: recipientCount,
    metadata,
  });
}
