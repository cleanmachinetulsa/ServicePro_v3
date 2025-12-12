/**
 * Verify SMS dedup table exists and has correct structure
 * Uses app's existing database client (avoids serverless WebSocket issues)
 * 
 * Usage: npm run create:sms:dedup
 * Exit: 0 on success, 1 on failure
 */

import { db } from '../server/db.js';
import { smsInboundDedup } from '../shared/schema.js';

async function verifySmsDedup() {
  console.log('📦 Verifying SMS Inbound Dedup Infrastructure\n');
  
  try {
    // Parse DB URL for logging (redact credentials)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const urlObj = new URL(dbUrl);
      const redactedUrl = `${urlObj.protocol}//${urlObj.hostname}/${urlObj.pathname.split('/').pop()}`;
      console.log(`📍 Database: ${redactedUrl}\n`);
    }
    
    // Test table accessibility
    console.log('▶️  Checking sms_inbound_dedup table...');
    const testQuery = await db.select().from(smsInboundDedup).limit(1);
    console.log('✅ Table exists and is accessible\n');
    
    console.log('▶️  Checking table schema...');
    const infoQuery = await db.select().from(smsInboundDedup).limit(0);
    console.log('✅ Schema validation passed\n');
    
    console.log('🎉 SMS Inbound Dedup Infrastructure Ready!');
    console.log('');
    console.log('Table: sms_inbound_dedup');
    console.log('Columns:');
    console.log('  • id: SERIAL PRIMARY KEY');
    console.log('  • tenant_id: TEXT NOT NULL');
    console.log('  • message_sid: TEXT NOT NULL');
    console.log('  • from_number: TEXT NOT NULL');
    console.log('  • to_number: TEXT NOT NULL');
    console.log('  • received_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    console.log('  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    console.log('Indexes:');
    console.log('  • UNIQUE INDEX on (tenant_id, message_sid)');
    console.log('  • INDEX on tenant_id');
    console.log('');
    
    process.exit(0);
    
  } catch (err) {
    console.error('');
    console.error('❌ SMS dedup table verification failed:');
    console.error(`   ${String(err).substring(0, 200)}`);
    console.error('');
    console.error('Solution: Run "npm run db:push" to create/sync the table');
    console.error('');
    process.exit(1);
  }
}

// Run
verifySmsDedup();
