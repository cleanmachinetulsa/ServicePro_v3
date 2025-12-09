/**
 * SP-11: Plan Usage Limits Configuration
 * 
 * Defines soft usage caps per plan tier for SMS, emails, AI requests, etc.
 * These are informational limits shown in the UI - enforcement will be added later.
 * 
 * Usage: Used by the tenant billing page to show "X / Y" usage vs limit.
 */

export type PlanTier = 'free' | 'starter' | 'pro' | 'elite' | 'internal' | 'family_free' | 'family_paid';

export interface PlanLimits {
  maxSmsPerMonth: number;
  maxEmailsPerMonth: number;
  maxAiRequestsPerMonth: number;
  maxVoiceMinutesPerMonth: number;
  baseMonthlyPrice: number;
  displayName: string;
  description: string;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxSmsPerMonth: 100,
    maxEmailsPerMonth: 100,
    maxAiRequestsPerMonth: 1,
    maxVoiceMinutesPerMonth: 50,
    baseMonthlyPrice: 0,
    displayName: 'Free',
    description: 'Basic CRM and website with watermark',
  },
  starter: {
    maxSmsPerMonth: 500,
    maxEmailsPerMonth: 500,
    maxAiRequestsPerMonth: 5,
    maxVoiceMinutesPerMonth: 100,
    baseMonthlyPrice: 29,
    displayName: 'Starter',
    description: 'Professional website and basic automation',
  },
  pro: {
    maxSmsPerMonth: 2000,
    maxEmailsPerMonth: 2000,
    maxAiRequestsPerMonth: 25,
    maxVoiceMinutesPerMonth: 300,
    baseMonthlyPrice: 79,
    displayName: 'Pro',
    description: 'AI SMS agent, campaigns, and loyalty program',
  },
  elite: {
    maxSmsPerMonth: 10000,
    maxEmailsPerMonth: 10000,
    maxAiRequestsPerMonth: 100,
    maxVoiceMinutesPerMonth: 1000,
    baseMonthlyPrice: 199,
    displayName: 'Elite',
    description: 'Full feature set including AI voice agent',
  },
  internal: {
    maxSmsPerMonth: 999999,
    maxEmailsPerMonth: 999999,
    maxAiRequestsPerMonth: 999999,
    maxVoiceMinutesPerMonth: 999999,
    baseMonthlyPrice: 0,
    displayName: 'Internal',
    description: 'Family/friends at-cost tier - unlimited usage',
  },
  family_free: {
    maxSmsPerMonth: 999999,
    maxEmailsPerMonth: 999999,
    maxAiRequestsPerMonth: 999999,
    maxVoiceMinutesPerMonth: 999999,
    baseMonthlyPrice: 0,
    displayName: 'Family (Free)',
    description: 'Family tier - all features free, no usage fees',
  },
  family_paid: {
    maxSmsPerMonth: 999999,
    maxEmailsPerMonth: 999999,
    maxAiRequestsPerMonth: 999999,
    maxVoiceMinutesPerMonth: 999999,
    baseMonthlyPrice: 0,
    displayName: 'Family (Fee + Usage)',
    description: 'Family tier - no base fee, pay for usage only',
  },
};

export function getPlanLimits(planTier: string): PlanLimits {
  const tier = (planTier || 'starter').toLowerCase() as PlanTier;
  return PLAN_LIMITS[tier] || PLAN_LIMITS.starter;
}

export function getUsagePercentage(current: number, limit: number): number {
  if (limit <= 0 || limit >= 999999) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

export function isNearLimit(current: number, limit: number, threshold: number = 80): boolean {
  if (limit >= 999999) return false;
  return getUsagePercentage(current, limit) >= threshold;
}

export function isOverLimit(current: number, limit: number): boolean {
  if (limit >= 999999) return false;
  return current >= limit;
}

export function formatLimit(limit: number): string {
  if (limit >= 999999) return 'Unlimited';
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
  return limit.toString();
}
