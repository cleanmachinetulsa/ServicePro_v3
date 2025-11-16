# ServicePro White-Label Super-System
## Complete Fusion & Implementation Plan

**Version:** 3.0 - Production State Updated  
**Date:** November 16, 2025  
**Status:** Production-Ready Implementation Plan with PWA & Modernization Baseline  
**Target:** Multi-Million Dollar Multi-Tenant SaaS Platform

---

## Executive Summary

This document provides a **complete, production-grade implementation plan** to fuse Clean Machine Auto Detail (CM) and ServicePro (SP) into a unified whitelabel "super-system." The plan preserves CM's battle-tested features while transforming both into a multi-tenant SaaS platform that any service business owner can deploy with **zero code**.

**Key Tech Stack (Preserved):**
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript (ESM modules)
- **Database:** PostgreSQL (Neon serverless) + Drizzle ORM
- **Auth:** Session-based (express-session + passport-local) + JWT for widget
- **Storage:** Google Drive for photos

**Core Architectural Principles:**
1. **Non-destructive migration**: Clean Machine continues as ROOT tenant
2. **Additive approach**: No breaking changes to working CM features
3. **Monorepo structure**: Core SDK + Adapters + Tenant isolation
4. **Onboarding-first UX**: Zero-code setup for non-technical users
5. **Feature flags**: Safe rollouts, instant rollbacks
6. **Multi-tenant by default**: Row-level isolation, encrypted secrets vault

---

## Table of Contents

0. [Current Production State (Nov 2025)](#0-current-production-state-nov-2025)
1. [Architecture & Code Organization](#1-architecture--code-organization)
2. [Database Schema & Migrations](#2-database-schema--migrations)
3. [Secrets Vault Architecture](#3-secrets-vault-architecture)
4. [Tenant Middleware & Isolation](#4-tenant-middleware--isolation)
5. [Onboarding Wizard Flow](#5-onboarding-wizard-flow)
6. [Industry Pack System](#6-industry-pack-system)
7. [Embeddable Widget](#7-embeddable-widget)
8. [Landing Page Generator Validator](#8-landing-page-generator-validator)
9. [Docs CMS Design](#9-docs-cms-design)
10. [Twilio A2P Helper Flows](#10-twilio-a2p-helper-flows)
11. [Feature Flags System](#11-feature-flags-system)
12. [Core Business Logic Fusion](#12-core-business-logic-fusion)
13. [Security, Compliance & Privacy](#13-security-compliance--privacy)
14. [Observability & SRE](#14-observability--sre)
15. [CI/CD & Testing Strategy](#15-cicd--testing-strategy)
16. [Deployment Strategy](#16-deployment-strategy)
17. [Migration Execution Plan](#17-migration-execution-plan)
18. [Gap Analysis & Solutions](#18-gap-analysis--solutions)
19. [Risk Assessment & Mitigation](#19-risk-assessment--mitigation)
20. [Non-Technical User Documentation](#20-non-technical-user-documentation)
21. [Cost Analysis & Scaling](#21-cost-analysis--scaling)
22. [Multi-Tenant PWA Considerations](#22-multi-tenant-pwa-considerations)

---

## 0) Current Production State (Nov 2025)

### 0.1 Overview
Clean Machine Auto Detail is now a **production-ready, AAA-quality Progressive Web App (PWA)** with Google Voice-level UX polish. This baseline represents the battle-tested features that will be preserved and enhanced during the multi-tenant transformation.

### 0.2 PWA Infrastructure (All 8 Features Implemented)

#### 1. Advanced Offline Mode
**Status:** ✅ Production Ready  
**Components:** Service Worker v17, IndexedDB, Offline Queue

**Features:**
- Cache-first strategy for dashboard data and appointments
- Offline mutation queue with automatic sync on reconnect
- Visual offline indicator (orange banner)
- Seamless online/offline transitions with zero data loss

**Technical Details:**
```typescript
// Service Worker Caching
- Network-first for API calls with cache fallback
- Cache-first for static assets
- Stale-while-revalidate for dashboard data

// IndexedDB Structure
- dashboard-cache (by date)
- appointments-cache (by id)
- customers-cache (by phone)
- drafts (by conversation key)
- mutation-queue (auto-increment)
```

#### 2. App Shortcuts
**Status:** ✅ Production Ready  
**Shortcuts Configured:**
1. Today's Schedule → `/dashboard`
2. Send Invoice → `/dashboard`
3. New Message → `/messages`
4. Quick Booking → `/quick-booking`

**Access:**
- **Android:** Long-press app icon
- **iOS 13+:** Long-press app icon
- **Desktop PWA:** Right-click taskbar/dock icon

#### 3. Custom Install Experience
**Status:** ✅ Production Ready  
**Components:** InstallPromptBanner, platform detection

**Features:**
- Branded install prompt with Clean Machine branding
- Platform-specific instructions (iOS/Android/Desktop)
- Dismissible with localStorage persistence
- Install state tracking

#### 4. Badge Notifications
**Status:** ✅ Production Ready  
**API:** `navigator.setAppBadge()` / `navigator.clearAppBadge()`

**Features:**
- Display unread message count on app icon
- Automatic badge clearing when count is 0
- Cross-platform support (Chrome, Edge, Safari 16.4+)
- Service worker message handler for `SET_BADGE` events

#### 5. Background Sync
**Status:** ✅ Production Ready  
**API:** SyncManager with capability check (`'SyncManager' in window`)

**Sync Events:**
- `sync-dashboard` - Dashboard data sync
- `sync-mutations` - Offline mutation queue processing

**Flow:**
1. Device goes offline → Actions queued in IndexedDB
2. Device reconnects → Background sync fires automatically
3. Queued actions processed with retry logic
4. User notified of completion

#### 6. Web Share API Integration
**Status:** ✅ Production Ready  
**Shareable Content:** Appointments, Invoices, Customer Info, Dashboard Summaries

**Platform Support:**
- ✅ Android (all browsers)
- ✅ iOS Safari
- ✅ Windows Edge
- ✅ macOS Safari 14+

#### 7. Persistent Storage
**Status:** ✅ Production Ready  
**Storage:** IndexedDB with unlimited quota request

**Features:**
- Draft message persistence with auto-save
- Dashboard data caching
- Customer data caching
- Offline mutation queue
- No data loss on browser close

#### 8. Full-Screen Standalone Mode
**Status:** ✅ Production Ready  
**Display:** `"display": "standalone"`

**Experience:**
- No browser chrome when installed
- Edge-to-edge design
- Native app feel on all platforms
- System-level task switching
- Custom splash screen

### 0.3 iOS/iPad Optimization

**Icon Sizes Configured:**
```json
"icons": [
  { "sizes": "120x120" },  // iPhone (2x)
  { "sizes": "152x152" },  // iPad (2x)
  { "sizes": "167x167" },  // iPad Pro (2x)
  { "sizes": "180x180" },  // iPhone (3x)
  { "sizes": "192x192" },  // Standard PWA
  { "sizes": "512x512" }   // High-res displays
]
```

**Maskable Icons:**
- `purpose: "any maskable"` - Adaptive for Android
- `purpose: "any"` - Standard display

**Apple-Specific:**
- `apple-touch-icon` configured
- Proper viewport meta tags
- Optimized for Safari PWA installation

### 0.4 Dashboard Modernization (Nov 2025)

**Visual Enhancements:**
- **Glassmorphism Styling:** Frosted glass cards (`backdrop-blur-xl bg-white/10 border-white/20`)
- **Gradient Text Headings:** `bg-clip-text text-transparent` with blue-cyan, purple-pink gradients
- **Animated Stat Counters:** Framer Motion entrance effects with staggered animations
- **Enhanced Appointment Cards:** Glass effect with colorful gradient accent bars
- **Semi-Transparent Calendar:** Enhanced styling with smooth hover transitions
- **Mobile Responsive:** Optimized layouts for all screen sizes

**Preserved Functionality:**
- ✅ All 8 dashboard tabs intact
- ✅ All widgets functional
- ✅ All event handlers working
- ✅ All business logic preserved
- ✅ No prop signature changes
- ✅ 100% backward compatible

**Technical Stack:**
- Framer Motion for animations
- Tailwind CSS for utility classes
- shadcn/ui component library
- React 18 with TypeScript

### 0.5 Current Tech Stack Baseline

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Framer Motion (animations)
- TanStack React Query (data fetching)
- Wouter (routing)
- React Hook Form + Zod (form validation)

**PWA Infrastructure:**
- Service Worker v17 (background sync, badge API, offline queue)
- IndexedDB (offline storage)
- Web Share API
- Background Sync API
- Badge API
- Persistent Storage API

**Backend:**
- Express.js + TypeScript (ESM)
- PostgreSQL (Neon serverless)
- Drizzle ORM
- Session-based auth (express-session + passport-local)

**External Services:**
- **Communication:** Twilio (SMS/Voice), SendGrid (Email), Slack (Alerts)
- **AI:** OpenAI GPT-4o (chatbot, content generation, scheduling)
- **Google Workspace:** Calendar, Sheets, Drive, Maps
- **Payments:** Stripe (primary), PayPal (alternative)
- **Weather:** Open-Meteo API
- **Social:** Facebook Graph API (Messenger, Instagram DMs)

### 0.6 Production-Ready Features (Pre-Multi-Tenant)

**Communication Hub:**
- Multi-channel messaging (SMS, Email, Facebook, Instagram)
- Real-time delivery monitoring
- AI-powered chatbot with GPT-4o
- iMessage-quality messaging suite (read receipts, typing indicators, reactions)
- Offline drafts with auto-save
- Recent callers widget with click-to-SMS

**Phone System:**
- Dual phone line switching (Main Line + Owner Line)
- Twilio Voice integration with voicemail
- Caller ID passthrough for owner contact saving
- Missed call auto-SMS
- Configurable notification preferences
- Comprehensive call logging

**Appointment Scheduling:**
- Weather-aware scheduling with auto-reschedule
- Google Calendar integration with conflict detection
- Recurring services with flexible scheduling
- Smart address validation
- Buffer time calculations
- Graceful fallback for API failures

**Customer Management:**
- Loyalty program with 9 reward types
- Referral system with QR codes and tracking
- Returning customer intelligence
- GPT personalization service
- TCPA/CTIA-compliant SMS consent
- Message attachments with Google Drive

**Payment Processing:**
- Stripe integration with payment intents
- PayPal alternative option
- Branded invoice email system
- HMAC-signed payment links
- Multi-payment CTAs
- Cash payment tracking with deposit widgets

**Business Intelligence:**
- Real-time dashboard with animated stats
- API usage tracking
- Error logging with auto-failover protection
- Health check monitoring
- Service limits and maintenance mode
- Banner management for customer communications

**Admin Tools:**
- Employee scheduling with PTO management
- Technician bio AI coach
- Centralized SMS template system
- Applicant pipeline
- Role-based access control (RBAC)
- Unified AppShell navigation

**Marketing & Showcase:**
- Investor-ready showcase page (`/showcase`)
- Live sandbox with 5 preset scenarios
- Scroll-triggered animations
- Interactive feature demonstrations
- Homepage CMS with multi-template system
- Careers portal

### 0.7 Multi-Tenant Transformation Baseline

**What's Already White-Label Ready:**
- ✅ Component-based UI architecture (easy rebrand)
- ✅ CSS variables for theming
- ✅ shadcn/ui component library (customizable)
- ✅ Environment-based configuration
- ✅ Modular service architecture

**What Needs Multi-Tenant Adaptation:**
- 🔄 Row-level tenant isolation in database
- 🔄 Tenant-scoped secrets vault
- 🔄 Per-tenant service worker registration
- 🔄 Tenant-isolated offline storage
- 🔄 Custom branding for install prompts
- 🔄 Tenant-specific badge notifications
- 🔄 Domain-based tenant routing

**Preserved During Migration:**
- All PWA features (adapt per tenant)
- All business logic (reuse in core SDK)
- All dashboard functionality (tenant-scoped)
- All communication features (tenant credentials)
- All payment processing (tenant Stripe accounts)

### 0.8 Documentation

**Available Resources:**
- **[PWA Features Guide](PWA_FEATURES.md)** - Complete PWA implementation details
- **[White Label Guide](WHITE_LABEL_GUIDE.md)** - White-labeling instructions
- **[README](replit.md)** - System architecture and user preferences

**This Document:**
Serves as the complete roadmap for transforming the production-ready Clean Machine app into a multi-tenant SaaS platform while preserving all existing functionality.

---

## 1) Architecture & Code Organization

### 1.1 Monorepo Structure (Replit-Compatible)

```
servicepro-monorepo/
├── .replit                            # Replit configuration
├── replit.nix                         # Nix dependencies
├── package.json                       # Workspace root
├── tsconfig.json                      # Base TypeScript config
├── turbo.json                         # Turborepo for caching
├── .env.example
├── .gitignore
│
├── packages/
│   ├── core/                          # Business logic SDK (Clean Machine → ServicePro)
│   │   ├── src/
│   │   │   ├── scheduling/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── scheduler.ts
│   │   │   │   │   ├── availability-checker.ts
│   │   │   │   │   ├── conflict-detector.ts
│   │   │   │   │   ├── weather-aware-scheduler.ts
│   │   │   │   │   ├── buffer-calculator.ts
│   │   │   │   │   ├── recurring-service-engine.ts
│   │   │   │   │   └── google-calendar-sync.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── calendar-port.ts
│   │   │   │   │   ├── weather-port.ts
│   │   │   │   │   ├── notification-port.ts
│   │   │   │   │   └── geocoding-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── book-appointment.ts
│   │   │   │       ├── check-availability.ts
│   │   │   │       ├── reschedule-for-weather.ts
│   │   │   │       ├── create-recurring-service.ts
│   │   │   │       ├── process-recurring-batch.ts
│   │   │   │       └── sync-with-google-calendar.ts
│   │   │   │
│   │   │   ├── telephony/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── sms-template-engine.ts
│   │   │   │   │   ├── voice-call-handler.ts
│   │   │   │   │   ├── missed-call-auto-sms.ts
│   │   │   │   │   ├── voicemail-to-sms.ts
│   │   │   │   │   ├── consent-tracker.ts
│   │   │   │   │   ├── tcpa-compliance.ts
│   │   │   │   │   ├── two-leg-calling.ts
│   │   │   │   │   └── click-to-call.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── telephony-provider-port.ts
│   │   │   │   │   ├── transcription-port.ts
│   │   │   │   │   └── recording-storage-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── send-sms.ts
│   │   │   │       ├── handle-incoming-call.ts
│   │   │   │       ├── process-voicemail.ts
│   │   │   │       ├── auto-respond-missed-call.ts
│   │   │   │       ├── initiate-two-leg-call.ts
│   │   │   │       ├── track-sms-consent.ts
│   │   │   │       └── handle-stop-start-help.ts
│   │   │   │
│   │   │   ├── weather/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── weather-analyzer.ts
│   │   │   │   │   ├── reschedule-rules.ts
│   │   │   │   │   ├── industry-thresholds.ts  # Auto-detail vs lawn care
│   │   │   │   │   └── forecast-evaluator.ts
│   │   │   │   ├── ports/
│   │   │   │   │   └── weather-provider-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── check-weather-impact.ts
│   │   │   │       ├── auto-reschedule-appointment.ts
│   │   │   │       └── notify-customer-of-reschedule.ts
│   │   │   │
│   │   │   ├── maps/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── service-area-validator.ts
│   │   │   │   │   ├── geocoder.ts
│   │   │   │   │   ├── eta-calculator.ts
│   │   │   │   │   └── route-optimizer.ts
│   │   │   │   ├── ports/
│   │   │   │   │   └── geocoding-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── validate-service-area.ts
│   │   │   │       ├── calculate-technician-eta.ts
│   │   │   │       └── geocode-address.ts
│   │   │   │
│   │   │   ├── knowledge-base/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── kb-matcher.ts
│   │   │   │   │   ├── response-generator.ts
│   │   │   │   │   ├── confidence-scorer.ts
│   │   │   │   │   └── sheets-kb-sync.ts  # Google Sheets integration
│   │   │   │   ├── ports/
│   │   │   │   │   ├── kb-store-port.ts
│   │   │   │   │   ├── ai-provider-port.ts
│   │   │   │   │   └── sheets-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── answer-customer-question.ts
│   │   │   │       ├── suggest-ai-response.ts
│   │   │   │       └── sync-kb-from-google-sheets.ts
│   │   │   │
│   │   │   ├── technicians/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── technician-profile.ts
│   │   │   │   │   ├── bio-coach.ts  # AI-powered bio improvement
│   │   │   │   │   ├── photo-validator.ts
│   │   │   │   │   ├── onboarding-checklist.ts
│   │   │   │   │   ├── pto-manager.ts
│   │   │   │   │   ├── shift-trader.ts
│   │   │   │   │   ├── applicant-pipeline.ts
│   │   │   │   │   └── time-tracker.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── ai-coach-port.ts
│   │   │   │   │   ├── storage-port.ts
│   │   │   │   │   └── calendar-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── create-technician.ts
│   │   │   │       ├── improve-bio-with-ai.ts
│   │   │   │       ├── inject-profile-in-otw-message.ts
│   │   │   │       ├── request-pto.ts
│   │   │   │       ├── trade-shift.ts
│   │   │   │       └── track-applicant.ts
│   │   │   │
│   │   │   ├── billing/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── invoice.ts
│   │   │   │   │   ├── third-party-payer.ts  # Complex multi-role billing
│   │   │   │   │   ├── gift-billing.ts
│   │   │   │   │   ├── company-po-billing.ts
│   │   │   │   │   ├── deposit-rules.ts
│   │   │   │   │   ├── payment-methods.ts
│   │   │   │   │   └── role-based-notifications.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── payment-provider-port.ts  # Stripe + PayPal
│   │   │   │   │   ├── invoice-store-port.ts
│   │   │   │   │   └── notification-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── authorize-third-party-payer.ts
│   │   │   │       ├── collect-deposit.ts
│   │   │   │       ├── finalize-invoice.ts
│   │   │   │       ├── process-gift-payment.ts
│   │   │   │       ├── handle-company-po.ts
│   │   │   │       └── notify-payer-recipient-separately.ts
│   │   │   │
│   │   │   ├── messaging/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── multi-channel-router.ts  # SMS, web, FB, IG
│   │   │   │   │   ├── unified-inbox.ts
│   │   │   │   │   ├── ai-takeover-manager.ts
│   │   │   │   │   ├── manual-override.ts
│   │   │   │   │   └── message-rephraser.ts  # GPT-4o-mini
│   │   │   │   ├── ports/
│   │   │   │   │   ├── sms-port.ts
│   │   │   │   │   ├── facebook-port.ts
│   │   │   │   │   ├── instagram-port.ts
│   │   │   │   │   └── webchat-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── route-inbound-message.ts
│   │   │   │       ├── send-multi-channel-message.ts
│   │   │   │       ├── takeover-from-ai.ts
│   │   │   │       ├── handoff-to-ai.ts
│   │   │   │       └── rephrase-message-for-tone.ts
│   │   │   │
│   │   │   ├── quotes/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── quote-request.ts
│   │   │   │   │   ├── photo-analyzer.ts  # AI vision for damage assessment
│   │   │   │   │   ├── damage-assessor.ts
│   │   │   │   │   ├── custom-pricing-engine.ts
│   │   │   │   │   └── specialty-job-workflow.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── storage-port.ts  # Google Drive
│   │   │   │   │   ├── ai-vision-port.ts
│   │   │   │   │   └── notification-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── create-quote-request.ts
│   │   │   │       ├── analyze-damage-photos.ts
│   │   │   │       ├── generate-custom-quote.ts
│   │   │   │       └── approve-and-book-quote.ts
│   │   │   │
│   │   │   ├── loyalty/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── points-engine.ts
│   │   │   │   │   ├── tier-manager.ts  # Bronze/Silver/Gold/Platinum
│   │   │   │   │   ├── achievement-tracker.ts
│   │   │   │   │   └── reward-redeemer.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── points-store-port.ts
│   │   │   │   │   └── notification-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── award-points.ts
│   │   │   │       ├── check-tier-upgrade.ts
│   │   │   │       ├── unlock-achievement.ts
│   │   │   │       └── redeem-reward.ts
│   │   │   │
│   │   │   ├── ai-chatbot/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── conversation-manager.ts
│   │   │   │   │   ├── intent-classifier.ts
│   │   │   │   │   ├── context-builder.ts
│   │   │   │   │   ├── gpt4o-orchestrator.ts
│   │   │   │   │   ├── booking-assistant.ts
│   │   │   │   │   ├── damage-assessment-assistant.ts
│   │   │   │   │   ├── service-recommender.ts
│   │   │   │   │   └── upsell-detector.ts  # Detect selling/lease-return
│   │   │   │   ├── ports/
│   │   │   │   │   ├── ai-provider-port.ts
│   │   │   │   │   ├── kb-port.ts
│   │   │   │   │   ├── calendar-port.ts
│   │   │   │   │   └── customer-store-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── handle-customer-message.ts
│   │   │   │       ├── book-appointment-via-ai.ts
│   │   │   │       ├── assess-vehicle-damage.ts
│   │   │   │       ├── recommend-service.ts
│   │   │   │       └── suggest-upsell.ts
│   │   │   │
│   │   │   ├── templates/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── template-engine.ts
│   │   │   │   │   ├── variable-injector.ts
│   │   │   │   │   ├── industry-defaults.ts
│   │   │   │   │   ├── personalization.ts
│   │   │   │   │   └── rich-sms-templates.ts  # Technician bio + ETA
│   │   │   │   └── use-cases/
│   │   │   │       ├── render-template.ts
│   │   │   │       ├── validate-template.ts
│   │   │   │       ├── inject-technician-profile.ts
│   │   │   │       └── generate-otw-message.ts
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── notification-router.ts
│   │   │   │   │   ├── push-manager.ts  # VAPID PWA push
│   │   │   │   │   ├── slack-notifier.ts
│   │   │   │   │   └── email-notifier.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── push-port.ts
│   │   │   │   │   ├── slack-port.ts
│   │   │   │   │   └── email-port.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── send-push-notification.ts
│   │   │   │       ├── send-slack-alert.ts
│   │   │   │       └── send-email-campaign.ts
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── errors/
│   │   │       │   ├── domain-error.ts
│   │   │       │   ├── validation-error.ts
│   │   │       │   ├── not-found-error.ts
│   │   │       │   └── consent-violation-error.ts
│   │   │       ├── types/
│   │   │       │   ├── common.ts
│   │   │       │   ├── value-objects.ts
│   │   │       │   └── tenant-context.ts
│   │   │       ├── validation/
│   │   │       │   ├── phone-validator.ts
│   │   │       │   ├── email-validator.ts
│   │   │       │   ├── address-validator.ts
│   │   │       │   └── consent-validator.ts
│   │   │       └── utils/
│   │   │           ├── date-time.ts
│   │   │           ├── formatters.ts
│   │   │           └── rate-limiter.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── adapters/                      # Infrastructure implementations
│   │   ├── src/
│   │   │   ├── twilio/
│   │   │   │   ├── twilio-telephony-adapter.ts
│   │   │   │   ├── twilio-webhook-handler.ts
│   │   │   │   ├── a2p-registration-service.ts
│   │   │   │   ├── messaging-service-manager.ts
│   │   │   │   ├── signature-validator.ts
│   │   │   │   ├── transcription-adapter.ts
│   │   │   │   └── campaign-helper.ts
│   │   │   ├── google/
│   │   │   │   ├── google-calendar-adapter.ts
│   │   │   │   ├── google-maps-adapter.ts
│   │   │   │   ├── google-sheets-adapter.ts
│   │   │   │   ├── google-drive-adapter.ts
│   │   │   │   └── service-account-manager.ts
│   │   │   ├── stripe/
│   │   │   │   ├── stripe-payment-adapter.ts
│   │   │   │   ├── stripe-webhook-handler.ts
│   │   │   │   ├── idempotency-manager.ts
│   │   │   │   └── payment-intent-handler.ts
│   │   │   ├── paypal/
│   │   │   │   ├── paypal-payment-adapter.ts
│   │   │   │   └── paypal-webhook-handler.ts
│   │   │   ├── openai/
│   │   │   │   ├── openai-adapter.ts
│   │   │   │   ├── gpt4o-chatbot.ts
│   │   │   │   ├── gpt4o-mini-rephraser.ts
│   │   │   │   ├── bio-coach-impl.ts
│   │   │   │   ├── vision-analyzer.ts
│   │   │   │   └── kb-assistant.ts
│   │   │   ├── email/
│   │   │   │   ├── sendgrid-adapter.ts
│   │   │   │   └── email-template-renderer.ts
│   │   │   ├── social/
│   │   │   │   ├── facebook-messenger-adapter.ts
│   │   │   │   ├── instagram-dm-adapter.ts
│   │   │   │   └── social-webhook-handler.ts
│   │   │   ├── weather/
│   │   │   │   └── open-meteo-adapter.ts
│   │   │   ├── storage/
│   │   │   │   ├── google-drive-storage.ts
│   │   │   │   └── s3-storage-fallback.ts
│   │   │   └── notifications/
│   │   │       ├── slack-adapter.ts
│   │   │       └── vapid-push-adapter.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/                      # Data layer with Drizzle ORM
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── tenants.ts
│   │   │   │   ├── tenant-settings.ts
│   │   │   │   ├── tenant-integrations.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── appointments.ts
│   │   │   │   ├── services.ts
│   │   │   │   ├── recurring-services.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── quote-requests.ts
│   │   │   │   ├── employee-profiles.ts
│   │   │   │   ├── loyalty-points.ts
│   │   │   │   ├── loyalty-tiers.ts
│   │   │   │   ├── achievements.ts
│   │   │   │   ├── third-party-contacts.ts
│   │   │   │   ├── push-subscriptions.ts
│   │   │   │   ├── call-logs.ts
│   │   │   │   ├── industry-packs.ts
│   │   │   │   ├── feature-flags.ts
│   │   │   │   ├── docs.ts
│   │   │   │   ├── widget-tokens.ts
│   │   │   │   ├── audit-logs.ts
│   │   │   │   ├── consent-logs.ts
│   │   │   │   └── index.ts
│   │   │   ├── repositories/
│   │   │   │   ├── base-repository.ts
│   │   │   │   ├── tenant-repository.ts
│   │   │   │   ├── user-repository.ts
│   │   │   │   ├── customer-repository.ts
│   │   │   │   ├── appointment-repository.ts
│   │   │   │   ├── service-repository.ts
│   │   │   │   ├── recurring-service-repository.ts
│   │   │   │   ├── message-repository.ts
│   │   │   │   ├── quote-repository.ts
│   │   │   │   ├── technician-repository.ts
│   │   │   │   ├── loyalty-repository.ts
│   │   │   │   ├── third-party-contact-repository.ts
│   │   │   │   ├── call-log-repository.ts
│   │   │   │   ├── industry-pack-repository.ts
│   │   │   │   ├── feature-flag-repository.ts
│   │   │   │   ├── docs-repository.ts
│   │   │   │   └── consent-log-repository.ts
│   │   │   ├── migrations/
│   │   │   │   ├── 0001_baseline_clean_machine.sql
│   │   │   │   ├── 0002_add_tenants_table.sql
│   │   │   │   ├── 0003_add_tenant_id_to_users.sql
│   │   │   │   ├── 0004_add_tenant_id_to_customers.sql
│   │   │   │   ├── 0005_add_tenant_id_to_appointments.sql
│   │   │   │   ├── 0006_add_tenant_id_to_all_tables.sql
│   │   │   │   ├── 0007_backfill_root_tenant.sql
│   │   │   │   ├── 0008_create_secrets_vault_table.sql
│   │   │   │   ├── 0009_create_industry_packs.sql
│   │   │   │   ├── 0010_seed_industry_packs.sql
│   │   │   │   ├── 0011_create_feature_flags.sql
│   │   │   │   ├── 0012_create_docs_table.sql
│   │   │   │   ├── 0013_create_widget_tokens.sql
│   │   │   │   ├── 0014_create_audit_logs.sql
│   │   │   │   ├── 0015_create_consent_logs.sql
│   │   │   │   ├── 0016_add_composite_indexes.sql
│   │   │   │   └── rollback/
│   │   │   │       └── [reverse migrations]
│   │   │   ├── seeds/
│   │   │   │   ├── 0001_root_tenant_clean_machine.ts
│   │   │   │   ├── 0002_industry_packs.ts
│   │   │   │   ├── 0003_demo_tenant.ts
│   │   │   │   ├── 0004_docs_content.ts
│   │   │   │   └── 0005_default_feature_flags.ts
│   │   │   ├── db.ts
│   │   │   └── migrate.ts
│   │   ├── drizzle.config.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                        # Shared utilities
│       ├── src/
│       │   ├── tenant-context/
│       │   │   ├── tenant-context.ts
│       │   │   ├── tenant-resolver.ts  # Subdomain + custom domain
│       │   │   └── tenant-middleware.ts
│       │   ├── secrets-vault/
│       │   │   ├── vault-client.ts
│       │   │   ├── encryption-service.ts  # AES-256-GCM
│       │   │   ├── key-rotation-service.ts
│       │   │   └── secrets-cache.ts
│       │   ├── feature-flags/
│       │   │   ├── flag-service.ts
│       │   │   ├── flag-evaluator.ts
│       │   │   └── flag-middleware.ts
│       │   ├── auth/
│       │   │   ├── session-service.ts  # express-session
│       │   │   ├── passport-local-strategy.ts
│       │   │   ├── password-hasher.ts  # bcrypt
│       │   │   ├── jwt-service.ts  # For widget tokens
│       │   │   └── widget-token-service.ts
│       │   ├── logging/
│       │   │       │   │   │   ├── logger.ts
│       │   │   │   └── log-aggregator.ts
│       │   └── types/
│       │       └── shared-types.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
└── apps/
    ├── web/                              # Main web application
    │   ├── client/                       # Frontend (existing CM structure preserved)
    │   ├── server/                       # Backend (existing CM structure preserved)
    │   ├── public/
    │   ├── vite.config.ts
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── widget/                           # Embeddable booking widget
        ├── src/
        │   ├── widget.tsx                # Entry point
        │   ├── booking-flow.tsx
        │   └── jwt-validator.ts
        ├── vite.config.ts
        ├── package.json
        └── tsconfig.json
```

---

## 22) Multi-Tenant PWA Considerations

### 22.1 Overview
The production PWA features implemented in Clean Machine (Section 0.2) must be adapted for multi-tenant operation. Each tenant gets isolated PWA capabilities with custom branding while sharing the same codebase infrastructure.

### 22.2 Tenant-Isolated Service Workers

#### Challenge
Service workers operate at the origin level (`/`), creating potential conflicts when multiple tenants share the same domain.

#### Solution: Tenant-Scoped Registration

**Strategy 1: Subdomain-Based Isolation (Recommended)**
```typescript
// Each tenant gets unique subdomain
// acme-detail.servicepro.app → Registers /sw-acme.js
// sparkle-lawn.servicepro.app → Registers /sw-sparkle.js

// Dynamic service worker registration
const tenantSlug = getTenantSlugFromSubdomain();
const swPath = `/sw-${tenantSlug}.js`;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(swPath, {
    scope: '/'
  });
}
```

**Strategy 2: Custom Domain Isolation**
```typescript
// Custom domains automatically isolate service workers
// detailpro.com → Registers /service-worker.js (isolated)
// lawncareplus.com → Registers /service-worker.js (isolated, different origin)
```

**Dynamic Service Worker Generation:**
```typescript
// server/routes/service-worker.ts
app.get('/sw-:tenantSlug.js', async (req, res) => {
  const { tenantSlug } = req.params;
  const tenant = await getTenantBySlug(tenantSlug);
  
  // Generate tenant-specific service worker
  const swCode = generateServiceWorker({
    tenantId: tenant.id,
    cacheName: `${tenantSlug}-cache-v1`,
    offlineDbName: `${tenantSlug}-offline`,
    badgeColor: tenant.brandColor
  });
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(swCode);
});
```

### 22.3 Tenant-Isolated Offline Storage

#### IndexedDB Naming Convention
```typescript
// Current (Single Tenant)
const DB_NAME = 'clean-machine-offline';

// Multi-Tenant (Per Tenant)
const DB_NAME = `${tenantSlug}-offline`; // 'acme-detail-offline'

// Structure
{
  [tenantSlug]-offline: {
    stores: {
      'dashboard-cache': { keyPath: 'date', tenantId: tenant.id },
      'appointments-cache': { keyPath: 'id', tenantId: tenant.id },
      'customers-cache': { keyPath: 'phone', tenantId: tenant.id },
      'drafts': { keyPath: 'conversationKey', tenantId: tenant.id },
      'mutation-queue': { autoIncrement: true, tenantId: tenant.id }
    }
  }
}
```

#### Data Isolation Enforcement
```typescript
// Always include tenantId in all IndexedDB operations
class TenantOfflineDb {
  constructor(private tenantId: string, private tenantSlug: string) {
    this.dbName = `${tenantSlug}-offline`;
  }
  
  async addToCache(store: string, data: any) {
    // Enforce tenant ID in all cached data
    const dataWithTenant = { ...data, tenantId: this.tenantId };
    await this.db.add(store, dataWithTenant);
  }
  
  async getFromCache(store: string, key: any) {
    const data = await this.db.get(store, key);
    // Verify tenant ID before returning
    if (data.tenantId !== this.tenantId) {
      throw new Error('Tenant isolation violation');
    }
    return data;
  }
}
```

### 22.4 Custom Branding for PWA Install

#### Manifest Per Tenant
```typescript
// server/routes/manifest.ts
app.get('/manifest-:tenantSlug.json', async (req, res) => {
  const { tenantSlug } = req.params;
  const tenant = await getTenantBySlug(tenantSlug);
  
  const manifest = {
    name: tenant.businessName,
    short_name: tenant.shortName,
    description: tenant.tagline,
    start_url: `/${tenant.slug}/dashboard`,
    display: "standalone",
    background_color: tenant.brandColors.background,
    theme_color: tenant.brandColors.primary,
    icons: [
      {
        src: `/tenant-icons/${tenant.id}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: `/tenant-icons/${tenant.id}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    shortcuts: tenant.shortcuts || defaultShortcuts
  };
  
  res.json(manifest);
});
```

#### Custom Install Prompts
```typescript
// client/src/contexts/TenantPwaContext.tsx
export function TenantPwaProvider({ children, tenant }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  
  const customInstallBanner = (
    <InstallPromptBanner
      businessName={tenant.businessName}
      logoUrl={tenant.logoUrl}
      primaryColor={tenant.brandColors.primary}
      onInstall={handleInstall}
    />
  );
  
  return (
    <PwaContext.Provider value={{ installPrompt, customBanner }}>
      {children}
    </PwaContext.Provider>
  );
}
```

### 22.5 Tenant-Specific Badge Notifications

#### Badge API with Tenant Context
```typescript
// Service worker message handler (per tenant)
self.addEventListener('message', (event) => {
  if (event.data.type === 'SET_BADGE') {
    const { count, tenantId } = event.data;
    
    // Verify tenant isolation
    if (tenantId !== self.TENANT_ID) {
      console.error('Badge update for wrong tenant');
      return;
    }
    
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(count);
    }
  }
});
```

#### Unread Count Per Tenant
```typescript
// client/src/hooks/useTenantBadge.ts
export function useTenantBadge(tenantId: string) {
  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count', tenantId],
    refetchInterval: 30000 // Poll every 30s
  });
  
  useEffect(() => {
    if (unreadCount !== undefined) {
      updateTenantBadge(tenantId, unreadCount);
    }
  }, [unreadCount, tenantId]);
}
```

### 22.6 Background Sync Per Tenant

#### Tenant-Scoped Sync Events
```typescript
// Register sync with tenant prefix
async function registerTenantSync(tenantId: string, syncType: string) {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(`${tenantId}-${syncType}`);
  }
}

// Service worker sync handler
self.addEventListener('sync', (event) => {
  const [tenantId, syncType] = event.tag.split('-');
  
  if (syncType === 'mutations') {
    event.waitUntil(syncTenantMutations(tenantId));
  } else if (syncType === 'dashboard') {
    event.waitUntil(syncTenantDashboard(tenantId));
  }
});
```

### 22.7 Offline Queue Isolation

#### Tenant-Specific Mutation Queues
```typescript
// client/src/lib/tenantOfflineDb.ts
export class TenantOfflineQueue {
  constructor(private tenantId: string) {}
  
  async add(endpoint: string, method: string, data: any) {
    const mutation = {
      tenantId: this.tenantId,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retries: 0
    };
    
    await offlineDb.put(`${this.tenantId}-queue`, mutation);
  }
  
  async flush() {
    const mutations = await offlineDb.getAll(`${this.tenantId}-queue`);
    
    for (const mutation of mutations) {
      // Verify tenant ID before processing
      if (mutation.tenantId !== this.tenantId) {
        console.error('Tenant isolation violation in queue');
        continue;
      }
      
      try {
        await fetch(mutation.endpoint, {
          method: mutation.method,
          headers: { 'X-Tenant-ID': this.tenantId },
          body: JSON.stringify(mutation.data)
        });
        
        await offlineDb.delete(`${this.tenantId}-queue`, mutation.id);
      } catch (error) {
        mutation.retries++;
        await offlineDb.put(`${this.tenantId}-queue`, mutation);
      }
    }
  }
}
```

### 22.8 Web Share API Per Tenant

#### Tenant-Branded Sharing
```typescript
// client/src/hooks/useTenantShare.ts
export function useTenantShare(tenant: Tenant) {
  const canShare = 'share' in navigator;
  
  const shareContent = async (data: ShareData) => {
    if (!canShare) return;
    
    const brandedData = {
      ...data,
      title: `${data.title} - ${tenant.businessName}`,
      url: `https://${tenant.customDomain || tenant.slug + '.servicepro.app'}${data.url}`
    };
    
    await navigator.share(brandedData);
  };
  
  return { canShare, shareContent };
}
```

### 22.9 App Shortcuts Per Tenant

#### Dynamic Shortcuts Based on Tenant Industry
```json
// Auto-detailing tenant shortcuts
{
  "shortcuts": [
    { "name": "Today's Detailing Schedule", "url": "/dashboard" },
    { "name": "Send Invoice", "url": "/invoices" },
    { "name": "New Message", "url": "/messages" },
    { "name": "Quick Booking", "url": "/quick-booking" }
  ]
}

// Lawn care tenant shortcuts
{
  "shortcuts": [
    { "name": "Today's Jobs", "url": "/dashboard" },
    { "name": "Send Estimate", "url": "/estimates" },
    { "name": "New Message", "url": "/messages" },
    { "name": "Schedule Service", "url": "/quick-booking" }
  ]
}
```

#### Industry Pack Integration
```typescript
// Generate shortcuts based on industry pack
function generateTenantShortcuts(tenant: Tenant, industryPack: IndustryPack) {
  return industryPack.shortcuts.map(shortcut => ({
    name: shortcut.name.replace('{businessType}', industryPack.businessType),
    short_name: shortcut.shortName,
    description: shortcut.description,
    url: shortcut.url,
    icons: [{ src: `/tenant-icons/${tenant.id}/icon-192.png`, sizes: "192x192" }]
  }));
}
```

### 22.10 Persistent Storage Per Tenant

#### Quota Management
```typescript
// Request persistent storage per tenant
async function requestTenantPersistentStorage(tenantId: string) {
  if (navigator.storage && navigator.storage.persist) {
    const isPersistent = await navigator.storage.persist();
    
    if (isPersistent) {
      console.log(`Persistent storage granted for tenant ${tenantId}`);
      
      // Estimate quota usage
      const estimate = await navigator.storage.estimate();
      const percentUsed = (estimate.usage / estimate.quota) * 100;
      
      // Warn if approaching limit
      if (percentUsed > 80) {
        notifyTenantAdmin(tenantId, 'Storage quota approaching limit');
      }
    }
  }
}
```

### 22.11 Migration Path from Single-Tenant PWA

#### Phase 1: Add Tenant Context to Existing PWA
```typescript
// Preserve existing Clean Machine PWA (ROOT tenant)
const ROOT_TENANT_ID = 'clean-machine-root';

// Wrap existing service worker with tenant context
if (window.location.hostname === 'app.cleanmachinedetail.com') {
  // Use existing single-tenant service worker
  navigator.serviceWorker.register('/service-worker.js');
} else {
  // Use multi-tenant service worker
  const tenantSlug = getTenantSlug();
  navigator.serviceWorker.register(`/sw-${tenantSlug}.js`);
}
```

#### Phase 2: Migrate Offline Storage
```typescript
// One-time migration for Clean Machine
async function migrateToTenantOfflineDb() {
  const oldDb = await openDB('clean-machine-offline');
  const newDb = await openDB('clean-machine-root-offline');
  
  // Copy all stores
  for (const storeName of oldDb.objectStoreNames) {
    const oldStore = oldDb.transaction(storeName, 'readonly').objectStore(storeName);
    const newStore = newDb.transaction(storeName, 'readwrite').objectStore(storeName);
    
    const items = await oldStore.getAll();
    for (const item of items) {
      await newStore.add({ ...item, tenantId: ROOT_TENANT_ID });
    }
  }
  
  // Delete old database
  await deleteDB('clean-machine-offline');
}
```

#### Phase 3: Roll Out to New Tenants
```typescript
// Onboarding wizard creates tenant PWA setup
async function setupTenantPwa(tenant: Tenant) {
  // 1. Generate tenant manifest
  await generateTenantManifest(tenant);
  
  // 2. Upload tenant icons
  await uploadTenantIcons(tenant.id, tenant.icons);
  
  // 3. Create tenant service worker template
  await createTenantServiceWorker(tenant.slug);
  
  // 4. Initialize offline database
  await initializeTenantOfflineDb(tenant.id, tenant.slug);
  
  // 5. Configure shortcuts based on industry pack
  await configureTenantShortcuts(tenant, tenant.industryPack);
  
  // 6. Test PWA installation
  await testTenantPwaInstall(tenant.slug);
}
```

### 22.12 Testing Multi-Tenant PWA

#### Test Checklist
- [ ] Each tenant gets isolated service worker
- [ ] Offline storage is tenant-scoped
- [ ] Badge notifications work per tenant
- [ ] Background sync processes correct tenant data
- [ ] Install prompts show tenant branding
- [ ] App shortcuts reflect tenant industry
- [ ] Share API uses tenant custom domain
- [ ] Persistent storage tracked per tenant
- [ ] Migration from single-tenant PWA successful
- [ ] No cross-tenant data leakage

#### Automated Tests
```typescript
describe('Multi-Tenant PWA Isolation', () => {
  it('should isolate service workers by tenant', async () => {
    const tenant1Sw = await registerTenantServiceWorker('acme-detail');
    const tenant2Sw = await registerTenantServiceWorker('sparkle-lawn');
    
    expect(tenant1Sw.scope).toBe('/');
    expect(tenant2Sw.scope).toBe('/');
    expect(tenant1Sw.scriptURL).toContain('sw-acme-detail.js');
    expect(tenant2Sw.scriptURL).toContain('sw-sparkle-lawn.js');
  });
  
  it('should prevent cross-tenant data access', async () => {
    const tenant1Db = new TenantOfflineDb('tenant-1', 'acme');
    const tenant2Db = new TenantOfflineDb('tenant-2', 'sparkle');
    
    await tenant1Db.addToCache('drafts', { key: 'test', value: 'secret' });
    
    await expect(
      tenant2Db.getFromCache('drafts', 'test')
    ).rejects.toThrow('Tenant isolation violation');
  });
});
```

### 22.13 Performance Considerations

#### Service Worker Caching Strategy Per Tenant
```typescript
// Optimize cache sizes per tenant
const TENANT_CACHE_LIMITS = {
  'dashboard-cache': 50,      // 50 days max
  'appointments-cache': 100,  // 100 appointments max
  'customers-cache': 500,     // 500 customers max
  'drafts': 20                // 20 drafts max
};

// Eviction policy
async function evictOldCacheEntries(tenantId: string) {
  for (const [store, limit] of Object.entries(TENANT_CACHE_LIMITS)) {
    const entries = await getAllFromStore(tenantId, store);
    
    if (entries.length > limit) {
      const sorted = entries.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = sorted.slice(0, entries.length - limit);
      
      for (const entry of toDelete) {
        await deleteFromStore(tenantId, store, entry.id);
      }
    }
  }
}
```

### 22.14 Security Considerations

#### Tenant Boundary Enforcement
```typescript
// Middleware to verify tenant context in service worker
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const tenantIdFromUrl = url.searchParams.get('tenantId');
  
  // Verify tenant ID matches service worker tenant
  if (tenantIdFromUrl && tenantIdFromUrl !== self.TENANT_ID) {
    event.respondWith(
      new Response('Forbidden', { status: 403 })
    );
    return;
  }
  
  // Proceed with tenant-scoped caching
  event.respondWith(handleTenantFetch(event.request));
});
```

#### Audit Logging
```typescript
// Log all PWA operations per tenant
async function logTenantPwaOperation(
  tenantId: string,
  operation: string,
  metadata: any
) {
  await auditLog.create({
    tenantId,
    category: 'PWA',
    action: operation,
    metadata,
    timestamp: new Date()
  });
}

// Example usage
await logTenantPwaOperation(tenant.id, 'SERVICE_WORKER_REGISTERED', {
  swPath: `/sw-${tenant.slug}.js`,
  userAgent: navigator.userAgent
});
```

---

## Conclusion

This ServicePro White-Label Super-System implementation plan provides a complete roadmap for transforming Clean Machine Auto Detail's production-ready PWA application into a multi-tenant SaaS platform. The baseline features documented in Section 0 (Current Production State) represent a battle-tested foundation that will be preserved and enhanced during the transformation.

**Key Success Factors:**
1. **Non-destructive migration** - Clean Machine continues operating as ROOT tenant
2. **Feature preservation** - All PWA capabilities adapted for multi-tenant use
3. **Tenant isolation** - Comprehensive data and resource separation
4. **White-label flexibility** - Custom branding without code changes
5. **Zero-code onboarding** - Non-technical users can deploy in minutes

**Next Steps:**
1. Review this plan with technical and business stakeholders
2. Set up development environment with monorepo structure
3. Begin Phase 1: Core SDK extraction from Clean Machine
4. Implement tenant isolation in database layer
5. Build onboarding wizard with industry pack selection
6. Test multi-tenant PWA isolation thoroughly
7. Deploy first white-label tenant (beta)
8. Iterate based on feedback and scale

**Timeline Estimate:**
- Phase 1 (Core SDK): 4-6 weeks
- Phase 2 (Multi-tenant infrastructure): 6-8 weeks
- Phase 3 (Onboarding wizard): 3-4 weeks
- Phase 4 (Testing & polish): 2-3 weeks
- **Total: 15-21 weeks to MVP**

**Investment Required:**
- 2-3 senior full-stack engineers
- 1 DevOps engineer
- 1 product designer
- QA resources
- Cloud infrastructure (Neon, Vercel, etc.)

**Revenue Potential:**
- Base: $99/month per tenant
- Premium: $299/month per tenant
- Enterprise: Custom pricing
- Target: 100 tenants in Year 1 → $120K-$360K ARR

This plan is production-ready and can be executed immediately with the right team and resources.
