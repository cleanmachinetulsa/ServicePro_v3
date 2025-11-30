/**
 * Phase 10 - Agent Context API Router
 * 
 * Exposes the /api/agent/context endpoint for the AI setup/support agent.
 * This endpoint returns a rich structured snapshot of the current tenant's
 * configuration, feature flags, and identified gaps.
 */

import { Router } from 'express';
import { requireAuth } from '../authMiddleware';
import { buildAgentContext } from '../services/agentContextService';

const router = Router();

/**
 * GET /api/agent/context
 * 
 * Returns a structured AgentContext object for the current tenant.
 * This is used by the AI setup/support agent to understand the tenant's
 * current configuration state and provide contextual assistance.
 * 
 * Requires authentication and tenant resolution via middleware.
 */
router.get('/context', requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const tenantDb = req.tenantDb;
    
    if (!tenantId || !tenantDb) {
      return res.status(400).json({
        ok: false,
        error: 'Tenant context not available',
        message: 'Please ensure you are logged in and have a valid tenant session.',
      });
    }
    
    const context = await buildAgentContext({
      tenantId,
      tenantDb,
    });
    
    return res.json({
      ok: true,
      context,
    });
  } catch (error) {
    console.error('[AGENT CONTEXT] Error building agent context:', error);
    next(error);
  }
});

export default router;
