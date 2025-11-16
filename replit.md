# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It offers comprehensive business management and enhances customer experience through customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system integrates with Google Workspace APIs for calendar, customer data, and photo management, and utilizes OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging. The project aims to achieve an 87% automation rate for business operations, significantly enhancing efficiency and customer engagement.

## Recent Changes (November 16, 2025)
- **Phone System Overhaul Complete** ✅: Implemented caller ID passthrough (customer's number shown, not business line), configurable notification preferences (SMS/Push toggles), voicemail push notifications, Recent Callers widget for easy callback, custom ringtone setup instructions
- **Cash Payment Enhancement** ✅: Technician payment modal now requires manual amount entry (prevents errors), prominent daily deposit widget shows end-of-day expected totals, dashboard widgets show pending deposits grouped by technician
- **Terminology Standardization** ✅: Defined official phone number terms (Main Line, Owner Cell, Emergency Alert Number), updated all UI and documentation for consistency
- **Notification Preferences** ✅: Built comprehensive settings UI allowing users to configure SMS vs Push for each alert type (voicemail, cash payments, system errors), reduces SMS usage once system stable

## Previous Changes (November 15, 2025)
- **Phase 10 Complete** ✅: Database verification completed with 84 tables synchronized. Comprehensive E2E testing confirmed database functionality across Messages, Analytics, Customer Database, and Dashboard pages. All pages render successfully with proper RBAC enforcement.
- **Test Infrastructure**: Created admin/admin123 (owner role) and testuser/test123 (employee role) for testing. Login and session management verified working.
- **Known Issue Identified**: Google Calendar OAuth credentials need renewal (JWT signature invalid). Dashboard gracefully handles this by showing zeros instead of crashing - proves robust error handling working correctly.
- **Phase 8-9 Complete** ✅: Voicemail system fully wired with transcription, playback, and notifications. Messages page received Google Voice-level polish with glass-card styling, gradients, and backdrop blur effects.
- **Critical Fixes**: Fixed white page at `/phone` route (conditional rendering issue), fixed "All Lines" filter query blocking on Messages page
- **UI/UX Polish**: Added global animation layer (fadeIn, slideIn), enhanced phone line switcher with modern gradients, polished empty states
- **Build Progress**: Phases 1-10 complete (63%). Ready for Phase 11 (E2E Testing of core business flows).

## User Preferences
- Preferred communication style: Simple, everyday language
- **AI Agent Behavior**: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern 3-column layout with full mobile responsiveness, utilizing shadcn/ui for component-based architecture and CSS variables for theming. Branding includes a hexagonal shield logo and "CLEAN MACHINE" as the primary heading. Reusable components ensure consistent navigation. Key UI elements include visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, and enhanced message input with character counters. Gamification elements like canvas confetti and weather emoji icons enhance user interaction. Dashboard navigation uses an 8-tab sidebar structure, and top navigation features compact glass-effect buttons with translucent styling.

### Technical Implementations
The system includes production-ready message attachment capabilities with Google Drive integration, a TCPA/CTIA-compliant SMS consent system, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring services are managed with a flexible scheduling system and Google Calendar integration. Communication features include Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and production-ready PWA push notifications. Security and compliance are handled through Twilio webhook signature verification, E.164 phone normalization, request validation, and role-based access control (RBAC) middleware with hierarchical permissions. Database performance is optimized with strategic indexes, and real-time WebSocket updates provide live monitoring. Enhanced error handling with toast messages and smart retry buttons improves user experience. An iMessage-quality messaging suite includes real-time read receipts, typing indicators, message reactions, conversation search/history, and offline drafts with localStorage auto-save. Service limits and maintenance mode provide configurable daily service capacity caps and catastrophic failure protection. A banner management system enables dynamic customer communications with multi-mode display, page targeting, dismissal tracking, priority ordering, and scheduled visibility windows. Auto-failover protection monitors critical/high errors with tiered thresholds and provides automatic SMS/email alerts with backup booking endpoints. A branded invoice email system delivers professional, mobile-responsive invoices with Clean Machine branding, loyalty points showcase, multi-payment CTAs, smart upsell recommendations, and HMAC-signed payment links. A centralized SMS template system allows for dynamic editing of automatic messages from the dashboard, supporting versioning, variable interpolation, and in-memory caching. Smart address validation enhances customer experience for booking flows. A referral management system provides admin tools for generating customer referral codes, tracking referrals, sending SMS invites, and viewing comprehensive statistics with QR code generation and secure customer lookup. A graceful fallback mechanism is implemented for Google Calendar API failures to ensure continuous booking availability. All admin pages are modernized to a unified AppShell navigation pattern. A comprehensive referral system with 9 reward types is implemented, including loyalty points, various discounts, service credits, gift cards, free add-ons, tier upgrades, priority booking, and milestone rewards, all with transaction safety and audit trails. A dual phone line switching system supports two phone numbers (+1-918-856-5304 Main Line, +1-918-856-5711 Owner Line) with Google Voice-style UI, localStorage persistence, phone line badges for SMS conversations, correct Twilio routing per line, and backward compatibility treating NULL phoneLineId as Main Line. Integration strategy uses Replit OAuth connectors for Google Calendar and Google Sheets (auto-refreshing credentials), manual secrets for Twilio and SendGrid (existing setup working, user preference).

#### Phone System Configuration

**Official Phone Number Definitions:**

1. **Main Line: 918-856-5711**
   - Twilio business number for all customer communications
   - Customer-facing number for booking, support, and inquiries
   - Handles incoming calls via IVR menu
   - All customer SMS conversations route through this number
   - Public-facing number displayed on website and marketing

2. **Owner Cell: BUSINESS_OWNER_PHONE (Replit Secret)**
   - Destination number where business calls forward to
   - User's personal mobile phone (in production)
   - Set via Replit Secrets for security and easy updates
   - During testing: may be set to test number
   - Receives calls with customer's actual number as Caller ID
   - Allows owner to save customer contacts and set custom ringtones

3. **Emergency Alert Number: 918-282-0103**
   - User's personal cell number for URGENT system alerts ONLY
   - NOT used for business call forwarding
   - NOT a Twilio number - direct SMS to owner
   - Receives critical monitoring alerts (website down, API failures)
   - Used by critical error monitoring system
   - Should receive minimal notifications (emergencies only)

**Call Flow Architecture:**
```
Customer → Main Line (918-856-5711)
            ↓
        IVR Menu:
        - Press 1: Receive booking SMS
        - Press 2: Speak with someone
            ↓
   Call forwards to Owner Cell (BUSINESS_OWNER_PHONE)
            ↓
   Caller ID shows: Customer's actual phone number
            ↓
   Owner answers, saves contact, sets custom ringtone
```

**Caller ID Configuration:**
- Twilio TwiML configured with `callerId="${callerNumber}"` for passthrough
- Owner sees customer's real phone number (not Main Line)
- Enables easy contact saving and custom ringtone setup
- Facilitates callback through Communication Hub
- No additional apps or PWA required

**Custom Ringtone Setup:**
Since native phone app is used (most reliable):
1. Customer calls → Owner sees their actual number
2. Save customer to phone contacts
3. Set custom ringtone in phone settings (iPhone: Contacts → Edit → Ringtone, Android: Contacts → Menu → Set ringtone)
4. Future calls from business customers = recognizable ringtone
5. Spam calls = default ringtone = ignored

**Notification System:**
Fully configurable notification preferences via Dashboard → Settings → Notifications:
- **Voicemail**: SMS and/or Push when customer leaves voicemail
- **Cash Payments**: SMS and/or Push when technician collects cash/check
- **System Errors**: SMS and/or Push for critical system failures
- **Appointment Reminders**: Push notifications for upcoming appointments
- **Missed Calls**: Optional auto-reply SMS to customer (default: enabled)

Users can toggle each notification type independently to reduce SMS usage once system is stable.

**Communication Hub Integration:**
- Recent Callers widget in Messages page shows last 20 incoming calls
- Click customer to open SMS conversation
- One-click callback via Messages interface
- Automatic customer record creation from inbound calls
- Seamless integration between phone and messaging systems

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