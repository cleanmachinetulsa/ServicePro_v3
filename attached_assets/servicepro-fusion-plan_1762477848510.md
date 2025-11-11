# ServicePro White-Label Super-System
## Complete Fusion & Implementation Plan

**Version:** 2.0 - Repository-Informed  
**Date:** November 5, 2025  
**Status:** Production-Ready Implementation Plan  
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
│       │   