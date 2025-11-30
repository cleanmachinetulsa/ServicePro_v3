/**
 * Promo Code Service
 * 
 * Handles validation and application of promo codes for tenant billing overrides.
 * This is separate from the loyalty promo engine - this service manages
 * subscription discounts, trial extensions, and billing rate adjustments.
 */

import { eq, and, sql, gte, lte, count } from 'drizzle-orm';
import { db } from '../db';
import { 
  promoCodes, 
  promoRedemptions, 
  tenantBillingOverrides,
  tenants,
} from '@shared/schema';
import type { PromoCode, PromoRedemption, TenantBillingOverride } from '@shared/schema';
import {
  type PromoCodeStatus,
  type PromoCodeSummary,
  type PromoCodeDetails,
  type ApplyPromoRequest,
  type ApplyPromoResult,
  type PromoRedemptionRecord,
  PROMO_ERROR_CODES,
} from '@shared/promos';

function getPromoStatus(promo: PromoCode): PromoCodeStatus {
  if (!promo.isActive) return 'inactive';
  
  const now = new Date();
  
  if (promo.startsAt && new Date(promo.startsAt) > now) {
    return 'scheduled';
  }
  
  if (promo.expiresAt && new Date(promo.expiresAt) < now) {
    return 'expired';
  }
  
  return 'active';
}

export async function getAllPromoCodes(): Promise<PromoCodeSummary[]> {
  const promos = await db.select().from(promoCodes).orderBy(sql`${promoCodes.createdAt} DESC`);
  
  const results: PromoCodeSummary[] = [];
  
  for (const promo of promos) {
    const redemptionCount = await db
      .select({ count: count() })
      .from(promoRedemptions)
      .where(eq(promoRedemptions.promoCodeId, promo.id));
    
    results.push({
      id: promo.id,
      code: promo.code,
      label: promo.label,
      description: promo.description,
      status: getPromoStatus(promo),
      isReusable: promo.isReusable,
      maxRedemptions: promo.maxRedemptions,
      currentRedemptions: redemptionCount[0]?.count || 0,
      perTenantLimit: promo.perTenantLimit,
      lockedToEmail: promo.lockedToEmail,
      subscriptionDiscountPercent: promo.subscriptionDiscountPercent,
      usageRateMultiplier: promo.usageRateMultiplier ? parseFloat(promo.usageRateMultiplier) : null,
      trialExtensionDays: promo.trialExtensionDays,
      setOverrideType: promo.setOverrideType,
      appliesToPlan: promo.appliesToPlan,
      startsAt: promo.startsAt?.toISOString() || null,
      expiresAt: promo.expiresAt?.toISOString() || null,
      createdAt: promo.createdAt.toISOString(),
    });
  }
  
  return results;
}

export async function getPromoCodeById(id: number): Promise<PromoCodeDetails | null> {
  const promo = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  
  if (!promo.length) return null;
  
  const p = promo[0];
  
  const redemptions = await db
    .select()
    .from(promoRedemptions)
    .where(eq(promoRedemptions.promoCodeId, id))
    .orderBy(sql`${promoRedemptions.redeemedAt} DESC`)
    .limit(50);
  
  const redemptionCount = await db
    .select({ count: count() })
    .from(promoRedemptions)
    .where(eq(promoRedemptions.promoCodeId, id));
  
  const recentRedemptions: PromoRedemptionRecord[] = redemptions.map(r => ({
    id: r.id,
    tenantId: r.tenantId,
    redeemedByEmail: r.redeemedByEmail,
    redeemedAt: r.redeemedAt.toISOString(),
    context: r.context as { source?: string; path?: string } | null,
  }));
  
  return {
    id: p.id,
    code: p.code,
    label: p.label,
    description: p.description,
    status: getPromoStatus(p),
    isReusable: p.isReusable,
    maxRedemptions: p.maxRedemptions,
    currentRedemptions: redemptionCount[0]?.count || 0,
    perTenantLimit: p.perTenantLimit,
    lockedToEmail: p.lockedToEmail,
    subscriptionDiscountPercent: p.subscriptionDiscountPercent,
    usageRateMultiplier: p.usageRateMultiplier ? parseFloat(p.usageRateMultiplier) : null,
    trialExtensionDays: p.trialExtensionDays,
    setOverrideType: p.setOverrideType,
    appliesToPlan: p.appliesToPlan,
    startsAt: p.startsAt?.toISOString() || null,
    expiresAt: p.expiresAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    createdByAdminId: p.createdByAdminId,
    updatedAt: p.updatedAt.toISOString(),
    recentRedemptions,
  };
}

export async function getPromoCodeByCode(code: string): Promise<PromoCode | null> {
  const result = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code.toUpperCase()))
    .limit(1);
  
  return result[0] || null;
}

export interface CreatePromoCodeArgs {
  code: string;
  label: string;
  description?: string;
  isActive?: boolean;
  appliesToPlan?: string | null;
  subscriptionDiscountPercent?: number;
  usageRateMultiplier?: number | null;
  trialExtensionDays?: number;
  setOverrideType?: PromoCode['setOverrideType'];
  isReusable?: boolean;
  maxRedemptions?: number | null;
  perTenantLimit?: number;
  lockedToEmail?: string | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  createdByAdminId?: number;
}

export async function createPromoCode(args: CreatePromoCodeArgs): Promise<PromoCode> {
  const [created] = await db.insert(promoCodes).values({
    code: args.code.toUpperCase(),
    label: args.label,
    description: args.description || null,
    isActive: args.isActive ?? true,
    appliesToPlan: args.appliesToPlan || null,
    subscriptionDiscountPercent: args.subscriptionDiscountPercent ?? 0,
    usageRateMultiplier: args.usageRateMultiplier?.toString() || null,
    trialExtensionDays: args.trialExtensionDays ?? 0,
    setOverrideType: args.setOverrideType || null,
    isReusable: args.isReusable ?? false,
    maxRedemptions: args.maxRedemptions ?? null,
    perTenantLimit: args.perTenantLimit ?? 1,
    lockedToEmail: args.lockedToEmail?.toLowerCase() || null,
    startsAt: args.startsAt || null,
    expiresAt: args.expiresAt || null,
    createdByAdminId: args.createdByAdminId || null,
  }).returning();
  
  return created;
}

export async function updatePromoCode(id: number, updates: Partial<CreatePromoCodeArgs>): Promise<PromoCode | null> {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (updates.code !== undefined) updateData.code = updates.code.toUpperCase();
  if (updates.label !== undefined) updateData.label = updates.label;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
  if (updates.appliesToPlan !== undefined) updateData.appliesToPlan = updates.appliesToPlan;
  if (updates.subscriptionDiscountPercent !== undefined) updateData.subscriptionDiscountPercent = updates.subscriptionDiscountPercent;
  if (updates.usageRateMultiplier !== undefined) updateData.usageRateMultiplier = updates.usageRateMultiplier?.toString() || null;
  if (updates.trialExtensionDays !== undefined) updateData.trialExtensionDays = updates.trialExtensionDays;
  if (updates.setOverrideType !== undefined) updateData.setOverrideType = updates.setOverrideType;
  if (updates.isReusable !== undefined) updateData.isReusable = updates.isReusable;
  if (updates.maxRedemptions !== undefined) updateData.maxRedemptions = updates.maxRedemptions;
  if (updates.perTenantLimit !== undefined) updateData.perTenantLimit = updates.perTenantLimit;
  if (updates.lockedToEmail !== undefined) updateData.lockedToEmail = updates.lockedToEmail?.toLowerCase() || null;
  if (updates.startsAt !== undefined) updateData.startsAt = updates.startsAt;
  if (updates.expiresAt !== undefined) updateData.expiresAt = updates.expiresAt;
  
  const [updated] = await db
    .update(promoCodes)
    .set(updateData)
    .where(eq(promoCodes.id, id))
    .returning();
  
  return updated || null;
}

export async function deletePromoCode(id: number): Promise<boolean> {
  const result = await db.delete(promoCodes).where(eq(promoCodes.id, id));
  return (result.rowCount ?? 0) > 0;
}

export interface ValidatePromoResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  promo?: PromoCode;
}

export async function validatePromoForRequest(request: ApplyPromoRequest): Promise<ValidatePromoResult> {
  const { code, email, planTier, currentTenantId } = request;
  
  const promo = await getPromoCodeByCode(code);
  
  if (!promo) {
    return {
      valid: false,
      errorCode: PROMO_ERROR_CODES.NOT_FOUND,
      errorMessage: 'Promo code not found',
    };
  }
  
  if (!promo.isActive) {
    return {
      valid: false,
      errorCode: PROMO_ERROR_CODES.INACTIVE,
      errorMessage: 'This promo code is no longer active',
    };
  }
  
  const now = new Date();
  
  if (promo.startsAt && new Date(promo.startsAt) > now) {
    return {
      valid: false,
      errorCode: PROMO_ERROR_CODES.NOT_STARTED,
      errorMessage: 'This promo code is not yet valid',
    };
  }
  
  if (promo.expiresAt && new Date(promo.expiresAt) < now) {
    return {
      valid: false,
      errorCode: PROMO_ERROR_CODES.EXPIRED,
      errorMessage: 'This promo code has expired',
    };
  }
  
  if (promo.appliesToPlan && promo.appliesToPlan !== planTier) {
    return {
      valid: false,
      errorCode: PROMO_ERROR_CODES.PLAN_MISMATCH,
      errorMessage: `This promo code only applies to the ${promo.appliesToPlan} plan`,
    };
  }
  
  if (promo.lockedToEmail && promo.lockedToEmail.toLowerCase() !== email.toLowerCase()) {
    return {
      valid: false,
      errorCode: PROMO_ERROR_CODES.EMAIL_MISMATCH,
      errorMessage: 'This promo code is reserved for a specific user',
    };
  }
  
  if (promo.maxRedemptions !== null) {
    const redemptionCount = await db
      .select({ count: count() })
      .from(promoRedemptions)
      .where(eq(promoRedemptions.promoCodeId, promo.id));
    
    if ((redemptionCount[0]?.count || 0) >= promo.maxRedemptions) {
      return {
        valid: false,
        errorCode: PROMO_ERROR_CODES.MAX_REDEMPTIONS,
        errorMessage: 'This promo code has reached its maximum redemptions',
      };
    }
  }
  
  if (currentTenantId && promo.perTenantLimit > 0) {
    const tenantRedemptions = await db
      .select({ count: count() })
      .from(promoRedemptions)
      .where(and(
        eq(promoRedemptions.promoCodeId, promo.id),
        eq(promoRedemptions.tenantId, currentTenantId)
      ));
    
    if ((tenantRedemptions[0]?.count || 0) >= promo.perTenantLimit) {
      return {
        valid: false,
        errorCode: PROMO_ERROR_CODES.TENANT_LIMIT,
        errorMessage: 'This promo code has already been used for your account',
      };
    }
    
    const existingOverride = await db
      .select()
      .from(tenantBillingOverrides)
      .where(eq(tenantBillingOverrides.tenantId, currentTenantId))
      .limit(1);
    
    if (existingOverride.length > 0 && existingOverride[0].appliedPromoCodeId === promo.id) {
      return {
        valid: false,
        errorCode: PROMO_ERROR_CODES.ALREADY_APPLIED,
        errorMessage: 'This promo code has already been applied to your account',
      };
    }
  }
  
  return {
    valid: true,
    promo,
  };
}

export interface ApplyPromoToTenantContext {
  source?: string;
  path?: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function applyPromoToTenant(
  tenantId: string, 
  promo: PromoCode, 
  email: string,
  context?: ApplyPromoToTenantContext
): Promise<ApplyPromoResult> {
  const existingRedemption = await db
    .select()
    .from(promoRedemptions)
    .where(and(
      eq(promoRedemptions.promoCodeId, promo.id),
      eq(promoRedemptions.tenantId, tenantId)
    ))
    .limit(1);
  
  if (existingRedemption.length > 0) {
    return {
      ok: false,
      errorCode: PROMO_ERROR_CODES.ALREADY_APPLIED,
      errorMessage: 'This promo code has already been applied to your account',
    };
  }
  
  await db.insert(promoRedemptions).values({
    promoCodeId: promo.id,
    tenantId,
    redeemedByEmail: email.toLowerCase(),
    context: context || null,
  });
  
  const existingOverride = await db
    .select()
    .from(tenantBillingOverrides)
    .where(eq(tenantBillingOverrides.tenantId, tenantId))
    .limit(1);
  
  if (existingOverride.length > 0) {
    await db
      .update(tenantBillingOverrides)
      .set({
        overrideType: promo.setOverrideType,
        subscriptionDiscountPercent: promo.subscriptionDiscountPercent,
        usageRateMultiplier: promo.usageRateMultiplier,
        appliedPromoCodeId: promo.id,
        notes: `Applied promo code: ${promo.code}`,
        updatedAt: new Date(),
      })
      .where(eq(tenantBillingOverrides.tenantId, tenantId));
  } else {
    await db.insert(tenantBillingOverrides).values({
      tenantId,
      overrideType: promo.setOverrideType,
      subscriptionDiscountPercent: promo.subscriptionDiscountPercent,
      usageRateMultiplier: promo.usageRateMultiplier,
      appliedPromoCodeId: promo.id,
      notes: `Applied promo code: ${promo.code}`,
    });
  }
  
  console.log(`[PROMO CODE] Applied promo ${promo.code} to tenant ${tenantId}: ${promo.subscriptionDiscountPercent}% off, +${promo.trialExtensionDays} trial days`);
  
  return {
    ok: true,
    applied: {
      promoId: promo.id,
      promoCode: promo.code,
      subscriptionDiscountPercent: promo.subscriptionDiscountPercent,
      usageRateMultiplier: promo.usageRateMultiplier ? parseFloat(promo.usageRateMultiplier) : null,
      trialExtensionDays: promo.trialExtensionDays,
      setOverrideType: promo.setOverrideType,
    },
  };
}

export async function getTenantBillingOverride(tenantId: string): Promise<TenantBillingOverride | null> {
  const result = await db
    .select()
    .from(tenantBillingOverrides)
    .where(eq(tenantBillingOverrides.tenantId, tenantId))
    .limit(1);
  
  return result[0] || null;
}

export async function getRedemptionsByPromoId(promoId: number): Promise<PromoRedemption[]> {
  return await db
    .select()
    .from(promoRedemptions)
    .where(eq(promoRedemptions.promoCodeId, promoId))
    .orderBy(sql`${promoRedemptions.redeemedAt} DESC`);
}
