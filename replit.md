# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. Its core purpose is to streamline operations by providing comprehensive management for customers, appointments, loyalty programs, and payments. The platform integrates multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leverages AI (OpenAI) and Google Workspace APIs for intelligent automation, aiming to enhance efficiency and customer engagement. The business vision is to provide a highly automated and scalable solution for service businesses, starting with Clean Machine Auto Detail.

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui and CSS variables for theming. It includes a hexagonal shield logo, visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, gamification elements, glass-morphism containers, Framer Motion animations, premium step indicators, and Google Voice-level polish on messaging. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring service management integrates with Google Calendar. Twilio Voice integration provides voicemail, missed call auto-SMS, comprehensive call logging, and PWA push notifications. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. Database performance is optimized with indexes and real-time WebSocket updates. Enhanced error handling includes toast messages and smart retry buttons. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, search, and offline drafts. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation allows customers to verify their location using Google Maps. A referral management system provides admin tools for code generation, tracking, and SMS invites. A graceful fallback mechanism is in place for Google Calendar API failures. All admin pages are modernized to a unified AppShell navigation. A comprehensive referral system with 9 reward types is implemented. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. An "Ask for Jody" VIP escalation system is present. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Phone system enhancements include caller ID passthrough, configurable notifications, and a Recent Callers widget. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts.

#### Industry-Specific AI & Messaging Bootstrap
An automated bootstrap system initializes new tenants with industry-specific AI behavior rules, SMS templates, and FAQ entries based on their selected industry during onboarding. This includes AI Behavior Rules, SMS Templates, and FAQ Entries stored in respective tables, ensuring multi-tenant isolation and idempotent upsert logic. It supports 17 industries, each with specific AI behavior rules, SMS templates, and FAQ entries.

#### Multi-Tenant Architecture
The platform utilizes a multi-tenant architecture with a `tenantConfig` table. An admin interface supports tenant CRUD operations and owner impersonation. A canonical voice entry-point provides standardized webhook handling for multi-tenant telephony, dynamically resolving tenants via a `tenantPhoneConfig` table, supporting per-tenant SIP configuration, fallback, and IVR modes. A Tenant Communication Routing Engine centralizes inbound communication routing for SMS, Voice, and IVR based on MessagingServiceSid, phone number, or fallback, ensuring proper tenant context. An AI Voice Concierge entry point provides provider-agnostic AI voice infrastructure.

#### Phone System Configuration
The system defines main business, direct business, and emergency alert phone numbers. Calls route through an IVR menu to an owner's cell, displaying the customer's actual number. Optional Twilio SIP integration allows custom ringtones with sequential fallback. An after-hours voicemail system activates 30 minutes after the last scheduled end time. Ring duration is configurable. A notification system allows configurable preferences for voicemail, cash payments, system errors, appointment reminders, and missed calls. A communication hub integrates recent callers, click-to-SMS, one-click callback, and automatic customer record creation.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI for keyword detection. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are integrated. Real-time chat monitoring allows for manual takeover. Technicians can update job status to 'on_site' with automatic customer SMS notifications. Admin referral management allows managers to generate unique referral codes, track statistics, and send invites. The platform supports plan tiers (starter/pro/elite/internal) with feature gating for AI SMS Agent, AI Voice Agent, and Campaigns. The system also includes advanced conversation management with AI-powered handback analysis and smart scheduling extraction, a weather risk assessment system for appointments, a multi-tenant loyalty bonus campaign system, and an AI agent system aware of these campaigns.

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
- **Twilio**: SMS notifications and voicemail transcription.
- **SendGrid**: Email delivery.
- **Slack**: Internal business notifications and alerts.
- **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
- **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
- **OpenAI API**: GPT-4o for chatbot intelligence, conversation handling, email content generation, and service recommendations.