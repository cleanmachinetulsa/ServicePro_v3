/**
 * Safe table creation script for port_recovery_sms_sends
 * No Drizzle push - uses direct SQL via serverless driver
 * Idempotent: uses IF NOT EXISTS and safe alter statements
 */

import { sql } from '@neondatabase/serverless';

async function ensurePortRecoverySmsTable() {
  try {
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();

    try {
      // Create table if not exists
      await client.query(sql`
        CREATE TABLE IF NOT EXISTS port_recovery_sms_sends (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          campaign_key TEXT NOT NULL,
          phone TEXT NOT NULL,
          twilio_sid TEXT,
          status TEXT NOT NULL DEFAULT 'sent',
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create unique index
      await client.query(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS port_recovery_sms_sends_unique
        ON port_recovery_sms_sends(tenant_id, campaign_key, phone);
      `);

      // Create lookup index
      await client.query(sql`
        CREATE INDEX IF NOT EXISTS port_recovery_sms_sends_lookup
        ON port_recovery_sms_sends(tenant_id, campaign_key, phone, sent_at);
      `);

      console.log('✅ port_recovery_sms_sends ready');
      process.exit(0);
    } finally {
      await client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('❌ Failed to create port_recovery_sms_sends table:', error);
    process.exit(1);
  }
}

ensurePortRecoverySmsTable();
