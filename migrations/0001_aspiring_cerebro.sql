CREATE TABLE "campaign_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) NOT NULL,
	"campaign_key" varchar(100) NOT NULL,
	"config_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"customer_id" integer NOT NULL,
	"campaign_key" varchar(100) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) NOT NULL,
	"user_id" integer,
	"layout" jsonb NOT NULL,
	"layout_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_vip" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_seen_dashboard_tour" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "campaign_configs" ADD CONSTRAINT "campaign_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_configs_tenant_campaign_idx" ON "campaign_configs" USING btree ("tenant_id","campaign_key");--> statement-breakpoint
CREATE INDEX "campaign_sends_tenant_customer_campaign_idx" ON "campaign_sends" USING btree ("tenant_id","customer_id","campaign_key");--> statement-breakpoint
CREATE INDEX "campaign_sends_sent_at_idx" ON "campaign_sends" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_layouts_tenant_user_idx" ON "dashboard_layouts" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "dashboard_layouts_user_id_idx" ON "dashboard_layouts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faq_entries_tenant_id_category_question_unique" ON "faq_entries" USING btree ("tenant_id","category","question");