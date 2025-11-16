import { db } from './db';
import { notificationPreferences } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function shouldSendNotification(
  userId: number,
  type: 'voicemailSms' | 'voicemailPush' | 'cashPaymentSms' | 'cashPaymentPush' | 'systemErrorSms' | 'systemErrorPush' | 'missedCallSms' | 'appointmentReminderPush'
): Promise<boolean> {
  const prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId)
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
