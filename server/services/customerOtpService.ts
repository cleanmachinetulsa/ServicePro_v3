/**
 * Phase 15 - Customer OTP Service
 * 
 * Handles OTP generation, rate limiting, verification, and session creation
 * for customer portal authentication.
 */

import crypto from 'crypto';
import type { TenantDb } from '../tenantDb';
import { customerOtps, customerSessions, type InsertCustomerOtp, type InsertCustomerSession } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { normalizePhoneE164, canonicalizeEmail } from '../contactUtils';
import { resolveCustomerIdentity, updateLastLogin } from './customerIdentityService';
import { sendSMS } from '../notifications';

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

// Rate Limiting Configuration
const RATE_LIMIT_HOURLY = 5;  // Max 5 OTPs per hour per destination
const RATE_LIMIT_DAILY = 10;  // Max 10 OTPs per day per destination

// Session Configuration
const SESSION_EXPIRY_DAYS = 30;

export interface RequestCustomerOtpArgs {
  tenantId: string;
  destinationType: 'sms' | 'email';
  phone?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestCustomerOtpResult {
  success: boolean;
  maskedDestination?: string;
  reason?: string;
}

export interface VerifyCustomerOtpArgs {
  tenantId: string;
  destinationType: 'sms' | 'email';
  phone?: string;
  email?: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyCustomerOtpResult {
  success: boolean;
  sessionToken?: string;
  customerId?: number;
  reason?: string;
}

/**
 * Generate a 6-digit numeric OTP code
 */
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash an OTP code using SHA-256
 */
function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Mask a phone number for display: +19185551234 -> +1 ***-***-1234
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ***-***-${digits.slice(-4)}`;
  }
  return `***-${phone.slice(-4)}`;
}

/**
 * Mask an email for display: user@example.com -> u***@example.com
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  return `${localPart[0]}***@${domain}`;
}

/**
 * Check rate limits for OTP requests
 * Returns true if rate limit exceeded, false if OK
 */
async function checkRateLimit(
  db: TenantDb,
  tenantId: string,
  destination: string,
  channel: string
): Promise<{ exceeded: boolean; reason?: string }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Count OTPs in the last hour
  const hourlyOtps = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerOtps)
    .where(
      and(
        eq(customerOtps.tenantId, tenantId),
        eq(customerOtps.destination, destination),
        eq(customerOtps.channel, channel),
        gte(customerOtps.createdAt, oneHourAgo)
      )
    );

  const hourlyCount = Number(hourlyOtps[0]?.count || 0);
  if (hourlyCount >= RATE_LIMIT_HOURLY) {
    return { exceeded: true, reason: 'rate_limited_hourly' };
  }

  // Count OTPs in the last 24 hours
  const dailyOtps = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerOtps)
    .where(
      and(
        eq(customerOtps.tenantId, tenantId),
        eq(customerOtps.destination, destination),
        eq(customerOtps.channel, channel),
        gte(customerOtps.createdAt, oneDayAgo)
      )
    );

  const dailyCount = Number(dailyOtps[0]?.count || 0);
  if (dailyCount >= RATE_LIMIT_DAILY) {
    return { exceeded: true, reason: 'rate_limited_daily' };
  }

  return { exceeded: false };
}

/**
 * Get tenant business name for OTP message templates
 */
async function getTenantBusinessName(db: TenantDb, tenantId: string): Promise<string> {
  try {
    const { tenants } = await import('@shared/schema');
    const results = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    
    return results[0]?.name || 'ServicePro';
  } catch (error) {
    console.error('[OTP] Failed to get tenant name:', error);
    return 'ServicePro';
  }
}

/**
 * Request a new OTP code for customer authentication
 */
export async function requestCustomerOtp(
  db: TenantDb,
  args: RequestCustomerOtpArgs
): Promise<RequestCustomerOtpResult> {
  const { tenantId, destinationType, phone, email } = args;

  // Normalize destination
  let destination: string | null = null;
  let maskedDestination: string = '';

  if (destinationType === 'sms') {
    if (!phone) {
      return { success: false, reason: 'phone_required' };
    }
    destination = normalizePhoneE164(phone);
    if (!destination) {
      return { success: false, reason: 'invalid_phone' };
    }
    maskedDestination = maskPhone(destination);
  } else if (destinationType === 'email') {
    if (!email) {
      return { success: false, reason: 'email_required' };
    }
    destination = canonicalizeEmail(email);
    if (!destination) {
      return { success: false, reason: 'invalid_email' };
    }
    maskedDestination = maskEmail(destination);
  } else {
    return { success: false, reason: 'invalid_channel' };
  }

  // Check rate limits
  const rateLimitCheck = await checkRateLimit(db, tenantId, destination, destinationType);
  if (rateLimitCheck.exceeded) {
    console.log(`[OTP] Rate limit exceeded for ${maskedDestination}: ${rateLimitCheck.reason}`);
    return { success: false, reason: rateLimitCheck.reason };
  }

  // Generate OTP code
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store OTP in database
  await db.insert(customerOtps).values({
    tenantId,
    channel: destinationType,
    destination,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  console.log(`[OTP] Generated OTP for ${maskedDestination}, expires at ${expiresAt.toISOString()}`);

  // SECURITY: Dev mode ONLY activates when explicitly enabled AND not in production
  // This prevents accidental code leakage when Twilio credentials are missing in prod
  const isOtpDevMode =
    process.env.OTP_DEV_MODE === '1' &&
    process.env.NODE_ENV !== 'production';

  // Send OTP via appropriate channel
  if (destinationType === 'sms') {
    if (isOtpDevMode) {
      // DEV MODE: Log the OTP code to console instead of sending SMS
      console.log('='.repeat(60));
      console.log('[OTP DEV MODE] 🔐 VERIFICATION CODE');
      console.log('='.repeat(60));
      console.log(`Phone: ${maskedDestination}`);
      console.log(`Code:  ${code}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log('='.repeat(60));
      console.log('[OTP DEV MODE] Copy the code above to complete login');
      console.log('='.repeat(60));
      
      return {
        success: true,
        maskedDestination,
      };
    }

    // PRODUCTION/NON-DEV: Always attempt to send real SMS via Twilio
    const businessName = await getTenantBusinessName(db, tenantId);
    const message = `Your ${businessName} verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
    
    // Warn if Twilio credentials are missing (but still attempt send)
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('[OTP] ⚠️ CRITICAL: Twilio credentials missing - SMS will fail!');
      console.error('[OTP] Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN or enable OTP_DEV_MODE=1 for development');
    }
    
    try {
      const smsResult = await sendSMS(db, destination, message);
      
      // sendSMS returns {success: boolean, error?: any} without throwing
      // We must check the success field and handle failure explicitly
      if (!smsResult.success) {
        console.error('[OTP] SMS send failed:', smsResult.error || 'Unknown error');
        return { success: false, reason: 'sms_send_failed' };
      }
      
      console.log(`[OTP] SMS sent successfully to ${maskedDestination}`);
    } catch (error) {
      // Catch any unexpected exceptions from sendSMS
      console.error('[OTP] Failed to send SMS (exception):', error);
      return { success: false, reason: 'sms_send_failed' };
    }
  } else if (destinationType === 'email') {
    if (isOtpDevMode) {
      // DEV MODE: Log the OTP code to console instead of sending email
      console.log('='.repeat(60));
      console.log('[OTP DEV MODE] 🔐 VERIFICATION CODE');
      console.log('='.repeat(60));
      console.log(`Email: ${maskedDestination}`);
      console.log(`Code:  ${code}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log('='.repeat(60));
      console.log('[OTP DEV MODE] Copy the code above to complete login');
      console.log('='.repeat(60));
      
      return {
        success: true,
        maskedDestination,
      };
    }

    // TODO (Phase X): Implement email OTP sending via SendGrid
    // For now, email OTP is not implemented regardless of dev mode
    console.log(`[OTP] Email OTP not yet implemented for ${maskedDestination}`);
    return { success: false, reason: 'email_not_implemented' };
  }

  return {
    success: true,
    maskedDestination,
  };
}

/**
 * Verify an OTP code and create a customer session
 */
export async function verifyCustomerOtp(
  db: TenantDb,
  args: VerifyCustomerOtpArgs
): Promise<VerifyCustomerOtpResult> {
  const { tenantId, destinationType, phone, email, code, ipAddress, userAgent } = args;

  // Normalize destination
  let destination: string | null = null;

  if (destinationType === 'sms') {
    if (!phone) {
      return { success: false, reason: 'phone_required' };
    }
    destination = normalizePhoneE164(phone);
    if (!destination) {
      return { success: false, reason: 'invalid_phone' };
    }
  } else if (destinationType === 'email') {
    if (!email) {
      return { success: false, reason: 'email_required' };
    }
    destination = canonicalizeEmail(email);
    if (!destination) {
      return { success: false, reason: 'invalid_email' };
    }
  } else {
    return { success: false, reason: 'invalid_channel' };
  }

  // Find the most recent unconsumed OTP for this destination
  const otps = await db
    .select()
    .from(customerOtps)
    .where(
      and(
        eq(customerOtps.tenantId, tenantId),
        eq(customerOtps.destination, destination),
        eq(customerOtps.channel, destinationType),
        sql`${customerOtps.consumedAt} IS NULL`
      )
    )
    .orderBy(sql`${customerOtps.createdAt} DESC`)
    .limit(1);

  const otp = otps[0];

  if (!otp) {
    console.log(`[OTP] No OTP found for ${destination}`);
    return { success: false, reason: 'invalid_code' };
  }

  // Check if OTP is expired
  if (new Date() > new Date(otp.expiresAt)) {
    console.log(`[OTP] OTP expired for ${destination}`);
    return { success: false, reason: 'expired' };
  }

  // Check if too many attempts
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    console.log(`[OTP] Too many attempts for ${destination}`);
    return { success: false, reason: 'too_many_attempts' };
  }

  // Verify the code
  const codeHash = hashOtpCode(code);
  if (codeHash !== otp.codeHash) {
    // Increment attempts
    await db
      .update(customerOtps)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(customerOtps.id, otp.id));

    console.log(`[OTP] Invalid code attempt ${otp.attempts + 1}/${OTP_MAX_ATTEMPTS} for ${destination}`);
    return { success: false, reason: 'invalid_code' };
  }

  // Code is valid! Mark OTP as consumed
  await db
    .update(customerOtps)
    .set({ consumedAt: new Date() })
    .where(eq(customerOtps.id, otp.id));

  console.log(`[OTP] Valid OTP verified for ${destination}`);

  // Resolve or create customer identity
  const identity = await resolveCustomerIdentity(db, {
    tenantId,
    phone: destinationType === 'sms' ? destination : undefined,
    email: destinationType === 'email' ? destination : undefined,
  });

  // Create a new customer session
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(customerSessions).values({
    tenantId,
    customerId: identity.customerId,
    sessionToken,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    expiresAt,
  });

  // Update last login timestamp
  await updateLastLogin(db, identity.identityId);

  console.log(`[OTP] Created session for customer ${identity.customerId}, expires ${expiresAt.toISOString()}`);

  return {
    success: true,
    sessionToken,
    customerId: identity.customerId,
  };
}

/**
 * Validate a session token and return customer info
 */
export async function validateSession(
  db: TenantDb,
  sessionToken: string
): Promise<{ valid: boolean; customerId?: number; tenantId?: string }> {
  const sessions = await db
    .select()
    .from(customerSessions)
    .where(
      and(
        eq(customerSessions.sessionToken, sessionToken),
        sql`${customerSessions.revokedAt} IS NULL`
      )
    )
    .limit(1);

  const session = sessions[0];

  if (!session) {
    return { valid: false };
  }

  // Check if session is expired
  if (new Date() > new Date(session.expiresAt)) {
    return { valid: false };
  }

  return {
    valid: true,
    customerId: session.customerId,
    tenantId: session.tenantId,
  };
}

/**
 * Revoke a customer session (logout)
 */
export async function revokeSession(
  db: TenantDb,
  sessionToken: string
): Promise<void> {
  await db
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(eq(customerSessions.sessionToken, sessionToken));
  
  console.log(`[Session] Revoked session ${sessionToken.substring(0, 8)}...`);
}

// TODO (Phase X): Add 'magic_link' as a channel using email links instead of numeric codes.
// This would involve generating a secure token, storing it in customerOtps with channel='magic_link',
// and sending an email with a link containing the token. The verify flow would check the token
// instead of a numeric code.
