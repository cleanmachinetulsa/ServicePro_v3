# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It offers comprehensive business management and enhances customer experience through customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system integrates with Google Workspace APIs for calendar, customer data, and photo management, and utilizes OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging. The project aims to achieve an 87% automation rate for business operations, significantly enhancing efficiency and customer engagement.

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern 3-column layout with full mobile responsiveness, utilizing shadcn/ui for component-based architecture and CSS variables for theming. Branding includes a hexagonal shield logo and "CLEAN MACHINE" as the primary heading. Reusable components ensure consistent navigation. Key UI elements include visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, and enhanced message input with character counters. Gamification elements like canvas confetti and weather emoji icons enhance user interaction. Dashboard navigation uses an 8-tab sidebar structure, and top navigation features compact glass-effect buttons with translucent styling. Recent UI overhauls include glass-morphism containers, framer-motion animations, and premium step indicators in the scheduler, as well as Google Voice-level polish on the Messages page.

**Dashboard Modernization (Nov 2025)**: Premium glassmorphism redesign with AAA-quality visual polish matching LuminousConcierge homepage template. Features include frosted glass cards (`backdrop-blur-xl bg-white/10 border-white/20`), gradient text headings (`bg-clip-text text-transparent`), animated stat counters with Framer Motion staggered entrance effects, colorful gradient accent bars on appointment cards, enhanced calendar styling with semi-transparent gradients, smooth hover transitions, and mobile-responsive design. All existing functionality preserved 100% - no changes to props, handlers, or business logic.

**Investor-Ready Marketing Showcase** (/showcase): World-class marketing page with 9 sections (Hero, Feature Map, Flows, Automation Logic, Experience, Metrics, White-Label, FAQ) plus interactive Live Sandbox. Features include sticky navigation with IntersectionObserver, scroll-triggered animations (Framer Motion useInView), parallax mouse-tracking gradients, floating particles, keyboard navigation (arrow keys for feature tabs), typing animations in chat simulator (20ms/char), spring animations for timeline events, counter animations for metrics, reduced motion support, mobile hamburger menu with slide-out drawer, and comprehensive accessibility (ARIA labels, focus states, keyboard navigation). The sandbox includes 5 preset scenarios (Free Play, New Lead → Booking, Rain Reschedule, Follow-Up & Reviews, Upsell & Packages) with rule-based agent responses, automation timeline tracking, reset/copy functionality, and mobile-optimized layouts.

### Technical Implementations
The system includes production-ready message attachment capabilities with Google Drive integration, a TCPA/CTIA-compliant SMS consent system, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring services are managed with a flexible scheduling system and Google Calendar integration. Communication features include Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and production-ready PWA push notifications.

**PWA Enhancements (Nov 2025)**: Comprehensive Progressive Web App capabilities including (1) Advanced offline mode with cache-first strategy and offline queue for mutations, (2) App shortcuts for home screen quick actions (Today's Schedule, Send Invoice, New Message, Quick Booking), (3) Custom install experience with branded prompts and platform-specific instructions, (4) Badge notifications showing unread counts on app icon, (5) Background sync for automatic data updates when device comes online, (6) Web Share API integration for native sharing, (7) Persistent storage with IndexedDB for offline data caching and draft persistence, (8) Full-screen standalone mode with edge-to-edge design. Service worker v17 implements background sync registration (`SyncManager` API), badge API integration (`navigator.setAppBadge()`), and offline mutation queue with auto-flush. PwaContext provider manages offline detection, install prompts, and share functionality with proper capability checks. Security and compliance are handled through Twilio webhook signature verification, E.164 phone normalization, request validation, and role-based access control (RBAC) middleware with hierarchical permissions. Database performance is optimized with strategic indexes, and real-time WebSocket updates provide live monitoring. Enhanced error handling with toast messages and smart retry buttons improves user experience. An iMessage-quality messaging suite includes real-time read receipts, typing indicators, message reactions, conversation search/history, and offline drafts with localStorage auto-save. Service limits and maintenance mode provide configurable daily service capacity caps and catastrophic failure protection. A banner management system enables dynamic customer communications with multi-mode display, page targeting, dismissal tracking, priority ordering, and scheduled visibility windows. Auto-failover protection monitors critical/high errors with tiered thresholds and provides automatic SMS/email alerts with backup booking endpoints. A branded invoice email system delivers professional, mobile-responsive invoices with Clean Machine branding, loyalty points showcase, multi-payment CTAs, smart upsell recommendations, and HMAC-signed payment links. A centralized SMS template system allows for dynamic editing of automatic messages from the dashboard, supporting versioning, variable interpolation, and in-memory caching. Smart address validation enhances customer experience for booking flows. A referral management system provides admin tools for generating customer referral codes, tracking referrals, sending SMS invites, and viewing comprehensive statistics with QR code generation and secure customer lookup. A graceful fallback mechanism is implemented for Google Calendar API failures to ensure continuous booking availability. All admin pages are modernized to a unified AppShell navigation pattern. A comprehensive referral system with 9 reward types is implemented, including loyalty points, various discounts, service credits, gift cards, free add-ons, tier upgrades, priority booking, and milestone rewards, all with transaction safety and audit trails. A dual phone line switching system supports two phone numbers (+1-918-856-5304 Main Line, +1-918-856-5711 Owner Line) with Google Voice-style UI, localStorage persistence, phone line badges for SMS conversations, correct Twilio routing per line, and backward compatibility treating NULL phoneLineId as Main Line. An "Ask for Jody" VIP escalation system detects trigger phrases for priority customer handling. A QR Code Security System with military-grade HMAC-SHA256 tokens and Error Correction Level H is implemented for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service for tailored AI interactions. Phone system enhancements include caller ID passthrough, configurable notification preferences (SMS/Push), and a Recent Callers widget. Cash payment tracking requires manual amount entry and prominent daily deposit widgets.

#### Phone System Configuration
**Official Phone Number Definitions:**
1.  **Main Line: 918-856-5711** - Twilio business number for all customer communications, public-facing.
2.  **Owner Cell: BUSINESS_OWNER_PHONE (Replit Secret)** - Destination for forwarded calls, allows owner to save customer contacts.
3.  **Emergency Alert Number: 918-282-0103** - For critical system alerts ONLY (direct SMS to owner, not Twilio).

**Call Flow Architecture:**
Customer calls Main Line → IVR Menu (booking SMS or speak with someone) → Call forwards to Owner Cell → Caller ID shows customer's actual number.

**Caller ID Configuration:**
Twilio TwiML configured with `callerId="${callerNumber}"` ensures owner sees customer's real phone number for easy contact saving and custom ringtone setup.

**Custom Ringtone Setup:**
Owner saves customer to contacts and sets a custom ringtone in phone settings for recognizable business calls.

**Notification System:**
Configurable preferences via Dashboard → Settings → Notifications for Voicemail, Cash Payments, System Errors, Appointment Reminders, and Missed Calls (with optional auto-reply SMS).

**Communication Hub Integration:**
Recent Callers widget on Messages page, click-to-SMS, one-click callback, and automatic customer record creation from inbound calls.

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

**Integration Strategy Notes**:
- Google Calendar & Sheets: Using Replit OAuth connectors with auto-refreshing credentials.
- Twilio & SendGrid: Using manual secrets.