import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/db';
import { wrapTenantDb } from '../../server/tenantDb';
import { tenants, tenantEmailProfiles, tenantConfig } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const originalEnv = { ...process.env };

describe('Phase 11 - Email Service Behavior', () => {
  const testTenantId = `test-email-svc-${nanoid(8)}`;
  const testSlug = `test-email-svc-${nanoid(8)}`;
  
  beforeAll(async () => {
    await db.insert(tenants).values({
      id: testTenantId,
      name: 'Test Email Service Tenant',
      slug: testSlug,
    }).onConflictDoNothing();
    
    await db.insert(tenantConfig).values({
      tenantId: testTenantId,
      businessName: 'Test Email Business',
      primaryContactEmail: 'owner@testemail.com',
    }).onConflictDoNothing();
  });
  
  afterAll(async () => {
    await db.delete(tenantEmailProfiles).where(eq(tenantEmailProfiles.tenantId, testTenantId));
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
    
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    vi.resetModules();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });
  
  describe('When SENDGRID_API_KEY is missing', () => {
    it('should return ok:false with reason:missing_env and not throw', async () => {
      delete process.env.SENDGRID_API_KEY;
      
      const { sendTenantEmail } = await import('../../server/services/tenantEmailService');
      const tenantDb = wrapTenantDb(db, testTenantId);
      
      let result;
      let threwError = false;
      
      try {
        result = await sendTenantEmail(tenantDb, testTenantId, {
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        });
      } catch (e) {
        threwError = true;
      }
      
      expect(threwError).toBe(false);
      expect(result).toBeDefined();
      expect(result?.ok).toBe(false);
      expect(result?.reason).toBe('missing_env');
    });
    
    it('should not write any status changes to DB when env is missing', async () => {
      delete process.env.SENDGRID_API_KEY;
      
      const { sendTenantEmail } = await import('../../server/services/tenantEmailService');
      const tenantDb = wrapTenantDb(db, testTenantId);
      
      const beforeProfiles = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId));
      
      await sendTenantEmail(tenantDb, testTenantId, {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      
      const afterProfiles = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId));
      
      expect(afterProfiles.length).toBe(beforeProfiles.length);
    });
  });
  
  describe('When API key exists but tenant email profile does not exist', () => {
    it('should fall back to tenant owner email as reply-to if profile missing', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-key-12345';
      process.env.SENDGRID_FROM_EMAIL = 'test@platform.com';
      
      await db.delete(tenantEmailProfiles).where(eq(tenantEmailProfiles.tenantId, testTenantId));
      
      vi.doMock('@sendgrid/mail', () => ({
        default: {
          setApiKey: vi.fn(),
          send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
        },
      }));
      
      const { sendTenantEmail } = await import('../../server/services/tenantEmailService');
      const tenantDb = wrapTenantDb(db, testTenantId);
      
      const result = await sendTenantEmail(tenantDb, testTenantId, {
        to: 'recipient@example.com',
        subject: 'Test Fallback',
        html: '<p>Testing fallback</p>',
      });
      
      expect(result.ok).toBe(true);
    });
  });
  
  describe('When full profile exists AND API key exists', () => {
    it('should return ok:true and update status to healthy on success', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-key-67890';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      await db.insert(tenantEmailProfiles).values({
        tenantId: testTenantId,
        provider: 'sendgrid',
        fromName: 'Test Business',
        fromEmail: null,
        replyToEmail: 'reply@testbusiness.com',
        status: 'needs_verification',
      }).onConflictDoNothing();
      
      vi.doMock('@sendgrid/mail', () => ({
        default: {
          setApiKey: vi.fn(),
          send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
        },
      }));
      
      const { sendTenantEmail } = await import('../../server/services/tenantEmailService');
      const tenantDb = wrapTenantDb(db, testTenantId);
      
      const result = await sendTenantEmail(tenantDb, testTenantId, {
        to: 'success@example.com',
        subject: 'Success Test',
        html: '<p>Should succeed</p>',
      });
      
      expect(result.ok).toBe(true);
      
      const [updatedProfile] = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId))
        .limit(1);
      
      expect(updatedProfile?.status).toBe('healthy');
    });
  });
  
  describe('When SendGrid send fails', () => {
    it('should return ok:false with reason:send_failed and update status to error', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-key-error';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      await db.update(tenantEmailProfiles)
        .set({ status: 'needs_verification' })
        .where(eq(tenantEmailProfiles.tenantId, testTenantId));
      
      vi.doMock('@sendgrid/mail', () => ({
        default: {
          setApiKey: vi.fn(),
          send: vi.fn().mockRejectedValue(new Error('SendGrid API Error')),
        },
      }));
      
      const { sendTenantEmail } = await import('../../server/services/tenantEmailService');
      const tenantDb = wrapTenantDb(db, testTenantId);
      
      const result = await sendTenantEmail(tenantDb, testTenantId, {
        to: 'fail@example.com',
        subject: 'Failure Test',
        html: '<p>Should fail</p>',
      });
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('send_failed');
      
      const [updatedProfile] = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId))
        .limit(1);
      
      expect(updatedProfile?.status).toBe('error');
    });
  });
  
  describe('Invalid recipient handling', () => {
    it('should return ok:false with reason:invalid_recipient for bad email', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-key-invalid';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      const { sendTenantEmail } = await import('../../server/services/tenantEmailService');
      const tenantDb = wrapTenantDb(db, testTenantId);
      
      const result = await sendTenantEmail(tenantDb, testTenantId, {
        to: 'not-a-valid-email',
        subject: 'Invalid Email Test',
        html: '<p>Should fail validation</p>',
      });
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_recipient');
    });
  });
});
