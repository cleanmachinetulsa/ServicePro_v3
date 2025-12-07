
import { Express, Request, Response } from 'express';
import { users, passwordResetTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from './db';
import { sendPasswordResetEmail } from './emailService';
import {
  setupTOTP,
  enableTOTP,
  verifyTOTP,
  disableTOTP,
  isTOTPEnabled,
  logLoginAttempt,
  checkLoginAttempts,
  logAuditEvent,
  getAuditLogs,
  getSecurityStats,
} from './securityService';
import { requireAuth } from './authMiddleware';
import { getImpersonationContext } from './authHelpers';
import { tenants } from '@shared/schema';

const SALT_ROUNDS = 10;

export function registerAuthRoutes(app: Express) {
  // Login endpoint with bcrypt password verification, 2FA, and login tracking
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || '';
    
    try {
      const { username, password, totpToken } = req.body;

      if (!username || !password) {
        await logLoginAttempt(username || 'unknown', ipAddress, false, 'missing_credentials', userAgent);
        return res.status(400).json({
          success: false,
          message: 'Username and password required',
        });
      }

      // Check for account lockout
      const lockoutStatus = await checkLoginAttempts(username, ipAddress);
      if (lockoutStatus.locked) {
        await logLoginAttempt(username, ipAddress, false, 'account_locked', userAgent);
        return res.status(403).json({
          success: false,
          message: `Account locked due to too many failed attempts. Please try again after ${lockoutStatus.unlockAt?.toLocaleTimeString()}`,
          locked: true,
          unlockAt: lockoutStatus.unlockAt,
        });
      }

      // Find user using global db (no tenant context needed for login)
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!userResult || userResult.length === 0) {
        await logLoginAttempt(username, ipAddress, false, 'invalid_username', userAgent);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const user = userResult[0];

      // Verify password with bcrypt
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        await logLoginAttempt(username, ipAddress, false, 'invalid_password', userAgent);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          remainingAttempts: lockoutStatus.remainingAttempts,
        });
      }

      // Check if 2FA is enabled
      const has2FA = await isTOTPEnabled(user.id);
      
      if (has2FA) {
        // Password verified! Store pending 2FA state in session
        // Store user context for 2FA verification step
        req.session.pending2FA = {
          userId: user.id,
          username: user.username,
          ipAddress,
          userAgent,
          createdAt: new Date().toISOString(),
          attemptCount: 0,
        };
        
        await logLoginAttempt(username, ipAddress, true, 'password_verified_awaiting_2fa', userAgent);
        
        return req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({
              success: false,
              message: 'Login failed',
            });
          }

          res.json({
            success: false,
            requires2FA: true,
            message: '2FA verification required',
          });
        });
      }

      // No 2FA required - complete login
      await logLoginAttempt(username, ipAddress, true, undefined, userAgent);

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({
            success: false,
            message: 'Login failed',
          });
        }

        // Store user ID, tenant ID, and role in session (required for tenant middleware)
        req.session.userId = user.id;
        req.session.tenantId = user.tenantId;
        req.session.role = user.role;
        req.session.twoFactorVerified = false; // No 2FA configured

        // Save session before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({
              success: false,
              message: 'Login failed',
            });
          }

          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              has2FA: false,
            },
          });
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      await logLoginAttempt(req.body.username || 'unknown', ipAddress, false, 'system_error', userAgent);
      res.status(500).json({
        success: false,
        message: 'Login failed',
      });
    }
  });

  // Verify 2FA code after password authentication
  app.post('/api/auth/login/verify-2fa', async (req: Request, res: Response) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || '';

    try {
      const { code } = req.body;

      // Check if there's a pending 2FA session
      if (!req.session.pending2FA) {
        return res.status(400).json({
          success: false,
          message: 'No pending 2FA session. Please log in again.',
        });
      }

      const pending = req.session.pending2FA;
      const MAX_ATTEMPTS = 5;
      const SESSION_TTL_MINUTES = 5;

      // Check if session expired (5 minutes)
      const createdAt = new Date(pending.createdAt);
      const ageMinutes = (Date.now() - createdAt.getTime()) / 1000 / 60;
      
      if (ageMinutes > SESSION_TTL_MINUTES) {
        delete req.session.pending2FA;
        await req.session.save();
        
        return res.status(400).json({
          success: false,
          message: 'Session expired. Please log in again.',
          expired: true,
        });
      }

      // Check if attempts exceeded
      if (pending.attemptCount >= MAX_ATTEMPTS) {
        delete req.session.pending2FA;
        await req.session.save();
        
        await logLoginAttempt(pending.username, ipAddress, false, '2fa_attempts_exceeded', userAgent);
        
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please log in again.',
          locked: true,
        });
      }

      // Validate IP and user agent to prevent session hijacking
      if (pending.ipAddress !== ipAddress) {
        console.warn(`[2FA] IP address mismatch: expected ${pending.ipAddress}, got ${ipAddress}`);
        delete req.session.pending2FA;
        await req.session.save();
        
        return res.status(403).json({
          success: false,
          message: 'Security check failed. Please log in again.',
        });
      }

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Verification code required',
        });
      }

      // Verify TOTP or backup code
      const isValid = await verifyTOTP(pending.userId, code);

      if (!isValid) {
        // Increment attempt count
        req.session.pending2FA.attemptCount++;
        await req.session.save();
        
        await logLoginAttempt(pending.username, ipAddress, false, 'invalid_2fa_code', userAgent);
        
        const remainingAttempts = MAX_ATTEMPTS - req.session.pending2FA.attemptCount;
        
        return res.status(401).json({
          success: false,
          message: 'Invalid verification code',
          remainingAttempts,
        });
      }

      // Success! Complete the login
      const userId = pending.userId;
      const username = pending.username;

      // Fetch user to get tenantId and role for session (using global db)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(500).json({
          success: false,
          message: 'User not found after 2FA verification',
        });
      }

      // Clear pending 2FA state
      delete req.session.pending2FA;

      // Log successful 2FA verification
      await logLoginAttempt(username, ipAddress, true, '2fa_verified', userAgent);

      // Regenerate session to prevent fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({
            success: false,
            message: 'Login failed',
          });
        }

        // Set full session with tenant ID and role (required for tenant middleware)
        req.session.userId = userId;
        req.session.tenantId = user.tenantId;
        req.session.role = user.role;
        req.session.twoFactorVerified = true;

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({
              success: false,
              message: 'Login failed',
            });
          }

          res.json({
            success: true,
            user: {
              id: userId,
              username,
              has2FA: true,
            },
          });
        });
      });
    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Verification failed',
      });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to logout',
        });
      }
      res.clearCookie('sessionId');
      res.json({ success: true });
    });
  });

  // Verify session endpoint
  app.get('/api/auth/verify', (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'No session' 
      });
    }

    res.json({ 
      success: true,
      userId: req.session.userId 
    });
  });

  // Register new user endpoint
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { username, password, email } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password required',
        });
      }

      // Check if user already exists
      const existingUser = await req.tenantDb!
        .select()
        .from(users)
        .where(req.tenantDb!.withTenantFilter(users, eq(users.username, username)))
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const newUser = await req.tenantDb!
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email: email || null,
        })
        .returning();

      res.json({
        success: true,
        user: {
          id: newUser[0].id,
          username: newUser[0].username,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
      });
    }
  });

  // Request password reset
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email required',
        });
      }

      // Find user by email using global db (no tenant context needed)
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // Always return success even if email not found (security best practice)
      if (!userResult || userResult.length === 0) {
        return res.json({
          success: true,
          message: 'If email exists, a reset link has been sent',
        });
      }

      const user = userResult[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database using global db
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // Send password reset email
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      console.log('Sending password reset email to:', email);
      console.log('Reset link:', resetLink);

      const emailResult = await sendPasswordResetEmail(email, resetLink);

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Still return success to user (security best practice - don't leak info)
      }

      res.json({
        success: true,
        message: 'If email exists, a reset link has been sent',
        // For development only - include link in response
        resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process request',
      });
    }
  });

  // Change password for authenticated users
  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password required',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters',
        });
      }

      // Get user from database
      const userResult = await req.tenantDb!
        .select()
        .from(users)
        .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId)))
        .limit(1);

      if (!userResult || userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const user = userResult[0];

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update user password
      await req.tenantDb!
        .update(users)
        .set({ password: hashedPassword })
        .where(req.tenantDb!.withTenantFilter(users, eq(users.id, user.id)));

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

  // Reset password with token
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password required',
        });
      }

      // Find valid token using global db (no tenant context needed)
      const tokenResult = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1);

      if (!tokenResult || tokenResult.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
        });
      }

      const resetToken = tokenResult[0];

      // Check if token is expired or already used
      if (resetToken.used || new Date(resetToken.expiresAt) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update user password using global db
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used using global db
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
      });
    }
  });

  // ==================== 2FA / TOTP ROUTES ====================

  // Setup 2FA - Generate QR code and backup codes
  app.post('/api/auth/2fa/setup', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get user email
      const userResult = await req.tenantDb!
        .select()
        .from(users)
        .where(req.tenantDb!.withTenantFilter(users, eq(users.id, req.session.userId)))
        .limit(1);

      if (!userResult || userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const user = userResult[0];
      const email = user.email || user.username;

      // Generate 2FA setup
      const setup = await setupTOTP(user.id, email);

      res.json({
        success: true,
        qrCodeUrl: setup.qrCodeDataUrl,
        secret: setup.secret,
        backupCodes: setup.backupCodes,
      });
    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to setup 2FA',
      });
    }
  });

  // Enable 2FA - Verify initial token
  app.post('/api/auth/2fa/enable', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification code required',
        });
      }

      const enabled = await enableTOTP(req.session.userId, token);

      if (!enabled) {
        return res.status(401).json({
          success: false,
          message: 'Invalid verification code',
        });
      }

      // Log audit event
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || '';
      await logAuditEvent(
        req.session.userId,
        '2fa_enabled',
        'user',
        req.session.userId.toString(),
        null,
        ipAddress,
        userAgent
      );

      // CRITICAL SECURITY: Invalidate current session and force re-authentication
      // This ensures the user must complete 2FA verification immediately
      // and prevents old sessions from bypassing the new 2FA requirement
      const currentSessionId = req.session.id;
      console.log(`[2FA ENABLE] Invalidating current session for user ${req.session.userId}`);
      
      req.session.destroy((err) => {
        if (err) {
          console.error('[2FA ENABLE] Session destruction error:', err);
        }
        
        // Note: We cannot programmatically invalidate OTHER sessions without 
        // access to the session store. The updated authMiddleware will catch
        // any existing sessions and force re-auth when they make their next request.
        
        res.json({
          success: true,
          message: '2FA enabled successfully. Please log in again.',
          requiresReauth: true,
        });
      });
    } catch (error) {
      console.error('2FA enable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enable 2FA',
      });
    }
  });

  // Disable 2FA - Requires current 2FA token
  app.post('/api/auth/2fa/disable', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification code required',
        });
      }

      const disabled = await disableTOTP(req.session.userId, token);

      if (!disabled) {
        return res.status(401).json({
          success: false,
          message: 'Invalid verification code',
        });
      }

      // Log audit event
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || '';
      await logAuditEvent(
        req.session.userId,
        '2fa_disabled',
        'user',
        req.session.userId.toString(),
        null,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        message: '2FA disabled successfully',
      });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA',
      });
    }
  });

  // Check 2FA status
  app.get('/api/auth/2fa/status', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const enabled = await isTOTPEnabled(req.session.userId);

      res.json({
        success: true,
        enabled,
      });
    } catch (error) {
      console.error('2FA status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check 2FA status',
      });
    }
  });

  // ==================== SECURITY / AUDIT ROUTES ====================

  // Get security stats (admin only)
  app.get('/api/auth/security/stats', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if user is admin/owner
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!userResult || userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const user = userResult[0];
      if (user.role !== 'owner' && user.role !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      const stats = await getSecurityStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Security stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get security stats',
      });
    }
  });

  // Get audit logs (admin only)
  app.get('/api/auth/audit-logs', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if user is admin/owner
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!userResult || userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const user = userResult[0];
      if (user.role !== 'owner' && user.role !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      const { userId, resource, action, limit } = req.query;

      const logs = await getAuditLogs({
        userId: userId ? Number(userId) : undefined,
        resource: resource as string | undefined,
        action: action as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({
        success: true,
        logs,
      });
    } catch (error) {
      console.error('Audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit logs',
      });
    }
  });

  app.get('/api/auth/context', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const impersonationContext = getImpersonationContext(req);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          preferredLanguage: user.preferredLanguage || 'en',
        },
        impersonation: {
          isActive: impersonationContext.isImpersonating,
          tenantId: impersonationContext.tenantId,
          tenantName: impersonationContext.tenantName,
          startedAt: impersonationContext.startedAt,
        },
      });
    } catch (error) {
      await logAuditEvent({
        userId: req.session?.userId || 0,
        action: 'auth_context_failed',
        resource: 'auth_context',
        details: `Failed to retrieve auth context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get auth context',
      });
    }
  });

  // SP-8: Update user language preference
  app.put('/api/user/language', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      const { language } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      if (!language || !['en', 'es'].includes(language)) {
        return res.status(400).json({ success: false, message: 'Invalid language. Supported: en, es' });
      }

      await db.update(users).set({ preferredLanguage: language }).where(eq(users.id, userId));

      res.json({ success: true, language });
    } catch (error) {
      console.error('Update language preference error:', error);
      res.status(500).json({ success: false, message: 'Failed to update language preference' });
    }
  });
}
