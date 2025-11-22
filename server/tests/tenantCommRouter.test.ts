/**
 * Phase 3 - Tenant Communication Routing Engine Tests
 * 
 * Tests the centralized tenant resolution logic for all inbound communications
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { tenantPhoneConfig, tenants } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { resolveTenantFromInbound, getIvrHandler } from '../services/tenantCommRouter';
import { Request } from 'express';

describe('Tenant Communication Router - Phase 3', () => {
  let testTenantId: string;
  let testPhoneNumber: string;
  let testMessagingServiceSid: string;
  let testPhoneConfigId: string;

  beforeAll(async () => {
    // Set up test data
    testTenantId = 'test-tenant-' + nanoid(8);
    testPhoneNumber = '+19995551234';
    testMessagingServiceSid = 'MG' + nanoid(32);
    testPhoneConfigId = nanoid();

    // Create test tenant
    await db.insert(tenants).values({
      id: testTenantId,
      name: 'Test Tenant',
      subdomain: null,
      isRoot: false,
    });

    // Create test phone config
    await db.insert(tenantPhoneConfig).values({
      id: testPhoneConfigId,
      tenantId: testTenantId,
      phoneNumber: testPhoneNumber,
      messagingServiceSid: testMessagingServiceSid,
      sipDomain: 'test.sip.twilio.com',
      sipUsername: 'testuser',
      ivrMode: 'ivr',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, testPhoneConfigId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  describe('resolveTenantFromInbound()', () => {
    it('should resolve tenant by MessagingServiceSid (Strategy 1 - highest priority)', async () => {
      const mockReq = {
        body: {
          To: '+19998887777', // Wrong number
          MessagingServiceSid: testMessagingServiceSid, // Correct SID
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe(testTenantId);
      expect(resolution.resolvedBy).toBe('messagingServiceSid');
      expect(resolution.ivrMode).toBe('ivr');
      expect(resolution.phoneConfig).toBeDefined();
      expect(resolution.phoneConfig?.phoneNumber).toBe(testPhoneNumber);
    });

    it('should resolve tenant by phone number (Strategy 2 - fallback when no MessagingServiceSid)', async () => {
      const mockReq = {
        body: {
          To: testPhoneNumber,
          From: '+15555551234',
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe(testTenantId);
      expect(resolution.resolvedBy).toBe('phoneNumber');
      expect(resolution.ivrMode).toBe('ivr');
      expect(resolution.phoneConfig).toBeDefined();
    });

    it('should prefer MessagingServiceSid over phone number when both are present', async () => {
      const mockReq = {
        body: {
          To: testPhoneNumber, // Correct number
          MessagingServiceSid: testMessagingServiceSid, // Also correct
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      // MessagingServiceSid should take precedence
      expect(resolution.resolvedBy).toBe('messagingServiceSid');
      expect(resolution.tenantId).toBe(testTenantId);
    });

    it('should fallback to root tenant when no match is found (Strategy 3)', async () => {
      const mockReq = {
        body: {
          To: '+19991112222', // Unknown number
          MessagingServiceSid: 'MGunknown123456789', // Unknown SID
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe('root');
      expect(resolution.resolvedBy).toBe('fallback');
      expect(resolution.ivrMode).toBe('simple');
      expect(resolution.phoneConfig).toBeNull();
    });

    it('should fallback to root when To and MessagingServiceSid are missing', async () => {
      const mockReq = {
        body: {
          From: '+15555551234',
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe('root');
      expect(resolution.resolvedBy).toBe('fallback');
      expect(resolution.phoneConfig).toBeNull();
    });

    it('should handle empty request body gracefully', async () => {
      const mockReq = {
        body: {},
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe('root');
      expect(resolution.resolvedBy).toBe('fallback');
    });

    it('should return correct ivrMode from phone config', async () => {
      const mockReq = {
        body: {
          To: testPhoneNumber,
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.ivrMode).toBe('ivr');
    });

    it('should default to simple ivrMode when config has no ivrMode set', async () => {
      // Create a config without ivrMode
      const noModeConfigId = nanoid();
      const noModePhoneNumber = '+19995557777';
      
      await db.insert(tenantPhoneConfig).values({
        id: noModeConfigId,
        tenantId: testTenantId,
        phoneNumber: noModePhoneNumber,
        ivrMode: null as any, // Force null for testing
      });

      const mockReq = {
        body: {
          To: noModePhoneNumber,
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.ivrMode).toBe('simple');

      // Cleanup
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, noModeConfigId));
    });
  });

  describe('getIvrHandler()', () => {
    it('should return "ivr" for ivr mode', () => {
      const handler = getIvrHandler('ivr', 'test-tenant');
      expect(handler).toBe('ivr');
    });

    it('should return "simple" for simple mode', () => {
      const handler = getIvrHandler('simple', 'test-tenant');
      expect(handler).toBe('simple');
    });

    it('should fallback to "simple" for ai-voice mode (not yet implemented)', () => {
      const handler = getIvrHandler('ai-voice', 'test-tenant');
      expect(handler).toBe('simple');
    });
  });

  describe('Multi-tenant routing scenarios', () => {
    let tenant2Id: string;
    let tenant2PhoneNumber: string;
    let tenant2ConfigId: string;

    beforeAll(async () => {
      // Create a second tenant for cross-tenant tests
      tenant2Id = 'test-tenant-2-' + nanoid(8);
      tenant2PhoneNumber = '+19995556666';
      tenant2ConfigId = nanoid();

      await db.insert(tenants).values({
        id: tenant2Id,
        name: 'Test Tenant 2',
        subdomain: null,
        isRoot: false,
      });

      await db.insert(tenantPhoneConfig).values({
        id: tenant2ConfigId,
        tenantId: tenant2Id,
        phoneNumber: tenant2PhoneNumber,
        ivrMode: 'simple',
      });
    });

    afterAll(async () => {
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, tenant2ConfigId));
      await db.delete(tenants).where(eq(tenants.id, tenant2Id));
    });

    it('should route different phone numbers to different tenants', async () => {
      const req1 = { body: { To: testPhoneNumber } } as Request;
      const req2 = { body: { To: tenant2PhoneNumber } } as Request;

      const resolution1 = await resolveTenantFromInbound(req1, db);
      const resolution2 = await resolveTenantFromInbound(req2, db);

      expect(resolution1.tenantId).toBe(testTenantId);
      expect(resolution2.tenantId).toBe(tenant2Id);
      expect(resolution1.tenantId).not.toBe(resolution2.tenantId);
    });

    it('should preserve different IVR modes for different tenants', async () => {
      const req1 = { body: { To: testPhoneNumber } } as Request;
      const req2 = { body: { To: tenant2PhoneNumber } } as Request;

      const resolution1 = await resolveTenantFromInbound(req1, db);
      const resolution2 = await resolveTenantFromInbound(req2, db);

      expect(resolution1.ivrMode).toBe('ivr');
      expect(resolution2.ivrMode).toBe('simple');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null values in request body gracefully', async () => {
      const mockReq = {
        body: {
          To: null,
          MessagingServiceSid: null,
        },
      } as any;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe('root');
      expect(resolution.resolvedBy).toBe('fallback');
    });

    it('should handle undefined values in request body gracefully', async () => {
      const mockReq = {
        body: {
          To: undefined,
          MessagingServiceSid: undefined,
        },
      } as any;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      expect(resolution.tenantId).toBe('root');
      expect(resolution.resolvedBy).toBe('fallback');
    });

    it('should handle whitespace-only values', async () => {
      const mockReq = {
        body: {
          To: '   ',
          MessagingServiceSid: '   ',
        },
      } as Request;

      const resolution = await resolveTenantFromInbound(mockReq, db);

      // Whitespace values won't match anything, should fallback to root
      expect(resolution.tenantId).toBe('root');
      expect(resolution.resolvedBy).toBe('fallback');
    });
  });
});
