import { sendSMS } from './notifications';

interface HandoffNotificationConfig {
  businessPhone: string; // Your personal phone number
  enabled: boolean;
  notifyOnHandoff: boolean;
  notifyOnReturn: boolean;
  includeMessagePreview: boolean;
}

// Default configuration - can be made dynamic later via settings
const config: HandoffNotificationConfig = {
  businessPhone: process.env.BUSINESS_OWNER_PHONE || '',
  enabled: true,
  notifyOnHandoff: true,
  notifyOnReturn: true,
  includeMessagePreview: true,
};

export function setBusinessPhone(phone: string) {
  config.businessPhone = phone;
}

export function getBusinessPhone(): string {
  return config.businessPhone;
}

export function setNotificationConfig(newConfig: Partial<HandoffNotificationConfig>) {
  Object.assign(config, newConfig);
}

export function getNotificationConfig(): HandoffNotificationConfig {
  return { ...config };
}

export async function notifyHandoffRequest(
  conversationId: number,
  customerName: string | null,
  customerPhone: string,
  reason: string,
  lastCustomerMessage?: string
): Promise<void> {
  if (!config.enabled || !config.notifyOnHandoff || !config.businessPhone) {
    console.log('[SMS NOTIFY] Handoff notification disabled or no business phone configured');
    return;
  }

  try {
    const customerDisplay = customerName || customerPhone;
    const messagePreview = config.includeMessagePreview && lastCustomerMessage
      ? `\n\n"${lastCustomerMessage.substring(0, 100)}${lastCustomerMessage.length > 100 ? '...' : ''}"`
      : '';

    // Generate a link to the messages page (you can customize the domain)
    const messagesLink = `${process.env.REPLIT_DOMAIN || 'https://yourapp.replit.app'}/messages?conversation=${conversationId}`;

    const notificationMessage = `🔔 ${customerDisplay} needs help

Reason: ${reason}${messagePreview}

View conversation: ${messagesLink}`;

    await sendSMS(config.businessPhone, notificationMessage);
    console.log(`[SMS NOTIFY] Handoff notification sent for conversation ${conversationId}`);
  } catch (error) {
    console.error('[SMS NOTIFY] Failed to send handoff notification:', error);
  }
}

export async function notifyReturnToAI(
  conversationId: number,
  customerName: string | null,
  customerPhone: string,
  agentName?: string
): Promise<void> {
  if (!config.enabled || !config.notifyOnReturn || !config.businessPhone) {
    console.log('[SMS NOTIFY] Return-to-AI notification disabled or no business phone configured');
    return;
  }

  try {
    const customerDisplay = customerName || customerPhone;
    const agent = agentName || 'Agent';

    const notificationMessage = `✅ Conversation with ${customerDisplay} returned to AI

${agent} completed the handoff. AI is now handling this customer.`;

    await sendSMS(config.businessPhone, notificationMessage);
    console.log(`[SMS NOTIFY] Return-to-AI notification sent for conversation ${conversationId}`);
  } catch (error) {
    console.error('[SMS NOTIFY] Failed to send return-to-AI notification:', error);
  }
}

export async function notifyTimeout(
  conversationId: number,
  customerName: string | null,
  customerPhone: string
): Promise<void> {
  if (!config.enabled || !config.businessPhone) {
    console.log('[SMS NOTIFY] Timeout notification disabled or no business phone configured');
    return;
  }

  try {
    const customerDisplay = customerName || customerPhone;

    const notificationMessage = `⏰ Conversation with ${customerDisplay} auto-returned to AI

No customer response for 12 hours. Conversation is back in AI mode.`;

    await sendSMS(config.businessPhone, notificationMessage);
    console.log(`[SMS NOTIFY] Timeout notification sent for conversation ${conversationId}`);
  } catch (error) {
    console.error('[SMS NOTIFY] Failed to send timeout notification:', error);
  }
}
