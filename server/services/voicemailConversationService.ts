import type { TenantDb } from '../tenantDb';
import { conversations, messages, customers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import {
  getOrCreateConversation,
  addMessage,
} from '../conversationService';
import {
  broadcastConversationUpdate,
} from '../websocketService';

export interface VoicemailSyncPayload {
  fromPhone: string;
  toPhone: string;
  transcriptionText: string;
  recordingUrl?: string | null;
  aiReplyText?: string | null;
  voicemailSummary?: string | null;
  phoneLineId?: number;
}

export async function syncVoicemailIntoConversation(
  tenantDb: TenantDb,
  payload: VoicemailSyncPayload
): Promise<{ conversationId: number; customerId: number | null }> {
  const {
    fromPhone,
    toPhone,
    transcriptionText,
    recordingUrl,
    aiReplyText,
    voicemailSummary,
    phoneLineId,
  } = payload;

  console.log('[VOICEMAIL SYNC] Starting voicemail sync:', {
    fromPhone,
    toPhone,
    transcriptionLength: transcriptionText?.length,
    hasRecording: !!recordingUrl,
    hasAiReply: !!aiReplyText,
    hasSummary: !!voicemailSummary,
    phoneLineId,
  });

  const { conversation, isNew } = await getOrCreateConversation(
    tenantDb,
    fromPhone,
    null,
    'sms',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    phoneLineId || 1
  );

  console.log('[VOICEMAIL SYNC] Conversation resolved:', {
    conversationId: conversation.id,
    isNew,
    customerId: conversation.customerId,
  });

  const voicemailMetadata = {
    type: 'voicemail',
    recordingUrl: recordingUrl || null,
    transcribedAt: new Date().toISOString(),
    source: 'twilio',
    channel: 'voice',
    voicemailSummary: voicemailSummary || null,
  };

  await addMessage(
    tenantDb,
    conversation.id,
    `🎙️ Voicemail:\n\n${transcriptionText}`,
    'customer',
    'sms',
    voicemailMetadata,
    phoneLineId || 1
  );

  console.log('[VOICEMAIL SYNC] Voicemail message added to conversation:', conversation.id);

  if (aiReplyText && aiReplyText.trim().length > 0) {
    const aiReplyMetadata = {
      type: 'voicemail_followup',
      generatedFrom: 'voicemail_transcription',
      automated: true,
    };

    await addMessage(
      tenantDb,
      conversation.id,
      aiReplyText,
      'ai',
      'sms',
      aiReplyMetadata,
      phoneLineId || 1
    );

    console.log('[VOICEMAIL SYNC] AI reply message added to conversation:', conversation.id);
  }

  await tenantDb
    .update(conversations)
    .set({
      needsHumanAttention: true,
      controlMode: 'manual',
    })
    .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversation.id)));

  console.log('[VOICEMAIL SYNC] Conversation marked as needing human attention:', conversation.id);

  const updatedConversation = await tenantDb
    .select()
    .from(conversations)
    .where(tenantDb.withTenantFilter(conversations, eq(conversations.id, conversation.id)))
    .limit(1);

  if (updatedConversation[0]) {
    broadcastConversationUpdate(updatedConversation[0]);
  }

  return {
    conversationId: conversation.id,
    customerId: conversation.customerId,
  };
}

export async function getVoicemailMessagesForConversation(
  tenantDb: TenantDb,
  conversationId: number
): Promise<any[]> {
  const voicemailMessages = await tenantDb
    .select()
    .from(messages)
    .where(
      tenantDb.withTenantFilter(
        messages,
        eq(messages.conversationId, conversationId)
      )
    );

  return voicemailMessages.filter((msg) => {
    const metadata = msg.metadata as Record<string, any> | null;
    return metadata?.type === 'voicemail';
  });
}
