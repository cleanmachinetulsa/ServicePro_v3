/**
 * Smart Availability Deep Links L2: Booking Analytics API Routes
 * Handles POST requests to log booking initiations from the frontend
 */

import { Router, Request, Response } from 'express';
import { logBookingInitiation, getBookingAnalyticsSummary } from './services/bookingAnalyticsService';
import { z } from 'zod';

const router = Router();
const LOG_PREFIX = '[BOOKING ANALYTICS API]';

const initiationSchema = z.object({
  tenantId: z.string().min(1),
  source: z.enum(['chat', 'site', 'other']),
  context: z.record(z.any()).optional(),
});

async function resolveTenantId(requestTenantId: string, context: Record<string, any> | undefined, sessionTenantId?: string): Promise<string> {
  // If explicit tenant from session, use it
  if (sessionTenantId && sessionTenantId !== 'detect') {
    return sessionTenantId;
  }
  
  // If valid explicit tenant from request
  if (requestTenantId && requestTenantId !== 'detect') {
    return requestTenantId;
  }
  
  // Try to derive from hostname in context
  if (context?.hostname) {
    const hostname = context.hostname as string;
    
    // Check for custom domain mapping
    if (hostname.includes('cleanmachinetulsa.com')) {
      return 'root';
    }
    
    // Try to extract subdomain
    const subdomainMatch = hostname.match(/^([^.]+)\./);
    if (subdomainMatch && subdomainMatch[1] !== 'www') {
      return subdomainMatch[1];
    }
  }
  
  // Default to root
  return 'root';
}

router.post('/initiation', async (req: Request, res: Response) => {
  try {
    const parsed = initiationSchema.safeParse(req.body);
    
    if (!parsed.success) {
      console.warn(`${LOG_PREFIX} Invalid request body:`, parsed.error);
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }
    
    const { tenantId: requestTenantId, source, context } = parsed.data;
    
    // Resolve actual tenant ID from session, request, or context
    const tenantId = await resolveTenantId(requestTenantId, context, req.session?.tenantId);
    
    console.log(`${LOG_PREFIX} POST /initiation - tenant="${tenantId}" (resolved from "${requestTenantId}"), source="${source}"`);
    
    const result = await logBookingInitiation({
      tenantId,
      source,
      context: context || {},
    });
    
    if (result.success) {
      res.json({ success: true, id: result.id });
    } else {
      res.status(500).json({ error: 'Failed to log initiation' });
    }
    
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error in POST /initiation:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

router.get('/summary/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const role = req.session.role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Owner or admin access required' });
    }
    
    console.log(`${LOG_PREFIX} GET /summary/${tenantId}`);
    
    const summary = await getBookingAnalyticsSummary(
      tenantId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({ success: true, summary });
    
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error in GET /summary:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export default router;
