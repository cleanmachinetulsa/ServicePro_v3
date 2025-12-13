# ServicePro Platform - Master Build Plan

## Mission-Critical Philosophy

**This is not a prototype. This is not a "might become a product." This IS the product.**

ServicePro is a production SaaS platform actively being marketed and sold to service businesses. Our tenants pay $100-$500+ per month and entrust us with their **entire business operations**. When a detailer, cleaner, or HVAC technician relies on ServicePro, they're trusting us with:

- Their customer relationships
- Their appointment scheduling
- Their revenue through bookings
- Their reputation via automated communications
- Their livelihood

**If ServicePro goes down, every single tenant's business goes down with it.**

This isn't hyperbole—it's the operational reality. A barber using ServicePro who can't receive booking texts loses customers. A detailer whose automated reminders stop sending loses appointments. A cleaning service whose payment links break loses revenue.

We carry the weight of our tenants' businesses on our shoulders. Every line of code we write must reflect this responsibility. There are no "good enough" implementations. There are no "we'll fix it later" shortcuts. There is only production-grade, battle-tested, enterprise-quality code that works flawlessly under load, fails gracefully when issues arise, and recovers automatically whenever possible.

### The Trust Equation

```
Tenant Trust = Uptime × Reliability × Data Integrity × Communication Quality
```

If any factor drops to zero, trust drops to zero. We must maintain excellence across all dimensions.

---

## ServicePro-Grade Quality Standards

"ServicePro-grade" is our internal bar for what production code must achieve. It means:

### 1. Multi-Tenant Isolation (Non-Negotiable)
- Every database query uses `tenantDb` wrapper—no exceptions
- Cross-tenant data leakage is a critical security incident
- Tenant context verified at every API boundary
- Background jobs always include tenant scoping

### 2. Transactional Safety
- Database operations that must succeed together use transactions
- Partial failures leave system in known, recoverable state
- Drizzle migrations tested in staging before production
- Schema changes never lose data

### 3. Resilient External Integrations
- Twilio failures don't crash the system—they log and retry
- Google Calendar API outages degrade gracefully
- Square/Stripe webhook failures queue for reprocessing
- All external calls have timeouts and circuit breakers

### 4. Guarded Background Workers
- Scheduled jobs are idempotent (safe to run twice)
- Worker crashes don't lose queued work
- Job status is visible and auditable
- Failed jobs have clear error context for debugging

### 5. Progressive Delivery
- Features ship behind feature flags when appropriate
- Rollback path exists for every deployment
- Canary testing for high-risk changes
- Zero-downtime deployments

### 6. SOC2-Minded Logging
- Security events are always logged
- Audit trails for sensitive operations
- PII handled according to data retention policies
- Logs don't expose secrets or tokens

---

## Six-Phase Roadmap

### Phase 0: Quick Hardening (8-12 hours | ~$8-12)
**Goal:** Improve tenant branding and ensure users always see latest version

| Feature | Hours | Dependencies | Integration Points |
|---------|-------|--------------|-------------------|
| Tenant-Branded OG Previews | 3-4 | None | `share_links` table, public routes, tenant branding fields |
| Cache + PWA Update Strategy | 4-5 | None | Service worker, app version constant, HTML cache headers |

**Codebase Integration:**
- New `share_links` table in `shared/schema.ts`
- New `shareLinkService.ts` in `server/services/`
- Public route `/l/:token` for shortlink resolution
- Client-side version checking in `App.tsx`

**Acceptance Criteria:**
- SMS link previews show tenant branding (logo, business name)
- PWA users see "New version available" banner after deployments
- No more "stuck on old version" complaints

---

### Phase 1: Messaging Compliance (18-24 hours | ~$18-24)
**Goal:** Full TCPA/CTIA compliance and safe campaign reward distribution

| Feature | Hours | Dependencies | Integration Points |
|---------|-------|--------------|-------------------|
| Campaign Manager V2 | 10-14 | Phase 0 complete | `scheduled_campaign_runs` table, quiet hours utility, SMS opt-out handling |
| Safe Campaign Rewards System | 6-8 | Existing loyalty system | Generic `awardSafeRewardOnce()`, normalize endpoints |

**Codebase Integration:**
- Extend `customers` table with `sms_opt_in`, `sms_opt_out_at`, `phone_status`
- New `scheduled_campaign_runs` table for campaign scheduling
- New `server/utils/quietHours.ts` for Oklahoma 8pm-8am enforcement
- Refactor `portRecoveryService.ts` to use campaign manager
- Update Twilio inbound webhook for STOP/START keyword handling
- New admin UI at `/admin/campaigns`

**Compliance Requirements:**
- 21610 errors automatically mark numbers as unsubscribed
- STOP keywords handled without custom reply (Twilio handles)
- START keywords re-subscribe with confirmation
- Quiet hours block all campaign sends 8pm-8am Central
- Campaign rewards are idempotent (one award per customer per campaign)

**Acceptance Criteria:**
- Campaigns respect quiet hours automatically
- STOP/START work correctly per TCPA
- Duplicate rewards impossible
- Admin can schedule campaigns for future send times

---

### Phase 2: Telephony Experience (15-20 hours | ~$15-20)
**Goal:** Easy phone setup for any tenant without Twilio expertise

| Feature | Hours | Dependencies | Integration Points |
|---------|-------|--------------|-------------------|
| Phone Setup Wizard | 8-10 | None | `tenant_telephony_settings` table, Twilio dial helpers |
| SIP/Softphone Helper + Support Integration | 6-8 | Phone Setup Wizard | Help content module, support_issues pipeline |

**Codebase Integration:**
- New `tenant_telephony_settings` table or extend existing settings
- New `server/routes.settings.telephony.ts` for API endpoints
- Update Twilio voice handlers to read from tenant settings
- New `client/src/pages/settings/TelephonySetupPage.tsx`
- Help content in `client/src/content/help/telephonyHelp.ts`
- Integration with `support_issues` table for failed test calls

**Telephony Modes:**
1. `forward` - Forward to personal phone (default, recommended)
2. `forward_with_whisper` - Forward with "business call" announcement
3. `sip_softphone` - Dial SIP endpoint for advanced users

**Acceptance Criteria:**
- Tenant can set up call forwarding in under 2 minutes
- Test call validates setup and shows pass/fail
- Failed tests auto-create support issues
- Support assistant can guide telephony troubleshooting

---

### Phase 3: Scheduling & Growth (18-24 hours | ~$18-24)
**Goal:** Smarter booking flows and easy tenant onboarding for friends/family

| Feature | Hours | Dependencies | Integration Points |
|---------|-------|--------------|-------------------|
| Smart Availability L2 | 8-10 | Existing booking system | `booking_initiation_events` table, multi-slot URLs |
| Friends & Family Invite Codes | 5-7 | Billing system | `tenant_invite_codes` table, onboarding wizard |

**Codebase Integration:**
- New `booking_initiation_events` table for analytics
- Extend slot model with `bookUrl` per slot + `viewAllUrl`
- Booking page handles `focusDate` query param
- New `tenant_invite_codes` table
- Onboarding wizard reads `invite` query param
- New admin UI at `/admin/friends-family-codes`

**Smart Availability L2 Features:**
- Each suggested slot gets individual booking URL
- "View all openings" link focuses calendar on relevant week
- Analytics track booking funnel: link_clicked → page_viewed → form_started → booking_completed

**Invite Codes Features:**
- Owner generates codes with label, plan tier, max redemptions, expiry
- Recipients get streamlined onboarding with plan pre-selected
- Complimentary accounts skip Stripe payment step
- Redemption tracking for auditing

**Acceptance Criteria:**
- AI agent suggests multiple slots with individual booking links
- Booking analytics show conversion rates by source
- Owner can generate invite links for friends/family
- Invited tenants get complimentary access on chosen tier

---

### Phase 4: Monetization Stack (28-35 hours | ~$28-35)
**Goal:** Complete revenue infrastructure with gift cards and tier management

| Feature | Hours | Dependencies | Integration Points |
|---------|-------|--------------|-------------------|
| Gift Cards V1 (Square) | 10-12 | Square credentials | `gift_cards` table, checkout integration |
| Plan Tiers & Billing Enhancements | 12-15 | Existing Stripe setup | Tier feature gates, upgrade flows |
| Internal Tier | 3-4 | Plan Tiers | `internal` tier type, billing bypass |

**Codebase Integration:**
- New `gift_cards` and `gift_card_redemptions` tables
- New `server/services/giftCardSquareService.ts`
- Square config in `server/integrations/squareConfig.ts`
- Checkout component with "Apply Gift Card" field
- Admin UI at `/settings/gift-cards`
- Extend `tenants.planTier` enum with `internal`
- Feature gate helper: `hasFeature(tenant, 'featureName')`
- Upgrade flow: Starter → Pro without re-onboarding

**Gift Card Flow:**
1. Customer buys gift card via Square (external)
2. Admin syncs gift cards from Square into ServicePro
3. Customer enters gift card code at checkout
4. System validates, applies balance, records redemption

**Tier System:**
- `starter`: Limited features, BYO integrations
- `pro`: Full features, managed Twilio
- `elite`: Everything + priority support
- `internal`: Full access, no billing (family/friends)

**Acceptance Criteria:**
- Gift cards sync from Square and display in admin
- Customers can apply gift cards at booking checkout
- Tenants can upgrade Starter → Pro with one click
- Internal tier tenants have full access without charges

---

### Phase 5: Security & DevOps (50-65 hours | ~$50-65)
**Goal:** Enterprise security and developer productivity tools

| Feature | Hours | Dependencies | Integration Points |
|---------|-------|--------------|-------------------|
| Security Service (2FA, Audit) | 12-16 | None | `totp_secrets`, `login_attempts`, `audit_logs` tables |
| Live Console AI Sidekick | 35-45 | OpenAI integration | Real-time log watcher, diagnostic panel |

**Security Service Features:**
- TOTP 2FA with authenticator apps (Google Auth, Authy)
- Backup codes for account recovery
- Login attempt tracking and brute-force protection
- Account lockout after failed attempts
- Admin activity audit logging
- Security dashboard with 24h stats

**Live Console AI Sidekick Features:**
- Real-time console/error log watching
- AI-powered issue diagnosis
- Automatic patch generation
- "Apply fix" one-click actions
- Integration with existing logging infrastructure

**Codebase Integration:**
- Security tables: `totp_secrets`, `login_attempts`, `account_lockouts`, `audit_logs`
- New `server/services/securityService.ts`
- 2FA setup flow in user settings
- Login flow extended with 2FA verification
- Sidekick: Browser extension or embedded panel
- WebSocket bridge for real-time log streaming
- OpenAI integration for diagnostic prompts

**Acceptance Criteria:**
- Users can enable 2FA with any authenticator app
- Failed logins trigger lockout after 5 attempts
- All admin actions create audit log entries
- Sidekick can diagnose common errors automatically

---

## Reliability Requirements

### Uptime Target: 99.95%
This means maximum 22 minutes of downtime per month. To achieve this:

- **Health checks** on all critical endpoints
- **Automatic restarts** for crashed processes
- **Database connection pooling** to handle load spikes
- **CDN caching** for static assets
- **Graceful degradation** when external services fail

### Error Handling Strategy
1. **Catch and Log**: Every error is logged with context
2. **Notify**: Critical errors alert the team
3. **Recover**: System attempts automatic recovery where safe
4. **Fallback**: User sees helpful message, not stack trace
5. **Learn**: Post-incident reviews improve resilience

### Rollback Planning
- Every deployment tagged in git
- Database migrations are reversible
- Feature flags allow instant disable
- Previous version always deployable in <5 minutes

---

## Security Requirements

### Authentication & Authorization
- Session-based auth with secure cookies
- RBAC middleware on all admin routes
- Tenant isolation verified at API boundary
- API keys rotated on schedule

### Data Protection
- PII encrypted at rest
- Sensitive fields never logged
- Webhook signatures verified (Twilio, Stripe)
- HTTPS enforced everywhere

### MFA Pathway (Phase 5)
- TOTP-based 2FA for all users
- Backup codes for recovery
- Admin accounts require 2FA

---

## Testing Requirements

### Unit Tests
- All utility functions
- Business logic helpers
- Data transformations

### Integration Tests
- API endpoint behavior
- Database operations
- External service mocking

### End-to-End Tests
- Critical user journeys
- Booking flow
- Payment flow
- Admin operations

### Load Testing
- Concurrent user simulation
- Database query performance
- External API rate limits

---

## Cost Summary

| Phase | Hours | Estimated Cost |
|-------|-------|----------------|
| Phase 0: Quick Hardening | 8-12 | $8-12 |
| Phase 1: Messaging Compliance | 18-24 | $18-24 |
| Phase 2: Telephony Experience | 15-20 | $15-20 |
| Phase 3: Scheduling & Growth | 18-24 | $18-24 |
| Phase 4: Monetization Stack | 28-35 | $28-35 |
| Phase 5: Security & DevOps | 50-65 | $50-65 |
| **TOTAL** | **137-180** | **~$137-180** |

### Cost Optimization Notes
- Bundling related features saves ~20-25% context-switching overhead
- Running phases in order prevents rework
- Consolidated migrations reduce database churn
- Parallel development possible for independent features

---

## Implementation Sequencing

### Pre-Phase Checklist
1. ✅ Review existing migrations and schema
2. ✅ Confirm background job scheduler is stable
3. ✅ Verify existing Twilio integration points
4. ✅ Map current billing/Stripe setup

### Phase Dependencies
```
Phase 0 ─────────────────────────────────────────────►
         │
         └──► Phase 1 (needs OG previews for campaign links)
                    │
                    └──► Phase 2 (independent, can parallel)
                              │
                              └──► Phase 3 (needs booking system stable)
                                        │
                                        └──► Phase 4 (needs tier system)
                                                  │
                                                  └──► Phase 5 (security last)
```

### Bundling Strategy
- **Same session**: Features sharing database tables
- **Same day**: Features sharing service files
- **Sequential**: Features with hard dependencies

---

## Appendix: File Locations

### Schema Files
- `shared/schema.ts` - All database tables

### Service Layer
- `server/services/` - Business logic
- `server/routes.*.ts` - API endpoints
- `server/utils/` - Shared utilities

### Frontend
- `client/src/pages/` - Page components
- `client/src/components/` - Reusable UI
- `client/src/hooks/` - Custom hooks
- `client/src/lib/` - Utilities

### Configuration
- `server/integrations/` - External service configs
- `client/src/config/` - Frontend configuration

---

*Document Version: 1.0*
*Created: December 2025*
*Last Updated: December 2025*
*Next Review: After each phase completion*
