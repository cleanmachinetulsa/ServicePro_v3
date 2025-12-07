/**
 * SP-DOMAINS-1: Tenant Domain Management API Routes
 * 
 * Provides authenticated routes for managing tenant custom domains.
 * Currently configuration only - does not affect routing yet.
 */

import { Router } from 'express';
import { z } from 'zod';
import { tenantDomainService } from './services/tenantDomainService';
import { createTenantDomainSchema, updateTenantDomainSchema } from '@shared/schema';
import { log } from './vite';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const domains = await tenantDomainService.listTenantDomains(tenantId);
    
    res.json({ success: true, domains });
  } catch (error) {
    log(`[TENANT DOMAINS] Error listing domains: ${error}`);
    res.status(500).json({ success: false, error: 'Failed to list domains' });
  }
});

router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validation = createTenantDomainSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid domain format',
        details: validation.error.flatten()
      });
    }

    const domain = await tenantDomainService.createTenantDomain(
      tenantId, 
      validation.data.domain
    );

    log(`[TENANT DOMAINS] Created domain ${domain.domain} for tenant ${tenantId}`);
    
    res.status(201).json({ success: true, domain });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ 
        success: false, 
        error: 'Domain already exists' 
      });
    }
    log(`[TENANT DOMAINS] Error creating domain: ${error}`);
    res.status(500).json({ success: false, error: 'Failed to create domain' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const domainId = parseInt(req.params.id, 10);
    if (isNaN(domainId)) {
      return res.status(400).json({ success: false, error: 'Invalid domain ID' });
    }

    const validation = updateTenantDomainSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid update data',
        details: validation.error.flatten()
      });
    }

    if (validation.data.isPrimary === true) {
      const domain = await tenantDomainService.setPrimaryDomain(tenantId, domainId);
      if (!domain) {
        return res.status(404).json({ success: false, error: 'Domain not found' });
      }
      log(`[TENANT DOMAINS] Set primary domain ${domainId} for tenant ${tenantId}`);
      return res.json({ success: true, domain });
    }

    const domain = await tenantDomainService.updateTenantDomain(
      tenantId, 
      domainId, 
      validation.data
    );

    if (!domain) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }

    log(`[TENANT DOMAINS] Updated domain ${domainId} for tenant ${tenantId}`);
    
    res.json({ success: true, domain });
  } catch (error) {
    log(`[TENANT DOMAINS] Error updating domain: ${error}`);
    res.status(500).json({ success: false, error: 'Failed to update domain' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const domainId = parseInt(req.params.id, 10);
    if (isNaN(domainId)) {
      return res.status(400).json({ success: false, error: 'Invalid domain ID' });
    }

    const deleted = await tenantDomainService.deleteTenantDomain(tenantId, domainId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }

    log(`[TENANT DOMAINS] Deleted domain ${domainId} for tenant ${tenantId}`);
    
    res.json({ success: true });
  } catch (error) {
    log(`[TENANT DOMAINS] Error deleting domain: ${error}`);
    res.status(500).json({ success: false, error: 'Failed to delete domain' });
  }
});

export default router;
