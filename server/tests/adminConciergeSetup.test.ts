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
    it('should successfully create a tenant with complete data (owner)', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const requestBody = {
        businessName: 'Test Auto Detail Shop',
        contactEmail: 'contact@testshop.com',
        primaryCity: 'Tulsa',
        planTier: 'starter',
        industry: 'Auto Detailing',
        internalNotes: 'Test tenant creation',
        createPhoneConfigStub: false,
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.businessName).toBe('Test Auto Detail Shop');
      expect(response.body.tenant.planTier).toBe('starter');
      expect(response.body.tenant.industry).toBe('Auto Detailing');
      expect(response.body.tenant.hasPhoneConfigStub).toBe(false);

      const tenantId = response.body.tenant.tenantId;
      createdTenantIds.push(tenantId);

      // Verify tenant was created in database
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      expect(tenant).toBeDefined();
      expect(tenant.name).toBe('Test Auto Detail Shop');
      expect(tenant.isRoot).toBe(false);

      // Verify tenant config
      const [config] = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      expect(config).toBeDefined();
      expect(config.businessName).toBe('Test Auto Detail Shop');
      expect(config.tier).toBe('starter');
      expect(config.industry).toBe('Auto Detailing');
      expect(config.primaryContactEmail).toBe('contact@testshop.com');
      expect(config.primaryCity).toBe('Tulsa');
      expect(config.internalNotes).toBe('Test tenant creation');
    });

    it('should create tenant with phone config stub when requested', async () => {
      const testApp = createTestApp(ownerUserId, 'owner');

      const requestBody = {
        businessName: 'Test Car Wash Co',
        planTier: 'pro',
        createPhoneConfigStub: true,
      };

      const response = await request(testApp)
        .post('/api/admin/concierge/onboard-tenant')
        .send(requestBody)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.tenant.hasPhoneConfigStub).toBe(true);

      const tenantId = response.body.tenant.tenantId;
      createdTenantIds.push(tenantId);

      // Verify phone config was created
      const phoneConfigs = await db
        .select()
        .from(tenantPhoneConfig)
        .where(eq(tenantPhoneConfig.tenantId, tenantId));

      expect(phoneConfigs.length).toBe(1);
      expect(phoneConfigs[0].ivrMode).toBe('simple');
      expect(phoneConfigs[0].phoneNumber).toMatch(/^\+1555/); // Placeholder number
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

      const requestBody = {
        businessName: 'Minimal Shop',
        planTier: 'elite',
        // All optional fields omitted
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

      const requestBody = {
        businessName: 'Empty Fields Shop',
        planTier: 'pro',
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
