import { db } from './db';
import { conversations, messages, tenantConfig } from '@shared/schema';
import { eq, and, gte, sql, isNull } from 'drizzle-orm';

interface UnansweredConversation {
  conversationId: number;
  tenantId: string;
  customerIdentifier: string;
  lastCustomerMessage: string;
  messageTimestamp: Date;
  customerMessageCount: number;
}

/**
 * Monitor for unanswered web chat messages across all tenants
 * Detects conversations where customer sent message but AI/agent never responded
 */
export class UnansweredMessageMonitor {
  private lastCheckTime: Date = new Date(0);
  private readonly CHECK_WINDOW_MINUTES = 60; // Look back 60 minutes for unanswered messages
  private readonly GRACE_PERIOD_MINUTES = 2; // Wait 2 minutes before alerting (give AI time to respond)
  private notifiedConversations: Set<number> = new Set(); // Track which conversations we've already alerted about

  /**
   * Find web chat conversations with unanswered customer messages
   */
  async findUnansweredConversations(): Promise<UnansweredConversation[]> {
    const now = new Date();
    const checkWindowStart = new Date(now.getTime() - this.CHECK_WINDOW_MINUTES * 60 * 1000);
    const gracePeriodEnd = new Date(now.getTime() - this.GRACE_PERIOD_MINUTES * 60 * 1000);

    try {
      // Find web chat conversations with recent customer messages
      const unansweredQuery = await db.execute(sql`
        WITH recent_customer_messages AS (
          SELECT 
            c.id AS conversation_id,
            c.tenant_id,
            c.customer_phone AS customer_identifier,
            MAX(m.timestamp) AS last_customer_message_time,
            COUNT(*) AS customer_message_count
          FROM conversations c
          INNER JOIN messages m ON c.id = m.conversation_id
          WHERE 
            c.platform = 'web'
            AND m.sender = 'customer'
            AND m.timestamp >= ${checkWindowStart.toISOString()}
            AND m.timestamp <= ${gracePeriodEnd.toISOString()}
          GROUP BY c.id, c.tenant_id, c.customer_phone
        ),
        response_check AS (
          SELECT 
            rcm.conversation_id,
            rcm.tenant_id,
            rcm.customer_identifier,
            rcm.last_customer_message_time,
            rcm.customer_message_count,
            COUNT(m_response.id) AS response_count
          FROM recent_customer_messages rcm
          LEFT JOIN messages m_response ON 
            rcm.conversation_id = m_response.conversation_id
            AND m_response.sender IN ('ai', 'agent')
            AND m_response.timestamp > rcm.last_customer_message_time
          GROUP BY 
            rcm.conversation_id, 
            rcm.tenant_id, 
            rcm.customer_identifier,
            rcm.last_customer_message_time,
            rcm.customer_message_count
        )
        SELECT 
          rc.conversation_id,
          rc.tenant_id,
          rc.customer_identifier,
          rc.last_customer_message_time,
          rc.customer_message_count,
          m.content AS last_customer_message
        FROM response_check rc
        INNER JOIN messages m ON 
          rc.conversation_id = m.conversation_id
          AND m.timestamp = rc.last_customer_message_time
          AND m.sender = 'customer'
        WHERE rc.response_count = 0
        ORDER BY rc.last_customer_message_time DESC
      `);

      const unanswered: UnansweredConversation[] = (unansweredQuery.rows as any[]).map(row => ({
        conversationId: row.conversation_id,
        tenantId: row.tenant_id,
        customerIdentifier: row.customer_identifier,
        lastCustomerMessage: row.last_customer_message,
        messageTimestamp: new Date(row.last_customer_message_time),
        customerMessageCount: parseInt(row.customer_message_count)
      }));

      // Filter out conversations we've already notified about
      const newUnanswered = unanswered.filter(conv => 
        !this.notifiedConversations.has(conv.conversationId)
      );

      // Mark these as notified
      newUnanswered.forEach(conv => 
        this.notifiedConversations.add(conv.conversationId)
      );

      // Clean up old notifications (keep last 1000)
      if (this.notifiedConversations.size > 1000) {
        const sorted = Array.from(this.notifiedConversations);
        this.notifiedConversations = new Set(sorted.slice(-1000));
      }

      return newUnanswered;

    } catch (error) {
      console.error('[UNANSWERED MONITOR] Error finding unanswered conversations:', error);
      return [];
    }
  }

  /**
   * Send alert via email (SendGrid)
   */
  async sendEmailAlert(
    tenantId: string,
    unanswered: UnansweredConversation[]
  ): Promise<void> {
    if (unanswered.length === 0) return;

    try {
      const sgMail = (await import('@sendgrid/mail')).default;
      const apiKey = process.env.SENDGRID_API_KEY;

      if (!apiKey) {
        console.warn('[UNANSWERED MONITOR] SendGrid API key not configured, skipping email alert');
        return;
      }

      sgMail.setApiKey(apiKey);

      // Get tenant info for recipient email
      const tenant = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      if (!tenant.length || !tenant[0].ownerEmail) {
        console.warn(`[UNANSWERED MONITOR] No owner email configured for tenant ${tenantId}`);
        return;
      }

      const emailHtml = `
        <h2>⚠️ Unanswered Web Chat Messages</h2>
        <p>You have ${unanswered.length} unanswered web chat message(s):</p>
        <ul>
          ${unanswered.map(conv => `
            <li>
              <strong>Time:</strong> ${conv.messageTimestamp.toLocaleString()}<br>
              <strong>Message:</strong> "${conv.lastCustomerMessage}"<br>
              <strong>Conversation ID:</strong> ${conv.conversationId}<br>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/admin/conversations?id=${conv.conversationId}">View Conversation →</a>
            </li>
          `).join('')}
        </ul>
        <p>Please respond to these customers as soon as possible!</p>
      `;

      await sgMail.send({
        to: tenant[0].ownerEmail,
        from: process.env.SENDGRID_FROM_EMAIL || 'alerts@cleanmachinetulsa.com',
        subject: `⚠️ ${unanswered.length} Unanswered Web Chat Message(s) - ${tenant[0].businessName}`,
        html: emailHtml
      });

      console.log(`[UNANSWERED MONITOR] Email alert sent to ${tenant[0].ownerEmail} for ${unanswered.length} unanswered messages`);

    } catch (error) {
      console.error('[UNANSWERED MONITOR] Error sending email alert:', error);
    }
  }

  /**
   * Send alert via SMS (Twilio)
   */
  async sendSMSAlert(
    tenantId: string,
    unanswered: UnansweredConversation[]
  ): Promise<void> {
    if (unanswered.length === 0) return;

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.MAIN_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        console.warn('[UNANSWERED MONITOR] Twilio credentials not configured, skipping SMS alert');
        return;
      }

      // Get tenant info for recipient phone
      const tenant = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      if (!tenant.length || !tenant[0].ownerPhone) {
        console.warn(`[UNANSWERED MONITOR] No owner phone configured for tenant ${tenantId}`);
        return;
      }

      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      const smsBody = `⚠️ ${unanswered.length} unanswered web chat message(s) from ${tenant[0].businessName}. Latest: "${unanswered[0].lastCustomerMessage.substring(0, 100)}..." - Check admin dashboard to respond.`;

      await client.messages.create({
        body: smsBody,
        from: fromNumber,
        to: tenant[0].ownerPhone
      });

      console.log(`[UNANSWERED MONITOR] SMS alert sent to ${tenant[0].ownerPhone} for ${unanswered.length} unanswered messages`);

    } catch (error) {
      console.error('[UNANSWERED MONITOR] Error sending SMS alert:', error);
    }
  }

  /**
   * Send alert via Slack
   */
  async sendSlackAlert(
    tenantId: string,
    unanswered: UnansweredConversation[]
  ): Promise<void> {
    if (unanswered.length === 0) return;

    try {
      const slackToken = process.env.SLACK_BOT_TOKEN;
      const slackChannel = process.env.SLACK_ALERT_CHANNEL || '#alerts';

      if (!slackToken) {
        console.warn('[UNANSWERED MONITOR] Slack token not configured, skipping Slack alert');
        return;
      }

      // Get tenant info
      const tenant = await db
        .select()
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, tenantId))
        .limit(1);

      if (!tenant.length) {
        console.warn(`[UNANSWERED MONITOR] Tenant ${tenantId} not found`);
        return;
      }

      const { WebClient } = await import('@slack/web-api');
      const slack = new WebClient(slackToken);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `⚠️ ${unanswered.length} Unanswered Web Chat Message(s)`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Business:* ${tenant[0].businessName}\n*Tenant ID:* ${tenantId}`
          }
        },
        {
          type: 'divider'
        },
        ...unanswered.slice(0, 5).map(conv => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${conv.messageTimestamp.toLocaleTimeString()}* - "${conv.lastCustomerMessage}"\n<${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/admin/conversations?id=${conv.conversationId}|View Conversation →>`
          }
        }))
      ];

      if (unanswered.length > 5) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `_...and ${unanswered.length - 5} more unanswered messages_`
          }]
        });
      }

      await slack.chat.postMessage({
        channel: slackChannel,
        text: `⚠️ ${unanswered.length} Unanswered Web Chat Message(s) for ${tenant[0].businessName}`,
        blocks: blocks as any
      });

      console.log(`[UNANSWERED MONITOR] Slack alert sent to ${slackChannel} for ${unanswered.length} unanswered messages`);

    } catch (error) {
      console.error('[UNANSWERED MONITOR] Error sending Slack alert:', error);
    }
  }

  /**
   * Run the monitoring check and send alerts
   */
  async checkAndAlert(): Promise<void> {
    try {
      console.log('[UNANSWERED MONITOR] Starting check for unanswered messages...');

      const unanswered = await this.findUnansweredConversations();

      if (unanswered.length === 0) {
        console.log('[UNANSWERED MONITOR] No unanswered messages found');
        return;
      }

      console.log(`[UNANSWERED MONITOR] Found ${unanswered.length} unanswered message(s)`);

      // Group by tenant
      const byTenant = unanswered.reduce((acc, conv) => {
        if (!acc[conv.tenantId]) {
          acc[conv.tenantId] = [];
        }
        acc[conv.tenantId].push(conv);
        return acc;
      }, {} as Record<string, UnansweredConversation[]>);

      // Send alerts for each tenant
      for (const [tenantId, tenantUnanswered] of Object.entries(byTenant)) {
        console.log(`[UNANSWERED MONITOR] Sending alerts for tenant ${tenantId}: ${tenantUnanswered.length} unanswered messages`);
        
        // Send all three types of alerts in parallel
        await Promise.all([
          this.sendEmailAlert(tenantId, tenantUnanswered),
          this.sendSMSAlert(tenantId, tenantUnanswered),
          this.sendSlackAlert(tenantId, tenantUnanswered)
        ]);
      }

      this.lastCheckTime = new Date();

    } catch (error) {
      console.error('[UNANSWERED MONITOR] Error during check and alert:', error);
    }
  }
}

// Export singleton instance
export const unansweredMonitor = new UnansweredMessageMonitor();
