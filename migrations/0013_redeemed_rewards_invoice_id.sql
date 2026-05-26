-- DEF-8: add structured invoice link to redeemed_rewards.
-- Stage L4 Step 2 (loyalty rebuild). Additive, nullable, no backfill.
-- Existing rows are L1-era test data and legitimately have no invoice;
-- future un-applied reservations also legitimately have no invoice yet.
-- invoices.id is serial (integer) — FK type matches exactly.

ALTER TABLE redeemed_rewards
  ADD COLUMN IF NOT EXISTS invoice_id integer
  REFERENCES invoices(id);
