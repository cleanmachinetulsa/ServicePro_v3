/**
 * Critical Integration Monitoring & Alerting System
 * Monitors calendar, payments, SMS, email and sends multi-channel alerts on failures
 */

import { sendSMS } from './notifications';
import { sendPushNotification } from './pushNotificationService';
import { db } from './db';
import { criticalMonitoringSettings, users, pushSubscriptions } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

interface IntegrationHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: Date;
  lastError?: string;
  consecutiveFailures: number;
}

interface AlertConfig {
  alertChannels: { sms: boolean; push: boolean; email: boolean };
  smsRecipients: string[];
  emailRecipients: string[];
  pushRoles: string[];
  failureThreshold: number;
  cooldownMinutes: number;
}

class CriticalMonitor {
  private integrations: Map<string, IntegrationHealth> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  private config: AlertConfig;

  constructor() {
    // Default fallback config using env vars
    this.config = {
      alertChannels: { sms: true, push: true, email: false },
      smsRecipients: process.env.BUSINESS_PHONE_NUMBER ? [process.env.BUSINESS_PHONE_NUMBER] : [],
      emailRecipients: [],
      pushRoles: ['owner', 'manager'],
      failureThreshold: 3,
      cooldownMinutes: 30,
    };

    // Load settings from database
    this.loadSettings().catch(err => {
      console.error('[CRITICAL MONITOR] Failed to load settings from DB, using defaults:', err);
    });

    console.log('[CRITICAL MONITOR] Initialized with default config');
  }

  /**
   * Load settings from database, fallback to env vars
   */
  async loadSettings() {
    try {
      const [settings] = await db.select().from(criticalMonitoringSettings).limit(1);

      if (settings) {
        this.config = {
          alertChannels: settings.alertChannels,
          smsRecipients: settings.smsRecipients,
          emailRecipients: settings.emailRecipients,
          pushRoles: settings.pushRoles,
          failureThreshold: settings.failureThreshold,
          cooldownMinutes: settings.cooldownMinutes,
        };
        console.log('[CRITICAL MONITOR] Loaded settings from database', {
          channels: settings.alertChannels,
          smsCount: settings.smsRecipients.length,
          emailCount: settings.emailRecipients.length,
          pushRoles: settings.pushRoles,
        });
      } else {
        console.log('[CRITICAL MONITOR] No settings found in DB, using defaults');
      }
    } catch (error) {
      console.error('[CRITICAL MONITOR] Error loading settings:', error);
    }
  }

  /**
   * Report successful operation for an integration
   */
  reportSuccess(integrationName: string) {
    const health = this.integrations.get(integrationName) || this.createHealthRecord(integrationName);
    
    const wasFailedBefore = health.status === 'failed';
    health.status = 'healthy';
    health.lastCheck = new Date();
    health.consecutiveFailures = 0;
    health.lastError = undefined;
    
    this.integrations.set(integrationName, health);

    // Send recovery notification if it was previously failed
    if (wasFailedBefore && this.config.enabled) {
      this.sendRecoveryAlert(integrationName);
    }
  }

  /**
   * Report failure for an integration
   */
  async reportFailure(integrationName: string, error: string) {
    const health = this.integrations.get(integrationName) || this.createHealthRecord(integrationName);
    
    health.status = 'failed';
    health.lastCheck = new Date();
    health.lastError = error;
    health.consecutiveFailures++;
    
    this.integrations.set(integrationName, health);

    console.error(`[CRITICAL MONITOR] 🚨 ${integrationName} FAILURE #${health.consecutiveFailures}:`, error);

    // Send alert if threshold reached and not in cooldown
    if (health.consecutiveFailures >= this.config.failureThreshold) {
      await this.sendFailureAlert(integrationName, health);
    }
  }

  /**
   * Send multi-channel alert for critical failure
   */
  private async sendFailureAlert(integrationName: string, health: IntegrationHealth) {
    const lastAlert = this.lastAlertTime.get(integrationName);
    const now = new Date();

    // Check cooldown period
    if (lastAlert) {
      const minutesSinceLastAlert = (now.getTime() - lastAlert.getTime()) / 1000 / 60;
      if (minutesSinceLastAlert < this.config.cooldownMinutes) {
        console.log(`[CRITICAL MONITOR] Skipping alert for ${integrationName} - in cooldown (${minutesSinceLastAlert.toFixed(0)}m/${this.config.cooldownMinutes}m)`);
        return;
      }
    }

    const message = `🚨 CRITICAL ALERT: ${integrationName} has failed ${health.consecutiveFailures} times!\n\nLast error: ${health.lastError?.substring(0, 100)}\n\nAction required immediately. Check your Replit dashboard.`;

    let alertsSent = 0;

    // Send SMS alerts
    if (this.config.alertChannels.sms && this.config.smsRecipients.length > 0) {
      await this.sendSmsAlerts(this.config.smsRecipients, message);
      alertsSent++;
    }

    // Send push notifications
    if (this.config.alertChannels.push && this.config.pushRoles.length > 0) {
      await this.sendPushAlerts(integrationName, health);
      alertsSent++;
    }

    // Send email alerts (stub for future)
    if (this.config.alertChannels.email && this.config.emailRecipients.length > 0) {
      await this.sendEmailAlerts(this.config.emailRecipients, integrationName, health);
      alertsSent++;
    }

    if (alertsSent > 0) {
      this.lastAlertTime.set(integrationName, now);
      console.log(`[CRITICAL MONITOR] ✅ Alerts sent via ${alertsSent} channels`);
    } else {
      console.warn('[CRITICAL MONITOR] No alert channels configured or enabled');
    }
  }

  /**
   * Send SMS alerts to all recipients
   */
  private async sendSmsAlerts(recipients: string[], message: string) {
    console.log(`[CRITICAL MONITOR] 📱 Sending SMS alerts to ${recipients.length} recipients`);
    
    for (const phone of recipients) {
      try {
        await sendSMS(phone, message);
        console.log(`[CRITICAL MONITOR] ✅ SMS sent to ${phone.slice(-4)}`);
      } catch (error) {
        console.error(`[CRITICAL MONITOR] ❌ Failed to send SMS to ${phone.slice(-4)}:`, error);
      }
    }
  }

  /**
   * Send push notifications to users with specified roles
   */
  private async sendPushAlerts(integrationName: string, health: IntegrationHealth) {
    try {
      // Find users with push subscriptions and matching roles
      const usersWithPush = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
        .where(inArray(users.role, this.config.pushRoles))
        .groupBy(users.id);

      if (usersWithPush.length === 0) {
        console.log('[CRITICAL MONITOR] No users with push subscriptions found for roles:', this.config.pushRoles);
        return;
      }

      console.log(`[CRITICAL MONITOR] 🔔 Sending push notifications to ${usersWithPush.length} users`);

      const payload = {
        title: '🚨 Critical System Alert',
        body: `${integrationName} has failed ${health.consecutiveFailures} times. Immediate action required.`,
        icon: '/icon-512.png',
        badge: '/icon-192.png',
        tag: 'critical-alert',
        requireInteraction: true,
        data: {
          type: 'critical_alert',
          integration: integrationName,
          error: health.lastError,
          url: '/monitor',
        },
      };

      for (const user of usersWithPush) {
        try {
          await sendPushNotification(user.id, payload);
          console.log(`[CRITICAL MONITOR] ✅ Push notification sent to user ${user.id}`);
        } catch (error) {
          console.error(`[CRITICAL MONITOR] ❌ Failed to send push to user ${user.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[CRITICAL MONITOR] Error sending push notifications:', error);
    }
  }

  /**
   * Send email alerts using branded template system
   */
  private async sendEmailAlerts(recipients: string[], integrationName: string, health: IntegrationHealth) {
    console.log(`[CRITICAL MONITOR] 📧 Sending critical alert emails to ${recipients.length} recipients`);
    
    // Import email functions dynamically
    const { sendBusinessEmail } = await import('./emailService');
    const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
    
    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'America/Chicago'
    });
    
    // Build alert details table
    const alertDetails: Array<{ label: string; value: string }> = [
      { label: 'Integration', value: integrationName },
      { label: 'Status', value: '🔴 FAILED' },
      { label: 'Consecutive Failures', value: health.consecutiveFailures.toString() },
      { label: 'Threshold', value: `${this.config.failureThreshold} failures` },
      { label: 'Timestamp', value: timestamp }
    ];
    
    if (health.lastError) {
      alertDetails.push({
        label: 'Last Error',
        value: health.lastError.substring(0, 200) + (health.lastError.length > 200 ? '...' : '')
      });
    }
    
    // Create email data using branded template
    const emailData: any = {
      preheader: `CRITICAL: ${integrationName} has failed ${health.consecutiveFailures} times. Immediate action required.`,
      subject: `🚨 CRITICAL ALERT: ${integrationName} System Failure`,
      hero: {
        title: '🚨 Critical System Failure',
        subtitle: `${integrationName} requires immediate attention`
      },
      sections: [
        {
          type: 'text',
          content: `
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
              <h3 style="color: #991b1b; margin-top: 0; font-size: 18px; font-weight: bold;">⚠️ Urgent Action Required</h3>
              <p style="margin: 10px 0; color: #1f2937; font-size: 16px;">
                The <strong>${integrationName}</strong> integration has failed <strong>${health.consecutiveFailures} consecutive times</strong>, 
                exceeding the critical threshold of ${this.config.failureThreshold} failures.
              </p>
              <p style="margin: 10px 0; color: #1f2937;">
                This may be affecting customer experience and business operations. Please investigate and resolve immediately.
              </p>
            </div>
          `
        },
        {
          type: 'spacer',
          padding: '10px'
        },
        {
          type: 'text',
          content: '<h3 style="color: #1f2937; font-size: 18px; margin-bottom: 10px;">📊 Failure Details</h3>'
        },
        {
          type: 'table',
          items: alertDetails
        },
        {
          type: 'spacer',
          padding: '20px'
        },
        {
          type: 'highlight',
          content: `
            <strong>🔍 Recommended Actions:</strong><br><br>
            1. Check the monitoring dashboard for real-time status<br>
            2. Review system logs for detailed error messages<br>
            3. Verify API credentials and service connectivity<br>
            4. Test the integration manually if possible<br>
            5. Contact support if the issue persists
          `
        },
        {
          type: 'spacer',
          padding: '20px'
        },
        {
          type: 'text',
          content: `
            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0; font-size: 16px; font-weight: bold;">📝 Alert Information</h3>
              <p style="margin: 5px 0; color: #1f2937; font-size: 14px;">
                <strong>Cooldown Period:</strong> ${this.config.cooldownMinutes} minutes between alerts
              </p>
              <p style="margin: 5px 0; color: #1f2937; font-size: 14px;">
                <strong>Alert Channels:</strong> ${Object.entries(this.config.alertChannels).filter(([_, enabled]) => enabled).map(([channel]) => channel.toUpperCase()).join(', ')}
              </p>
              <p style="margin: 5px 0; color: #1f2937; font-size: 14px;">
                You will receive recovery notification once the system is back online.
              </p>
            </div>
          `
        }
      ],
      ctas: [
        {
          text: 'View Monitor Dashboard',
          url: `${process.env.VITE_DEPLOYMENT_URL || 'http://localhost:5000'}/monitor`,
          style: 'primary'
        },
        {
          text: 'Check System Logs',
          url: `${process.env.VITE_DEPLOYMENT_URL || 'http://localhost:5000'}/monitor`,
          style: 'secondary'
        }
      ],
      notes: 'This is an automated critical alert from your Clean Machine monitoring system. Please do not reply to this email. Take action immediately to resolve the system failure.'
    };
    
    // Render HTML and plain text versions
    const htmlContent = renderBrandedEmail(emailData);
    const textContent = renderBrandedEmailPlainText(emailData);
    const subject = `🚨 CRITICAL ALERT: ${integrationName} System Failure`;
    
    // Send to all recipients
    for (const recipient of recipients) {
      try {
        const result = await sendBusinessEmail(recipient, subject, textContent, htmlContent);
        
        if (result.success) {
          console.log(`[CRITICAL MONITOR] ✅ Critical alert email sent to ${recipient}`);
        } else {
          console.error(`[CRITICAL MONITOR] ❌ Failed to send email to ${recipient}:`, result.error);
        }
      } catch (error) {
        console.error(`[CRITICAL MONITOR] ❌ Exception sending email to ${recipient}:`, error);
      }
    }
  }

  /**
   * Send multi-channel recovery notification
   */
  private async sendRecoveryAlert(integrationName: string) {
    const message = `✅ RECOVERY: ${integrationName} is now working normally.`;

    // Send SMS recovery alerts
    if (this.config.alertChannels.sms && this.config.smsRecipients.length > 0) {
      await this.sendSmsAlerts(this.config.smsRecipients, message);
    }

    // Send push recovery notifications
    if (this.config.alertChannels.push && this.config.pushRoles.length > 0) {
      try {
        const usersWithPush = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
          .where(inArray(users.role, this.config.pushRoles))
          .groupBy(users.id);

        for (const user of usersWithPush) {
          await sendPushNotification(user.id, {
            title: '✅ System Recovered',
            body: `${integrationName} is now working normally.`,
            icon: '/icon-512.png',
            tag: 'recovery-alert',
            data: { type: 'recovery_alert', integration: integrationName },
          });
        }
      } catch (error) {
        console.error('[CRITICAL MONITOR] Error sending recovery push notifications:', error);
      }
    }

    // Send email recovery notifications
    if (this.config.alertChannels.email && this.config.emailRecipients.length > 0) {
      await this.sendEmailRecoveryAlerts(this.config.emailRecipients, integrationName);
    }
  }

  /**
   * Send email recovery notifications using branded template system
   */
  private async sendEmailRecoveryAlerts(recipients: string[], integrationName: string) {
    console.log(`[CRITICAL MONITOR] 📧 Sending recovery notification emails to ${recipients.length} recipients`);
    
    // Import email functions dynamically
    const { sendBusinessEmail } = await import('./emailService');
    const { renderBrandedEmail, renderBrandedEmailPlainText } = await import('./emailTemplates/base');
    
    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'America/Chicago'
    });
    
    // Build recovery details table
    const recoveryDetails: Array<{ label: string; value: string }> = [
      { label: 'Integration', value: integrationName },
      { label: 'Status', value: '✅ RECOVERED' },
      { label: 'Recovery Time', value: timestamp }
    ];
    
    // Create email data using branded template
    const emailData: any = {
      preheader: `Good news! ${integrationName} has recovered and is now working normally.`,
      subject: `✅ RECOVERY: ${integrationName} System Restored`,
      hero: {
        title: '✅ System Recovered',
        subtitle: `${integrationName} is now working normally`
      },
      sections: [
        {
          type: 'text',
          content: `
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
              <h3 style="color: #065f46; margin-top: 0; font-size: 18px; font-weight: bold;">✅ System Back Online</h3>
              <p style="margin: 10px 0; color: #1f2937; font-size: 16px;">
                Good news! The <strong>${integrationName}</strong> integration has recovered and is now functioning normally.
              </p>
              <p style="margin: 10px 0; color: #1f2937;">
                Normal operations have resumed. You can continue to monitor the system for stability.
              </p>
            </div>
          `
        },
        {
          type: 'spacer',
          padding: '10px'
        },
        {
          type: 'text',
          content: '<h3 style="color: #1f2937; font-size: 18px; margin-bottom: 10px;">📊 Recovery Details</h3>'
        },
        {
          type: 'table',
          items: recoveryDetails
        },
        {
          type: 'spacer',
          padding: '20px'
        },
        {
          type: 'highlight',
          content: `
            <strong>📝 Next Steps:</strong><br><br>
            1. Continue monitoring the dashboard for system stability<br>
            2. Review logs to identify the root cause of the failure<br>
            3. Consider implementing preventive measures if applicable<br>
            4. Document any lessons learned for future reference
          `
        },
        {
          type: 'spacer',
          padding: '20px'
        },
        {
          type: 'text',
          content: `
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
              <h3 style="color: #1e40af; margin-top: 0; font-size: 16px; font-weight: bold;">ℹ️ Monitoring Information</h3>
              <p style="margin: 5px 0; color: #1f2937; font-size: 14px;">
                The system is now being continuously monitored. You'll receive another alert if issues recur.
              </p>
              <p style="margin: 5px 0; color: #1f2937; font-size: 14px;">
                <strong>Alert Threshold:</strong> ${this.config.failureThreshold} consecutive failures
              </p>
            </div>
          `
        }
      ],
      ctas: [
        {
          text: 'View Monitor Dashboard',
          url: `${process.env.VITE_DEPLOYMENT_URL || 'http://localhost:5000'}/monitor`,
          style: 'primary'
        }
      ],
      notes: 'This is an automated recovery notification from your Clean Machine monitoring system. The integration is now functioning normally.'
    };
    
    // Render HTML and plain text versions
    const htmlContent = renderBrandedEmail(emailData);
    const textContent = renderBrandedEmailPlainText(emailData);
    const subject = `✅ RECOVERY: ${integrationName} System Restored`;
    
    // Send to all recipients
    for (const recipient of recipients) {
      try {
        const result = await sendBusinessEmail(recipient, subject, textContent, htmlContent);
        
        if (result.success) {
          console.log(`[CRITICAL MONITOR] ✅ Recovery notification email sent to ${recipient}`);
        } else {
          console.error(`[CRITICAL MONITOR] ❌ Failed to send recovery email to ${recipient}:`, result.error);
        }
      } catch (error) {
        console.error(`[CRITICAL MONITOR] ❌ Exception sending recovery email to ${recipient}:`, error);
      }
    }
  }

  /**
   * Get health status for all integrations
   */
  getHealthStatus() {
    const status: Record<string, any> = {};
    this.integrations.forEach((health, name) => {
      status[name] = {
        status: health.status,
        lastCheck: health.lastCheck.toISOString(),
        consecutiveFailures: health.consecutiveFailures,
        lastError: health.lastError,
      };
    });
    return status;
  }

  /**
   * Create initial health record
   */
  private createHealthRecord(name: string): IntegrationHealth {
    return {
      name,
      status: 'healthy',
      lastCheck: new Date(),
      consecutiveFailures: 0,
    };
  }
}

export const criticalMonitor = new CriticalMonitor();
