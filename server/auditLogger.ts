/**
 * Audit Logging Service
 * 
 * Comprehensive audit trail for third-party billing compliance
 * Tracks all role changes, approvals, payments, and privacy-sensitive actions
 */

import type { TenantDb } from './tenantDb';
import { auditLog, type InsertAuditLog } from "@shared/schema";
import type { Request } from "express";

export type AuditAction =
  | 'contact_created'
  | 'contact_updated'
  | 'contact_merged'
  | 'contact_deleted'
  | 'role_assigned'
  | 'role_changed'
  | 'payer_approval_sent'
  | 'payer_approved'
  | 'payer_declined'
  | 'deposit_requested'
  | 'deposit_paid'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'payment_link_created'
  | 'payment_failed'
  | 'gift_card_issued'
  | 'gift_card_redeemed'
  | 'privacy_setting_changed'
  | 'price_locked'
  | 'billing_type_changed'
  | 'authorization_created'
  | 'authorization_expired';

/**
 * Log an audit event
 */
export async function logAudit(tenantDb: TenantDb, params: {
  userId?: number | null;
  technicianId?: number | null;
  actionType: AuditAction;
  entityType: string;
  entityId: number | string;
  details?: Record<string, any>;
  req?: Request; // Express request for IP and user agent
}): Promise<void> {
  try {
    const auditEntry: InsertAuditLog = {
      userId: params.userId || null,
      technicianId: params.technicianId || null,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: typeof params.entityId === 'number' ? params.entityId : null,
      details: params.details || {},
      ipAddress: params.req?.ip || params.req?.headers['x-forwarded-for'] as string || null,
      userAgent: params.req?.headers['user-agent'] as string || null,
    };

    await tenantDb.insert(auditLog).values(auditEntry).execute();

    // Log to console for immediate visibility (production would use proper logging service)
    console.log(`[AUDIT] ${params.actionType} on ${params.entityType}:${params.entityId} by user:${params.userId || 'system'}`);
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw - audit logging failure shouldn't break the application
  }
}

/**
 * Log contact creation
 */
export async function logContactCreated(
  tenantDb: TenantDb,
  contactId: number,
  userId: number,
  details: { name: string; phone: string; email?: string; company?: string },
  req?: Request
): Promise<void> {
  await logAudit(tenantDb, {
    userId,
    actionType: 'contact_created',
    entityType: 'contact',
    entityId: contactId,
    details: {
      ...details,
      // Redact sensitive PII in logs (keep first 3 digits of phone)
      phone: details.phone.substring(0, 6) + '****',
    },
    req,
  });
}

/**
 * Log role assignment or change
 */
export async function logRoleChange(
  tenantDb: TenantDb,
  appointmentId: number,
  userId: number,
  changes: {
    role: 'requester' | 'service_contact' | 'vehicle_owner' | 'payer';
    oldContactId?: number | null;
    newContactId: number | null;
  }[],
  req?: Request
): Promise<void> {
  await logAudit(tenantDb, {
    userId,
    actionType: changes.some(c => c.oldContactId) ? 'role_changed' : 'role_assigned',
    entityType: 'appointment',
    entityId: appointmentId,
    details: { changes },
    req,
  });
}

/**
 * Log privacy setting change
 */
export async function logPrivacyChange(
  tenantDb: TenantDb,
  appointmentId: number,
  userId: number,
  changes: {
    setting: string;
    oldValue: any;
    newValue: any;
  }[],
  req?: Request
): Promise<void> {
  await logAudit(tenantDb, {
    userId,
    actionType: 'privacy_setting_changed',
    entityType: 'appointment',
    entityId: appointmentId,
    details: { changes },
    req,
  });
}

/**
 * Log payer approval events
 */
export async function logPayerApproval(
  tenantDb: TenantDb,
  appointmentId: number,
  authorizationId: number,
  action: 'sent' | 'approved' | 'declined',
  details: {
    payerContactId: number;
    estimatedPrice?: number;
    depositAmount?: number;
    declineReason?: string;
  },
  req?: Request
): Promise<void> {
  const actionMap = {
    sent: 'payer_approval_sent' as const,
    approved: 'payer_approved' as const,
    declined: 'payer_declined' as const,
  };

  await logAudit(tenantDb, {
    userId: null, // May be initiated by payer, not admin
    actionType: actionMap[action],
    entityType: 'authorization',
    entityId: authorizationId,
    details: {
      appointmentId,
      ...details,
    },
    req,
  });
}

/**
 * Log payment events
 */
export async function logPayment(
  tenantDb: TenantDb,
  appointmentId: number,
  paymentType: 'deposit' | 'invoice' | 'balance',
  status: 'requested' | 'paid' | 'failed',
  details: {
    amount: number;
    paymentLinkId?: number;
    invoiceId?: number;
    stripePaymentIntentId?: string;
    errorMessage?: string;
  },
  req?: Request
): Promise<void> {
  const actionMap = {
    deposit: {
      requested: 'deposit_requested' as const,
      paid: 'deposit_paid' as const,
      failed: 'payment_failed' as const,
    },
    invoice: {
      requested: 'invoice_created' as const,
      paid: 'invoice_paid' as const,
      failed: 'payment_failed' as const,
    },
    balance: {
      requested: 'invoice_sent' as const,
      paid: 'invoice_paid' as const,
      failed: 'payment_failed' as const,
    },
  };

  await logAudit(tenantDb, {
    userId: null,
    actionType: actionMap[paymentType][status],
    entityType: 'appointment',
    entityId: appointmentId,
    details: {
      paymentType,
      ...details,
      // Redact sensitive payment info
      stripePaymentIntentId: details.stripePaymentIntentId ? 'pi_***' + details.stripePaymentIntentId.slice(-4) : undefined,
    },
    req,
  });
}

/**
 * Log gift card events
 */
export async function logGiftCard(
  tenantDb: TenantDb,
  giftCardId: number,
  action: 'issued' | 'redeemed',
  details: {
    code: string;
    initialValue?: number;
    currentBalance?: number;
    purchasedBy?: string;
    recipientName?: string;
    appointmentId?: number;
  },
  req?: Request
): Promise<void> {
  await logAudit(tenantDb, {
    userId: null,
    actionType: action === 'issued' ? 'gift_card_issued' : 'gift_card_redeemed',
    entityType: 'gift_card',
    entityId: giftCardId,
    details: {
      ...details,
      // Redact gift card code (show first 4 chars only)
      code: details.code.substring(0, 4) + '****',
    },
    req,
  });
}

/**
 * Log billing type change
 */
export async function logBillingTypeChange(
  tenantDb: TenantDb,
  appointmentId: number,
  userId: number,
  oldType: string,
  newType: string,
  req?: Request
): Promise<void> {
  await logAudit(tenantDb, {
    userId,
    actionType: 'billing_type_changed',
    entityType: 'appointment',
    entityId: appointmentId,
    details: {
      oldType,
      newType,
    },
    req,
  });
}

/**
 * Log price lock event
 */
export async function logPriceLock(
  tenantDb: TenantDb,
  appointmentId: number,
  userId: number | null,
  price: number,
  reason: 'payer_approved' | 'manual_lock',
  req?: Request
): Promise<void> {
  await logAudit(tenantDb, {
    userId,
    actionType: 'price_locked',
    entityType: 'appointment',
    entityId: appointmentId,
    details: {
      price,
      reason,
    },
    req,
  });
}

/**
 * Get audit history for an entity
 */
export async function getAuditHistory(
  tenantDb: TenantDb,
  entityType: string,
  entityId: number,
  limit: number = 50
): Promise<any[]> {
  const history = await tenantDb
    .select()
    .from(auditLog)
    .where(tenantDb.withTenantFilter(auditLog, eq(auditLog.entityType, entityType)))
    .where(eq(auditLog.entityId, entityId))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
    .execute();

  return history;
}

// Import additional dependencies
import { eq, desc } from "drizzle-orm";
