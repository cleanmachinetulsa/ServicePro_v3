CREATE TYPE "public"."loyalty_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('trialing', 'active', 'past_due', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tenant_tier" AS ENUM('starter', 'pro', 'elite', 'internal');--> statement-breakpoint
CREATE TABLE "account_lockouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"locked_at" timestamp DEFAULT now(),
	"unlock_at" timestamp NOT NULL,
	"reason" text NOT NULL,
	"locked_by" integer,
	"unlocked" boolean DEFAULT false,
	"unlocked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"point_value" integer DEFAULT 0 NOT NULL,
	"criteria" text NOT NULL,
	"icon" text,
	"level" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"professionalism_level" integer DEFAULT 4 NOT NULL,
	"friendliness" integer DEFAULT 4 NOT NULL,
	"detail_orientation" integer DEFAULT 3 NOT NULL,
	"humor_level" integer DEFAULT 2 NOT NULL,
	"enthusiasm" integer DEFAULT 3 NOT NULL,
	"use_customer_name" boolean DEFAULT true NOT NULL,
	"ask_follow_up_questions" boolean DEFAULT true NOT NULL,
	"offer_suggestions" boolean DEFAULT true NOT NULL,
	"send_confirmation_messages" boolean DEFAULT true NOT NULL,
	"proactive_service_reminders" boolean DEFAULT true NOT NULL,
	"holiday_greetings" boolean DEFAULT true NOT NULL,
	"formality" integer DEFAULT 3 NOT NULL,
	"technical_terms" integer DEFAULT 2 NOT NULL,
	"message_length" integer DEFAULT 3 NOT NULL,
	"default_language" varchar(10) DEFAULT 'en' NOT NULL,
	"use_emojis" boolean DEFAULT true NOT NULL,
	"sms_opening_message" text DEFAULT 'Hi! Thanks for reaching out to Clean Machine Auto Detail. How can I help you today?' NOT NULL,
	"website_opening_message" text DEFAULT 'Welcome to Clean Machine! I''m here to help you schedule a detailing appointment or answer any questions.' NOT NULL,
	"facebook_opening_message" text DEFAULT 'Hey there! Thanks for messaging Clean Machine. What can I do for you?' NOT NULL,
	"known_holidays" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "ai_behavior_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"rule_key" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "api_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(50) NOT NULL,
	"api_type" varchar(100),
	"quantity" integer NOT NULL,
	"cost" numeric(10, 4) NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"position" varchar(50) NOT NULL,
	"resume_url" text,
	"cover_letter" text,
	"application_status" varchar(20) DEFAULT 'new' NOT NULL,
	"applied_at" timestamp DEFAULT now(),
	"source" varchar(30),
	"referred_by" integer,
	"experience_years" numeric(10, 1),
	"desired_pay" numeric(10, 2),
	"available_start_date" date,
	"interview_scheduled_at" timestamp,
	"interview_notes" text,
	"assigned_recruiter" integer,
	"rejection_reason" text,
	"status_updated_at" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointment_upsells" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"upsell_offer_id" integer NOT NULL,
	"offered_at" timestamp DEFAULT now(),
	"status" varchar(20) DEFAULT 'offered',
	"response_at" timestamp,
	"new_appointment_id" integer,
	"expiry_date" timestamp,
	"discount_applied" numeric
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"customer_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"completed" boolean DEFAULT false,
	"calendar_event_id" text,
	"reminder_sent" boolean DEFAULT false,
	"additional_requests" text[],
	"address" text NOT NULL,
	"add_ons" jsonb,
	"damage_assessment_status" varchar(20) DEFAULT 'none',
	"damage_photos" text[],
	"damage_description" text,
	"assessment_requested_at" timestamp,
	"assessment_reviewed_at" timestamp,
	"auto_approved_at" timestamp,
	"requester_contact_id" integer,
	"service_contact_id" integer,
	"vehicle_owner_contact_id" integer,
	"billing_contact_id" integer,
	"billing_type" varchar(20) DEFAULT 'self',
	"po_number" text,
	"deposit_percent" integer,
	"billing_status" varchar(30) DEFAULT 'pending',
	"share_price_with_requester" boolean DEFAULT true,
	"share_location_with_payer" boolean DEFAULT false,
	"is_gift" boolean DEFAULT false,
	"gift_message" text,
	"gift_card_code" text,
	"estimated_price" numeric(10, 2),
	"price_locked" boolean DEFAULT false,
	"price_locked_at" timestamp,
	"signed_authorization_id" integer,
	"notes_billing" text,
	"deposit_paid" boolean DEFAULT false,
	"deposit_amount" numeric(10, 2),
	"status" varchar(20) DEFAULT 'pending',
	"completed_at" timestamp,
	"service_type" text,
	"vehicle_make" text,
	"vehicle_model" text,
	"location" text,
	"sms_consent" boolean DEFAULT false,
	"sms_consent_timestamp" timestamp,
	"sms_consent_ip_address" text,
	"technician_id" integer,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"address_confirmed_by_customer" boolean DEFAULT false,
	"address_needs_review" boolean DEFAULT false,
	"job_notes" text,
	"status_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"technician_id" integer,
	"action_type" varchar(50) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" integer,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"changes" jsonb,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "authorizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"signer_contact_id" integer NOT NULL,
	"auth_type" varchar(30) NOT NULL,
	"token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"approval_status" varchar(20) DEFAULT 'pending',
	"approved_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"signature_data" text,
	"ip_address" text,
	"user_agent" text,
	"agreed_to_terms" boolean DEFAULT false,
	"otp_verified" boolean DEFAULT false,
	"otp_verified_at" timestamp,
	"referral_code" text,
	"referral_discount" numeric(10, 2),
	"referral_discount_type" varchar(30),
	"referral_referrer_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "authorizations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "banner_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"banner_id" integer NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"session_id" text,
	"user_agent" text,
	"page_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"title" text NOT NULL,
	"body_text" text NOT NULL,
	"display_mode" varchar(20) DEFAULT 'top_bar' NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"priority" integer DEFAULT 0,
	"page_targets" text[] DEFAULT '{}',
	"schedule_start" timestamp,
	"schedule_end" timestamp,
	"is_dismissible" boolean DEFAULT true,
	"tracking_key" text NOT NULL,
	"theme_color" varchar(20) DEFAULT 'blue',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "banners_tracking_key_unique" UNIQUE("tracking_key")
);
--> statement-breakpoint
CREATE TABLE "booking_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"quote_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"damage_type" text NOT NULL,
	"custom_quote_amount" numeric(10, 2),
	"issue_description" text,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"active_schedule_type" varchar(20) DEFAULT 'regular' NOT NULL,
	"start_hour" integer DEFAULT 9 NOT NULL,
	"start_minute" integer DEFAULT 0 NOT NULL,
	"end_hour" integer DEFAULT 15 NOT NULL,
	"end_minute" integer DEFAULT 0 NOT NULL,
	"summer_start_hour" integer DEFAULT 8 NOT NULL,
	"summer_start_minute" integer DEFAULT 0 NOT NULL,
	"summer_end_hour" integer DEFAULT 18 NOT NULL,
	"summer_end_minute" integer DEFAULT 0 NOT NULL,
	"winter_start_hour" integer DEFAULT 10 NOT NULL,
	"winter_start_minute" integer DEFAULT 0 NOT NULL,
	"winter_end_hour" integer DEFAULT 17 NOT NULL,
	"winter_end_minute" integer DEFAULT 0 NOT NULL,
	"enable_lunch_break" boolean DEFAULT true NOT NULL,
	"lunch_hour" integer DEFAULT 12 NOT NULL,
	"lunch_minute" integer DEFAULT 0 NOT NULL,
	"days_of_week" integer[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"allow_weekend_bookings" boolean DEFAULT false NOT NULL,
	"half_hour_increments" boolean DEFAULT true NOT NULL,
	"minimum_notice_hours" integer DEFAULT 24 NOT NULL,
	"max_drive_time_minutes" integer DEFAULT 26 NOT NULL,
	"eta_padding" integer DEFAULT 15 NOT NULL,
	"google_place_id" text DEFAULT '',
	"excluded_services" text[] DEFAULT '{}',
	"maintenance_mode" boolean DEFAULT false,
	"maintenance_message" text DEFAULT 'We''re currently performing maintenance. Please check back soon or contact us directly.',
	"backup_email" text,
	"alert_phone" text,
	"auto_failover_threshold" integer DEFAULT 5,
	"last_failover_at" timestamp,
	"sms_fallback_enabled" boolean DEFAULT false,
	"sms_fallback_phone" text,
	"sms_fallback_auto_reply" text DEFAULT 'Thanks for your message! Our automated system is currently offline. You''ll receive a personal response shortly.',
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "call_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"call_sid" text NOT NULL,
	"direction" varchar(20) NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"customer_phone" text,
	"status" varchar(20) NOT NULL,
	"duration" integer,
	"recording_url" text,
	"recording_sid" text,
	"transcription_text" text,
	"transcription_status" varchar(20),
	"answered_by" text,
	"price" numeric,
	"price_unit" varchar(10),
	"technician_id" integer,
	"appointment_id" integer,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"ended_at" timestamp,
	CONSTRAINT "call_events_call_sid_unique" UNIQUE("call_sid")
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"customer_id" integer,
	"email" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"complained_at" timestamp,
	"attempt_count" integer DEFAULT 0,
	"last_error" text,
	"message_sid" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cancellation_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"service_name" text NOT NULL,
	"appointment_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"category" varchar(30) NOT NULL,
	"additional_comments" text,
	"would_reschedule" boolean DEFAULT false,
	"wants_full_cancellation" boolean DEFAULT true,
	"wants_follow_up" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"follow_up_notes" text,
	"suggested_response" text,
	"response_status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"phone_display" text,
	"email" text,
	"company" text,
	"role_tags" jsonb DEFAULT '[]' NOT NULL,
	"address" text,
	"city" text,
	"state" varchar(2),
	"zip" varchar(10),
	"notification_prefs" jsonb DEFAULT '{"sms":true,"email":true}' NOT NULL,
	"verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"sms_opt_out" boolean DEFAULT false,
	"sms_opt_out_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "conversation_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"customer_id" integer,
	"customer_phone" text,
	"customer_name" text,
	"category" varchar(20) DEFAULT 'Other',
	"intent" varchar(30) DEFAULT 'Information Gathering',
	"needs_human_attention" boolean DEFAULT false,
	"resolved" boolean DEFAULT false,
	"last_message_time" timestamp DEFAULT now(),
	"platform" varchar(20) NOT NULL,
	"phone_line_id" integer,
	"facebook_sender_id" text,
	"facebook_page_id" text,
	"email_address" text,
	"email_thread_id" text,
	"email_subject" text,
	"control_mode" varchar(20) DEFAULT 'auto',
	"assigned_agent" text,
	"behavior_settings" jsonb,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"handoff_requested_at" timestamp,
	"manual_mode_started_at" timestamp,
	"last_agent_activity" timestamp,
	"handoff_reason" text,
	"appointment_id" integer,
	"unread_count" integer DEFAULT 0,
	"snoozed_until" timestamp,
	"sms_opt_out" boolean DEFAULT false,
	"sms_opt_out_at" timestamp,
	"starred" boolean DEFAULT false,
	"archived" boolean DEFAULT false,
	"pinned" boolean DEFAULT false,
	"pinned_at" timestamp,
	"archived_at" timestamp,
	"starred_at" timestamp,
	"human_escalation_active" boolean DEFAULT false NOT NULL,
	"human_escalation_requested_at" timestamp,
	"human_handled_at" timestamp,
	"human_handled_by" integer
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"credit_type" varchar(20) NOT NULL,
	"initial_amount" numeric(10, 2) NOT NULL,
	"current_balance" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" integer,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"used_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_ledger_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"invoice_id" integer,
	"description" text,
	"transaction_type" varchar(20) NOT NULL,
	"balance_before" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "critical_monitoring_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_channels" jsonb NOT NULL,
	"sms_recipients" text[] DEFAULT '{}' NOT NULL,
	"email_recipients" text[] DEFAULT '{}' NOT NULL,
	"push_roles" text[] DEFAULT '{"owner","manager"}' NOT NULL,
	"failure_threshold" integer DEFAULT 3 NOT NULL,
	"cooldown_minutes" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "customer_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"achievement_id" integer NOT NULL,
	"date_earned" timestamp DEFAULT now(),
	"notified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "customer_addon_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"addon_id" integer NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" integer,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"redeemed_at" timestamp,
	"redeemed_invoice_id" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "customer_milestone_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"milestone_id" integer NOT NULL,
	"current_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"completed_at" timestamp,
	"reward_granted" boolean DEFAULT false,
	"reward_audit_id" integer,
	"last_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_service_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"appointment_id" integer,
	"service_date" timestamp NOT NULL,
	"service_type" varchar(100) NOT NULL,
	"vehicle_id" integer,
	"technician_id" integer,
	"amount" numeric(10, 2),
	"satisfaction" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" varchar(20) DEFAULT 'blue' NOT NULL,
	"icon" text,
	"is_predefined" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customer_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "customer_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"year" varchar(4),
	"make" varchar(100),
	"model" varchar(100),
	"color" varchar(50),
	"license_plate" varchar(20),
	"vin" varchar(17),
	"notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"vehicle_info" text,
	"last_interaction" timestamp DEFAULT now(),
	"notes" text,
	"photo_folder_link" text,
	"loyalty_program_opt_in" boolean DEFAULT false,
	"loyalty_program_join_date" timestamp,
	"sms_consent" boolean DEFAULT false,
	"sms_consent_timestamp" timestamp,
	"sms_consent_ip_address" text,
	"loyalty_tier" "loyalty_tier" DEFAULT 'bronze',
	"has_priority_booking" boolean DEFAULT false,
	"priority_booking_granted_at" timestamp,
	"is_returning_customer" boolean DEFAULT false NOT NULL,
	"first_appointment_at" timestamp,
	"last_appointment_at" timestamp,
	"total_appointments" integer DEFAULT 0 NOT NULL,
	"lifetime_value" numeric(10, 2) DEFAULT '0.00',
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "daily_send_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"email_count" integer DEFAULT 0,
	"sms_count" integer DEFAULT 0,
	"email_limit" integer DEFAULT 50,
	"sms_limit" integer DEFAULT 200,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_send_counters_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"scheduled_date" timestamp,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"open_rate" numeric,
	"click_rate" numeric,
	"target_audience" varchar(30) DEFAULT 'all',
	"recipient_count" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "email_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"subscribed" boolean DEFAULT true,
	"subscribed_at" timestamp DEFAULT now(),
	"unsubscribed_at" timestamp,
	CONSTRAINT "email_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_suppression_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"reason" varchar(20) NOT NULL,
	"source" text,
	"added_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "email_suppression_list_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"category" varchar(30) DEFAULT 'general' NOT NULL,
	"last_used" timestamp
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"error_type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"endpoint" text,
	"user_id" text,
	"request_data" jsonb,
	"metadata" jsonb,
	"resolved" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extension_pool" (
	"id" serial PRIMARY KEY NOT NULL,
	"next_extension" integer DEFAULT 101 NOT NULL,
	"assigned_extensions" integer[],
	"last_updated" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "facebook_page_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"page_name" text NOT NULL,
	"page_access_token" text NOT NULL,
	"platform" varchar(20) DEFAULT 'facebook' NOT NULL,
	"is_active" boolean DEFAULT true,
	"webhook_verify_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "facebook_page_tokens_page_id_unique" UNIQUE("page_id")
);
--> statement-breakpoint
CREATE TABLE "faq_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"category" varchar(50) NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"keywords" text[],
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "follow_up_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"cancellation_id" integer,
	"reminder_date" timestamp NOT NULL,
	"reminder_type" varchar(30) DEFAULT 'reschedule_check',
	"message" text,
	"status" varchar(20) DEFAULT 'pending',
	"sent_at" timestamp,
	"response_received" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gallery_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"title" text,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"uploaded_at" timestamp DEFAULT now(),
	"uploaded_by" integer,
	"tenant_id" varchar(50) DEFAULT '1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"initial_value" numeric(10, 2) NOT NULL,
	"current_balance" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"purchased_by" text,
	"purchased_by_email" text,
	"purchased_by_phone" text,
	"recipient_name" text,
	"recipient_email" text,
	"gift_message" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"redeemed_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "gift_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "homepage_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" varchar(50) DEFAULT 'current' NOT NULL,
	"layout_settings" jsonb,
	"hero_heading" text DEFAULT 'Clean Machine Auto Detail' NOT NULL,
	"hero_subheading" text DEFAULT 'Professional Mobile Auto Detailing' NOT NULL,
	"hero_cta_text" text DEFAULT 'Book Now' NOT NULL,
	"hero_cta_link" text DEFAULT '/booking' NOT NULL,
	"about_heading" text DEFAULT 'About Us' NOT NULL,
	"about_text" text DEFAULT 'Premium auto detailing services...' NOT NULL,
	"services_heading" text DEFAULT 'Our Services' NOT NULL,
	"services_subheading" text,
	"primary_color" varchar(50) DEFAULT '220 90% 56%' NOT NULL,
	"secondary_color" varchar(50) DEFAULT '280 80% 60%' NOT NULL,
	"accent_color" varchar(50) DEFAULT '340 80% 55%' NOT NULL,
	"logo_url" text,
	"meta_title" text DEFAULT 'Clean Machine Auto Detail' NOT NULL,
	"meta_description" text DEFAULT 'Professional auto detailing services' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "human_escalation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"customer_name" varchar(255),
	"trigger_phrase" varchar(500),
	"trigger_message_id" integer,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"recent_message_summary" text,
	"customer_vehicle" varchar(255),
	"last_service_date" timestamp,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"sms_notification_sent" boolean DEFAULT false NOT NULL,
	"push_notification_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer,
	"customer_id" integer NOT NULL,
	"invoice_type" varchar(20) DEFAULT 'appointment' NOT NULL,
	"amount" numeric NOT NULL,
	"status" varchar(20) DEFAULT 'unpaid' NOT NULL,
	"payment_status" varchar(20) DEFAULT 'unpaid' NOT NULL,
	"payment_method" varchar(20),
	"stripe_payment_intent_id" text,
	"paypal_order_id" text,
	"created_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"notes" text,
	"service_description" text NOT NULL,
	"review_request_sent" boolean DEFAULT false,
	"review_requested_at" timestamp,
	"follow_up_sent" boolean DEFAULT false,
	"bill_to_contact_id" integer,
	"subtotal" numeric(10, 2),
	"tax_amount" numeric(10, 2),
	"total_amount" numeric(10, 2),
	"deposit_amount" numeric(10, 2),
	"deposit_paid_at" timestamp,
	"balance_due" numeric(10, 2),
	"due_date" timestamp,
	"invoice_sent_at" timestamp,
	"last_reminder_sent" timestamp,
	"reminder_count" integer DEFAULT 0,
	"referral_code" varchar(20),
	"referral_discount" numeric(10, 2),
	"referral_reward_type" varchar(30),
	"referral_reward_value" numeric(10, 2),
	"referral_original_amount" numeric(10, 2),
	"technician_id" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_posting_id" integer,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"resume_url" text,
	"cover_letter" text,
	"linkedin_url" varchar(255),
	"portfolio_url" varchar(255),
	"years_experience" integer,
	"current_company" varchar(200),
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"notes" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"technician_id" integer,
	"photo_url" text NOT NULL,
	"photo_type" varchar(30) DEFAULT 'progress' NOT NULL,
	"caption" text,
	"file_name" text,
	"file_size" integer,
	"mime_type" varchar(50),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"department" varchar(100),
	"location" varchar(100),
	"employment_type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"requirements" text,
	"benefits" text,
	"salary_range" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"ip_address" text NOT NULL,
	"successful" boolean NOT NULL,
	"failure_reason" text,
	"user_agent" text,
	"attempted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loyalty_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "loyalty_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"point_threshold" integer NOT NULL,
	"benefits" text[],
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "message_edit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"previous_content" text NOT NULL,
	"new_content" text NOT NULL,
	"edited_by" integer,
	"edited_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"content" text NOT NULL,
	"tenant_id" varchar(50) DEFAULT '1' NOT NULL,
	"sender" varchar(20) NOT NULL,
	"from_customer" boolean NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"topics" text[],
	"channel" varchar(10),
	"phone_line_id" integer,
	"is_automated" boolean DEFAULT false,
	"edited" boolean DEFAULT false,
	"edited_at" timestamp,
	"delivery_status" varchar(20) DEFAULT 'sent',
	"read_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "milestone_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"milestone_type" varchar(30) NOT NULL,
	"target_value" numeric(10, 2) NOT NULL,
	"reward_type" varchar(30) NOT NULL,
	"reward_value" text,
	"is_active" boolean DEFAULT true,
	"is_repeatable" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"voicemail_sms" boolean DEFAULT true NOT NULL,
	"voicemail_push" boolean DEFAULT true NOT NULL,
	"cash_payment_sms" boolean DEFAULT true NOT NULL,
	"cash_payment_push" boolean DEFAULT true NOT NULL,
	"system_error_sms" boolean DEFAULT true NOT NULL,
	"system_error_push" boolean DEFAULT true NOT NULL,
	"missed_call_sms" boolean DEFAULT false NOT NULL,
	"appointment_reminder_push" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"config" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "notification_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "oauth_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"profile_image_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "org_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"invoice_id" integer,
	"contact_id" integer NOT NULL,
	"link_type" varchar(20) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"stripe_payment_link_id" text NOT NULL,
	"public_url" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"sent_via" varchar(20),
	"sent_at" timestamp,
	"last_reminder_sent" timestamp,
	"reminder_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "phone_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"label" varchar(100) NOT NULL,
	"forwarding_enabled" boolean DEFAULT true,
	"forwarding_number" varchar(20),
	"ring_duration" integer DEFAULT 10,
	"voicemail_greeting" text,
	"voicemail_greeting_url" text,
	"after_hours_voicemail_greeting" text,
	"after_hours_voicemail_greeting_url" text,
	"sip_enabled" boolean DEFAULT false,
	"sip_endpoint" text,
	"sip_credential_sid" text,
	"sip_fallback_number" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "phone_lines_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "phone_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_line_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"action" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"demo_mode_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"loyalty_points_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"transaction_date" timestamp DEFAULT now(),
	"transaction_type" varchar(20) NOT NULL,
	"source" varchar(30) NOT NULL,
	"source_id" integer,
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "pto_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" integer NOT NULL,
	"request_type" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_days" numeric(10, 1) NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "qr_code_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"action_type" varchar(50) DEFAULT 'booking' NOT NULL,
	"action_url" text NOT NULL,
	"tracking_enabled" boolean DEFAULT true NOT NULL,
	"scans" integer DEFAULT 0 NOT NULL,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quick_reply_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quick_reply_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"content" text NOT NULL,
	"shortcut" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"last_used" timestamp
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"phone" text NOT NULL,
	"customer_name" text NOT NULL,
	"issue_description" text NOT NULL,
	"damage_type" varchar(50) NOT NULL,
	"photo_urls" text[],
	"third_party_payer_name" text,
	"third_party_payer_email" text,
	"third_party_payer_phone" text,
	"po_number" text,
	"status" varchar(30) DEFAULT 'pending_review' NOT NULL,
	"custom_quote_amount" numeric(10, 2),
	"quote_notes" text,
	"approver_type" varchar(20),
	"approval_token" text,
	"approved_at" timestamp,
	"declined_at" timestamp,
	"declined_reason" text,
	"completed_at" timestamp,
	"actual_time_spent" numeric(4, 2),
	"difficulty_rating" integer,
	"lesson_learned" text,
	"created_at" timestamp DEFAULT now(),
	"quoted_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	"appointment_id" integer,
	CONSTRAINT "quote_requests_approval_token_unique" UNIQUE("approval_token")
);
--> statement-breakpoint
CREATE TABLE "recurring_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"frequency" varchar(30) NOT NULL,
	"interval_type" varchar(30),
	"next_scheduled_date" date,
	"auto_renew" boolean DEFAULT true,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"preferred_time" text,
	"preferred_day_of_week" integer,
	"preferred_day_of_month" integer,
	"interval_custom_dates" text[],
	"deferred_until" timestamp,
	"booking_token" varchar(50),
	"token_expires_at" timestamp,
	"notes" text,
	"pause_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"paused_at" timestamp,
	"cancelled_at" timestamp,
	"last_appointment_created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "redeemed_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"reward_service_id" integer NOT NULL,
	"points_spent" integer NOT NULL,
	"redeemed_date" timestamp DEFAULT now(),
	"status" varchar(20) DEFAULT 'pending',
	"appointment_id" integer,
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "referral_program_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"referrer_reward_type" varchar(30) DEFAULT 'loyalty_points' NOT NULL,
	"referrer_reward_amount" numeric(10, 2) DEFAULT '500' NOT NULL,
	"referrer_reward_service_id" integer,
	"referrer_reward_expiry_days" integer,
	"referrer_reward_notes" text,
	"referee_reward_type" varchar(30) DEFAULT 'fixed_discount' NOT NULL,
	"referee_reward_amount" numeric(10, 2) DEFAULT '25' NOT NULL,
	"referee_reward_service_id" integer,
	"referee_reward_expiry_days" integer,
	"referee_reward_notes" text,
	"code_expiry_days" integer DEFAULT 90,
	"max_uses_per_code" integer DEFAULT 1,
	"milestones_enabled" boolean DEFAULT false,
	"milestone_config" jsonb DEFAULT '[]',
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referral_code" varchar(20) NOT NULL,
	"referee_phone" varchar(20),
	"referee_email" text,
	"referee_name" text,
	"referee_customer_id" integer,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"points_awarded" integer DEFAULT 500,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"signed_up_at" timestamp,
	"completed_at" timestamp,
	"rewarded_at" timestamp,
	"rewarded_invoice_id" integer,
	"notes" text,
	CONSTRAINT "referrals_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "reminder_consent" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"consent_type" varchar(20) NOT NULL,
	"consent_given" boolean DEFAULT true NOT NULL,
	"consented_at" timestamp DEFAULT now(),
	"consent_source" text,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reminder_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"message_content" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"rule_id" integer NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"message_content" text,
	"last_attempt_at" timestamp,
	"attempts_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reminder_opt_outs" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"opted_out_at" timestamp DEFAULT now(),
	"reason" text,
	"channel" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"service_id" integer,
	"trigger_type" varchar(30) NOT NULL,
	"trigger_interval_days" integer,
	"reminder_window_days" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_snoozes" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"snoozed_until" timestamp NOT NULL,
	"snooze_duration" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reward_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"reward_role" varchar(20) NOT NULL,
	"reward_type" varchar(30) NOT NULL,
	"reward_amount" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp,
	"expires_at" timestamp,
	"invoice_id" integer,
	"transaction_id" integer,
	"metadata" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reward_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"point_cost" integer NOT NULL,
	"tier" varchar(20) NOT NULL,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer,
	"content" text NOT NULL,
	"channel" varchar(20),
	"scheduled_for" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"metadata" jsonb,
	"sent_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"value" numeric(10, 2) NOT NULL,
	"category" varchar(50),
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"last_check" timestamp NOT NULL,
	"last_success" timestamp,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"response_time" integer,
	"api_key_expiry" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_health_service_unique" UNIQUE("service")
);
--> statement-breakpoint
CREATE TABLE "service_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"daily_limit" integer NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"name" text NOT NULL,
	"price_range" text NOT NULL,
	"overview" text NOT NULL,
	"detailed_description" text NOT NULL,
	"duration" text NOT NULL,
	"duration_hours" numeric NOT NULL,
	"min_duration_hours" numeric DEFAULT '1.5' NOT NULL,
	"max_duration_hours" numeric DEFAULT '2' NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration_hours" numeric NOT NULL,
	"color" varchar(20) DEFAULT 'blue',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_shift_id" integer NOT NULL,
	"offering_tech_id" integer NOT NULL,
	"requesting_tech_id" integer,
	"trade_type" varchar(20) NOT NULL,
	"swap_shift_id" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"message" text,
	"requested_at" timestamp DEFAULT now(),
	"accepted_at" timestamp,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" integer,
	"template_id" integer,
	"shift_date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"assigned_appointments" integer[],
	"appointment_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_campaign_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"customer_id" integer,
	"phone_number" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"attempt_count" integer DEFAULT 0,
	"last_error" text,
	"twilio_sid" text,
	"delivery_status_id" integer,
	"timezone" text DEFAULT 'America/Chicago',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"scheduled_date" timestamp,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"target_audience" varchar(30) DEFAULT 'all',
	"recipient_count" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"from_number" text,
	"estimated_segments" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "sms_delivery_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_sid" text NOT NULL,
	"conversation_id" integer,
	"message_id" integer,
	"to" text NOT NULL,
	"from" text NOT NULL,
	"body" text,
	"status" varchar(20) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"price" numeric,
	"price_unit" varchar(10),
	"error_code" integer,
	"error_message" text,
	"num_segments" integer,
	"created_at" timestamp DEFAULT now(),
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sms_delivery_status_message_sid_unique" UNIQUE("message_sid")
);
--> statement-breakpoint
CREATE TABLE "sms_template_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"tenant_id" integer DEFAULT 1 NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb NOT NULL,
	"change_description" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) DEFAULT 'root' NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"channel" varchar(20) DEFAULT 'sms' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"body" text NOT NULL,
	"variables" jsonb NOT NULL,
	"default_payload" jsonb,
	"enabled" boolean DEFAULT true,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"description" text,
	"monthly_cost" numeric(10, 2) NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"renewal_date" date,
	"website" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "technician_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"available" boolean DEFAULT true,
	"preferred_start_time" text,
	"preferred_end_time" text,
	"max_hours_per_day" numeric(10, 1),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" integer NOT NULL,
	"deposit_date" date NOT NULL,
	"cash_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"check_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"invoice_ids" integer[],
	"notes" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"deposited_at" timestamp,
	"deposited_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"public_id" text NOT NULL,
	"preferred_name" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"city" text,
	"photo_url" text,
	"photo_thumb_96" text,
	"photo_card_320" text,
	"photo_mms_640" text,
	"bio_about" text,
	"bio_tags" jsonb,
	"bio_raw" text,
	"bio_ai_last_revision" text,
	"consent_public_profile" boolean DEFAULT true,
	"profile_reviewed" boolean DEFAULT false,
	"profile_reviewed_at" timestamp,
	"profile_reviewed_by" integer,
	"profile_rejection_reason" text,
	"role" varchar(20) DEFAULT 'technician' NOT NULL,
	"employment_status" varchar(20) DEFAULT 'active' NOT NULL,
	"hire_date" date,
	"termination_date" date,
	"hourly_rate" numeric(10, 2),
	"skill_level" integer DEFAULT 1,
	"specialties" text[],
	"max_jobs_per_day" integer DEFAULT 6,
	"generated_email" varchar(255),
	"phone_extension" integer,
	"provisioning_status" varchar(20) DEFAULT 'pending',
	"provisioning_error" text,
	"provisioned_at" timestamp,
	"provisioned_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "technicians_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_config" (
	"tenant_id" varchar(50) PRIMARY KEY NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(20) DEFAULT '#3b82f6',
	"tier" "tenant_tier" DEFAULT 'starter' NOT NULL,
	"industry" varchar(100),
	"industry_config" jsonb,
	"primary_contact_email" varchar(255),
	"primary_city" varchar(100),
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_phone_config" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(50) NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"messaging_service_sid" varchar(255),
	"sip_domain" varchar(255),
	"sip_username" varchar(255),
	"sip_password_encrypted" varchar(255),
	"ivr_mode" varchar(50) DEFAULT 'simple',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_phone_config_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"subdomain" varchar(100),
	"is_root" boolean DEFAULT false NOT NULL,
	"plan_tier" "tenant_tier" DEFAULT 'starter' NOT NULL,
	"status" "tenant_status" DEFAULT 'trialing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" integer NOT NULL,
	"shift_id" integer,
	"clock_in_time" timestamp NOT NULL,
	"clock_out_time" timestamp,
	"clock_in_latitude" numeric(10, 7),
	"clock_in_longitude" numeric(10, 7),
	"clock_out_latitude" numeric(10, 7),
	"clock_out_longitude" numeric(10, 7),
	"clock_in_address" text,
	"clock_out_address" text,
	"geofence_verified" boolean DEFAULT false,
	"total_hours" numeric(10, 2),
	"break_minutes" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"flag_reason" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "totp_secrets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"backup_codes" text[],
	"created_at" timestamp DEFAULT now(),
	"enabled_at" timestamp,
	"last_used_at" timestamp,
	CONSTRAINT "totp_secrets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "upsell_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"service_id" integer,
	"add_on_service" boolean DEFAULT false,
	"discount_percentage" numeric,
	"discount_amount" numeric,
	"active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"minimum_purchase_amount" numeric,
	"applicable_service_ids" text[],
	"validity_days" integer DEFAULT 3
);
--> statement-breakpoint
CREATE TABLE "usage_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(50) NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_start" date NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"role" varchar(20) DEFAULT 'employee' NOT NULL,
	"full_name" text,
	"operator_name" text,
	"require_password_change" boolean DEFAULT false,
	"last_password_change" timestamp,
	"is_active" boolean DEFAULT true,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[],
	"device_name" text,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account_lockouts" ADD CONSTRAINT "account_lockouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_preferences" ADD CONSTRAINT "agent_preferences_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_behavior_rules" ADD CONSTRAINT "ai_behavior_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_referred_by_technicians_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_assigned_recruiter_users_id_fk" FOREIGN KEY ("assigned_recruiter") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_upsells" ADD CONSTRAINT "appointment_upsells_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_upsells" ADD CONSTRAINT "appointment_upsells_upsell_offer_id_upsell_offers_id_fk" FOREIGN KEY ("upsell_offer_id") REFERENCES "public"."upsell_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_upsells" ADD CONSTRAINT "appointment_upsells_new_appointment_id_appointments_id_fk" FOREIGN KEY ("new_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_signer_contact_id_contacts_id_fk" FOREIGN KEY ("signer_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_metrics" ADD CONSTRAINT "banner_metrics_banner_id_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."banners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_feedback" ADD CONSTRAINT "cancellation_feedback_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_feedback" ADD CONSTRAINT "cancellation_feedback_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_tag_id_customer_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."customer_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_phone_line_id_phone_lines_id_fk" FOREIGN KEY ("phone_line_id") REFERENCES "public"."phone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_human_handled_by_users_id_fk" FOREIGN KEY ("human_handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_ledger_id_credit_ledger_id_fk" FOREIGN KEY ("credit_ledger_id") REFERENCES "public"."credit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_monitoring_settings" ADD CONSTRAINT "critical_monitoring_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_achievements" ADD CONSTRAINT "customer_achievements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_achievements" ADD CONSTRAINT "customer_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addon_credits" ADD CONSTRAINT "customer_addon_credits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addon_credits" ADD CONSTRAINT "customer_addon_credits_addon_id_service_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addon_credits" ADD CONSTRAINT "customer_addon_credits_redeemed_invoice_id_invoices_id_fk" FOREIGN KEY ("redeemed_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_milestone_progress" ADD CONSTRAINT "customer_milestone_progress_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_milestone_progress" ADD CONSTRAINT "customer_milestone_progress_milestone_id_milestone_definitions_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_history" ADD CONSTRAINT "customer_service_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_history" ADD CONSTRAINT "customer_service_history_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_history" ADD CONSTRAINT "customer_service_history_vehicle_id_customer_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."customer_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_history" ADD CONSTRAINT "customer_service_history_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_pool" ADD CONSTRAINT "extension_pool_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facebook_page_tokens" ADD CONSTRAINT "facebook_page_tokens_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_cancellation_id_cancellation_feedback_id_fk" FOREIGN KEY ("cancellation_id") REFERENCES "public"."cancellation_feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_escalation_requests" ADD CONSTRAINT "human_escalation_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_escalation_requests" ADD CONSTRAINT "human_escalation_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_escalation_requests" ADD CONSTRAINT "human_escalation_requests_trigger_message_id_messages_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_edit_history" ADD CONSTRAINT "message_edit_history_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_edit_history" ADD CONSTRAINT "message_edit_history_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_phone_line_id_phone_lines_id_fk" FOREIGN KEY ("phone_line_id") REFERENCES "public"."phone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_providers" ADD CONSTRAINT "oauth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_schedules" ADD CONSTRAINT "phone_schedules_phone_line_id_phone_lines_id_fk" FOREIGN KEY ("phone_line_id") REFERENCES "public"."phone_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_loyalty_points_id_loyalty_points_id_fk" FOREIGN KEY ("loyalty_points_id") REFERENCES "public"."loyalty_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pto_requests" ADD CONSTRAINT "pto_requests_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pto_requests" ADD CONSTRAINT "pto_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_code_actions" ADD CONSTRAINT "qr_code_actions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_reply_templates" ADD CONSTRAINT "quick_reply_templates_category_id_quick_reply_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."quick_reply_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_services" ADD CONSTRAINT "recurring_services_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_services" ADD CONSTRAINT "recurring_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeemed_rewards" ADD CONSTRAINT "redeemed_rewards_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeemed_rewards" ADD CONSTRAINT "redeemed_rewards_reward_service_id_reward_services_id_fk" FOREIGN KEY ("reward_service_id") REFERENCES "public"."reward_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeemed_rewards" ADD CONSTRAINT "redeemed_rewards_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_program_config" ADD CONSTRAINT "referral_program_config_referrer_reward_service_id_services_id_fk" FOREIGN KEY ("referrer_reward_service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_program_config" ADD CONSTRAINT "referral_program_config_referee_reward_service_id_services_id_fk" FOREIGN KEY ("referee_reward_service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_program_config" ADD CONSTRAINT "referral_program_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_customers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_customer_id_customers_id_fk" FOREIGN KEY ("referee_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_consent" ADD CONSTRAINT "reminder_consent_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_events" ADD CONSTRAINT "reminder_events_job_id_reminder_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."reminder_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_events" ADD CONSTRAINT "reminder_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_rule_id_reminder_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."reminder_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_opt_outs" ADD CONSTRAINT "reminder_opt_outs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_snoozes" ADD CONSTRAINT "reminder_snoozes_job_id_reminder_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."reminder_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_snoozes" ADD CONSTRAINT "reminder_snoozes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_audit" ADD CONSTRAINT "reward_audit_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_audit" ADD CONSTRAINT "reward_audit_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_audit" ADD CONSTRAINT "reward_audit_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_audit" ADD CONSTRAINT "reward_audit_transaction_id_points_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."points_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_limits" ADD CONSTRAINT "service_limits_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_limits" ADD CONSTRAINT "service_limits_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_original_shift_id_shifts_id_fk" FOREIGN KEY ("original_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_offering_tech_id_technicians_id_fk" FOREIGN KEY ("offering_tech_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_requesting_tech_id_technicians_id_fk" FOREIGN KEY ("requesting_tech_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_swap_shift_id_shifts_id_fk" FOREIGN KEY ("swap_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_template_id_shift_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."shift_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaign_recipients" ADD CONSTRAINT "sms_campaign_recipients_campaign_id_sms_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaign_recipients" ADD CONSTRAINT "sms_campaign_recipients_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaign_recipients" ADD CONSTRAINT "sms_campaign_recipients_delivery_status_id_sms_delivery_status_id_fk" FOREIGN KEY ("delivery_status_id") REFERENCES "public"."sms_delivery_status"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_delivery_status" ADD CONSTRAINT "sms_delivery_status_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_delivery_status" ADD CONSTRAINT "sms_delivery_status_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_template_versions" ADD CONSTRAINT "sms_template_versions_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_template_versions" ADD CONSTRAINT "sms_template_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_deposits" ADD CONSTRAINT "technician_deposits_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_deposits" ADD CONSTRAINT "technician_deposits_deposited_by_users_id_fk" FOREIGN KEY ("deposited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_profile_reviewed_by_users_id_fk" FOREIGN KEY ("profile_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_provisioned_by_users_id_fk" FOREIGN KEY ("provisioned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_config" ADD CONSTRAINT "tenant_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_phone_config" ADD CONSTRAINT "tenant_phone_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_secrets" ADD CONSTRAINT "totp_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upsell_offers" ADD CONSTRAINT "upsell_offers_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_lockouts_user_id_idx" ON "account_lockouts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_behavior_rules_tenant_id_rule_key_unique" ON "ai_behavior_rules" USING btree ("tenant_id","rule_key");--> statement-breakpoint
CREATE INDEX "api_usage_logs_service_idx" ON "api_usage_logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "api_usage_logs_timestamp_idx" ON "api_usage_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "appointments_technician_schedule_idx" ON "appointments" USING btree ("technician_id","scheduled_time");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "banner_metrics_lookup_idx" ON "banner_metrics" USING btree ("banner_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "banner_active_schedule_idx" ON "banners" USING btree ("is_active","schedule_start","schedule_end");--> statement-breakpoint
CREATE INDEX "booking_tokens_token_idx" ON "booking_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "booking_tokens_expires_at_idx" ON "booking_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "call_events_from_idx" ON "call_events" USING btree ("from");--> statement-breakpoint
CREATE INDEX "call_events_to_idx" ON "call_events" USING btree ("to");--> statement-breakpoint
CREATE INDEX "call_events_conversation_idx" ON "call_events" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "call_events_technician_idx" ON "call_events" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "call_events_status_created_idx" ON "call_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "call_events_recording_sid_idx" ON "call_events" USING btree ("recording_sid");--> statement-breakpoint
CREATE INDEX "campaign_recipients_status_idx" ON "campaign_recipients" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "campaign_recipients_email_idx" ON "campaign_recipients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "campaign_recipients_message_sid_idx" ON "campaign_recipients" USING btree ("message_sid");--> statement-breakpoint
CREATE INDEX "conversations_email_thread_idx" ON "conversations" USING btree ("platform","email_thread_id");--> statement-breakpoint
CREATE INDEX "conversations_email_address_idx" ON "conversations" USING btree ("platform","email_address");--> statement-breakpoint
CREATE INDEX "conversations_phone_line_idx" ON "conversations" USING btree ("phone_line_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_customer_status_idx" ON "credit_ledger" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "credit_ledger_expiry_idx" ON "credit_ledger" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "addon_credits_customer_status_idx" ON "customer_addon_credits" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "milestone_progress_customer_milestone_idx" ON "customer_milestone_progress" USING btree ("customer_id","milestone_id");--> statement-breakpoint
CREATE INDEX "milestone_progress_completed_idx" ON "customer_milestone_progress" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_send_counters_date_idx" ON "daily_send_counters" USING btree ("date");--> statement-breakpoint
CREATE INDEX "email_suppression_email_idx" ON "email_suppression_list" USING btree ("email");--> statement-breakpoint
CREATE INDEX "human_escalation_requests_conversation_idx" ON "human_escalation_requests" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "human_escalation_requests_status_idx" ON "human_escalation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "human_escalation_requests_expires_at_idx" ON "human_escalation_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "job_photos_appointment_id_idx" ON "job_photos" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "job_photos_technician_id_idx" ON "job_photos" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "login_attempts_username_idx" ON "login_attempts" USING btree ("username");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "login_attempts_attempted_at_idx" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "message_edit_history_message_idx" ON "message_edit_history" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_unique_idx" ON "message_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "message_reactions_message_idx" ON "message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_unique_idx" ON "oauth_providers" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "oauth_providers_user_id_idx" ON "oauth_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "phone_lines_phone_number_idx" ON "phone_lines" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "phone_schedules_phone_line_id_idx" ON "phone_schedules" USING btree ("phone_line_id");--> statement-breakpoint
CREATE INDEX "phone_schedules_day_of_week_idx" ON "phone_schedules" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "qr_code_actions_customer_id_idx" ON "qr_code_actions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reminder_consent_customer_consent_idx" ON "reminder_consent" USING btree ("customer_id","consent_type");--> statement-breakpoint
CREATE INDEX "reminder_consent_given_idx" ON "reminder_consent" USING btree ("consent_given");--> statement-breakpoint
CREATE INDEX "reminder_events_job_id_idx" ON "reminder_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "reminder_events_customer_idx" ON "reminder_events" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reminder_events_event_type_idx" ON "reminder_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "reminder_jobs_customer_idx" ON "reminder_jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reminder_jobs_rule_idx" ON "reminder_jobs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "reminder_jobs_status_scheduled_idx" ON "reminder_jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "reminder_opt_outs_customer_idx" ON "reminder_opt_outs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reminder_opt_outs_channel_idx" ON "reminder_opt_outs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "reminder_rules_service_id_idx" ON "reminder_rules" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "reminder_rules_enabled_idx" ON "reminder_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "reminder_snoozes_job_id_idx" ON "reminder_snoozes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "reminder_snoozes_customer_idx" ON "reminder_snoozes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reminder_snoozes_snoozed_until_idx" ON "reminder_snoozes" USING btree ("snoozed_until");--> statement-breakpoint
CREATE INDEX "reward_audit_referral_id_idx" ON "reward_audit" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "reward_audit_customer_id_idx" ON "reward_audit" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reward_audit_status_idx" ON "reward_audit" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_messages_status_scheduled_idx" ON "scheduled_messages" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "service_limit_lookup_idx" ON "service_limits" USING btree ("service_id","is_active","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "service_limit_unique_idx" ON "service_limits" USING btree ("service_id","effective_from","effective_to","is_active");--> statement-breakpoint
CREATE INDEX "sms_campaign_recipients_status_idx" ON "sms_campaign_recipients" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "sms_campaign_recipients_phone_idx" ON "sms_campaign_recipients" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "sms_campaign_recipients_twilio_sid_idx" ON "sms_campaign_recipients" USING btree ("twilio_sid");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_templates_tenant_id_template_key_unique" ON "sms_templates" USING btree ("tenant_id","template_key");--> statement-breakpoint
CREATE INDEX "technician_deposits_tech_date_idx" ON "technician_deposits" USING btree ("technician_id","deposit_date");--> statement-breakpoint
CREATE INDEX "technician_deposits_status_idx" ON "technician_deposits" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "technicians_phone_extension_unique_idx" ON "technicians" USING btree ("phone_extension");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_phone_config_phone_number_idx" ON "tenant_phone_config" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "tenant_phone_config_tenant_id_idx" ON "tenant_phone_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_created_by_idx" ON "users" USING btree ("created_by");