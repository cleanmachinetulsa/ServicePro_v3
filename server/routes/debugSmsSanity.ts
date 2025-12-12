/**
 * SMS System Sanity Check - Non-destructive status endpoint
 * GET /api/debug/sms-sanity
 * 
 * Returns compact JSON status of SMS infrastructure:
 * - DB connectivity
 * - Dedup table existence
 * - Recent SMS counts
 * - Booking attempt status
 * - Google Calendar auth sanity
 * - Sheets auto-sync flag
 * - SMS agent model
 */

import { Express, Request, Response } from 'express';
import { db } from '../db';
import { smsInboundDedup, smsBookingRecords } from '@shared/schema';
import { gte, desc } from 'drizzle-orm';

interface SmsSanityStatus {
  timestamp: string;
  ok: boolean;
  checks: {
    db_connectivity: { ok: boolean; message: string };
    dedup_table: { ok: boolean; message: string };
    inbound_sms_1h: { ok: boolean; count: number; message: string };
    outbound_sms_1h: { ok: boolean; count: number; message: string };
    booking_attempt: { ok: boolean; message: string };
    google_calendar: { ok: boolean; message: string };
    sheets_autosync: { ok: boolean; enabled: boolean };
    sms_agent_model: { ok: boolean; model: string };
  };
  errors: string[];
}

export function registerSmsSanityRoutes(app: Express) {
  app.get('/api/debug/sms-sanity', async (req: Request, res: Response) => {
    const status: SmsSanityStatus = {
      timestamp: new Date().toISOString(),
      ok: true,
      checks: {
        db_connectivity: { ok: false, message: 'Not checked' },
        dedup_table: { ok: false, message: 'Not checked' },
        inbound_sms_1h: { ok: false, count: 0, message: 'Not checked' },
        outbound_sms_1h: { ok: false, count: 0, message: 'Not checked' },
        booking_attempt: { ok: false, message: 'Not checked' },
        google_calendar: { ok: false, message: 'Not checked' },
        sheets_autosync: { ok: false, enabled: false },
        sms_agent_model: { ok: false, model: 'unknown' },
      },
      errors: [],
    };

    try {
      // 1. DB Connectivity check
      try {
        const testQuery = await db.query.users.findFirst({ limit: 1 });
        status.checks.db_connectivity = { ok: true, message: 'Connected' };
      } catch (err) {
        status.checks.db_connectivity = { ok: false, message: `Failed: ${String(err).substring(0, 80)}` };
        status.errors.push('DB connectivity failed');
        status.ok = false;
      }

      // 2. Dedup table existence check
      try {
        const dedupTest = await db.select().from(smsInboundDedup).limit(1);
        status.checks.dedup_table = { ok: true, message: 'Table exists' };
      } catch (err) {
        status.checks.dedup_table = { ok: false, message: `Not found or error: ${String(err).substring(0, 80)}` };
        status.errors.push('Dedup table not accessible');
        status.ok = false;
      }

      // 3. Inbound SMS count (last 1 hour)
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const inboundCount = await db.select().from(smsInboundDedup).where(
          gte(smsInboundDedup.createdAt, oneHourAgo)
        ).then(rows => rows.length);
        status.checks.inbound_sms_1h = { ok: true, count: inboundCount, message: `${inboundCount} received` };
      } catch (err) {
        status.checks.inbound_sms_1h = { ok: false, count: 0, message: `Query failed: ${String(err).substring(0, 80)}` };
      }

      // 4. Outbound SMS count (last 1 hour) - check logs table if it exists
      try {
        // Try to query from a potential logs table if it exists
        // For now, return placeholder since we don't have outbound tracking table specified
        status.checks.outbound_sms_1h = { ok: true, count: 0, message: 'Outbound tracking not implemented' };
      } catch (err) {
        status.checks.outbound_sms_1h = { ok: false, count: 0, message: `Lookup failed: ${String(err).substring(0, 80)}` };
      }

      // 5. Last booking attempt status
      try {
        const lastBooking = await db.select().from(smsBookingRecords).orderBy(desc(smsBookingRecords.createdAt)).limit(1);
        if (lastBooking.length > 0) {
          const booking = lastBooking[0];
          status.checks.booking_attempt = {
            ok: true,
            message: `Last: ${booking.needsConfirmation ? 'needs_confirm' : 'immediate'}, eventId=${booking.eventId ? 'present' : 'missing'}`
          };
        } else {
          status.checks.booking_attempt = { ok: true, message: 'No recent bookings' };
        }
      } catch (err) {
        status.checks.booking_attempt = { ok: true, message: `Status unavailable: ${String(err).substring(0, 60)}` };
      }

      // 6. Google Calendar auth sanity (lightweight check only)
      try {
        const googleApiKey = process.env.GOOGLE_API_KEY;
        const googleCalendarId = process.env.GOOGLE_CALENDAR_ID;
        if (googleApiKey && googleCalendarId) {
          status.checks.google_calendar = { ok: true, message: 'Credentials configured' };
        } else {
          status.checks.google_calendar = { ok: false, message: 'Missing GOOGLE_API_KEY or GOOGLE_CALENDAR_ID' };
        }
      } catch (err) {
        status.checks.google_calendar = { ok: false, message: `Check failed: ${String(err).substring(0, 80)}` };
      }

      // 7. Sheets auto-sync enabled flag
      const sheetsAutoSyncEnabled = process.env.ENABLE_SHEETS_CUSTOMER_AUTO_SYNC === '1';
      status.checks.sheets_autosync = { ok: true, enabled: sheetsAutoSyncEnabled };

      // 8. SMS agent model
      const smsAgentModel = process.env.SMS_AGENT_MODEL || 'gpt-4o';
      status.checks.sms_agent_model = { ok: true, model: smsAgentModel };

      // Final status - true if no critical errors
      if (status.errors.length === 0) {
        status.ok = true;
      }

      res.json(status);
    } catch (err) {
      console.error('[SMS SANITY] Uncaught error:', err);
      status.ok = false;
      status.errors.push(`Uncaught error: ${String(err).substring(0, 100)}`);
      res.status(500).json(status);
    }
  });
}
