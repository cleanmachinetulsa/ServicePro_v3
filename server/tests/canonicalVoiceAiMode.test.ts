import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { tenants, tenantPhoneConfig, tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { registerCanonicalVoiceRoutes } from '../routes.twilioVoiceCanonical';

/**
 * Regression Tests for /twilio/voice/incoming with AI Voice Mode (Phase 4)
 * 
 * Ensures that:
 * 1. ivrMode='simple' behavior is unchanged
 * 2. ivrMode='ai-voice' properly delegates to AI voice handler
 * 3. Existing voice routing continues to work
 */

describe('Canonical Voice Route - AI Voice Mode Regression (Phase 4)', () => {
  let app: express.Application;
  let simpleTenantId: string;
  let simplePhoneNumber: string;
  let simplePhoneConfigId: string;
  
  let aiVoiceTenantId: string;
  let aiVoicePhoneNumber: string;
  let aiVoicePhoneConfigId: string;

  beforeAll(async () => {
    // Create Express app with canonical voice routes
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    registerCanonicalVoiceRoutes(app);

    // ===== Setup tenant with SIMPLE mode =====
    simpleTenantId = 'test-simple-' + nanoid(8);
    simplePhoneNumber = '+19165551111';
    simplePhoneConfigId = nanoid();

    await db.insert(tenants).values({
      id: simpleTenantId,
      name: 'Simple Mode Test Business',
      subdomain: null,
      isRoot: false,
    });

    await db.insert(tenantPhoneConfig).values({
      id: simplePhoneConfigId,
      tenantId: simpleTenantId,
      phoneNumber: simplePhoneNumber,
      ivrMode: 'simple',
      sipDomain: 'test-simple.sip.twilio.com',
      sipUsername: 'testsimple',
    });

    // ===== Setup tenant with AI VOICE mode =====
    aiVoiceTenantId = 'test-aivoice-' + nanoid(8);
    aiVoicePhoneNumber = '+19165552222';
    aiVoicePhoneConfigId = nanoid();

    await db.insert(tenants).values({
      id: aiVoiceTenantId,
      name: 'AI Voice Test Business',
      subdomain: null,
      isRoot: false,
    });

    await db.insert(tenantConfig).values({
      tenantId: aiVoiceTenantId,
      businessName: 'AI Voice Auto Detail',
      tier: 'elite',
      logoUrl: null,
      primaryColor: null,
    });

    await db.insert(tenantPhoneConfig).values({
      id: aiVoicePhoneConfigId,
      tenantId: aiVoiceTenantId,
      phoneNumber: aiVoicePhoneNumber,
      ivrMode: 'ai-voice', // Configured for AI voice
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, simplePhoneConfigId));
    await db.delete(tenants).where(eq(tenants.id, simpleTenantId));

    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.id, aiVoicePhoneConfigId));
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, aiVoiceTenantId));
    await db.delete(tenants).where(eq(tenants.id, aiVoiceTenantId));
  });

  describe('Regression: ivrMode=simple (unchanged behavior)', () => {
    it('should handle simple mode calls correctly (SIP forwarding)', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551234',
          To: simplePhoneNumber,
          CallSid: 'CA1111111111',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should contain SIP dial
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Dial');
      expect(response.text).toContain('<Sip>');
      expect(response.text).toContain('testsimple@test-simple.sip.twilio.com');
    });

    it('should pass through caller ID in simple mode', async () => {
      const callerNumber = '+14155559999';
      
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: callerNumber,
          To: simplePhoneNumber,
          CallSid: 'CA2222222222',
        })
        .expect(200);

      // Should have callerId attribute with caller's number
      expect(response.text).toContain(`callerId="${callerNumber}"`);
    });
  });

  describe('Phase 4: ivrMode=ai-voice (new behavior)', () => {
    it('should handle ai-voice mode calls correctly', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551234',
          To: aiVoicePhoneNumber,
          CallSid: 'CA3333333333',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/);

      // Should return AI voice TwiML (not SIP dial)
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say voice="Polly.Joanna">');
      
      // Should NOT contain SIP forwarding
      expect(response.text).not.toContain('<Dial');
      expect(response.text).not.toContain('<Sip>');
    });

    it('should include business name in AI voice greeting', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551234',
          To: aiVoicePhoneNumber,
          CallSid: 'CA4444444444',
        })
        .expect(200);

      // Should mention the business name from tenantConfig
      expect(response.text).toContain('AI Voice Auto Detail');
    });

    it('should include AI receptionist beta messaging', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551234',
          To: aiVoicePhoneNumber,
          CallSid: 'CA5555555555',
        })
        .expect(200);

      const lowerText = response.text.toLowerCase();
      expect(lowerText).toContain('a i receptionist');
      expect(lowerText).toContain('beta');
    });

    it('should handle errors gracefully in AI voice mode', async () => {
      // Call with potentially problematic data
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551234',
          To: aiVoicePhoneNumber,
          CallSid: 'CA6666666666',
          SomeUnexpectedField: 'test-data',
        })
        .expect(200);

      // Should always return valid TwiML
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say voice="Polly.Joanna">');
    });
  });

  describe('Multi-mode isolation', () => {
    it('should route simple and ai-voice calls independently', async () => {
      // Call simple mode tenant
      const simpleCall = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551111',
          To: simplePhoneNumber,
          CallSid: 'CA7777777777',
        })
        .expect(200);

      // Call AI voice mode tenant
      const aiCall = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155552222',
          To: aiVoicePhoneNumber,
          CallSid: 'CA8888888888',
        })
        .expect(200);

      // Simple call should have SIP dial
      expect(simpleCall.text).toContain('<Dial');
      expect(simpleCall.text).toContain('<Sip>');

      // AI call should have Say (no SIP)
      expect(aiCall.text).toContain('<Say voice="Polly.Joanna">');
      expect(aiCall.text).not.toContain('<Dial');
    });

    it('should handle back-to-back calls to the same tenant', async () => {
      // Multiple calls to AI voice tenant should all work
      const call1 = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155551234',
          To: aiVoicePhoneNumber,
          CallSid: 'CA9999999991',
        })
        .expect(200);

      const call2 = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+14155555678',
          To: aiVoicePhoneNumber,
          CallSid: 'CA9999999992',
        })
        .expect(200);

      // Both should get AI voice response
      expect(call1.text).toContain('<Say voice="Polly.Joanna">');
      expect(call2.text).toContain('<Say voice="Polly.Joanna">');
      
      // Both should mention business name
      expect(call1.text).toContain('AI Voice Auto Detail');
      expect(call2.text).toContain('AI Voice Auto Detail');
    });
  });
});
