/**
 * Phase 10 - Agent Context Engine Types
 * 
 * Defines the structured context that an AI setup/support agent can access.
 * This provides a rich snapshot of tenant configuration, feature flags,
 * telephony status, email status, website status, and configuration gaps.
 * 
 * NOTE: This file contains ONLY types and tiny helpers - no DB queries.
 */

import type { FeatureKey } from './features';

// ===================================================================
// TENANT PROFILE CONTEXT
// ===================================================================

export interface AgentTenantProfileContext {
  tenantId: string;
  tenantName: string;
  planKey: 'free' | 'starter' | 'pro' | 'elite' | 'internal';
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  industryKey: string | null;
  industryPackId: string | null;
  subdomain: string | null;
  customDomain: string | null;
  city: string | null;
  branding: {
    displayName: string;
    primaryColor: string | null;
    accentColor: string | null;
    logoUrl: string | null;
    poweredByServicePro: boolean;
  };
}

// ===================================================================
// FEATURE GATE CONTEXT
// ===================================================================

export interface AgentFeatureGateContext {
  enabledFeatures: FeatureKey[];
  disabledFeatures: FeatureKey[];
  planDescription: string;
}

// ===================================================================
// TELEPHONY CONTEXT
// ===================================================================

export type AgentTelephonyHealthStatus =
  | 'not_configured'
  | 'configured'
  | 'trial_sandbox'
  | 'misconfigured'
  | 'needs_a2p'
  | 'error';

export interface AgentTelephonyPhoneNumber {
  sid?: string;
  friendlyName: string | null;
  phoneNumber: string;
  isTrialNumber: boolean;
}

export interface AgentTelephonyContext {
  status: AgentTelephonyHealthStatus;
  phoneNumbers: AgentTelephonyPhoneNumber[];
  ivrMode: 'simple' | 'ivr' | 'ai-voice' | null;
  messagingServiceConfigured: boolean;
  a2pCampaignStatus: string | null;
  notes: string[];
}

// ===================================================================
// EMAIL CONTEXT
// ===================================================================

export type AgentEmailHealthStatus =
  | 'not_configured'
  | 'sender_verified'
  | 'domain_verified'
  | 'misconfigured'
  | 'error';

export interface AgentEmailContext {
  status: AgentEmailHealthStatus;
  fromAddress: string | null;
  displayName: string | null;
  replyToAddress: string | null;
  notes: string[];
}

// ===================================================================
// WEBSITE CONTEXT
// ===================================================================

export type AgentWebsiteHealthStatus =
  | 'not_configured'
  | 'preview_only'
  | 'live_default_domain'
  | 'live_custom_domain'
  | 'error';

export interface AgentWebsiteContext {
  status: AgentWebsiteHealthStatus;
  bookingUrl: string | null;
  hasCustomDomain: boolean;
  customDomain: string | null;
  subdomain: string | null;
  notes: string[];
}

// ===================================================================
// CONFIGURATION GAPS
// ===================================================================

export type AgentConfigGapArea =
  | 'telephony'
  | 'email'
  | 'website'
  | 'industry'
  | 'integrations'
  | 'billing'
  | 'branding'
  | 'other';

export type AgentConfigGapSeverity = 'info' | 'warning' | 'critical';

export interface AgentConfigGap {
  key: string;
  severity: AgentConfigGapSeverity;
  area: AgentConfigGapArea;
  message: string;
  suggestion?: string;
}

// ===================================================================
// MAIN AGENT CONTEXT
// ===================================================================

export interface AgentContext {
  tenant: AgentTenantProfileContext;
  features: AgentFeatureGateContext;
  telephony: AgentTelephonyContext;
  email: AgentEmailContext;
  website: AgentWebsiteContext;
  gaps: AgentConfigGap[];
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Get human-readable plan description for the agent
 */
export function getPlanDescription(planKey: string): string {
  const descriptions: Record<string, string> = {
    free: 'Free tier with basic CRM and watermarked website',
    starter: 'Starter tier with custom domain and booking forms',
    pro: 'Pro tier with AI SMS, campaigns, and loyalty program',
    elite: 'Elite tier with AI voice, advanced analytics, and priority support',
    internal: 'Internal tier with all features enabled (family/friends)',
  };
  return descriptions[planKey] || 'Unknown plan tier';
}

/**
 * Check if plan shows powered-by watermark
 */
export function showsPoweredByWatermark(planKey: string): boolean {
  return planKey === 'free';
}
