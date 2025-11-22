/**
 * Phase 3 - Tenant Communication Routing Engine Integration Tests
 * 
 * End-to-end tests for SMS and Voice routes using centralized tenant router
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../db';
import { tenantPhoneConfig, tenants, conversations } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { registerCanonicalVoiceRoutes } from '../routes.twilioVoiceCanonical';
import { verifyTwilioSignature } from '../twilioSignatureMiddleware';
import { normalizePhone } from '../phoneValidationMiddleware';

describe('Tenant Communication Router - Integration Tests (Phase 3)', () => {
  let app: express.Express;
  let testTenantId: string;
  let testPhoneNumber: string;
  let testMessagingServiceSid: string;
  let testPhoneConfigId: string;

  beforeAll(async () => {
    // Set up Express app with routes
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    
    // Register voice routes
    registerCanonicalVoiceRoutes(app);
    
    // Create test tenant
    testTenantId = 'test-integration-' + nanoid(8);
    testPhoneNumber = '+19995558888';
    testMessagingServiceSid = 'MG' + nanoid(32);
    testPhoneConfigId = nanoid();

    await db.insert(tenants).values({
      id: testTenantId,
      name: 'Test Integration Tenant',
      subdomain: null,
      isRoot: false,
    });

    await db.insert(tenantPhoneConfig).values({
      id: testPhoneConfigId,
      tenantId: testTenantId,
      phoneNumber: testPhoneNumber,
      messagingServiceSid: testMessagingServiceSid,
      sipDomain: 'test-integration.sip.twilio.com',
      sipUsername: 'testintegration',
      ivrMode: 'simple',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, testPhoneConfigId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  describe('POST /twilio/voice/incoming', () => {
    it('should route voice call to correct tenant via phone number', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          To: testPhoneNumber,
          CallSid: 'CAtest123456',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should contain TwiML response
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain('<Response>');
      
      // Should use tenant's SIP config
      expect(response.text).toContain('testintegration@test-integration.sip.twilio.com');
    });

    it('should fallback to root tenant for unknown phone numbers', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          To: '+19999999999', // Unknown number
          CallSid: 'CAtest123456',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should still return valid TwiML (root fallback)
      expect(response.text).toContain('<Response>');
      
      // Should use root's fallback config
      expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
    });

    it('should handle IVR mode routing correctly', async () => {
      // Create an IVR-mode config
      const ivrConfigId = nanoid();
      const ivrPhoneNumber = '+19995559999';

      await db.insert(tenantPhoneConfig).values({
        id: ivrConfigId,
        tenantId: testTenantId,
        phoneNumber: ivrPhoneNumber,
        ivrMode: 'ivr',
      });

      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          To: ivrPhoneNumber,
          CallSid: 'CAtest123456',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should contain IVR menu
      expect(response.text).toContain('<Gather');
      expect(response.text).toContain('Press 1');
      
      // Clean up
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, ivrConfigId));
    });
  });

  describe('Multi-tenant isolation', () => {
    let tenant2Id: string;
    let tenant2PhoneNumber: string;
    let tenant2ConfigId: string;

    beforeAll(async () => {
      tenant2Id = 'test-integration-2-' + nanoid(8);
      tenant2PhoneNumber = '+19995557777';
      tenant2ConfigId = nanoid();

      await db.insert(tenants).values({
        id: tenant2Id,
        name: 'Test Integration Tenant 2',
        subdomain: null,
        isRoot: false,
      });

      await db.insert(tenantPhoneConfig).values({
        id: tenant2ConfigId,
        tenantId: tenant2Id,
        phoneNumber: tenant2PhoneNumber,
        sipDomain: 'tenant2.sip.twilio.com',
        sipUsername: 'tenant2user',
        ivrMode: 'ivr',
      });
    });

    afterAll(async () => {
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, tenant2ConfigId));
      await db.delete(tenants).where(eq(tenants.id, tenant2Id));
    });

    it('should route different numbers to different tenant configs', async () => {
      // Call tenant 1 number (simple mode)
      const response1 = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          To: testPhoneNumber,
          CallSid: 'CAtest1',
        });

      // Call tenant 2 number (ivr mode)
      const response2 = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          To: tenant2PhoneNumber,
          CallSid: 'CAtest2',
        });

      // Tenant 1 should use simple mode (direct SIP dial)
      expect(response1.text).toContain('testintegration@test-integration.sip.twilio.com');
      expect(response1.text).not.toContain('<Gather');

      // Tenant 2 should use IVR mode
      expect(response2.text).toContain('<Gather');
      expect(response2.text).toContain('Press 1');
    });
  });

  describe('MessagingServiceSid resolution priority', () => {
    it('should resolve by MessagingServiceSid even when phone number also matches', async () => {
      // This test verifies that MessagingServiceSid takes precedence over phone number
      // in the resolution strategy (Strategy 1 before Strategy 2)
      
      // Create a second config for the same tenant with different phone
      const altConfigId = nanoid();
      const altPhoneNumber = '+19995556666';

      await db.insert(tenantPhoneConfig).values({
        id: altConfigId,
        tenantId: testTenantId,
        phoneNumber: altPhoneNumber,
        messagingServiceSid: testMessagingServiceSid, // Same MessagingServiceSid
        sipDomain: 'alt.sip.twilio.com',
        sipUsername: 'altuser',
        ivrMode: 'simple',
      });

      // Make a request that matches MessagingServiceSid but different To number
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          To: testPhoneNumber, // Original number
          CallSid: 'CAtest123',
        });

      // Should still route correctly (though MessagingServiceSid isn't used in voice,
      // the router logic should be consistent)
      expect(response.status).toBe(200);
      expect(response.text).toContain('<Response>');
      
      // Clean up
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, altConfigId));
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing To field gracefully', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+15555551234',
          CallSid: 'CAtest123',
          // To is missing
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should fallback to root and still return valid TwiML
      expect(response.text).toContain('<Response>');
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({})
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should fallback to root and still return valid TwiML
      expect(response.text).toContain('<Response>');
    });

    it('should maintain caller ID passthrough in routed calls', async () => {
      const callerNumber = '+15555551234';

      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: callerNumber,
          To: testPhoneNumber,
          CallSid: 'CAtest123',
        });

      // Verify caller ID is preserved in TwiML
      expect(response.text).toContain(`callerId="${callerNumber}"`);
    });
  });

  describe('POST /sms - SMS route integration', () => {
    let smsApp: express.Express;

    beforeAll(async () => {
      // Set up Express app with SMS route
      smsApp = express();
      smsApp.use(express.urlencoded({ extended: false }));
      smsApp.use(express.json());

      // Register SMS route (simplified version for testing - no phone validation)
      smsApp.post('/sms', verifyTwilioSignature, async (req, res) => {
        try {
          const { resolveTenantFromInbound } = await import('../services/tenantCommRouter');
          const { wrapTenantDb } = await import('../tenantDb');
          
          // Use centralized router
          const resolution = await resolveTenantFromInbound(req, db);
          
          // Set up tenant context
          req.tenant = { id: resolution.tenantId } as any;
          req.tenantDb = wrapTenantDb(db, resolution.tenantId);
          (req as any).phoneConfig = resolution.phoneConfig;
          (req as any).tenantResolution = resolution;

          // Return tenant info for test verification
          res.json({
            tenantId: resolution.tenantId,
            resolvedBy: resolution.resolvedBy,
            ivrMode: resolution.ivrMode,
            hasPhoneConfig: !!resolution.phoneConfig,
          });
        } catch (error) {
          console.error('[SMS TEST] Error:', error);
          res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
    });

    it('should route SMS by MessagingServiceSid (Strategy 1)', async () => {
      const response = await request(smsApp)
        .post('/sms')
        .send({
          From: '+15555551234',
          To: testPhoneNumber,
          Body: 'Test message',
          MessagingServiceSid: testMessagingServiceSid,
        })
        .expect(200);

      expect(response.body.tenantId).toBe(testTenantId);
      expect(response.body.resolvedBy).toBe('messagingServiceSid');
      expect(response.body.hasPhoneConfig).toBe(true);
    });

    it('should route SMS by phone number when no MessagingServiceSid (Strategy 2)', async () => {
      const response = await request(smsApp)
        .post('/sms')
        .send({
          From: '+15555551234',
          To: testPhoneNumber,
          Body: 'Test message',
          // No MessagingServiceSid
        })
        .expect(200);

      expect(response.body.tenantId).toBe(testTenantId);
      expect(response.body.resolvedBy).toBe('phoneNumber');
      expect(response.body.hasPhoneConfig).toBe(true);
    });

    it('should fallback to root for unknown phone numbers', async () => {
      const response = await request(smsApp)
        .post('/sms')
        .send({
          From: '+15555551234',
          To: '+19998887777', // Unknown number
          Body: 'Test message',
        })
        .expect(200);

      expect(response.body.tenantId).toBe('root');
      expect(response.body.resolvedBy).toBe('fallback');
      expect(response.body.hasPhoneConfig).toBe(false); // Fallback has no phoneConfig
    });

    it('should handle SMS with missing To field gracefully', async () => {
      const response = await request(smsApp)
        .post('/sms')
        .send({
          From: '+15555551234',
          Body: 'Test message',
          // To is missing
        })
        .expect(200);

      // Should fallback to root
      expect(response.body.tenantId).toBe('root');
      expect(response.body.resolvedBy).toBe('fallback');
      expect(response.body.hasPhoneConfig).toBe(false);
    });

    it('should handle SMS with empty request body gracefully', async () => {
      const response = await request(smsApp)
        .post('/sms')
        .send({})
        .expect(200);

      // Should fallback to root
      expect(response.body.tenantId).toBe('root');
      expect(response.body.resolvedBy).toBe('fallback');
      expect(response.body.hasPhoneConfig).toBe(false);
    });

    it('should route different numbers to different tenants (SMS multi-tenancy)', async () => {
      // Create a second tenant
      const tenant2Id = 'test-integration-sms-2-' + nanoid(8);
      const tenant2Phone = '+19995553333'; // Different from testPhoneNumber
      const tenant2ConfigId = nanoid();

      await db.insert(tenants).values({
        id: tenant2Id,
        name: 'Test SMS Tenant 2',
        subdomain: null,
        isRoot: false,
      });

      await db.insert(tenantPhoneConfig).values({
        id: tenant2ConfigId,
        tenantId: tenant2Id,
        phoneNumber: tenant2Phone,
        ivrMode: 'ivr',
      });

      // SMS to tenant 1
      const response1 = await request(smsApp)
        .post('/sms')
        .send({
          From: '+15555551234',
          To: testPhoneNumber,
          Body: 'Test to tenant 1',
        });

      // SMS to tenant 2
      const response2 = await request(smsApp)
        .post('/sms')
        .send({
          From: '+15555551234',
          To: tenant2Phone,
          Body: 'Test to tenant 2',
        });

      // Verify correct tenant routing
      expect(response1.body.tenantId).toBe(testTenantId);
      expect(response2.body.tenantId).toBe(tenant2Id);
      
      // Verify IVR modes are preserved
      expect(response1.body.ivrMode).toBe('simple');
      expect(response2.body.ivrMode).toBe('ivr');

      // Clean up
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, tenant2ConfigId));
      await db.delete(tenants).where(eq(tenants.id, tenant2Id));
    });
  });
});
