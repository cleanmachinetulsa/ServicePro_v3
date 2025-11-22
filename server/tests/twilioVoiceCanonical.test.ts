/**
 * Phase 2.1 - Canonical Voice Entry-Point Tests
 * 
 * Tests the standardized /twilio/voice/incoming endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerCanonicalVoiceRoutes } from '../routes.twilioVoiceCanonical';

describe('Canonical Voice Entry-Point: POST /twilio/voice/incoming', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    
    // Register canonical voice routes
    registerCanonicalVoiceRoutes(app);
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

  it('should dial the Clean Machine SIP endpoint for root tenant', async () => {
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({
        From: '+19185551234',
        To: '+19188565304',
        CallSid: 'CA1234567890abcdef1234567890abcdef',
      });

    // Should contain SIP dial to jody@cleanmachinetulsa.sip.twilio.com
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

  it('should handle missing From/To/CallSid gracefully', async () => {
    const response = await request(app)
      .post('/twilio/voice/incoming')
      .send({})
      .expect(200)
      .expect('Content-Type', /xml/);

    // Should still return valid TwiML even with missing fields
    expect(response.text).toContain('<Response>');
    expect(response.text).toContain('<Sip>');
  });

  it('should resolve to root tenant for any incoming number (Phase 2.1)', async () => {
    // Test different To numbers - all should resolve to root tenant
    const testNumbers = [
      '+19188565304', // Main line
      '+19188565711', // Jody's line  
      '+19182820103', // Emergency line
      '+15555555555', // Random number
    ];

    for (const toNumber of testNumbers) {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+19185551234',
          To: toNumber,
          CallSid: `CA${Date.now()}`,
        });

      // All should dial the same Clean Machine SIP endpoint
      expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
    }
  });
});
