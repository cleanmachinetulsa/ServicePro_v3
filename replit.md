# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It provides a comprehensive solution for efficient business management and enhanced customer experience by integrating customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system leverages Google Workspace APIs for calendar, customer data, and photo management, while utilizing OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging. The project aims to achieve an 87% automation rate for business operations, significantly enhancing efficiency and customer engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a modern 3-column layout with full mobile responsiveness, utilizing shadcn/ui for component-based architecture and CSS variables for theming. Prominent Clean Machine branding uses a hexagonal shield logo displayed in both Messages and Dashboard headers with "CLEAN MACHINE" as the primary heading. A reusable BackNavigation component provides consistent navigation. The home page features a login button. Message platform filters use a compact single-line layout with icon-only buttons and hover tooltips. Key UI elements include visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, and enhanced message input with character counters. Gamification elements like canvas confetti and weather emoji icons enhance user interaction. Dashboard navigation uses an 8-tab sidebar structure (Dashboard, Customers, Messages, Gallery, Analytics, Technician, Security, Settings). Top navigation features compact glass-effect buttons with translucent styling. AI Help Search includes text wrapping fixes to prevent description overflow.

### Technical Implementations
The system includes production-ready message attachment capabilities with Google Drive integration, a TCPA/CTIA-compliant SMS consent system, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring services are managed with a flexible scheduling system and Google Calendar integration. Communication features include Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and production-ready PWA push notifications. Security and compliance are handled through Twilio webhook signature verification, E.164 phone normalization, and request validation. Database performance is optimized with strategic indexes, and real-time WebSocket updates provide live monitoring. Enhanced error handling with toast messages and smart retry buttons improves user experience. A health check endpoint and voice testing system ensure reliability. iMessage-quality messaging suite includes real-time read receipts, typing indicators, message reactions, conversation search/history, and offline drafts with localStorage auto-save. Service limits and maintenance mode provide configurable daily service capacity caps and catastrophic failure protection. A banner management system enables dynamic customer communications with multi-mode display, page targeting, dismissal tracking, priority ordering, and scheduled visibility windows. Auto-failover protection monitors critical/high errors with tiered thresholds and provides automatic SMS/email alerts with backup booking endpoints. A branded invoice email system delivers professional, mobile-responsive invoices with Clean Machine branding, loyalty points showcase, multi-payment CTAs, smart upsell recommendations, and HMAC-signed payment links.

### Feature Specifications
Key features include multi-platform messaging (Facebook Messenger, Instagram DMs), real-time SMS delivery monitoring, and an AI-powered chatbot (GPT-4o) for conversational AI, intent detection, and service recommendations. A quote-first workflow for specialty jobs uses AI to detect keywords and trigger custom pricing requests. A loyalty program, appointment scheduling with weather checking and conflict detection, an upselling system with context-aware offers, and email marketing capabilities are also integrated. Real-time chat monitoring allows for manual takeover and behavior controls.

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