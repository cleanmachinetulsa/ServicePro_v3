#!/usr/bin/env node
/**
 * Google Voice SMS Import Tool
 * =============================
 * 
 * One-time backfill utility that imports SMS history from a Google Voice export
 * into the ServicePro conversations and messages tables WITHOUT triggering
 * any outbound SMS or AI replies.
 * 
 * HOW TO USE:
 * -----------
 * 1. Export your Google Voice data from Google Takeout
 * 2. Place the export in: google-voice-export/
 *    - For HTML format: google-voice-export/Calls/*.html
 *    - For JSON format: google-voice-export/messages.json
 * 
 * 3. Run with dry-run first to preview:
 *    node tools/importGoogleVoiceSms.cjs --dry-run
 * 
 * 4. Run for real:
 *    node tools/importGoogleVoiceSms.cjs
 * 
 * OPTIONS:
 * --------
 * --dry-run         Preview what would be imported without writing to DB
 * --limit N         Import only the first N messages (for testing)
 * --since YYYY-MM-DD  Only import messages after this date
 * --until YYYY-MM-DD  Only import messages before this date
 * --path PATH       Custom path to Google Voice export (default: ./google-voice-export)
 * 
 * EXAMPLES:
 * ---------
 * node tools/importGoogleVoiceSms.cjs --dry-run
 * node tools/importGoogleVoiceSms.cjs --limit 100
 * node tools/importGoogleVoiceSms.cjs --since 2024-01-01 --until 2024-12-31
 * node tools/importGoogleVoiceSms.cjs --path ./my-export
 * 
 * LIMITATIONS:
 * ------------
 * - Currently only imports to the 'root' tenant (Clean Machine)
 * - HTML parsing may not capture all message formats
 * - Requires Node.js 18+ for native fetch support
 * - Does not import MMS attachments (text only)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: null,
  since: null,
  until: null,
  exportPath: './google-voice-export'
};

// Parse --limit N
const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) {
  options.limit = parseInt(args[limitIdx + 1], 10);
}

// Parse --since YYYY-MM-DD
const sinceIdx = args.indexOf('--since');
if (sinceIdx !== -1 && args[sinceIdx + 1]) {
  options.since = new Date(args[sinceIdx + 1]);
}

// Parse --until YYYY-MM-DD
const untilIdx = args.indexOf('--until');
if (untilIdx !== -1 && args[untilIdx + 1]) {
  options.until = new Date(args[untilIdx + 1]);
}

// Parse --path PATH
const pathIdx = args.indexOf('--path');
if (pathIdx !== -1 && args[pathIdx + 1]) {
  options.exportPath = args[pathIdx + 1];
}

const TENANT_ID = 'root'; // Clean Machine tenant

// Stats tracking
const stats = {
  filesProcessed: 0,
  messagesFound: 0,
  messagesInserted: 0,
  messagesSkipped: 0,
  conversationsCreated: 0,
  conversationsUpdated: 0,
  errors: []
};

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 */
function normalizePhoneE164(phone) {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  let normalized = '';
  if (digits.length === 10) {
    // US number without country code
    normalized = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    normalized = `+${digits}`;
  } else if (digits.length === 11) {
    normalized = `+${digits}`;
  } else {
    normalized = phone.startsWith('+') ? phone : `+${digits}`;
  }

  // Validate E.164 format
  const e164Regex = /^\+\d{10,15}$/;
  if (!e164Regex.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Generate a stable ID for a message based on its content
 */
function generateMessageId(phone, timestamp, content) {
  const data = `${phone}:${timestamp}:${content}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Parse Google Voice HTML export files
 */
function parseHtmlExport(htmlContent, filePath) {
  const messages = [];
  
  try {
    // Extract phone number from filename or content
    const filenameMatch = path.basename(filePath).match(/\+?\d{10,11}/);
    let customerPhone = filenameMatch ? normalizePhoneE164(filenameMatch[0]) : null;
    
    // Try to find phone in content if not in filename
    if (!customerPhone) {
      const phoneMatch = htmlContent.match(/(?:from|to|with)\s*[:\s]*(\+?\d[\d\s\-\(\)]{9,})/i);
      if (phoneMatch) {
        customerPhone = normalizePhoneE164(phoneMatch[1]);
      }
    }
    
    if (!customerPhone) {
      console.warn(`  [WARN] Could not extract phone from: ${filePath}`);
      return messages;
    }
    
    // Parse message entries - Google Voice HTML format varies
    // Common patterns:
    // <div class="message">...</div>
    // <div class="text">...</div>
    
    // Pattern 1: SMS thread format
    const messagePattern = /<div[^>]*class="[^"]*(?:message|text|msg)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const timePattern = /<(?:time|span)[^>]*class="[^"]*(?:dt|datetime|time|timestamp)[^"]*"[^>]*>([^<]+)<\/(?:time|span)>/i;
    const contentPattern = />([^<]+)</g;
    
    // Pattern 2: Simple text format
    const simplePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*(Me|[^:]+):\s*(.+?)(?=\d{1,2}[\/\-]|$)/gi;
    
    let match;
    
    // Try simple pattern first (more reliable for Google Voice exports)
    while ((match = simplePattern.exec(htmlContent)) !== null) {
      const [, date, time, sender, content] = match;
      const timestamp = new Date(`${date} ${time}`);
      
      if (isNaN(timestamp.getTime())) continue;
      
      const direction = sender.toLowerCase().includes('me') ? 'outbound' : 'inbound';
      const cleanContent = content.trim().replace(/<[^>]+>/g, '');
      
      if (cleanContent.length > 0) {
        messages.push({
          customerPhone,
          direction,
          content: cleanContent,
          timestamp,
          googleVoiceId: generateMessageId(customerPhone, timestamp.toISOString(), cleanContent)
        });
      }
    }
    
    // If no messages found, try alternate parsing
    if (messages.length === 0) {
      // Look for any text content with timestamps
      const altPattern = /(?:Sent|Received|Me)[\s:]*([^<\n]+)/gi;
      while ((match = altPattern.exec(htmlContent)) !== null) {
        const content = match[1].trim();
        if (content.length > 2 && content.length < 500) {
          messages.push({
            customerPhone,
            direction: match[0].toLowerCase().includes('sent') || match[0].toLowerCase().includes('me') ? 'outbound' : 'inbound',
            content,
            timestamp: new Date(), // Will be updated if we find a timestamp
            googleVoiceId: generateMessageId(customerPhone, Date.now().toString(), content)
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`  [ERROR] Failed to parse HTML: ${error.message}`);
  }
  
  return messages;
}

/**
 * Parse Google Voice JSON export
 */
function parseJsonExport(jsonContent) {
  const messages = [];
  
  try {
    const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    
    // Handle different JSON structures
    const threads = data.threads || data.messages || data.conversations || [data];
    
    for (const thread of (Array.isArray(threads) ? threads : [threads])) {
      const phoneNumber = thread.phoneNumber || thread.contact?.phoneNumber || thread.from || thread.to;
      const customerPhone = normalizePhoneE164(phoneNumber);
      
      if (!customerPhone) continue;
      
      const threadMessages = thread.messages || thread.texts || [thread];
      
      for (const msg of (Array.isArray(threadMessages) ? threadMessages : [threadMessages])) {
        const content = msg.text || msg.body || msg.content || msg.message;
        if (!content) continue;
        
        const timestamp = new Date(msg.timestamp || msg.date || msg.time || msg.sentAt || msg.receivedAt);
        if (isNaN(timestamp.getTime())) continue;
        
        const direction = (msg.type === 'sent' || msg.direction === 'outbound' || msg.from === 'me') 
          ? 'outbound' 
          : 'inbound';
        
        messages.push({
          customerPhone,
          direction,
          content: content.trim(),
          timestamp,
          googleVoiceId: msg.id || generateMessageId(customerPhone, timestamp.toISOString(), content)
        });
      }
    }
  } catch (error) {
    console.error(`  [ERROR] Failed to parse JSON: ${error.message}`);
  }
  
  return messages;
}

/**
 * Find all export files in the directory
 */
function findExportFiles(exportPath) {
  const files = [];
  
  if (!fs.existsSync(exportPath)) {
    console.error(`Export path not found: ${exportPath}`);
    return files;
  }
  
  const processDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        processDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.html' || ext === '.json') {
          files.push({ path: fullPath, type: ext.substring(1) });
        }
      }
    }
  };
  
  processDir(exportPath);
  return files;
}

/**
 * Database operations using raw pg connection
 */
async function getDatabaseConnection() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  return client;
}

async function findExistingGoogleVoiceIds(client, ids) {
  if (ids.length === 0) return new Set();
  
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const result = await client.query(
    `SELECT metadata->>'googleVoiceId' as gv_id 
     FROM messages 
     WHERE metadata->>'source' = 'google_voice_import'
     AND metadata->>'googleVoiceId' IN (${placeholders})`,
    ids
  );
  
  return new Set(result.rows.map(r => r.gv_id));
}

async function findOrCreateConversation(client, customerPhone) {
  // Look for existing conversation
  const existing = await client.query(
    `SELECT id, last_message_time FROM conversations 
     WHERE tenant_id = $1 AND customer_phone = $2 AND platform = 'sms'
     LIMIT 1`,
    [TENANT_ID, customerPhone]
  );
  
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, created: false, lastMessageTime: existing.rows[0].last_message_time };
  }
  
  // Create new conversation
  const result = await client.query(
    `INSERT INTO conversations (tenant_id, customer_phone, platform, status, control_mode, needs_human_attention)
     VALUES ($1, $2, 'sms', 'active', 'auto', false)
     RETURNING id`,
    [TENANT_ID, customerPhone]
  );
  
  return { id: result.rows[0].id, created: true, lastMessageTime: null };
}

async function insertMessage(client, conversationId, message) {
  const sender = message.direction === 'outbound' ? 'agent' : 'customer';
  const fromCustomer = message.direction === 'inbound';
  const isAutomated = false; // Imported messages are from real conversations, not AI
  const deliveryStatus = 'delivered'; // Historical messages were successfully delivered
  
  const metadata = {
    source: 'google_voice_import',
    googleVoiceId: message.googleVoiceId,
    importedAt: new Date().toISOString(),
    originalDirection: message.direction
  };
  
  await client.query(
    `INSERT INTO messages (
      conversation_id, 
      tenant_id, 
      content, 
      sender, 
      from_customer, 
      timestamp, 
      channel,
      is_automated,
      delivery_status,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, 'sms', $7, $8, $9)`,
    [
      conversationId, 
      TENANT_ID, 
      message.content, 
      sender, 
      fromCustomer, 
      message.timestamp, 
      isAutomated,
      deliveryStatus,
      JSON.stringify(metadata)
    ]
  );
}

async function updateConversationLastMessage(client, conversationId, timestamp) {
  await client.query(
    `UPDATE conversations SET last_message_time = $1 WHERE id = $2 AND (last_message_time IS NULL OR last_message_time < $1)`,
    [timestamp, conversationId]
  );
}

/**
 * Main import function
 */
async function runImport() {
  console.log('='.repeat(60));
  console.log('Google Voice SMS Import Tool');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no database writes)' : 'LIVE IMPORT'}`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Export Path: ${options.exportPath}`);
  if (options.limit) console.log(`Limit: ${options.limit} messages`);
  if (options.since) console.log(`Since: ${options.since.toISOString()}`);
  if (options.until) console.log(`Until: ${options.until.toISOString()}`);
  console.log('='.repeat(60));
  
  // Find export files
  console.log('\n[1/4] Finding export files...');
  const files = findExportFiles(options.exportPath);
  
  if (files.length === 0) {
    console.error('\nNo HTML or JSON files found in export path.');
    console.log('\nPlease ensure your Google Voice export is placed in:');
    console.log(`  ${path.resolve(options.exportPath)}/`);
    console.log('\nExpected structure:');
    console.log('  google-voice-export/');
    console.log('    ├── Calls/');
    console.log('    │   ├── +1234567890 - Text.html');
    console.log('    │   └── ...');
    console.log('    └── messages.json (optional)');
    process.exit(1);
  }
  
  console.log(`  Found ${files.length} file(s)`);
  stats.filesProcessed = files.length;
  
  // Parse all messages
  console.log('\n[2/4] Parsing messages...');
  let allMessages = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf8');
    
    let messages;
    if (file.type === 'html') {
      messages = parseHtmlExport(content, file.path);
    } else {
      messages = parseJsonExport(content);
    }
    
    if (messages.length > 0) {
      console.log(`  ${path.basename(file.path)}: ${messages.length} messages`);
      allMessages.push(...messages);
    }
  }
  
  // Apply date filters
  if (options.since) {
    allMessages = allMessages.filter(m => m.timestamp >= options.since);
  }
  if (options.until) {
    allMessages = allMessages.filter(m => m.timestamp <= options.until);
  }
  
  // Apply limit
  if (options.limit && allMessages.length > options.limit) {
    allMessages = allMessages.slice(0, options.limit);
  }
  
  stats.messagesFound = allMessages.length;
  console.log(`\n  Total messages to import: ${allMessages.length}`);
  
  if (allMessages.length === 0) {
    console.log('\nNo messages to import. Exiting.');
    process.exit(0);
  }
  
  // Group by customer phone
  const byPhone = new Map();
  for (const msg of allMessages) {
    if (!byPhone.has(msg.customerPhone)) {
      byPhone.set(msg.customerPhone, []);
    }
    byPhone.get(msg.customerPhone).push(msg);
  }
  
  console.log(`  Unique conversations: ${byPhone.size}`);
  
  if (options.dryRun) {
    console.log('\n[3/4] DRY RUN - Skipping database operations');
    console.log('\n[4/4] Preview:');
    
    let previewCount = 0;
    for (const [phone, messages] of byPhone) {
      if (previewCount >= 5) {
        console.log(`  ... and ${byPhone.size - 5} more conversations`);
        break;
      }
      console.log(`\n  ${phone} (${messages.length} messages):`);
      for (const msg of messages.slice(0, 3)) {
        const dir = msg.direction === 'inbound' ? '←' : '→';
        const preview = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
        console.log(`    ${dir} ${msg.timestamp.toISOString().substring(0, 19)}: ${preview}`);
      }
      if (messages.length > 3) {
        console.log(`    ... and ${messages.length - 3} more messages`);
      }
      previewCount++;
    }
    
    stats.messagesInserted = allMessages.length;
    stats.conversationsCreated = byPhone.size;
  } else {
    // Connect to database
    console.log('\n[3/4] Connecting to database...');
    let client;
    
    try {
      client = await getDatabaseConnection();
      console.log('  Connected!');
      
      // Check for existing imports
      console.log('\n[4/4] Importing messages...');
      const allIds = allMessages.map(m => m.googleVoiceId);
      const existingIds = await findExistingGoogleVoiceIds(client, allIds);
      console.log(`  Found ${existingIds.size} already-imported messages (will skip)`);
      
      // Process each conversation
      for (const [phone, messages] of byPhone) {
        try {
          // Sort messages by timestamp
          messages.sort((a, b) => a.timestamp - b.timestamp);
          
          // Find or create conversation
          const conv = await findOrCreateConversation(client, phone);
          
          if (conv.created) {
            stats.conversationsCreated++;
          } else {
            stats.conversationsUpdated++;
          }
          
          let latestTimestamp = conv.lastMessageTime;
          
          // Insert messages
          for (const msg of messages) {
            if (existingIds.has(msg.googleVoiceId)) {
              stats.messagesSkipped++;
              continue;
            }
            
            await insertMessage(client, conv.id, msg);
            stats.messagesInserted++;
            
            if (!latestTimestamp || msg.timestamp > latestTimestamp) {
              latestTimestamp = msg.timestamp;
            }
          }
          
          // Update conversation's last message time
          if (latestTimestamp && latestTimestamp !== conv.lastMessageTime) {
            await updateConversationLastMessage(client, conv.id, latestTimestamp);
          }
          
          process.stdout.write(`\r  Processed: ${stats.messagesInserted + stats.messagesSkipped}/${allMessages.length} messages`);
          
        } catch (error) {
          stats.errors.push(`${phone}: ${error.message}`);
        }
      }
      
      console.log('\n');
      
    } finally {
      if (client) {
        await client.end();
      }
    }
  }
  
  // Print summary
  console.log('='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files processed:       ${stats.filesProcessed}`);
  console.log(`Messages found:        ${stats.messagesFound}`);
  console.log(`Messages inserted:     ${stats.messagesInserted}`);
  console.log(`Messages skipped:      ${stats.messagesSkipped} (duplicates)`);
  console.log(`Conversations created: ${stats.conversationsCreated}`);
  console.log(`Conversations updated: ${stats.conversationsUpdated}`);
  
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`  - ${err}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }
  
  console.log('='.repeat(60));
  
  if (options.dryRun) {
    console.log('\nThis was a DRY RUN. No changes were made to the database.');
    console.log('Run without --dry-run to perform the actual import.');
  }
}

// Run the import
runImport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
