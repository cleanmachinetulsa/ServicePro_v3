/**
 * Safe one-time script to create sms_inbound_dedup table + unique index
 * WITHOUT using drizzle push (direct SQL via @neondatabase/serverless)
 * 
 * Usage: npm run create:sms:dedup
 * Exit: 0 on success, 1 on failure
 */

import { sql } from '@neondatabase/serverless';

async function createSmsDedupTable() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  
  console.log('📦 Creating SMS Inbound Dedup Infrastructure');
  console.log('');
  
  try {
    // Parse DB URL for logging (redact credentials)
    const urlObj = new URL(dbUrl);
    const redactedUrl = `${urlObj.protocol}//${urlObj.hostname}/${urlObj.pathname.split('/').pop()}`;
    console.log(`📍 Database: ${redactedUrl}`);
    console.log('');
    
    // Create table IF NOT EXISTS
    console.log('▶️  Creating table sms_inbound_dedup...');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sms_inbound_dedup (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        message_sid TEXT NOT NULL,
        from_number TEXT NOT NULL,
        to_number TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    await sql(createTableQuery);
    console.log('✅ Table created/verified');
    console.log('');
    
    // Create unique index IF NOT EXISTS
    console.log('▶️  Creating unique index on (tenant_id, message_sid)...');
    const createIndexQuery = `
      CREATE UNIQUE INDEX IF NOT EXISTS sms_inbound_dedup_tenant_msg_sid_idx
      ON sms_inbound_dedup (tenant_id, message_sid);
    `;
    
    await sql(createIndexQuery);
    console.log('✅ Index created/verified');
    console.log('');
    
    // Verify table exists
    console.log('▶️  Verifying table structure...');
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sms_inbound_dedup'
      ORDER BY ordinal_position;
    `;
    
    const columns = await sql(verifyQuery);
    if (!columns || columns.length === 0) {
      throw new Error('Table verification failed - no columns found');
    }
    
    console.log(`✅ Found ${columns.length} columns:`);
    columns.forEach((col: any) => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '';
      console.log(`   • ${col.column_name}: ${col.data_type} ${nullable}`);
    });
    console.log('');
    
    console.log('🎉 SMS Inbound Dedup Infrastructure Ready!');
    console.log('');
    process.exit(0);
    
  } catch (err) {
    console.error('');
    console.error('❌ Failed to create SMS dedup infrastructure:');
    console.error(`   ${String(err)}`);
    console.error('');
    process.exit(1);
  }
}

// Run
createSmsDedupTable();
