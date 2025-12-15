/**
 * PWA Notification Decision Service
 * Handles quiet hours, digest mode, and notification type filtering
 */

import { db } from '../db';
import { pwaNotificationSettings, notificationEventLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { wrapTenantDb } from '../tenantDb';

export type NotificationType = 
  | 'booking_failed'
  | 'needs_human'
  | 'new_lead'
  | 'booking_confirmed'
  | 'after_hours_reply'
  | 'daily_digest'
  | 'test';

export type NotificationChannel = 'push' | 'sms' | 'email';
export type NotificationStatus = 'sent' | 'failed' | 'queued' | 'suppressed';

interface NotificationDecision {
  shouldSend: boolean;
  channels: NotificationChannel[];
  suppressionReason?: string;
}

interface SettingsCache {
  settings: any;
  loadedAt: number;
}

const settingsCache = new Map<string, SettingsCache>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get tenant's PWA notification settings (cached)
 */
export async function getNotificationSettings(tenantId: string = 'root') {
  const cached = settingsCache.get(tenantId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.settings;
  }

  const tenantDb = wrapTenantDb(db, tenantId);
  const [settings] = await tenantDb
    .select()
    .from(pwaNotificationSettings)
    .where(eq(pwaNotificationSettings.tenantId, tenantId))
    .limit(1);

  if (settings) {
    settingsCache.set(tenantId, { settings, loadedAt: Date.now() });
  }
  
  return settings || null;
}

/**
 * Check if current time is within quiet hours
 */
export function isInQuietHours(
  quietHoursStart: string,
  quietHoursEnd: string,
  timezone: string = 'America/Chicago'
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (error) {
    console.error('[PWA DECISION] Error checking quiet hours:', error);
    return false;
  }
}

/**
 * Check if a specific notification type is enabled
 */
function isNotificationTypeEnabled(settings: any, type: NotificationType): boolean {
  switch (type) {
    case 'booking_failed':
      return settings?.notifyBookingFailed ?? true;
    case 'needs_human':
      return settings?.notifyNeedsHuman ?? true;
    case 'new_lead':
      return settings?.notifyNewLead ?? true;
    case 'booking_confirmed':
      return settings?.notifyBookingConfirmed ?? false;
    case 'after_hours_reply':
      return settings?.notifyAfterHoursReply ?? true;
    case 'daily_digest':
      return settings?.notifyDailyDigest ?? false;
    case 'test':
      return true;
    default:
      return true;
  }
}

/**
 * Get enabled channels from settings
 */
function getEnabledChannels(settings: any): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (settings?.channelPush ?? true) channels.push('push');
  if (settings?.channelSms ?? true) channels.push('sms');
  if (settings?.channelEmail ?? false) channels.push('email');
  return channels;
}

/**
 * Determine if a notification should be sent and via which channels
 */
export async function shouldSendNotification(
  tenantId: string,
  notificationType: NotificationType,
  timezone: string = 'America/Chicago'
): Promise<NotificationDecision> {
  const settings = await getNotificationSettings(tenantId);

  // No settings = use defaults (send via all channels)
  if (!settings) {
    return {
      shouldSend: true,
      channels: ['push', 'sms'],
    };
  }

  // Check if notification type is enabled
  if (!isNotificationTypeEnabled(settings, notificationType)) {
    return {
      shouldSend: false,
      channels: [],
      suppressionReason: `Notification type '${notificationType}' is disabled`,
    };
  }

  // Check quiet hours
  if (settings.quietHoursEnabled) {
    const inQuietHours = isInQuietHours(
      settings.quietHoursStart || '22:00',
      settings.quietHoursEnd || '07:00',
      timezone
    );

    if (inQuietHours) {
      // Check if this notification type overrides quiet hours
      const overridesQuietHours = 
        (notificationType === 'needs_human' && settings.quietHoursOverrideNeedsHuman) ||
        (notificationType === 'after_hours_reply' && settings.notifyAfterHoursReply);

      if (!overridesQuietHours) {
        return {
          shouldSend: false,
          channels: [],
          suppressionReason: 'Suppressed due to quiet hours',
        };
      }
    }
  }

  // Get enabled channels
  const channels = getEnabledChannels(settings);

  if (channels.length === 0) {
    return {
      shouldSend: false,
      channels: [],
      suppressionReason: 'No notification channels enabled',
    };
  }

  return {
    shouldSend: true,
    channels,
  };
}

/**
 * Log a notification event to the database
 */
export async function logNotificationEvent(
  tenantId: string,
  type: NotificationType,
  channel: NotificationChannel,
  status: NotificationStatus,
  target?: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const tenantDb = wrapTenantDb(db, tenantId);
    await tenantDb.insert(notificationEventLogs).values({
      tenantId,
      type,
      channel,
      status,
      target,
      error,
      metadata,
    });
    console.log(`[PWA DECISION] Logged ${status} ${channel} notification: ${type}`);
  } catch (err) {
    console.error('[PWA DECISION] Failed to log notification event:', err);
  }
}

/**
 * Clear settings cache for a tenant (call after settings update)
 */
export function clearSettingsCache(tenantId: string): void {
  settingsCache.delete(tenantId);
}
