import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { nanoid } from 'nanoid';

const testSubdomain = `test-ready-${nanoid(8)}`;
const testTenantId = `test-ready-${nanoid(8)}`;

describe('Tenant Readiness Engine', () => {
  beforeAll(async () => {
    const { db } = await import('../../server/db');
    const { tenants, tenantConfig, services } = await import('../../shared/schema');
    
    await db.insert(tenants).values({
      id: testTenantId,
      name: 'Test Readiness Tenant',
      subdomain: testSubdomain,
      planTier: 'pro',
      status: 'active',
    }).onConflictDoNothing();
    
    await db.insert(tenantConfig).values({
      tenantId: testTenantId,
      businessName: 'Test Readiness Business',
      primaryColor: '#ff0000',
      logoUrl: 'https://example.com/logo.png',
      industry: 'auto_detailing',
    }).onConflictDoNothing();
    
    await db.insert(services).values({
      tenantId: testTenantId,
      name: 'Test Service',
      priceRange: '$50-$100',
      overview: 'Test service overview',
      detailedDescription: 'Detailed description',
      duration: '1-2 hours',
      durationHours: '1.5',
      minDurationHours: '1',
      maxDurationHours: '2',
    }).onConflictDoNothing();
  });
  
  afterAll(async () => {
    const { db } = await import('../../server/db');
    const { tenants, tenantConfig, services } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    await db.delete(services).where(eq(services.tenantId, testTenantId));
    await db.delete(tenantConfig).where(eq(tenantConfig.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });
  
  describe('getTenantReadinessReportBySlug', () => {
    it('should throw error for unknown tenant identifier', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      await expect(getTenantReadinessReportBySlug('nonexistent-tenant-xyz'))
        .rejects.toThrow('not found');
    });
    
    it('should return a valid report structure for existing tenant by subdomain', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      expect(report).toBeDefined();
      expect(report.tenantId).toBe(testTenantId);
      expect(report.tenantSlug).toBe(testSubdomain);
      expect(report.tenantName).toBe('Test Readiness Business');
      expect(report.generatedAt).toBeDefined();
      expect(['pass', 'warn', 'fail']).toContain(report.overallStatus);
      expect(report.categories).toBeInstanceOf(Array);
      expect(report.categories.length).toBeGreaterThan(0);
    });
    
    it('should include all required categories', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const categoryIds = report.categories.map(c => c.id);
      expect(categoryIds).toContain('branding');
      expect(categoryIds).toContain('website');
      expect(categoryIds).toContain('telephony');
      expect(categoryIds).toContain('email');
      expect(categoryIds).toContain('ai_booking');
      expect(categoryIds).toContain('conversations');
    });
    
    it('should have valid summary counts', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      expect(report.summary.totalItems).toBeGreaterThan(0);
      expect(report.summary.passCount + report.summary.warnCount + report.summary.failCount).toBe(report.summary.totalItems);
    });
    
    it('should pass branding checks when logo and colors are set', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const brandingCategory = report.categories.find(c => c.id === 'branding');
      expect(brandingCategory).toBeDefined();
      
      const tenantExistsItem = brandingCategory!.items.find(i => i.key === 'tenant.exists');
      expect(tenantExistsItem?.status).toBe('pass');
      
      const visualIdentityItem = brandingCategory!.items.find(i => i.key === 'branding.visual_identity');
      expect(visualIdentityItem?.status).toBe('pass');
    });
  });
  
  describe('computeOverallStatus', () => {
    it('should return fail if any item fails', async () => {
      const { computeOverallStatus } = await import('../../shared/readinessTypes');
      
      const categories = [
        {
          id: 'test',
          label: 'Test',
          items: [
            { key: 'a', label: 'A', status: 'pass' as const },
            { key: 'b', label: 'B', status: 'fail' as const },
            { key: 'c', label: 'C', status: 'warn' as const },
          ],
        },
      ];
      
      expect(computeOverallStatus(categories)).toBe('fail');
    });
    
    it('should return warn if no fails but has warns', async () => {
      const { computeOverallStatus } = await import('../../shared/readinessTypes');
      
      const categories = [
        {
          id: 'test',
          label: 'Test',
          items: [
            { key: 'a', label: 'A', status: 'pass' as const },
            { key: 'b', label: 'B', status: 'warn' as const },
          ],
        },
      ];
      
      expect(computeOverallStatus(categories)).toBe('warn');
    });
    
    it('should return pass if all items pass', async () => {
      const { computeOverallStatus } = await import('../../shared/readinessTypes');
      
      const categories = [
        {
          id: 'test',
          label: 'Test',
          items: [
            { key: 'a', label: 'A', status: 'pass' as const },
            { key: 'b', label: 'B', status: 'pass' as const },
          ],
        },
      ];
      
      expect(computeOverallStatus(categories)).toBe('pass');
    });
  });
  
  describe('Telephony Edge Cases', () => {
    it('should fail when phone config is missing for test tenant', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const telephonyCategory = report.categories.find(c => c.id === 'telephony');
      expect(telephonyCategory).toBeDefined();
      
      const phoneConfigItem = telephonyCategory!.items.find(i => i.key === 'telephony.phone_config_exists');
      expect(phoneConfigItem).toBeDefined();
      expect(phoneConfigItem!.status).toBe('fail');
      expect(phoneConfigItem!.details).toContain('No phone configuration');
    });
    
    it('should fail when SMS number is missing due to no phone config', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const telephonyCategory = report.categories.find(c => c.id === 'telephony');
      const smsItem = telephonyCategory!.items.find(i => i.key === 'telephony.sms_number_present');
      expect(smsItem).toBeDefined();
      expect(smsItem!.status).toBe('fail');
    });
    
    it('should fail when IVR mode is missing due to no phone config', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const telephonyCategory = report.categories.find(c => c.id === 'telephony');
      const ivrItem = telephonyCategory!.items.find(i => i.key === 'telephony.ivr_mode_configured');
      expect(ivrItem).toBeDefined();
      expect(ivrItem!.status).toBe('fail');
    });
  });
  
  describe('Email Edge Cases', () => {
    it('should warn when SendGrid is not configured', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const emailCategory = report.categories.find(c => c.id === 'email');
      expect(emailCategory).toBeDefined();
      
      const globalConfigItem = emailCategory!.items.find(i => i.key === 'email.global_sendgrid_config_present');
      expect(globalConfigItem).toBeDefined();
      expect(globalConfigItem!.status).toBe('warn');
      expect(globalConfigItem!.details).toContain('Missing');
    });
    
    it('should only have global SendGrid check when SendGrid is not configured', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const emailCategory = report.categories.find(c => c.id === 'email');
      expect(emailCategory!.items.length).toBe(1);
      expect(emailCategory!.items[0].key).toBe('email.global_sendgrid_config_present');
    });
  });
  
  describe('Conversation Edge Cases', () => {
    it('should properly distinguish schema access from activity checks', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const conversationsCategory = report.categories.find(c => c.id === 'conversations');
      expect(conversationsCategory).toBeDefined();
      
      const schemaItem = conversationsCategory!.items.find(i => i.key === 'conversations.schema_present');
      
      if (schemaItem) {
        expect(schemaItem.status).toBe('pass');
      }
      
      const activityItem = conversationsCategory!.items.find(i => 
        i.key === 'conversations.recent_activity' || 
        i.key === 'conversations.recent_activity_query_error'
      );
      expect(activityItem).toBeDefined();
    });
    
    it('should use distinct keys for different error states', async () => {
      const { getTenantReadinessReportBySlug } = await import('../../server/services/tenantReadinessService');
      
      const report = await getTenantReadinessReportBySlug(testSubdomain);
      
      const conversationsCategory = report.categories.find(c => c.id === 'conversations');
      expect(conversationsCategory).toBeDefined();
      
      const itemKeys = conversationsCategory!.items.map(i => i.key);
      expect(itemKeys.length).toBe(new Set(itemKeys).size);
    });
  });
  
  describe('computeSummary', () => {
    it('should correctly count items across categories', async () => {
      const { computeSummary } = await import('../../shared/readinessTypes');
      
      const categories = [
        {
          id: 'cat1',
          label: 'Category 1',
          items: [
            { key: 'a', label: 'A', status: 'pass' as const },
            { key: 'b', label: 'B', status: 'fail' as const },
          ],
        },
        {
          id: 'cat2',
          label: 'Category 2',
          items: [
            { key: 'c', label: 'C', status: 'warn' as const },
            { key: 'd', label: 'D', status: 'pass' as const },
          ],
        },
      ];
      
      const summary = computeSummary(categories);
      expect(summary.totalItems).toBe(4);
      expect(summary.passCount).toBe(2);
      expect(summary.warnCount).toBe(1);
      expect(summary.failCount).toBe(1);
    });
  });
});
