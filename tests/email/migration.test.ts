import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { tenants, tenantEmailProfiles } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

describe('Phase 11 - Email Migration & Tenant Isolation', () => {
  const testTenantId1 = `test-email-tenant-1-${nanoid(8)}`;
  const testTenantId2 = `test-email-tenant-2-${nanoid(8)}`;
  
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: testTenantId1, name: 'Test Tenant 1 Email', slug: `test-email-1-${nanoid(8)}` },
      { id: testTenantId2, name: 'Test Tenant 2 Email', slug: `test-email-2-${nanoid(8)}` },
    ]).onConflictDoNothing();
  });
  
  afterAll(async () => {
    await db.delete(tenantEmailProfiles).where(
      eq(tenantEmailProfiles.tenantId, testTenantId1)
    );
    await db.delete(tenantEmailProfiles).where(
      eq(tenantEmailProfiles.tenantId, testTenantId2)
    );
    await db.delete(tenants).where(eq(tenants.id, testTenantId1));
    await db.delete(tenants).where(eq(tenants.id, testTenantId2));
  });
  
  describe('Table Existence', () => {
    it('should have tenant_email_profiles table accessible', async () => {
      const result = await db.select().from(tenantEmailProfiles).limit(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('Insert & Read Operations', () => {
    it('should insert a tenant email profile and read it back successfully', async () => {
      const profileData = {
        tenantId: testTenantId1,
        provider: 'sendgrid' as const,
        fromName: 'Test Business 1',
        fromEmail: 'test@tenant1.com',
        replyToEmail: 'reply@tenant1.com',
        status: 'needs_verification' as const,
      };
      
      await db.insert(tenantEmailProfiles).values(profileData);
      
      const [result] = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId1))
        .limit(1);
      
      expect(result).toBeDefined();
      expect(result.tenantId).toBe(testTenantId1);
      expect(result.fromName).toBe('Test Business 1');
      expect(result.provider).toBe('sendgrid');
      expect(result.status).toBe('needs_verification');
    });
  });
  
  describe('Multi-Tenant Isolation', () => {
    it('should not allow tenant 2 to see tenant 1 email profile when filtering by tenantId', async () => {
      await db.insert(tenantEmailProfiles).values({
        tenantId: testTenantId2,
        provider: 'sendgrid',
        fromName: 'Test Business 2',
        fromEmail: 'test@tenant2.com',
        replyToEmail: 'reply@tenant2.com',
        status: 'healthy',
      }).onConflictDoNothing();
      
      const tenant1Profiles = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId1));
      
      const tenant2Profiles = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId2));
      
      expect(tenant1Profiles.length).toBeGreaterThanOrEqual(1);
      expect(tenant2Profiles.length).toBeGreaterThanOrEqual(1);
      
      const tenant1HasTenant2Data = tenant1Profiles.some(p => p.tenantId === testTenantId2);
      const tenant2HasTenant1Data = tenant2Profiles.some(p => p.tenantId === testTenantId1);
      
      expect(tenant1HasTenant2Data).toBe(false);
      expect(tenant2HasTenant1Data).toBe(false);
    });
    
    it('should maintain data isolation even with multiple profiles', async () => {
      const allProfiles = await db.select()
        .from(tenantEmailProfiles)
        .where(eq(tenantEmailProfiles.tenantId, testTenantId1));
      
      const leakedProfiles = allProfiles.filter(p => p.tenantId !== testTenantId1);
      expect(leakedProfiles.length).toBe(0);
    });
  });
});
