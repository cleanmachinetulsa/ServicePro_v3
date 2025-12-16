-- Safe migration: Add missing portal_settings columns
-- This migration uses IF NOT EXISTS to be idempotent and non-destructive

ALTER TABLE portal_settings 
  ADD COLUMN IF NOT EXISTS landing_path varchar(100) DEFAULT '/portal',
  ADD COLUMN IF NOT EXISTS show_rewards boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS show_booking boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS show_services boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS show_contact boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS quiet_hours_start varchar(5) DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end varchar(5) DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS digest_frequency varchar(20) DEFAULT 'daily';
