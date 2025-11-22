import { Request, Response, NextFunction } from 'express';
import { users, technicians } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function requireTechnician(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const [user] = await req.tenantDb!
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account not found or disabled',
      });
    }

    // Allow manager/owner roles to access technician features with admin override
    if (user.role === 'manager' || user.role === 'owner') {
      console.log(`[AUTH] Admin override: ${user.role} ${user.username} accessing technician features`);
      (req as any).user = user;
      (req as any).technician = {
        id: -1,
        userId: user.id,
        employmentStatus: 'admin_override',
        allowAllJobs: true,
      };
      return next();
    }

    const [technician] = await req.tenantDb!
      .select()
      .from(technicians)
      .where(eq(technicians.userId, user.id))
      .limit(1);

    if (!technician || technician.employmentStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Technician access required',
      });
    }

    (req as any).user = user;
    (req as any).technician = technician;

    next();
  } catch (error) {
    console.error('[AUTH] Technician middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed',
    });
  }
}
