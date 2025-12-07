/**
 * CM-DEMO-1: Demo Mode Middleware
 * 
 * Middleware to detect and handle demo mode requests.
 * Adds req.isDemoMode flag and demo session info to requests.
 */

import { Request, Response, NextFunction } from 'express';
import { isDemoTenant, DEMO_TENANT_ID } from '@shared/demoConfig';
import { getDemoSession } from '../services/demoService';

declare global {
  namespace Express {
    interface Request {
      isDemoMode?: boolean;
      demoSessionToken?: string;
      demoSessionInfo?: {
        id: string;
        verifiedPhone: string | null;
        expiresAt: Date;
      };
    }
  }
}

export async function demoModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const demoToken = req.headers['x-demo-session'] as string;
  
  if (!demoToken) {
    req.isDemoMode = false;
    return next();
  }

  try {
    const session = await getDemoSession(demoToken);
    
    if (session && session.expiresAt > new Date()) {
      req.isDemoMode = true;
      req.demoSessionToken = demoToken;
      req.demoSessionInfo = {
        id: session.id,
        verifiedPhone: session.verifiedDemoPhone,
        expiresAt: session.expiresAt,
      };
    } else {
      req.isDemoMode = false;
    }
  } catch (error) {
    console.error('[DEMO MIDDLEWARE] Error checking demo session:', error);
    req.isDemoMode = false;
  }

  next();
}

export function requireDemoVerified(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.isDemoMode) {
    return res.status(401).json({
      error: 'Demo session required',
      code: 'DEMO_SESSION_REQUIRED',
    });
  }

  if (!req.demoSessionInfo?.verifiedPhone) {
    return res.status(403).json({
      error: 'Phone verification required for this action',
      code: 'DEMO_PHONE_NOT_VERIFIED',
    });
  }

  next();
}

export function blockInDemoMode(actionName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.isDemoMode) {
      console.log(`[DEMO] Blocked action "${actionName}" in demo mode`);
      return res.status(403).json({
        error: `Action "${actionName}" is not available in demo mode`,
        code: 'DEMO_ACTION_BLOCKED',
        simulated: true,
      });
    }
    next();
  };
}

export function simulateInDemoMode<T>(
  createSimulatedResponse: () => T
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.isDemoMode) {
      const simulated = createSimulatedResponse();
      return res.json({
        success: true,
        data: simulated,
        simulated: true,
        message: 'This response is simulated in demo mode',
      });
    }
    next();
  };
}
