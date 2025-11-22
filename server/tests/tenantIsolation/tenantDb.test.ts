import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../db';
import { customers, services } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTenantDb } from '../../tenantDb';
import {
  setupTestTenants,
  cleanupTenantData,
  cleanupTestTenants,
  createTestCustomer,
  createTestService,
  queryCustomers,
  countTenantRecords,
  TENANT_A,
  TENANT_B,
} from '../setupTenantDb';

describe('Tenant Isolation - tenantDb Wrapper', () => {
  beforeAll(async () => {
    await setupTestTenants();
  });

  afterAll(async () => {
    await cleanupTestTenants();
  });

  beforeEach(async () => {
    await cleanupTenantData();
  });

  describe('Tenant Context', () => {
    it('should attach correct tenant context to tenantDb', () => {
      const tenantDbA = createTenantDb(TENANT_A);
      const tenantDbB = createTenantDb(TENANT_B);

      expect(tenantDbA.tenant.id).toBe('test-tenant-a');
      expect(tenantDbA.tenant.name).toBe('Test Tenant A');
      expect(tenantDbB.tenant.id).toBe('test-tenant-b');
      expect(tenantDbB.tenant.name).toBe('Test Tenant B');
    });
  });

  describe('Insert Operations', () => {
    it('should auto-inject tenant_id when inserting customers', async () => {
      const customerA = await createTestCustomer(TENANT_A, {
        name: 'Alice',
        phone: '555-0001',
        email: 'alice@example.com',
      });

      expect(customerA.tenantId).toBe('test-tenant-a');
      expect(customerA.name).toBe('Alice');
    });

    it('should auto-inject tenant_id when inserting services', async () => {
      const serviceA = await createTestService(TENANT_A, {
        name: 'Premium Detail',
        priceRange: '$200-$300',
      });

      expect(serviceA.tenantId).toBe('test-tenant-a');
      expect(serviceA.name).toBe('Premium Detail');
    });

    it('should handle bulk inserts with tenant_id injection', async () => {
      const tenantDbA = createTenantDb(TENANT_A);
      const inserted = await tenantDbA.insert(customers).values([
        { name: 'Customer 1', phone: '555-0001' },
        { name: 'Customer 2', phone: '555-0002' },
        { name: 'Customer 3', phone: '555-0003' },
      ]).returning();

      expect(inserted).toHaveLength(3);
      expect(inserted[0].tenantId).toBe('test-tenant-a');
      expect(inserted[1].tenantId).toBe('test-tenant-a');
      expect(inserted[2].tenantId).toBe('test-tenant-a');
    });
  });

  describe('Query Operations', () => {
    it('should only return records for the correct tenant', async () => {
      await createTestCustomer(TENANT_A, { name: 'Alice A', phone: '555-0001' });
      await createTestCustomer(TENANT_A, { name: 'Bob A', phone: '555-0002' });
      await createTestCustomer(TENANT_B, { name: 'Charlie B', phone: '555-0003' });

      const customersA = await queryCustomers(TENANT_A);
      const customersB = await queryCustomers(TENANT_B);

      expect(customersA).toHaveLength(2);
      expect(customersB).toHaveLength(1);
      expect(customersA[0].name).toContain('A');
      expect(customersB[0].name).toContain('B');
    });

    it('should enforce tenant isolation with withTenantFilter', async () => {
      await createTestCustomer(TENANT_A, { name: 'Alice', phone: '555-0001' });
      await createTestCustomer(TENANT_B, { name: 'Bob', phone: '555-0002' });

      const tenantDbA = createTenantDb(TENANT_A);
      const result = await tenantDbA.query.customers.findFirst({
        where: tenantDbA.withTenantFilter(customers, eq(customers.name, 'Bob')),
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Update Operations', () => {
    it('should only update records within the tenant scope', async () => {
      const customerA = await createTestCustomer(TENANT_A, { name: 'Alice', phone: '555-0001' });
      await createTestCustomer(TENANT_B, { name: 'Bob', phone: '555-0002' });

      const tenantDbA = createTenantDb(TENANT_A);
      await tenantDbA.update(customers)
        .set({ name: 'Alice Updated' })
        .where(eq(customers.id, customerA.id));

      const countA = await countTenantRecords(TENANT_A, customers);
      const countB = await countTenantRecords(TENANT_B, customers);

      expect(countA).toBe(1);
      expect(countB).toBe(1);

      const updatedCustomer = await tenantDbA.query.customers.findFirst({
        where: tenantDbA.withTenantFilter(customers, eq(customers.id, customerA.id)),
      });

      expect(updatedCustomer?.name).toBe('Alice Updated');
    });

    it('should prevent cross-tenant updates', async () => {
      const customerA = await createTestCustomer(TENANT_A, { name: 'Alice', phone: '555-0001' });
      const customerB = await createTestCustomer(TENANT_B, { name: 'Bob', phone: '555-0002' });

      const tenantDbA = createTenantDb(TENANT_A);
      await tenantDbA.update(customers)
        .set({ name: 'Hacked' })
        .where(eq(customers.id, customerB.id));

      const customerBAfterUpdate = await db.query.customers.findFirst({
        where: eq(customers.id, customerB.id),
      });

      expect(customerBAfterUpdate?.name).toBe('Bob');
    });
  });

  describe('Delete Operations', () => {
    it('should only delete records within tenant scope', async () => {
      const customerA1 = await createTestCustomer(TENANT_A, { name: 'Alice 1', phone: '555-0001' });
      await createTestCustomer(TENANT_A, { name: 'Alice 2', phone: '555-0002' });
      await createTestCustomer(TENANT_B, { name: 'Bob', phone: '555-0003' });

      const tenantDbA = createTenantDb(TENANT_A);
      await tenantDbA.delete(customers).where(eq(customers.id, customerA1.id));

      const countA = await countTenantRecords(TENANT_A, customers);
      const countB = await countTenantRecords(TENANT_B, customers);

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    it('should prevent cross-tenant deletes', async () => {
      const customerA = await createTestCustomer(TENANT_A, { name: 'Alice', phone: '555-0001' });
      const customerB = await createTestCustomer(TENANT_B, { name: 'Bob', phone: '555-0002' });

      const tenantDbA = createTenantDb(TENANT_A);
      await tenantDbA.delete(customers).where(eq(customers.id, customerB.id));

      const customerBAfterDelete = await db.query.customers.findFirst({
        where: eq(customers.id, customerB.id),
      });

      expect(customerBAfterDelete).toBeDefined();
      expect(customerBAfterDelete?.name).toBe('Bob');
    });
  });

  describe('Mixed Operations', () => {
    it('should maintain tenant isolation across insert, query, update, delete', async () => {
      const customerA = await createTestCustomer(TENANT_A, { name: 'Alice', phone: '555-0001' });
      const customerB = await createTestCustomer(TENANT_B, { name: 'Bob', phone: '555-0002' });
      const serviceA = await createTestService(TENANT_A, { name: 'Service A' });
      const serviceB = await createTestService(TENANT_B, { name: 'Service B' });

      const countCustomersA = await countTenantRecords(TENANT_A, customers);
      const countCustomersB = await countTenantRecords(TENANT_B, customers);
      const countServicesA = await countTenantRecords(TENANT_A, services);
      const countServicesB = await countTenantRecords(TENANT_B, services);

      expect(countCustomersA).toBe(1);
      expect(countCustomersB).toBe(1);
      expect(countServicesA).toBe(1);
      expect(countServicesB).toBe(1);

      const tenantDbA = createTenantDb(TENANT_A);
      await tenantDbA.update(customers)
        .set({ name: 'Alice Updated' })
        .where(eq(customers.id, customerA.id));

      await tenantDbA.delete(services).where(eq(services.id, serviceA.id));

      const finalCountCustomersA = await countTenantRecords(TENANT_A, customers);
      const finalCountServicesA = await countTenantRecords(TENANT_A, services);
      const finalCountCustomersB = await countTenantRecords(TENANT_B, customers);
      const finalCountServicesB = await countTenantRecords(TENANT_B, services);

      expect(finalCountCustomersA).toBe(1);
      expect(finalCountServicesA).toBe(0);
      expect(finalCountCustomersB).toBe(1);
      expect(finalCountServicesB).toBe(1);
    });
  });
});
