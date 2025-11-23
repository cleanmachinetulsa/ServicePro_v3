import { Router } from 'express';
import bcrypt from 'bcrypt';
import { users } from '@shared/schema';
import { eq, and, ne } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';

const router = Router();

/**
 * Get current user info
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await req.tenantDb!
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        operatorName: users.operatorName,
        requirePasswordChange: users.requirePasswordChange,
        isActive: users.isActive,
        hasSeenDashboardTour: users.hasSeenDashboardTour,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId!)))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information',
    });
  }
});

/**
 * Get all users (manager and owner only)
 */
router.get('/all', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const allUsers = await req.tenantDb!
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        isActive: users.isActive,
        createdAt: users.createdAt,
        createdBy: users.createdBy,
      })
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users));

    res.json({
      success: true,
      users: allUsers,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
    });
  }
});

/**
 * Create new user (manager and owner only)
 */
router.post('/create', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const { username, email, role, fullName } = req.body;

    if (!username || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username and role are required',
      });
    }

    // Check if user can create this role
    const [currentUser] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId!)))
      .limit(1);

    // Managers can only create employees
    if (currentUser.role === 'manager' && role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Managers can only create employee accounts',
      });
    }

    // Owners can create anyone except other owners
    if (currentUser.role === 'owner' && role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot create additional owner accounts',
      });
    }

    // Check if username already exists
    const [existing] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.username, username)))
      .limit(1);

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists',
      });
    }

    // Generate temporary password (8 random characters)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const [newUser] = await req.tenantDb!
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        email: email || null,
        role,
        fullName: fullName || null,
        requirePasswordChange: true,
        isActive: true,
        createdBy: req.session.userId,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
      });

    res.json({
      success: true,
      message: 'User created successfully',
      user: newUser,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
    });
  }
});

/**
 * Update user (manager and owner only)
 */
router.put('/:id', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { email, fullName, isActive, role } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Get current user and target user
    const [currentUser] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId!)))
      .limit(1);

    const [targetUser] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, userId)))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent modifying owner accounts unless you're an owner
    if (targetUser.role === 'owner' && currentUser.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify owner accounts',
      });
    }

    // Managers can only modify employees
    if (currentUser.role === 'manager' && targetUser.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Managers can only modify employee accounts',
      });
    }

    // Don't allow changing to owner role
    if (role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot assign owner role',
      });
    }

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role !== undefined && currentUser.role === 'owner') updateData.role = role;

    const [updatedUser] = await req.tenantDb!
      .update(users)
      .set(updateData)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, userId)))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        isActive: users.isActive,
      });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
    });
  }
});

/**
 * Reset user password (manager and owner only)
 */
router.post('/:id/reset-password', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const [targetUser] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, userId)))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate new temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await req.tenantDb!
      .update(users)
      .set({
        password: hashedPassword,
        requirePasswordChange: true,
        lastPasswordChange: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, userId)));

    res.json({
      success: true,
      message: 'Password reset successfully',
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
});

/**
 * Update current user's operator name
 */
router.put('/me/operator-name', requireAuth, async (req, res) => {
  try {
    const { operatorName } = req.body;

    if (typeof operatorName !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Operator name must be a string',
      });
    }

    const [updatedUser] = await req.tenantDb!
      .update(users)
      .set({ operatorName: operatorName.trim() || null })
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId!)))
      .returning({
        id: users.id,
        username: users.username,
        operatorName: users.operatorName,
      });

    res.json({
      success: true,
      message: 'Operator name updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update operator name error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update operator name',
    });
  }
});

/**
 * Delete user (owner only)
 */
router.delete('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Prevent deleting yourself
    if (userId === req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    // Prevent deleting owner accounts
    const [targetUser] = await req.tenantDb!
      .select()
      .from(users)
      .where(req.tenantDb!.withTenantFilter(users, eq(users.id, userId)))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (targetUser.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete owner accounts',
      });
    }

    await req.tenantDb!.delete(users).where(req.tenantDb!.withTenantFilter(users, eq(users.id, userId)));

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
    });
  }
});

export default router;
