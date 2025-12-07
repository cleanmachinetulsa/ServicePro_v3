/**
 * SP-DOMAINS-1: Tenant Domain Management Service
 * 
 * Provides CRUD operations for tenant custom domains.
 * Currently stores configuration only - does not affect routing yet.
 */

import { db } from '../db';
import { tenantDomains, type TenantDomain, type InsertTenantDomain, type UpdateTenantDomain } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export const tenantDomainService = {
  async listTenantDomains(tenantId: string): Promise<TenantDomain[]> {
    return db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId))
      .orderBy(tenantDomains.createdAt);
  },

  async getTenantDomain(tenantId: string, domainId: number): Promise<TenantDomain | null> {
    const results = await db
      .select()
      .from(tenantDomains)
      .where(and(
        eq(tenantDomains.id, domainId),
        eq(tenantDomains.tenantId, tenantId)
      ))
      .limit(1);
    
    return results[0] || null;
  },

  async createTenantDomain(tenantId: string, domain: string): Promise<TenantDomain> {
    const existing = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId));
    
    const isPrimary = existing.length === 0;

    const [newDomain] = await db
      .insert(tenantDomains)
      .values({
        tenantId,
        domain: domain.toLowerCase(),
        isPrimary,
        status: 'pending',
      })
      .returning();
    
    return newDomain;
  },

  async updateTenantDomain(
    tenantId: string, 
    domainId: number, 
    data: UpdateTenantDomain
  ): Promise<TenantDomain | null> {
    const [updated] = await db
      .update(tenantDomains)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(tenantDomains.id, domainId),
        eq(tenantDomains.tenantId, tenantId)
      ))
      .returning();
    
    return updated || null;
  },

  async setPrimaryDomain(tenantId: string, domainId: number): Promise<TenantDomain | null> {
    await db
      .update(tenantDomains)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(tenantDomains.tenantId, tenantId));

    const [updated] = await db
      .update(tenantDomains)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(and(
        eq(tenantDomains.id, domainId),
        eq(tenantDomains.tenantId, tenantId)
      ))
      .returning();
    
    return updated || null;
  },

  async deleteTenantDomain(tenantId: string, domainId: number): Promise<boolean> {
    const domain = await this.getTenantDomain(tenantId, domainId);
    if (!domain) return false;

    await db
      .delete(tenantDomains)
      .where(and(
        eq(tenantDomains.id, domainId),
        eq(tenantDomains.tenantId, tenantId)
      ));

    if (domain.isPrimary) {
      const remaining = await this.listTenantDomains(tenantId);
      if (remaining.length > 0) {
        await this.setPrimaryDomain(tenantId, remaining[0].id);
      }
    }

    return true;
  },

  async getDomainByHostname(hostname: string): Promise<TenantDomain | null> {
    const results = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.domain, hostname.toLowerCase()))
      .limit(1);
    
    return results[0] || null;
  },
};

export default tenantDomainService;
