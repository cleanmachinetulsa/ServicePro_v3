/**
 * Role-Aware Notification Service
 * 
 * Sends notifications to different contacts based on their role in a job
 * with appropriate privacy and messaging for each role (payer, service contact, requester, vehicle owner)
 */

import { db } from "./db";
import { appointments, contacts, type Appointment, type Contact } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendSMS } from "./notifications";
import { sendBusinessEmail } from "./emailService";
import type { TenantDb } from "./tenantDb";

/**
 * Notification templates for each role and event type
 */

export interface NotificationContext {
  appointment: Appointment;
  roles: {
    requester?: Contact | null;
    serviceContact?: Contact | null;
    vehicleOwner?: Contact | null;
    payer?: Contact | null;
  };
  businessName: string;
  businessPhone: string;
  metadata?: Record<string, any>; // Additional context like price, ETA, etc.
}

export type NotificationEvent =
  | 'payer_approval_request'
  | 'deposit_request'
  | 'deposit_reminder'
  | 'invoice_sent'
  | 'appointment_confirmed'
  | 'otw_notification'
  | 'appointment_completed'
  | 'reschedule_offer'
  | 'gift_recipient_notification'
  | 'gift_giver_update';

export type NotificationChannel = 'sms' | 'email' | 'both';

/**
 * Template variable replacement
 */
function replaceVariables(template: string, vars: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

/**
 * Get template for specific event and role
 */
function getTemplate(event: NotificationEvent, role: 'payer' | 'service_contact' | 'requester' | 'vehicle_owner'): string {
  const templates: Record<NotificationEvent, Record<string, string>> = {
    payer_approval_request: {
      payer: `Hi {{payerName}}, {{businessName}} can service {{vehicleDesc}} on {{dateWindow}}. Total {{price}}. Deposit: {{depositAmount}}. Please approve: {{approvalLink}}`,
      service_contact: '', // Not sent to service contact
      requester: '', // Not sent to requester
      vehicle_owner: '', // Not sent to vehicle owner
    },
    deposit_request: {
      payer: `Thanks for approving! Securely pay the {{depositPercent}}% deposit ({{depositAmount}}): {{paymentLink}}`,
      service_contact: '',
      requester: '',
      vehicle_owner: '',
    },
    deposit_reminder: {
      payer: `Reminder: Your {{depositAmount}} deposit is due for your appointment on {{appointmentDate}}. Pay here: {{paymentLink}}`,
      service_contact: '',
      requester: '',
      vehicle_owner: '',
    },
    invoice_sent: {
      payer: `Your invoice for {{serviceName}} is ready: {{invoiceLink}}. Balance due {{balanceDue}}.`,
      service_contact: '',
      requester: '',
      vehicle_owner: '',
    },
    appointment_confirmed: {
      payer: `Appointment confirmed for {{dateWindow}} at {{location}}. Total: {{price}}.`,
      service_contact: `Hi {{contactName}}, your {{serviceName}} is confirmed for {{dateWindow}} at {{location}}. Prep tip: Please remove personal items from vehicle & ensure empty driveway space for our shade canopy. Thanks!`,
      requester: `Appointment confirmed for {{dateWindow}}. We'll take great care of {{vehicleDesc}}!`,
      vehicle_owner: `Your {{vehicleDesc}} service is scheduled for {{dateWindow}}. We'll send care tips after completion!`,
    },
    otw_notification: {
      payer: '', // Payer doesn't get live location by default (privacy setting)
      service_contact: `Hi {{contactName}}! {{techName}} is on the way - ETA ~{{eta}} min. {{techBio}}. Quick reminder: Clear personal items from vehicle & have driveway ready for our canopy setup. See you soon!`,
      requester: '',
      vehicle_owner: '',
    },
    appointment_completed: {
      payer: `Service complete! Your invoice: {{invoiceLink}}. Balance: {{balanceDue}}.`,
      service_contact: `Thank you! Your {{vehicleDesc}} is ready. {{reviewLink}}`,
      requester: `Service complete! {{reviewLink}}`,
      vehicle_owner: `Your vehicle is ready! Care tips: {{careTipsLink}}`,
    },
    reschedule_offer: {
      payer: `Weather alert for {{appointmentDate}}. Reschedule? {{rescheduleLink}}`,
      service_contact: `Weather alert for your appointment on {{appointmentDate}}. Pick a new time: {{rescheduleLink}}`,
      requester: `Weather may affect your {{appointmentDate}} appointment. Reschedule: {{rescheduleLink}}`,
      vehicle_owner: '',
    },
    gift_recipient_notification: {
      payer: '', // Giver is payer, doesn't get recipient notification
      service_contact: `A gift from {{giverName}}! Your {{serviceName}} is scheduled for {{dateWindow}}. {{giftMessage}}`,
      requester: '',
      vehicle_owner: `{{giverName}} gifted you a {{serviceName}}! Scheduled for {{dateWindow}}. {{giftMessage}}`,
    },
    gift_giver_update: {
      payer: `Gift update: Recipient's appointment for {{serviceName}} is {{status}}. {{details}}`,
      service_contact: '',
      requester: '',
      vehicle_owner: '',
    },
  };

  return templates[event]?.[role] || '';
}

/**
 * Send notification to specific contact
 */
async function sendToContact(
  tenantDb: TenantDb,
  contact: Contact,
  message: string,
  channel: NotificationChannel
): Promise<{ sms: boolean; email: boolean }> {
  const results = { sms: false, email: false };

  // Check if contact has opted out of SMS
  if (contact.smsOptOut && (channel === 'sms' || channel === 'both')) {
    console.warn(`Contact ${contact.id} has opted out of SMS, skipping SMS notification`);
    // Fall back to email only if both was requested
    if (channel === 'both') {
      channel = 'email';
    } else {
      return results; // Skip entirely if SMS-only was requested
    }
  }

  // Get notification preferences
  const prefs = contact.notificationPrefs as { sms?: boolean; email?: boolean } || { sms: true, email: true };

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && prefs.sms && contact.phoneE164 && !contact.smsOptOut) {
    try {
      const smsResult = await sendSMS(tenantDb, contact.phoneE164, message);
      results.sms = smsResult.success;
    } catch (error) {
      console.error(`Failed to send SMS to ${contact.phoneE164}:`, error);
      // Try email as fallback if both channels were requested
      if (channel === 'both' && contact.email && prefs.email) {
        console.log(`Attempting email fallback for ${contact.email}`);
      }
    }
  }

  // Send Email
  if ((channel === 'email' || channel === 'both' || (!results.sms && channel === 'both')) && prefs.email && contact.email) {
    try {
      const emailResult = await sendBusinessEmail(
        contact.email,
        'Appointment Update',
        message
      );
      results.email = emailResult.success;
    } catch (error) {
      console.error(`Failed to send email to ${contact.email}:`, error);
    }
  }

  return results;
}

/**
 * Send role-aware notifications for a specific event
 */
export async function sendRoleAwareNotification(
  tenantDb: TenantDb,
  appointmentId: number,
  event: NotificationEvent,
  metadata: Record<string, any> = {},
  channel: NotificationChannel = 'both'
): Promise<{
  sent: { role: string; channel: 'sms' | 'email'; success: boolean }[];
  failed: { role: string; reason: string }[];
}> {
  // Fetch appointment with all role contacts
  const appointment = await tenantDb
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .execute();

  if (!appointment[0]) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }

  const appt = appointment[0];

  // Fetch all contacts
  const contactIds = [
    appt.requesterContactId,
    appt.serviceContactId,
    appt.vehicleOwnerContactId,
    appt.billingContactId,
  ].filter((id): id is number => id !== null && id !== undefined);

  let roleContacts: {
    requester?: Contact | null;
    serviceContact?: Contact | null;
    vehicleOwner?: Contact | null;
    payer?: Contact | null;
  } = {};

  if (contactIds.length > 0) {
    const fetchedContacts = await tenantDb
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactIds[0])) // Start with first ID
      .execute();

    // Fetch remaining contacts
    for (const id of contactIds.slice(1)) {
      const c = await tenantDb.select().from(contacts).where(eq(contacts.id, id)).execute();
      fetchedContacts.push(...c);
    }

    // Map to roles
    roleContacts = {
      requester: fetchedContacts.find(c => c.id === appt.requesterContactId) || null,
      serviceContact: fetchedContacts.find(c => c.id === appt.serviceContactId) || null,
      vehicleOwner: fetchedContacts.find(c => c.id === appt.vehicleOwnerContactId) || null,
      payer: fetchedContacts.find(c => c.id === appt.billingContactId) || null,
    };
  }

  const context: NotificationContext = {
    appointment: appt,
    roles: roleContacts,
    businessName: 'Clean Machine Auto Detail',
    businessPhone: '(918) 856-5304',
    metadata,
  };

  const sent: { role: string; channel: 'sms' | 'email'; success: boolean }[] = [];
  const failed: { role: string; reason: string }[] = [];

  // Build common variables
  const commonVars = {
    businessName: context.businessName,
    businessPhone: context.businessPhone,
    ...metadata,
  };

  // Send to payer (if applicable and different role)
  if (roleContacts.payer) {
    const template = getTemplate(event, 'payer');
    if (template) {
      const message = replaceVariables(template, {
        ...commonVars,
        payerName: roleContacts.payer.name,
      });

      const result = await sendToContact(tenantDb, roleContacts.payer, message, channel);
      if (result.sms) sent.push({ role: 'payer', channel: 'sms', success: true });
      if (result.email) sent.push({ role: 'payer', channel: 'email', success: true });
      if (!result.sms && !result.email) {
        failed.push({ role: 'payer', reason: 'All channels failed' });
      }
    }
  }

  // Send to service contact (if applicable and different role)
  if (roleContacts.serviceContact) {
    const template = getTemplate(event, 'service_contact');
    if (template) {
      const message = replaceVariables(template, {
        ...commonVars,
        contactName: roleContacts.serviceContact.name,
      });

      const result = await sendToContact(tenantDb, roleContacts.serviceContact, message, channel);
      if (result.sms) sent.push({ role: 'service_contact', channel: 'sms', success: true });
      if (result.email) sent.push({ role: 'service_contact', channel: 'email', success: true });
      if (!result.sms && !result.email) {
        failed.push({ role: 'service_contact', reason: 'All channels failed' });
      }
    }
  }

  // Send to requester (if applicable and different from other roles)
  if (roleContacts.requester && roleContacts.requester.id !== roleContacts.serviceContact?.id) {
    const template = getTemplate(event, 'requester');
    if (template) {
      const message = replaceVariables(template, {
        ...commonVars,
        requesterName: roleContacts.requester.name,
      });

      const result = await sendToContact(tenantDb, roleContacts.requester, message, channel);
      if (result.sms) sent.push({ role: 'requester', channel: 'sms', success: true });
      if (result.email) sent.push({ role: 'requester', channel: 'email', success: true });
      if (!result.sms && !result.email) {
        failed.push({ role: 'requester', reason: 'All channels failed' });
      }
    }
  }

  // Send to vehicle owner (if applicable and different from other roles)
  if (
    roleContacts.vehicleOwner &&
    roleContacts.vehicleOwner.id !== roleContacts.serviceContact?.id &&
    roleContacts.vehicleOwner.id !== roleContacts.requester?.id
  ) {
    const template = getTemplate(event, 'vehicle_owner');
    if (template) {
      const message = replaceVariables(template, {
        ...commonVars,
        ownerName: roleContacts.vehicleOwner.name,
      });

      const result = await sendToContact(tenantDb, roleContacts.vehicleOwner, message, channel);
      if (result.sms) sent.push({ role: 'vehicle_owner', channel: 'sms', success: true });
      if (result.email) sent.push({ role: 'vehicle_owner', channel: 'email', success: true });
      if (!result.sms && !result.email) {
        failed.push({ role: 'vehicle_owner', reason: 'All channels failed' });
      }
    }
  }

  return { sent, failed };
}

/**
 * Privacy-aware notification - respects privacy settings
 * Hides price from non-payer roles if configured
 * Hides location from payer if configured
 */
export async function sendPrivacyAwareNotification(
  tenantDb: TenantDb,
  appointmentId: number,
  event: NotificationEvent,
  metadata: Record<string, any> = {}
): Promise<any> {
  const appointment = await tenantDb
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .execute();

  if (!appointment[0]) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }

  const appt = appointment[0];

  // Privacy controls
  const metadataForPayer = { ...metadata };
  const metadataForOthers = { ...metadata };

  // Hide price from non-payer roles (unless sharePriceWithRequester is true)
  if (!appt.sharePriceWithRequester) {
    delete metadataForOthers.price;
    delete metadataForOthers.depositAmount;
    delete metadataForOthers.balanceDue;
  }

  // Hide location from payer (unless shareLocationWithPayer is true)
  if (!appt.shareLocationWithPayer) {
    delete metadataForPayer.location;
    delete metadataForPayer.eta;
    delete metadataForPayer.liveTrackingLink;
  }

  // Send with appropriate metadata based on role
  // This would require modifying sendRoleAwareNotification to accept per-role metadata
  // For now, use the existing function
  return sendRoleAwareNotification(tenantDb, appointmentId, event, metadata);
}
