-- Audit T2 Task #20 (round 2): cookie→identity mapping for web-chat widget.
-- Backs /api/web-chat/resolve so the widget can recover its active
-- conversation on reload and on a second device once phone/email is linked.
CREATE TABLE IF NOT EXISTS "web_chat_identities" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
  "web_id" varchar(64) NOT NULL,
  "customer_id" integer REFERENCES "customers"("id"),
  "last_conversation_id" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "web_chat_identities_tenant_webid_unique"
  ON "web_chat_identities" ("tenant_id", "web_id");

CREATE INDEX IF NOT EXISTS "web_chat_identities_tenant_customer_idx"
  ON "web_chat_identities" ("tenant_id", "customer_id");
