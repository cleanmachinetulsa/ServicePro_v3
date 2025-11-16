/**
 * Reminder Action Tokens - Secure HMAC-signed tokens for one-click actions
 * 
 * Features:
 * - Booking link tokens with prefilled customer data
 * - Snooze link tokens for reminder postponement
 * - Token expiration (24 hours)
 * - HMAC signature verification (prevents tampering)
 * 
 * Pattern: Follows existing QR code security pattern from routes.ts
 */

import crypto from 'crypto';

const TOKEN_SECRET = process.env.REMINDER_TOKEN_SECRET || process.env.QR_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Payload for booking link tokens
 */
export interface BookingLinkPayload {
  customerId: number;
  jobId: number;
  exp: number; // expiration timestamp
}

/**
 * Payload for snooze link tokens
 */
export interface SnoozeLinkPayload {
  customerId: number;
  jobId: number;
  exp: number;
}

/**
 * Generate HMAC-signed booking token
 * Format: customerId:jobId:exp:signature
 */
export function generateBookingToken(customerId: number, jobId: number): string {
  const exp = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const data = `${customerId}:${jobId}:${exp}`;
  
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');
  
  return `${customerId}:${jobId}:${exp}:${signature}`;
}

/**
 * Verify and decode booking token
 * Returns payload if valid, null if invalid or expired
 */
export function verifyBookingToken(token: string): BookingLinkPayload | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 4) return null;
    
    const [customerIdStr, jobIdStr, expStr, providedSignature] = parts;
    const customerId = parseInt(customerIdStr);
    const jobId = parseInt(jobIdStr);
    const exp = parseInt(expStr);
    
    if (isNaN(customerId) || isNaN(jobId) || isNaN(exp)) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > exp) {
      console.log('[REMINDER TOKENS] Token expired');
      return null;
    }
    
    // Verify signature
    const data = `${customerId}:${jobId}:${exp}`;
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(data)
      .digest('base64url');
    
    if (expectedSignature !== providedSignature) {
      console.warn('[REMINDER TOKENS] Invalid token signature');
      return null;
    }
    
    return { customerId, jobId, exp };
  } catch (error) {
    console.error('[REMINDER TOKENS] Token verification error:', error);
    return null;
  }
}

/**
 * Generate HMAC-signed snooze token
 * Format: customerId:jobId:exp:signature
 */
export function generateSnoozeToken(customerId: number, jobId: number): string {
  const exp = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const data = `${customerId}:${jobId}:${exp}`;
  
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');
  
  return `${customerId}:${jobId}:${exp}:${signature}`;
}

/**
 * Verify and decode snooze token
 * Returns payload if valid, null if invalid or expired
 */
export function verifySnoozeToken(token: string): SnoozeLinkPayload | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 4) return null;
    
    const [customerIdStr, jobIdStr, expStr, providedSignature] = parts;
    const customerId = parseInt(customerIdStr);
    const jobId = parseInt(jobIdStr);
    const exp = parseInt(expStr);
    
    if (isNaN(customerId) || isNaN(jobId) || isNaN(exp)) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > exp) {
      console.log('[REMINDER TOKENS] Token expired');
      return null;
    }
    
    // Verify signature
    const data = `${customerId}:${jobId}:${exp}`;
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(data)
      .digest('base64url');
    
    if (expectedSignature !== providedSignature) {
      console.warn('[REMINDER TOKENS] Invalid token signature');
      return null;
    }
    
    return { customerId, jobId, exp };
  } catch (error) {
    console.error('[REMINDER TOKENS] Token verification error:', error);
    return null;
  }
}

/**
 * Generate complete booking link with token
 * Returns full URL path (relative, without domain)
 */
export function createBookingLink(customerId: number, jobId: number): string {
  const token = generateBookingToken(customerId, jobId);
  return `/api/public/reminder/book?token=${token}`;
}

/**
 * Generate complete snooze link with token
 * Returns full URL path (relative, without domain)
 */
export function createSnoozeLink(customerId: number, jobId: number): string {
  const token = generateSnoozeToken(customerId, jobId);
  return `/api/public/reminder/snooze?token=${token}`;
}

/**
 * Helper to build full URL from relative path
 * Uses environment variables to determine domain
 */
export function buildFullUrl(path: string): string {
  // In production, use REPL_SLUG or configured domain
  const domain = process.env.REPLIT_DEV_DOMAIN || 
                 process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.dev` : 
                 'localhost:5000';
  
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${protocol}://${domain}${path}`;
}
