/**
 * CM-DEMO-1: Clean Machine Demo Mode Configuration
 * 
 * This module provides configuration and helpers for the demo tenant system.
 * The demo tenant allows potential customers to try the platform without
 * exposing real customer data or sending real messages.
 */

export const DEMO_TENANT_SLUG = "cleanmachine-demo";
export const DEMO_TENANT_NAME = "Clean Machine Demo";
export const DEMO_TENANT_ID = "demo-tenant";

export const DEMO_SESSION_DURATION_HOURS = 2;

export function isDemoTenant(tenantId: string | null | undefined): boolean {
  if (!tenantId) return false;
  return tenantId === DEMO_TENANT_ID || tenantId === DEMO_TENANT_SLUG;
}

export function isDemoSession(demoSessionToken: string | null | undefined): boolean {
  return !!demoSessionToken && demoSessionToken.startsWith('demo-');
}

export const DEMO_FAKE_PHONE_PREFIX = '+1555';

export const DEMO_BANNER_MESSAGE = "Demo Mode – data and messages here are simulated. No real customers are contacted.";

export const DEMO_FEATURES = {
  canSendRealSMS: false,
  canSendRealEmail: false,
  canCreateRealBookings: false,
  canModifyRealCustomers: false,
  requiresPhoneVerification: true,
} as const;
