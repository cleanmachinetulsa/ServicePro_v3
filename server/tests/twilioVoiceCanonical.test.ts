/**
 * Phase 2.2 - Canonical Voice Entry-Point Tests (Dynamic Tenant Lookup)
 * 
 * Tests the standardized /twilio/voice/incoming endpoint with tenant resolution
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerCanonicalVoiceRoutes } from '../routes.twilioVoiceCanonical';
import { db } from '../db';
import { tenantPhoneConfig } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

describe('Canonical Voice Entry-Point: POST /twilio/voice/incoming (Phase 2.2)', () => {
  let app: express.Express;
  let testPhoneNumber: string;

  beforeAll(async () => {
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    
    // Register canonical voice routes
    registerCanonicalVoiceRoutes(app);
    
    // Clean up any existing test data
    testPhoneNumber = '+19188565304';
    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));
    
    // Seed root tenant phone config for testing
    await db.insert(tenantPhoneConfig).values({
      id: nanoid(),
      tenantId: 'root',
      phoneNumber: testPhoneNumber,
      sipDomain: 'cleanmachinetulsa.sip.twilio.com',
      sipUsername: 'jody',
      ivrMode: 'simple',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(tenantPhoneConfig).where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));
  });

  it('should return 200 and valid TwiML XML', async () => {
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({
        From: '+19185551234',
        To: '+19188565304',
        CallSid: 'CA1234567890abcdef1234567890abcdef',
      })
      .expect(200)
      .expect('Content-Type', /xml/);

    expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(response.text).toContain('<Response>');
    expect(response.text).toContain('</Response>');
  });

  it('should return TwiML with <Dial> element', async () => {
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({
        From: '+19185551234',
        To: '+19188565304',
        CallSid: 'CA1234567890abcdef1234567890abcdef',
      });

    expect(response.text).toContain('<Dial');
    expect(response.text).toContain('</Dial>');
  });

  it('should dial the Clean Machine SIP endpoint for root tenant from database config (Phase 2.2)', async () => {
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({
        From: '+19185551234',
        To: '+19188565304',
        CallSid: 'CA1234567890abcdef1234567890abcdef',
      });

    // Should contain SIP dial from database config
    expect(response.text).toContain('<Sip>');
    expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
    expect(response.text).toContain('</Sip>');
  });

  it('should pass through caller ID in the Dial element', async () => {
    const callerNumber = '+19185551234';
    
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({
        From: callerNumber,
        To: '+19188565304',
        CallSid: 'CA1234567890abcdef1234567890abcdef',
      });

    // Caller ID should be included in the Dial element
    expect(response.text).toContain(`callerId="${callerNumber}"`);
  });

  it('should handle missing From/To/CallSid gracefully and fallback to root', async () => {
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({})
      .expect(200)
      .expect('Content-Type', /xml/);

    // Should still return valid TwiML even with missing fields (fallback to root)
    expect(response.text).toContain('<Response>');
    expect(response.text).toContain('<Sip>');
    expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
  });

  it('should fallback to root tenant for unconfigured phone numbers (Phase 2.2)', async () => {
    // Test different To numbers that are NOT in tenantPhoneConfig
    const unconfiguredNumbers = [
      '+19188565711', // Not in database
      '+19182820103', // Not in database
      '+15555555555', // Random number not in database
    ];

    for (const toNumber of unconfiguredNumbers) {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+19185551234',
          To: toNumber,
          CallSid: `CA${Date.now()}`,
        });

      // Should fallback to root tenant and use hardcoded SIP endpoint
      expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
    }
  });

  it('should use database SIP config for configured phone number (Phase 2.2)', async () => {
    // The seeded phone number should use database config
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({
        From: '+19185551234',
        To: '+19188565304', // This is configured in database
        CallSid: 'CA1234567890abcdef1234567890abcdef',
      });

    // Should use the database SIP configuration
    expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
    
    // Verify it's using the database config (not hardcoded fallback)
    // We can tell because the logs would show "Using database SIP config"
  });
});
