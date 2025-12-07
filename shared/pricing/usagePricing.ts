export const usagePricing = {
  sms: {
    inbound: 0.0079,
    outbound: 0.0089,
  },
  mms: {
    inbound: 0.02,
    outbound: 0.02,
  },
  voice: {
    perMinute: 0.0085,
  },
  email: {
    perEmail: 0.00035,
  },
  ai: {
    perInputToken: 0.00001,
    perOutputToken: 0.00003,
    per1kInputTokens: 0.002,
    per1kOutputTokens: 0.006,
  },
};

export type UsageChannel = 'sms' | 'mms' | 'voice' | 'email' | 'ai';
export type UsageSource = 'twilio' | 'sendgrid' | 'openai' | 'internal';
export type UsageDirection = 'inbound' | 'outbound';
export type UsageFeature = 
  | 'ai_sms' 
  | 'ai_chat'
  | 'ivr' 
  | 'broadcast' 
  | 'portal_email' 
  | 'support_ai' 
  | 'booking_email' 
  | 'reminder_sms'
  | 'voicemail_ai'
  | 'customer_sms'
  | 'staff_sms'
  | 'general';

export function getUnitCost(
  channel: UsageChannel, 
  direction: UsageDirection,
  options?: { inputTokens?: number; outputTokens?: number }
): number {
  switch (channel) {
    case 'sms':
      return direction === 'inbound' ? usagePricing.sms.inbound : usagePricing.sms.outbound;
    case 'mms':
      return direction === 'inbound' ? usagePricing.mms.inbound : usagePricing.mms.outbound;
    case 'voice':
      return usagePricing.voice.perMinute;
    case 'email':
      return usagePricing.email.perEmail;
    case 'ai':
      if (options?.inputTokens && options?.outputTokens) {
        return (options.inputTokens * usagePricing.ai.perInputToken) + 
               (options.outputTokens * usagePricing.ai.perOutputToken);
      }
      return (usagePricing.ai.perInputToken + usagePricing.ai.perOutputToken) / 2;
    default:
      return 0;
  }
}

export function calculateUsageCost(usage: {
  smsTotal: number;
  mmsTotal: number;
  voiceTotalMinutes: number;
  emailTotal: number;
  aiTotalTokens: number;
}): number {
  const avgSmsRate = (usagePricing.sms.inbound + usagePricing.sms.outbound) / 2;
  const avgMmsRate = (usagePricing.mms.inbound + usagePricing.mms.outbound) / 2;
  const avgAiRate = (usagePricing.ai.perInputToken + usagePricing.ai.perOutputToken) / 2;
  
  return (
    usage.smsTotal * avgSmsRate +
    usage.mmsTotal * avgMmsRate +
    usage.voiceTotalMinutes * usagePricing.voice.perMinute +
    usage.emailTotal * usagePricing.email.perEmail +
    usage.aiTotalTokens * avgAiRate
  );
}

export function calculateDetailedUsageCost(usage: {
  smsInbound: number;
  smsOutbound: number;
  mmsInbound: number;
  mmsOutbound: number;
  voiceMinutes: number;
  emailsSent: number;
  aiTokensIn: number;
  aiTokensOut: number;
}): number {
  return (
    usage.smsInbound * usagePricing.sms.inbound +
    usage.smsOutbound * usagePricing.sms.outbound +
    usage.mmsInbound * usagePricing.mms.inbound +
    usage.mmsOutbound * usagePricing.mms.outbound +
    usage.voiceMinutes * usagePricing.voice.perMinute +
    usage.emailsSent * usagePricing.email.perEmail +
    usage.aiTokensIn * usagePricing.ai.perInputToken +
    usage.aiTokensOut * usagePricing.ai.perOutputToken
  );
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}
