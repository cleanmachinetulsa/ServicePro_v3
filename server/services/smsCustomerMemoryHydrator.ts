import { eq, desc, and } from "drizzle-orm";
import { customers, appointments, services, tenantConfig } from "@shared/schema";
import { conversationState } from "../conversationState";

function normalizePhone(p: string) {
  const phone = (p || "").trim();
  // Ensure E.164 format for comparison
  if (!phone) return "";
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return phone;
}

function safeStr(s: any) {
  return typeof s === "string" ? s.trim() : "";
}

function isPlaceholderName(name: string) {
  const n = (name || "").trim().toLowerCase();
  return !n || n === "sms customer" || n === "customer" || n === "unknown";
}

function parseVehicleFreeform(text: string): { year?: string; make?: string; model?: string } | null {
  const t = (text || "").trim();
  if (!t) return null;

  const yearMakeModel = t.match(/\b(19|20)\d{2}\b\s+([A-Za-z]{2,})\s+([A-Za-z0-9\-]+)/);
  if (yearMakeModel) return { year: yearMakeModel[0].match(/\b(19|20)\d{2}\b/)?.[0], make: yearMakeModel[2], model: yearMakeModel[3] };

  const makeModel = t.match(/\b([A-Za-z]{2,})\s+([A-Za-z0-9\-]{2,})\b/);
  if (makeModel) return { make: makeModel[1], model: makeModel[2] };

  const modelDigits = t.match(/\b([A-Za-z]{1,}\d{1,}[A-Za-z0-9\-]*)\b/);
  if (modelDigits) return { model: modelDigits[1] };

  return null;
}

function formatLocalDate(d: Date) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Audit T1 (Task #17) — thread-awareness note:
 *
 * This hydrator is keyed on the customer (looked up by phone) and reads from
 * `customers` + `appointments`, both of which are scoped per-tenant per-
 * customer rather than per-conversation. Because there is exactly one
 * customer row per identified user — and that same customer row is what
 * `customer_threads` is keyed on — the hydrated profile (name, address,
 * vehicles, last service) already represents the *cross-channel* customer
 * identity. No additional thread-level read is needed here; cross-channel
 * *conversation history* is handled in `smsConversationContextService`,
 * which loads messages across all sibling conversations sharing the
 * thread.
 */
export async function hydrateSmsConversationStateFromDb(opts: {
  tenantDb: any;
  tenantId: string;
  fromPhone: string;
}) {
  const fromPhone = normalizePhone(opts.fromPhone);
  const debug = process.env.DEBUG_SMS_TRACE === "1";

  const current = conversationState.getState(fromPhone);

  const customer = await opts.tenantDb
    .select()
    .from(customers)
    .where(eq(customers.phone, fromPhone))
    .limit(1)
    .then((r: any[]) => r?.[0]);

  if (!customer) {
    if (debug) console.log("[SMS MEMORY] no customer found", { tenantId: opts.tenantId, fromPhone });
    return { hydrated: false };
  }

  const appts = await opts.tenantDb
    .select({
      id: appointments.id,
      scheduledTime: appointments.scheduledTime,
      address: appointments.address,
      serviceId: appointments.serviceId,
    })
    .from(appointments)
    .where(eq(appointments.customerId, customer.id))
    .orderBy(desc(appointments.scheduledTime))
    .limit(2);

  let lastServiceName = "";
  let lastServiceDate = "";
  let lastAddress = "";

  if (appts?.[0]) {
    lastAddress = safeStr(appts[0].address);
    lastServiceDate = appts[0].scheduledTime ? formatLocalDate(new Date(appts[0].scheduledTime)) : "";
    const svc = await opts.tenantDb
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, appts[0].serviceId))
      .limit(1)
      .then((r: any[]) => r?.[0]);
    lastServiceName = safeStr(svc?.name);
  }

  const dbName = safeStr(customer.name);
  const dbEmail = safeStr(customer.email);
  const rawDbAddress = safeStr(customer.address) || lastAddress;
  const dbVehicleInfo = safeStr(customer.vehicleInfo);

  const parsedVehicle = parseVehicleFreeform(dbVehicleInfo);
  const vehicleArr = parsedVehicle ? [{ ...parsedVehicle }] : [];
  
  // R1.6: Validate address is within service area before auto-filling
  // Load tenant config for service area validation
  let addressNeedsConfirm = false;
  let dbAddress = rawDbAddress;
  
  if (rawDbAddress) {
    try {
      const [config] = await opts.tenantDb
        .select({ primaryCity: tenantConfig.primaryCity })
        .from(tenantConfig)
        .where(eq(tenantConfig.tenantId, opts.tenantId))
        .limit(1);
      
      const primaryCity = safeStr(config?.primaryCity).toLowerCase();
      const addressLower = rawDbAddress.toLowerCase();
      
      // Basic service area check: if we have a primary city and address doesn't match, flag for confirmation
      if (primaryCity && !addressLower.includes(primaryCity)) {
        // Also check for state mismatch (e.g., Minneapolis vs Texas)
        const commonOutOfArea = ['minneapolis', 'california', 'florida', 'new york', 'chicago'];
        const isLikelyOutOfArea = commonOutOfArea.some(loc => 
          addressLower.includes(loc) && !primaryCity.includes(loc)
        );
        
        if (isLikelyOutOfArea) {
          addressNeedsConfirm = true;
          console.log(`[SMS MEMORY] address_needs_confirm=true address="${rawDbAddress.substring(0, 30)}..." primaryCity=${primaryCity}`);
        }
      }
    } catch (e) {
      // Service area check failed - continue with address, don't block
      console.warn("[SMS MEMORY] service area check failed:", e);
    }
  }

  const briefParts: string[] = [];
  if (dbName) briefParts.push(`Name: ${dbName}`);
  if (dbAddress) briefParts.push(`Address on file: ${dbAddress}`);
  if (dbVehicleInfo) briefParts.push(`Vehicle on file: ${dbVehicleInfo}`);
  if (lastServiceName || lastServiceDate) briefParts.push(`Last service: ${[lastServiceName, lastServiceDate].filter(Boolean).join(" on ")}`);
  const customerNotes = safeStr(customer.customerNotes);
  const businessNotes = safeStr(customer.businessNotes);
  if (customerNotes) briefParts.push(`Customer notes: ${customerNotes}`);
  if (businessNotes) briefParts.push(`Business notes: ${businessNotes}`);

  const customerProfileSummary = briefParts.join(" | ");

  const next: any = { ...current };

  if (isPlaceholderName(next.customerName) && dbName) next.customerName = dbName;
  if (!safeStr(next.customerEmail) && dbEmail) next.customerEmail = dbEmail;

  // Fill preferred* for reference
  if (!safeStr(next.preferredAddress) && dbAddress) next.preferredAddress = dbAddress;
  if ((!next.preferredVehicles || next.preferredVehicles.length === 0) && vehicleArr.length) next.preferredVehicles = vehicleArr;

  // Also backfill canonical fields (address, vehicles) so downstream logic sees the data
  // R1.6: Only auto-fill address if it passed service area validation
  if (!safeStr(next.address) && dbAddress && !addressNeedsConfirm) {
    next.address = dbAddress;
  }
  if (addressNeedsConfirm) {
    next.addressNeedsConfirm = true;
    next.addressOnFileUnverified = dbAddress;
  }
  if ((!next.vehicles || next.vehicles.length === 0) && vehicleArr.length) next.vehicles = vehicleArr;

  if (!safeStr(next.customerProfileSummary) && customerProfileSummary) next.customerProfileSummary = customerProfileSummary;

  next.isExistingCustomer = true;

  conversationState.updateState(fromPhone, next);

  if (debug) console.log("[SMS MEMORY] hydrated", {
    tenantId: opts.tenantId,
    fromPhone,
    hasName: !!dbName,
    hasAddress: !!dbAddress,
    hasVehicle: !!dbVehicleInfo,
    lastServiceName,
    lastServiceDate,
  });

  return { hydrated: true, customerId: customer.id };
}
