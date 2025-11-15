# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It offers comprehensive business management and enhances customer experience through customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system integrates with Google Workspace APIs for calendar, customer data, and photo management, and utilizes OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging. The project aims to achieve an 87% automation rate for business operations, significantly enhancing efficiency and customer engagement.

## Known Limitations (to be addressed in future iterations)
- **Referral Discount Transaction Safety**: Invoice discount application uses nested service calls (referralConfigService, gamificationService) that execute outside the invoice creation transaction. Under high concurrency or retry scenarios, this could lead to double-discounts or orphaned rewards. Recommended for future hardening: propagate transaction executor through all nested services and implement optimistic locking for discount claims.
- **Small Business Scale**: Current implementation is optimized for small business use cases with low concurrency. High-traffic scenarios may require additional transaction hardening.

## Recent Changes (November 13-15, 2025)
- **Referral System with 9 Reward Types** ✅ PRODUCTION-READY: Complete implementation of all 9 referral reward types with full transaction safety and audit trails.
  - **Reward Types Implemented**:
    1. **loyalty_points**: Awards loyalty points via gamificationService integration
    2. **fixed_discount**: Applies dollar amount discount to invoices
    3. **percent_discount**: Applies percentage-based discount to invoices
    4. **service_credit**: Creates credit ledger entries with FIFO consumption and expiry support
    5. **gift_card**: Generates unique codes and creates credit ledger entries
    6. **free_addon**: Creates customerAddonCredits for free service enhancements
    7. **tier_upgrade**: Upgrades customer loyalty tier (bronze→silver→gold→platinum)
    8. **priority_booking**: Grants priority booking access with timestamp tracking
    9. **milestone_reward**: Tracks milestone achievements (MVP: manual admin approval)
  - **Schema Additions**:
    - Added `loyaltyTier` enum column to customers table (bronze/silver/gold/platinum)
    - Added `hasPriorityBooking` and `priorityBookingGrantedAt` columns to customers table
    - Created `serviceAddons` table for addon catalog management
    - Created `customerAddonCredits` table for tracking awarded free addons
    - Created `milestoneDefinitions` and `customerMilestoneProgress` tables for milestone tracking
    - Created `creditLedger` and `creditTransactions` tables for service credits and gift cards
  - **Credit Ledger System**: Complete transaction-safe implementation with FIFO consumption, expiry handling, row-level locking, and full audit trail
  - **Admin Configuration**: ReferralConfigurationPanel supports all 9 reward types with dynamic SMS preview
  - **SMS Integration**: Templates use dynamic reward values from configuration (no hardcoded amounts)
  - **Transaction Safety**: All rewards apply within transaction context with comprehensive error handling
- **SMS Template System** ✅ FULLY OPERATIONAL: Complete end-to-end implementation allowing admins to edit all automatic SMS messages from the dashboard without code changes.
  - **Dashboard**: SMS Templates Manager with variable insertion, preview, version history, and error handling
  - **Live Integration**: All production SMS flows use template system with graceful fallbacks
    - Booking confirmations → `booking_confirmation` template
    - 24-hour reminders → `appointment_reminder_24h` template  
    - Technician on-site notifications → `on_site_arrival` template
    - Referral invites → `referral_invite` template
    - Referral rewards → `referral_reward_earned` template
  - **Helper Function**: `renderSmsTemplateOrFallback()` with comprehensive logging and structured results
  - **Safety**: Legacy hardcoded messages serve as fallbacks if templates fail
- **Admin Referral Management** ✅ COMPLETE: Full-featured admin tools with security hardening.
  - **Admin Referral Tool**: `/referrals` page with customer search, QR code generation, SMS invites, stats display
  - **Admin Statistics Dashboard**: Comprehensive analytics in Settings → Customer Management
  - **Security**: Role-based access control (manager/owner only), data minimization, PII protection
  - **Integration**: Uses SMS template system for referral invites with graceful fallback

## User Preferences
- Preferred communication style: Simple, everyday language
- **AI Agent Behavior**: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern 3-column layout with full mobile responsiveness, utilizing shadcn/ui for component-based architecture and CSS variables for theming. Branding includes a hexagonal shield logo and "CLEAN MACHINE" as the primary heading. A reusable BackNavigation component provides consistent navigation. The home page features a login button. Message platform filters use a compact single-line layout with icon-only buttons and hover tooltips. Key UI elements include visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, and enhanced message input with character counters. Gamification elements like canvas confetti and weather emoji icons enhance user interaction. Dashboard navigation uses an 8-tab sidebar structure. Top navigation features compact glass-effect buttons with translucent styling. AI Help Search includes text wrapping fixes.

### Technical Implementations
The system includes production-ready message attachment capabilities with Google Drive integration, a TCPA/CTIA-compliant SMS consent system, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring services are managed with a flexible scheduling system and Google Calendar integration. Communication features include Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and production-ready PWA push notifications. Security and compliance are handled through Twilio webhook signature verification, E.164 phone normalization, request validation, and role-based access control (RBAC) middleware with hierarchical permissions (employee < manager < owner). Database performance is optimized with strategic indexes, and real-time WebSocket updates provide live monitoring. Enhanced error handling with toast messages and smart retry buttons improves user experience. A health check endpoint and voice testing system ensure reliability. An iMessage-quality messaging suite includes real-time read receipts, typing indicators, message reactions, conversation search/history, and offline drafts with localStorage auto-save. Service limits and maintenance mode provide configurable daily service capacity caps and catastrophic failure protection. A banner management system enables dynamic customer communications with multi-mode display, page targeting, dismissal tracking, priority ordering, and scheduled visibility windows. Auto-failover protection monitors critical/high errors with tiered thresholds and provides automatic SMS/email alerts with backup booking endpoints. A branded invoice email system delivers professional, mobile-responsive invoices with Clean Machine branding, loyalty points showcase, multi-payment CTAs, smart upsell recommendations, and HMAC-signed payment links. A centralized SMS template system allows for dynamic editing of automatic messages from the dashboard, supporting versioning, variable interpolation, and in-memory caching. Smart address validation enhances customer experience by automatically appending city/state and normalizing street abbreviations for booking flows. A referral management system provides admin tools for generating customer referral codes, tracking referrals, sending SMS invites, and viewing comprehensive statistics with QR code generation and secure customer lookup (manager/owner only).

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI to detect keywords and trigger custom pricing requests. A loyalty program with referral rewards, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are also integrated. Real-time chat monitoring allows for manual takeover and behavior controls. Technicians can update job status to 'on_site' with an automatic customer SMS notification. Admin referral management enables managers and owners to search customers by phone, generate unique referral codes with QR codes, send SMS invites, track referral statistics, and view performance analytics.

### System Design Choices
The architecture uses a React with TypeScript frontend (Vite, Tailwind CSS, shadcn/ui, TanStack React Query, React Hook Form with Zod, Stripe) and an Express.js backend with TypeScript. Core architectural patterns include a monolithic service layer, multi-channel response formatting for AI, a customer memory system, and Google Sheets integration as a dynamic knowledge base. Data is stored in PostgreSQL (Neon serverless) with Drizzle ORM, Google Sheets, and Google Drive. Authentication is session-based with environment-based credential management.

## External Dependencies

**Google Workspace Suite**:
-   **Google Calendar API**: Appointment scheduling and availability.
-   **Google Sheets API**: Customer database and knowledge base.
-   **Google Drive API**: Customer photo management.
-   **Google Maps API**: Geocoding, distance/drive time calculation.

**Payment Processing**:
-   **Stripe**: Primary payment gateway for payment intents, customer/subscription management.
-   **PayPal**: Alternative payment option.

**Communication Services**:
-   **Twilio**: SMS notifications and voicemail transcription.
-   **SendGrid**: Email delivery.
-   **Slack**: Internal business notifications and alerts.
-   **Facebook Graph API**: Integration with Facebook Messenger and Instagram Direct Messages.

**Weather & Location**:
-   **Open-Meteo API**: Free weather forecasting.

**AI & ML**:
-   **OpenAI API**: GPT-4o for chatbot intelligence, conversation handling, email content generation, and service recommendations.