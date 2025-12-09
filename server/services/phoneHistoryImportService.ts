import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { sql } from 'drizzle-orm';
import {
  phoneHistoryImports,
  PhoneHistoryImport,
} from '@shared/schema';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const LOG_PREFIX = '[PHONE HISTORY IMPORT]';

export interface CustomerRecord {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  vehicleInfo?: string;
  notes?: string;
}

export interface MessageRecord {
  phone: string;
  body: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  channel?: string;
}

export interface ConversationRecord {
  phone: string;
  platform?: string;
}

export interface CallRecord {
  phone: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  duration?: number; // in seconds
  status?: string; // completed, missed, voicemail, etc.
  transcription?: string; // voicemail transcription if any
}

export interface ImportStats {
  customersImported: number;
  customersUpdated: number;
  conversationsCreated: number;
  messagesImported: number;
  callsImported: number;
  errorsCount: number;
  errors?: string[];
}

function normalizeE164(phone: string): string | null {
  if (!phone) return null;
  try {
    const cleaned = phone.replace(/\D/g, '');
    if (isValidPhoneNumber(cleaned, 'US')) {
      const parsed = parsePhoneNumber(cleaned, 'US');
      return parsed.format('E.164');
    }
    if (isValidPhoneNumber(`+${cleaned}`)) {
      const parsed = parsePhoneNumber(`+${cleaned}`);
      return parsed.format('E.164');
    }
    return null;
  } catch {
    return null;
  }
}

export async function createImportJob(
  tenantId: string,
  fileName: string
): Promise<PhoneHistoryImport> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    INSERT INTO phone_history_imports (tenant_id, file_name, status)
    VALUES (${tenantId}, ${fileName}, 'pending')
    RETURNING *
  `);

  return result.rows[0] as PhoneHistoryImport;
}

export async function updateImportJob(
  importId: number,
  tenantId: string,
  status: 'pending' | 'processing' | 'success' | 'failed',
  stats?: ImportStats,
  errorText?: string
): Promise<void> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const completedAt = status === 'success' || status === 'failed' ? sql`NOW()` : sql`NULL`;
  const statsJson = stats ? JSON.stringify(stats) : null;

  await tenantDb.execute(sql`
    UPDATE phone_history_imports
    SET status = ${status}::phone_history_import_status,
        stats = ${statsJson}::jsonb,
        error_text = ${errorText || null},
        completed_at = ${completedAt}
    WHERE id = ${importId} AND tenant_id = ${tenantId}
  `);
}

export async function getLatestImport(tenantId: string): Promise<PhoneHistoryImport | null> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    SELECT * FROM phone_history_imports
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return result.rows[0] as PhoneHistoryImport | null;
}

export async function getImportHistory(
  tenantId: string,
  limit: number = 10
): Promise<PhoneHistoryImport[]> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    SELECT * FROM phone_history_imports
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return result.rows as PhoneHistoryImport[];
}

function parseCSVFile(content: string): any[] {
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} CSV parse error:`, error);
    return [];
  }
}

function parseJSONFile(content: string): any[] {
  try {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error(`${LOG_PREFIX} JSON parse error:`, error);
    return [];
  }
}

export async function processImportZip(
  zipBuffer: Buffer,
  tenantId: string,
  importId: number,
  dryRun: boolean = false
): Promise<ImportStats> {
  const stats: ImportStats = {
    customersImported: 0,
    customersUpdated: 0,
    conversationsCreated: 0,
    messagesImported: 0,
    callsImported: 0,
    errorsCount: 0,
    errors: [],
  };

  const tenantDb = wrapTenantDb(db, tenantId);
  
  try {
    if (!dryRun) {
      await updateImportJob(importId, tenantId, 'processing');
    } else {
      console.log(`${LOG_PREFIX} Starting dry run - no data will be persisted`);
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    let customers: CustomerRecord[] = [];
    let messages: MessageRecord[] = [];
    let conversations: ConversationRecord[] = [];
    let calls: CallRecord[] = [];

    for (const entry of entries) {
      const entryName = entry.entryName.toLowerCase();
      const content = entry.getData().toString('utf-8');

      if (entryName.includes('customers')) {
        if (entryName.endsWith('.csv')) {
          customers = parseCSVFile(content).map((row) => ({
            name: row.name || row.Name || '',
            phone: row.phone || row.Phone || row.phone_number || '',
            email: row.email || row.Email || '',
            address: row.address || row.Address || '',
            vehicleInfo: row.vehicleInfo || row.vehicle_info || row.VehicleInfo || '',
            notes: row.notes || row.Notes || '',
          }));
        } else if (entryName.endsWith('.json')) {
          const parsed = parseJSONFile(content);
          customers = parsed.map((row: any) => ({
            name: row.name || '',
            phone: row.phone || row.phone_number || '',
            email: row.email || '',
            address: row.address || '',
            vehicleInfo: row.vehicleInfo || row.vehicle_info || '',
            notes: row.notes || '',
          }));
        }
        console.log(`${LOG_PREFIX} Found ${customers.length} customers in ${entryName}`);
      }

      if (entryName.includes('messages')) {
        if (entryName.endsWith('.csv')) {
          messages = parseCSVFile(content).map((row) => ({
            phone: row.phone || row.Phone || row.phone_number || '',
            body: row.body || row.Body || row.content || row.Content || row.text || row.message || '',
            timestamp: row.timestamp || row.Timestamp || row.date || row.Date || row.datetime || '',
            direction: (row.direction || row.Direction || 'inbound').toLowerCase() === 'outbound' ? 'outbound' : 'inbound',
            channel: row.channel || row.Channel || 'sms',
          }));
        } else if (entryName.endsWith('.json')) {
          const parsed = parseJSONFile(content);
          messages = parsed.map((row: any) => ({
            phone: row.phone || row.phone_number || '',
            body: row.body || row.content || row.text || row.message || '',
            timestamp: row.timestamp || row.date || row.datetime || '',
            direction: (row.direction || 'inbound').toLowerCase() === 'outbound' ? 'outbound' : 'inbound',
            channel: row.channel || 'sms',
          }));
        }
        console.log(`${LOG_PREFIX} Found ${messages.length} messages in ${entryName}`);
      }

      if (entryName.includes('conversations') && !entryName.includes('messages')) {
        if (entryName.endsWith('.csv')) {
          conversations = parseCSVFile(content).map((row) => ({
            phone: row.phone || row.Phone || row.phone_number || '',
            platform: row.platform || row.Platform || 'sms',
          }));
        } else if (entryName.endsWith('.json')) {
          const parsed = parseJSONFile(content);
          conversations = parsed.map((row: any) => ({
            phone: row.phone || row.phone_number || '',
            platform: row.platform || 'sms',
          }));
        }
        console.log(`${LOG_PREFIX} Found ${conversations.length} conversations in ${entryName}`);
      }

      if (entryName.includes('calls') || entryName.includes('call_log') || entryName.includes('call-log')) {
        if (entryName.endsWith('.csv')) {
          calls = parseCSVFile(content).map((row) => ({
            phone: row.phone || row.Phone || row.phone_number || row.caller || row.number || '',
            timestamp: row.timestamp || row.Timestamp || row.date || row.Date || row.datetime || row.time || '',
            direction: (row.direction || row.Direction || row.type || 'inbound').toLowerCase().includes('out') ? 'outbound' : 'inbound',
            duration: parseInt(row.duration || row.Duration || row.length || '0', 10) || 0,
            status: row.status || row.Status || row.result || 'completed',
            transcription: row.transcription || row.Transcription || row.voicemail || '',
          }));
        } else if (entryName.endsWith('.json')) {
          const parsed = parseJSONFile(content);
          calls = parsed.map((row: any) => ({
            phone: row.phone || row.phone_number || row.caller || row.number || '',
            timestamp: row.timestamp || row.date || row.datetime || row.time || '',
            direction: (row.direction || row.type || 'inbound').toLowerCase().includes('out') ? 'outbound' : 'inbound',
            duration: parseInt(row.duration || row.length || '0', 10) || 0,
            status: row.status || row.result || 'completed',
            transcription: row.transcription || row.voicemail || '',
          }));
        }
        console.log(`${LOG_PREFIX} Found ${calls.length} calls in ${entryName}`);
      }
    }

    const phoneToCustomerId: Map<string, number> = new Map();
    const phoneToConversationId: Map<string, number> = new Map();

    for (const customer of customers) {
      const normalizedPhone = normalizeE164(customer.phone || '');
      const name = customer.name?.trim() || 'Unknown';

      if (!normalizedPhone && !customer.email) {
        stats.errors!.push(`Customer without phone or email: ${name}`);
        stats.errorsCount++;
        continue;
      }

      try {
        const existingResult = await tenantDb.execute(sql`
          SELECT id FROM customers
          WHERE tenant_id = ${tenantId}
            AND (
              (phone IS NOT NULL AND phone = ${normalizedPhone})
              OR (email IS NOT NULL AND email = ${customer.email || null})
            )
          LIMIT 1
        `);

        if (existingResult.rows.length > 0) {
          const existingId = (existingResult.rows[0] as any).id;
          if (!dryRun) {
            await tenantDb.execute(sql`
              UPDATE customers SET
                name = COALESCE(NULLIF(${name}, ''), name),
                address = COALESCE(NULLIF(${customer.address || ''}, ''), address),
                vehicle_info = COALESCE(NULLIF(${customer.vehicleInfo || ''}, ''), vehicle_info),
                notes = COALESCE(NULLIF(${customer.notes || ''}, ''), notes),
                import_source = CONCAT(COALESCE(import_source, ''), ',phone_history')
              WHERE id = ${existingId}
            `);
          }
          stats.customersUpdated++;
          if (normalizedPhone) {
            phoneToCustomerId.set(normalizedPhone, existingId);
          }
        } else {
          if (!dryRun) {
            const insertResult = await tenantDb.execute(sql`
              INSERT INTO customers (tenant_id, name, phone, email, address, vehicle_info, notes, import_source)
              VALUES (${tenantId}, ${name}, ${normalizedPhone}, ${customer.email || null},
                      ${customer.address || null}, ${customer.vehicleInfo || null},
                      ${customer.notes || null}, 'phone_history')
              RETURNING id
            `);
            if (normalizedPhone) {
              phoneToCustomerId.set(normalizedPhone, (insertResult.rows[0] as any).id);
            }
          }
          stats.customersImported++;
        }
      } catch (error: any) {
        stats.errors!.push(`Customer import error (${name}): ${error.message}`);
        stats.errorsCount++;
      }
    }

    const phonesFromMessages = new Set<string>();
    for (const msg of messages) {
      const normalized = normalizeE164(msg.phone);
      if (normalized) {
        phonesFromMessages.add(normalized);
      }
    }

    for (const phone of phonesFromMessages) {
      try {
        const existingConv = await tenantDb.execute(sql`
          SELECT id FROM conversations
          WHERE tenant_id = ${tenantId}
            AND customer_phone = ${phone}
            AND platform = 'sms'
          LIMIT 1
        `);

        if (existingConv.rows.length > 0) {
          phoneToConversationId.set(phone, (existingConv.rows[0] as any).id);
        } else {
          if (!dryRun) {
            const customerId = phoneToCustomerId.get(phone) || null;
            let customerName = 'Unknown';

            if (customerId) {
              const custResult = await tenantDb.execute(sql`
                SELECT name FROM customers WHERE id = ${customerId} AND tenant_id = ${tenantId}
              `);
              if (custResult.rows.length > 0) {
                customerName = (custResult.rows[0] as any).name || 'Unknown';
              }
            }

            const insertConv = await tenantDb.execute(sql`
              INSERT INTO conversations (tenant_id, customer_id, customer_phone, customer_name, platform, category, status)
              VALUES (${tenantId}, ${customerId}, ${phone}, ${customerName}, 'sms', 'Imported', 'active')
              RETURNING id
            `);

            phoneToConversationId.set(phone, (insertConv.rows[0] as any).id);
          } else {
            // For dry run, use a fake ID for tracking
            phoneToConversationId.set(phone, -1);
          }
          stats.conversationsCreated++;
        }
      } catch (error: any) {
        stats.errors!.push(`Conversation creation error (${phone}): ${error.message}`);
        stats.errorsCount++;
      }
    }

    for (const msg of messages) {
      const normalizedPhone = normalizeE164(msg.phone);
      if (!normalizedPhone) {
        stats.errors!.push(`Invalid phone in message: ${msg.phone}`);
        stats.errorsCount++;
        continue;
      }

      const conversationId = phoneToConversationId.get(normalizedPhone);
      if (!conversationId) {
        stats.errors!.push(`No conversation found for message phone: ${normalizedPhone}`);
        stats.errorsCount++;
        continue;
      }

      let timestamp: Date;
      try {
        timestamp = new Date(msg.timestamp);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } catch {
        timestamp = new Date();
      }

      const sender = msg.direction === 'outbound' ? 'agent' : 'customer';
      const fromCustomer = msg.direction === 'inbound';
      const body = msg.body?.trim() || '';

      if (!body) {
        continue;
      }

      try {
        const existingMsg = await tenantDb.execute(sql`
          SELECT id FROM messages
          WHERE conversation_id = ${conversationId}
            AND tenant_id = ${tenantId}
            AND content = ${body}
            AND timestamp = ${timestamp}
            AND from_customer = ${fromCustomer}
          LIMIT 1
        `);

        if (existingMsg.rows.length === 0) {
          if (!dryRun) {
            await tenantDb.execute(sql`
              INSERT INTO messages (conversation_id, tenant_id, content, sender, from_customer, timestamp, channel)
              VALUES (${conversationId}, ${tenantId}, ${body}, ${sender}, ${fromCustomer}, ${timestamp}, 'sms')
            `);
          }
          stats.messagesImported++;
        }
      } catch (error: any) {
        stats.errors!.push(`Message import error: ${error.message}`);
        stats.errorsCount++;
      }
    }

    // Import calls
    for (const call of calls) {
      const normalizedPhone = normalizeE164(call.phone);
      if (!normalizedPhone) {
        stats.errors!.push(`Invalid phone in call: ${call.phone}`);
        stats.errorsCount++;
        continue;
      }

      let timestamp: Date;
      try {
        timestamp = new Date(call.timestamp);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } catch {
        timestamp = new Date();
      }

      const direction = call.direction || 'inbound';
      const duration = call.duration || 0;
      const status = call.status || 'completed';
      const transcription = call.transcription?.trim() || null;

      // Generate a unique call SID for imported calls
      const importedCallSid = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Determine from/to based on direction
      const businessPhone = process.env.MAIN_PHONE_NUMBER || '+10000000000';
      const fromNumber = direction === 'inbound' ? normalizedPhone : businessPhone;
      const toNumber = direction === 'inbound' ? businessPhone : normalizedPhone;
      const customerPhone = normalizedPhone;

      // Link to existing conversation if available
      const conversationId = phoneToConversationId.get(normalizedPhone) || null;

      try {
        // Check for duplicate call (same phone + timestamp + direction)
        const existingCall = await tenantDb.execute(sql`
          SELECT id FROM call_events
          WHERE tenant_id = ${tenantId}
            AND "from" = ${fromNumber}
            AND "to" = ${toNumber}
            AND created_at = ${timestamp}
          LIMIT 1
        `);

        if (existingCall.rows.length === 0) {
          if (!dryRun) {
            await tenantDb.execute(sql`
              INSERT INTO call_events (
                tenant_id, conversation_id, call_sid, direction, "from", "to", 
                customer_phone, status, duration, transcription_text, 
                transcription_status, created_at
              )
              VALUES (
                ${tenantId}, ${conversationId}, ${importedCallSid}, ${direction},
                ${fromNumber}, ${toNumber}, ${customerPhone}, ${status},
                ${duration}, ${transcription}, ${transcription ? 'completed' : null},
                ${timestamp}
              )
            `);
          }
          stats.callsImported++;
        }
      } catch (error: any) {
        stats.errors!.push(`Call import error: ${error.message}`);
        stats.errorsCount++;
      }
    }

    if (dryRun) {
      console.log(`${LOG_PREFIX} Dry run complete - no data persisted:`, stats);
    } else {
      await updateImportJob(importId, tenantId, 'success', stats);
      console.log(`${LOG_PREFIX} Import complete:`, stats);
    }

    return stats;
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Import failed:`, error);
    stats.errors!.push(`Fatal error: ${error.message}`);
    stats.errorsCount++;
    
    if (!dryRun) {
      await updateImportJob(importId, tenantId, 'failed', stats, error.message);
    }
    throw error;
  }
}

export interface ImportSummary extends PhoneHistoryImport {
  serviceCount: number;
  faqCount: number;
  hasPersona: boolean;
  knowledgeApplied: boolean;
}

export async function listTenantImportsWithSummary(
  tenantId: string,
  limit: number = 20
): Promise<ImportSummary[]> {
  const tenantDb = wrapTenantDb(db, tenantId);

  const result = await tenantDb.execute(sql`
    SELECT 
      phi.*,
      COALESCE(
        (phi.knowledge_json->'services')::jsonb,
        '[]'::jsonb
      ) as services_json,
      COALESCE(
        (phi.knowledge_json->'faqs')::jsonb,
        '[]'::jsonb
      ) as faqs_json,
      COALESCE(phi.knowledge_json->'tone', '{}'::jsonb) as tone_json
    FROM phone_history_imports phi
    WHERE phi.tenant_id = ${tenantId}
    ORDER BY phi.created_at DESC
    LIMIT ${limit}
  `);

  return result.rows.map((row: any) => {
    let serviceCount = 0;
    let faqCount = 0;
    let hasPersona = false;

    try {
      const servicesData = typeof row.services_json === 'string' 
        ? JSON.parse(row.services_json) 
        : row.services_json;
      serviceCount = Array.isArray(servicesData) ? servicesData.length : 0;
    } catch { serviceCount = 0; }

    try {
      const faqsData = typeof row.faqs_json === 'string' 
        ? JSON.parse(row.faqs_json) 
        : row.faqs_json;
      faqCount = Array.isArray(faqsData) ? faqsData.length : 0;
    } catch { faqCount = 0; }

    try {
      const toneData = typeof row.tone_json === 'string' 
        ? JSON.parse(row.tone_json) 
        : row.tone_json;
      hasPersona = !!(toneData && Object.keys(toneData).length > 0);
    } catch { hasPersona = false; }

    const knowledgeApplied = !!(row.applied_at);

    return {
      ...row,
      serviceCount,
      faqCount,
      hasPersona,
      knowledgeApplied,
    } as ImportSummary;
  });
}
