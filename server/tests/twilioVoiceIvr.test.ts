/**
 * Phase 2.3: IVR Mode Tests
 * 
 * Tests the IVR menu functionality including all menu options and edge cases
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerCanonicalVoiceRoutes } from '../routes.twilioVoiceCanonical';
import { registerIvrRoutes } from '../routes.twilioVoiceIvr';
import { db } from '../db';
import { tenantPhoneConfig } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

describe('IVR Mode: POST /twilio/voice/incoming + IVR callbacks (Phase 2.3)', () => {
  let app: express.Express;
  let testPhoneNumber: string;

  beforeAll(async () => {
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    
    // Register both canonical voice and IVR routes
    registerCanonicalVoiceRoutes(app);
    registerIvrRoutes(app);
    
    // Set up test data with IVR mode
    testPhoneNumber = '+19188565304';
    
    // Update existing tenant phone config to use IVR mode
    await db
      .update(tenantPhoneConfig)
      .set({ ivrMode: 'ivr' })
      .where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));
  });

  afterAll(async () => {
    // Reset to simple mode
    await db
      .update(tenantPhoneConfig)
      .set({ ivrMode: 'simple' })
      .where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));
  });

  describe('IVR Main Menu', () => {
    it('should return IVR menu TwiML when ivrMode=ivr', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('<Gather');
      expect(response.text).toContain('numDigits="1"');
      expect(response.text).toContain('Thanks for calling');
      expect(response.text).toContain('Press 1');
      expect(response.text).toContain('Press 2');
      expect(response.text).toContain('Press 3');
      expect(response.text).toContain('Press 7');
    });

    it('should include action URL for IVR selection callback', async () => {
      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        });

      expect(response.text).toContain('/twilio/voice/ivr-selection');
    });
  });

  describe('Press 1 - Services Overview + SMS', () => {
    it('should return services overview TwiML', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '1',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('<Say');
      expect(response.text).toContain('professional auto detailing services');
      expect(response.text).toContain('text message');
      expect(response.text).toContain('<Hangup');
    });

    // Note: SMS sending is async, so we just verify the TwiML response
    // The actual SMS is tested in SMS integration tests
  });

  describe('Press 2 - Forward to Person', () => {
    it('should forward to SIP endpoint with caller ID', async () => {
      const callerNumber = '+19185551234';
      
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '2',
          From: callerNumber,
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('<Dial');
      expect(response.text).toContain(`callerId="${callerNumber}"`);
      expect(response.text).toContain('<Sip>');
      expect(response.text).toContain('jody@cleanmachinetulsa.sip.twilio.com');
    });

    it('should include hold message before connecting', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '2',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        });

      expect(response.text).toContain('Please hold while we connect you');
    });

    it('should have fallback to voicemail if SIP fails', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '2',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        });

      expect(response.text).toContain('unable to connect');
      expect(response.text).toContain('<Redirect');
      expect(response.text).toContain('Digits=3');
    });
  });

  describe('Press 3 - Voicemail', () => {
    it('should return voicemail recording TwiML', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '3',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('<Record');
      expect(response.text).toContain('maxLength="120"');
      expect(response.text).toContain('Please leave your name');
      expect(response.text).toContain('action=');
      expect(response.text).toContain('recordingStatusCallback=');
    });

    it('should have voicemail-complete callback URL', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '3',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        });

      expect(response.text).toContain('/twilio/voice/voicemail-complete');
      expect(response.text).toContain('/twilio/voice/recording-status');
    });
  });

  describe('Press 7 - Easter Egg', () => {
    it('should return fun message TwiML', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '7',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('<Say');
      expect(response.text).toContain('fun fact');
      expect(response.text).toContain('<Hangup');
    });
  });

  describe('Invalid Selections', () => {
    it('should handle invalid digit gracefully', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '9',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('not a valid option');
      expect(response.text).toContain('<Redirect');
      expect(response.text).toContain('/twilio/voice/incoming');
    });

    it('should handle empty digits', async () => {
      const response = await request(app)
        .post('/twilio/voice/ivr-selection')
        .send({
          Digits: '',
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('not a valid option');
    });
  });

  describe('Voicemail Completion', () => {
    it('should return confirmation TwiML after recording', async () => {
      const response = await request(app)
        .post('/twilio/voice/voicemail-complete')
        .send({
          RecordingUrl: 'https://api.twilio.com/recording123',
          RecordingSid: 'RE1234567890abcdef',
          CallSid: 'CA1234567890abcdef1234567890abcdef',
          From: '+19185551234',
          To: testPhoneNumber,
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      expect(response.text).toContain('<Say');
      expect(response.text).toContain('Thank you for your message');
      expect(response.text).toContain("We'll text you back");
      expect(response.text).toContain('<Hangup');
    });
  });

  describe('Recording Status Callback', () => {
    it('should accept recording status webhook', async () => {
      const response = await request(app)
        .post('/twilio/voice/recording-status')
        .send({
          RecordingUrl: 'https://api.twilio.com/recording123',
          RecordingSid: 'RE1234567890abcdef',
          RecordingStatus: 'completed',
          CallSid: 'CA1234567890abcdef1234567890abcdef',
          From: '+19185551234',
          To: testPhoneNumber,
        })
        .expect(200);
    });
  });

  describe('Simple Mode Fallback', () => {
    it('should use simple SIP forward when ivrMode is simple', async () => {
      // Temporarily set to simple mode
      await db
        .update(tenantPhoneConfig)
        .set({ ivrMode: 'simple' })
        .where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));

      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should NOT have IVR menu
      expect(response.text).not.toContain('<Gather');
      expect(response.text).not.toContain('Press 1');
      
      // Should have direct SIP forward
      expect(response.text).toContain('<Dial');
      expect(response.text).toContain('<Sip>');

      // Reset back to IVR mode
      await db
        .update(tenantPhoneConfig)
        .set({ ivrMode: 'ivr' })
        .where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));
    });

    it('should fallback to simple when ai-voice mode is set', async () => {
      // Temporarily set to ai-voice mode
      await db
        .update(tenantPhoneConfig)
        .set({ ivrMode: 'ai-voice' })
        .where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));

      const response = await request(app)
        .post('/twilio/voice/incoming')
        .send({
          From: '+19185551234',
          To: testPhoneNumber,
          CallSid: 'CA1234567890abcdef1234567890abcdef',
        })
        .expect(200)
        .expect('Content-Type', /xml/);

      // Should fallback to simple SIP forward (ai-voice not yet implemented)
      expect(response.text).toContain('<Dial');
      expect(response.text).toContain('<Sip>');

      // Reset back to IVR mode
      await db
        .update(tenantPhoneConfig)
        .set({ ivrMode: 'ivr' })
        .where(eq(tenantPhoneConfig.phoneNumber, testPhoneNumber));
    });
  });
});
