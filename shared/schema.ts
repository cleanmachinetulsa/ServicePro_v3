import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, jsonb, date, index, uniqueIndex, foreignKey, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* Define all tables first */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email"),
  role: varchar("role", { length: 20 }).notNull().default("employee"), // employee, manager, owner
  fullName: text("full_name"),
  operatorName: text("operator_name"), // Name used in template variables (e.g., "Jody" instead of full name)
  requirePasswordChange: boolean("require_password_change").default(false),
  lastPasswordChange: timestamp("last_password_change"),
  isActive: boolean("is_active").default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  hasSeenDashboardTour: boolean("has_seen_dashboard_tour").default(false), // Track if user has completed the dashboard onboarding tour
  dashboardTheme: text("dashboard_theme").default("modern-dark"), // User's selected dashboard theme
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by"),
}, (table) => ({
  createdByFk: foreignKey({
    columns: [table.createdBy],
    foreignColumns: [table.id],
    name: "users_created_by_fkey"
  }),
  createdByIdx: index("users_created_by_idx").on(table.createdBy),
  tenantIdIdx: index("users_tenant_id_idx").on(table.tenantId),
  tenantUsernameIdx: uniqueIndex("users_tenant_username_unique_idx").on(table.tenantId, table.username),
}));

// OAuth providers for linking external accounts (Google, GitHub, Apple) to technician users
export const oauthProviders = pgTable("oauth_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: varchar("provider", { length: 20 }).notNull(), // 'google', 'github', 'apple'
  providerId: text("provider_id").notNull(), // External user ID from OAuth provider
  email: text("email"), // Email from OAuth provider
  displayName: text("display_name"), // Full name from OAuth provider
  profileImageUrl: text("profile_image_url"), // Profile picture URL
  accessToken: text("access_token"), // OAuth access token (encrypted in production)
  refreshToken: text("refresh_token"), // OAuth refresh token (encrypted in production)
  tokenExpiresAt: timestamp("token_expires_at"),
  metadata: jsonb("metadata"), // Additional provider-specific data
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
  providerUniqueIdx: uniqueIndex("oauth_provider_unique_idx").on(table.provider, table.providerId),
  userIdIdx: index("oauth_providers_user_id_idx").on(table.userId),
}));

// Password reset tokens for forgot password functionality
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Booking tokens for quote-to-booking workflow (one-time-use, auto-expires in 24h)
export const bookingTokens = pgTable("booking_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  quoteId: integer("quote_id").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  damageType: text("damage_type").notNull(),
  customQuoteAmount: numeric("custom_quote_amount", { precision: 10, scale: 2 }),
  issueDescription: text("issue_description"),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tokenIdx: index("booking_tokens_token_idx").on(table.token),
  expiresAtIdx: index("booking_tokens_expires_at_idx").on(table.expiresAt),
}));

// Session table for connect-pg-simple (PostgreSQL session store)
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// WebAuthn credentials for biometric authentication
export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: text("id").primaryKey(), // credentialID from WebAuthn
  userId: integer("user_id").notNull().references(() => users.id),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports").array(), // Authenticator transports (usb, nfc, ble, internal)
  deviceName: text("device_name"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// TOTP 2FA secrets for authenticator apps (Google Authenticator, Authy, etc.)
export const totpSecrets = pgTable("totp_secrets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  secret: text("secret").notNull(), // Base32 encoded secret for TOTP
  enabled: boolean("enabled").default(false),
  backupCodes: text("backup_codes").array(), // Hashed backup codes for account recovery
  createdAt: timestamp("created_at").defaultNow(),
  enabledAt: timestamp("enabled_at"),
  lastUsedAt: timestamp("last_used_at"),
});

// Login attempts tracking for brute-force protection
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  ipAddress: text("ip_address").notNull(),
  successful: boolean("successful").notNull(),
  failureReason: text("failure_reason"), // 'invalid_password', 'invalid_username', 'account_locked', 'rate_limited'
  userAgent: text("user_agent"),
  attemptedAt: timestamp("attempted_at").defaultNow(),
}, (table) => ({
  usernameIdx: index("login_attempts_username_idx").on(table.username),
  ipIdx: index("login_attempts_ip_idx").on(table.ipAddress),
  attemptedAtIdx: index("login_attempts_attempted_at_idx").on(table.attemptedAt),
}));

// Account lockouts for security
export const accountLockouts = pgTable("account_lockouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  lockedAt: timestamp("locked_at").defaultNow(),
  unlockAt: timestamp("unlock_at").notNull(),
  reason: text("reason").notNull(), // 'failed_login_attempts', 'suspicious_activity', 'manual_lock'
  lockedBy: integer("locked_by"), // Admin user who manually locked account (if applicable)
  unlocked: boolean("unlocked").default(false),
  unlockedAt: timestamp("unlocked_at"),
}, (table) => ({
  userIdIdx: index("account_lockouts_user_id_idx").on(table.userId),
}));

// Admin activity audit logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // 'user_created', 'user_deleted', 'password_changed', 'settings_modified', etc.
  resource: text("resource").notNull(), // 'user', 'customer', 'appointment', 'settings', etc.
  resourceId: text("resource_id"), // ID of the affected resource
  changes: jsonb("changes"), // Before/after values for modifications
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  resourceIdx: index("audit_logs_resource_idx").on(table.resource),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

// Error logs for monitoring and debugging
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  errorType: text("error_type").notNull(), // 'api', 'database', 'external_service', 'validation', 'runtime'
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  message: text("message").notNull(),
  stack: text("stack"),
  endpoint: text("endpoint"), // API endpoint where error occurred
  userId: text("user_id"), // User who triggered the error (if any)
  requestData: jsonb("request_data"), // Request body/params
  metadata: jsonb("metadata"), // Additional context
  resolved: timestamp("resolved"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Impersonation events audit log for tracking when owners login as tenants
export const impersonationEvents = pgTable("impersonation_events", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 50 }).notNull(), // Correlation ID linking start/stop events
  realUserId: integer("real_user_id").notNull().references(() => users.id),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  tenantName: text("tenant_name"), // Snapshot of tenant name at impersonation time
  action: varchar("action", { length: 10 }).notNull(), // 'start' | 'stop'
  startedAt: timestamp("started_at").notNull(), // When impersonation started
  endedAt: timestamp("ended_at"), // When impersonation ended (only for 'stop' events)
  durationSeconds: integer("duration_seconds"), // Duration in seconds (only for 'stop' events)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => ({
  sessionIdIdx: index("impersonation_events_session_id_idx").on(table.sessionId),
  realUserIdIdx: index("impersonation_events_real_user_id_idx").on(table.realUserId),
  tenantIdIdx: index("impersonation_events_tenant_id_idx").on(table.tenantId),
  startedAtIdx: index("impersonation_events_started_at_idx").on(table.startedAt),
}));

// Dashboard widget layouts for customizable user dashboards
export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  userId: integer("user_id"), // NULL for tenant-wide default layouts
  layout: jsonb("layout").notNull().$type<{
    widgets: Array<{
      id: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      visible: boolean;
      order: number;
    }>;
  }>(),
  layoutVersion: integer("layout_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantUserIdx: uniqueIndex("dashboard_layouts_tenant_user_idx").on(table.tenantId, table.userId),
  userIdIdx: index("dashboard_layouts_user_id_idx").on(table.userId),
}));

// Platform settings for demo mode and global configurations
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  demoModeEnabled: boolean("demo_mode_enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tenant tier enum for subscription levels
// Phase 7 + Phase 23: Free tier added for free tier users with watermarked sites
export const tenantTierEnum = pgEnum('tenant_tier', ['free', 'starter', 'pro', 'elite', 'internal']);

// Tenant status enum for subscription/account status
export const tenantStatusEnum = pgEnum('tenant_status', ['trialing', 'active', 'past_due', 'suspended', 'cancelled']);

// Tenants table for multi-tenant support
export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subdomain: varchar("subdomain", { length: 100 }).unique(), // Phase 9: Globally unique subdomain for public sites
  isRoot: boolean("is_root").default(false).notNull(),
  planTier: tenantTierEnum("plan_tier").default("starter").notNull(),
  status: tenantStatusEnum("status").default("trialing").notNull(),
  stripeCustomerId: text("stripe_customer_id"), // Phase 7C: Stripe customer ID for billing
  stripeSubscriptionId: text("stripe_subscription_id"), // Phase 7C: Active Stripe subscription ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tenant configuration - business-specific settings per tenant
export const tenantConfig = pgTable("tenant_config", {
  tenantId: varchar("tenant_id", { length: 50 }).primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#3b82f6"),
  accentColor: varchar("accent_color", { length: 20 }), // Phase 5: Secondary brand color
  tier: tenantTierEnum("tier").default("starter").notNull(),
  // Concierge setup fields (Phase 5)
  industry: varchar("industry", { length: 100 }), // e.g., 'mobile-detailing', 'lawn-care', 'house-cleaning'
  // Phase 8: Industry pack identifier for structured seed data
  industryPackId: varchar("industry_pack_id", { length: 100 }), // e.g., 'auto_detailing', 'lawn_care', 'house_cleaning'
  industryConfig: jsonb("industry_config").$type<{
    featureFlags?: Record<string, boolean>;
    rawSelection?: any;
    version?: string;
    updatedAt?: string;
  }>(), // Phase 8C: Industry-specific configuration (feature flags, sub-packs, etc.)
  primaryContactName: varchar("primary_contact_name", { length: 255 }), // Phase 5: Contact person name
  primaryContactEmail: varchar("primary_contact_email", { length: 255 }),
  primaryCity: varchar("primary_city", { length: 100 }),
  websiteUrl: varchar("website_url", { length: 500 }), // Phase 5: Tenant's website
  internalNotes: text("internal_notes"), // Owner-only notes about this tenant
  
  // Route optimization fields - home base location for travel time calculations
  homeBaseAddress: text("home_base_address"),
  homeBaseLat: numeric("home_base_lat", { precision: 10, scale: 7 }),
  homeBaseLng: numeric("home_base_lng", { precision: 10, scale: 7 }),
  
  // Service area validation settings
  serviceAreaMaxMinutes: integer("service_area_max_minutes").default(25), // Max allowed travel time from home base
  serviceAreaSoftDeclineMessage: text("service_area_soft_decline_message"), // Custom message for out-of-area requests
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tenant phone configuration - telephony settings per tenant (Phase 2.2)
export const tenantPhoneConfig = pgTable("tenant_phone_config", {
  id: varchar("id", { length: 50 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull().unique(), // E.164 format Twilio number
  messagingServiceSid: varchar("messaging_service_sid", { length: 255 }), // Twilio Messaging Service SID
  sipDomain: varchar("sip_domain", { length: 255 }), // e.g., cleanmachinetulsa.sip.twilio.com
  sipUsername: varchar("sip_username", { length: 255 }), // e.g., jody
  sipPasswordEncrypted: varchar("sip_password_encrypted", { length: 255 }), // Encrypted SIP password (if needed)
  ivrMode: varchar("ivr_mode", { length: 50 }).default("simple"), // simple | ivr | ai-voice
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  phoneNumberIdx: uniqueIndex("tenant_phone_config_phone_number_idx").on(table.phoneNumber),
  tenantIdIdx: index("tenant_phone_config_tenant_id_idx").on(table.tenantId),
}));

// Phase 11 - Tenant email profile configuration
// Stores tenant-specific email sender identity and reply-to settings
export const tenantEmailProfiles = pgTable("tenant_email_profiles", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull().default("sendgrid"), // 'sendgrid' for v1
  fromName: varchar("from_name", { length: 255 }), // Brand display name override
  fromEmail: varchar("from_email", { length: 255 }), // Optional per-tenant sender (future use)
  replyToEmail: varchar("reply_to_email", { length: 255 }), // Where customer replies should go
  status: varchar("status", { length: 50 }).notNull().default("not_configured"), // not_configured | needs_verification | healthy | error
  lastVerifiedAt: timestamp("last_verified_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("tenant_email_profiles_tenant_id_idx").on(table.tenantId),
}));

// Campaign configurations per tenant for Welcome Back and other campaigns
export const campaignConfigs = pgTable("campaign_configs", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  campaignKey: varchar("campaign_key", { length: 100 }).notNull(), // e.g. 'welcome_back_v1'
  configJson: jsonb("config_json").$type<{
    vipPointsBonus?: number;
    regularPointsBonus?: number;
    smsTemplateVip?: string;
    smsTemplateRegular?: string;
    emailTemplateVip?: string;
    emailTemplateRegular?: string;
    bookingBaseUrl?: string;
    rewardsBaseUrl?: string;
    qrUrlVip?: string;
    qrUrlRegular?: string;
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantCampaignIdx: uniqueIndex("campaign_configs_tenant_campaign_idx").on(table.tenantId, table.campaignKey),
}));

// Campaign sends - track when campaigns are sent to customers for AI awareness
export const campaignSends = pgTable("campaign_sends", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  campaignKey: varchar("campaign_key", { length: 100 }).notNull(), // e.g. 'welcome_back_v1_vip', 'welcome_back_v1_regular'
  channel: varchar("channel", { length: 20 }).notNull(), // 'sms', 'email', 'both'
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => ({
  tenantCustomerCampaignIdx: index("campaign_sends_tenant_customer_campaign_idx").on(table.tenantId, table.customerId, table.campaignKey),
  sentAtIdx: index("campaign_sends_sent_at_idx").on(table.sentAt),
}));

// Loyalty tier enum for customer tier upgrades
export const loyaltyTierEnum = pgEnum('loyalty_tier', ['bronze', 'silver', 'gold', 'platinum']);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  name: text("name").notNull(),
  email: text("email").unique(), // Make email unique for email-only customer lookups
  phone: text("phone").unique(), // Make phone nullable to support email-only customers
  address: text("address"),
  vehicleInfo: text("vehicle_info"),
  lastInteraction: timestamp("last_interaction").defaultNow(),
  notes: text("notes"),
  photoFolderLink: text("photo_folder_link"),
  loyaltyProgramOptIn: boolean("loyalty_program_opt_in").default(false),
  loyaltyProgramJoinDate: timestamp("loyalty_program_join_date"),
  smsConsent: boolean("sms_consent").default(false),
  smsConsentTimestamp: timestamp("sms_consent_timestamp"),
  smsConsentIpAddress: text("sms_consent_ip_address"),
  loyaltyTier: loyaltyTierEnum("loyalty_tier").default('bronze'),
  hasPriorityBooking: boolean("has_priority_booking").default(false),
  priorityBookingGrantedAt: timestamp("priority_booking_granted_at"),
  
  // VIP customer flag for campaign targeting
  isVip: boolean("is_vip").default(false),
  
  // Customer Intelligence fields (Phase 1)
  isReturningCustomer: boolean("is_returning_customer").notNull().default(false),
  firstAppointmentAt: timestamp("first_appointment_at"),
  lastAppointmentAt: timestamp("last_appointment_at"),
  totalAppointments: integer("total_appointments").notNull().default(0),
  lifetimeValue: numeric("lifetime_value", { precision: 10, scale: 2 }).default("0.00"),
  
  // Phase 16 - Customer Backfill fields
  importSource: varchar("import_source", { length: 255 }), // Track where customer data came from (e.g., 'sheet,db', 'sms,db')
  householdId: integer("household_id"), // Reference to households table for grouping customers by address
  
  // Phase 15 - Customer Portal Profile Customization
  profilePictureUrl: text("profile_picture_url"), // URL to uploaded profile picture
  customerNotes: text("customer_notes"), // Personal notes/preferences entered by customer (different from business notes)
  notifyViaEmail: boolean("notify_via_email").default(true), // Email notification preference
  notifyViaSms: boolean("notify_via_sms").default(true), // SMS notification preference
  notifyViaPush: boolean("notify_via_push").default(false), // Push notification preference
}, (table) => ({
  tenantPhoneIdx: index("customers_tenant_phone_idx").on(table.tenantId, table.phone),
  tenantEmailIdx: index("customers_tenant_email_idx").on(table.tenantId, table.email),
}));

// Phase 16 - Households table for grouping customers by normalized address
export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  normalizedAddress: text("normalized_address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantAddressUnique: uniqueIndex("households_tenant_address_unique").on(table.tenantId, table.normalizedAddress),
}));

// Phase 16 - Migration log table to track backfill runs
export const migrationLog = pgTable("migration_log", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 100 }).notNull(), // e.g., 'customer_backfill'
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
}, (table) => ({
  typeIdx: index("migration_log_type_idx").on(table.type),
  tenantIdx: index("migration_log_tenant_idx").on(table.tenantId),
}));

// Phase 15 - Customer Identity table for customer portal authentication
export const customerIdentities = pgTable("customer_identities", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  customerId: integer("customer_id").notNull(),
  primaryPhone: text("primary_phone"),
  primaryEmail: text("primary_email"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantCustomerUnique: uniqueIndex("customer_identities_tenant_customer_uid")
    .on(table.tenantId, table.customerId),
  tenantPhoneIdx: index("customer_identities_tenant_phone_idx").on(table.tenantId, table.primaryPhone),
  tenantEmailIdx: index("customer_identities_tenant_email_idx").on(table.tenantId, table.primaryEmail),
}));

// Phase 15 - Customer OTP table for one-time password authentication
export const customerOtps = pgTable("customer_otps", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  customerId: integer("customer_id"),
  channel: varchar("channel", { length: 20 }).notNull(),
  destination: text("destination").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumedAt: timestamp("consumed_at"),
  attempts: integer("attempts").notNull().default(0),
}, (table) => ({
  tenantDestinationIdx: index("customer_otps_tenant_destination_idx").on(table.tenantId, table.destination, table.channel),
  expiresAtIdx: index("customer_otps_expires_at_idx").on(table.expiresAt),
}));

// Phase 15 - Customer Sessions table for customer portal session management
export const customerSessions = pgTable("customer_sessions", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  customerId: integer("customer_id").notNull(),
  sessionToken: text("session_token").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
}, (table) => ({
  sessionTokenUnique: uniqueIndex("customer_sessions_token_uid").on(table.sessionToken),
  tenantCustomerIdx: index("customer_sessions_tenant_customer_idx").on(table.tenantId, table.customerId),
  expiresAtIdx: index("customer_sessions_expires_at_idx").on(table.expiresAt),
}));

// Customer Vehicles - Track customer vehicle information for personalized service
export const customerVehicles = pgTable("customer_vehicles", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  year: varchar("year", { length: 4 }),
  make: varchar("make", { length: 100 }),
  model: varchar("model", { length: 100 }),
  color: varchar("color", { length: 50 }),
  licensePlate: varchar("license_plate", { length: 20 }),
  vin: varchar("vin", { length: 17 }),
  notes: text("notes"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customer Service History - Track all completed services for AI personalization
export const customerServiceHistory = pgTable("customer_service_history", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  serviceDate: timestamp("service_date").notNull(),
  serviceType: varchar("service_type", { length: 100 }).notNull(),
  vehicleId: integer("vehicle_id").references(() => customerVehicles.id),
  technicianId: integer("technician_id").references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  satisfaction: integer("satisfaction"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  name: text("name").notNull(),
  priceRange: text("price_range").notNull(),
  overview: text("overview").notNull(),
  detailedDescription: text("detailed_description").notNull(),
  duration: text("duration").notNull(),
  durationHours: numeric("duration_hours").notNull(), // Deprecated - kept for backwards compatibility (average)
  minDurationHours: numeric("min_duration_hours").notNull().default('1.5'), // Minimum time for service (best case)
  maxDurationHours: numeric("max_duration_hours").notNull().default('2'), // Maximum time for service (worst case - used for blocking calendar)
  imageUrl: text("image_url"),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  scheduledTime: timestamp("scheduled_time").notNull(),
  completed: boolean("completed").default(false),
  calendarEventId: text("calendar_event_id"),
  reminderSent: boolean("reminder_sent").default(false),
  additionalRequests: text("additional_requests").array(),
  address: text("address").notNull(),
  addressLat: numeric("address_lat", { precision: 10, scale: 7 }), // Geocoded latitude
  addressLng: numeric("address_lng", { precision: 10, scale: 7 }), // Geocoded longitude
  addOns: jsonb("add_ons"),
  damageAssessmentStatus: varchar("damage_assessment_status", { length: 20 }).default("none"), // none, pending, reviewed, approved, rejected
  damagePhotos: text("damage_photos").array(), // URLs to damage photos in Google Drive
  damageDescription: text("damage_description"), // Customer's description of the damage
  assessmentRequestedAt: timestamp("assessment_requested_at"), // When photos were requested
  assessmentReviewedAt: timestamp("assessment_reviewed_at"), // When business owner reviewed
  autoApprovedAt: timestamp("auto_approved_at"), // If auto-approved after timeout
  
  // Third-party billing role contacts (NEW - for multi-role jobs)
  requesterContactId: integer("requester_contact_id"),
  serviceContactId: integer("service_contact_id"),
  vehicleOwnerContactId: integer("vehicle_owner_contact_id"),
  billingContactId: integer("billing_contact_id"),
  
  // Billing configuration (NEW)
  billingType: varchar("billing_type", { length: 20 }).default("self"), // self, third_party, gift, company_po
  poNumber: text("po_number"),
  depositPercent: integer("deposit_percent"),
  billingStatus: varchar("billing_status", { length: 30 }).default("pending"),
  
  // Privacy controls (NEW)
  sharePriceWithRequester: boolean("share_price_with_requester").default(true),
  shareLocationWithPayer: boolean("share_location_with_payer").default(false),
  
  // Gift mode (NEW)
  isGift: boolean("is_gift").default(false),
  giftMessage: text("gift_message"),
  giftCardCode: text("gift_card_code"),
  
  // Pricing & approval (NEW)
  estimatedPrice: numeric("estimated_price", { precision: 10, scale: 2 }),
  priceLocked: boolean("price_locked").default(false),
  priceLockedAt: timestamp("price_locked_at"),
  signedAuthorizationId: integer("signed_authorization_id"),
  notesBilling: text("notes_billing"),
  
  // Deposit tracking (NEW)
  depositPaid: boolean("deposit_paid").default(false),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  
  // General status & completion (NEW)
  status: varchar("status", { length: 20 }).default("pending"), // pending, confirmed, assigned, en_route, on_site, in_progress, paused, completed, hand_off, cancelled
  completedAt: timestamp("completed_at"),
  
  // Service & vehicle details (NEW)
  serviceType: text("service_type"), // Cached service name for easy access
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  location: text("location"), // Alias for address (some code uses this)
  smsConsent: boolean("sms_consent").default(false),
  smsConsentTimestamp: timestamp("sms_consent_timestamp"),
  smsConsentIpAddress: text("sms_consent_ip_address"),
  
  // Technician Mode fields (for iPad kiosk interface)
  technicianId: integer("technician_id").references(() => technicians.id, { onDelete: "set null" }), // Assigned technician (nulled if tech deleted)
  latitude: numeric("latitude", { precision: 10, scale: 7 }), // Geocoded address latitude
  longitude: numeric("longitude", { precision: 10, scale: 7 }), // Geocoded address longitude
  addressConfirmedByCustomer: boolean("address_confirmed_by_customer").default(false), // Customer confirmed address via map pin
  addressNeedsReview: boolean("address_needs_review").default(false), // Manual review needed if customer moved pin but validation failed
  jobNotes: text("job_notes"), // Field technician notes during job
  statusUpdatedAt: timestamp("status_updated_at"), // Last status change timestamp
}, (table) => ({
  // Indexes for technician queries
  technicianScheduleIdx: index("appointments_technician_schedule_idx").on(table.technicianId, table.scheduledTime), // Composite for "today's jobs" queries
  statusIdx: index("appointments_status_idx").on(table.status),
}));

// Job Photos - Photos uploaded by technicians during job completion
export const jobPhotos = pgTable("job_photos", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }), // Delete photos when appointment deleted
  technicianId: integer("technician_id").references(() => technicians.id, { onDelete: "set null" }), // Nullable: preserve photos if tech deleted
  photoUrl: text("photo_url").notNull(), // Google Drive URL
  photoType: varchar("photo_type", { length: 30 }).notNull().default("progress"), // before, during, after, progress, issue, completion
  caption: text("caption"), // Optional description from technician
  fileName: text("file_name"), // Original filename from upload
  fileSize: integer("file_size"), // File size in bytes
  mimeType: varchar("mime_type", { length: 50 }), // MIME type (image/jpeg, image/png, etc.)
  latitude: numeric("latitude", { precision: 10, scale: 7 }), // GPS coordinates when photo taken
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  appointmentIdIdx: index("job_photos_appointment_id_idx").on(table.appointmentId),
  technicianIdIdx: index("job_photos_technician_id_idx").on(table.technicianId),
}));

// Quote Requests - Tracks specialty jobs that require manual pricing before booking
export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  phone: text("phone").notNull(),
  customerName: text("customer_name").notNull(),
  issueDescription: text("issue_description").notNull(), // Detailed description from customer
  damageType: varchar("damage_type", { length: 50 }).notNull(), // asphalt, tar, extreme_staining, mold, biohazard, other
  photoUrls: text("photo_urls").array(), // URLs to uploaded photos
  
  // Third-party payer information (optional)
  thirdPartyPayerName: text("third_party_payer_name"),
  thirdPartyPayerEmail: text("third_party_payer_email"),
  thirdPartyPayerPhone: text("third_party_payer_phone"),
  poNumber: text("po_number"),
  
  // Quote status workflow
  status: varchar("status", { length: 30 }).notNull().default("pending_review"), // pending_review, quoted, approved, declined, cancelled
  customQuoteAmount: numeric("custom_quote_amount", { precision: 10, scale: 2 }), // Set by business owner
  quoteNotes: text("quote_notes"), // Business owner's notes about the quote
  
  // Approval tracking
  approverType: varchar("approver_type", { length: 20 }), // customer, third_party
  approvalToken: text("approval_token").unique(), // Unique token for approval link
  approvedAt: timestamp("approved_at"),
  declinedAt: timestamp("declined_at"),
  declinedReason: text("declined_reason"),
  
  // Post-completion tracking (for AI learning)
  completedAt: timestamp("completed_at"), // When job was actually completed
  actualTimeSpent: numeric("actual_time_spent", { precision: 4, scale: 2 }), // Hours spent on job
  difficultyRating: integer("difficulty_rating"), // 1-5 scale set by business owner
  lessonLearned: text("lesson_learned"), // What you learned from this job
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  quotedAt: timestamp("quoted_at"), // When quote was sent to customer
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Link to created appointment (once approved)
  appointmentId: integer("appointment_id").references(() => appointments.id),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"),
  appointmentId: integer("appointment_id").references(() => appointments.id), // Nullable - allows manual invoices without appointments
  customerId: integer("customer_id").notNull().references(() => customers.id),
  invoiceType: varchar("invoice_type", { length: 20 }).notNull().default("appointment"), // 'appointment' | 'manual'
  amount: numeric("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("unpaid"), // Legacy field - kept for backward compatibility
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("unpaid"), // Primary payment status field
  paymentMethod: varchar("payment_method", { length: 20 }),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paypalOrderId: text("paypal_order_id"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  serviceDescription: text("service_description").notNull(),
  reviewRequestSent: boolean("review_request_sent").default(false),
  reviewRequestedAt: timestamp("review_requested_at"), // When review email was sent
  followUpSent: boolean("follow_up_sent").default(false),
  
  // Third-party billing fields (NEW)
  billToContactId: integer("bill_to_contact_id"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  depositPaidAt: timestamp("deposit_paid_at"),
  balanceDue: numeric("balance_due", { precision: 10, scale: 2 }),
  dueDate: timestamp("due_date"),
  invoiceSentAt: timestamp("invoice_sent_at"),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").default(0),
  
  // Referral discount tracking
  referralCode: varchar("referral_code", { length: 20 }), // Applied referral code (e.g., "JOHN-ABC123")
  referralDiscount: numeric("referral_discount", { precision: 10, scale: 2 }), // Discount amount applied
  referralRewardType: varchar("referral_reward_type", { length: 30 }), // fixed_discount, percent_discount, etc.
  referralRewardValue: numeric("referral_reward_value", { precision: 10, scale: 2 }), // Original reward value
  referralOriginalAmount: numeric("referral_original_amount", { precision: 10, scale: 2 }), // Amount before referral discount
  
  // Technician cash/check payment tracking
  technicianId: integer("technician_id").references(() => users.id), // Technician who collected cash/check payment
  
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("invoices_tenant_id_idx").on(table.tenantId),
}));

// Technician Deposits - Daily cash/check payment tracking and reconciliation
export const technicianDeposits = pgTable("technician_deposits", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").notNull().references(() => users.id),
  depositDate: date("deposit_date").notNull(), // Date of work day
  cashAmount: numeric("cash_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  checkAmount: numeric("check_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  invoiceIds: integer("invoice_ids").array(), // Array of invoice IDs included
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'deposited'
  depositedAt: timestamp("deposited_at"),
  depositedBy: integer("deposited_by").references(() => users.id), // Owner who confirmed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  technicianDateIdx: index("technician_deposits_tech_date_idx").on(table.technicianId, table.depositDate),
  statusIdx: index("technician_deposits_status_idx").on(table.status),
}));

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default('root'),
  customerId: integer("customer_id").references(() => customers.id),
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),
  category: varchar("category", { length: 20 }).default("Other"),
  intent: varchar("intent", { length: 30 }).default("Information Gathering"),
  needsHumanAttention: boolean("needs_human_attention").default(false),
  resolved: boolean("resolved").default(false),
  lastMessageTime: timestamp("last_message_time").defaultNow(),
  platform: varchar("platform", { length: 20 }).notNull(), // web, sms, facebook, instagram, email
  phoneLineId: integer("phone_line_id").references(() => phoneLines.id), // Which phone line this SMS conversation is on (null for non-SMS)
  facebookSenderId: text("facebook_sender_id"), // Facebook/Instagram user ID for sending messages
  facebookPageId: text("facebook_page_id"), // Which Facebook page this conversation is on
  emailAddress: text("email_address"), // Customer email address for email conversations
  emailThreadId: text("email_thread_id"), // Email thread ID (for grouping related emails)
  emailSubject: text("email_subject"), // Subject line of the email thread
  controlMode: varchar("control_mode", { length: 20 }).default("auto"), // auto, manual, paused
  assignedAgent: text("assigned_agent"), // Username of agent who took over
  behaviorSettings: jsonb("behavior_settings"), // { tone, forcedAction, formality, responseLength, proactivity }
  status: varchar("status", { length: 20 }).default("active"), // active, closed
  createdAt: timestamp("created_at").defaultNow(),
  handoffRequestedAt: timestamp("handoff_requested_at"), // When customer asked for human or AI detected issue
  manualModeStartedAt: timestamp("manual_mode_started_at"), // When agent took control
  lastAgentActivity: timestamp("last_agent_activity"), // Last time agent sent a message or made changes
  handoffReason: text("handoff_reason"), // Why handoff was triggered (keywords, frustration, etc.)
  appointmentId: integer("appointment_id").references(() => appointments.id), // Associated appointment for booking conversations
  unreadCount: integer("unread_count").default(0), // Number of unread messages from customer
  snoozedUntil: timestamp("snoozed_until"), // When to resume showing this conversation (null = not snoozed)
  smsOptOut: boolean("sms_opt_out").default(false), // Customer opted out via STOP keyword
  smsOptOutAt: timestamp("sms_opt_out_at"), // When customer opted out
  
  // Production messaging features
  starred: boolean("starred").default(false), // User starred this conversation
  archived: boolean("archived").default(false), // User archived this conversation
  pinned: boolean("pinned").default(false), // Pin conversation to top of list
  pinnedAt: timestamp("pinned_at"), // When conversation was pinned
  archivedAt: timestamp("archived_at"), // When conversation was archived
  starredAt: timestamp("starred_at"), // When conversation was starred
  
  // Human escalation tracking (Phase 2: "Ask for Jody" VIP Escalation System)
  humanEscalationActive: boolean("human_escalation_active").notNull().default(false),
  humanEscalationRequestedAt: timestamp("human_escalation_requested_at"),
  humanHandledAt: timestamp("human_handled_at"),
  humanHandledBy: integer("human_handled_by").references(() => users.id),
}, (table) => ({
  emailThreadIndex: index("conversations_email_thread_idx").on(table.platform, table.emailThreadId),
  emailAddressIndex: index("conversations_email_address_idx").on(table.platform, table.emailAddress),
  phoneLineIndex: index("conversations_phone_line_idx").on(table.phoneLineId),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  content: text("content").notNull(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("1"), // Multi-tenant support
  sender: varchar("sender", { length: 20 }).notNull(), // customer, ai, agent
  fromCustomer: boolean("from_customer").notNull(), // Keep for backwards compatibility
  timestamp: timestamp("timestamp").defaultNow(),
  topics: text("topics").array(),
  channel: varchar("channel", { length: 10 }), // web, sms, email
  phoneLineId: integer("phone_line_id").references(() => phoneLines.id), // Which phone line this SMS was sent from/to
  isAutomated: boolean("is_automated").default(false), // Whether message was sent by AI (vs human agent)
  
  // Production messaging features
  edited: boolean("edited").default(false), // Message was edited
  editedAt: timestamp("edited_at"), // When message was last edited
  deliveryStatus: varchar("delivery_status", { length: 20 }).default("sent"), // sent, delivered, read, failed
  readAt: timestamp("read_at"), // When message was read by recipient
  metadata: jsonb("metadata"), // Attachments, links, forwarded info: { attachments: [{url, type, name, size}], ... }
});

// Message Reactions - Emoji reactions on messages (like iMessage tapbacks)
export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Which agent/user added this reaction
  emoji: text("emoji").notNull(), // 👍, ❤️, 😂, 😮, 😢, 🙏
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Composite unique constraint to prevent duplicate reactions
  uniqueReaction: uniqueIndex("message_reactions_unique_idx").on(table.messageId, table.userId, table.emoji),
  // Index on messageId for fast lookup
  messageIndex: index("message_reactions_message_idx").on(table.messageId),
}));

// Message Edit History - Track all edits to messages
export const messageEditHistory = pgTable("message_edit_history", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  previousContent: text("previous_content").notNull(), // Content before edit
  newContent: text("new_content").notNull(), // Content after edit
  editedBy: integer("edited_by").references(() => users.id, { onDelete: "set null" }), // Which agent/user made the edit
  editedAt: timestamp("edited_at").defaultNow(),
}, (table) => ({
  // Index on messageId for fast history lookup
  messageIndex: index("message_edit_history_message_idx").on(table.messageId),
}));

// Scheduled Messages - Messages scheduled to send at a future time
export const scheduledMessages = pgTable("scheduled_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Who scheduled it
  content: text("content").notNull(), // Message content to send
  channel: varchar("channel", { length: 20 }), // web, sms, email, facebook, instagram
  scheduledFor: timestamp("scheduled_for").notNull(), // When to send
  status: varchar("status", { length: 20 }).default("pending"), // pending, sent, cancelled, failed
  metadata: jsonb("metadata"), // Optional additional data
  sentAt: timestamp("sent_at"), // When actually sent
  errorMessage: text("error_message"), // If failed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Composite index on (status, scheduledFor) for efficient cron queries
  statusScheduledIndex: index("scheduled_messages_status_scheduled_idx").on(table.status, table.scheduledFor),
}));

// Human Escalation Requests - Phase 2: "Ask for Jody" VIP Escalation System
// Tracks customer requests to speak with owner directly (pauses AI, sends notifications)
export const humanEscalationRequests = pgTable("human_escalation_requests", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  
  // Trigger info
  triggerPhrase: varchar("trigger_phrase", { length: 500 }), // What they said to trigger
  triggerMessageId: integer("trigger_message_id").references(() => messages.id),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, acknowledged, resolved, expired
  
  // Context for owner
  recentMessageSummary: text("recent_message_summary"), // Last few messages for context
  customerVehicle: varchar("customer_vehicle", { length: 255 }),
  lastServiceDate: timestamp("last_service_date"),
  
  // Timing
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  expiresAt: timestamp("expires_at").notNull(), // Auto-expire after 24hrs
  
  // Notifications sent
  smsNotificationSent: boolean("sms_notification_sent").notNull().default(false),
  pushNotificationSent: boolean("push_notification_sent").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("human_escalation_requests_conversation_idx").on(table.conversationId),
  statusIdx: index("human_escalation_requests_status_idx").on(table.status),
  expiresAtIdx: index("human_escalation_requests_expires_at_idx").on(table.expiresAt),
}));

// Call Events - Logs all inbound and outbound calls
export const callEvents = pgTable("call_events", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id), // Link to conversation if available
  callSid: text("call_sid").notNull().unique(), // Twilio's unique call identifier
  direction: varchar("direction", { length: 20 }).notNull(), // inbound, outbound, technician_outbound
  from: text("from").notNull(), // Caller phone number
  to: text("to").notNull(), // Recipient phone number
  customerPhone: text("customer_phone"), // The actual customer's phone (for bridge preservation during hold/mute)
  status: varchar("status", { length: 20 }).notNull(), // queued, ringing, in-progress, completed, busy, no-answer, failed, canceled
  duration: integer("duration"), // Call duration in seconds (null if not answered)
  recordingUrl: text("recording_url"), // URL to call recording
  recordingSid: text("recording_sid"), // Twilio recording identifier
  transcriptionText: text("transcription_text"), // Voicemail transcription
  transcriptionStatus: varchar("transcription_status", { length: 20 }), // in-progress, completed, failed
  answeredBy: text("answered_by"), // human, machine, fax, unknown (for outbound calls)
  price: numeric("price"), // Cost of call in USD
  priceUnit: varchar("price_unit", { length: 10 }), // Currency (USD)
  technicianId: integer("technician_id").references(() => technicians.id, { onDelete: "set null" }), // For technician_outbound calls
  appointmentId: integer("appointment_id").references(() => appointments.id, { onDelete: "set null" }), // Link to appointment if call is job-related
  readAt: timestamp("read_at"), // When voicemail was marked as read
  createdAt: timestamp("created_at").defaultNow(), // When call was initiated
  startedAt: timestamp("started_at"), // When call was answered
  endedAt: timestamp("ended_at"), // When call ended
}, (table) => ({
  // Index for phone number lookups (most common query pattern)
  fromPhoneIndex: index("call_events_from_idx").on(table.from),
  toPhoneIndex: index("call_events_to_idx").on(table.to),
  // Index for conversation queries (call history by conversation)
  conversationIndex: index("call_events_conversation_idx").on(table.conversationId),
  // Index for technician call history
  technicianIndex: index("call_events_technician_idx").on(table.technicianId),
  // Composite index for time-based queries with status filtering
  statusCreatedIndex: index("call_events_status_created_idx").on(table.status, table.createdAt),
  // Index for recording lookups
  recordingSidIndex: index("call_events_recording_sid_idx").on(table.recordingSid),
}));

// Phone Lines - Configuration for each Twilio business phone line
export const phoneLines = pgTable("phone_lines", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default('root'),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(), // +19188565304 or +19188565711
  label: varchar("label", { length: 100 }).notNull(), // "Main Line", "VIP Line"
  forwardingEnabled: boolean("forwarding_enabled").default(true), // Enable/disable call forwarding
  forwardingNumber: varchar("forwarding_number", { length: 20 }), // Business owner's personal cell to forward to
  ringDuration: integer("ring_duration").default(10), // How long to ring forwarding number before voicemail (seconds, 10-60)
  voicemailGreeting: text("voicemail_greeting"), // Custom voicemail greeting message (text-to-speech)
  voicemailGreetingUrl: text("voicemail_greeting_url"), // Custom voicemail greeting audio recording URL (Google Drive)
  afterHoursVoicemailGreeting: text("after_hours_voicemail_greeting"), // After-hours voicemail greeting (30min buffer after last schedule)
  afterHoursVoicemailGreetingUrl: text("after_hours_voicemail_greeting_url"), // After-hours voicemail greeting audio URL
  
  // SIP Integration for custom ringtones (Samsung phones)
  sipEnabled: boolean("sip_enabled").default(false), // Toggle SIP routing on/off
  sipEndpoint: text("sip_endpoint"), // SIP URI like "jody@sip.cleanmachinetulsa.com"
  sipCredentialSid: text("sip_credential_sid"), // Twilio credential list SID (CLxxx...) - never store actual password
  sipFallbackNumber: varchar("sip_fallback_number", { length: 20 }), // Fallback if SIP fails (E.164 format)
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  phoneNumberIndex: index("phone_lines_phone_number_idx").on(table.phoneNumber),
}));

// Phone Schedules - Business hours and call routing rules for each phone line
export const phoneSchedules = pgTable("phone_schedules", {
  id: serial("id").primaryKey(),
  phoneLineId: integer("phone_line_id").notNull().references(() => phoneLines.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: varchar("start_time", { length: 5 }).notNull(), // "09:00" 24-hour format
  endTime: varchar("end_time", { length: 5 }).notNull(), // "18:00" 24-hour format
  action: varchar("action", { length: 20 }).notNull(), // "forward" or "voicemail"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  phoneLineIdIndex: index("phone_schedules_phone_line_id_idx").on(table.phoneLineId),
  dayOfWeekIndex: index("phone_schedules_day_of_week_idx").on(table.dayOfWeek),
}));

// Recurring Services - Tracks customer subscriptions to regular service schedules
export const recurringServices = pgTable("recurring_services", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  frequency: varchar("frequency", { length: 30 }).notNull(), // weekly, biweekly, monthly, every_2_months, every_3_months, quarterly, every_6_months, yearly, first_of_month, 15th_of_month, last_of_month, custom_dates
  intervalType: varchar("interval_type", { length: 30 }), // New: weekly, biweekly, monthly, every_2_months, every_3_months, quarterly, every_6_months, yearly, first_of_month, 15th_of_month, last_of_month, custom_dates
  nextScheduledDate: date("next_scheduled_date"), // When the next appointment should be auto-created (null if deferred or custom_dates)
  autoRenew: boolean("auto_renew").default(true), // Continue creating appointments after each completion
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, paused, cancelled, deferred
  preferredTime: text("preferred_time"), // Customer's preferred time (e.g., "9:00 AM", "2:00 PM")
  preferredDayOfWeek: integer("preferred_day_of_week"), // 0-6 (Sunday-Saturday), for weekly/biweekly
  preferredDayOfMonth: integer("preferred_day_of_month"), // 1-31, for monthly/quarterly
  intervalCustomDates: text("interval_custom_dates").array(), // Array of specific dates for custom_dates interval (e.g., ["2025-03-15", "2025-06-20", "2025-09-10"])
  deferredUntil: timestamp("deferred_until"), // When to send reminder for deferred scheduling
  bookingToken: varchar("booking_token", { length: 50 }), // Unique token for reminder booking links
  tokenExpiresAt: timestamp("token_expires_at"), // When booking token expires (default 30 days)
  notes: text("notes"), // Special instructions for recurring service
  pauseReason: text("pause_reason"), // Why service was paused
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  pausedAt: timestamp("paused_at"), // When service was paused
  cancelledAt: timestamp("cancelled_at"), // When service was cancelled
  lastAppointmentCreatedAt: timestamp("last_appointment_created_at"), // Last time an appointment was auto-created
});

// SMS Delivery Tracking - Monitors every SMS sent via Twilio
export const smsDeliveryStatus = pgTable("sms_delivery_status", {
  id: serial("id").primaryKey(),
  messageSid: text("message_sid").notNull().unique(), // Twilio's unique message identifier
  conversationId: integer("conversation_id").references(() => conversations.id), // Link to conversation if available
  messageId: integer("message_id").references(() => messages.id), // Link to stored message
  to: text("to").notNull(), // Recipient phone number
  from: text("from").notNull(), // Sender phone number (your Twilio number)
  body: text("body"), // Message content (for reference)
  status: varchar("status", { length: 20 }).notNull(), // queued, sending, sent, delivered, failed, undelivered
  direction: varchar("direction", { length: 20 }).notNull(), // inbound, outbound-api, outbound-call, outbound-reply
  price: numeric("price"), // Cost of SMS in USD
  priceUnit: varchar("price_unit", { length: 10 }), // Currency (USD)
  errorCode: integer("error_code"), // Twilio error code if failed
  errorMessage: text("error_message"), // Human-readable error description
  numSegments: integer("num_segments"), // Number of SMS segments (for long messages)
  createdAt: timestamp("created_at").defaultNow(), // When message was initially sent
  sentAt: timestamp("sent_at"), // When Twilio handed off to carrier
  deliveredAt: timestamp("delivered_at"), // When carrier confirmed delivery
  failedAt: timestamp("failed_at"), // When delivery failed
  updatedAt: timestamp("updated_at").defaultNow(), // Last status update from Twilio
});

// Create the tables for gamification
export const loyaltyPoints = pgTable("loyalty_points", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"), // Phase 14: Multi-tenant support
  customerId: integer("customer_id").notNull().references(() => customers.id),
  points: integer("points").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  expiryDate: timestamp("expiry_date"), // Points expire after 12 months
}, (table) => ({
  // Phase 14: Composite unique constraint for multi-tenant loyalty balances
  tenantCustomerUnique: uniqueIndex("loyalty_points_tenant_customer_unique").on(table.tenantId, table.customerId),
}));

export const loyaltyTiers = pgTable("loyalty_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pointThreshold: integer("point_threshold").notNull(),
  benefits: text("benefits").array(),
  icon: text("icon"),
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pointValue: integer("point_value").notNull().default(0),
  criteria: text("criteria").notNull(),
  icon: text("icon"),
  level: integer("level").notNull().default(1),
});

export const rewardServices = pgTable("reward_services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pointCost: integer("point_cost").notNull(), // 500, 1000, 2000, or 5000
  tier: varchar("tier", { length: 20 }).notNull(), // 'tier_500', 'tier_1000', 'tier_2000', 'tier_5000'
  active: boolean("active").default(true),
  // Note: Table name remains reward_services for database compatibility, but UI shows "Loyalty Offers"
});

export const pointsTransactions = pgTable("points_transactions", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("root"), // Phase 14: Multi-tenant support
  loyaltyPointsId: integer("loyalty_points_id").notNull().references(() => loyaltyPoints.id),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  transactionDate: timestamp("transaction_date").defaultNow(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // 'earn' or 'redeem'
  source: varchar("source", { length: 30 }).notNull(), // 'appointment', 'referral', 'review', etc.
  sourceId: integer("source_id"), // ID of the related entity (appointment, etc.)
  expiryDate: timestamp("expiry_date"), // When these points expire (12 months from earning)
}, (table) => ({
  // Phase 14: Index for tenant-scoped queries
  tenantCustomerIdx: index("points_transactions_tenant_customer_idx").on(table.tenantId, table.loyaltyPointsId),
}));

// Phase 14: Promo Engine - Loyalty transactions for promotional awards
// This table tracks all promo-based point awards (welcome back, referrals, etc.) with anti-abuse tracking
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  deltaPoints: integer("delta_points").notNull(), // positive = earn, negative = redeem
  promoKey: varchar("promo_key", { length: 50 }), // e.g. 'welcome_back_v1', 'referral_v1'
  source: varchar("source", { length: 50 }).notNull(), // 'campaign', 'manual', 'invoice', 'promo_pending_fulfilled', etc.
  metadata: jsonb("metadata"), // Flexible storage for promo-specific data
  status: varchar("status", { length: 50 }).default('pending'), // 'pending', 'fulfilled', 'cancelled'
  pointsAwarded: integer("points_awarded"), // Headline points for this promo (may differ from deltaPoints if multipliers applied)
  fulfilledAt: timestamp("fulfilled_at"), // When pending promo was fulfilled
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for efficient anti-abuse queries
  tenantCustomerIdx: index("loyalty_transactions_tenant_customer_idx").on(table.tenantId, table.customerId),
  tenantPromoIdx: index("loyalty_transactions_tenant_promo_idx").on(table.tenantId, table.promoKey),
  tenantCustomerPromoIdx: index("loyalty_transactions_tenant_customer_promo_idx").on(table.tenantId, table.customerId, table.promoKey),
  tenantStatusIdx: index("loyalty_transactions_tenant_status_idx").on(table.tenantId, table.status),
}));

export const customerAchievements = pgTable("customer_achievements", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  achievementId: integer("achievement_id").notNull().references(() => achievements.id),
  dateEarned: timestamp("date_earned").defaultNow(),
  notified: boolean("notified").default(false),
});

export const redeemedRewards = pgTable("redeemed_rewards", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  rewardServiceId: integer("reward_service_id").notNull().references(() => rewardServices.id),
  pointsSpent: integer("points_spent").notNull(),
  redeemedDate: timestamp("redeemed_date").defaultNow(),
  status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'scheduled', 'completed', 'expired'
  appointmentId: integer("appointment_id").references(() => appointments.id),
  expiryDate: timestamp("expiry_date"), // When the redeemed loyalty offer expires if not used
  // Note: Table name remains redeemed_rewards for database compatibility, but UI shows "Redeemed Loyalty Offers"
});

// Referral tracking for refer-a-friend loyalty program
// Status flow: pending → signed_up → first_service_completed → rewarded
// Optional states: expired (if code expires), invalid (fraud/abuse detection)
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => customers.id), // Customer who made the referral
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(), // Unique code for tracking (e.g., "JOHN-ABC123")
  refereePhone: varchar("referee_phone", { length: 20 }), // Phone number of person being referred
  refereeEmail: text("referee_email"), // Email of person being referred
  refereeName: text("referee_name"), // Name of person being referred (optional)
  refereeCustomerId: integer("referee_customer_id").references(() => customers.id), // Once they sign up, link to their customer record
  status: varchar("status", { length: 30 }).notNull().default("pending"), // 'pending', 'signed_up', 'first_service_completed', 'rewarded', 'expired', 'invalid'
  pointsAwarded: integer("points_awarded").default(500), // Points given to referrer when referee completes first service
  createdAt: timestamp("created_at").defaultNow(), // When referral link was generated
  expiresAt: timestamp("expires_at"), // Optional expiration for referral code (default: no expiration)
  signedUpAt: timestamp("signed_up_at"), // When referee created account/completed first booking
  completedAt: timestamp("completed_at"), // When referee completed their first service
  rewardedAt: timestamp("rewarded_at"), // When referrer received their points
  rewardedInvoiceId: integer("rewarded_invoice_id"), // Invoice ID that triggered the reward (ensures idempotency)
  notes: text("notes"), // Optional notes about the referral
});

// Referral Program Configuration - Singleton table for referral system settings
// This table stores all configurable properties for the referral system
export const referralProgramConfig = pgTable("referral_program_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true), // Master on/off switch
  
  // Referrer reward configuration (person who shares the code)
  referrerRewardType: varchar("referrer_reward_type", { length: 30 }).notNull().default("loyalty_points"), // 'loyalty_points', 'fixed_discount', 'percent_discount', 'service_credit', 'free_addon', 'tier_upgrade', 'priority_booking', 'milestone_reward', 'gift_card'
  referrerRewardAmount: numeric("referrer_reward_amount", { precision: 10, scale: 2 }).notNull().default("500"), // Amount varies by type: points=500, discount=$25, percent=15, etc.
  referrerRewardServiceId: integer("referrer_reward_service_id").references(() => services.id), // For free_addon type - which service/addon to give
  referrerRewardExpiryDays: integer("referrer_reward_expiry_days"), // How many days until referrer reward expires (null = never)
  referrerRewardNotes: text("referrer_reward_notes"), // Display text for reward description
  
  // Referee reward configuration (person who uses the code - new customer)
  refereeRewardType: varchar("referee_reward_type", { length: 30 }).notNull().default("fixed_discount"), // Same types as referrer
  refereeRewardAmount: numeric("referee_reward_amount", { precision: 10, scale: 2 }).notNull().default("25"), // Default $25 off first service
  refereeRewardServiceId: integer("referee_reward_service_id").references(() => services.id), // For free_addon type
  refereeRewardExpiryDays: integer("referee_reward_expiry_days"), // How many days until referee reward expires (null = never)
  refereeRewardNotes: text("referee_reward_notes"), // Display text for reward description
  
  // Code generation settings
  codeExpiryDays: integer("code_expiry_days").default(90), // How long referral codes are valid (null = never expire)
  maxUsesPerCode: integer("max_uses_per_code").default(1), // Usually 1, but could allow multiple uses
  
  // Milestone rewards - bonus rewards for hitting referral milestones
  milestonesEnabled: boolean("milestones_enabled").default(false),
  milestoneConfig: jsonb("milestone_config").default('[]'), // Array of {threshold: 5, rewardType: 'free_addon', amount: 100, notes: 'Free wax!'}
  
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Reward Audit Trail - Tracks all referral reward applications
// Used for debugging, analytics, and ensuring rewards are only applied once
export const rewardAudit = pgTable("reward_audit", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull().references(() => referrals.id),
  customerId: integer("customer_id").notNull().references(() => customers.id), // Who received the reward
  rewardRole: varchar("reward_role", { length: 20 }).notNull(), // 'referrer' or 'referee'
  rewardType: varchar("reward_type", { length: 30 }).notNull(), // 'loyalty_points', 'fixed_discount', etc.
  rewardAmount: numeric("reward_amount", { precision: 10, scale: 2 }).notNull(), // Value of reward applied
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'applied', 'expired', 'failed'
  
  // Application tracking
  appliedAt: timestamp("applied_at"), // When reward was actually applied
  expiresAt: timestamp("expires_at"), // When reward expires if not used
  invoiceId: integer("invoice_id").references(() => invoices.id), // Invoice where discount was applied (for discount types)
  transactionId: integer("transaction_id").references(() => pointsTransactions.id), // Points transaction (for points type)
  
  // Metadata
  metadata: jsonb("metadata"), // Flexible storage for type-specific data
  errorMessage: text("error_message"), // If failed, why?
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Performance indexes for high-volume lookups
  referralIdIdx: index("reward_audit_referral_id_idx").on(table.referralId),
  customerIdIdx: index("reward_audit_customer_id_idx").on(table.customerId),
  statusIdx: index("reward_audit_status_idx").on(table.status),
}));

// QR Code Actions - Configurable QR code actions with scan tracking
export const qrCodeActions = pgTable("qr_code_actions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  actionType: varchar("action_type", { length: 50 }).notNull().default("booking"), // 'booking', 'profile', 'loyalty', 'custom', 'deep_link'
  actionUrl: text("action_url").notNull(), // Target URL or deep link
  trackingEnabled: boolean("tracking_enabled").notNull().default(true),
  scans: integer("scans").notNull().default(0), // Track QR code usage
  lastScannedAt: timestamp("last_scanned_at"), // Last scan timestamp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  customerIdIdx: index("qr_code_actions_customer_id_idx").on(table.customerId),
}));

// Tables for post-purchase upsell system
export const upsellOffers = pgTable("upsell_offers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  serviceId: integer("service_id").references(() => services.id),
  addOnService: boolean("add_on_service").default(false),
  discountPercentage: numeric("discount_percentage"),
  discountAmount: numeric("discount_amount"),
  active: boolean("active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  minimumPurchaseAmount: numeric("minimum_purchase_amount"),
  applicableServiceIds: text("applicable_service_ids").array(), // Services this upsell can be offered with
  validityDays: integer("validity_days").default(3), // How many days the upsell offer is valid after original purchase
});

export const appointmentUpsells = pgTable("appointment_upsells", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  upsellOfferId: integer("upsell_offer_id").notNull().references(() => upsellOffers.id),
  offeredAt: timestamp("offered_at").defaultNow(),
  status: varchar("status", { length: 20 }).default("offered"), // 'offered', 'accepted', 'declined', 'expired'
  responseAt: timestamp("response_at"),
  newAppointmentId: integer("new_appointment_id").references(() => appointments.id), // If accepted, reference to the new appointment
  expiryDate: timestamp("expiry_date"), // When the upsell offer expires
  discountApplied: numeric("discount_applied"), // The actual discount amount applied
});

// Email campaign tables
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  scheduledDate: timestamp("scheduled_date"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"), // When all sends finished
  status: varchar("status", { length: 20 }).notNull().default("draft"), // 'draft', 'scheduled', 'sending', 'sent', 'cancelled'
  openRate: numeric("open_rate"),
  clickRate: numeric("click_rate"),
  targetAudience: varchar("target_audience", { length: 30 }).default("all"), // 'all', 'repeat_customers', 'new_customers', 'premium_customers'
  recipientCount: integer("recipient_count").default(0),
  sentCount: integer("sent_count").default(0), // Track progress
  failedCount: integer("failed_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Campaign Recipients - Track individual email sends per campaign
export const campaignRecipients = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => emailCampaigns.id),
  customerId: integer("customer_id").references(() => customers.id),
  email: text("email").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, queued, sending, sent, failed, bounced, complained, unsubscribed
  scheduledFor: timestamp("scheduled_for"), // When this should be sent (quiet hours handling)
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  attemptCount: integer("attempt_count").default(0),
  lastError: text("last_error"),
  messageSid: text("message_sid"), // SendGrid message ID for webhook correlation
  metadata: jsonb("metadata"), // Additional tracking data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  campaignStatusIdx: index("campaign_recipients_status_idx").on(table.campaignId, table.status),
  emailIdx: index("campaign_recipients_email_idx").on(table.email),
  messageSidIdx: index("campaign_recipients_message_sid_idx").on(table.messageSid),
}));

// Email Suppression List - Global bounce/spam/unsubscribe list
export const emailSuppressionList = pgTable("email_suppression_list", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  reason: varchar("reason", { length: 20 }).notNull(), // hard_bounce, soft_bounce, spam_complaint, unsubscribe, manual
  source: text("source"), // Which campaign triggered this
  addedAt: timestamp("added_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  emailIdx: index("email_suppression_email_idx").on(table.email),
}));

// SMS Campaign tables
export const smsCampaigns = pgTable("sms_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  message: text("message").notNull(), // SMS content (max 1600 chars, but recommend 320 for 2 segments)
  scheduledDate: timestamp("scheduled_date"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, scheduled, sending, sent, cancelled
  targetAudience: varchar("target_audience", { length: 30 }).default("all"), // all, repeat_customers, sms_opted_in
  recipientCount: integer("recipient_count").default(0),
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  fromNumber: text("from_number"), // Which Twilio number to send from (5304 or 5711)
  estimatedSegments: integer("estimated_segments").default(1), // Based on message length
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// SMS Campaign Recipients - Track individual SMS sends
export const smsCampaignRecipients = pgTable("sms_campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => smsCampaigns.id),
  customerId: integer("customer_id").references(() => customers.id),
  phoneNumber: text("phone_number").notNull(), // E.164 format
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, queued, sending, sent, failed, delivered, undelivered
  scheduledFor: timestamp("scheduled_for"), // Adjusted for quiet hours (9 PM - 8 AM)
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  attemptCount: integer("attempt_count").default(0),
  lastError: text("last_error"),
  twilioSid: text("twilio_sid"), // Twilio message SID
  deliveryStatusId: integer("delivery_status_id").references(() => smsDeliveryStatus.id), // Link to tracking
  timezone: text("timezone").default("America/Chicago"), // Customer timezone for quiet hours
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  campaignStatusIdx: index("sms_campaign_recipients_status_idx").on(table.campaignId, table.status),
  phoneIdx: index("sms_campaign_recipients_phone_idx").on(table.phoneNumber),
  twilioSidIdx: index("sms_campaign_recipients_twilio_sid_idx").on(table.twilioSid),
}));

// Daily Send Counters - Track email/SMS sends per day for rate limiting
export const dailySendCounters = pgTable("daily_send_counters", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(), // YYYY-MM-DD
  emailCount: integer("email_count").default(0),
  smsCount: integer("sms_count").default(0),
  emailLimit: integer("email_limit").default(50), // Configurable daily limit (50 for Free tier)
  smsLimit: integer("sms_limit").default(200), // Conservative limit for 10DLC (1 msg/sec = 86,400/day max)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dateIdx: uniqueIndex("daily_send_counters_date_idx").on(table.date),
}));

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 30 }).notNull().default("general"), // 'promotional', 'transactional', 'seasonal', 'holiday'
  lastUsed: timestamp("last_used"),
});

export const emailSubscribers = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribed: boolean("subscribed").default(true),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

// Quick reply templates for the messaging interface
export const quickReplyCategories = pgTable("quick_reply_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"), // Emoji or icon name
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quickReplyTemplates = pgTable("quick_reply_templates", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => quickReplyCategories.id),
  content: text("content").notNull(),
  shortcut: text("shortcut"), // Optional keyboard shortcut (e.g. "/hi", "/price")
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used"),
});

// Notification settings for voice webhooks, SMS, email, etc.
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(), // e.g., 'voice_webhook', 'sms_reminder'
  enabled: boolean("enabled").default(true),
  config: jsonb("config").notNull(), // Flexible JSON for any settings
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// SMS Templates - Centralized template management with versioning
export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default('root'),
  templateKey: varchar("template_key", { length: 100 }).notNull(), // e.g., 'on_site_arrival', 'booking_confirmation'
  category: varchar("category", { length: 50 }).notNull(), // 'booking', 'technician', 'referrals', 'payment', etc.
  channel: varchar("channel", { length: 20 }).notNull().default("sms"), // Future: 'sms', 'email', 'push'
  language: varchar("language", { length: 10 }).notNull().default("en"), // Future: 'en', 'es', etc.
  name: text("name").notNull(), // Human-readable name
  description: text("description"), // Description for dashboard
  body: text("body").notNull(), // Template text with {variables}
  variables: jsonb("variables").notNull(), // Array of {name, description, sample, required}
  defaultPayload: jsonb("default_payload"), // Example payload for preview
  enabled: boolean("enabled").default(true),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => ({
  // Composite unique constraint: template_key must be unique PER TENANT
  tenantTemplateKeyUnique: uniqueIndex("sms_templates_tenant_id_template_key_unique").on(table.tenantId, table.templateKey),
}));

// SMS Template Versions - Audit trail and rollback support
export const smsTemplateVersions = pgTable("sms_template_versions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => smsTemplates.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().default(1),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  variables: jsonb("variables").notNull(),
  changeDescription: text("change_description"), // What changed in this version
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// AI Behavior Rules - Industry-specific AI personality and conversation rules
export const aiBehaviorRules = pgTable("ai_behavior_rules", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default('root'),
  ruleKey: varchar("rule_key", { length: 100 }).notNull(), // e.g., 'system_prompt', 'conversation_style', 'topic_boundaries'
  category: varchar("category", { length: 50 }).notNull(), // 'personality', 'boundaries', 'upsell', 'scheduling', etc.
  name: text("name").notNull(), // Human-readable name
  description: text("description"), // Description for dashboard
  content: text("content").notNull(), // The actual rule text/prompt
  priority: integer("priority").notNull().default(100), // For ordering rules (lower = higher priority)
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => ({
  // Composite unique constraint: rule_key must be unique PER TENANT
  tenantRuleKeyUnique: uniqueIndex("ai_behavior_rules_tenant_id_rule_key_unique").on(table.tenantId, table.ruleKey),
}));

// FAQ Entries - Industry-specific frequently asked questions
export const faqEntries = pgTable("faq_entries", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default('root'),
  category: varchar("category", { length: 50 }).notNull(), // 'pricing', 'services', 'policies', 'location', etc.
  question: text("question").notNull(), // The FAQ question
  answer: text("answer").notNull(), // The answer (can include markdown)
  keywords: text("keywords").array(), // Search keywords for matching
  displayOrder: integer("display_order").notNull().default(0), // For ordering in UI
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => ({
  // Composite unique constraint: (category, question) must be unique PER TENANT
  tenantCategoryQuestionUnique: uniqueIndex("faq_entries_tenant_id_category_question_unique").on(table.tenantId, table.category, table.question),
}));

// Push notification subscriptions for PWA
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Link to user
  endpoint: text("endpoint").notNull().unique(), // Browser push endpoint
  p256dh: text("p256dh").notNull(), // Public key for encryption
  auth: text("auth").notNull(), // Authentication secret
  userAgent: text("user_agent"), // Browser/device info
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(), // Track last notification sent
});

// Notification preferences for granular control over notification channels
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  // Notification types
  voicemailSms: boolean("voicemail_sms").notNull().default(true),
  voicemailPush: boolean("voicemail_push").notNull().default(true),
  cashPaymentSms: boolean("cash_payment_sms").notNull().default(true),
  cashPaymentPush: boolean("cash_payment_push").notNull().default(true),
  systemErrorSms: boolean("system_error_sms").notNull().default(true),
  systemErrorPush: boolean("system_error_push").notNull().default(true),
  missedCallSms: boolean("missed_call_sms").notNull().default(false), // Auto-reply to customer
  appointmentReminderPush: boolean("appointment_reminder_push").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Critical monitoring settings for multi-channel alerts on integration failures
export const criticalMonitoringSettings = pgTable("critical_monitoring_settings", {
  id: serial("id").primaryKey(),
  alertChannels: jsonb("alert_channels").notNull().$type<{ sms: boolean; push: boolean; email: boolean }>(), // Which channels to use for alerts
  smsRecipients: text("sms_recipients").array().notNull().default([]), // Phone numbers to receive SMS alerts
  emailRecipients: text("email_recipients").array().notNull().default([]), // Email addresses to receive email alerts
  pushRoles: text("push_roles").array().notNull().default(['owner', 'manager']), // User roles to receive push notifications
  failureThreshold: integer("failure_threshold").notNull().default(3), // Number of consecutive failures before alerting
  cooldownMinutes: integer("cooldown_minutes").notNull().default(30), // Minutes between repeat alerts
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Gallery photos for the public gallery page - uploaded by admin
export const galleryPhotos = pgTable("gallery_photos", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(), // URL or path to uploaded image
  title: text("title"), // Optional caption
  description: text("description"), // Optional longer description
  displayOrder: integer("display_order").notNull().default(0), // For drag-and-drop reordering
  isActive: boolean("is_active").default(true), // Show/hide without deleting
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("1"), // Multi-tenant support
});

// Subscription cost tracking for managing all website service subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(), // e.g., "Stripe", "Twilio", "SendGrid"
  description: text("description"), // What this service is used for
  monthlyCost: numeric("monthly_cost", { precision: 10, scale: 2 }).notNull(), // Cost per month
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"), // monthly or yearly
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, cancelled, paused
  renewalDate: date("renewal_date"), // Next billing date
  website: text("website"), // Link to service website
  notes: text("notes"), // Additional notes or account info
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Cancellation feedback tracking for business insights
export const cancellationFeedback = pgTable("cancellation_feedback", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  customerId: integer("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  serviceName: text("service_name").notNull(),
  appointmentDate: timestamp("appointment_date").notNull(),
  reason: text("reason").notNull(), // Specific reason selected
  category: varchar("category", { length: 30 }).notNull(), // scheduling, pricing, service_concerns, personal, found_alternative, other
  additionalComments: text("additional_comments"), // Optional detailed feedback
  wouldReschedule: boolean("would_reschedule").default(false), // Whether they want to reschedule
  wantsFullCancellation: boolean("wants_full_cancellation").default(true), // Complete cancel vs reschedule
  wantsFollowUp: boolean("wants_follow_up").default(false), // Whether they want us to check in later
  followUpDate: timestamp("follow_up_date"), // When they want us to reach out
  followUpNotes: text("follow_up_notes"), // What they want us to ask/offer when following up
  suggestedResponse: text("suggested_response"), // AI-generated response to send back
  responseStatus: varchar("response_status", { length: 20 }).default("pending"), // pending, sent, no_response_needed
  createdAt: timestamp("created_at").defaultNow(),
});

// Follow-up reminder queue for customers who want to be contacted later
export const followUpReminders = pgTable("follow_up_reminders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  cancellationId: integer("cancellation_id").references(() => cancellationFeedback.id),
  reminderDate: timestamp("reminder_date").notNull(), // When to send reminder
  reminderType: varchar("reminder_type", { length: 30 }).default("reschedule_check"), // reschedule_check, follow_up, other
  message: text("message"), // What to say/ask
  status: varchar("status", { length: 20 }).default("pending"), // pending, sent, completed, cancelled
  sentAt: timestamp("sent_at"),
  responseReceived: boolean("response_received").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Facebook/Instagram Messenger Integration Settings
export const facebookPageTokens = pgTable("facebook_page_tokens", {
  id: serial("id").primaryKey(),
  pageId: text("page_id").notNull().unique(), // Facebook Page ID
  pageName: text("page_name").notNull(), // Friendly name for display
  pageAccessToken: text("page_access_token").notNull(), // Page-scoped access token (stored encrypted)
  platform: varchar("platform", { length: 20 }).notNull().default("facebook"), // 'facebook' or 'instagram'
  isActive: boolean("is_active").default(true), // Enable/disable without deleting
  webhookVerifyToken: text("webhook_verify_token"), // Token for webhook verification
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Business settings (singleton table - only one row with id=1)
export const businessSettings = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  
  // Active schedule settings
  activeScheduleType: varchar("active_schedule_type", { length: 20 }).notNull().default("regular"), // 'regular', 'summer', 'winter'
  startHour: integer("start_hour").notNull().default(9), // Opening hour (0-23)
  startMinute: integer("start_minute").notNull().default(0), // Opening minute (0, 15, 30, 45)
  endHour: integer("end_hour").notNull().default(15), // Closing hour (0-23)
  endMinute: integer("end_minute").notNull().default(0), // Closing minute (0, 15, 30, 45)
  
  // Summer hours preset
  summerStartHour: integer("summer_start_hour").notNull().default(8),
  summerStartMinute: integer("summer_start_minute").notNull().default(0),
  summerEndHour: integer("summer_end_hour").notNull().default(18),
  summerEndMinute: integer("summer_end_minute").notNull().default(0),
  
  // Winter hours preset
  winterStartHour: integer("winter_start_hour").notNull().default(10),
  winterStartMinute: integer("winter_start_minute").notNull().default(0),
  winterEndHour: integer("winter_end_hour").notNull().default(17),
  winterEndMinute: integer("winter_end_minute").notNull().default(0),
  
  enableLunchBreak: boolean("enable_lunch_break").notNull().default(true), // Whether lunch break is enabled
  lunchHour: integer("lunch_hour").notNull().default(12), // Lunch hour (0-23)
  lunchMinute: integer("lunch_minute").notNull().default(0), // Lunch minute (0, 15, 30, 45)
  daysOfWeek: integer("days_of_week").array().notNull().default([1, 2, 3, 4, 5]), // Working days (0=Sunday, 6=Saturday)
  allowWeekendBookings: boolean("allow_weekend_bookings").notNull().default(false), // Allow weekend bookings
  halfHourIncrements: boolean("half_hour_increments").notNull().default(true), // Allow 30-minute booking slots
  minimumNoticeHours: integer("minimum_notice_hours").notNull().default(24), // Hours before booking allowed
  maxDriveTimeMinutes: integer("max_drive_time_minutes").notNull().default(26), // Maximum drive time from Tulsa base (in minutes)
  etaPadding: integer("eta_padding").notNull().default(15), // Minutes to add to ETA estimates (buffer time)
  googlePlaceId: text("google_place_id").default(""), // Google Business Profile Place ID for reviews/photos
  excludedServices: text("excluded_services").array().default([]), // Services we don't offer (shown to AI for quick rejection)
  
  // Maintenance mode & failsafe settings
  maintenanceMode: boolean("maintenance_mode").default(false),
  maintenanceMessage: text("maintenance_message").default("We're currently performing maintenance. Please check back soon or contact us directly."),
  backupEmail: text("backup_email"), // Email to forward booking requests during failures
  alertPhone: text("alert_phone"), // Phone for SMS alerts on critical failures
  autoFailoverThreshold: integer("auto_failover_threshold").default(5), // High-severity errors within 5 min triggers maintenance
  lastFailoverAt: timestamp("last_failover_at"),
  
  // SMS Fallback settings
  smsFallbackEnabled: boolean("sms_fallback_enabled").default(false), // Enable/disable SMS fallback system (defaults to false for safety)
  smsFallbackPhone: text("sms_fallback_phone"), // Phone number to forward messages to when main system is down
  smsFallbackAutoReply: text("sms_fallback_auto_reply").default("Thanks for your message! Our automated system is currently offline. You'll receive a personal response shortly."), // Auto-reply message sent to customers
  
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Service Limits - Daily booking caps per service type
export const serviceLimits = pgTable("service_limits", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => services.id),
  dailyLimit: integer("daily_limit").notNull(), // Max bookings per calendar day
  effectiveFrom: date("effective_from"), // Optional: limit only applies after this date
  effectiveTo: date("effective_to"), // Optional: limit expires after this date
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => ({
  // Composite index for fast lookups during availability checks
  serviceLimitLookupIdx: index("service_limit_lookup_idx").on(table.serviceId, table.isActive, table.effectiveFrom),
  // Unique constraint to prevent overlapping active ranges
  serviceLimitUniqueIdx: uniqueIndex("service_limit_unique_idx").on(table.serviceId, table.effectiveFrom, table.effectiveTo, table.isActive),
}));

// Site-wide Banners - Scheduled announcements with multiple display modes
export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default('root'),
  title: text("title").notNull(),
  bodyText: text("body_text").notNull(), // Plain text or markdown, NO raw HTML (sanitized on render)
  displayMode: varchar("display_mode", { length: 20 }).notNull().default("top_bar"), // top_bar, modal, floating
  ctaLabel: text("cta_label"), // Button/link text (e.g., "Book Now", "Learn More")
  ctaUrl: text("cta_url"), // Full URL or relative path
  priority: integer("priority").default(0), // Higher = shows first if multiple active
  pageTargets: text("page_targets").array().default([]), // Empty = all pages, or specific paths like ["/", "/services"]
  scheduleStart: timestamp("schedule_start"), // When to start showing
  scheduleEnd: timestamp("schedule_end"), // When to stop showing
  isDismissible: boolean("is_dismissible").default(true), // Can user close it?
  trackingKey: text("tracking_key").notNull().unique(), // Unique key for tracking dismissals in localStorage
  themeColor: varchar("theme_color", { length: 20 }).default("blue"), // blue, red, green, yellow, purple
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
}, (table) => ({
  // Index for fast active banner queries
  bannerActiveScheduleIdx: index("banner_active_schedule_idx").on(table.isActive, table.scheduleStart, table.scheduleEnd),
}));

// Banner Analytics - Track impressions and clicks separately from banner config
export const bannerMetrics = pgTable("banner_metrics", {
  id: serial("id").primaryKey(),
  bannerId: integer("banner_id").notNull().references(() => banners.id),
  eventType: varchar("event_type", { length: 20 }).notNull(), // impression, click, dismiss
  sessionId: text("session_id"), // Optional: track unique sessions
  userAgent: text("user_agent"), // Browser info
  pageUrl: text("page_url"), // Where the event occurred
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  bannerMetricsLookupIdx: index("banner_metrics_lookup_idx").on(table.bannerId, table.eventType, table.createdAt),
}));

// Customer Tags - For organizing and filtering customers
export const customerTags = pgTable("customer_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Tag name (e.g., "Hot Lead", "VIP", "Warranty")
  color: varchar("color", { length: 20 }).notNull().default("blue"), // UI color: blue, red, green, yellow, purple, gray
  icon: text("icon"), // Optional lucide icon name
  isPredefined: boolean("is_predefined").default(false), // System tags vs user-created
  createdAt: timestamp("created_at").defaultNow(),
});

// Join table: Conversations <-> Tags (many-to-many)
export const conversationTags = pgTable("conversation_tags", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  tagId: integer("tag_id").notNull().references(() => customerTags.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===== TECHNICIAN BIO PROFILES & EMPLOYEE MANAGEMENT =====

// Technician Profiles - Bio information for customer-facing OTW notifications
export const technicians = pgTable("technicians", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Link to user account if they have one
  publicId: text("public_id").notNull().unique(), // Public-facing ID for /p/:techPublicId URLs
  preferredName: text("preferred_name").notNull(), // First name for customer communication
  fullName: text("full_name").notNull(), // Full legal name for employment records
  email: text("email"),
  phone: text("phone"),
  city: text("city"), // Where tech is based (e.g., "Tulsa, OK")
  photoUrl: text("photo_url"), // Primary photo URL
  photoThumb96: text("photo_thumb_96"), // 96x96 thumbnail
  photoCard320: text("photo_card_320"), // 320x320 for cards
  photoMms640: text("photo_mms_640"), // 640x640 optimized for MMS
  bioAbout: text("bio_about"), // Customer-facing bio (≤140 chars)
  bioTags: jsonb("bio_tags"), // Array of up to 2 tags ["Certified Detailer", "5+ Years"]
  bioRaw: text("bio_raw"), // Tech's rough notes - never customer-facing
  bioAiLastRevision: text("bio_ai_last_revision"), // Latest AI suggestion for audit
  consentPublicProfile: boolean("consent_public_profile").default(true), // Can share name/photo/bio with customers
  profileReviewed: boolean("profile_reviewed").default(false), // Admin approved profile
  profileReviewedAt: timestamp("profile_reviewed_at"),
  profileReviewedBy: integer("profile_reviewed_by").references(() => users.id),
  profileRejectionReason: text("profile_rejection_reason"), // Why profile was rejected
  role: varchar("role", { length: 20 }).notNull().default("technician"), // technician, lead, manager
  employmentStatus: varchar("employment_status", { length: 20 }).notNull().default("active"), // active, inactive, on_leave, terminated
  hireDate: date("hire_date"),
  terminationDate: date("termination_date"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  skillLevel: integer("skill_level").default(1), // 1-5 skill rating for scheduling
  specialties: text("specialties").array(), // Services they specialize in
  maxJobsPerDay: integer("max_jobs_per_day").default(6), // Capacity constraint
  
  // Employee Provisioning - Auto-generated email and phone extension
  generatedEmail: varchar("generated_email", { length: 255 }), // Auto-generated email alias (firstname.lastname@cleanmachine.com)
  phoneExtension: integer("phone_extension"), // Sequential extension number (101, 102, 103...)
  provisioningStatus: varchar("provisioning_status", { length: 20 }).default("pending"), // pending, provisioned, failed
  provisioningError: text("provisioning_error"), // Error details if provisioning failed
  provisionedAt: timestamp("provisioned_at"), // When provisioning succeeded
  provisionedBy: integer("provisioned_by").references(() => users.id), // Admin who triggered provisioning
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on phone extension to prevent duplicates at database level
  phoneExtensionUniqueIdx: uniqueIndex("technicians_phone_extension_unique_idx").on(table.phoneExtension),
}));

// Extension Pool - Tracks available phone extensions for employee provisioning
export const extensionPool = pgTable("extension_pool", {
  id: serial("id").primaryKey(),
  nextExtension: integer("next_extension").notNull().default(101), // Next available extension to assign
  assignedExtensions: integer("assigned_extensions").array(), // List of all assigned extensions
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Org Settings - Feature flags and configuration for bio profiles and other features
export const orgSettings = pgTable("org_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(), // e.g., 'show_tech_photo_in_otw', 'ai_bio_coach_enabled'
  settingValue: jsonb("setting_value").notNull(), // Flexible JSON for any value type
  description: text("description"), // What this setting controls
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Agent Preferences - AI chatbot personality and behavior settings (singleton table - only one row with id=1)
export const agentPreferences = pgTable("agent_preferences", {
  id: serial("id").primaryKey(),
  
  // Personality settings (1-5 scale)
  professionalismLevel: integer("professionalism_level").notNull().default(4),
  friendliness: integer("friendliness").notNull().default(4),
  detailOrientation: integer("detail_orientation").notNull().default(3),
  humorLevel: integer("humor_level").notNull().default(2),
  enthusiasm: integer("enthusiasm").notNull().default(3),
  
  // Behavior settings
  useCustomerName: boolean("use_customer_name").notNull().default(true),
  askFollowUpQuestions: boolean("ask_follow_up_questions").notNull().default(true),
  offerSuggestions: boolean("offer_suggestions").notNull().default(true),
  sendConfirmationMessages: boolean("send_confirmation_messages").notNull().default(true),
  proactiveServiceReminders: boolean("proactive_service_reminders").notNull().default(true),
  holidayGreetings: boolean("holiday_greetings").notNull().default(true),
  
  // Language settings
  formality: integer("formality").notNull().default(3), // 1-5 scale (casual to formal)
  technicalTerms: integer("technical_terms").notNull().default(2), // 1-5 scale (simple to technical)
  messageLength: integer("message_length").notNull().default(3), // 1-5 scale (concise to detailed)
  defaultLanguage: varchar("default_language", { length: 10 }).notNull().default("en"),
  useEmojis: boolean("use_emojis").notNull().default(true),
  
  // Messaging settings
  smsOpeningMessage: text("sms_opening_message").notNull().default("Hi! Thanks for reaching out to Clean Machine Auto Detail. How can I help you today?"),
  websiteOpeningMessage: text("website_opening_message").notNull().default("Welcome to Clean Machine! I'm here to help you schedule a detailing appointment or answer any questions."),
  facebookOpeningMessage: text("facebook_opening_message").notNull().default("Hey there! Thanks for messaging Clean Machine. What can I do for you?"),
  
  // Holiday awareness
  knownHolidays: jsonb("known_holidays").notNull().default('[]'),
  
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Homepage Content - CMS for homepage text, colors, and branding (singleton table - only one row)
export const homepageContent = pgTable('homepage_content', {
  id: serial('id').primaryKey(),
  
  // Template Selection
  templateId: varchar('template_id', { length: 50 }).notNull().default('current'),
  layoutSettings: jsonb('layout_settings'), // Optional template-specific configuration
  
  // Hero Section
  heroHeading: text('hero_heading').notNull().default('Clean Machine Auto Detail'),
  heroSubheading: text('hero_subheading').notNull().default('Professional Mobile Auto Detailing'),
  heroCtaText: text('hero_cta_text').notNull().default('Book Now'),
  heroCtaLink: text('hero_cta_link').notNull().default('/booking'),
  
  // About Section
  aboutHeading: text('about_heading').notNull().default('About Us'),
  aboutText: text('about_text').notNull().default('Premium auto detailing services...'),
  
  // Services Section
  servicesHeading: text('services_heading').notNull().default('Our Services'),
  servicesSubheading: text('services_subheading'),
  
  // Colors (HSL format)
  primaryColor: varchar('primary_color', { length: 50 }).notNull().default('220 90% 56%'),
  secondaryColor: varchar('secondary_color', { length: 50 }).notNull().default('280 80% 60%'),
  accentColor: varchar('accent_color', { length: 50 }).notNull().default('340 80% 55%'),
  
  // Logo
  logoUrl: text('logo_url'),
  
  // SEO
  metaTitle: text('meta_title').notNull().default('Clean Machine Auto Detail'),
  metaDescription: text('meta_description').notNull().default('Professional auto detailing services'),
  
  // Timestamps
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});

// Job Postings - Careers/Employment portal job listings
export const jobPostings = pgTable('job_postings', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  department: varchar('department', { length: 100 }),
  location: varchar('location', { length: 100 }),
  employmentType: varchar('employment_type', { length: 50 }).notNull(), // 'full-time', 'part-time', 'contract'
  description: text('description').notNull(),
  requirements: text('requirements'),
  benefits: text('benefits'),
  salaryRange: varchar('salary_range', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Job Applications - Applications submitted through careers portal
export const jobApplications = pgTable('job_applications', {
  id: serial('id').primaryKey(),
  jobPostingId: integer('job_posting_id').references(() => jobPostings.id),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  resumeUrl: text('resume_url'),
  coverLetter: text('cover_letter'),
  linkedinUrl: varchar('linkedin_url', { length: 255 }),
  portfolioUrl: varchar('portfolio_url', { length: 255 }),
  yearsExperience: integer('years_experience'),
  currentCompany: varchar('current_company', { length: 200 }),
  status: varchar('status', { length: 50 }).default('new').notNull(), // 'new', 'reviewing', 'interviewing', 'rejected', 'hired'
  notes: text('notes'), // Admin notes
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

// Shift Templates - Define standard shift types (Morning, Afternoon, Full Day, etc.)
export const shiftTemplates = pgTable("shift_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "Morning Shift", "Afternoon Shift", "Full Day"
  startTime: text("start_time").notNull(), // "08:00"
  endTime: text("end_time").notNull(), // "16:00"
  durationHours: numeric("duration_hours").notNull(), // 8.0
  color: varchar("color", { length: 20 }).default("blue"), // UI color coding
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shifts - Assigned work periods for technicians
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").references(() => technicians.id), // Nullable for open shifts
  templateId: integer("template_id").references(() => shiftTemplates.id),
  shiftDate: date("shift_date").notNull(),
  startTime: text("start_time").notNull(), // "08:00"
  endTime: text("end_time").notNull(), // "16:00"
  status: varchar("status", { length: 20 }).notNull().default("scheduled"), // scheduled, confirmed, in_progress, completed, cancelled
  assignedAppointments: integer("assigned_appointments").array(), // IDs of appointments assigned to this shift
  appointmentId: integer("appointment_id").references(() => appointments.id), // Primary linked appointment
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Time Entries - Clock in/out tracking with geofencing
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").notNull().references(() => technicians.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  clockInLatitude: numeric("clock_in_latitude", { precision: 10, scale: 7 }),
  clockInLongitude: numeric("clock_in_longitude", { precision: 10, scale: 7 }),
  clockOutLatitude: numeric("clock_out_latitude", { precision: 10, scale: 7 }),
  clockOutLongitude: numeric("clock_out_longitude", { precision: 10, scale: 7 }),
  clockInAddress: text("clock_in_address"), // Geocoded address
  clockOutAddress: text("clock_out_address"),
  geofenceVerified: boolean("geofence_verified").default(false), // Within acceptable range
  totalHours: numeric("total_hours", { precision: 10, scale: 2 }),
  breakMinutes: integer("break_minutes").default(0),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, completed, flagged
  flagReason: text("flag_reason"), // Why entry was flagged (location mismatch, etc.)
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// PTO Requests - Time off management
export const ptoRequests = pgTable("pto_requests", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").notNull().references(() => technicians.id),
  requestType: varchar("request_type", { length: 20 }).notNull(), // vacation, sick, personal, unpaid
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalDays: numeric("total_days", { precision: 10, scale: 1 }).notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, denied, cancelled
  requestedAt: timestamp("requested_at").defaultNow(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"), // Why approved/denied
});

// Shift Trades - Technicians can swap shifts
export const shiftTrades = pgTable("shift_trades", {
  id: serial("id").primaryKey(),
  originalShiftId: integer("original_shift_id").notNull().references(() => shifts.id),
  offeringTechId: integer("offering_tech_id").notNull().references(() => technicians.id), // Who wants to give away shift
  requestingTechId: integer("requesting_tech_id").references(() => technicians.id), // Who wants to take shift (null if open offer)
  tradeType: varchar("trade_type", { length: 20 }).notNull(), // swap, giveaway
  swapShiftId: integer("swap_shift_id").references(() => shifts.id), // If swap, the other shift
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, approved, denied, cancelled
  message: text("message"), // Why they want to trade
  requestedAt: timestamp("requested_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
});

// Availability Preferences - Techs set their preferred working days/times
export const technicianAvailability = pgTable("technician_availability", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").notNull().references(() => technicians.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  available: boolean("available").default(true),
  preferredStartTime: text("preferred_start_time"), // "08:00"
  preferredEndTime: text("preferred_end_time"), // "17:00"
  maxHoursPerDay: numeric("max_hours_per_day", { precision: 10, scale: 1 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Applicants - Job applicant tracking and hiring pipeline
export const applicants = pgTable("applicants", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  position: varchar("position", { length: 50 }).notNull(), // "Auto Detailer", "Lead Technician"
  resumeUrl: text("resume_url"), // Link to uploaded resume
  coverLetter: text("cover_letter"),
  applicationStatus: varchar("application_status", { length: 20 }).notNull().default("new"), // new, screening, interview, offer, hired, rejected
  appliedAt: timestamp("applied_at").defaultNow(),
  source: varchar("source", { length: 30 }), // indeed, referral, website, walk-in
  referredBy: integer("referred_by").references(() => technicians.id), // If employee referral
  experienceYears: numeric("experience_years", { precision: 10, scale: 1 }),
  desiredPay: numeric("desired_pay", { precision: 10, scale: 2 }),
  availableStartDate: date("available_start_date"),
  interviewScheduledAt: timestamp("interview_scheduled_at"),
  interviewNotes: text("interview_notes"),
  assignedRecruiter: integer("assigned_recruiter").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  statusUpdatedAt: timestamp("status_updated_at").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Log - Track all important actions for compliance and debugging
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Who performed the action
  technicianId: integer("technician_id").references(() => technicians.id), // If action relates to a tech
  actionType: varchar("action_type", { length: 50 }).notNull(), // profile_create, profile_update, profile_approve, otw_send, ai_suggest, schedule_change, etc.
  entityType: varchar("entity_type", { length: 50 }), // technician, appointment, shift, etc.
  entityId: integer("entity_id"), // ID of the affected entity
  details: jsonb("details"), // Full details of what changed
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ===== THIRD-PARTY BILLING & GIFT MODE SYSTEM =====

// Contacts - Separate entities for job roles (requester, service contact, vehicle owner, payer)
// Different from `customers` table which remains the primary customer record
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull(), // E.164 format: +19185551234
  phoneDisplay: text("phone_display"), // Display format: (918) 555-1234
  email: text("email"),
  company: text("company"), // Company name for business contacts
  roleTags: jsonb("role_tags").notNull().default('[]'), // ["payer", "fleet_admin", "property_manager"]
  address: text("address"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  notificationPrefs: jsonb("notification_prefs").notNull().default('{"sms":true,"email":true}'), // {sms: boolean, email: boolean}
  verified: boolean("verified").default(false), // Phone/email verified
  verifiedAt: timestamp("verified_at"),
  smsOptOut: boolean("sms_opt_out").default(false), // Customer opted out via STOP
  smsOptOutAt: timestamp("sms_opt_out_at"),
  notes: text("notes"), // Internal notes about contact
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Authorizations - Digital approvals and signatures for payer approval, service authorization, etc.
export const authorizations = pgTable("authorizations", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  signerContactId: integer("signer_contact_id").notNull().references(() => contacts.id), // Who signed
  authType: varchar("auth_type", { length: 30 }).notNull(), // service_auth, payer_approval, gift_acceptance, change_order
  token: text("token").notNull().unique(), // Secure token for public approval page
  tokenExpiresAt: timestamp("token_expires_at").notNull(), // Token expiry (24-48 hours)
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending"), // pending, approved, declined, expired
  approvedAt: timestamp("approved_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"), // Why they declined
  signatureData: text("signature_data"), // Digital signature blob or e-signature ID
  ipAddress: text("ip_address"), // IP of signer for audit trail
  userAgent: text("user_agent"),
  agreedToTerms: boolean("agreed_to_terms").default(false), // Checkbox for terms
  otpVerified: boolean("otp_verified").default(false), // Track if OTP was verified for this authorization
  otpVerifiedAt: timestamp("otp_verified_at"), // When OTP was verified
  referralCode: text("referral_code"), // Referral code applied during payer approval (stored for later invoice creation)
  referralDiscount: numeric("referral_discount", { precision: 10, scale: 2 }), // Computed discount amount (NOT the raw reward value)
  referralDiscountType: varchar("referral_discount_type", { length: 30 }), // fixed_discount, percent_discount, service_credit, etc.
  referralReferrerId: integer("referral_referrer_id"), // ID of the customer who referred (for tracking)
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment Links - Track Stripe payment links for deposits and invoices
export const paymentLinks = pgTable("payment_links", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id), // Who should pay
  linkType: varchar("link_type", { length: 20 }).notNull(), // deposit, invoice, balance
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentLinkId: text("stripe_payment_link_id").notNull(), // Stripe payment link ID
  publicUrl: text("public_url").notNull(), // Public payment URL
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, paid, expired, cancelled
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at"), // Link expiration
  sentVia: varchar("sent_via", { length: 20 }), // sms, email, both
  sentAt: timestamp("sent_at"),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gift Cards - Track gift card codes, balances, and redemptions
export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // Gift card code (e.g., "GIFT-2024-ABC123")
  initialValue: numeric("initial_value", { precision: 10, scale: 2 }).notNull(),
  currentBalance: numeric("current_balance", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  purchasedBy: text("purchased_by"), // Name of purchaser
  purchasedByEmail: text("purchased_by_email"),
  purchasedByPhone: text("purchased_by_phone"),
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  giftMessage: text("gift_message"),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, redeemed, expired, cancelled
  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Gift cards may have expiry dates
  redeemedAt: timestamp("redeemed_at"), // When fully used
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Credit Ledger - Track customer service credits and awarded gift cards
export const creditLedger = pgTable("credit_ledger", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  creditType: varchar("credit_type", { length: 20 }).notNull(), // 'service_credit', 'gift_card'
  initialAmount: numeric("initial_amount", { precision: 10, scale: 2 }).notNull(),
  currentBalance: numeric("current_balance", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  source: varchar("source", { length: 50 }).notNull(), // 'referral_reward', 'purchase', 'admin_grant', 'promotion', 'compensation'
  sourceId: integer("source_id"), // ID of the source entity (e.g., referral code ID, invoice ID)
  description: text("description"), // Human-readable description of the credit
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active', 'used', 'expired', 'cancelled'
  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Credits may have expiry dates
  usedAt: timestamp("used_at"), // When fully consumed
  lastUsedAt: timestamp("last_used_at"), // Last partial usage
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  customerStatusIndex: index("credit_ledger_customer_status_idx").on(table.customerId, table.status),
  expiryIndex: index("credit_ledger_expiry_idx").on(table.expiresAt),
}));

// Credit Transactions - Audit trail for all credit ledger changes
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  creditLedgerId: integer("credit_ledger_id").notNull().references(() => creditLedger.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // Negative for usage, positive for additions
  invoiceId: integer("invoice_id").references(() => invoices.id), // Link to invoice if applied to payment
  description: text("description"), // What this transaction represents
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // 'issued', 'applied', 'refunded', 'expired', 'cancelled'
  balanceBefore: numeric("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Service Addons - Catalog of available service enhancements
export const serviceAddons = pgTable("service_addons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Tire Shine", "Air Freshener", "Engine Bay Detail"
  description: text("description"), // What the addon includes
  value: numeric("value", { precision: 10, scale: 2 }).notNull(), // Dollar value if purchased separately
  category: varchar("category", { length: 50 }), // 'exterior', 'interior', 'engine', 'protection'
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Addon Credits - Track awarded free addons
export const customerAddonCredits = pgTable("customer_addon_credits", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  addonId: integer("addon_id").notNull().references(() => serviceAddons.id),
  source: varchar("source", { length: 50 }).notNull(), // 'referral_reward', 'promotion', 'compensation', 'admin_grant'
  sourceId: integer("source_id"), // ID of the source entity (e.g., referral code ID)
  status: varchar("status", { length: 20 }).notNull().default("available"), // 'available', 'redeemed', 'expired', 'cancelled'
  grantedAt: timestamp("granted_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Addon credits may expire
  redeemedAt: timestamp("redeemed_at"),
  redeemedInvoiceId: integer("redeemed_invoice_id").references(() => invoices.id),
  notes: text("notes"),
}, (table) => ({
  customerStatusIndex: index("addon_credits_customer_status_idx").on(table.customerId, table.status),
}));

// Milestone Definitions - Configurable achievement milestones
export const milestoneDefinitions = pgTable("milestone_definitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "5th Booking Milestone", "VIP Spender"
  description: text("description"), // What the milestone represents
  milestoneType: varchar("milestone_type", { length: 30 }).notNull(), // 'bookings_count', 'total_spent', 'days_since_first'
  targetValue: numeric("target_value", { precision: 10, scale: 2 }).notNull(), // Threshold to reach (e.g., 5 for 5 bookings, 500 for $500 spent)
  rewardType: varchar("reward_type", { length: 30 }).notNull(), // What reward to grant when milestone is reached
  rewardValue: text("reward_value"), // Reward configuration (JSON or simple value)
  isActive: boolean("is_active").default(true),
  isRepeatable: boolean("is_repeatable").default(false), // Can milestone be achieved multiple times?
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Milestone Progress - Track customer progress toward milestones
export const customerMilestoneProgress = pgTable("customer_milestone_progress", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  milestoneId: integer("milestone_id").notNull().references(() => milestoneDefinitions.id),
  currentValue: numeric("current_value", { precision: 10, scale: 2 }).notNull().default('0'), // Current progress
  completedAt: timestamp("completed_at"), // When milestone was reached
  rewardGranted: boolean("reward_granted").default(false), // Whether reward was successfully applied
  rewardAuditId: integer("reward_audit_id"), // Link to reward_audit record
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  customerMilestoneIndex: index("milestone_progress_customer_milestone_idx").on(table.customerId, table.milestoneId),
  completedIndex: index("milestone_progress_completed_idx").on(table.completedAt),
}));

// ===== AUTOMATED SERVICE REMINDER SYSTEM (PHASE 4A) =====

// Reminder Rules - Configuration for different reminder types
export const reminderRules = pgTable("reminder_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Maintenance Detail Reminder", "3-Month Check-in"
  serviceId: integer("service_id").references(() => services.id), // Optional - null means applies to all services
  triggerType: varchar("trigger_type", { length: 30 }).notNull(), // time_since_last, recurring_schedule, manual
  triggerIntervalDays: integer("trigger_interval_days"), // Days after last service to send reminder
  reminderWindowDays: integer("reminder_window_days"), // How many days before due date to send
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  serviceIdIdx: index("reminder_rules_service_id_idx").on(table.serviceId),
  enabledIdx: index("reminder_rules_enabled_idx").on(table.enabled),
}));

// Reminder Jobs - Scheduled reminders to be sent
export const reminderJobs = pgTable("reminder_jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  ruleId: integer("rule_id").notNull().references(() => reminderRules.id),
  scheduledFor: timestamp("scheduled_for").notNull(), // When to send reminder
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, sent, failed, snoozed, cancelled
  messageContent: text("message_content"), // GPT-generated or template message
  lastAttemptAt: timestamp("last_attempt_at"), // When last send attempt occurred
  attemptsCount: integer("attempts_count").notNull().default(0),
  errorMessage: text("error_message"), // If failed
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"), // When successfully sent
}, (table) => ({
  customerIdx: index("reminder_jobs_customer_idx").on(table.customerId),
  ruleIdx: index("reminder_jobs_rule_idx").on(table.ruleId),
  statusScheduledIdx: index("reminder_jobs_status_scheduled_idx").on(table.status, table.scheduledFor), // For cron queries
}));

// Reminder Events - History of all reminder interactions
export const reminderEvents = pgTable("reminder_events", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => reminderJobs.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  eventType: varchar("event_type", { length: 20 }).notNull(), // sent, delivered, opened, clicked, booked, snoozed, opted_out, failed
  channel: varchar("channel", { length: 20 }).notNull(), // sms, email, push
  messageContent: text("message_content"), // The actual message sent
  metadata: jsonb("metadata"), // Additional data (e.g., booking link, snooze duration)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  jobIdIdx: index("reminder_events_job_id_idx").on(table.jobId),
  customerIdx: index("reminder_events_customer_idx").on(table.customerId),
  eventTypeIdx: index("reminder_events_event_type_idx").on(table.eventType),
}));

// Reminder Snoozes - Customer snooze preferences
export const reminderSnoozes = pgTable("reminder_snoozes", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => reminderJobs.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  snoozedUntil: timestamp("snoozed_until").notNull(), // When to resume reminders
  snoozeDuration: varchar("snooze_duration", { length: 20 }).notNull(), // 1_week, 2_weeks, 1_month, 3_months
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  jobIdIdx: index("reminder_snoozes_job_id_idx").on(table.jobId),
  customerIdx: index("reminder_snoozes_customer_idx").on(table.customerId),
  snoozedUntilIdx: index("reminder_snoozes_snoozed_until_idx").on(table.snoozedUntil),
}));

// Reminder Opt-outs - Customers who opted out of reminders
export const reminderOptOuts = pgTable("reminder_opt_outs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  optedOutAt: timestamp("opted_out_at").defaultNow(),
  reason: text("reason"), // Optional reason for opting out
  channel: varchar("channel", { length: 20 }), // Which channel they opted out from (null = all channels)
}, (table) => ({
  customerIdx: index("reminder_opt_outs_customer_idx").on(table.customerId),
  channelIdx: index("reminder_opt_outs_channel_idx").on(table.channel),
}));

// Reminder Consent - Track TCPA consent for reminder communications
export const reminderConsent = pgTable("reminder_consent", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  consentType: varchar("consent_type", { length: 20 }).notNull(), // sms, email, push, all
  consentGiven: boolean("consent_given").notNull().default(true),
  consentedAt: timestamp("consented_at").defaultNow(),
  consentSource: text("consent_source"), // Where consent was obtained (e.g., "booking_form", "website_signup")
  revokedAt: timestamp("revoked_at"), // When consent was revoked (null if active)
}, (table) => ({
  customerConsentIdx: index("reminder_consent_customer_consent_idx").on(table.customerId, table.consentType),
  consentGivenIdx: index("reminder_consent_given_idx").on(table.consentGiven),
}));

// Create schemas for data insertion
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCustomerSchema = createInsertSchema(customers).pick({
  name: true,
  email: true,
  phone: true,
  address: true,
  vehicleInfo: true,
  notes: true,
  loyaltyProgramOptIn: true,
  profilePictureUrl: true,
  customerNotes: true,
  notifyViaEmail: true,
  notifyViaSms: true,
  notifyViaPush: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  customerId: true,
  serviceId: true,
  scheduledTime: true,
  address: true,
  additionalRequests: true,
  addOns: true,
});

export const insertRecurringServiceSchema = createInsertSchema(recurringServices).pick({
  customerId: true,
  serviceId: true,
  frequency: true,
  intervalType: true,
  nextScheduledDate: true,
  intervalCustomDates: true,
  autoRenew: true,
  status: true,
  preferredTime: true,
  preferredDayOfWeek: true,
  preferredDayOfMonth: true,
  deferredUntil: true,
  bookingToken: true,
  tokenExpiresAt: true,
  notes: true,
}).partial({
  nextScheduledDate: true,
  intervalType: true,
  intervalCustomDates: true,
  deferredUntil: true,
  bookingToken: true,
  tokenExpiresAt: true,
  status: true,
});

export const insertQuoteRequestSchema = createInsertSchema(quoteRequests).pick({
  phone: true,
  customerName: true,
  issueDescription: true,
  damageType: true,
  photoUrls: true,
  thirdPartyPayerName: true,
  thirdPartyPayerEmail: true,
  thirdPartyPayerPhone: true,
  poNumber: true,
}).extend({
  customerId: z.number().optional(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).pick({
  appointmentId: true,
  customerId: true,
  amount: true,
  serviceDescription: true,
  notes: true,
  technicianId: true,
});

export const insertTechnicianDepositSchema = createInsertSchema(technicianDeposits).omit({
  id: true,
  createdAt: true,
});

export const insertLoyaltyPointsSchema = createInsertSchema(loyaltyPoints).pick({
  customerId: true,
  points: true,
  expiryDate: true,
});

export const insertRewardServiceSchema = createInsertSchema(rewardServices).pick({
  name: true,
  description: true,
  pointCost: true,
  tier: true,
  active: true,
  // Schema name remains for API compatibility, but represents "Loyalty Offer" in UI
});

export const insertRedeemedRewardSchema = createInsertSchema(redeemedRewards).pick({
  customerId: true,
  rewardServiceId: true,
  pointsSpent: true,
  status: true,
  expiryDate: true,
  // Schema name remains for API compatibility, but represents "Redeemed Loyalty Offer" in UI
});

export const insertPointsTransactionSchema = createInsertSchema(pointsTransactions).pick({
  loyaltyPointsId: true,
  amount: true,
  description: true,
  transactionType: true,
  source: true,
  sourceId: true,
  expiryDate: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  signedUpAt: true,
  completedAt: true,
  rewardedAt: true,
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type SelectReferral = typeof referrals.$inferSelect;

// Referral Program Config schemas and types
export const insertReferralProgramConfigSchema = createInsertSchema(referralProgramConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertReferralProgramConfig = z.infer<typeof insertReferralProgramConfigSchema>;
export type SelectReferralProgramConfig = typeof referralProgramConfig.$inferSelect;

// Reward Audit schemas and types
export const insertRewardAuditSchema = createInsertSchema(rewardAudit).omit({
  id: true,
  createdAt: true,
  appliedAt: true,
});

export type InsertRewardAudit = z.infer<typeof insertRewardAuditSchema>;
export type SelectRewardAudit = typeof rewardAudit.$inferSelect;

// QR Code Actions schemas and types
export const insertQrCodeActionSchema = createInsertSchema(qrCodeActions).omit({
  id: true,
  scans: true,
  lastScannedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQrCodeAction = z.infer<typeof insertQrCodeActionSchema>;
export type SelectQrCodeAction = typeof qrCodeActions.$inferSelect;

// TypeScript type definitions for reward descriptors
export type RewardType = 
  | 'loyalty_points' 
  | 'fixed_discount' 
  | 'percent_discount' 
  | 'service_credit' 
  | 'free_addon' 
  | 'tier_upgrade' 
  | 'priority_booking' 
  | 'milestone_reward' 
  | 'gift_card';

export type RewardDescriptor = {
  type: RewardType;
  amount: number; // Points, dollars, percent, or credit amount
  serviceId?: number; // For free_addon type - which service to give
  expiryDays?: number; // How many days until reward expires (null = never)
  notes?: string; // Display text for the reward
  maxUses?: number; // How many times this reward can be used (usually 1)
  stackable?: boolean; // Can this be combined with other rewards?
};

export type MilestoneConfig = {
  threshold: number; // Number of referrals needed
  rewardType: RewardType;
  amount: number;
  notes: string;
};

export const insertUpsellOfferSchema = createInsertSchema(upsellOffers).pick({
  name: true,
  description: true,
  serviceId: true,
  addOnService: true,
  discountPercentage: true,
  discountAmount: true,
  active: true,
  displayOrder: true,
  minimumPurchaseAmount: true,
  applicableServiceIds: true,
  validityDays: true,
});

export const insertAppointmentUpsellSchema = createInsertSchema(appointmentUpsells).pick({
  appointmentId: true,
  upsellOfferId: true,
  status: true,
  expiryDate: true,
  discountApplied: true,
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).pick({
  name: true,
  subject: true,
  content: true,
  scheduledDate: true,
  status: true,
  targetAudience: true,
  recipientCount: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).pick({
  name: true,
  subject: true,
  content: true,
  category: true,
});

export const insertEmailSubscriberSchema = createInsertSchema(emailSubscribers).pick({
  email: true,
  subscribed: true,
});

export const insertQuickReplyCategorySchema = createInsertSchema(quickReplyCategories).pick({
  name: true,
  icon: true,
  displayOrder: true,
});

export const insertQuickReplyTemplateSchema = createInsertSchema(quickReplyTemplates).pick({
  categoryId: true,
  content: true,
  displayOrder: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  customerId: true,
  customerPhone: true,
  customerName: true,
  platform: true,
  category: true,
  intent: true,
  controlMode: true,
  assignedAgent: true,
  behaviorSettings: true,
  status: true,
  handoffReason: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  content: true,
  sender: true,
  fromCustomer: true,
  channel: true,
  topics: true,
});

export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({
  id: true,
  createdAt: true,
});

export const insertMessageEditHistorySchema = createInsertSchema(messageEditHistory).omit({
  id: true,
  editedAt: true,
});

export const insertScheduledMessageSchema = createInsertSchema(scheduledMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export const insertHumanEscalationRequestSchema = createInsertSchema(humanEscalationRequests).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).pick({
  settingKey: true,
  enabled: true,
  config: true,
  updatedBy: true,
});

export const insertGalleryPhotoSchema = createInsertSchema(galleryPhotos).pick({
  imageUrl: true,
  title: true,
  description: true,
  displayOrder: true,
  isActive: true,
  uploadedBy: true,
  tenantId: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  serviceName: true,
  description: true,
  monthlyCost: true,
  billingCycle: true,
  status: true,
  renewalDate: true,
  website: true,
  notes: true,
  isActive: true,
  updatedBy: true,
});

export const insertCancellationFeedbackSchema = createInsertSchema(cancellationFeedback).pick({
  appointmentId: true,
  customerId: true,
  customerName: true,
  serviceName: true,
  appointmentDate: true,
  reason: true,
  category: true,
  additionalComments: true,
  wouldReschedule: true,
  wantsFullCancellation: true,
  wantsFollowUp: true,
  followUpDate: true,
  followUpNotes: true,
  suggestedResponse: true,
  responseStatus: true,
});

export const insertFollowUpReminderSchema = createInsertSchema(followUpReminders).pick({
  customerId: true,
  cancellationId: true,
  reminderDate: true,
  reminderType: true,
  message: true,
  status: true,
  notes: true,
});

export const insertSmsDeliveryStatusSchema = createInsertSchema(smsDeliveryStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFacebookPageTokenSchema = createInsertSchema(facebookPageTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerTagSchema = createInsertSchema(customerTags).omit({
  id: true,
  createdAt: true,
});

export const insertConversationTagSchema = createInsertSchema(conversationTags).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for technician bio profiles and employee management
export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileReviewedAt: true,
  profileReviewedBy: true,
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertOrgSettingSchema = createInsertSchema(orgSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertShiftTemplateSchema = createInsertSchema(shiftTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const insertPtoRequestSchema = createInsertSchema(ptoRequests).omit({
  id: true,
  requestedAt: true,
  reviewedAt: true,
});

export const insertShiftTradeSchema = createInsertSchema(shiftTrades).omit({
  id: true,
  requestedAt: true,
  acceptedAt: true,
  reviewedAt: true,
});

export const insertTechnicianAvailabilitySchema = createInsertSchema(technicianAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicantSchema = createInsertSchema(applicants).omit({
  id: true,
  appliedAt: true,
  createdAt: true,
  statusUpdatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  timestamp: true,
});

// Insert schemas for third-party billing system
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  verifiedAt: true,
  smsOptOutAt: true,
});

export const insertAuthorizationSchema = createInsertSchema(authorizations).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  declinedAt: true,
});

export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).omit({
  id: true,
  createdAt: true,
  paidAt: true,
  sentAt: true,
  lastReminderSent: true,
});

export const insertGiftCardSchema = createInsertSchema(giftCards).omit({
  id: true,
  createdAt: true,
  issuedAt: true,
  redeemedAt: true,
  lastUsedAt: true,
});

export const insertCreditLedgerSchema = createInsertSchema(creditLedger).omit({
  id: true,
  createdAt: true,
  issuedAt: true,
  usedAt: true,
  lastUsedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

// Dashboard layout schemas
export const insertDashboardLayoutSchema = createInsertSchema(dashboardLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const dashboardWidgetSchema = z.object({
  id: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number(), height: z.number() }),
  visible: z.boolean(),
  order: z.number(),
});

export const dashboardLayoutPayloadSchema = z.object({
  widgets: z.array(dashboardWidgetSchema),
});

// Define types for use in the application
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type InsertDashboardLayout = z.infer<typeof insertDashboardLayoutSchema>;
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;
export type DashboardLayoutPayload = z.infer<typeof dashboardLayoutPayloadSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertRecurringService = z.infer<typeof insertRecurringServiceSchema>;
export type InsertQuoteRequest = z.infer<typeof insertQuoteRequestSchema>;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InsertTechnicianDeposit = z.infer<typeof insertTechnicianDepositSchema>;
export type TechnicianDeposit = typeof technicianDeposits.$inferSelect;
export type InsertLoyaltyPoints = z.infer<typeof insertLoyaltyPointsSchema>;
export type InsertRewardService = z.infer<typeof insertRewardServiceSchema>;
export type InsertRedeemedReward = z.infer<typeof insertRedeemedRewardSchema>;
export type InsertPointsTransaction = z.infer<typeof insertPointsTransactionSchema>;
export type InsertUpsellOffer = z.infer<typeof insertUpsellOfferSchema>;
export type InsertAppointmentUpsell = z.infer<typeof insertAppointmentUpsellSchema>;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;
export type InsertQuickReplyCategory = z.infer<typeof insertQuickReplyCategorySchema>;
export type InsertQuickReplyTemplate = z.infer<typeof insertQuickReplyTemplateSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type InsertMessageEditHistory = z.infer<typeof insertMessageEditHistorySchema>;
export type InsertScheduledMessage = z.infer<typeof insertScheduledMessageSchema>;
export type InsertHumanEscalationRequest = z.infer<typeof insertHumanEscalationRequestSchema>;
export type HumanEscalationRequest = typeof humanEscalationRequests.$inferSelect;
export type InsertCancellationFeedback = z.infer<typeof insertCancellationFeedbackSchema>;
export type InsertFollowUpReminder = z.infer<typeof insertFollowUpReminderSchema>;

export const insertBusinessSettingsSchema = createInsertSchema(businessSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettings.$inferSelect;

export const insertAgentPreferencesSchema = createInsertSchema(agentPreferences).omit({
  id: true,
  updatedAt: true,
}).extend({
  professionalismLevel: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  friendliness: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  detailOrientation: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  humorLevel: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  enthusiasm: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  formality: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  technicalTerms: z.number().int().min(1).max(5, "Must be between 1 and 5"),
  messageLength: z.number().int().min(1).max(5, "Must be between 1 and 5"),
});

export type InsertAgentPreferences = z.infer<typeof insertAgentPreferencesSchema>;
export type AgentPreferences = typeof agentPreferences.$inferSelect;

export const insertHomepageContentSchema = createInsertSchema(homepageContent).omit({
  id: true,
  updatedAt: true,
});

export type InsertHomepageContent = z.infer<typeof insertHomepageContentSchema>;
export type HomepageContent = typeof homepageContent.$inferSelect;

export const insertJobPostingSchema = createInsertSchema(jobPostings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({ 
  id: true, 
  submittedAt: true 
});

export type JobPosting = typeof jobPostings.$inferSelect;
export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

export const insertServiceLimitSchema = createInsertSchema(serviceLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dailyLimit: z.number().positive("Daily limit must be greater than 0"),
});

export type InsertServiceLimit = z.infer<typeof insertServiceLimitSchema>;
export type ServiceLimit = typeof serviceLimits.$inferSelect;

export const insertBannerSchema = createInsertSchema(banners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  ctaUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  trackingKey: z.string().min(3, "Tracking key must be at least 3 characters"),
});

export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

export const insertBannerMetricSchema = createInsertSchema(bannerMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertBannerMetric = z.infer<typeof insertBannerMetricSchema>;
export type BannerMetric = typeof bannerMetrics.$inferSelect;

export const insertPhoneLineSchema = createInsertSchema(phoneLines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPhoneLine = z.infer<typeof insertPhoneLineSchema>;
export type PhoneLine = typeof phoneLines.$inferSelect;

export const insertPhoneScheduleSchema = createInsertSchema(phoneSchedules).omit({
  id: true,
  createdAt: true,
});

export type InsertPhoneSchedule = z.infer<typeof insertPhoneScheduleSchema>;
export type PhoneSchedule = typeof phoneSchedules.$inferSelect;

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type RecurringService = typeof recurringServices.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type MessageEditHistory = typeof messageEditHistory.$inferSelect;
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type LoyaltyPoints = typeof loyaltyPoints.$inferSelect;
export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type CustomerAchievement = typeof customerAchievements.$inferSelect;
export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type RewardService = typeof rewardServices.$inferSelect;
export type RedeemedReward = typeof redeemedRewards.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type UpsellOffer = typeof upsellOffers.$inferSelect;
export type AppointmentUpsell = typeof appointmentUpsells.$inferSelect;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type QuickReplyCategory = typeof quickReplyCategories.$inferSelect;
export type QuickReplyTemplate = typeof quickReplyTemplates.$inferSelect;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({ id: true, createdAt: true, updatedAt: true, version: true });
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export const insertSmsTemplateVersionSchema = createInsertSchema(smsTemplateVersions).omit({ id: true, createdAt: true });
export type SmsTemplateVersion = typeof smsTemplateVersions.$inferSelect;
export type InsertSmsTemplateVersion = z.infer<typeof insertSmsTemplateVersionSchema>;
export const insertAiBehaviorRuleSchema = createInsertSchema(aiBehaviorRules).omit({ id: true, createdAt: true, updatedAt: true });
export type AiBehaviorRule = typeof aiBehaviorRules.$inferSelect;
export type InsertAiBehaviorRule = z.infer<typeof insertAiBehaviorRuleSchema>;
export const insertFaqEntrySchema = createInsertSchema(faqEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type FaqEntry = typeof faqEntries.$inferSelect;
export type InsertFaqEntry = z.infer<typeof insertFaqEntrySchema>;
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true, lastUsedAt: true });
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, updatedAt: true });
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export const insertCriticalMonitoringSettingsSchema = createInsertSchema(criticalMonitoringSettings).omit({ id: true, updatedAt: true });
export type CriticalMonitoringSettings = typeof criticalMonitoringSettings.$inferSelect;
export type InsertCriticalMonitoringSettings = z.infer<typeof insertCriticalMonitoringSettingsSchema>;
export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
export type InsertGalleryPhoto = z.infer<typeof insertGalleryPhotoSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type CancellationFeedback = typeof cancellationFeedback.$inferSelect;
export type FollowUpReminder = typeof followUpReminders.$inferSelect;
export type SmsDeliveryStatus = typeof smsDeliveryStatus.$inferSelect;
export type InsertSmsDeliveryStatus = z.infer<typeof insertSmsDeliveryStatusSchema>;
export type FacebookPageToken = typeof facebookPageTokens.$inferSelect;
export type InsertFacebookPageToken = z.infer<typeof insertFacebookPageTokenSchema>;
export type CustomerTag = typeof customerTags.$inferSelect;
export type InsertCustomerTag = z.infer<typeof insertCustomerTagSchema>;
export type ConversationTag = typeof conversationTags.$inferSelect;
export type InsertConversationTag = z.infer<typeof insertConversationTagSchema>;

// Types for technician bio profiles and employee management
export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type OrgSetting = typeof orgSettings.$inferSelect;
export type InsertOrgSetting = z.infer<typeof insertOrgSettingSchema>;
export type ShiftTemplate = typeof shiftTemplates.$inferSelect;
export type InsertShiftTemplate = z.infer<typeof insertShiftTemplateSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type PtoRequest = typeof ptoRequests.$inferSelect;
export type InsertPtoRequest = z.infer<typeof insertPtoRequestSchema>;
export type ShiftTrade = typeof shiftTrades.$inferSelect;
export type InsertShiftTrade = z.infer<typeof insertShiftTradeSchema>;
export type TechnicianAvailability = typeof technicianAvailability.$inferSelect;
export type InsertTechnicianAvailability = z.infer<typeof insertTechnicianAvailabilitySchema>;
export type Applicant = typeof applicants.$inferSelect;
export type InsertApplicant = z.infer<typeof insertApplicantSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Types for third-party billing system
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Authorization = typeof authorizations.$inferSelect;
export type InsertAuthorization = z.infer<typeof insertAuthorizationSchema>;
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type GiftCard = typeof giftCards.$inferSelect;
export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;
export type CreditLedger = typeof creditLedger.$inferSelect;
export type InsertCreditLedger = z.infer<typeof insertCreditLedgerSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

// Types for Customer Intelligence (Phase 1)
export const insertCustomerVehicleSchema = createInsertSchema(customerVehicles).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCustomerVehicle = z.infer<typeof insertCustomerVehicleSchema>;
export type CustomerVehicle = typeof customerVehicles.$inferSelect;

export const insertCustomerServiceHistorySchema = createInsertSchema(customerServiceHistory).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertCustomerServiceHistory = z.infer<typeof insertCustomerServiceHistorySchema>;
export type CustomerServiceHistory = typeof customerServiceHistory.$inferSelect;

// Insert schemas and types for Automated Service Reminder System (Phase 4A)
export const insertReminderRuleSchema = createInsertSchema(reminderRules).omit({
  id: true,
  createdAt: true,
});
export type InsertReminderRule = z.infer<typeof insertReminderRuleSchema>;
export type ReminderRule = typeof reminderRules.$inferSelect;

export const insertReminderJobSchema = createInsertSchema(reminderJobs).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  lastAttemptAt: true,
});
export type InsertReminderJob = z.infer<typeof insertReminderJobSchema>;
export type ReminderJob = typeof reminderJobs.$inferSelect;

export const insertReminderEventSchema = createInsertSchema(reminderEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertReminderEvent = z.infer<typeof insertReminderEventSchema>;
export type ReminderEvent = typeof reminderEvents.$inferSelect;

export const insertReminderSnoozeSchema = createInsertSchema(reminderSnoozes).omit({
  id: true,
  createdAt: true,
});
export type InsertReminderSnooze = z.infer<typeof insertReminderSnoozeSchema>;
export type ReminderSnooze = typeof reminderSnoozes.$inferSelect;

export const insertReminderOptOutSchema = createInsertSchema(reminderOptOuts).omit({
  id: true,
  optedOutAt: true,
});
export type InsertReminderOptOut = z.infer<typeof insertReminderOptOutSchema>;
export type ReminderOptOut = typeof reminderOptOuts.$inferSelect;

export const insertReminderConsentSchema = createInsertSchema(reminderConsent).omit({
  id: true,
  consentedAt: true,
  revokedAt: true,
});
export type InsertReminderConsent = z.infer<typeof insertReminderConsentSchema>;
export type ReminderConsent = typeof reminderConsent.$inferSelect;

// ===== API USAGE TRACKING SYSTEM =====

// API Usage Logs - Track individual API calls with costs
export const apiUsageLogs = pgTable('api_usage_logs', {
  id: serial('id').primaryKey(),
  service: varchar('service', { length: 50 }).notNull(), // 'twilio', 'openai', 'stripe', 'sendgrid', 'google_calendar', etc.
  apiType: varchar('api_type', { length: 100 }), // 'sms', 'voice', 'email', 'tokens', 'payment', etc.
  quantity: integer('quantity').notNull(), // count of API calls, tokens, emails, etc.
  cost: numeric('cost', { precision: 10, scale: 4 }).notNull(), // actual cost in USD
  metadata: jsonb('metadata'), // additional details (model used, message length, etc.)
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  serviceIdx: index('api_usage_logs_service_idx').on(table.service),
  timestampIdx: index('api_usage_logs_timestamp_idx').on(table.timestamp),
}));

// Service Health - Monitor health status of external services
export const serviceHealth = pgTable('service_health', {
  id: serial('id').primaryKey(),
  service: varchar('service', { length: 50 }).notNull().unique(), // service identifier
  status: varchar('status', { length: 20 }).notNull(), // 'healthy', 'degraded', 'down'
  lastCheck: timestamp('last_check').notNull(),
  lastSuccess: timestamp('last_success'),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  responseTime: integer('response_time'), // in milliseconds
  apiKeyExpiry: timestamp('api_key_expiry'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Usage Summary - Aggregated usage summaries
export const usageSummary = pgTable('usage_summary', {
  id: serial('id').primaryKey(),
  service: varchar('service', { length: 50 }).notNull(),
  period: varchar('period', { length: 20 }).notNull(), // 'daily', 'monthly', 'yearly'
  periodStart: date('period_start').notNull(),
  totalCalls: integer('total_calls').notNull().default(0),
  totalCost: numeric('total_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// SUGGESTIONS / FEEDBACK TABLE
// ============================================================
export const suggestions = pgTable('suggestions', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id'),
  customerId: integer('customer_id'),
  source: text('source').notNull(),
  context: text('context'),
  message: text('message').notNull(),
  name: text('name'),
  contact: text('contact'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  handled: boolean('handled').default(false).notNull(),
  handledBy: text('handled_by'),
  handledAt: timestamp('handled_at'),
  notes: text('notes'),
}, (table) => ({
  tenantIdIdx: index('suggestions_tenant_id_idx').on(table.tenantId),
  sourceIdx: index('suggestions_source_idx').on(table.source),
  handledIdx: index('suggestions_handled_idx').on(table.handled),
}));

// Zod schemas for API usage tracking
export const insertApiUsageLogSchema = createInsertSchema(apiUsageLogs).omit({ id: true, createdAt: true });
export const insertServiceHealthSchema = createInsertSchema(serviceHealth).omit({ id: true, updatedAt: true });
export const insertUsageSummarySchema = createInsertSchema(usageSummary).omit({ id: true, createdAt: true, updatedAt: true });

// Types for API usage tracking
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;
export type ServiceHealth = typeof serviceHealth.$inferSelect;
export type InsertServiceHealth = z.infer<typeof insertServiceHealthSchema>;

// ============================================================
// GOOGLE SHEETS SERVICE SCHEMAS
// ============================================================
// These types represent the data structure returned from Google Sheets
// (not the database), used by the public-facing services API

export const publicSheetServiceSchema = z.object({
  name: z.string(),
  priceRange: z.string(),
  overview: z.string(),
  detailedDescription: z.string(),
  duration: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const publicSheetAddonSchema = z.object({
  name: z.string(),
  priceRange: z.string(),
  overview: z.string(),
  detailedDescription: z.string(),
  imageUrl: z.string().optional(),
});

export const publicSheetServicesResponseSchema = z.object({
  success: z.boolean(),
  services: z.array(publicSheetServiceSchema),
});

export const publicSheetAddonsResponseSchema = z.object({
  success: z.boolean(),
  addOns: z.array(publicSheetAddonSchema),
});

export type PublicSheetService = z.infer<typeof publicSheetServiceSchema>;
export type PublicSheetAddon = z.infer<typeof publicSheetAddonSchema>;
export type PublicSheetServicesResponse = z.infer<typeof publicSheetServicesResponseSchema>;
export type PublicSheetAddonsResponse = z.infer<typeof publicSheetAddonsResponseSchema>;
export type UsageSummary = typeof usageSummary.$inferSelect;
export type InsertUsageSummary = z.infer<typeof insertUsageSummarySchema>;

// ============================================================
// PLATFORM SETTINGS SCHEMAS
// ============================================================
export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({ id: true, updatedAt: true });
export const updatePlatformSettingsSchema = z.object({
  demoModeEnabled: z.boolean(),
});

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;
export type UpdatePlatformSettings = z.infer<typeof updatePlatformSettingsSchema>;

// ============================================================
// SUGGESTIONS SCHEMAS
// ============================================================
export const insertSuggestionSchema = createInsertSchema(suggestions).omit({ id: true, createdAt: true });
export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;

// ============================================================
// PHASE 15 - CUSTOMER IDENTITY & OTP SCHEMAS
// ============================================================
export const insertCustomerIdentitySchema = createInsertSchema(customerIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerOtpSchema = createInsertSchema(customerOtps).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSessionSchema = createInsertSchema(customerSessions).omit({
  id: true,
  createdAt: true,
});

export type CustomerIdentity = typeof customerIdentities.$inferSelect;
export type InsertCustomerIdentity = z.infer<typeof insertCustomerIdentitySchema>;
export type CustomerOtp = typeof customerOtps.$inferSelect;
export type InsertCustomerOtp = z.infer<typeof insertCustomerOtpSchema>;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type InsertCustomerSession = z.infer<typeof insertCustomerSessionSchema>;

// ============================================================
// TENANT SCHEMAS
// ============================================================
export const insertTenantSchema = createInsertSchema(tenants).omit({ createdAt: true, updatedAt: true });
export const insertTenantConfigSchema = createInsertSchema(tenantConfig).omit({ createdAt: true, updatedAt: true });
export const insertTenantPhoneConfigSchema = createInsertSchema(tenantPhoneConfig).omit({ createdAt: true });
export const insertTenantEmailProfileSchema = createInsertSchema(tenantEmailProfiles).omit({ id: true, createdAt: true, updatedAt: true });

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantConfig = typeof tenantConfig.$inferSelect;
export type InsertTenantConfig = z.infer<typeof insertTenantConfigSchema>;
export type TenantPhoneConfig = typeof tenantPhoneConfig.$inferSelect;
export type InsertTenantPhoneConfig = z.infer<typeof insertTenantPhoneConfigSchema>;
export type TenantEmailProfile = typeof tenantEmailProfiles.$inferSelect;
export type InsertTenantEmailProfile = z.infer<typeof insertTenantEmailProfileSchema>;

// ============================================================
// PROMO CODES & BILLING OVERRIDES
// ============================================================

// Promo override type enum
export const promoOverrideTypeEnum = pgEnum("promo_override_type", [
  "friends_and_family",
  "partner",
  "internal_test",
  "beta_user",
]);

// Promo codes table - global to ServicePro platform (not tenant-scoped)
export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  appliesToPlan: varchar("applies_to_plan", { length: 50 }),
  subscriptionDiscountPercent: integer("subscription_discount_percent").default(0).notNull(),
  usageRateMultiplier: numeric("usage_rate_multiplier", { precision: 5, scale: 2 }),
  trialExtensionDays: integer("trial_extension_days").default(0).notNull(),
  setOverrideType: promoOverrideTypeEnum("set_override_type"),
  isReusable: boolean("is_reusable").default(false).notNull(),
  maxRedemptions: integer("max_redemptions"),
  perTenantLimit: integer("per_tenant_limit").default(1).notNull(),
  lockedToEmail: varchar("locked_to_email", { length: 255 }),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  createdByAdminId: integer("created_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("promo_codes_code_idx").on(table.code),
  activeIdx: index("promo_codes_active_idx").on(table.isActive),
}));

// Promo redemptions table - tracks when promo codes are used
export const promoRedemptions = pgTable("promo_redemptions", {
  id: serial("id").primaryKey(),
  promoCodeId: integer("promo_code_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  redeemedByEmail: varchar("redeemed_by_email", { length: 255 }),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  context: jsonb("context").$type<{
    source?: string;
    path?: string;
    userAgent?: string;
    ipAddress?: string;
  }>(),
}, (table) => ({
  promoCodeIdIdx: index("promo_redemptions_promo_code_id_idx").on(table.promoCodeId),
  tenantIdIdx: index("promo_redemptions_tenant_id_idx").on(table.tenantId),
}));

// Tenant billing overrides - per-tenant billing adjustments
export const tenantBillingOverrides = pgTable("tenant_billing_overrides", {
  tenantId: varchar("tenant_id", { length: 50 }).primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  overrideType: promoOverrideTypeEnum("override_type"),
  subscriptionDiscountPercent: integer("subscription_discount_percent").default(0).notNull(),
  usageRateMultiplier: numeric("usage_rate_multiplier", { precision: 5, scale: 2 }),
  skipAutomaticCharges: boolean("skip_automatic_charges").default(false).notNull(),
  notes: text("notes"),
  appliedPromoCodeId: integer("applied_promo_code_id").references(() => promoCodes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas for promo codes
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromoRedemptionSchema = createInsertSchema(promoRedemptions).omit({ id: true, redeemedAt: true });
export const insertTenantBillingOverrideSchema = createInsertSchema(tenantBillingOverrides).omit({ createdAt: true, updatedAt: true });

// Types for promo codes
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoRedemption = typeof promoRedemptions.$inferSelect;
export type InsertPromoRedemption = z.infer<typeof insertPromoRedemptionSchema>;
export type TenantBillingOverride = typeof tenantBillingOverrides.$inferSelect;
export type InsertTenantBillingOverride = z.infer<typeof insertTenantBillingOverrideSchema>;

// ============================================================
// PHASE 16.5 - PORTAL WELCOME CONFIG TYPES
// ============================================================
export interface WelcomeTier {
  points: number;
  label: string;
  description?: string;
}

export interface WelcomeOffer {
  points: number;
  label: string;
  finePrint: string;
}

export interface WelcomeCTAs {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  giftCard?: { label: string; href: string };
  learnMore?: { label: string; href: string };
}

export interface TrustSection {
  heading: string;
  bullets: string[];
}

export interface PortalWelcomeConfig {
  heading: string;
  subheading: string;
  badge?: string;
  bullets: string[];
  tiers: WelcomeTier[];
  welcomeOffer: WelcomeOffer;
  ctas: WelcomeCTAs;
  trust: TrustSection;
}