import type { TenantDb } from './tenantDb';
import { notificationPreferences } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function shouldSendNotification(
  tenantDb: TenantDb,
  userId: number,
  type: 'voicemailSms' | 'voicemailPush' | 'cashPaymentSms' | 'cashPaymentPush' | 'systemErrorSms' | 'systemErrorPush' | 'missedCallSms' | 'appointmentReminderPush'
): Promise<boolean> {
  const prefs = await tenantDb.query.notificationPreferences.findFirst({
    where: tenantDb.withTenantFilter(notificationPreferences, eq(notificationPreferences.userId, userId))
  });

  if (!prefs) {
    // Defaults if not set
    const defaults = {
      voicemailSms: true,
      voicemailPush: true,
      cashPaymentSms: true,
      cashPaymentPush: true,
      systemErrorSms: true,
      systemErrorPush: true,
      missedCallSms: false,
      appointmentReminderPush: true
    };
    return defaults[type];
  }

  return prefs[type];
}
