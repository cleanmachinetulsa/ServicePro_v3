import { Request, Response, NextFunction } from 'express';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Role hierarchy: owner > manager > employee
const roleHierarchy: Record<string, number> = {
  employee: 1,
  manager: 2,
  owner: 3
};

/**
 * Middleware to require specific roles or higher
 * Usage: requireRole('manager') allows manager and owner, but not employee
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get user from database
      const [user] = await req.tenantDb!
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'User account is disabled',
        });
      }

      // Check if user role is allowed
      const userRoleLevel = roleHierarchy[user.role] || 0;
      const requiredLevel = Math.min(...allowedRoles.map(role => roleHierarchy[role] || 999));

      if (userRoleLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: allowedRoles,
          current: user.role
        });
      }

      // Attach user to request for downstream use
      (req as any).user = user;

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
}

/**
 * Middleware to check if user needs to change password
 */
export async function checkPasswordChangeRequired(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session || !req.session.userId) {
      return next();
    }

    const [user] = await req.tenantDb!
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (user && user.requirePasswordChange) {
      // Allow access to password change endpoint, logout, and current user info
      const allowedPaths = [
        '/api/auth/change-password',
        '/api/auth/logout',
        '/api/users/me' // Fixed: was '/api/user/me' (singular)
      ];
      
      if (allowedPaths.includes(req.path)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Password change required',
        requirePasswordChange: true,
      });
    }

    next();
  } catch (error) {
    console.error('Password change check error:', error);
    next();
  }
}
