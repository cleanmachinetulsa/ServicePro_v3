# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It offers comprehensive business management and enhances customer experience through customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system integrates with Google Workspace APIs for calendar, customer data, and photo management, and utilizes OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging. The project aims to achieve an 87% automation rate for business operations, significantly enhancing efficiency and customer engagement.

## Recent Changes (November 15, 2025)
- **Phase 8-9 Progress**: Voicemail system fully wired with transcription, playback, and notifications. Messages page received Google Voice-level polish with glass-card styling, gradients, and backdrop blur effects.
- **Critical Fixes**: Fixed white page at `/phone` route (conditional rendering issue), fixed "All Lines" filter query blocking on Messages page
- **UI/UX Polish**: Added global animation layer (fadeIn, slideIn), enhanced phone line switcher with modern gradients, polished empty states
- **New Build Plan Phases**: Added Phases 12-15 for settings consolidation and communications hub enhancements (bulk actions, AI features, analytics)

## User Preferences
- Preferred communication style: Simple, everyday language
- **AI Agent Behavior**: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern 3-column layout with full mobile responsiveness, utilizing shadcn/ui for component-based architecture and CSS variables for theming. Branding includes a hexagonal shield logo and "CLEAN MACHINE" as the primary heading. Reusable components ensure consistent navigation. Key UI elements include visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, and enhanced message input with character counters. Gamification elements like canvas confetti and weather emoji icons enhance user interaction. Dashboard navigation uses an 8-tab sidebar structure, and top navigation features compact glass-effect buttons with translucent styling.

### Technical Implementations
The system includes production-ready message attachment capabilities with Google Drive integration, a TCPA/CTIA-compliant SMS consent system, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring services are managed with a flexible scheduling system and Google Calendar integration. Communication features include Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and production-ready PWA push notifications. Security and compliance are handled through Twilio webhook signature verification, E.164 phone normalization, request validation, and role-based access control (RBAC) middleware with hierarchical permissions. Database performance is optimized with strategic indexes, and real-time WebSocket updates provide live monitoring. Enhanced error handling with toast messages and smart retry buttons improves user experience. An iMessage-quality messaging suite includes real-time read receipts, typing indicators, message reactions, conversation search/history, and offline drafts with localStorage auto-save. Service limits and maintenance mode provide configurable daily service capacity caps and catastrophic failure protection. A banner management system enables dynamic customer communications with multi-mode display, page targeting, dismissal tracking, priority ordering, and scheduled visibility windows. Auto-failover protection monitors critical/high errors with tiered thresholds and provides automatic SMS/email alerts with backup booking endpoints. A branded invoice email system delivers professional, mobile-responsive invoices with Clean Machine branding, loyalty points showcase, multi-payment CTAs, smart upsell recommendations, and HMAC-signed payment links. A centralized SMS template system allows for dynamic editing of automatic messages from the dashboard, supporting versioning, variable interpolation, and in-memory caching. Smart address validation enhances customer experience for booking flows. A referral management system provides admin tools for generating customer referral codes, tracking referrals, sending SMS invites, and viewing comprehensive statistics with QR code generation and secure customer lookup. A graceful fallback mechanism is implemented for Google Calendar API failures to ensure continuous booking availability. All admin pages are modernized to a unified AppShell navigation pattern. A comprehensive referral system with 9 reward types is implemented, including loyalty points, various discounts, service credits, gift cards, free add-ons, tier upgrades, priority booking, and milestone rewards, all with transaction safety and audit trails. A dual phone line switching system supports two phone numbers (+1-918-856-5304 Main Line, +1-918-856-5711 Owner Line) with Google Voice-style UI, localStorage persistence, phone line badges for SMS conversations, correct Twilio routing per line, and backward compatibility treating NULL phoneLineId as Main Line. Integration strategy uses Replit OAuth connectors for Google Calendar and Google Sheets (auto-refreshing credentials), manual secrets for Twilio and SendGrid (existing setup working, user preference).

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI to detect keywords and trigger custom pricing requests. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are also integrated. Real-time chat monitoring allows for manual takeover and behavior controls. Technicians can update job status to 'on_site' with an automatic customer SMS notification. Admin referral management enables managers and owners to search customers by phone, generate unique referral codes with QR codes, send SMS invites, track referral statistics, and view performance analytics.

### System Design Choices
The architecture uses a React with TypeScript frontend (Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Hook Form with Zod, Stripe) and an Express.js backend with TypeScript. Core architectural patterns include a monolithic service layer, multi-channel response formatting for AI, a customer memory system, and Google Sheets integration as a dynamic knowledge base. Data is stored in PostgreSQL (Neon serverless) with Drizzle ORM, Google Sheets, and Google Drive. Authentication is session-based with environment-based credential management.

## External Dependencies

**Google Workspace Suite**:
-   **Google Calendar API**: Appointment scheduling and availability. (Using Replit OAuth connector for auto-refreshing credentials)
-   **Google Sheets API**: Customer database and knowledge base. (Using Replit OAuth connector for auto-refreshing credentials)
-   **Google Drive API**: Customer photo management.
-   **Google Maps API**: Geocoding, distance/drive time calculation.

**Payment Processing**:
-   **Stripe**: Primary payment gateway for payment intents, customer/subscription management.
-   **PayPal**: Alternative payment option.

**Communication Services**:
-   **Twilio**: SMS notifications and voicemail transcription. (Using manual secrets - user preference, existing setup working)
-   **SendGrid**: Email delivery. (Using manual secrets - user preference, existing setup working)
-   **Slack**: Internal business notifications and alerts.
-   **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
-   **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
-   **OpenAI API**: GPT-4o for chatbot intelligence, conversation handling, email content generation, and service recommendations.

**Integration Strategy Notes**:
- Google Calendar & Sheets: Using Replit OAuth connectors with auto-refreshing credentials
- Twilio & SendGrid: Using manual secrets (user dismissed Twilio connector, prefers current working setup)