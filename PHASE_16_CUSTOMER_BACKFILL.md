### 3️⃣ `PHASE_16_CUSTOMER_BACKFILL.md`

```md
# PHASE 16 – Customer Master Backfill & Historical Merge – IMPLEMENTATION PLAYBOOK

## 0. Purpose

Take 6+ years of customers (Google Sheets + SMS + existing DB) and merge them into a **clean, canonical customer database** for ServicePro v3:

- So the system **knows** who is an “existing customer” vs “new.”
- So loyalty & promo engine (Phase 14) and identity/login (Phase 15) have good data.
- So your AI agents can greet and treat customers correctly.

This phase focuses on **root tenant (Clean Machine)** first.

---

## 1. Pre-Reqs / Assumptions

- `customers` table is extended per Phase 15 (or similar).
- Loyalty and appointments tables exist (`appointments`, `invoices`, etc.).
- There is already some integration with Google Sheets (you’ve used Sheets in prior features).
- SMS HTML exports exist (or will exist) for knowledge base, but SMS import can be v2 if needed.

---

## 2. Data Model Touchpoints

You likely don’t need new tables here, but confirm:

- `customers` has:
  - `importSource`
  - `firstJobDate`
  - `lastJobDate`
  - `totalJobs`
  - `totalLifetimeValue`
  - `householdId` (for anti-abuse)
- `households` table exists (or create it now):

```ts
export const households = pgTable('households', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  normalizedAddress: text('normalized_address').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
You can also add a small migrationLog table to record backfill runs:

ts
Copy code
export const migrationLog = pgTable('migration_log', {
  id: serial('id').primaryKey(),
  type: varchar('type').notNull(),        // 'customer_backfill'
  tenantId: varchar('tenant_id').notNull(),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
});
3. High-Level Backfill Steps
Extract & normalize data from Google Sheets.

Merge with existing DB customers (dedupe by phone & address).

Optionally augment with SMS history.

Compute firstJobDate, lastJobDate, totalJobs, totalLifetimeValue.

Create/assign households via normalized addresses.

Upsert into customers table for tenantId='root'.

Mark and surface any ambiguous duplicates for manual review later.

4. Implementation Details
4.1 Helper: Address Normalization
File: server/services/addressNormalization.ts (new)

Function:

ts
Copy code
export function normalizeAddress(raw: {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string {
  // Implementation:
  // - Trim whitespace
  // - Uppercase street/city/state
  // - Normalize common abbreviations (ST → STREET, Rd → ROAD, etc.)
  // - Concatenate into a single string for uniqueness checks.
}
This is used to group customers into households.

4.2 Backfill Script / Service
File: server/scripts/backfillCustomersRoot.ts (new)

Or a service function in server/services/customerBackfillService.ts + a CLI entry.

4.2.1 Read from Google Sheets
Use your existing Google Sheets integration OR create one service:

googleSheetsService.fetchTab(tenantId, sheetId, tabName).

Tabs to read:

Customer information

Live Client Requests

Customer_info_sheet

For each row:

Extract:

Name

Phone

Address fields

Vehicle info (if present)

Any known dates (job date, request date)

Build an in-memory map:

ts
Copy code
interface IntermediateCustomer {
  tenantId: string;
  phone?: string;
  email?: string;
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  jobs: {
    date?: Date;
    value?: number;
  }[];
  importSources: Set<string>;
}

type CustomerMap = Map<string, IntermediateCustomer>; // keyed by phone for now
Key by (tenantId, phone) to start. If phone is missing, key by email or a synthetic key and mark for manual review.

4.2.2 Merge with Existing DB Customers
Using req.tenantDb with tenantId='root':

Fetch existing customers rows.

For each DB customer:

If phone matches an entry in CustomerMap:

Merge:

Prefer non-empty values.

Add any missing fields from DB.

Else:

Insert a new IntermediateCustomer into map.

Later, we will upsert all entries in this CustomerMap back into customers.

4.2.3 Augment with Appointments & Invoices
For each intermediate customer in CustomerMap:

Query appointments:

Completed appointments where customerId or phone matches (depending on existing schema).

Update:

firstJobDate = min(appointment dates).

lastJobDate = max(appointment dates).

totalJobs = count of completed appointments.

totalLifetimeValue = sum of associated invoice amounts (if available).

If the DB already has these fields, just ensure they are consistent and stored on the final customers rows.

4.2.4 (Optional v2) Augment with SMS History
If you have SMS HTML/import pipeline ready:

Extract phone numbers & names from SMS logs.

For any phone not already in CustomerMap:

Create a basic IntermediateCustomer with:

phone

name if you can detect patterns (“This is John”, etc.)

Mark importSource to include 'sms_history'.

This can be done now or as a follow-up pass.

4.3 Assign Households
Using normalizeAddress:

For each IntermediateCustomer with a usable address:

Normalize address → normalizedAddress.

Check if a households row exists for {tenantId='root', normalizedAddress}:

If yes, use that householdId.

If no, create a new row and use its id.

Store householdId on the intermediate record.

4.4 Upsert into customers Table
In a big transaction (or batched):

For each IntermediateCustomer, decide on a customerId:

If there is an existing DB record with matching (tenantId, phone):

Use that customerId.

Else:

Generate a new ID (or let serial auto-generate if applicable).

Perform an upsert:

Insert or update:

tenantId

id (if you manage this manually)

phone

email

name

Address fields

householdId

firstJobDate

lastJobDate

totalJobs

totalLifetimeValue

importSource:

Can be a joined string like: 'sheet,sms_history,db' or similar.

Use ON CONFLICT on (tenant_id, id) or (tenant_id, phone) depending on your schema.

Log progress in migrationLog:

type='customer_backfill'

tenantId='root'

notes with count of merged records, etc.

5. Existing vs New Customer Flags
Once upsert is done:

You can define “existing customer” as:

firstJobDate < WELCOME_BACK_LAUNCH_DATE (for Welcome Back).

For general logic:

isExistingCustomer = firstJobDate IS NOT NULL.

You can store this as:

A computed value when needed or

A column on customers if you want (e.g. isExistingCustomer).

This will be used by Phase 14’s promo rules and Phase 3/AI agents.

6. Admin Review & Cleanup
Create a simple admin-only view/page later (not required in first pass) that lists:

Possible duplicates:

Same tenantId, same normalizedAddress, different phones, very similar names.

“Needs review” flag:

If you want to handle weird cases slowly over time.

The backfill phase should not block on perfect deduping; 90–95% is enough to enable promos and AI.

7. Tests & QA
7.1 Dry Run Mode
Implement a “dry run” option on the backfill script:

Instead of writing to DB:

Log:

How many customers would be created.

How many would be updated.

How many households would be created.

Run this first.

7.2 Backup & Safety
Before running for real on production:

Snapshot DB (or at least customers, appointments, invoices).

Run on staging against a copy of the data if possible.

7.3 Manual Spot Checks
After running:

Pick 10–20 known regulars:

Verify:

Their name, phone, address look correct.

firstJobDate and lastJobDate match reality.

totalJobs seems right.

Pick a few random old customers (2+ years ago):

Confirm they exist in customers.