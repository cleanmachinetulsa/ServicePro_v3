# Clean Machine Auto Detail - AI-Powered Business Assistant

## Overview
Clean Machine Auto Detail is an AI-powered web application designed to streamline operations for an auto detailing service. It provides a comprehensive solution for efficient business management and enhanced customer experience by integrating customer management, appointment scheduling, loyalty programs, payment processing, and multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs). The system leverages Google Workspace APIs for calendar, customer data, and photo management, while utilizing OpenAI for intelligent chatbot capabilities and Facebook Graph API for social media messaging. The project aims to achieve an 87% automation rate for business operations, significantly enhancing efficiency and customer engagement.

## User Preferences
- Preferred communication style: Simple, everyday language
- **AI Agent Behavior**: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## Recent Updates (November 2025)

### Smart Address Validation - Seamless Customer Experience
**Date: November 13, 2025**

**Feature**: Automatic address enhancement and normalization for smoother booking flow

**Problem Solved**: Customers were frustrated when entering addresses like "2710 South Hudson pl" failed validation, requiring multiple attempts to get the format just right.

**Solution Implemented**:
1. **Smart Preprocessing** (`server/googleMapsApi.ts`):
   - Automatically appends "Tulsa, OK" if city/state missing
   - Normalizes street abbreviations (pl→Pl, st→St, ave→Ave, etc.)
   - Biases Google Maps results to Tulsa, OK area
   - Customers can now just type street address without full formatting

2. **Better Error Messages** (`server/schedulingTools.ts`):
   - Shows what the system tried: "I tried '2710 South Hudson Pl, Tulsa, OK' but couldn't find it"
   - Clear guidance: "Please include your street number and name. You don't need to include 'Tulsa, OK' - I'll add that automatically!"
   - Reduces customer frustration and retry attempts

**Examples**:
- "2710 South Hudson pl" → Enhanced to "2710 South Hudson Pl, Tulsa, OK" ✅
- "123 main st" → Enhanced to "123 Main St, Tulsa, OK" ✅
- "456 Elm Avenue" → Enhanced to "456 Elm Ave, Tulsa, OK" ✅
- Full addresses with city/state work as before ✅

**Status**: ✅ Production ready - Tested and deployed

### Critical Bug Fixes - Production Ready
**Date: November 13, 2025**

**1. Service Photo Persistence Fix**
- **Issue**: Photos uploaded in Dashboard → Edit Services section were not saving to database
- **Root Cause**: UPSERT pattern required unique constraint on services.name, but production data had duplicates
- **Solution**: Changed to SELECT-then-UPDATE/INSERT pattern (no unique constraint needed)
- **Files Modified**: 
  - `shared/schema.ts` - Removed `.unique()` from services.name (line 177)
  - `server/services.ts` - Replaced UPSERT with SELECT-UPDATE/INSERT (lines 95-116)
  - `client/src/pages/dashboard.tsx` - Added response guards before .json() parsing (lines 1564, 1730)
- **Additional Fixes**: Changed durationHours from string '2.0' to numeric 2 for schema compatibility
- **Status**: ✅ Architect approved - Production ready

**2. Technician Page Scroll Fix**
- **Issue**: Bottom fields inaccessible on mobile/smaller screens
- **Solution**: Changed `overflow-hidden` to `overflow-y-auto`
- **File Modified**: `client/src/pages/technician.tsx` (line 231)
- **Status**: ✅ Architect approved - Production ready

**3. Quick Replies Dark Mode Fix**
- **Issue**: Quick reply text not visible in dark mode (white text on white background)
- **Solution**: Added `text-slate-900 dark:text-white` for proper contrast in both themes
- **File Modified**: `client/src/components/technician/CommunicationsPod.tsx` (line 180)
- **Status**: ✅ Architect approved - Production ready

**4. Camera Capture Enhancement + Security Fix**
- **Issue**: "Capture Photo" button only opened file picker, didn't access camera
- **Security Issue**: Customer PII (name, phone) sent unencrypted with photo uploads
- **Solution**: 
  - Added `capture="environment"` attribute to open camera on mobile devices
  - Added client-side validation (file type: JPEG/PNG/GIF, size: max 5MB)
  - **Removed customer PII from uploads** - now only sends photo + jobId
  - User-friendly error toasts for validation failures
- **File Modified**: `client/src/pages/technician.tsx` (lines 149-236)
- **Status**: ✅ Architect approved - Production ready (security vulnerability resolved)

### Technician Page - Mark On-Site Button Documentation
**Feature**: Quick Actions Footer - Mark On-Site Button

**Purpose**: Allows technicians to update job status to 'on_site' when they arrive at customer location.

**Location**: Fixed footer at bottom of Technician page with purple button labeled "Mark On-Site"

**How It Works**:
1. **Prerequisites**: A job must be selected from the job list
2. **Button Click**: Technician clicks purple "Mark On-Site" button
3. **Validation**: 
   - Checks if job is selected (shows error toast if not)
   - Checks if demo mode is active (disabled in demo mode)
4. **Status Update**: Calls `updateJobStatus('on_site')` to update job in database
5. **Confirmation**: Shows success toast "Status Updated - Marked as on-site"
6. **Error Handling**: Shows error toast if update fails

**User Flow**:
- Technician drives to customer location
- Opens Technician page on mobile device
- Selects active job from list
- Clicks "Mark On-Site" button when arriving
- System updates job status and shows confirmation
- Customer and business dashboard reflect updated status

**Technical Implementation**:
- Component: `QuickActionsFooter` (`client/src/components/technician/QuickActionsFooter.tsx`)
- Handler: `handleMarkOnSite` (`client/src/pages/technician.tsx` lines 94-125)
- API Endpoint: Updates job status via backend API
- Button disabled when no job selected or in demo mode
- Real-time WebSocket updates broadcast status changes to dashboard

**Code Location**: 
- UI Component: `client/src/components/technician/QuickActionsFooter.tsx` (lines 22-31)
- Click Handler: `client/src/pages/technician.tsx` (lines 94-125)

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