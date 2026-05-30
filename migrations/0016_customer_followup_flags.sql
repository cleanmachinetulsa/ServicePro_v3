-- 0016_customer_followup_flags.sql
-- Additive only. No drops, no type changes, no column removals.
-- Adds follow-up flags used by the one-off Twilio audit importer so the owner
-- can pull a "missed contact during outage" follow-up list from the dashboard.
--   needs_followup : true for imported leads the owner must personally follow up on
--   import_note    : free-text provenance (e.g. 'missed_call_during_outage')
ALTER TABLE customers ADD COLUMN IF NOT EXISTS needs_followup boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS import_note text;
