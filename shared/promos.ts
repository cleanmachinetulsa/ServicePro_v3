/**
 * Promo Code Types
 * 
 * Shared types for the promo code system used by both server and client.
 */

export type PromoCodeStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

export type PromoOverrideType = 'friends_and_family' | 'partner' | 'internal_test' | 'beta_user';

export interface PromoCodeSummary {
  id: number;
  code: string;
  label: string;
  description: string | null;
  status: PromoCodeStatus;
  isReusable: boolean;
  maxRedemptions: number | null;
  currentRedemptions: number;
  perTenantLimit: number;
  lockedToEmail: string | null;
  subscriptionDiscountPercent: number;
  usageRateMultiplier: number | null;
  trialExtensionDays: number;
  setOverrideType: PromoOverrideType | null;
  appliesToPlan: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface PromoCodeDetails extends PromoCodeSummary {
  createdByAdminId: number | null;
  updatedAt: string;
  recentRedemptions: PromoRedemptionRecord[];
}

export interface PromoRedemptionRecord {
  id: number;
  tenantId: string;
  redeemedByEmail: string | null;
  redeemedAt: string;
  context: {
    source?: string;
    path?: string;
  } | null;
}

export interface ApplyPromoRequest {
  code: string;
  email: string;
  planTier: string;
  currentTenantId?: string;
}

export interface ApplyPromoResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  applied?: {
    promoId: number;
    promoCode: string;
    subscriptionDiscountPercent: number;
    usageRateMultiplier: number | null;
    trialExtensionDays: number;
    setOverrideType: PromoOverrideType | null;
  };
}

export interface CreatePromoCodeRequest {
  code: string;
  label: string;
  description?: string;
  isActive?: boolean;
  appliesToPlan?: string | null;
  subscriptionDiscountPercent?: number;
  usageRateMultiplier?: number | null;
  trialExtensionDays?: number;
  setOverrideType?: PromoOverrideType | null;
  isReusable?: boolean;
  maxRedemptions?: number | null;
  perTenantLimit?: number;
  lockedToEmail?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface UpdatePromoCodeRequest extends Partial<CreatePromoCodeRequest> {
  id: number;
}

export const PROMO_ERROR_CODES = {
  NOT_FOUND: 'PROMO_NOT_FOUND',
  INACTIVE: 'PROMO_INACTIVE',
  EXPIRED: 'PROMO_EXPIRED',
  NOT_STARTED: 'PROMO_NOT_STARTED',
  PLAN_MISMATCH: 'PLAN_MISMATCH',
  EMAIL_MISMATCH: 'EMAIL_LOCKED_MISMATCH',
  MAX_REDEMPTIONS: 'MAX_REDEMPTIONS_REACHED',
  TENANT_LIMIT: 'TENANT_LIMIT_REACHED',
  ALREADY_APPLIED: 'ALREADY_APPLIED_TO_TENANT',
} as const;

export type PromoErrorCode = typeof PROMO_ERROR_CODES[keyof typeof PROMO_ERROR_CODES];

export function generatePromoCode(prefix?: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix ? prefix.toUpperCase() : '';
  const remaining = 8 - code.length;
  for (let i = 0; i < remaining; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatPromoDiscount(discountPercent: number, trialDays: number): string {
  const parts: string[] = [];
  if (discountPercent > 0) {
    parts.push(`${discountPercent}% off subscription`);
  }
  if (trialDays > 0) {
    parts.push(`+${trialDays} day${trialDays > 1 ? 's' : ''} trial`);
  }
  return parts.length > 0 ? parts.join(' and ') : 'No discount';
}
