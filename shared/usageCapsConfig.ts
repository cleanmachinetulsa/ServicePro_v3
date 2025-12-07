/**
 * SP-18: Usage Caps Configuration
 * 
 * Defines per-tier usage limits and warning thresholds for Twilio, OpenAI, and SendGrid.
 * These are monthly caps that trigger warnings and hard-stops when exceeded.
 */

import { PlanTier } from './addonsConfig';

export type UsageChannel = 'sms' | 'mms' | 'voice' | 'email' | 'ai';

export interface ChannelCaps {
  monthlyCap: number;
  warningThresholdPct: number;
  unitLabel: string;
  costPerUnit?: number;
}

export interface TierUsageCaps {
  sms: ChannelCaps;
  mms: ChannelCaps;
  voice: ChannelCaps;
  email: ChannelCaps;
  ai: ChannelCaps;
}

export type UsageStatus = 'ok' | 'warning' | 'over_cap';

export interface UsageStatusResult {
  channel: UsageChannel;
  used: number;
  cap: number;
  percentUsed: number;
  status: UsageStatus;
  unitLabel: string;
  estimatedCostCents?: number;
}

export interface TenantUsageStatus {
  tenantId: string;
  period: {
    year: number;
    month: number;
    label: string;
  };
  channels: Record<UsageChannel, UsageStatusResult>;
  overallStatus: UsageStatus;
  hardStopEnabled: boolean;
}

export const USAGE_CAPS_BY_TIER: Record<PlanTier, TierUsageCaps> = {
  free: {
    sms: { monthlyCap: 50, warningThresholdPct: 80, unitLabel: 'messages', costPerUnit: 0.0079 },
    mms: { monthlyCap: 10, warningThresholdPct: 80, unitLabel: 'messages', costPerUnit: 0.02 },
    voice: { monthlyCap: 10, warningThresholdPct: 80, unitLabel: 'minutes', costPerUnit: 0.014 },
    email: { monthlyCap: 100, warningThresholdPct: 80, unitLabel: 'emails', costPerUnit: 0.0001 },
    ai: { monthlyCap: 10000, warningThresholdPct: 80, unitLabel: 'tokens', costPerUnit: 0.00001 },
  },
  starter: {
    sms: { monthlyCap: 500, warningThresholdPct: 80, unitLabel: 'messages', costPerUnit: 0.0079 },
    mms: { monthlyCap: 50, warningThresholdPct: 80, unitLabel: 'messages', costPerUnit: 0.02 },
    voice: { monthlyCap: 60, warningThresholdPct: 80, unitLabel: 'minutes', costPerUnit: 0.014 },
    email: { monthlyCap: 1000, warningThresholdPct: 80, unitLabel: 'emails', costPerUnit: 0.0001 },
    ai: { monthlyCap: 100000, warningThresholdPct: 80, unitLabel: 'tokens', costPerUnit: 0.00001 },
  },
  pro: {
    sms: { monthlyCap: 2000, warningThresholdPct: 80, unitLabel: 'messages', costPerUnit: 0.0079 },
    mms: { monthlyCap: 200, warningThresholdPct: 80, unitLabel: 'messages', costPerUnit: 0.02 },
    voice: { monthlyCap: 300, warningThresholdPct: 80, unitLabel: 'minutes', costPerUnit: 0.014 },
    email: { monthlyCap: 5000, warningThresholdPct: 80, unitLabel: 'emails', costPerUnit: 0.0001 },
    ai: { monthlyCap: 500000, warningThresholdPct: 80, unitLabel: 'tokens', costPerUnit: 0.00001 },
  },
  elite: {
    sms: { monthlyCap: 10000, warningThresholdPct: 90, unitLabel: 'messages', costPerUnit: 0.0079 },
    mms: { monthlyCap: 1000, warningThresholdPct: 90, unitLabel: 'messages', costPerUnit: 0.02 },
    voice: { monthlyCap: 1000, warningThresholdPct: 90, unitLabel: 'minutes', costPerUnit: 0.014 },
    email: { monthlyCap: 20000, warningThresholdPct: 90, unitLabel: 'emails', costPerUnit: 0.0001 },
    ai: { monthlyCap: 2000000, warningThresholdPct: 90, unitLabel: 'tokens', costPerUnit: 0.00001 },
  },
  internal: {
    sms: { monthlyCap: 999999, warningThresholdPct: 95, unitLabel: 'messages', costPerUnit: 0.0079 },
    mms: { monthlyCap: 999999, warningThresholdPct: 95, unitLabel: 'messages', costPerUnit: 0.02 },
    voice: { monthlyCap: 999999, warningThresholdPct: 95, unitLabel: 'minutes', costPerUnit: 0.014 },
    email: { monthlyCap: 999999, warningThresholdPct: 95, unitLabel: 'emails', costPerUnit: 0.0001 },
    ai: { monthlyCap: 999999999, warningThresholdPct: 95, unitLabel: 'tokens', costPerUnit: 0.00001 },
  },
};

export function getUsageCapsForTier(tier: PlanTier): TierUsageCaps {
  return USAGE_CAPS_BY_TIER[tier] || USAGE_CAPS_BY_TIER.free;
}

export function computeUsageStatus(
  used: number,
  cap: number,
  warningThresholdPct: number
): UsageStatus {
  if (used >= cap) return 'over_cap';
  const percentUsed = (used / cap) * 100;
  if (percentUsed >= warningThresholdPct) return 'warning';
  return 'ok';
}

export function computeChannelStatus(
  channel: UsageChannel,
  used: number,
  tierCaps: TierUsageCaps
): UsageStatusResult {
  const channelCaps = tierCaps[channel];
  const percentUsed = channelCaps.monthlyCap > 0 
    ? Math.round((used / channelCaps.monthlyCap) * 100 * 10) / 10
    : 0;
  const status = computeUsageStatus(used, channelCaps.monthlyCap, channelCaps.warningThresholdPct);
  const estimatedCostCents = channelCaps.costPerUnit 
    ? Math.round(used * channelCaps.costPerUnit * 100)
    : undefined;

  return {
    channel,
    used,
    cap: channelCaps.monthlyCap,
    percentUsed,
    status,
    unitLabel: channelCaps.unitLabel,
    estimatedCostCents,
  };
}

export function getOverallStatus(channels: Record<UsageChannel, UsageStatusResult>): UsageStatus {
  const statuses = Object.values(channels).map(c => c.status);
  if (statuses.includes('over_cap')) return 'over_cap';
  if (statuses.includes('warning')) return 'warning';
  return 'ok';
}

export function formatPeriodLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export const USAGE_CHANNELS: UsageChannel[] = ['sms', 'mms', 'voice', 'email', 'ai'];

export function mapEventTypeToChannel(eventType: string): UsageChannel | null {
  if (eventType.startsWith('sms_')) return 'sms';
  if (eventType.startsWith('mms_')) return 'mms';
  if (eventType.startsWith('call_') || eventType.startsWith('ivr_')) return 'voice';
  if (eventType.startsWith('email_')) return 'email';
  if (eventType.startsWith('ai_')) return 'ai';
  return null;
}
