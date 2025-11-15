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
   * Send email alerts (stub for future implementation)
   */
  private async sendEmailAlerts(recipients: string[], integrationName: string, health: IntegrationHealth) {
    console.log(`[CRITICAL MONITOR] 📧 Email alerts to ${recipients.length} recipients (not yet implemented)`);
    // TODO: Implement email sending when needed
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
