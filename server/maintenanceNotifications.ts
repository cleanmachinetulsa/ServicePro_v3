/**
 * Maintenance Mode Notifications
 * 
 * Centralized notification helpers for maintenance mode events
 * Sends SMS, email, and push notifications to admin users
 */

import { sendSMS } from './notifications';
import { sendPushNotification } from './pushNotificationService';
import { renderBrandedEmail, renderBrandedEmailPlainText } from './emailTemplates/base';
import type { EmailData } from './emailTemplates/base';
import { db } from './db';
import { users, pushSubscriptions, businessSettings } from '@shared/schema';
import { inArray, eq } from 'drizzle-orm';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * Send notifications when maintenance mode is ENABLED
 * Sends SMS, branded email, and push notifications to admins
 */
export async function sendMaintenanceEnabledNotifications(
  settings: typeof businessSettings.$inferSelect,
  reason: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    console.log('[MAINTENANCE NOTIFICATIONS] Sending maintenance mode ENABLED notifications');
    console.log(`[MAINTENANCE NOTIFICATIONS] Reason: ${reason}`);

    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'America/Chicago'
    });

    // 1. Send SMS Alert
    if (settings.alertPhone) {
      try {
        const smsMessage = `🚨 CRITICAL ALERT: Maintenance Mode Activated\n\nReason: ${reason}\n\nTime: ${timestamp}\n\nAll public booking functionality has been paused. Please check the admin dashboard immediately.`;
        
        if (DEMO_MODE) {
          console.log('[DEMO MODE] SMS would be sent:', smsMessage);
        } else {
          await sendSMS(settings.alertPhone, smsMessage);
          console.log(`[MAINTENANCE NOTIFICATIONS] ✅ SMS alert sent to ${settings.alertPhone}`);
        }
      } catch (error) {
        const errorMsg = `Failed to send SMS alert: ${error}`;
        console.error(`[MAINTENANCE NOTIFICATIONS] ${errorMsg}`);
        errors.push(errorMsg);
      }
    } else {
      console.log('[MAINTENANCE NOTIFICATIONS] No alert phone configured - SMS skipped');
    }

    // 2. Send Branded Email Alert
    if (settings.backupEmail) {
      try {
        const emailData: EmailData = {
          preheader: `Maintenance mode has been activated: ${reason}`,
          subject: '🚨 CRITICAL: Maintenance Mode Activated',
          hero: {
            title: '🚨 Maintenance Mode Activated',
            subtitle: 'Critical System Alert'
          },
          sections: [
            {
              type: 'text',
              content: '<p style="font-size: 16px; margin-bottom: 20px; color: #dc2626; font-weight: bold;">The system has been placed in maintenance mode. All public booking functionality is currently paused.</p>'
            },
            {
              type: 'table',
              items: [
                { label: 'Status', value: '🔴 MAINTENANCE MODE ACTIVE' },
                { label: 'Reason', value: reason },
                { label: 'Activated At', value: timestamp },
                { label: 'Impact', value: 'Public bookings paused' }
              ]
            },
            {
              type: 'spacer',
              padding: '20px'
            },
            {
              type: 'highlight',
              content: '<strong>⚠️ Action Required</strong><br><br>Please investigate the issue that triggered maintenance mode. Check the admin dashboard and system logs for details.'
            },
            {
              type: 'spacer',
              padding: '20px'
            },
            {
              type: 'text',
              content: `
                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                  <h3 style="color: #92400e; margin-top: 0; font-size: 18px; font-weight: bold;">What This Means</h3>
                  <ul style="margin: 10px 0; padding-left: 20px; color: #1f2937;">
                    <li style="margin-bottom: 8px;">Existing appointments remain scheduled</li>
                    <li style="margin-bottom: 8px;">No new bookings can be made through the public website</li>
                    <li style="margin-bottom: 8px;">Customers see a maintenance message instead of booking form</li>
                    <li style="margin-bottom: 8px;">Manual bookings via admin dashboard still work</li>
                  </ul>
                </div>
              `
            }
          ],
          ctas: [
            {
              text: 'View Admin Dashboard',
              url: `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.repl.co'}/dashboard`,
              style: 'primary'
            },
            {
              text: 'Check System Monitor',
              url: `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.repl.co'}/monitor`,
              style: 'secondary'
            }
          ],
          notes: 'To disable maintenance mode, log into the admin dashboard and toggle it off from Business Settings or the Maintenance page.'
        };

        const htmlContent = renderBrandedEmail(emailData);
        const textContent = renderBrandedEmailPlainText(emailData);

        const { sendBusinessEmail } = await import('./emailService');
        
        if (DEMO_MODE) {
          console.log('[DEMO MODE] Email would be sent to:', settings.backupEmail);
          console.log('[DEMO MODE] Subject:', emailData.subject);
        } else {
          const result = await sendBusinessEmail(
            settings.backupEmail,
            emailData.subject,
            textContent,
            htmlContent
          );
          
          if (result.success) {
            console.log(`[MAINTENANCE NOTIFICATIONS] ✅ Email alert sent to ${settings.backupEmail}`);
          } else {
            throw new Error(result.error || 'Email send failed');
          }
        }
      } catch (error) {
        const errorMsg = `Failed to send email alert: ${error}`;
        console.error(`[MAINTENANCE NOTIFICATIONS] ${errorMsg}`);
        errors.push(errorMsg);
      }
    } else {
      console.log('[MAINTENANCE NOTIFICATIONS] No backup email configured - Email skipped');
    }

    // 3. Send Push Notifications to Admin Users
    try {
      const adminUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
        .where(inArray(users.role, ['owner', 'manager']))
        .groupBy(users.id, users.role);

      if (adminUsers.length > 0) {
        console.log(`[MAINTENANCE NOTIFICATIONS] Sending push notifications to ${adminUsers.length} admin users`);

        const pushPayload = {
          title: '🚨 Maintenance Mode Activated',
          body: `${reason}. All public bookings are paused. Check the dashboard immediately.`,
          icon: '/icon-512.png',
          badge: '/icon-192.png',
          tag: 'maintenance-alert',
          requireInteraction: true,
          data: {
            type: 'maintenance_enabled',
            reason: reason,
            url: '/maintenance',
          },
        };

        for (const user of adminUsers) {
          try {
            if (DEMO_MODE) {
              console.log(`[DEMO MODE] Push notification would be sent to user ${user.id} (${user.role})`);
            } else {
              await sendPushNotification(user.id, pushPayload);
              console.log(`[MAINTENANCE NOTIFICATIONS] ✅ Push notification sent to user ${user.id} (${user.role})`);
            }
          } catch (error) {
            console.error(`[MAINTENANCE NOTIFICATIONS] Failed to send push to user ${user.id}:`, error);
          }
        }
      } else {
        console.log('[MAINTENANCE NOTIFICATIONS] No admin users with push subscriptions found');
      }
    } catch (error) {
      const errorMsg = `Failed to send push notifications: ${error}`;
      console.error(`[MAINTENANCE NOTIFICATIONS] ${errorMsg}`);
      errors.push(errorMsg);
    }

    const success = errors.length === 0;
    console.log(`[MAINTENANCE NOTIFICATIONS] Maintenance ENABLED notifications complete - Success: ${success}, Errors: ${errors.length}`);
    
    return { success, errors };
  } catch (error) {
    console.error('[MAINTENANCE NOTIFICATIONS] Unexpected error sending notifications:', error);
    return { success: false, errors: [`Unexpected error: ${error}`] };
  }
}

/**
 * Send notifications when maintenance mode is DISABLED (recovery)
 * Sends SMS, branded email, and push notifications to admins
 */
export async function sendMaintenanceDisabledNotifications(
  settings: typeof businessSettings.$inferSelect
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    console.log('[MAINTENANCE NOTIFICATIONS] Sending maintenance mode DISABLED notifications');

    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'America/Chicago'
    });

    // Calculate duration if we have lastFailoverAt
    let duration = 'Unknown';
    if (settings.lastFailoverAt) {
      const durationMs = Date.now() - new Date(settings.lastFailoverAt).getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        duration = `${hours}h ${minutes}m`;
      } else {
        duration = `${minutes}m`;
      }
    }

    // 1. Send SMS Recovery Message
    if (settings.alertPhone) {
      try {
        const smsMessage = `✅ RECOVERY: Maintenance Mode Disabled\n\nTime: ${timestamp}\n\nThe system is now accepting public bookings again. All services have been restored.`;
        
        if (DEMO_MODE) {
          console.log('[DEMO MODE] SMS would be sent:', smsMessage);
        } else {
          await sendSMS(settings.alertPhone, smsMessage);
          console.log(`[MAINTENANCE NOTIFICATIONS] ✅ SMS recovery sent to ${settings.alertPhone}`);
        }
      } catch (error) {
        const errorMsg = `Failed to send SMS recovery: ${error}`;
        console.error(`[MAINTENANCE NOTIFICATIONS] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // 2. Send Branded Email Recovery
    if (settings.backupEmail) {
      try {
        const emailData: EmailData = {
          preheader: 'Maintenance mode has been disabled - system is operational',
          subject: '✅ Maintenance Mode Disabled - System Restored',
          hero: {
            title: '✅ System Restored',
            subtitle: 'Maintenance Mode Disabled'
          },
          sections: [
            {
              type: 'text',
              content: '<p style="font-size: 16px; margin-bottom: 20px; color: #059669; font-weight: bold;">Maintenance mode has been disabled. The system is now fully operational and accepting public bookings.</p>'
            },
            {
              type: 'table',
              items: [
                { label: 'Status', value: '🟢 OPERATIONAL' },
                { label: 'Restored At', value: timestamp },
                { label: 'Maintenance Duration', value: duration },
                { label: 'Public Bookings', value: 'Enabled' }
              ]
            },
            {
              type: 'spacer',
              padding: '20px'
            },
            {
              type: 'text',
              content: `
                <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                  <h3 style="color: #065f46; margin-top: 0; font-size: 18px; font-weight: bold;">✅ Services Restored</h3>
                  <ul style="margin: 10px 0; padding-left: 20px; color: #1f2937;">
                    <li style="margin-bottom: 8px;">Public booking form is now accepting new appointments</li>
                    <li style="margin-bottom: 8px;">All automated notifications are active</li>
                    <li style="margin-bottom: 8px;">Customer-facing features are operational</li>
                    <li style="margin-bottom: 8px;">System monitoring is active</li>
                  </ul>
                </div>
              `
            }
          ],
          ctas: [
            {
              text: 'View Dashboard',
              url: `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.repl.co'}/dashboard`,
              style: 'primary'
            }
          ],
          notes: 'If you notice any issues, you can re-enable maintenance mode from the admin dashboard at any time.'
        };

        const htmlContent = renderBrandedEmail(emailData);
        const textContent = renderBrandedEmailPlainText(emailData);

        const { sendBusinessEmail } = await import('./emailService');
        
        if (DEMO_MODE) {
          console.log('[DEMO MODE] Email would be sent to:', settings.backupEmail);
          console.log('[DEMO MODE] Subject:', emailData.subject);
        } else {
          const result = await sendBusinessEmail(
            settings.backupEmail,
            emailData.subject,
            textContent,
            htmlContent
          );
          
          if (result.success) {
            console.log(`[MAINTENANCE NOTIFICATIONS] ✅ Email recovery sent to ${settings.backupEmail}`);
          } else {
            throw new Error(result.error || 'Email send failed');
          }
        }
      } catch (error) {
        const errorMsg = `Failed to send email recovery: ${error}`;
        console.error(`[MAINTENANCE NOTIFICATIONS] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // 3. Send Push Notifications to Admin Users
    try {
      const adminUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
        .where(inArray(users.role, ['owner', 'manager']))
        .groupBy(users.id, users.role);

      if (adminUsers.length > 0) {
        console.log(`[MAINTENANCE NOTIFICATIONS] Sending recovery push notifications to ${adminUsers.length} admin users`);

        const pushPayload = {
          title: '✅ System Restored',
          body: 'Maintenance mode disabled. Public bookings are now active.',
          icon: '/icon-512.png',
          badge: '/icon-192.png',
          tag: 'maintenance-recovery',
          requireInteraction: false,
          data: {
            type: 'maintenance_disabled',
            url: '/dashboard',
          },
        };

        for (const user of adminUsers) {
          try {
            if (DEMO_MODE) {
              console.log(`[DEMO MODE] Push notification would be sent to user ${user.id} (${user.role})`);
            } else {
              await sendPushNotification(user.id, pushPayload);
              console.log(`[MAINTENANCE NOTIFICATIONS] ✅ Push notification sent to user ${user.id} (${user.role})`);
            }
          } catch (error) {
            console.error(`[MAINTENANCE NOTIFICATIONS] Failed to send push to user ${user.id}:`, error);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Failed to send push notifications: ${error}`;
      console.error(`[MAINTENANCE NOTIFICATIONS] ${errorMsg}`);
      errors.push(errorMsg);
    }

    const success = errors.length === 0;
    console.log(`[MAINTENANCE NOTIFICATIONS] Maintenance DISABLED notifications complete - Success: ${success}, Errors: ${errors.length}`);
    
    return { success, errors };
  } catch (error) {
    console.error('[MAINTENANCE NOTIFICATIONS] Unexpected error sending notifications:', error);
    return { success: false, errors: [`Unexpected error: ${error}`] };
  }
}
