export const usagePricing = {
  sms: 0.014,
  mms: 0.02,
  voiceMinute: 0.015,
  email: 0.0005,
  aiToken: 0.000002,
};

export function calculateUsageCost(usage: {
  smsTotal: number;
  mmsTotal: number;
  voiceTotalMinutes: number;
  emailTotal: number;
  aiTotalTokens: number;
}): number {
  return (
    usage.smsTotal * usagePricing.sms +
    usage.mmsTotal * usagePricing.mms +
    usage.voiceTotalMinutes * usagePricing.voiceMinute +
    usage.emailTotal * usagePricing.email +
    usage.aiTotalTokens * usagePricing.aiToken
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
