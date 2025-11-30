/**
 * Phase 11 - Email Types
 * 
 * Shared types for tenant email configuration and sending.
 */

export type TenantEmailStatus = 'not_configured' | 'needs_verification' | 'healthy' | 'error';

export interface TenantEmailProfileDTO {
  tenantId: string;
  provider: 'sendgrid';
  fromName: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  status: TenantEmailStatus;
  lastVerifiedAt: string | null;
  lastError: string | null;
}

export interface SendTenantEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
}

export interface SendTenantEmailResult {
  ok: boolean;
  reason?: 'missing_env' | 'send_failed' | 'invalid_recipient';
  errorMessage?: string;
}
