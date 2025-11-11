import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

const router = Router();

/**
 * Change password (for logged-in users)
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId!))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // If user is not required to change password, verify current password
    if (!user.requirePasswordChange) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required',
        });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedPassword,
        requirePasswordChange: false,
        lastPasswordChange: new Date(),
      })
      .where(eq(users.id, req.session.userId!));

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
});

export default router;
