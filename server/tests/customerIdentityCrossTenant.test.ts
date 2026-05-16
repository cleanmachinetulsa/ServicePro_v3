/**
 * Audit T1 (Cross-tenant identity): Verify resolveCustomerIdentity()
 * never leaks across tenants. The same E.164 number used in two
 * tenants must yield two distinct customer IDs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestTenants, cleanupTestTenants, TENANT_A, TENANT_B } from './setupTenantDb';
import { createTenantDb } from '../tenantDb';
import { resolveCustomerIdentity } from '../services/customerIdentityService';

describe('Cross-tenant customer identity isolation (Audit T1)', () => {
  beforeAll(async () => {
    await setupTestTenants();
  });

  afterAll(async () => {
    await cleanupTestTenants();
  });

  it('creates distinct customer rows for the same phone in two tenants', async () => {
    const dbA = createTenantDb(TENANT_A);
    const dbB = createTenantDb(TENANT_B);

    const sharedPhone = '+19185550199';

    const idA = await resolveCustomerIdentity(dbA, { tenantId: TENANT_A.id, phone: sharedPhone });
    const idB = await resolveCustomerIdentity(dbB, { tenantId: TENANT_B.id, phone: sharedPhone });

    expect(idA.customerId).toBeGreaterThan(0);
    expect(idB.customerId).toBeGreaterThan(0);
    expect(idA.customerId).not.toBe(idB.customerId);
    expect(idA.tenantId).toBe(TENANT_A.id);
    expect(idB.tenantId).toBe(TENANT_B.id);
    expect(idA.primaryPhone).toBe(sharedPhone);
    expect(idB.primaryPhone).toBe(sharedPhone);
  });

  it('re-resolving the same tenant+phone returns the same customer (no duplicate)', async () => {
    const dbA = createTenantDb(TENANT_A);
    const phone = '+19185550211';

    const first = await resolveCustomerIdentity(dbA, { tenantId: TENANT_A.id, phone });
    const second = await resolveCustomerIdentity(dbA, { tenantId: TENANT_A.id, phone });

    expect(first.customerId).toBe(second.customerId);
    expect(first.identityId).toBe(second.identityId);
  });

  it('does not surface tenant B customer when querying with tenant A db', async () => {
    const dbA = createTenantDb(TENANT_A);
    const dbB = createTenantDb(TENANT_B);

    const onlyInB = '+19185550288';
    const created = await resolveCustomerIdentity(dbB, { tenantId: TENANT_B.id, phone: onlyInB });
    expect(created.customerId).toBeGreaterThan(0);
    expect(created.tenantId).toBe(TENANT_B.id);

    // Resolving the same number in tenant A must mint a *new* row,
    // not return tenant B's customer.
    const seenInA = await resolveCustomerIdentity(dbA, { tenantId: TENANT_A.id, phone: onlyInB });
    expect(seenInA.customerId).not.toBe(created.customerId);
    expect(seenInA.tenantId).toBe(TENANT_A.id);
  });
});
