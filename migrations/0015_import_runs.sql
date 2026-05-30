-- Import-run ledger (additive, non-destructive).
-- One row per data-import run so re-runs are detectable and the script can
-- refuse to silently double-import. Used by scripts/importTwilioAudit.ts.
-- Apply with: psql "$DATABASE_URL" -f migrations/0015_import_runs.sql

CREATE TABLE IF NOT EXISTS import_runs (
  id           serial PRIMARY KEY,
  run_key      varchar(255) NOT NULL,
  tenant_id    varchar(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_at   timestamp    NOT NULL DEFAULT now(),
  ended_at     timestamp,
  summary_json jsonb,
  created_at   timestamp    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS import_runs_run_key_idx ON import_runs (run_key);
CREATE INDEX IF NOT EXISTS import_runs_tenant_idx ON import_runs (tenant_id);
