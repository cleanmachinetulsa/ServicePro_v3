# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform that transforms service businesses into AI-powered web applications. It provides comprehensive management for customers, appointments, loyalty programs, and payments, integrating multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leveraging AI (OpenAI) and Google Workspace APIs for intelligent automation. The platform aims to enhance efficiency and customer engagement for service businesses, with a vision to become "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, including a hexagonal shield logo, visual channel indicators, gradient backgrounds, and gamification elements. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website features a glassmorphism design with gradients, animations, industry-specific content, and mobile responsiveness.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring service management integrates with Google Calendar. Twilio Voice integration provides voicemail, missed call auto-SMS, and comprehensive call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts.

#### Industry-Specific AI & Messaging Bootstrap
An automated bootstrap system initializes new tenants with industry-specific AI behavior rules, SMS templates, and FAQ entries based on their selected industry, ensuring multi-tenant isolation and idempotent upsert logic across 22 supported industries.

#### Telephony Mode System
A comprehensive telephony routing system allows tenant owners to control how incoming calls are handled, offering modes like `FORWARD_ALL_CALLS`, `AI_FIRST` (default), `AI_ONLY`, and `TEXT_ONLY_BUSINESS`. Settings are stored in the `tenantPhoneConfig` table, and the canonical voice handler branches based on the selected mode.

#### Multi-Tenant Architecture
The platform utilizes a comprehensive multi-tenant architecture with full tenant isolation across ~70+ database tables. An admin interface supports tenant CRUD operations and owner impersonation. It includes a canonical voice entry-point, a Tenant Communication Routing Engine, and an AI Voice Concierge entry point. Public sites are accessed via subdomains with global uniqueness and secure data isolation.

#### Customer Identity & Login
Customer authentication is separate from staff/owner authentication, using OTP via phone/email with rate limiting and session management. Customer profiles support `profilePictureUrl`, `customerNotes`, and notification preferences.

#### Billing & Usage Engine (SP-3)
A comprehensive multi-tenant usage tracking and billing system tracks daily usage (SMS, MMS, voice minutes, emails, AI tokens), aggregates this data daily, and estimates costs based on defined pricing constants. Tenant and root admin dashboards display usage, trends, and cost breakdowns.

#### UI Experience Mode (SP-4)
A Simple vs Advanced dashboard mode system allows tenant owners to toggle between a streamlined interface and a full-featured mode, hiding advanced features for a cleaner experience in Simple Mode. The preference is stored in the `tenant_config` table.

#### Usage & Billing Overview (SP-5)
A read-only billing and usage page accessible to all tenant users displays plan information, a 30-day usage snapshot, and access to the Stripe billing portal for payment management.

#### Billing & Dunning Automation (SP-6)
A comprehensive billing status and dunning system handles payment failures and account suspension. It tracks billing status via Stripe webhooks, provides warning banners for past-due accounts, and implements full-screen lockout for suspended accounts, with middleware to block critical API routes.

#### Phase 2.3 Billing Automation
A comprehensive SaaS billing automation system generates monthly invoices, tracks overdue payments, and automates dunning processes. It includes a `tenant_invoices` table, a `Stripe Billing Service` for invoice creation and charging, a `Monthly Invoice Generator` cron job, and a `Nightly Dunning` cron job for reminders and suspension. Admin pages provide billing info and control.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. The platform supports plan tiers (free/starter/pro/elite/internal) with feature gating for 12 features. The system also includes advanced conversation management with AI-powered handback analysis and smart scheduling extraction, a weather risk assessment system for appointments, a multi-tenant loyalty bonus campaign system, and an AI agent system aware of these campaigns. A complete SaaS pricing and tier comparison system includes a premium public /pricing page with glassmorphism UI, in-app upgrade modals, and locked feature components. A dual suggestion system enables tenant owners to submit platform feedback and customers to submit suggestions to their tenant's business.

### System Design Choices
The architecture employs a React with TypeScript frontend (Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Hook Form with Zod, Stripe) and an Express.js backend with TypeScript. Core patterns include a monolithic service layer, multi-channel response formatting for AI, a customer memory system, and Google Sheets integration as a dynamic knowledge base. Data is stored in PostgreSQL (Neon serverless) with Drizzle ORM, Google Sheets, and Google Drive. Authentication is session-based. The Express server uses `app.set('trust proxy', true)` for correct handling of Replit's multi-layer proxy infrastructure.

## External Dependencies

**Google Workspace Suite**:
- **Google Calendar API**: Appointment scheduling and availability.
- **Google Sheets API**: Customer database and knowledge base.
- **Google Drive API**: Customer photo management.
- **Google Maps API**: Geocoding, distance/drive time calculation.

**Payment Processing**:
- **Stripe**: Primary payment gateway for payment intents, customer/subscription management.
- **PayPal**: Alternative payment option.

**Communication Services**:
- **Twilio**: SMS notifications, voicemail transcription, and voice/IVR services.
- **SendGrid**: Email delivery.
- **Slack**: Internal business notifications and alerts.
- **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
- **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
- **OpenAI API**: GPT-4o for chatbot intelligence, conversational AI, intent detection, email content generation, service recommendations, and the Support AI Assistant.