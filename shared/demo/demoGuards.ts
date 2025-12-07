/**
 * CM-DEMO-1: Demo Mode Outbound Guardrails
 * 
 * This module provides guards to prevent demo mode from sending real messages
 * to real customers. All outbound communication in demo mode is either:
 * 1. Blocked until a phone is verified
 * 2. Redirected to the verified demo phone only
 */

import { isDemoTenant, DEMO_TENANT_ID } from '../demoConfig';

export interface OutboundFilterArgs {
  tenantId: string;
  toPhone?: string;
  toEmail?: string;
  bodyPreview?: string;
  demoSessionToken?: string;
}

export interface OutboundFilterResult {
  allow: boolean;
  finalToPhone?: string;
  finalToEmail?: string;
  reason?: string;
  isSimulated?: boolean;
}

export interface DemoSessionInfo {
  id: string;
  tenantId: string;
  expiresAt: Date;
  verifiedDemoPhone: string | null;
}

export async function filterOutboundForDemo(
  args: OutboundFilterArgs,
  getSessionFn: (token: string) => Promise<DemoSessionInfo | null>
): Promise<OutboundFilterResult> {
  const { tenantId, toPhone, toEmail, demoSessionToken } = args;

  if (!isDemoTenant(tenantId)) {
    return { allow: true };
  }

  if (!demoSessionToken) {
    return {
      allow: false,
      reason: 'Demo session token required',
      isSimulated: true,
    };
  }

  const session = await getSessionFn(demoSessionToken);

  if (!session) {
    return {
      allow: false,
      reason: 'Demo session not found or expired',
      isSimulated: true,
    };
  }

  if (new Date() > session.expiresAt) {
    return {
      allow: false,
      reason: 'Demo session expired',
      isSimulated: true,
    };
  }

  if (!session.verifiedDemoPhone) {
    return {
      allow: false,
      reason: 'Demo phone not verified. Please verify your phone number first.',
      isSimulated: true,
    };
  }

  return {
    allow: true,
    finalToPhone: session.verifiedDemoPhone,
    finalToEmail: undefined,
    isSimulated: false,
  };
}

export function shouldBlockMutation(tenantId: string | null | undefined): boolean {
  return isDemoTenant(tenantId);
}

export function createSimulatedResponse<T>(data: T, message = 'Simulated in demo mode'): {
  data: T;
  simulated: true;
  message: string;
} {
  return {
    data,
    simulated: true,
    message,
  };
}

export function logDemoAction(action: string, details: Record<string, any>): void {
  console.log(`[DEMO MODE] ${action}:`, JSON.stringify(details));
}
