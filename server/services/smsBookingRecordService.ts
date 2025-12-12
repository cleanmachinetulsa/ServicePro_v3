import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { smsBookingRecords } from '@shared/schema';
import type { SmsBookingRecord, InsertSmsBookingRecord } from '@shared/schema';
import { eq, and, gt, isNull, lte, or, sql } from 'drizzle-orm';

/**
 * SMS Booking Record Service
 * Manages the confirmation workflow for far-future bookings (up to 90 days)
 */

export async function createSmsBookingRecord(
  tenantId: string,
  record: Omit<InsertSmsBookingRecord, 'tenantId'>
): Promise<SmsBookingRecord> {
  const tenantDb = wrapTenantDb(db, tenantId);
  
  const [created] = await tenantDb
    .insert(smsBookingRecords)
    .values({
      ...record,
      tenantId,
    })
    .returning();
  
  console.log(`[CONFIRM] Created booking record phone=${record.phone} eventId=${record.eventId} needsConfirmation=${record.needsConfirmation}`);
  return created;
}

export async function findUpcomingUnconfirmedBooking(
  tenantId: string,
  phone: string
): Promise<SmsBookingRecord | null> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  const records = await tenantDb
    .select()
    .from(smsBookingRecords)
    .where(
      and(
        eq(smsBookingRecords.tenantId, tenantId),
        eq(smsBookingRecords.phone, phone),
        eq(smsBookingRecords.needsConfirmation, true),
        isNull(smsBookingRecords.confirmedAt),
        isNull(smsBookingRecords.autoCanceledAt),
        gt(smsBookingRecords.startTime, now),
        lte(smsBookingRecords.startTime, ninetyDaysOut)
      )
    )
    .orderBy(smsBookingRecords.startTime)
    .limit(1);
  
  return records[0] || null;
}

export async function confirmBooking(
  tenantId: string,
  recordId: number
): Promise<SmsBookingRecord | null> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const now = new Date();
  
  const [updated] = await tenantDb
    .update(smsBookingRecords)
    .set({
      confirmedAt: now,
      needsConfirmation: false,
    })
    .where(
      and(
        eq(smsBookingRecords.id, recordId),
        eq(smsBookingRecords.tenantId, tenantId)
      )
    )
    .returning();
  
  if (updated) {
    console.log(`[CONFIRM] phone=${updated.phone} eventId=${updated.eventId} confirmedAt=${now.toISOString()}`);
  }
  
  return updated || null;
}

export async function markRescheduleRequested(
  tenantId: string,
  recordId: number
): Promise<SmsBookingRecord | null> {
  const tenantDb = wrapTenantDb(db, tenantId);
  
  const [updated] = await tenantDb
    .update(smsBookingRecords)
    .set({
      rescheduleRequested: true,
    })
    .where(
      and(
        eq(smsBookingRecords.id, recordId),
        eq(smsBookingRecords.tenantId, tenantId)
      )
    )
    .returning();
  
  if (updated) {
    console.log(`[CONFIRM] Reschedule requested phone=${updated.phone} eventId=${updated.eventId}`);
  }
  
  return updated || null;
}

export async function updateReminderSent(
  tenantId: string,
  recordId: number
): Promise<void> {
  const tenantDb = wrapTenantDb(db, tenantId);
  
  await tenantDb
    .update(smsBookingRecords)
    .set({
      lastConfirmationReminderAt: new Date(),
    })
    .where(
      and(
        eq(smsBookingRecords.id, recordId),
        eq(smsBookingRecords.tenantId, tenantId)
      )
    );
}

export async function markAutoCanceled(
  tenantId: string,
  recordId: number
): Promise<SmsBookingRecord | null> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const now = new Date();
  
  const [updated] = await tenantDb
    .update(smsBookingRecords)
    .set({
      autoCanceledAt: now,
      needsConfirmation: false,
    })
    .where(
      and(
        eq(smsBookingRecords.id, recordId),
        eq(smsBookingRecords.tenantId, tenantId)
      )
    )
    .returning();
  
  if (updated) {
    console.log(`[AUTO CANCEL] phone=${updated.phone} eventId=${updated.eventId} reason=unconfirmed_24h`);
  }
  
  return updated || null;
}

export interface BookingsNeedingReminder {
  due7Days: SmsBookingRecord[];
  due48Hours: SmsBookingRecord[];
  dueAutoCancel: SmsBookingRecord[];
}

export async function findBookingsNeedingReminders(
  tenantId: string
): Promise<BookingsNeedingReminder> {
  const tenantDb = wrapTenantDb(db, tenantId);
  const now = new Date();
  
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sixDaysFromNow = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const thirtySixHoursFromNow = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const allUnconfirmed = await tenantDb
    .select()
    .from(smsBookingRecords)
    .where(
      and(
        eq(smsBookingRecords.tenantId, tenantId),
        eq(smsBookingRecords.needsConfirmation, true),
        isNull(smsBookingRecords.confirmedAt),
        isNull(smsBookingRecords.autoCanceledAt),
        gt(smsBookingRecords.startTime, now)
      )
    );
  
  const due7Days: SmsBookingRecord[] = [];
  const due48Hours: SmsBookingRecord[] = [];
  const dueAutoCancel: SmsBookingRecord[] = [];
  
  for (const record of allUnconfirmed) {
    const startTime = new Date(record.startTime);
    const lastReminder = record.lastConfirmationReminderAt 
      ? new Date(record.lastConfirmationReminderAt) 
      : null;
    
    // 7 days before: send if lastReminder is null or older than 6 days
    if (startTime <= sevenDaysFromNow && startTime > fortyEightHoursFromNow) {
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      if (!lastReminder || lastReminder < sixDaysAgo) {
        due7Days.push(record);
      }
    }
    
    // 48 hours before: send if lastReminder is null or older than 36 hours
    if (startTime <= fortyEightHoursFromNow && startTime > twentyFourHoursFromNow) {
      const thirtySixHoursAgo = new Date(now.getTime() - 36 * 60 * 60 * 1000);
      if (!lastReminder || lastReminder < thirtySixHoursAgo) {
        due48Hours.push(record);
      }
    }
    
    // Auto-cancel: within 24 hours and still unconfirmed
    if (startTime <= twentyFourHoursFromNow && startTime > now) {
      dueAutoCancel.push(record);
    }
  }
  
  return { due7Days, due48Hours, dueAutoCancel };
}

export async function findBookingByEventId(
  tenantId: string,
  eventId: string
): Promise<SmsBookingRecord | null> {
  const tenantDb = wrapTenantDb(db, tenantId);
  
  const records = await tenantDb
    .select()
    .from(smsBookingRecords)
    .where(
      and(
        eq(smsBookingRecords.tenantId, tenantId),
        eq(smsBookingRecords.eventId, eventId)
      )
    )
    .limit(1);
  
  return records[0] || null;
}
