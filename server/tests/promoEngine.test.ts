import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../db';
import { 
  customers, 
  households, 
  loyaltyPoints, 
  loyaltyTransactions,
  pointsTransactions,
  tenants,
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createTenantDb } from '../tenantDb';
import { awardPromoPoints, fulfillPendingPromos } from '../services/promoEngine';
import { PROMO_RULES } from '../config/promoRules';
import type { TenantInfo } from '../tenantMiddleware';

const TENANT_A: TenantInfo = {
  id: 'test-tenant-promo-a',
  name: 'Test Tenant Promo A',
  subdomain: 'tenant-promo-a',
  isRoot: false,
};

const TENANT_B: TenantInfo = {
  id: 'test-tenant-promo-b',
  name: 'Test Tenant Promo B',
  subdomain: 'tenant-promo-b',
  isRoot: false,
};

describe('Phase 14: Unified Promo Engine', () => {
  beforeAll(async () => {
    // Setup test tenants
    await db.delete(tenants).where(eq(tenants.id, TENANT_A.id));
    await db.delete(tenants).where(eq(tenants.id, TENANT_B.id));
    
    await db.insert(tenants).values([
      {
        id: TENANT_A.id,
        name: TENANT_A.name,
        subdomain: TENANT_A.subdomain,
        isRoot: false,
        planTier: 'pro', // Ensure campaigns feature is available
      },
      {
        id: TENANT_B.id,
        name: TENANT_B.name,
        subdomain: TENANT_B.subdomain,
        isRoot: false,
        planTier: 'starter',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup all test data
    await cleanupAllTestData();
    await db.delete(tenants).where(eq(tenants.id, TENANT_A.id));
    await db.delete(tenants).where(eq(tenants.id, TENANT_B.id));
  });

  beforeEach(async () => {
    // Clean data before each test
    await cleanupAllTestData();
  });

  describe('Basic Award Scenarios', () => {
    it('should award points immediately when mode is immediate', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      // Create test customer
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Alice',
        phone: '555-0001',
        email: 'alice@example.com',
        loyaltyProgramOptIn: true,
        isVip: true,
      }).returning();

      // Award promo points (referral_v1 uses immediate mode)
      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'referral_v1',
        basePoints: 500,
        source: 'referral',
        metadata: { test: 'immediate' },
      });

      expect(result.awarded).toBe(true);
      expect(result.pointsGranted).toBe(500);
      expect(result.reason).toBe('immediate');

      // Verify loyalty points balance updated
      const [loyaltyRecord] = await tenantDb
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customer.id));

      expect(loyaltyRecord).toBeDefined();
      expect(loyaltyRecord.points).toBe(500);

      // Verify points transaction created
      const transactions = await tenantDb
        .select()
        .from(pointsTransactions)
        .where(eq(pointsTransactions.loyaltyPointsId, loyaltyRecord.id));

      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(500);
      expect(transactions[0].source).toBe('campaign'); // Canonical source for analytics

      // Verify loyalty transaction tracking
      const loyaltyTxns = await tenantDb
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.customerId, customer.id));

      expect(loyaltyTxns).toHaveLength(1);
      expect(loyaltyTxns[0].status).toBe('fulfilled');
      expect(loyaltyTxns[0].pointsAwarded).toBe(500);
    });

    it('should create pending award when mode is pending', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      // Create test customer
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Bob',
        phone: '555-0002',
        email: 'bob@example.com',
        loyaltyProgramOptIn: true,
      }).returning();

      // Create a promo rule with pending mode (using welcome_back_v1 which is pending)
      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 1000,
        source: 'campaign',
        metadata: { test: 'pending' },
      });

      expect(result.awarded).toBe(true);
      expect(result.pointsGranted).toBe(0); // Not granted yet
      expect(result.reason).toBe('pending');

      // Verify NO points balance update yet
      const loyaltyRecords = await tenantDb
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customer.id));

      // May exist but should be 0 or not exist at all
      if (loyaltyRecords.length > 0) {
        expect(loyaltyRecords[0].points).toBe(0);
      }

      // Verify loyalty transaction is in pending state
      const [loyaltyTxn] = await tenantDb
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.customerId, customer.id));

      expect(loyaltyTxn).toBeDefined();
      expect(loyaltyTxn.status).toBe('pending');
      expect(loyaltyTxn.pointsAwarded).toBe(1000);
    });
  });

  describe('Anti-Abuse: Per-Customer Limits', () => {
    it('should reject award when customer limit is reached', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Charlie',
        phone: '555-0003',
        loyaltyProgramOptIn: true,
        isVip: true,
      }).returning();

      // Award first time (should succeed)
      const result1 = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 500,
        source: 'campaign',
      });

      expect(result1.awarded).toBe(true);

      // Award second time (should fail - perCustomerLifetimeMax is 1)
      const result2 = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 500,
        source: 'campaign',
      });

      expect(result2.awarded).toBe(false);
      expect(result2.reason).toBe('customer_limit');
    });
  });

  describe('Anti-Abuse: Per-Household Limits', () => {
    it('should reject award when household limit is reached', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      // Create household
      const [household] = await tenantDb.insert(households).values({
        tenantId: TENANT_A.id,
        normalizedAddress: '123 Main St',
      }).returning();

      // Create two customers in same household
      const [customer1] = await tenantDb.insert(customers).values({
        name: 'Dave',
        phone: '555-0004',
        householdId: household.id,
        loyaltyProgramOptIn: true,
      }).returning();

      const [customer2] = await tenantDb.insert(customers).values({
        name: 'Eve',
        phone: '555-0005',
        householdId: household.id,
        loyaltyProgramOptIn: true,
      }).returning();

      // Award to first customer (should succeed)
      const result1 = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer1.id,
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      expect(result1.awarded).toBe(true);

      // Award to second customer in same household (should fail - perHouseholdPerYearMax is 1)
      const result2 = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer2.id,
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      expect(result2.awarded).toBe(false);
      expect(result2.reason).toBe('household_limit');
    });

    it('should allow awards to customers without household when household limit exists', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      // Create customer WITHOUT household
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Frank',
        phone: '555-0006',
        householdId: null,
        loyaltyProgramOptIn: true,
      }).returning();

      // Should still work (household limit only applies to customers in households)
      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      expect(result.awarded).toBe(true);
    });
  });

  describe('Anti-Abuse: Calendar Year Restrictions', () => {
    it('should enforce calendar year limits', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Grace',
        phone: '555-0007',
        loyaltyProgramOptIn: true,
      }).returning();

      // Use referral_v1 which has only annual limits (no lifetime limit)
      // This tests that calendar year boundaries properly reset annual limits
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      await tenantDb.insert(loyaltyTransactions).values({
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'referral_v1',
        deltaPoints: 500,
        source: 'campaign',
        status: 'fulfilled',
        pointsAwarded: 500,
        createdAt: lastYear,
        fulfilledAt: lastYear,
      });

      // Award in current year (should succeed - different calendar year resets annual limit)
      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'referral_v1',
        basePoints: 500,
        source: 'referral',
      });

      expect(result.awarded).toBe(true);
      expect(result.reason).toBe('immediate'); // referral_v1 uses immediate mode
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not count awards from other tenants against limits', async () => {
      const tenantDbA = createTenantDb(TENANT_A);
      const tenantDbB = createTenantDb(TENANT_B);

      // Create customer in Tenant A
      const [customerA] = await tenantDbA.insert(customers).values({
        name: 'Helen A',
        phone: '555-0008-A',
        loyaltyProgramOptIn: true,
      }).returning();

      // Create customer in Tenant B with different phone (unique constraint is global, not tenant-scoped)
      const [customerB] = await tenantDbB.insert(customers).values({
        name: 'Helen B',
        phone: '555-0008-B',
        loyaltyProgramOptIn: true,
      }).returning();

      // Award to Tenant A customer
      const resultA = await awardPromoPoints(tenantDbA, {
        tenantId: TENANT_A.id,
        customerId: customerA.id,
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      expect(resultA.awarded).toBe(true);

      // Award to Tenant B customer (should also succeed - different tenant)
      const resultB = await awardPromoPoints(tenantDbB, {
        tenantId: TENANT_B.id,
        customerId: customerB.id,
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      expect(resultB.awarded).toBe(true);

      // Verify isolation: Tenant A transactions not visible to Tenant B
      const txnsA = await tenantDbA
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.tenantId, TENANT_A.id));

      const txnsB = await tenantDbB
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.tenantId, TENANT_B.id));

      expect(txnsA).toHaveLength(1);
      expect(txnsB).toHaveLength(1);
      expect(txnsA[0].customerId).toBe(customerA.id);
      expect(txnsB[0].customerId).toBe(customerB.id);
    });
  });

  describe('Pending Promo Fulfillment', () => {
    it('should fulfill pending promos when called', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Ivan',
        phone: '555-0009',
        loyaltyProgramOptIn: true,
      }).returning();

      // Award pending promo (welcome_back_v1 is pending mode)
      const awardResult = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 1000,
        source: 'campaign',
      });

      expect(awardResult.awarded).toBe(true);
      expect(awardResult.reason).toBe('pending');

      // Verify pending state (status is stored in metadata)
      let [loyaltyTxn] = await tenantDb
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.customerId, customer.id));

      expect(loyaltyTxn).toBeDefined();
      expect(loyaltyTxn.deltaPoints).toBe(0); // Pending promos have 0 delta_points
      expect(loyaltyTxn.status).toBe('pending'); // Status is now a column, not in metadata
      expect(loyaltyTxn.pointsAwarded).toBe(1000);
      expect(loyaltyTxn.metadata).toMatchObject({ pendingBonusPoints: 1000 });

      // Fulfill pending promos
      const pointsGranted = await fulfillPendingPromos(tenantDb, TENANT_A.id, customer.id);

      expect(pointsGranted).toBe(1000);

      // Verify points were actually granted (new transaction with positive deltaPoints created)
      const fulfilledTxns = await tenantDb
        .select()
        .from(loyaltyTransactions)
        .where(and(
          eq(loyaltyTransactions.customerId, customer.id),
          sql`${loyaltyTransactions.deltaPoints} > 0`
        ));

      expect(fulfilledTxns).toHaveLength(1);
      expect(fulfilledTxns[0].deltaPoints).toBe(1000);
      expect(fulfilledTxns[0].source).toBe('campaign'); // Canonical source for all promo awards

      // Verify points balance updated
      const [loyaltyRecord] = await tenantDb
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customer.id));

      expect(loyaltyRecord.points).toBe(1000);
    });

    it('should not double-fulfill already fulfilled promos', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Jane',
        phone: '555-0010',
        loyaltyProgramOptIn: true,
      }).returning();

      // Award and fulfill (welcome_back_v1 is pending mode)
      await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 1000,
        source: 'campaign',
      });

      const firstFulfill = await fulfillPendingPromos(tenantDb, TENANT_A.id, customer.id);
      expect(firstFulfill).toBe(1000);

      // Try to fulfill again (should return 0)
      const secondFulfill = await fulfillPendingPromos(tenantDb, TENANT_A.id, customer.id);
      expect(secondFulfill).toBe(0);

      // Verify points balance still 1000 (not 2000)
      const [loyaltyRecord] = await tenantDb
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customer.id));

      expect(loyaltyRecord.points).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should reject award for customer not opted into loyalty program', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Kevin',
        phone: '555-0011',
        loyaltyProgramOptIn: false, // Not opted in
      }).returning();

      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      expect(result.awarded).toBe(false);
      expect(result.reason).toBe('not_opted_in_to_loyalty');
    });

    it('should handle non-existent customer gracefully', async () => {
      const tenantDb = createTenantDb(TENANT_A);

      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: 99999, // Non-existent
        promoKey: 'welcome_back_v1',
        basePoints: 250,
        source: 'campaign',
      });

      // Should return false, not throw
      expect(result.awarded).toBe(false);
    });

    it('should handle invalid promo key gracefully', async () => {
      const tenantDb = createTenantDb(TENANT_A);
      
      const [customer] = await tenantDb.insert(customers).values({
        name: 'Laura',
        phone: '555-0012',
        loyaltyProgramOptIn: true,
      }).returning();

      const result = await awardPromoPoints(tenantDb, {
        tenantId: TENANT_A.id,
        customerId: customer.id,
        promoKey: 'invalid_promo_key' as any,
        basePoints: 250,
        source: 'campaign',
      });

      // Should return false with no_rule reason, not throw
      expect(result.awarded).toBe(false);
      expect(result.reason).toBe('no_rule');
    });
  });
});

// Helper: Cleanup all test data
async function cleanupAllTestData() {
  // Clean tenant A
  await db.delete(pointsTransactions).where(
    eq(pointsTransactions.tenantId, TENANT_A.id)
  );
  await db.delete(loyaltyTransactions).where(
    eq(loyaltyTransactions.tenantId, TENANT_A.id)
  );
  await db.delete(loyaltyPoints).where(
    eq(loyaltyPoints.tenantId, TENANT_A.id)
  );
  await db.delete(customers).where(eq(customers.tenantId, TENANT_A.id));
  await db.delete(households).where(eq(households.tenantId, TENANT_A.id));

  // Clean tenant B
  await db.delete(pointsTransactions).where(
    eq(pointsTransactions.tenantId, TENANT_B.id)
  );
  await db.delete(loyaltyTransactions).where(
    eq(loyaltyTransactions.tenantId, TENANT_B.id)
  );
  await db.delete(loyaltyPoints).where(
    eq(loyaltyPoints.tenantId, TENANT_B.id)
  );
  await db.delete(customers).where(eq(customers.tenantId, TENANT_B.id));
  await db.delete(households).where(eq(households.tenantId, TENANT_B.id));
}
