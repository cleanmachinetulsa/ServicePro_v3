import { describe, it, expect, beforeEach } from 'vitest';
import { handleAiVoiceRequest, buildAiVoiceErrorTwiML } from '../services/aiVoiceSession';
import type { AiVoiceRequestContext } from '../services/aiVoiceSession';

/**
 * Unit Tests for AI Voice Session Service (Phase 4)
 * 
 * Tests the placeholder TwiML generation for AI voice calls
 */

describe('AI Voice Session Service - Unit Tests (Phase 4)', () => {
  let mockContext: AiVoiceRequestContext;

  beforeEach(() => {
    // Reset mock context before each test
    mockContext = {
      tenant: {
        id: 'test-tenant',
        name: 'Test Business',
        subdomain: null,
        isRoot: false,
        businessName: 'Test Auto Detail',
        tier: 'pro',
        logoUrl: null,
        primaryColor: null,
      },
      phoneConfig: {
        id: 'test-phone-config',
        tenantId: 'test-tenant',
        phoneNumber: '+19185551234',
        messagingServiceSid: null,
        sipDomain: null,
        sipUsername: null,
        forwardToNumber: null,
        ivrMode: 'ai-voice',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {
        CallSid: 'CA1234567890abcdef',
        From: '+14155551234',
        To: '+19185551234',
      },
    };
  });

  describe('handleAiVoiceRequest', () => {
    it('should return valid TwiML response', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      expect(result).toBeDefined();
      expect(result.twiml).toBeDefined();
      expect(typeof result.twiml).toBe('string');
    });

    it('should include XML declaration and Response wrapper', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      expect(result.twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.twiml).toContain('<Response>');
      expect(result.twiml).toContain('</Response>');
    });

    it('should include Say tag with voice attribute', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      expect(result.twiml).toContain('<Say voice="Polly.Joanna">');
      expect(result.twiml).toContain('</Say>');
    });

    it('should mention tenant businessName in greeting', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      expect(result.twiml).toContain('Test Auto Detail');
    });

    it('should fall back to tenant name when businessName is null', async () => {
      const contextWithoutBusinessName = {
        ...mockContext,
        tenant: {
          ...mockContext.tenant,
          businessName: null,
        },
      };

      const result = await handleAiVoiceRequest(contextWithoutBusinessName);

      expect(result.twiml).toContain('Test Business');
    });

    it('should include beta/AI receptionist messaging', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      expect(result.twiml.toLowerCase()).toContain('a i receptionist');
      expect(result.twiml.toLowerCase()).toContain('beta');
    });

    it('should include a prompt for user to speak', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      const lowerTwiml = result.twiml.toLowerCase();
      expect(
        lowerTwiml.includes('tell me') || 
        lowerTwiml.includes('what you need') || 
        lowerTwiml.includes('help with')
      ).toBe(true);
    });

    it('should include Hangup tag', async () => {
      const result = await handleAiVoiceRequest(mockContext);

      expect(result.twiml).toContain('<Hangup/>');
    });

    it('should escape XML special characters in business name', async () => {
      const contextWithSpecialChars = {
        ...mockContext,
        tenant: {
          ...mockContext.tenant,
          businessName: "Bob's <Premium> Auto & Detail",
        },
      };

      const result = await handleAiVoiceRequest(contextWithSpecialChars);

      // Should escape < > & '
      expect(result.twiml).not.toContain("<Premium>");
      expect(result.twiml).toContain('&lt;Premium&gt;');
      expect(result.twiml).toContain('&apos;');
      expect(result.twiml).toContain('&amp;');
    });

    it('should handle root tenant correctly', async () => {
      const rootContext = {
        ...mockContext,
        tenant: {
          ...mockContext.tenant,
          id: 'root',
          isRoot: true,
          businessName: 'Clean Machine Auto Detail',
        },
      };

      const result = await handleAiVoiceRequest(rootContext);

      expect(result.twiml).toContain('Clean Machine Auto Detail');
      expect(result).toBeDefined();
    });
  });

  describe('buildAiVoiceErrorTwiML', () => {
    it('should return valid TwiML for error messages', () => {
      const errorMessage = 'This line is not configured for AI voice.';
      const twiml = buildAiVoiceErrorTwiML(errorMessage);

      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('</Response>');
      expect(twiml).toContain('<Say voice="Polly.Joanna">');
      expect(twiml).toContain(errorMessage);
      expect(twiml).toContain('<Hangup/>');
    });

    it('should escape XML special characters in error message', () => {
      const errorMessage = 'Error: <system> & "config" failed';
      const twiml = buildAiVoiceErrorTwiML(errorMessage);

      expect(twiml).not.toContain('<system>');
      expect(twiml).toContain('&lt;system&gt;');
      expect(twiml).toContain('&amp;');
      expect(twiml).toContain('&quot;');
    });
  });
});
