/**
 * Phase 11 - Tenant-Aware Email Service
 * 
 * Sends emails on behalf of tenants using a shared SendGrid configuration.
 * Respects tenant-specific fromName and replyTo settings when available.
 */

import sgMail from '@sendgrid/mail';
import { eq } from 'drizzle-orm';
import { type TenantDb } from '../tenantDb';
import { tenantEmailProfiles, tenants, tenantConfig } from '@shared/schema';
import type { SendTenantEmailInput, SendTenantEmailResult } from '@shared/email';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM_ADDRESS = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'ServicePro';

let sgInitialized = false;

function initializeSendGrid(): boolean {
  if (sgInitialized) return true;
  if (!SENDGRID_API_KEY) {
    console.warn('[tenantEmailService] SENDGRID_API_KEY not configured');
    return false;
  }
  sgMail.setApiKey(SENDGRID_API_KEY);
  sgInitialized = true;
  return true;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface TenantEmailContext {
  fromName: string;
  fromEmail: string;
  replyToEmail: string | null;
}

async function getTenantEmailContext(
  tenantDb: TenantDb,
  tenantId: string
): Promise<TenantEmailContext | null> {
  try {
    const [emailProfile] = await tenantDb.raw
      .select()
      .from(tenantEmailProfiles)
      .where(eq(tenantEmailProfiles.tenantId, tenantId))
      .limit(1);

    const [tenantInfo] = await tenantDb.raw
      .select({
        tenantName: tenants.name,
        businessName: tenantConfig.businessName,
        ownerEmail: tenantConfig.primaryContactEmail,
      })
      .from(tenants)
      .leftJoin(tenantConfig, eq(tenants.id, tenantConfig.tenantId))
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenantInfo) {
      console.error(`[tenantEmailService] Tenant not found: ${tenantId}`);
      return null;
    }

    const displayName = tenantInfo.businessName || tenantInfo.tenantName || EMAIL_FROM_NAME;

    const fromName = emailProfile?.fromName || displayName;
    const fromEmail = EMAIL_FROM_ADDRESS || '';
    const replyToEmail = emailProfile?.replyToEmail || tenantInfo.ownerEmail || null;

    return {
      fromName,
      fromEmail,
      replyToEmail,
    };
  } catch (error) {
    console.error('[tenantEmailService] Error fetching tenant email context:', error);
    return null;
  }
}

async function updateEmailProfileStatus(
  tenantDb: TenantDb,
  tenantId: string,
  status: 'healthy' | 'error',
  lastError?: string
): Promise<void> {
  try {
    const [existing] = await tenantDb.raw
      .select({ id: tenantEmailProfiles.id })
      .from(tenantEmailProfiles)
      .where(eq(tenantEmailProfiles.tenantId, tenantId))
      .limit(1);

    if (existing) {
      await tenantDb.raw
        .update(tenantEmailProfiles)
        .set({
          status,
          lastError: status === 'error' ? lastError?.substring(0, 500) : null,
          lastVerifiedAt: status === 'healthy' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(tenantEmailProfiles.tenantId, tenantId));
    }
  } catch (error) {
    console.error('[tenantEmailService] Error updating email profile status:', error);
  }
}

export async function sendTenantEmail(
  tenantDb: TenantDb,
  tenantId: string,
  input: SendTenantEmailInput
): Promise<SendTenantEmailResult> {
  if (!SENDGRID_API_KEY) {
    console.warn(`[tenantEmailService] SENDGRID_API_KEY missing; skipping email send for tenant ${tenantId}`);
    return { ok: false, reason: 'missing_env' };
  }

  if (!EMAIL_FROM_ADDRESS) {
    console.warn(`[tenantEmailService] EMAIL_FROM_ADDRESS (SENDGRID_FROM_EMAIL) missing; skipping email send for tenant ${tenantId}`);
    return { ok: false, reason: 'missing_env' };
  }

  if (!input.to || !input.to.includes('@')) {
    console.warn(`[tenantEmailService] Invalid recipient email: ${input.to}`);
    return { ok: false, reason: 'invalid_recipient' };
  }

  const context = await getTenantEmailContext(tenantDb, tenantId);
  if (!context) {
    return { ok: false, reason: 'send_failed', errorMessage: 'Failed to get tenant context' };
  }

  initializeSendGrid();

  const msg: sgMail.MailDataRequired = {
    to: input.to,
    from: {
      email: context.fromEmail,
      name: context.fromName,
    },
    subject: input.subject,
    html: input.html,
    text: input.text || stripHtmlToText(input.html),
    ...(context.replyToEmail && {
      replyTo: {
        email: context.replyToEmail,
        name: context.fromName,
      },
    }),
    ...(input.category && { categories: [input.category] }),
  };

  try {
    await sgMail.send(msg);
    console.log(`[tenantEmailService] Email sent successfully for tenant ${tenantId} to ${input.to}`);
    
    await updateEmailProfileStatus(tenantDb, tenantId, 'healthy');
    
    return { ok: true };
  } catch (error: any) {
    const errorMessage = error?.response?.body?.errors?.[0]?.message || error?.message || 'Unknown error';
    console.error(`[tenantEmailService] Failed to send email for tenant ${tenantId}:`, errorMessage);
    
    await updateEmailProfileStatus(tenantDb, tenantId, 'error', errorMessage);
    
    return { ok: false, reason: 'send_failed', errorMessage };
  }
}

export async function createTenantEmailProfile(
  tenantDb: TenantDb,
  tenantId: string,
  data: {
    fromName?: string;
    replyToEmail?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [existing] = await tenantDb.raw
      .select({ id: tenantEmailProfiles.id })
      .from(tenantEmailProfiles)
      .where(eq(tenantEmailProfiles.tenantId, tenantId))
      .limit(1);

    if (existing) {
      await tenantDb.raw
        .update(tenantEmailProfiles)
        .set({
          fromName: data.fromName,
          replyToEmail: data.replyToEmail,
          status: 'needs_verification',
          updatedAt: new Date(),
        })
        .where(eq(tenantEmailProfiles.tenantId, tenantId));
    } else {
      await tenantDb.raw
        .insert(tenantEmailProfiles)
        .values({
          tenantId,
          provider: 'sendgrid',
          fromName: data.fromName,
          replyToEmail: data.replyToEmail,
          status: 'needs_verification',
        });
    }

    return { ok: true };
  } catch (error: any) {
    console.error('[tenantEmailService] Error creating/updating email profile:', error);
    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

export function hasGlobalSendGridConfig(): boolean {
  return !!(SENDGRID_API_KEY && EMAIL_FROM_ADDRESS);
}

export function getGlobalEmailFromAddress(): string | null {
  return EMAIL_FROM_ADDRESS || null;
}
