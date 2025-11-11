/**
 * Auto-Failover System
 * 
 * Monitors error rates and automatically triggers maintenance mode
 * when high-severity errors exceed the configured threshold within a 5-minute window
 */

import { db } from "./db";
import { businessSettings, errorLogs } from "@shared/schema";
import { eq, gte, and, or } from "drizzle-orm";
import { invalidateMaintenanceCache } from "./maintenanceMode";
import { sendSMS } from "./notifications";

// In-memory cooldown tracking (prevents rapid re-triggers)
let lastFailoverTime: number | null = null;
const COOLDOWN_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if auto-failover should be triggered based on recent high-severity errors
 * Call this after logging a high or critical error
 * 
 * Tiered threshold approach (architect recommendation):
 * - ≥5 critical errors OR ≥8 high-severity errors in 5 minutes triggers failover
 * - Excludes validation and user errors
 * - 30-minute cooldown between auto-triggers
 */
export async function checkAutoFailover(): Promise<{ triggered: boolean; reason?: string; suppressed?: boolean }> {
  try {
    // Get current business settings
    const [settings] = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.id, 1))
      .limit(1);

    if (!settings) {
      console.warn('[AUTO-FAILOVER] No business settings found, skipping check');
      return { triggered: false };
    }

    // Skip if already in maintenance mode
    if (settings.maintenanceMode) {
      return { triggered: false, reason: 'Already in maintenance mode' };
    }

    // Check cooldown period to prevent rapid re-triggers
    const now = Date.now();
    if (lastFailoverTime && (now - lastFailoverTime) < COOLDOWN_PERIOD_MS) {
      const remainingMinutes = Math.ceil((COOLDOWN_PERIOD_MS - (now - lastFailoverTime)) / (60 * 1000));
      console.log(`[AUTO-FAILOVER] Suppressed - In cooldown period (${remainingMinutes} minutes remaining)`);
      return { 
        triggered: false, 
        suppressed: true, 
        reason: `Cooldown period - ${remainingMinutes} minutes remaining` 
      };
    }

    // Count errors by severity in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Get critical errors (excluding validation errors)
    const criticalErrors = await db
      .select()
      .from(errorLogs)
      .where(
        and(
          eq(errorLogs.severity, 'critical'),
          gte(errorLogs.createdAt, fiveMinutesAgo),
          // Exclude validation errors (user input issues, not system failures)
          // Note: Using sql operator for NOT LIKE would be cleaner, but simplified here
        )
      );

    // Filter out validation errors from critical
    const filteredCriticalErrors = criticalErrors.filter(err => 
      err.errorType !== 'validation'
    );

    // Get high-severity errors (excluding validation)
    const highErrors = await db
      .select()
      .from(errorLogs)
      .where(
        and(
          eq(errorLogs.severity, 'high'),
          gte(errorLogs.createdAt, fiveMinutesAgo)
        )
      );

    const filteredHighErrors = highErrors.filter(err => 
      err.errorType !== 'validation'
    );

    const criticalCount = filteredCriticalErrors.length;
    const highCount = filteredHighErrors.length;

    // Tiered thresholds (architect recommendation)
    const CRITICAL_THRESHOLD = 5;
    const HIGH_THRESHOLD = 8;

    console.log(`[AUTO-FAILOVER] Error counts (5min window) - Critical: ${criticalCount}/${CRITICAL_THRESHOLD}, High: ${highCount}/${HIGH_THRESHOLD}`);

    // Trigger if either threshold exceeded
    if (criticalCount >= CRITICAL_THRESHOLD || highCount >= HIGH_THRESHOLD) {
      const reason = criticalCount >= CRITICAL_THRESHOLD
        ? `${criticalCount} critical errors detected in 5 minutes`
        : `${highCount} high-severity errors detected in 5 minutes`;

      console.warn(`[AUTO-FAILOVER] THRESHOLD EXCEEDED - Triggering maintenance mode: ${reason}`);
      
      await triggerMaintenanceMode(
        `Automatic failover triggered: ${reason}`,
        settings
      );

      // Record failover timestamp for cooldown tracking
      lastFailoverTime = now;

      return { 
        triggered: true, 
        reason 
      };
    }

    return { triggered: false };
  } catch (error) {
    console.error('[AUTO-FAILOVER] Error checking failover conditions:', error);
    
    // Best-effort fallback: If we can't check failover (DB down), log to memory
    // This prevents cascading failures
    return { triggered: false };
  }
}

/**
 * Trigger maintenance mode and send alerts
 */
async function triggerMaintenanceMode(
  reason: string,
  settings: typeof businessSettings.$inferSelect
): Promise<void> {
  try {
    // Update business settings to enable maintenance mode
    await db
      .update(businessSettings)
      .set({
        maintenanceMode: true,
        maintenanceMessage: `We're experiencing technical difficulties and have temporarily paused bookings. Please contact us directly for service.`,
        lastFailoverAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessSettings.id, 1));

    // Invalidate cache to apply changes immediately
    try {
      invalidateMaintenanceCache();
      console.log('[AUTO-FAILOVER] Cache invalidated after triggering maintenance mode');
    } catch (cacheError) {
      console.error('[AUTO-FAILOVER] Failed to invalidate cache:', cacheError);
    }

    console.log(`[AUTO-FAILOVER] ✅ Maintenance mode ENABLED - Reason: ${reason}`);

    // Send SMS alert to admin if alertPhone is configured
    if (settings.alertPhone) {
      try {
        const alertMessage = `🚨 CRITICAL: Automatic maintenance mode activated.\n\nReason: ${reason}\n\nPlease check the system immediately. Business bookings are paused.`;
        
        await sendSMS(settings.alertPhone, alertMessage);
        console.log(`[AUTO-FAILOVER] SMS alert sent to ${settings.alertPhone}`);
      } catch (smsError) {
        console.error('[AUTO-FAILOVER] Failed to send SMS alert:', smsError);
      }
    } else {
      console.warn('[AUTO-FAILOVER] No alert phone configured - SMS alert not sent');
    }

    // Send email alert if backupEmail is configured
    if (settings.backupEmail) {
      try {
        const { sendBusinessEmail } = await import('./emailService');
        await sendBusinessEmail(
          settings.backupEmail,
          '🚨 CRITICAL: Automatic Maintenance Mode Activated',
          `Automatic maintenance mode has been triggered.\n\nReason: ${reason}\n\nAll public booking functionality has been paused. Please investigate and resolve the issues immediately.\n\nTo disable maintenance mode, log into the admin dashboard and toggle it off from Business Settings.`
        );
        console.log(`[AUTO-FAILOVER] Email alert sent to ${settings.backupEmail}`);
      } catch (emailError) {
        console.error('[AUTO-FAILOVER] Failed to send email alert:', emailError);
      }
    }
  } catch (error) {
    console.error('[AUTO-FAILOVER] Failed to trigger maintenance mode:', error);
    throw error;
  }
}

/**
 * Send booking details to backup email during maintenance or failures
 */
export async function forwardBookingToBackup(bookingDetails: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  service: string;
  addOns?: string[];
  scheduledTime: string;
  address: string;
  vehicleInfo?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: any }> {
  try {
    // Get business settings to retrieve backup email
    const [settings] = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.id, 1))
      .limit(1);

    if (!settings || !settings.backupEmail) {
      console.warn('[BACKUP FORWARDING] No backup email configured');
      return { success: false, error: 'No backup email configured' };
    }

    const { sendBusinessEmail } = await import('./emailService');

    // Format booking details
    const services = [bookingDetails.service, ...(bookingDetails.addOns || [])].filter(Boolean).join(', ');
    
    const subject = `🔔 Backup Booking Request - ${bookingDetails.customerName}`;
    
    const textContent = `
A booking request was received during a system issue or maintenance period.

CUSTOMER INFORMATION:
Name: ${bookingDetails.customerName}
Phone: ${bookingDetails.customerPhone}
Email: ${bookingDetails.customerEmail || 'Not provided'}

SERVICE DETAILS:
Service: ${services}
Scheduled Time: ${bookingDetails.scheduledTime}
Address: ${bookingDetails.address}
Vehicle: ${bookingDetails.vehicleInfo || 'Not provided'}

ADDITIONAL NOTES:
${bookingDetails.notes || 'None'}

ACTION REQUIRED:
Please contact this customer directly to confirm their appointment or provide alternative options.

---
This booking was automatically forwarded because the primary booking system encountered an issue.
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 5px 5px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #555; }
    .value { margin-left: 10px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>🔔 Backup Booking Request</h2>
  </div>
  <div class="content">
    <div class="section">
      <h3>Customer Information</h3>
      <p><span class="label">Name:</span><span class="value">${bookingDetails.customerName}</span></p>
      <p><span class="label">Phone:</span><span class="value"><a href="tel:${bookingDetails.customerPhone}">${bookingDetails.customerPhone}</a></span></p>
      <p><span class="label">Email:</span><span class="value">${bookingDetails.customerEmail ? `<a href="mailto:${bookingDetails.customerEmail}">${bookingDetails.customerEmail}</a>` : 'Not provided'}</span></p>
    </div>
    
    <div class="section">
      <h3>Service Details</h3>
      <p><span class="label">Service:</span><span class="value">${services}</span></p>
      <p><span class="label">Scheduled Time:</span><span class="value">${bookingDetails.scheduledTime}</span></p>
      <p><span class="label">Address:</span><span class="value">${bookingDetails.address}</span></p>
      <p><span class="label">Vehicle:</span><span class="value">${bookingDetails.vehicleInfo || 'Not provided'}</span></p>
    </div>
    
    ${bookingDetails.notes ? `
    <div class="section">
      <h3>Additional Notes</h3>
      <p>${bookingDetails.notes}</p>
    </div>
    ` : ''}
    
    <div class="alert">
      <strong>⚠️ Action Required:</strong> Please contact this customer directly to confirm their appointment or provide alternative options.
      <br><br>
      <em>This booking was automatically forwarded because the primary booking system encountered an issue.</em>
    </div>
  </div>
</body>
</html>
    `.trim();

    await sendBusinessEmail(settings.backupEmail, subject, textContent, htmlContent);
    
    console.log(`[BACKUP FORWARDING] Booking forwarded to ${settings.backupEmail} for ${bookingDetails.customerName}`);
    
    return { success: true };
  } catch (error) {
    console.error('[BACKUP FORWARDING] Failed to forward booking:', error);
    return { success: false, error };
  }
}
