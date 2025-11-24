/**
 * Phase 15 - Customer Portal Authentication Middleware
 * 
 * Middleware to protect customer portal routes by validating session tokens.
 * Separate from owner/staff authentication to maintain isolation.
 */

import { Request, Response, NextFunction } from 'express';
import { validateSession } from './services/customerOtpService';
import { customers, customerIdentities, type Customer, type CustomerIdentity } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { TenantDb } from './tenantDb';

// Extend Express Request type to include customer session data
declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
      customerIdentity?: CustomerIdentity;
      customerId?: number;
    }
  }
}

// Cookie name for customer session
export const CUSTOMER_SESSION_COOKIE = 'sp_customer_session';

/**
 * Middleware to authenticate customer portal requests
 * 
 * Reads session token from cookie or Authorization header,
 * validates it, and attaches customer data to request.
 * 
 * Returns 401 if session is invalid or expired.
 */
export async function customerPortalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenantDb = req.tenantDb as TenantDb;
  
  if (!tenantDb) {
    return res.status(500).json({ 
      error: 'Tenant context not found. Use tenantMiddleware before customerPortalAuthMiddleware.' 
    });
  }

  // Extract session token from cookie or Authorization header
  let sessionToken: string | undefined;

  // First, check cookie
  sessionToken = req.cookies?.[CUSTOMER_SESSION_COOKIE];

  // If not in cookie, check Authorization header
  if (!sessionToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }
  }

  if (!sessionToken) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'No session token provided' 
    });
  }

  // Validate session token
  const sessionValidation = await validateSession(tenantDb, sessionToken);

  if (!sessionValidation.valid || !sessionValidation.customerId) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or expired session' 
    });
  }

  // Load customer data
  const customerResults = await tenantDb
    .select()
    .from(customers)
    .where(eq(customers.id, sessionValidation.customerId))
    .limit(1);

  const customer = customerResults[0];

  if (!customer) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Customer not found' 
    });
  }

  // Load customer identity
  const identityResults = await tenantDb
    .select()
    .from(customerIdentities)
    .where(
      and(
        eq(customerIdentities.tenantId, sessionValidation.tenantId || ''),
        eq(customerIdentities.customerId, customer.id)
      )
    )
    .limit(1);

  const identity = identityResults[0];

  // Attach to request object for use in route handlers
  req.customer = customer;
  req.customerIdentity = identity;
  req.customerId = customer.id;

  console.log(`[CustomerAuth] Authenticated customer ${customer.id} (${customer.name})`);

  next();
}

/**
 * Optional middleware to check customer portal auth without enforcing it
 * Useful for routes that work with or without authentication
 */
export async function optionalCustomerPortalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await customerPortalAuthMiddleware(req, res, next);
  } catch (error) {
    // If auth fails, continue without setting customer data
    next();
  }
}
