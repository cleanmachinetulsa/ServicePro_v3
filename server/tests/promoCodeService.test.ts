import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../db';
import { 
  promoCodes, 
  promoRedemptions, 
  tenantBillingOverrides,
  tenants,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { 
  getAllPromoCodes,
  getPromoCodeById,
  getPromoCodeByCode,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoForRequest,
  applyPromoToTenant,
  getTenantBillingOverride,
  promoCodeService,
} from '../services/promoCodeService';
import { PROMO_ERROR_CODES } from '@shared/promos';

const TEST_TENANT_ID = 'test-promo-service-tenant';

describe('Promo Code Service', () => {
  let testPromoId: number;

  beforeAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    await db.insert(tenants).values({
      id: TEST_TENANT_ID,
      name: 'Test Promo Service Tenant',
      subdomain: 'test-promo-svc',
      isRoot: false,
      planTier: 'pro',
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('createPromoCode', () => {
    it('should create a promo code with default values', async () => {
      const promo = await createPromoCode({
        code: 'TEST10',
        label: 'Test 10% Off',
        subscriptionDiscountPercent: 10,
      });

      expect(promo).toBeDefined();
      expect(promo.code).toBe('TEST10');
      expect(promo.label).toBe('Test 10% Off');
      expect(promo.isActive).toBe(true);
      expect(promo.isInternal).toBe(false);
      expect(promo.isReusable).toBe(false);
      expect(promo.perTenantLimit).toBe(1);
      expect(promo.subscriptionDiscountPercent).toBe(10);

      testPromoId = promo.id;
    });

    it('should create an internal promo code', async () => {
      const promo = await createPromoCode({
        code: 'INTERNAL50',
        label: 'Internal 50% Off',
        subscriptionDiscountPercent: 50,
        isInternal: true,
        setOverrideType: 'internal_test',
      });

      expect(promo.isInternal).toBe(true);
      expect(promo.setOverrideType).toBe('internal_test');
    });

    it('should uppercase the promo code', async () => {
      const promo = await createPromoCode({
        code: 'lowercase',
        label: 'Lowercase Test',
      });

      expect(promo.code).toBe('LOWERCASE');
    });

    it('should lowercase the locked email', async () => {
      const promo = await createPromoCode({
        code: 'LOCKED1',
        label: 'Locked Promo',
        lockedToEmail: 'Test@Example.COM',
      });

      expect(promo.lockedToEmail).toBe('test@example.com');
    });

    it('should create a reusable promo with max redemptions', async () => {
      const promo = await createPromoCode({
        code: 'REUSE100',
        label: 'Reusable Promo',
        subscriptionDiscountPercent: 25,
        isReusable: true,
        maxRedemptions: 100,
        perTenantLimit: 1,
      });

      expect(promo.isReusable).toBe(true);
      expect(promo.maxRedemptions).toBe(100);
    });

    it('should set trial extension days', async () => {
      const promo = await createPromoCode({
        code: 'TRIAL30',
        label: '30 Day Trial Extension',
        trialExtensionDays: 30,
      });

      expect(promo.trialExtensionDays).toBe(30);
    });
  });

  describe('getPromoCodeByCode', () => {
    beforeEach(async () => {
      await createPromoCode({
        code: 'FINDME',
        label: 'Find Me Promo',
        subscriptionDiscountPercent: 15,
      });
    });

    it('should find promo by exact code', async () => {
      const promo = await getPromoCodeByCode('FINDME');
      expect(promo).toBeDefined();
      expect(promo?.code).toBe('FINDME');
    });

    it('should find promo case-insensitively', async () => {
      const promo = await getPromoCodeByCode('findme');
      expect(promo).toBeDefined();
      expect(promo?.code).toBe('FINDME');
    });

    it('should return null for non-existent code', async () => {
      const promo = await getPromoCodeByCode('NOTEXIST');
      expect(promo).toBeNull();
    });
  });

  describe('updatePromoCode', () => {
    let promoId: number;

    beforeEach(async () => {
      const promo = await createPromoCode({
        code: 'UPDATE1',
        label: 'Original Label',
        subscriptionDiscountPercent: 10,
      });
      promoId = promo.id;
    });

    it('should update label', async () => {
      const updated = await updatePromoCode(promoId, { label: 'New Label' });
      expect(updated?.label).toBe('New Label');
    });

    it('should update isInternal flag', async () => {
      const updated = await updatePromoCode(promoId, { isInternal: true });
      expect(updated?.isInternal).toBe(true);
    });

    it('should deactivate promo', async () => {
      const updated = await updatePromoCode(promoId, { isActive: false });
      expect(updated?.isActive).toBe(false);
    });

    it('should return null for non-existent promo', async () => {
      const updated = await updatePromoCode(99999, { label: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('deletePromoCode', () => {
    it('should delete an existing promo', async () => {
      const promo = await createPromoCode({
        code: 'DELETE1',
        label: 'To Delete',
      });

      const deleted = await deletePromoCode(promo.id);
      expect(deleted).toBe(true);

      const found = await getPromoCodeByCode('DELETE1');
      expect(found).toBeNull();
    });

    it('should return false for non-existent promo', async () => {
      const deleted = await deletePromoCode(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('validatePromoForRequest', () => {
    it('should validate active promo successfully', async () => {
      const promo = await createPromoCode({
        code: 'VALID1',
        label: 'Valid Promo',
        subscriptionDiscountPercent: 20,
      });

      const result = await validatePromoForRequest({
        code: 'VALID1',
        email: 'test@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(true);
      expect(result.promo).toBeDefined();
    });

    it('should reject non-existent promo', async () => {
      const result = await validatePromoForRequest({
        code: 'NOTEXIST',
        email: 'test@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.NOT_FOUND);
    });

    it('should reject inactive promo', async () => {
      await createPromoCode({
        code: 'INACTIVE1',
        label: 'Inactive Promo',
        isActive: false,
      });

      const result = await validatePromoForRequest({
        code: 'INACTIVE1',
        email: 'test@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.INACTIVE);
    });

    it('should reject expired promo', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await createPromoCode({
        code: 'EXPIRED1',
        label: 'Expired Promo',
        expiresAt: yesterday,
      });

      const result = await validatePromoForRequest({
        code: 'EXPIRED1',
        email: 'test@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.EXPIRED);
    });

    it('should reject promo not yet started', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await createPromoCode({
        code: 'FUTURE1',
        label: 'Future Promo',
        startsAt: tomorrow,
      });

      const result = await validatePromoForRequest({
        code: 'FUTURE1',
        email: 'test@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.NOT_STARTED);
    });

    it('should reject promo for wrong plan', async () => {
      await createPromoCode({
        code: 'PROONLY',
        label: 'Pro Only Promo',
        appliesToPlan: 'elite',
      });

      const result = await validatePromoForRequest({
        code: 'PROONLY',
        email: 'test@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.PLAN_MISMATCH);
    });

    it('should reject promo locked to different email', async () => {
      await createPromoCode({
        code: 'LOCKED2',
        label: 'Locked Promo',
        lockedToEmail: 'vip@example.com',
      });

      const result = await validatePromoForRequest({
        code: 'LOCKED2',
        email: 'other@example.com',
        planTier: 'pro',
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.EMAIL_MISMATCH);
    });

    it('should accept promo locked to matching email', async () => {
      await createPromoCode({
        code: 'LOCKED3',
        label: 'Locked Promo',
        lockedToEmail: 'vip@example.com',
      });

      const result = await validatePromoForRequest({
        code: 'LOCKED3',
        email: 'VIP@EXAMPLE.COM', // Case insensitive
        planTier: 'pro',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('applyPromoToTenant', () => {
    it('should apply promo and create billing override', async () => {
      const promo = await createPromoCode({
        code: 'APPLY1',
        label: 'Apply Test',
        subscriptionDiscountPercent: 25,
        trialExtensionDays: 14,
        setOverrideType: 'partner',
      });

      const result = await applyPromoToTenant(
        TEST_TENANT_ID,
        promo,
        'test@example.com',
        { source: 'test' }
      );

      expect(result.ok).toBe(true);
      expect(result.applied?.subscriptionDiscountPercent).toBe(25);
      expect(result.applied?.trialExtensionDays).toBe(14);

      const override = await getTenantBillingOverride(TEST_TENANT_ID);
      expect(override).toBeDefined();
      expect(override?.subscriptionDiscountPercent).toBe(25);
      expect(override?.overrideType).toBe('partner');
    });

    it('should reject duplicate application', async () => {
      const promo = await createPromoCode({
        code: 'NODUP1',
        label: 'No Duplicate Test',
        subscriptionDiscountPercent: 10,
      });

      await applyPromoToTenant(TEST_TENANT_ID, promo, 'test@example.com');
      const result = await applyPromoToTenant(TEST_TENANT_ID, promo, 'test@example.com');

      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe(PROMO_ERROR_CODES.ALREADY_APPLIED);
    });
  });

  describe('getAllPromoCodes', () => {
    beforeEach(async () => {
      await createPromoCode({ code: 'LIST1', label: 'List 1', isInternal: false });
      await createPromoCode({ code: 'LIST2', label: 'List 2', isInternal: true });
      await createPromoCode({ code: 'LIST3', label: 'List 3', isActive: false });
    });

    it('should return all promo codes with summary info', async () => {
      const promos = await getAllPromoCodes();
      
      const list1 = promos.find(p => p.code === 'LIST1');
      const list2 = promos.find(p => p.code === 'LIST2');
      const list3 = promos.find(p => p.code === 'LIST3');

      expect(list1).toBeDefined();
      expect(list1?.isInternal).toBe(false);
      expect(list1?.status).toBe('active');

      expect(list2).toBeDefined();
      expect(list2?.isInternal).toBe(true);
      expect(list2?.status).toBe('active');

      expect(list3).toBeDefined();
      expect(list3?.status).toBe('inactive');
    });

    it('should include currentRedemptions count', async () => {
      const promo = await createPromoCode({
        code: 'COUNT1',
        label: 'Count Test',
        isReusable: true,
      });

      await db.insert(promoRedemptions).values({
        promoCodeId: promo.id,
        tenantId: TEST_TENANT_ID,
        redeemedByEmail: 'test@example.com',
      });

      const promos = await getAllPromoCodes();
      const count1 = promos.find(p => p.code === 'COUNT1');

      expect(count1?.currentRedemptions).toBe(1);
    });
  });

  describe('getPromoCodeById', () => {
    it('should return detailed promo info', async () => {
      const promo = await createPromoCode({
        code: 'DETAIL1',
        label: 'Detail Test',
        description: 'A detailed description',
        subscriptionDiscountPercent: 30,
        isInternal: true,
      });

      await db.insert(promoRedemptions).values({
        promoCodeId: promo.id,
        tenantId: TEST_TENANT_ID,
        redeemedByEmail: 'user@example.com',
      });

      const details = await getPromoCodeById(promo.id);

      expect(details).toBeDefined();
      expect(details?.code).toBe('DETAIL1');
      expect(details?.description).toBe('A detailed description');
      expect(details?.isInternal).toBe(true);
      expect(details?.recentRedemptions).toHaveLength(1);
      expect(details?.recentRedemptions[0].tenantId).toBe(TEST_TENANT_ID);
    });

    it('should return null for non-existent promo', async () => {
      const details = await getPromoCodeById(99999);
      expect(details).toBeNull();
    });
  });

  describe('promoCodeService.applyPromoCode (combined flow)', () => {
    it('should validate and apply promo in one call', async () => {
      await createPromoCode({
        code: 'COMBO1',
        label: 'Combo Test',
        subscriptionDiscountPercent: 40,
        trialExtensionDays: 7,
      });

      const result = await promoCodeService.applyPromoCode({
        code: 'COMBO1',
        currentTenantId: TEST_TENANT_ID,
        email: 'combo@example.com',
        planTier: 'pro',
      });

      expect(result.ok).toBe(true);
      expect(result.applied).toBeDefined();
      expect(result.applied?.subscriptionDiscountPercent).toBe(40);
      expect(result.applied?.trialExtensionDays).toBe(7);
    });
  });
});

async function cleanupTestData() {
  await db.delete(tenantBillingOverrides).where(eq(tenantBillingOverrides.tenantId, TEST_TENANT_ID));
  await db.delete(promoRedemptions).where(eq(promoRedemptions.tenantId, TEST_TENANT_ID));
  
  const testPromos = await db.select().from(promoCodes);
  for (const promo of testPromos) {
    if (promo.code.startsWith('TEST') || 
        promo.code.startsWith('INTERNAL') ||
        promo.code.startsWith('LOWERCASE') ||
        promo.code.startsWith('LOCKED') ||
        promo.code.startsWith('REUSE') ||
        promo.code.startsWith('TRIAL') ||
        promo.code.startsWith('FINDME') ||
        promo.code.startsWith('UPDATE') ||
        promo.code.startsWith('DELETE') ||
        promo.code.startsWith('VALID') ||
        promo.code.startsWith('NOTEXIST') ||
        promo.code.startsWith('INACTIVE') ||
        promo.code.startsWith('EXPIRED') ||
        promo.code.startsWith('FUTURE') ||
        promo.code.startsWith('PROONLY') ||
        promo.code.startsWith('APPLY') ||
        promo.code.startsWith('NODUP') ||
        promo.code.startsWith('LIST') ||
        promo.code.startsWith('COUNT') ||
        promo.code.startsWith('DETAIL') ||
        promo.code.startsWith('COMBO')) {
      await db.delete(promoRedemptions).where(eq(promoRedemptions.promoCodeId, promo.id));
      await db.delete(promoCodes).where(eq(promoCodes.id, promo.id));
    }
  }
}
