/**
 * SMS Send Guard Tests
 * 
 * Tests the centralized SMS sender validation to ensure:
 * - Customer-facing SMS only sends from MAIN_PHONE_NUMBER
 * - Admin-only SMS can use phoneAdmin with allowAdmin flag
 * - Test SMS requires allowTest flag and test number to be configured
 * - Blocked numbers are rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables before importing the module
vi.stubEnv('MAIN_PHONE_NUMBER', '+19188565304');
vi.stubEnv('VIP_PHONE_NUMBER', '+19188565711');
vi.stubEnv('TWILIO_TEST_SMS_NUMBER', ''); // Empty by default

// Import after setting env vars
import { enforceCustomerSmsSender, validateSmsSender, getSmsSenderConfig } from '../services/smsSendGuard';

describe('SMS Send Guard', () => {
  describe('enforceCustomerSmsSender', () => {
    it('should ALLOW customer SMS from MAIN_PHONE_NUMBER', () => {
      const result = enforceCustomerSmsSender({
        from: '+19188565304',
        purpose: 'customer_sms',
        to: '+15551234567',
        tenantId: 'root',
      });
      
      expect(result.allowed).toBe(true);
      expect(result.from).toBe('+19188565304');
    });
    
    it('should BLOCK customer SMS from 5711 (admin line)', () => {
      expect(() => {
        enforceCustomerSmsSender({
          from: '+19188565711',
          purpose: 'customer_sms',
          to: '+15551234567',
          tenantId: 'root',
        });
      }).toThrow('[SMS BLOCK]');
    });
    
    it('should BLOCK customer SMS from 83265 (old test number)', () => {
      expect(() => {
        enforceCustomerSmsSender({
          from: '+19189183265',
          purpose: 'booking_confirmation',
          to: '+15551234567',
          tenantId: 'root',
        });
      }).toThrow('[SMS BLOCK]');
    });
    
    it('should DEFAULT to main number when from is empty for customer SMS', () => {
      const result = enforceCustomerSmsSender({
        from: null,
        purpose: 'customer_sms',
        to: '+15551234567',
        tenantId: 'root',
      });
      
      expect(result.allowed).toBe(true);
      expect(result.from).toBe('+19188565304');
    });
    
    it('should ALLOW admin SMS from phoneAdmin WITH allowAdmin flag', () => {
      const result = enforceCustomerSmsSender({
        from: '+19188565711',
        purpose: 'admin_alert',
        to: '+15551234567',
        tenantId: 'root',
        allowAdmin: true,
      });
      
      expect(result.allowed).toBe(true);
      expect(result.from).toBe('+19188565711');
    });
    
    it('should BLOCK admin SMS WITHOUT allowAdmin flag', () => {
      expect(() => {
        enforceCustomerSmsSender({
          from: '+19188565711',
          purpose: 'admin_alert',
          to: '+15551234567',
          tenantId: 'root',
          allowAdmin: false,
        });
      }).toThrow('[SMS BLOCK]');
    });
    
    it('should ALLOW messaging service without from number', () => {
      const result = enforceCustomerSmsSender({
        from: null,
        messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        purpose: 'customer_sms',
        to: '+15551234567',
        tenantId: 'root',
      });
      
      expect(result.allowed).toBe(true);
      expect(result.usedMessagingService).toBe(true);
    });
    
    it('should BLOCK unknown purpose from blocked numbers', () => {
      expect(() => {
        enforceCustomerSmsSender({
          from: '+19188565711',
          purpose: 'unknown_purpose',
          to: '+15551234567',
          tenantId: 'root',
        });
      }).toThrow('[SMS BLOCK]');
    });
  });
  
  describe('validateSmsSender (no-throw version)', () => {
    it('should return error for blocked sends without throwing', () => {
      const result = validateSmsSender({
        from: '+19188565711',
        purpose: 'customer_sms',
        to: '+15551234567',
        tenantId: 'root',
      });
      
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('[SMS BLOCK]');
    });
    
    it('should return success for allowed sends', () => {
      const result = validateSmsSender({
        from: '+19188565304',
        purpose: 'customer_sms',
        to: '+15551234567',
        tenantId: 'root',
      });
      
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
  
  describe('getSmsSenderConfig', () => {
    it('should return masked phone numbers', () => {
      const config = getSmsSenderConfig();
      
      expect(config.mainNumberMasked).toContain('***');
      expect(config.phoneAdminMasked).toContain('***');
      expect(config.blockedNumbers).toContain('+19188565711');
      expect(config.blockedNumbers).toContain('+19189183265');
    });
  });
  
  describe('customer-facing purposes', () => {
    const customerPurposes = [
      'booking_confirmation',
      'booking_reminder',
      'appointment_reminder',
      'conversational_reply',
      'campaign',
      'sms_campaign',
      'portal_notification',
      'opt_in_confirmation',
      'payment_reminder',
      'review_request',
      'general_notification',
    ];
    
    customerPurposes.forEach(purpose => {
      it(`should BLOCK 5711 for purpose: ${purpose}`, () => {
        expect(() => {
          enforceCustomerSmsSender({
            from: '+19188565711',
            purpose,
            to: '+15551234567',
            tenantId: 'root',
          });
        }).toThrow('[SMS BLOCK]');
      });
      
      it(`should ALLOW main number for purpose: ${purpose}`, () => {
        const result = enforceCustomerSmsSender({
          from: '+19188565304',
          purpose,
          to: '+15551234567',
          tenantId: 'root',
        });
        expect(result.allowed).toBe(true);
      });
    });
  });
});
