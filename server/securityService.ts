// server/securityService.ts
// ======================================================================
// Security & Audit Service
// - TOTP 2FA setup, verification, and management
// - Login attempt tracking and account lockout
// - Audit logging for security events
// - Security statistics and reporting
// ======================================================================

import { db } from './db';
import { totpSecrets, loginAttempts, accountLockouts, auditLogs, users } from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Constants for security policies
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;
const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

// ======================================================================
// TOTP 2FA Functions
// ======================================================================

/**
 * Setup TOTP for a user - generates secret, QR code, and backup codes
 * Returns everything needed for the user to set up their authenticator app
 */
export async function setupTOTP(userId: number, email: string, appName: string = 'CleanMachine') {
  try {
    // Check if user already has TOTP setup
    const existing = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, userId))
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('TOTP already configured for this user');
    }

    // Generate secret
    const secret = authenticator.generateSecret();

    // Generate OTP auth URL for QR code
    const otpauth = authenticator.keyuri(email, appName, secret);

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauth);

    // Generate backup codes
    const backupCodes: string[] = [];
    const hashedBackupCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      const code = crypto.randomBytes(BACKUP_CODE_LENGTH).toString('hex').toUpperCase();
      backupCodes.push(code);
      const hashed = await bcrypt.hash(code, 10);
      hashedBackupCodes.push(hashed);
    }

    // Store in database (not enabled yet - user must verify first)
    await db.insert(totpSecrets).values({
      userId,
      secret,
      enabled: false,
      backupCodes: hashedBackupCodes,
    });

    return {
      secret,
      qrCode,
      backupCodes, // Show these once to the user
      otpauth,
    };
  } catch (error) {
    console.error('[securityService] setupTOTP error:', error);
    throw error;
  }
}

/**
 * Enable TOTP after user verifies they can generate valid tokens
 */
export async function enableTOTP(userId: number, token: string): Promise<boolean> {
  try {
    // Get the secret
    const totpRecord = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, userId))
      .limit(1);

    if (!totpRecord || totpRecord.length === 0) {
      throw new Error('TOTP not configured for this user');
    }

    const totp = totpRecord[0];

    if (totp.enabled) {
      throw new Error('TOTP already enabled');
    }

    // Verify the token
    const isValid = authenticator.verify({
      token,
      secret: totp.secret,
    });

    if (!isValid) {
      return false;
    }

    // Enable TOTP
    await db
      .update(totpSecrets)
      .set({
        enabled: true,
        enabledAt: new Date(),
      })
      .where(eq(totpSecrets.userId, userId));

    return true;
  } catch (error) {
    console.error('[securityService] enableTOTP error:', error);
    throw error;
  }
}

/**
 * Verify a TOTP token or backup code
 */
export async function verifyTOTP(userId: number, token: string): Promise<boolean> {
  try {
    // Get the secret
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

    // First try TOTP token
    const isValidToken = authenticator.verify({
      token,
      secret: totp.secret,
    });

    if (isValidToken) {
      // Update last used
      await db
        .update(totpSecrets)
        .set({ lastUsedAt: new Date() })
        .where(eq(totpSecrets.userId, userId));
      return true;
    }

    // Try backup codes
    if (totp.backupCodes && totp.backupCodes.length > 0) {
      for (let i = 0; i < totp.backupCodes.length; i++) {
        const isMatch = await bcrypt.compare(token, totp.backupCodes[i]);
        if (isMatch) {
          // Remove used backup code
          const updatedCodes = [...totp.backupCodes];
          updatedCodes.splice(i, 1);

          await db
            .update(totpSecrets)
            .set({
              backupCodes: updatedCodes,
              lastUsedAt: new Date(),
            })
            .where(eq(totpSecrets.userId, userId));

          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[securityService] verifyTOTP error:', error);
    return false;
  }
}

/**
 * Disable TOTP for a user (requires verification)
 */
export async function disableTOTP(userId: number, token: string): Promise<boolean> {
  try {
    // Verify the token first
    const isValid = await verifyTOTP(userId, token);
    if (!isValid) {
      return false;
    }

    // Delete TOTP configuration
    await db
      .delete(totpSecrets)
      .where(eq(totpSecrets.userId, userId));

    return true;
  } catch (error) {
    console.error('[securityService] disableTOTP error:', error);
    throw error;
  }
}

/**
 * Check if TOTP is enabled for a user
 */
export async function isTOTPEnabled(userId: number): Promise<boolean> {
  try {
    const totpRecord = await db
      .select({ enabled: totpSecrets.enabled })
      .from(totpSecrets)
      .where(and(
        eq(totpSecrets.userId, userId),
        eq(totpSecrets.enabled, true)
      ))
      .limit(1);

    return totpRecord && totpRecord.length > 0;
  } catch (error) {
    console.error('[securityService] isTOTPEnabled error:', error);
    return false;
  }
}

// ======================================================================
// Login Attempt Tracking & Account Lockout
// ======================================================================

/**
 * Log a login attempt
 */
export async function logLoginAttempt(
  username: string,
  ipAddress: string,
  success: boolean,
  reason?: string,
  userAgent?: string
): Promise<void> {
  try {
    await db.insert(loginAttempts).values({
      username,
      ipAddress,
      successful: success,
      failureReason: reason || null,
      userAgent: userAgent || null,
    });
  } catch (error) {
    console.error('[securityService] logLoginAttempt error:', error);
    // Don't throw - logging failures shouldn't block authentication
  }
}

/**
 * Check if account should be locked based on recent failed attempts
 */
export async function checkLoginAttempts(
  username: string,
  ipAddress: string
): Promise<{ locked: boolean; unlockAt?: Date; remainingAttempts?: number }> {
  try {
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    // Check for existing active lockout
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (user && user.length > 0) {
      const activeLockout = await db
        .select()
        .from(accountLockouts)
        .where(and(
          eq(accountLockouts.userId, user[0].id),
          eq(accountLockouts.unlocked, false),
          gte(accountLockouts.unlockAt, new Date())
        ))
        .limit(1);

      if (activeLockout && activeLockout.length > 0) {
        return {
          locked: true,
          unlockAt: activeLockout[0].unlockAt,
        };
      }
    }

    // Count recent failed attempts
    const recentFailures = await db
      .select()
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.username, username),
        eq(loginAttempts.ipAddress, ipAddress),
        eq(loginAttempts.successful, false),
        gte(loginAttempts.attemptedAt, windowStart)
      ));

    const failureCount = recentFailures.length;

    if (failureCount >= LOCKOUT_THRESHOLD) {
      // Create lockout if user exists
      if (user && user.length > 0) {
        const unlockAt = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

        await db.insert(accountLockouts).values({
          userId: user[0].id,
          unlockAt,
          reason: 'failed_login_attempts',
          lockedBy: null,
        });

        return {
          locked: true,
          unlockAt,
        };
      }

      // Even if user doesn't exist, return locked status
      return {
        locked: true,
        unlockAt: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
      };
    }

    return {
      locked: false,
      remainingAttempts: LOCKOUT_THRESHOLD - failureCount,
    };
  } catch (error) {
    console.error('[securityService] checkLoginAttempts error:', error);
    // On error, allow login to prevent lockout from being a DoS vector
    return { locked: false };
  }
}

// ======================================================================
// Audit Logging
// ======================================================================

/**
 * Log an audit event - supports both positional and object parameter styles
 */
export async function logAuditEvent(
  userIdOrParams: number | {
    userId: number;
    action: string;
    resource: string;
    details?: string;
    resourceId?: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
  },
  action?: string,
  resource?: string,
  resourceId?: string | null,
  changes?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    let auditData: {
      userId: number;
      action: string;
      resource: string;
      resourceId?: string | null;
      changes?: any;
      ipAddress?: string | null;
      userAgent?: string | null;
      metadata?: any;
    };

    // Handle object parameter style
    if (typeof userIdOrParams === 'object') {
      auditData = {
        userId: userIdOrParams.userId,
        action: userIdOrParams.action,
        resource: userIdOrParams.resource,
        resourceId: userIdOrParams.resourceId || null,
        changes: userIdOrParams.changes || null,
        ipAddress: userIdOrParams.ipAddress || null,
        userAgent: userIdOrParams.userAgent || null,
        metadata: userIdOrParams.details ? { details: userIdOrParams.details } : null,
      };
    } else {
      // Handle positional parameter style
      auditData = {
        userId: userIdOrParams,
        action: action!,
        resource: resource!,
        resourceId: resourceId || null,
        changes: changes || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      };
    }

    await db.insert(auditLogs).values(auditData);
  } catch (error) {
    console.error('[securityService] logAuditEvent error:', error);
    // Don't throw - logging failures shouldn't block operations
  }
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(filters?: {
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const conditions: any[] = [];

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

    if (filters?.endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${filters.endDate}`);
    }

    const query = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }

    return await query;
  } catch (error) {
    console.error('[securityService] getAuditLogs error:', error);
    return [];
  }
}

// ======================================================================
// Security Statistics
// ======================================================================

/**
 * Get security statistics for dashboard
 */
export async function getSecurityStats(): Promise<{
  failedLoginCountLastHour: number;
  failedLoginCountLast24h: number;
  activeLocksCount: number;
  totalAuditEvents24h: number;
}> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Failed login attempts in last hour
    const failedLastHour = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.successful, false),
        gte(loginAttempts.attemptedAt, oneHourAgo)
      ));

    // Failed login attempts in last 24 hours
    const failedLast24h = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.successful, false),
        gte(loginAttempts.attemptedAt, oneDayAgo)
      ));

    // Active lockouts
    const activeLocks = await db
      .select({ count: sql<number>`count(*)` })
      .from(accountLockouts)
      .where(and(
        eq(accountLockouts.unlocked, false),
        gte(accountLockouts.unlockAt, new Date())
      ));

    // Total audit events in last 24h
    const auditEvents24h = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, oneDayAgo));

    return {
      failedLoginCountLastHour: Number(failedLastHour[0]?.count || 0),
      failedLoginCountLast24h: Number(failedLast24h[0]?.count || 0),
      activeLocksCount: Number(activeLocks[0]?.count || 0),
      totalAuditEvents24h: Number(auditEvents24h[0]?.count || 0),
    };
  } catch (error) {
    console.error('[securityService] getSecurityStats error:', error);
    return {
      failedLoginCountLastHour: 0,
      failedLoginCountLast24h: 0,
      activeLocksCount: 0,
      totalAuditEvents24h: 0,
    };
  }
}

// ======================================================================
// Legacy compatibility exports
// ======================================================================

export default {
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
};
