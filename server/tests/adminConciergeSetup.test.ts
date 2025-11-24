/**
 * Phase 5 - Concierge Setup Dashboard Integration Tests
 * 
 * Tests for owner-only tenant onboarding endpoint
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../db';
import { tenants, tenantConfig, tenantPhoneConfig, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { registerAdminConciergeSetupRoutes } from '../routes.adminConciergeSetup';
import { tenantMiddleware } from '../tenantMiddleware';

describe('Admin Concierge Setup - Integration Tests (Phase 5)', () => {
  let ownerUserId: number;
  let managerUserId: number;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    // Create test users in database
    const [ownerUser] = await db
      .insert(users)
      .values({
        username: `test-owner-${nanoid(8)}`,
        password: 'hashed-password',
        role: 'owner',
        fullName: 'Test Owner',
        email: 'test-owner@example.com',
      })
      .returning();
    ownerUserId = ownerUser.id;

    const [managerUser] = await db
      .insert(users)
      .values({
        username: `test-manager-${nanoid(8)}`,
        password: 'hashed-password',
        role: 'manager',
        fullName: 'Test Manager',
        email: 'test-manager@example.com',
      })
      .returning();
    managerUserId = managerUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    for (const tenantId of createdTenantIds) {
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.tenantId, tenantId));
      await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }

    await db.delete(users).where(eq(users.id, ownerUserId));
    await db.delete(users).where(eq(users.id, managerUserId));
  });

  beforeEach(() => {
    // Reset created tenants tracking
    createdTenantIds.length = 0;
  });

  function createTestApp(mockUserId?: number, mockRole?: string) {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(express.urlencoded({ extended: false }));

    // Add tenant middleware to set up req.tenantDb
    testApp.use(tenantMiddleware);

    // Mock session for testing
    testApp.use((req: any, res, next) => {
      if (mockUserId !== undefined) {
        req.session = {
          userId: mockUserId,
          twoFactorVerified: true, // Bypass 2FA for tests
        };
      }
      next();
    });

    registerAdminConciergeSetupRoutes(testApp);
    return testApp;
  }

  describe('POST /api/admin/concierge/onboard-tenant', () => {
    it('should successfully create a tenant with complete Phase 5 data (owner)', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const uniqueId = nanoid(8);
      const requestBody = {
        businessName: `Test Auto Detail Shop ${uniqueId}`,
        slug: `test-auto-detail-${uniqueId}`,
        contactName: 'John Smith',
        contactEmail: 'contact@testshop.com',
        primaryCity: 'Tulsa',
        planTier: 'starter',
        status: 'trialing',
        industry: 'Auto Detailing',
        phoneNumber: '+19185551234',
        messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        ivrMode: 'simple',
        websiteUrl: 'https://testshop.com',
        primaryColor: '#3b82f6',
        accentColor: '#ec4899',
        internalNotes: 'Test tenant creation',
        sendWelcomeEmail: true,
        sendWelcomeSms: false,
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.businessName).toBe(requestBody.businessName);
      expect(response.body.tenant.slug).toBe(requestBody.slug);
      expect(response.body.tenant.planTier).toBe('starter');
      expect(response.body.tenant.status).toBe('trialing');
      expect(response.body.tenant.industry).toBe('Auto Detailing');
      expect(response.body.tenant.phoneNumber).toBe('+19185551234');
      expect(response.body.tenant.ivrMode).toBe('simple');

      const tenantId = response.body.tenant.tenantId;
      createdTenantIds.push(tenantId);

      // Verify tenant was created in database
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      expect(tenant).toBeDefined();
      expect(tenant.name).toBe(requestBody.businessName);
      expect(tenant.slug).toBe(requestBody.slug);
      expect(tenant.status).toBe('trialing');
      expect(tenant.isRoot).toBe(false);

      // Verify tenant config
      const [config] = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      expect(config).toBeDefined();
      expect(config.businessName).toBe(requestBody.businessName);
      expect(config.tier).toBe('starter');
      expect(config.industry).toBe('Auto Detailing');
      expect(config.primaryContactName).toBe('John Smith');
      expect(config.primaryContactEmail).toBe('contact@testshop.com');
      expect(config.primaryCity).toBe('Tulsa');
      expect(config.websiteUrl).toBe('https://testshop.com');
      expect(config.primaryColor).toBe('#3b82f6');
      expect(config.accentColor).toBe('#ec4899');
      expect(config.internalNotes).toBe('Test tenant creation');

      // Verify phone config was created
      const phoneConfigs = await db
        .select()
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.tenantId, tenantId));

      expect(phoneConfigs.length).toBe(1);
      expect(phoneConfigs[0].phoneNumber).toBe('+19185551234');
      expect(phoneConfigs[0].messagingServiceSid).toBe('MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(phoneConfigs[0].ivrMode).toBe('simple');
    });

    it('should successfully create a tenant with minimal data (auto-generate slug)', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const uniqueId = nanoid(8);
      const requestBody = {
        businessName: `Test Minimal Shop ${uniqueId}`,
        contactEmail: 'contact@testshop.com',
        primaryCity: 'Tulsa',
        planTier: 'starter',
        phoneNumber: '+19185559999',
        ivrMode: 'simple',
        status: 'active',
        industry: 'Auto Detailing',
        internalNotes: 'Test tenant creation',
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.businessName).toBe(requestBody.businessName);
      expect(response.body.tenant.planTier).toBe('starter');
      expect(response.body.tenant.industry).toBe('Auto Detailing');
      expect(response.body.tenant.slug).toBeTruthy(); // Auto-generated
      expect(response.body.tenant.phoneNumber).toBe('+19185559999');

      const tenantId = response.body.tenant.tenantId;
      createdTenantIds.push(tenantId);

      // Verify tenant was created in database
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      expect(tenant).toBeDefined();
      expect(tenant.name).toBe(requestBody.businessName);
      expect(tenant.isRoot).toBe(false);
      expect(tenant.slug).toBeTruthy();

      // Verify tenant config
      const [config] = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      expect(config).toBeDefined();
      expect(config.businessName).toBe(requestBody.businessName);
      expect(config.tier).toBe('starter');
      expect(config.industry).toBe('Auto Detailing');
      expect(config.primaryContactEmail).toBe('contact@testshop.com');
      expect(config.primaryCity).toBe('Tulsa');
      expect(config.internalNotes).toBe('Test tenant creation');
    });

    it('should support all plan tiers including internal tier', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const tiers = ['starter', 'pro', 'elite', 'internal'];
      
      for (const tier of tiers) {
        const uniqueId = nanoid(8);
        const requestBody = {
          businessName: `Test ${tier.charAt(0).toUpperCase() + tier.slice(1)} Shop ${uniqueId}`,
          planTier: tier,
          phoneNumber: `+1918555${Math.floor(1000 + Math.random() * 9000)}`,
          ivrMode: 'simple',
          status: 'active',
        };

        const response = await request(testApp)
          .post('/api/admin/concierge/onboard-tenant')
          .send(requestBody)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.tenant.planTier).toBe(tier);
        expect(response.body.tenant.slug).toBeTruthy(); // Verify slug is generated

        createdTenantIds.push(response.body.tenant.tenantId);
      }
    });

    it('should support all status values', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const statuses = ['trialing', 'active', 'past_due', 'suspended', 'cancelled'];
      
      for (const status of statuses) {
        const uniqueId = nanoid(8);
        const requestBody = {
          businessName: `Test ${status.replace('_', ' ')} Shop ${uniqueId}`,
          planTier: 'starter',
          phoneNumber: `+1918555${Math.floor(1000 + Math.random() * 9000)}`,
          ivrMode: 'simple',
          status: status,
        };

        const response = await request(testApp)
          .post('/api/admin/concierge/onboard-tenant')
          .send(requestBody)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.tenant.status).toBe(status);
        expect(response.body.tenant.slug).toBeTruthy(); // Verify slug is generated

        createdTenantIds.push(response.body.tenant.tenantId);
      }
    });

    it('should reject request with missing required fields', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const requestBody = {
        businessName: 'Test Shop',
        // Missing planTier
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should reject invalid plan tier', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const requestBody = {
        businessName: 'Test Shop',
        planTier: 'invalid-tier',
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject duplicate business names', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const requestBody = {
        businessName: 'Duplicate Test Shop',
        planTier: 'starter',
        phoneNumber: '+19185558888',
        ivrMode: 'simple',
        status: 'active',
      };

      // Create first tenant
      const response1 = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      createdTenantIds.push(response1.body.tenant.tenantId);

      // Try to create duplicate
      const response2 = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(409);

      expect(response2.body.success).toBe(false);
      expect(response2.body.error).toContain('already exists');
    });

    it('should reject request from manager role (not owner)', async () => {
      const testApp = createTestApp(managerUserId, 'manager');

      const requestBody = {
        businessName: 'Unauthorized Shop',
        planTier: 'starter',
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(403);

      expect(response.body.error).toContain('owner role required');
    });

    it('should reject unauthenticated requests', async () => {
      const testApp = createTestApp(); // No user ID provided

      const requestBody = {
        businessName: 'Unauthenticated Shop',
        planTier: 'starter',
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    it('should handle optional fields correctly', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const uniqueId = nanoid(8);
      const requestBody = {
        businessName: `Minimal Shop ${uniqueId}`,
        planTier: 'elite',
        phoneNumber: '+19185557777',
        ivrMode: 'simple',
        status: 'trialing',
        // All other optional fields omitted
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      expect(response.body.success).toBe(true);

      const tenantId = response.body.tenant.tenantId;
      createdTenantIds.push(tenantId);

      // Verify config has null for optional fields
      const [config] = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      expect(config.industry).toBeNull();
      expect(config.primaryContactEmail).toBeNull();
      expect(config.primaryCity).toBeNull();
      expect(config.internalNotes).toBeNull();
    });

    it('should handle empty string optional fields', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const uniqueId = nanoid(8);
      const requestBody = {
        businessName: `Empty Fields Shop ${uniqueId}`,
        planTier: 'pro',
        phoneNumber: '+19185556666',
        ivrMode: 'simple',
        status: 'active',
        contactEmail: '',
        primaryCity: '',
        industry: '',
        internalNotes: '',
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      expect(response.body.success).toBe(true);

      const tenantId = response.body.tenant.tenantId;
      createdTenantIds.push(tenantId);

      // Verify config has null for empty strings
      const [config] = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      expect(config.industry).toBeNull();
      expect(config.primaryContactEmail).toBeNull();
      expect(config.primaryCity).toBeNull();
      expect(config.internalNotes).toBeNull();
    });
  });
});
