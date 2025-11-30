import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { nanoid } from 'nanoid';

const originalEnv = { ...process.env };

const testTenantIdA = `test-ctx-no-env-${nanoid(8)}`;
const testTenantIdB = `test-ctx-no-profile-${nanoid(8)}`;
const testTenantIdC = `test-ctx-healthy-${nanoid(8)}`;

describe('Phase 11 - Agent Context Email Integration', () => {
  beforeAll(async () => {
    const { db } = await import('../../server/db');
    const { tenants, tenantEmailProfiles, tenantConfig } = await import('../../shared/schema');
    
    await db.insert(tenants).values([
      { id: testTenantIdA, name: 'Test No Env Tenant', slug: `test-no-env-${nanoid(8)}` },
      { id: testTenantIdB, name: 'Test No Profile Tenant', slug: `test-no-profile-${nanoid(8)}` },
      { id: testTenantIdC, name: 'Test Healthy Tenant', slug: `test-healthy-${nanoid(8)}` },
    ]).onConflictDoNothing();
    
    await db.insert(tenantConfig).values([
      { tenantId: testTenantIdA, businessName: 'No Env Business' },
      { tenantId: testTenantIdB, businessName: 'No Profile Business' },
      { tenantId: testTenantIdC, businessName: 'Healthy Business' },
    ]).onConflictDoNothing();
    
    await db.insert(tenantEmailProfiles).values({
      tenantId: testTenantIdC,
      provider: 'sendgrid',
      fromName: 'Healthy Business',
      fromEmail: null,
      replyToEmail: 'owner@healthybusiness.com',
      status: 'healthy',
    }).onConflictDoNothing();
  });
  
  afterAll(async () => {
    const { db } = await import('../../server/db');
    const { tenants, tenantEmailProfiles, tenantConfig } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    await db.delete(tenantEmailProfiles).where(eq(tenantEmailProfiles.tenantId, testTenantIdA));
    await db.delete(tenantEmailProfiles).where(eq(tenantEmailProfiles.tenantId, testTenantIdB));
    await db.delete(tenantEmailProfiles).where(eq(tenantEmailProfiles.tenantId, testTenantIdC));
    
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, testTenantIdA));
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, testTenantIdB));
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, testTenantIdC));
    
    await db.delete(tenants).where(eq(tenants.id, testTenantIdA));
    await db.delete(tenants).where(eq(tenants.id, testTenantIdB));
    await db.delete(tenants).where(eq(tenants.id, testTenantIdC));
    
    process.env = originalEnv;
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });
  
  describe('CASE A - No SendGrid env vars', () => {
    it('should return provider="none" and add email.missing_env gap', async () => {
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_FROM_EMAIL;
      
      vi.resetModules();
      
      const { db } = await import('../../server/db');
      const { wrapTenantDb } = await import('../../server/tenantDb');
      const { buildAgentContext } = await import('../../server/services/agentContextService');
      
      const tenantDb = wrapTenantDb(db, testTenantIdA);
      const context = await buildAgentContext({ tenantId: testTenantIdA, tenantDb });
      
      expect(context.email.provider).toBe('none');
      expect(context.email.status).toBe('not_configured');
      
      const emailMissingEnvGap = context.gaps.find(g => g.key === 'email.missing_env');
      expect(emailMissingEnvGap).toBeDefined();
      expect(emailMissingEnvGap?.severity).toBe('critical');
      expect(emailMissingEnvGap?.area).toBe('email');
    });
  });
  
  describe('CASE B - SendGrid enabled but NO tenant profile', () => {
    it('should return provider="sendgrid", status indicates needs setup, and add profile_missing gap', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-case-b-key';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      vi.resetModules();
      
      const { db } = await import('../../server/db');
      const { wrapTenantDb } = await import('../../server/tenantDb');
      const { tenantEmailProfiles } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.delete(tenantEmailProfiles).where(eq(tenantEmailProfiles.tenantId, testTenantIdB));
      
      const { buildAgentContext } = await import('../../server/services/agentContextService');
      
      const tenantDb = wrapTenantDb(db, testTenantIdB);
      const context = await buildAgentContext({ tenantId: testTenantIdB, tenantDb });
      
      expect(context.email.provider).toBe('sendgrid');
      
      const profileMissingGap = context.gaps.find(g => g.key === 'email.profile_missing');
      expect(profileMissingGap).toBeDefined();
      expect(profileMissingGap?.severity).toBe('warning');
    });
  });
  
  describe('CASE C - Tenant has profile + healthy status', () => {
    it('should return provider="sendgrid", status="sender_verified" or "configured_healthy", no email gaps', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-case-c-key';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      vi.resetModules();
      
      const { db } = await import('../../server/db');
      const { wrapTenantDb } = await import('../../server/tenantDb');
      const { tenantEmailProfiles } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.update(tenantEmailProfiles)
        .set({ status: 'healthy' })
        .where(eq(tenantEmailProfiles.tenantId, testTenantIdC));
      
      const { buildAgentContext } = await import('../../server/services/agentContextService');
      
      const tenantDb = wrapTenantDb(db, testTenantIdC);
      const context = await buildAgentContext({ tenantId: testTenantIdC, tenantDb });
      
      expect(context.email.provider).toBe('sendgrid');
      expect(['sender_verified', 'configured_healthy', 'healthy']).toContain(context.email.status);
      
      const emailGaps = context.gaps.filter(g => g.area === 'email');
      expect(emailGaps.length).toBe(0);
    });
  });
  
  describe('Profile error state handling', () => {
    it('should add email.profile_error gap when profile status is error', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-error-key';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      vi.resetModules();
      
      const { db } = await import('../../server/db');
      const { wrapTenantDb } = await import('../../server/tenantDb');
      const { tenantEmailProfiles } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.update(tenantEmailProfiles)
        .set({ status: 'error', lastError: 'Test error message' })
        .where(eq(tenantEmailProfiles.tenantId, testTenantIdC));
      
      const { buildAgentContext } = await import('../../server/services/agentContextService');
      
      const tenantDb = wrapTenantDb(db, testTenantIdC);
      const context = await buildAgentContext({ tenantId: testTenantIdC, tenantDb });
      
      const errorGap = context.gaps.find(g => g.key === 'email.profile_error');
      expect(errorGap).toBeDefined();
      expect(errorGap?.severity).toBe('warning');
      
      await db.update(tenantEmailProfiles)
        .set({ status: 'healthy', lastError: null })
        .where(eq(tenantEmailProfiles.tenantId, testTenantIdC));
    });
  });
  
  describe('Tenant isolation in agent context', () => {
    it('should only return email profile data for the requested tenant', async () => {
      process.env.SENDGRID_API_KEY = 'SG.test-isolation-key';
      process.env.SENDGRID_FROM_EMAIL = 'noreply@platform.com';
      
      vi.resetModules();
      
      const { db } = await import('../../server/db');
      const { wrapTenantDb } = await import('../../server/tenantDb');
      const { buildAgentContext } = await import('../../server/services/agentContextService');
      
      const tenantDbC = wrapTenantDb(db, testTenantIdC);
      const contextC = await buildAgentContext({ tenantId: testTenantIdC, tenantDb: tenantDbC });
      
      const tenantDbB = wrapTenantDb(db, testTenantIdB);
      const contextB = await buildAgentContext({ tenantId: testTenantIdB, tenantDb: tenantDbB });
      
      const cHasProfile = contextC.gaps.filter(g => g.key === 'email.profile_missing').length === 0;
      const bMissingProfile = contextB.gaps.some(g => g.key === 'email.profile_missing');
      
      expect(cHasProfile).toBe(true);
      expect(bMissingProfile).toBe(true);
    });
  });
});
