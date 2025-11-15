/**
 * Critical Integration Monitoring & Alerting System
 * Monitors calendar, payments, SMS, email and sends urgent SMS alerts on failures
 */

import { sendSMS } from './notifications';

interface IntegrationHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: Date;
  lastError?: string;
  consecutiveFailures: number;
}

interface AlertConfig {
  enabled: boolean;
  ownerPhone: string;
  failureThreshold: number; // Number of consecutive failures before alerting
  cooldownMinutes: number; // Minutes between repeat alerts
}

class CriticalMonitor {
  private integrations: Map<string, IntegrationHealth> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  private config: AlertConfig;

  constructor() {
    this.config = {
      enabled: !!process.env.BUSINESS_PHONE_NUMBER,
      ownerPhone: process.env.BUSINESS_PHONE_NUMBER || '',
      failureThreshold: 3,
      cooldownMinutes: 30,
    };

    console.log('[CRITICAL MONITOR] Initialized', {
      enabled: this.config.enabled,
      ownerPhone: this.config.ownerPhone ? '***' + this.config.ownerPhone.slice(-4) : 'not set',
      failureThreshold: this.config.failureThreshold,
    });
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
   * Send urgent SMS alert for critical failure
   */
  private async sendFailureAlert(integrationName: string, health: IntegrationHealth) {
    if (!this.config.enabled) {
      console.warn('[CRITICAL MONITOR] Alerts disabled - BUSINESS_PHONE_NUMBER not set');
      return;
    }

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

    try {
      console.log(`[CRITICAL MONITOR] 📱 Sending urgent SMS alert to ${this.config.ownerPhone}`);
      await sendSMS(this.config.ownerPhone, message);
      this.lastAlertTime.set(integrationName, now);
      console.log(`[CRITICAL MONITOR] ✅ Alert sent successfully`);
    } catch (smsError) {
      console.error(`[CRITICAL MONITOR] ❌ Failed to send SMS alert:`, smsError);
    }
  }

  /**
   * Send recovery notification
   */
  private async sendRecoveryAlert(integrationName: string) {
    if (!this.config.enabled) return;

    const message = `✅ RECOVERY: ${integrationName} is now working normally.`;

    try {
      console.log(`[CRITICAL MONITOR] 📱 Sending recovery notification to ${this.config.ownerPhone}`);
      await sendSMS(this.config.ownerPhone, message);
      console.log(`[CRITICAL MONITOR] ✅ Recovery notification sent`);
    } catch (smsError) {
      console.error(`[CRITICAL MONITOR] ❌ Failed to send recovery notification:`, smsError);
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
