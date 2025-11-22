import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { tenants, tenantPhoneConfig, tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { registerTwilioVoiceAiRoutes } from '../routes.twilioVoiceAi';

/**
 * Integration Tests for /twilio/voice/ai Route (Phase 4)
 * 
 * Tests the AI voice endpoint with full middleware stack:
 * - Twilio signature verification (bypassed in test mode)
 * - Tenant resolution
 * - ivrMode validation
 * - TwiML generation
 */

describe('AI Voice Route - Integration Tests (Phase 4)', () => {
  let app: express.Application;
  let testTenantId: string;
  let testPhoneNumber: string;
  let testPhoneConfigId: string;

  beforeAll(async () => {
    // Create test tenant
    testTenantId = 'test-ai-voice-' + nanoid(8);
    testPhoneNumber = '+19995558888'; // Test phone number
    testPhoneConfigId = nanoid();

    await db.insert(tenants).values({
      id: testTenantId,
      name: 'AI Voice Test Business',
      subdomain: null,
      isRoot: false,
    });

    await db.insert(tenantConfig).values({
      tenantId: testTenantId,
      businessName: 'AI Voice Test Business',
      tier: 'pro',
      logoUrl: null,
      primaryColor: null,
    });

    await db.insert(tenantPhoneConfig).values({
      id: testPhoneConfigId,
      tenantId: testTenantId,
      phoneNumber: testPhoneNumber,
      ivrMode: 'ai-voice', // Configured for AI voice
    });

    // Setup Express app with AI voice routes
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    registerTwilioVoiceAiRoutes(app);
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, testPhoneConfigId));
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  describe('POST /twilio/voice/ai', () => {
    it('should return 200 with valid TwiML for AI voice call', async () => {
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Verify TwiML structure
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('</Response>');
      expect(response.text).toContain('<Say voice="Polly.Joanna">');
    });

    it('should include business name in greeting', async () => {
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200);

      // Should mention the business name
      expect(response.text).toContain('AI Voice Test Business');
    });

    it('should include beta/AI receptionist messaging', async () => {
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200);

      const lowerText = response.text.toLowerCase();
      expect(lowerText).toContain('a i receptionist');
      expect(lowerText).toContain('beta');
    });

    it('should return error TwiML when tenant/phoneConfig not found', async () => {
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: '+19167778888', // Unknown number
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should return error message
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say voice="Polly.Joanna">');
      expect(response.text).toContain('having trouble routing your call');
      expect(response.text).toContain('<Hangup/>');
    });

    it('should return error TwiML when ivrMode is not ai-voice', async () => {
      // Create a phone config with simple mode
      const simpleConfigId = nanoid();
      const simplePhoneNumber = '+19998887777'; // Unique number to avoid conflicts

      await db.insert(tenantPhoneConfig).values({
        id: simpleConfigId,
        tenantId: testTenantId,
        phoneNumber: simplePhoneNumber,
        ivrMode: 'simple', // NOT ai-voice
      });

      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: simplePhoneNumber,
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should return error message
      expect(response.text).toContain('not yet configured for our A I receptionist');
      expect(response.text).toContain('<Hangup/>');

      // Cleanup
      await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, simpleConfigId));
    });

    it('should handle missing From field gracefully', async () => {
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          // From is missing
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should still return valid TwiML
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say voice="Polly.Joanna">');
    });

    it('should handle missing To field gracefully', async () => {
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          // To is missing - will fallback to root
          CallSid: 'CA1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should return error TwiML (no tenant found)
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Hangup/>');
    });

    it('should return TwiML even on internal errors', async () => {
      // Send malformed request body to trigger error handling
      const response = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef',
          // Add some unexpected data
          InvalidField: 'this-should-not-break-it',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should always return valid TwiML (never crash)
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say voice="Polly.Joanna">');
    });
  });

  describe('Regression: Ensure AI voice route is independent', () => {
    it('should not affect other routes or tenants', async () => {
      // Make multiple calls to ensure no state leakage
      const call1 = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155551234',
          To: testPhoneNumber,
          CallSid: 'CA111',
        })
        .expect(200);

      const call2 = await request(app)
        .post('/twilio/voice/ai')
        .send({
          From: '+14155555678',
          To: testPhoneNumber,
          CallSid: 'CA222',
        })
        .expect(200);

      // Both should succeed independently
      expect(call1.text).toContain('<Response>');
      expect(call2.text).toContain('<Response>');
      
      // Both should be valid TwiML
      expect(call1.text).toContain('AI Voice Test Business');
      expect(call2.text).toContain('AI Voice Test Business');
    });
  });
});
