import { db } from './db';
import { totpSecrets, loginAttempts, accountLockouts, auditLogs, users } from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const LOCKOUT_THRESHOLD = 5; // Lock account after 5 failed attempts
const LOCKOUT_DURATION_MINUTES = 15; // Lock account for 15 minutes
const ATTEMPT_WINDOW_MINUTES = 15; // Count attempts within 15 minute window

// ======================================================================
// TOTP (Time-based One-Time Password) Functions
// ======================================================================

/**
 * Setup TOTP for a user - generates secret and QR code
 * @param userId - User ID
 * @param email - User email for TOTP label
 * @param appName - App name for TOTP label (default: "Clean Machine")
 * @returns Object with secret, QR code URL, and backup codes
 */
export async function setupTOTP(
  userId: number,
  email: string,
  appName: string = "Clean Machine"
) {
  try {
    // Generate a new secret
    const secret = authenticator.generateSecret();

    // Generate backup codes (10 codes, 8 characters each)
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Check if user already has TOTP setup
    const existing = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing secret (user is re-enrolling)
      await db
        .update(totpSecrets)
        .set({
          secret,
          backupCodes: hashedBackupCodes,
          enabled: false, // Reset to disabled until they verify
          enabledAt: null,
        })
        .where(eq(totpSecrets.userId, userId));
    } else {
      // Insert new TOTP secret
      await db.insert(totpSecrets).values({
        userId,
        secret,
        backupCodes: hashedBackupCodes,
        enabled: false,
      });
    }

    // Generate OTP auth URL for QR code
    const otpauth = authenticator.keyuri(email, appName, secret);

    // Generate QR code data URL
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    return {
      success: true,
      secret,
      qrCodeUrl,
      backupCodes, // Return unhashed codes to display to user (ONLY TIME)
    };
  } catch (error) {
    console.error('Setup TOTP error:', error);
    return {
      success: false,
      error: 'Failed to setup 2FA',
    };
  }
}

/**
 * Enable TOTP for a user after verifying token
 * @param userId - User ID
 * @param token - TOTP token to verify
 * @returns Success status
 */
export async function enableTOTP(userId: number, token: string) {
  try {
    // Get user's TOTP secret
    const totpRecord = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, userId))
      .limit(1);

    if (!totpRecord || totpRecord.length === 0) {
      return {
        success: false,
        error: '2FA not set up',
      };
    }

    const totp = totpRecord[0];

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: totp.secret,
    });

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid verification code',
      };
    }

    // Enable TOTP
    await db
      .update(totpSecrets)
      .set({
        enabled: true,
        enabledAt: new Date(),
      })
      .where(eq(totpSecrets.userId, userId));

    return {
      success: true,
    };
  } catch (error) {
    console.error('Enable TOTP error:', error);
    return {
      success: false,
      error: 'Failed to enable 2FA',
    };
  }
}

/**
 * Verify TOTP token or backup code
 * @param userId - User ID
 * @param token - TOTP token or backup code
 * @returns True if valid, false otherwise
 */
export async function verifyTOTP(userId: number, token: string): Promise<boolean> {
  try {
    // Get user's TOTP secret
    const totpRecord = await db
      .select()
      .from(totpSecrets)
      .where(and(
        eq(totpSecrets.userId, userId),
        eq(totpSecrets.enabled, true)
      ))
      .limit(1);

    if (!totpRecord || totpRecord.length === 0) {
      return false;
    }

    const totp = totpRecord[0];

    // First try to verify as TOTP token
    const isValidToken = authenticator.verify({
      token,
      secret: totp.secret,
    });

    if (isValidToken) {
      // Update last used timestamp
      await db
        .update(totpSecrets)
        .set({ lastUsedAt: new Date() })
        .where(eq(totpSecrets.userId, userId));

      return true;
    }

    // If not a valid TOTP token, try backup codes
    if (totp.backupCodes && totp.backupCodes.length > 0) {
      for (let i = 0; i < totp.backupCodes.length; i++) {
        const hashedCode = totp.backupCodes[i];
        const isValidBackup = await bcrypt.compare(token.toUpperCase(), hashedCode);

        if (isValidBackup) {
          // Remove used backup code
          const newBackupCodes = totp.backupCodes.filter((_, idx) => idx !== i);

          await db
            .update(totpSecrets)
            .set({
              backupCodes: newBackupCodes,
              lastUsedAt: new Date(),
            })
            .where(eq(totpSecrets.userId, userId));

          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Verify TOTP error:', error);
    return false;
  }
}

/**
 * Disable TOTP for a user
 * @param userId - User ID
 * @param token - TOTP token to verify before disabling
 * @returns Success status
 */
export async function disableTOTP(userId: number, token: string) {
  try {
    // Verify token before disabling
    const isValid = await verifyTOTP(userId, token);

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid verification code',
      };
    }

    // Delete TOTP secret
    await db
      .delete(totpSecrets)
      .where(eq(totpSecrets.userId, userId));

    return {
      success: true,
    };
  } catch (error) {
    console.error('Disable TOTP error:', error);
    return {
      success: false,
      error: 'Failed to disable 2FA',
    };
  }
}

/**
 * Check if TOTP is enabled for a user
 * @param userId - User ID
 * @returns True if enabled, false otherwise
 */
export async function isTOTPEnabled(userId: number): Promise<boolean> {
  try {
    const totpRecord = await db
      .select()
      .from(totpSecrets)
      .where(and(
        eq(totpSecrets.userId, userId),
        eq(totpSecrets.enabled, true)
      ))
      .limit(1);

    return totpRecord.length > 0;
  } catch (error) {
    console.error('Check TOTP enabled error:', error);
    return false;
  }
}

// ======================================================================
// Login Attempt Tracking & Account Lockout
// ======================================================================

/**
 * Log a login attempt
 * @param username - Username attempting to login
 * @param ipAddress - IP address of the attempt
 * @param success - Whether the attempt was successful
 * @param reason - Reason for failure (optional)
 * @param userAgent - User agent string (optional)
 */
export async function logLoginAttempt(
  username: string,
  ipAddress: string,
  success: boolean,
  reason?: string,
  userAgent?: string
) {
  try {
    await db.insert(loginAttempts).values({
      username,
      ipAddress,
      successful: success,
      failureReason: reason || null,
      userAgent: userAgent || null,
    });
  } catch (error) {
    console.error('Log login attempt error:', error);
  }
}

/**
 * Check login attempts and determine if account should be locked
 * @param username - Username to check
 * @param ipAddress - IP address to check
 * @returns Lockout status with remaining attempts
 */
export async function checkLoginAttempts(username: string, ipAddress: string) {
  try {
    // Check if there's an active lockout for this user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (userResult.length > 0) {
      const user = userResult[0];

      const activeLockout = await db
        .select()
        .from(accountLockouts)
        .where(and(
          eq(accountLockouts.userId, user.id),
          eq(accountLockouts.unlocked, false),
          gte(accountLockouts.unlockAt, new Date())
        ))
        .limit(1);

      if (activeLockout.length > 0) {
        return {
          locked: true,
          unlockAt: activeLockout[0].unlockAt,
          remainingAttempts: 0,
        };
      }
    }

    // Count recent failed attempts (within window)
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    const recentFailures = await db
      .select()
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.username, username),
        eq(loginAttempts.successful, false),
        gte(loginAttempts.attemptedAt, windowStart)
      ));

    const failureCount = recentFailures.length;
    const remainingAttempts = Math.max(0, LOCKOUT_THRESHOLD - failureCount);

    // If threshold exceeded, create lockout
    if (failureCount >= LOCKOUT_THRESHOLD && userResult.length > 0) {
      const user = userResult[0];
      const unlockAt = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

      await db.insert(accountLockouts).values({
        userId: user.id,
        unlockAt,
        reason: 'failed_login_attempts',
      });

      return {
        locked: true,
        unlockAt,
        remainingAttempts: 0,
      };
    }

    return {
      locked: false,
      remainingAttempts,
    };
  } catch (error) {
    console.error('Check login attempts error:', error);
    return {
      locked: false,
      remainingAttempts: LOCKOUT_THRESHOLD,
    };
  }
}

/**
 * Unlock a locked account
 * @param userId - User ID to unlock
 * @param unlockedBy - Admin user ID who unlocked the account
 */
export async function unlockAccount(userId: number, unlockedBy: number) {
  try {
    await db
      .update(accountLockouts)
      .set({
        unlocked: true,
        unlockedAt: new Date(),
      })
      .where(and(
        eq(accountLockouts.userId, userId),
        eq(accountLockouts.unlocked, false)
      ));

    // Log audit event
    await logAuditEvent(
      'root', // tenantId - using root for now
      unlockedBy,
      'account_unlocked',
      { unlockedUserId: userId },
      'system'
    );

    return { success: true };
  } catch (error) {
    console.error('Unlock account error:', error);
    return { success: false, error: 'Failed to unlock account' };
  }
}

// ======================================================================
// Audit Logging
// ======================================================================

/**
 * Log an audit event
 * @param tenantId - Tenant ID
 * @param userId - User ID performing the action
 * @param action - Action performed
 * @param details - Additional details about the action
 * @param ipAddress - IP address of the action
 */
export async function logAuditEvent(
  tenantId: string,
  userId: number,
  action: string,
  details: Record<string, any>,
  ipAddress: string
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource: details.resource || 'unknown',
      resourceId: details.resourceId?.toString() || null,
      changes: details,
      ipAddress,
      metadata: details.metadata || null,
    });
  } catch (error) {
    console.error('Log audit event error:', error);
  }
}

/**
 * Get audit logs with optional filters
 * @param filters - Optional filters for the query
 * @returns Array of audit logs
 */
export async function getAuditLogs(filters?: {
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  try {
    let query = db.select().from(auditLogs);

    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters?.resource) {
      conditions.push(eq(auditLogs.resource, filters.resource));
    }

    if (filters?.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(auditLogs.createdAt)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    const logs = await query;

    return {
      success: true,
      logs,
    };
  } catch (error) {
    console.error('Get audit logs error:', error);
    return {
      success: false,
      error: 'Failed to retrieve audit logs',
      logs: [],
    };
  }
}

/**
 * Get security statistics
 * @returns Security stats including failed logins, lockouts, etc.
 */
export async function getSecurityStats() {
  try {
    // Get failed login attempts in last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedLogins = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.successful, false),
        gte(loginAttempts.attemptedAt, dayAgo)
      ));

    // Get active lockouts
    const activeLockouts = await db
      .select({ count: sql<number>`count(*)` })
      .from(accountLockouts)
      .where(and(
        eq(accountLockouts.unlocked, false),
        gte(accountLockouts.unlockAt, new Date())
      ));

    // Get 2FA enabled users
    const twoFactorUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(totpSecrets)
      .where(eq(totpSecrets.enabled, true));

    // Get total users
    const totalUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    return {
      success: true,
      stats: {
        failedLoginsLast24h: Number(failedLogins[0]?.count || 0),
        activeAccountLockouts: Number(activeLockouts[0]?.count || 0),
        twoFactorEnabledUsers: Number(twoFactorUsers[0]?.count || 0),
        totalUsers: Number(totalUsers[0]?.count || 0),
        twoFactorAdoptionRate: totalUsers[0]?.count 
          ? ((Number(twoFactorUsers[0]?.count || 0) / Number(totalUsers[0].count)) * 100).toFixed(2)
          : '0.00',
      },
    };
  } catch (error) {
    console.error('Get security stats error:', error);
    return {
      success: false,
      error: 'Failed to retrieve security statistics',
    };
  }
}
