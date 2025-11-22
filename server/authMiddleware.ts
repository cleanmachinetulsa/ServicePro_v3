
import { Request, Response, NextFunction } from 'express';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Middleware to check if user is authenticated
 * Uses express-session with HttpOnly cookies
 * SECURITY: Requires both userId AND twoFactorVerified for 2FA-enabled users
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if session exists and has userId
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get user from database
    const userResult = await req.tenantDb!
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (!userResult || userResult.length === 0) {
      // User no longer exists, destroy session
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: 'Invalid session',
      });
    }

    const user = userResult[0];

    // CRITICAL SECURITY CHECK: For 2FA-enabled users, verify they completed 2FA
    // This prevents privilege escalation if user enables 2FA after session creation
    // or if attacker intercepts session between password and 2FA steps
    const { isTOTPEnabled } = await import('./securityService');
    const has2FA = await isTOTPEnabled(req.tenantDb!, user.id);
    
    if (has2FA && !req.session.twoFactorVerified) {
      console.warn(`[AUTH] User ${user.username} has 2FA enabled but session lacks verification. Rejecting request.`);
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: '2FA verification required. Please log in again.',
        requires2FA: true,
      });
    }

    // Attach user to request for use in routes
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
}
