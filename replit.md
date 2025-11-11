# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It provides a comprehensive solution for efficient business management and enhanced customer experience by integrating customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system leverages Google Workspace APIs for calendar, customer data, and photo management, while utilizing OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging.

## Recent Updates (November 11, 2025)
**Investor-Grade Showcase Page:**
- Rebuilt `/showcase` page as high-tech investor presentation with interactive elements and animations
- Added Framer Motion animations: floating particles, gradient transitions, hover effects, auto-rotating AI flow
- Implemented Recharts data visualizations: area charts, bar charts, pie charts, line charts for metrics
- Created interactive ROI calculator with live sliders (Monthly Appointments, Average Ticket Size) driving 6-month revenue projection charts
- Fixed ROI calculator to wire both sliders into all downstream calculations for accurate investor projections
- Fixed dynamic Tailwind classes in value drivers section using static colorMap for reliable rendering
- Resolved LineChart import collision with Recharts components (renamed to RechartsLine)
- Added market opportunity section ($826B TAM) with pie chart visualization
- Built competitive advantage matrix with feature comparison table
- Documented EVERY feature with specific capabilities (not generic descriptions)
- Included 7 comprehensive feature showcases: Smart Schedule, Multi-Channel Messaging, iMessage-Quality Features, AI Engine, Payment System, Security, Banner Management, Customer Management
- Added pricing tiers (Starter/Professional/Enterprise) with white-label solution details
- Implemented animated statistics counters, live performance metrics, security threat dashboard
- Created technical architecture section with tech stack breakdown, database schema, API endpoints
- Added use case examples for 4 industries (Auto Detail, Home Services, Healthcare, Professional Services)
- Implemented value drivers section with color-coded impact metrics (6 key business drivers)
- All designed for investors and white-label ServicePro clients
- Architect-approved: Page meets investor-grade standards with working interactivity and compelling value proposition

**Google OAuth & Authentication:**
- Added Google OAuth as additional login option (preserves existing username/password, 2FA, WebAuthn)
- Implemented security-first design: new Google OAuth users default to INACTIVE status requiring admin approval
- Fixed critical race condition in session cleanup to prevent unauthorized access
- Premium tactile button animations added globally (hover lift, press scale, ripple effects)
- Fixed 401 auth errors on public pages by preventing unnecessary user queries

**Git Authentication:**
- Using manual GitHub Personal Access Token (stored in GITHUB_PERSONAL_ACCESS_TOKEN secret) for git push/pull operations
- Replit's GitHub connector integration unavailable, using secure token-based authentication instead
- Git credential helper configured with token stored in ~/.git-credentials
- Updated .gitignore to exclude large archive files (*.tar.gz, *.gz, *.zip, etc.)
- Created fresh git history using orphan branch strategy to remove large files from repository history
- Successfully pushed all code to GitHub repository: cleanmachinetulsa/CleanMachineAppOfficial

**Pricing Data Architecture Improvements:**
- Fixed knowledge base to recognize "Add-On Service" column header variant ensuring accurate service names in webchat AI responses
- Separated service descriptions into `overview` (short) and `detailedDescription` (comprehensive) fields for better UI/UX
- Restructured Google Sheets "Add-Ons" tab with new columns: Add-On Service, Price, Overview, Detailed Description
- Populated all 9 add-on services with professional 100+ word detailed descriptions
- Both main services and add-ons now use consistent expandable details UI pattern via ExpandableServiceDetails component
- API endpoints (/api/services, /api/addon-services) return separate overview and detailedDescription fields while maintaining backwards compatibility with legacy description field

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing Configuration
**Automated E2E Testing Credentials**: TEST_USERNAME and TEST_PASSWORD environment secrets are configured for automated testing to avoid authentication issues during E2E tests.

## System Architecture

### UI/UX Decisions
The application features a modern 3-column layout with full mobile responsiveness, utilizing shadcn/ui for component-based architecture and CSS variables for theming. **Prominent Clean Machine branding** uses a hexagonal shield logo (60-70px on mobile, 70-80px on desktop) displayed in both Messages and Dashboard headers with "CLEAN MACHINE" as the primary heading and page-specific subtitles. A **reusable BackNavigation component** provides consistent navigation across all secondary pages with smart browser history detection and fallback routing. The **home page features a login button** in the top right corner for quick dashboard access. **Message platform filters** use a compact single-line layout with icon-only buttons and hover tooltips for improved visual clarity. Key UI elements include visual channel indicators, gradient backgrounds, numbered buttons for AI suggestions, confidence badges, hover effects, fixed text wrapping, and enhanced message input with character counters. Gamification elements like canvas confetti and weather emoji icons with tooltips on calendar days enhance user interaction. **Dashboard navigation** uses an 8-tab sidebar structure with Technician and Security as first-class tabs (Dashboard, Customers, Messages, Gallery, Analytics, Technician, Security, Settings) for enterprise UX patterns. **Top navigation features compact glass-effect buttons** with translucent styling (h-9 sizing, responsive text visibility, border-white/10 bg-white/15 hover:bg-white/25) for professional appearance and space efficiency. **AI Help Search** includes text wrapping fixes (min-w-0, line-clamp-2) to prevent description overflow in dropdown results.

### Technical Implementations
The system includes production-ready message attachment capabilities with Google Drive integration, a TCPA/CTIA-compliant SMS consent system, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring services are managed with a flexible scheduling system and Google Calendar integration. Communication features include Twilio Voice integration with voicemail and missed call auto-SMS, comprehensive call logging, and production-ready PWA push notifications. Security and compliance are handled through Twilio webhook signature verification, E.164 phone normalization, and request validation. Database performance is optimized with strategic indexes, and real-time WebSocket updates provide live monitoring. Enhanced error handling with toast messages and smart retry buttons improves user experience. A health check endpoint and voice testing system ensure reliability and pre-port validation. **iMessage-quality messaging suite** includes real-time read receipts, typing indicators, message reactions (emoji), conversation search/history, and offline drafts with localStorage auto-save and conversation isolation using delayed guard activation to prevent draft leakage. **Service limits and maintenance mode** provide configurable daily service capacity caps and catastrophic failure protection with auto-failover, backup contact forwarding, and custom maintenance messages. **Banner management system** enables dynamic customer communications with multi-mode display (top bar, modal, floating), page targeting, dismissal tracking, priority ordering, and scheduled visibility windows. **Auto-failover protection** monitors critical/high errors with tiered thresholds (5 critical or 8 high errors trigger failover), 15-minute cooldown periods, duplicate suppression, and automatic SMS/email alerts to business owner with backup booking endpoint for downtime resilience. **Branded invoice email system** delivers professional, mobile-responsive invoices with Clean Machine hexagonal shield branding, zebra-striped invoice tables, golden loyalty points showcase, multi-payment CTAs (Stripe/Venmo/CashApp/PayPal), smart upsell recommendations (Maintenance Detail Program), and HMAC-signed payment links with 7-day TTL and DoS protection. Dual invoice senders support both database-backed (server/invoiceService.ts with auto-generated INV-{year}-{id} numbers, customer loyalty points balance, and vehicle info from appointments) and dashboard quick-send (server/dashboardApi.ts with temporary invoice numbers and manual data entry). Email client compatibility ensures beautiful rendering in Gmail, Outlook, and Apple Mail with plain-text accessibility versions.

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