import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import { db } from '../db';
import { users, tenants, tenantConfig } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

describe('Admin Impersonation Endpoints', () => {
  let ownerSession: string;
  let adminSession: string;
  let staffSession: string;
  let testTenantId: string;

  beforeEach(async () => {
    await db.delete(tenants).where(eq(tenants.id, 'test-impersonate-tenant'));
    await db.delete(tenants).where(eq(tenants.id, 'test-impersonate-tenant-2'));

    testTenantId = 'test-impersonate-tenant';
    await db.insert(tenants).values({
      id: testTenantId,
      name: 'Test Impersonation Tenant',
      isRoot: false,
    });

    await db.insert(tenantConfig).values({
      tenantId: testTenantId,
      businessName: 'Test Business for Impersonation',
      tier: 'starter',
    });

    const ownerPassword = await bcrypt.hash('owner123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const staffPassword = await bcrypt.hash('staff123', 10);

    await db.insert(users).values({
      username: 'impersonate-owner',
      password: ownerPassword,
      role: 'owner',
      tenantId: 'root',
    });

    await db.insert(users).values({
      username: 'impersonate-admin',
      password: adminPassword,
      role: 'admin',
      tenantId: 'root',
    });

    await db.insert(users).values({
      username: 'impersonate-staff',
      password: staffPassword,
      role: 'staff',
      tenantId: 'root',
    });

    const ownerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'impersonate-owner', password: 'owner123' });
    ownerSession = ownerLoginRes.headers['set-cookie'][0];

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'impersonate-admin', password: 'admin123' });
    adminSession = adminLoginRes.headers['set-cookie'][0];

    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'impersonate-staff', password: 'staff123' });
    staffSession = staffLoginRes.headers['set-cookie'][0];
  });

  describe('POST /api/admin/impersonate/start', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/start')
        .send({ tenantId: testTenantId });

      expect(response.status).toBe(401);
    });

    it('should return 403 when non-owner user tries to impersonate', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [adminSession])
        .send({ tenantId: testTenantId });

      expect(response.status).toBe(403);
    });

    it('should return 404 when tenant does not exist', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: 'non-existent-tenant' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Tenant not found');
    });

    it('should return 400 when trying to impersonate root tenant', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: 'root' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Root tenant cannot be impersonated');
    });

    it('should successfully start impersonation for owner with valid tenant', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: testTenantId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tenantId).toBe(testTenantId);
      expect(response.body.tenantName).toBe('Test Impersonation Tenant');
      expect(response.body.message).toBe('Impersonation started');
    });

    it('should persist impersonation in session', async () => {
      const startResponse = await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: testTenantId });

      expect(startResponse.status).toBe(200);

      const contextResponse = await request(app)
        .get('/api/auth/context')
        .set('Cookie', [ownerSession]);

      expect(contextResponse.status).toBe(200);
      expect(contextResponse.body.success).toBe(true);
      expect(contextResponse.body.impersonation.isActive).toBe(true);
      expect(contextResponse.body.impersonation.tenantId).toBe(testTenantId);
      expect(contextResponse.body.impersonation.tenantName).toBe('Test Impersonation Tenant');
    });
  });

  describe('POST /api/admin/impersonate/stop', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/stop');

      expect(response.status).toBe(401);
    });

    it('should successfully stop impersonation', async () => {
      await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: testTenantId });

      const stopResponse = await request(app)
        .post('/api/admin/impersonate/stop')
        .set('Cookie', [ownerSession]);

      expect(stopResponse.status).toBe(200);
      expect(stopResponse.body.success).toBe(true);
      expect(stopResponse.body.message).toBe('Impersonation cleared');
    });

    it('should clear impersonation from session', async () => {
      await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: testTenantId });

      await request(app)
        .post('/api/admin/impersonate/stop')
        .set('Cookie', [ownerSession]);

      const contextResponse = await request(app)
        .get('/api/auth/context')
        .set('Cookie', [ownerSession]);

      expect(contextResponse.status).toBe(200);
      expect(contextResponse.body.impersonation.isActive).toBe(false);
      expect(contextResponse.body.impersonation.tenantId).toBe(null);
    });

    it('should be idempotent - stopping when not impersonating should succeed', async () => {
      const response = await request(app)
        .post('/api/admin/impersonate/stop')
        .set('Cookie', [ownerSession]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/context', () => {
    it('should return impersonation state when active', async () => {
      await request(app)
        .post('/api/admin/impersonate/start')
        .set('Cookie', [ownerSession])
        .send({ tenantId: testTenantId });

      const response = await request(app)
        .get('/api/auth/context')
        .set('Cookie', [ownerSession]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.impersonation).toBeDefined();
      expect(response.body.impersonation.isActive).toBe(true);
      expect(response.body.impersonation.tenantId).toBe(testTenantId);
      expect(response.body.impersonation.tenantName).toBe('Test Impersonation Tenant');
    });

    it('should return no impersonation when not active', async () => {
      const response = await request(app)
        .get('/api/auth/context')
        .set('Cookie', [ownerSession]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.impersonation.isActive).toBe(false);
      expect(response.body.impersonation.tenantId).toBe(null);
    });
  });
});
