import { db } from '../db';
import { tenants, customers, appointments, services } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { TenantInfo } from '../tenantMiddleware';
import { createTenantDb } from '../tenantDb';

export const TENANT_A: TenantInfo = {
  id: 'test-tenant-a',
  name: 'Test Tenant A',
  subdomain: 'tenant-a',
  isRoot: false,
};

export const TENANT_B: TenantInfo = {
  id: 'test-tenant-b',
  name: 'Test Tenant B',
  subdomain: 'tenant-b',
  isRoot: false,
};

export async function setupTestTenants() {
  await db.delete(tenants).where(eq(tenants.id, TENANT_A.id));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B.id));
  
  await db.insert(tenants).values([
    {
      id: TENANT_A.id,
      name: TENANT_A.name,
      subdomain: TENANT_A.subdomain,
      isRoot: false,
    },
    {
      id: TENANT_B.id,
      name: TENANT_B.name,
      subdomain: TENANT_B.subdomain,
      isRoot: false,
    },
  ]);
}

export async function cleanupTenantData() {
  await db.delete(appointments).where(eq(appointments.tenantId, TENANT_A.id));
  await db.delete(appointments).where(eq(appointments.tenantId, TENANT_B.id));
  await db.delete(customers).where(eq(customers.tenantId, TENANT_A.id));
  await db.delete(customers).where(eq(customers.tenantId, TENANT_B.id));
  await db.delete(services).where(eq(services.tenantId, TENANT_A.id));
  await db.delete(services).where(eq(services.tenantId, TENANT_B.id));
}

export async function cleanupTestTenants() {
  await cleanupTenantData();
  await db.delete(tenants).where(eq(tenants.id, TENANT_A.id));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B.id));
}

export async function createTestCustomer(
  tenantInfo: TenantInfo,
  data: { name: string; phone: string; email?: string }
) {
  const tenantDb = createTenantDb(tenantInfo);
  const [customer] = await tenantDb.insert(customers).values({
    name: data.name,
    phone: data.phone,
    email: data.email || null,
  }).returning();
  return customer;
}

export async function createTestService(
  tenantInfo: TenantInfo,
  data: { name: string; priceRange?: string }
) {
  const tenantDb = createTenantDb(tenantInfo);
  const [service] = await tenantDb.insert(services).values({
    name: data.name,
    priceRange: data.priceRange || '$100 - $200',
    overview: 'Test service overview',
    detailedDescription: 'Test service detailed description',
    duration: '1-2 hours',
    durationHours: '1.5',
    minDurationHours: '1.5',
    maxDurationHours: '2',
  }).returning();
  return service;
}

export async function queryCustomers(tenantInfo: TenantInfo) {
  const tenantDb = createTenantDb(tenantInfo);
  return await tenantDb.query.customers.findMany({
    where: tenantDb.withTenantFilter(customers),
  });
}

export async function countTenantRecords(
  tenantInfo: TenantInfo,
  table: typeof customers | typeof services
) {
  const tenantDb = createTenantDb(tenantInfo);
  const records = await tenantDb.query[table === customers ? 'customers' : 'services'].findMany({
    where: tenantDb.withTenantFilter(table),
  });
  return records.length;
}
