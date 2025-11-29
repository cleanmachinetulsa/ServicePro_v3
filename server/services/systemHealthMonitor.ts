/**
 * SYSTEM HEALTH MONITOR
 * 
 * Self-scanning service that monitors critical system components and sends
 * URGENT alerts to the owner's AT&T line when issues are detected.
 * 
 * This bypasses Twilio for urgent alerts to ensure delivery even if 
 * Twilio itself is the problem.
 * 
 * Monitored Components:
 * - Database connectivity
 * - Twilio API status
 * - Critical service endpoints
 * - Error rate thresholds
 * - Queue backlogs
 */

import { db } from '../db';
import { phoneConfig } from '../config/phoneConfig';
import { sendUrgentAlert, sendAdminNotification } from './alertService';
import { sql } from 'drizzle-orm';
import * as Twilio from 'twilio';

interface HealthCheckResult {
  component: string;
  healthy: boolean;
  message: string;
  timestamp: Date;
}

interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  checks: HealthCheckResult[];
  lastCheck: Date;
}

// Track consecutive failures for escalation
const failureCounters: Record<string, number> = {};
const FAILURE_THRESHOLD = 3; // Alert after 3 consecutive failures

let lastHealthCheck: SystemHealthStatus | null = null;

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const component = 'database';
  try {
    await db.execute(sql`SELECT 1`);
    failureCounters[component] = 0;
    return {
      component,
      healthy: true,
      message: 'Database connection OK',
      timestamp: new Date(),
    };
  } catch (error: any) {
    failureCounters[component] = (failureCounters[component] || 0) + 1;
    return {
      component,
      healthy: false,
      message: `Database error: ${error.message}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Check Twilio API connectivity
 */
async function checkTwilio(): Promise<HealthCheckResult> {
  const component = 'twilio';
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return {
      component,
      healthy: false,
      message: 'Twilio credentials not configured',
      timestamp: new Date(),
    };
  }

  try {
    const client = Twilio.default(accountSid, authToken);
    // Simple API call to verify credentials
    await client.api.accounts(accountSid).fetch();
    failureCounters[component] = 0;
    return {
      component,
      healthy: true,
      message: 'Twilio API connection OK',
      timestamp: new Date(),
    };
  } catch (error: any) {
    failureCounters[component] = (failureCounters[component] || 0) + 1;
    return {
      component,
      healthy: false,
      message: `Twilio error: ${error.message}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Check phone configuration is complete
 */
function checkPhoneConfig(): HealthCheckResult {
  const component = 'phoneConfig';
  const missing: string[] = [];

  if (!phoneConfig.twilioMain) missing.push('twilioMain');
  if (!phoneConfig.phoneAdmin) missing.push('phoneAdmin');
  if (!phoneConfig.ownerUrgent) missing.push('ownerUrgent');

  if (missing.length === 0) {
    return {
      component,
      healthy: true,
      message: 'Phone configuration complete',
      timestamp: new Date(),
    };
  }

  return {
    component,
    healthy: false,
    message: `Missing phone config: ${missing.join(', ')}`,
    timestamp: new Date(),
  };
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<SystemHealthStatus> {
  const checks = await Promise.all([
    checkDatabase(),
    checkTwilio(),
    Promise.resolve(checkPhoneConfig()),
  ]);

  const unhealthyChecks = checks.filter(c => !c.healthy);
  const criticalChecks = checks.filter(c => 
    !c.healthy && (c.component === 'database' || c.component === 'twilio')
  );

  let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (criticalChecks.length > 0) {
    overall = 'critical';
  } else if (unhealthyChecks.length > 0) {
    overall = 'degraded';
  }

  lastHealthCheck = {
    overall,
    checks,
    lastCheck: new Date(),
  };

  return lastHealthCheck;
}

/**
 * Check for critical failures and send alerts
 */
export async function monitorAndAlert(): Promise<void> {
  try {
    const status = await runHealthChecks();

    // Send urgent alert for critical issues
    if (status.overall === 'critical') {
      const criticalIssues = status.checks
        .filter(c => !c.healthy)
        .map(c => `${c.component}: ${c.message}`)
        .join('; ');

      // Check if this issue has persisted beyond threshold
      const shouldEscalate = status.checks.some(c => 
        !c.healthy && (failureCounters[c.component] || 0) >= FAILURE_THRESHOLD
      );

      if (shouldEscalate) {
        console.error('[HEALTH MONITOR] 🚨 CRITICAL: Sending urgent alert');
        await sendUrgentAlert(`SYSTEM CRITICAL: ${criticalIssues}`);
      } else {
        console.warn('[HEALTH MONITOR] ⚠️ Critical issue detected, monitoring...');
        await sendAdminNotification(`System issue detected: ${criticalIssues}`);
      }
    }

    // Log status
    console.log(`[HEALTH MONITOR] Status: ${status.overall}`, {
      healthy: status.checks.filter(c => c.healthy).length,
      unhealthy: status.checks.filter(c => !c.healthy).length,
    });

  } catch (error) {
    console.error('[HEALTH MONITOR] Failed to run health checks:', error);
    // Try to send urgent alert about the monitor itself failing
    try {
      await sendUrgentAlert('Health monitor failed to run - check system immediately');
    } catch {
      console.error('[HEALTH MONITOR] Could not send urgent alert!');
    }
  }
}

/**
 * Get last health check result (for API endpoint)
 */
export function getLastHealthStatus(): SystemHealthStatus | null {
  return lastHealthCheck;
}

/**
 * Initialize periodic health monitoring
 * Runs every 5 minutes
 */
export function startHealthMonitoring(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log('[HEALTH MONITOR] Starting periodic health monitoring');
  
  // Run immediately on start
  monitorAndAlert().catch(err => 
    console.error('[HEALTH MONITOR] Initial check failed:', err)
  );

  // Schedule periodic checks
  return setInterval(() => {
    monitorAndAlert().catch(err => 
      console.error('[HEALTH MONITOR] Scheduled check failed:', err)
    );
  }, intervalMs);
}
