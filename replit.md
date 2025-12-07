# Clean Machine Auto Detail / ServicePro Platform

## Overview
ServicePro is a multi-tenant, white-label SaaS platform designed to transform service businesses into AI-powered web applications. It offers comprehensive management for customers, appointments, loyalty programs, and payments, integrating multi-channel communication (SMS, web chat, email, Facebook Messenger, Instagram DMs) and leveraging AI (OpenAI) and Google Workspace APIs for intelligent automation. The platform aims to enhance efficiency and customer engagement, with a strategic vision to become "The Shopify of service businesses."

## User Preferences
- Preferred communication style: Simple, everyday language
- AI Agent Behavior: Keep customer conversations focused on auto detailing topics and services. Steer discussions away from irrelevant topics back to Clean Machine Auto Detail services, scheduling, and business-related inquiries.

## System Architecture

### UI/UX Decisions
The application features a modern, mobile-responsive 3-column layout built with shadcn/ui, including a hexagonal shield logo, visual channel indicators, gradient backgrounds, and gamification elements. PWA enhancements provide branded install prompts, app shortcuts, badge notifications, and offline mode. The public website features a glassmorphism design with gradients, animations, industry-specific content, and mobile responsiveness.

### Technical Implementations
The system supports production-ready message attachments with Google Drive, TCPA/CTIA-compliant SMS consent, and AI-powered features for damage assessment, scheduling, and message rephrasing using GPT-4o. Recurring service management integrates with Google Calendar. Twilio Voice integration provides voicemail, missed call auto-SMS, and comprehensive call logging. Security is enforced through Twilio webhook verification, E.164 normalization, request validation, and RBAC middleware. An iMessage-quality messaging suite offers read receipts, typing indicators, reactions, and search. The platform includes service limits, maintenance mode, dynamic banner management, and auto-failover protection. A branded invoice email system offers professional, mobile-responsive invoices with upsell recommendations and HMAC-signed payment links. A centralized SMS template system allows dynamic editing with versioning and variable interpolation. Smart address validation with interactive map confirmation uses Google Maps. A comprehensive referral system with 9 reward types is implemented, including admin tools for code generation, tracking, and SMS invites. A dual phone line switching system supports two numbers with Google Voice-style UI and Twilio routing. A QR Code Security System with HMAC-SHA256 tokens is used for secure customer identification. Customer intelligence includes returning customer tracking and a GPT personalization service. Cash payment tracking includes manual entry and daily deposit widgets. A customizable dashboard system with drag-and-drop widgets is implemented for personalized user layouts.

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

## INT-3: Phone History Import Engine

### Overview
The Phone History Import Engine allows tenant owners to import customer data, conversations, and messages from external phone history exports. This uses a standardized ZIP bundle format generated by an external "Phone History Parser" tool.

### Location
- **Admin Page**: `/admin/import-history`
- **Navigation**: Multi-Tenant Management → Data Import (Owner badge, advanced mode only)

### Bundle Format
The ZIP file should contain standardized CSV or JSON files:
- **customers.csv/json**: name, phone (E.164 format), email, address, vehicleInfo, notes
- **messages.csv/json**: phone, body, timestamp, direction (inbound/outbound), channel
- **conversations.csv/json** (optional): phone, platform

### API Endpoints
- **POST /api/admin/import-history/upload**: Upload ZIP bundle (multipart/form-data)
- **GET /api/admin/import-history/latest**: Get most recent import status
- **GET /api/admin/import-history/history**: Get import history

### Key Files
- `server/services/phoneHistoryImportService.ts`: Core import logic
- `server/routes.importHistory.ts`: API routes
- `client/src/pages/AdminImportHistory.tsx`: Admin UI
- `shared/schema.ts`: phoneHistoryImports table schema

### Import Behavior
- Customers are keyed by phone number (and/or email) - duplicates are updated, not created
- Conversations are auto-created per phone if not provided
- Messages are deduplicated by (phone, timestamp, direction, body)
- All imports are tenant-scoped via session context

## INT-4: Migration Wizard (Phone History)

### Overview
A guided 4-step wizard UI built on top of the INT-3 import engine, designed to help non-technical users easily migrate their old phone data into ServicePro.

### Location
- **Admin Page**: `/admin/migration-wizard`
- **Navigation**: Multi-Tenant Management → Migration Wizard (Owner badge, advanced mode only)
- **Cross-link**: Button on `/admin/import-history` to access the wizard

### Wizard Steps
1. **Prepare** - Explains how to export phone data, use the Parser Tool, and download the ServicePro Bundle ZIP
2. **Upload** - Drag & drop file upload with detection checklist (customers, conversations, messages)
3. **Review** - Summary of imported data with stats and any errors
4. **Finish** - Success message with links to Messages and Customers pages

### Design
- Glassmorphism/gradient card design matching the Setup Wizard
- Dark theme with blue/purple gradients
- Animated step transitions using Framer Motion
- Mobile-responsive layout

### Key Files
- `client/src/pages/AdminMigrationWizard.tsx`: Wizard UI component
- `client/src/pages/AdminImportHistory.tsx`: Contains cross-link to wizard
- `client/src/config/navigationItems.ts`: Navigation entry

### API Integration
Uses the same endpoints as INT-3:
- POST `/api/admin/import-history/upload` - Upload ZIP bundle
- GET `/api/admin/import-history/latest` - Get import status (with polling during processing)

## INT-5: Parser Tool Hook (Phase 1)

### Overview
A minimal, secure API hook that allows future server-to-server automation between an external Parser Tool and ServicePro. This prepares the integration point without changing user flows yet.

### Purpose
In the future, the external Parser Tool can send a pre-signed URL or token to ServicePro, allowing automated data import without manual user uploads.

### Database Schema
Extended `phone_history_imports` table with:
- **source**: Enum (`'manual_upload'` | `'parser_tool'`) - defaults to `'manual_upload'`
- **remoteBundleUrl**: Text (nullable) - URL for the parser tool to push results
- **externalJobId**: Text (nullable) - External parser job identifier

### API Endpoint
- **POST /api/import-history/parser-hook**
  - Protected via `x-parser-secret` header (reads from `PARSER_TOOL_SHARED_SECRET` env var)
  - Currently only allows `root` tenant (Clean Machine) in v1
  - Creates a pending import job with `source = 'parser_tool'`

### Request Body
```json
{
  "tenantExternalId": "root",
  "remoteBundleUrl": "https://example.com/bundle.zip",
  "externalJobId": "job-12345" // optional
}
```

### Environment Variables
- **PARSER_TOOL_SHARED_SECRET**: Required for authenticating parser tool requests

### Admin UI
On `/admin/import-history`, a purple notice appears for imports with `source = 'parser_tool'`:
> "This import came from the Parser Tool (job #...)"

### Key Files
- `shared/schema.ts`: Extended phoneHistoryImports schema
- `server/routes.importHistoryParser.ts`: Parser hook API route
- `client/src/pages/AdminImportHistory.tsx`: Parser tool notice UI

### Future Work
- Automated bundle download from `remoteBundleUrl`
- Multi-tenant support via `tenantExternalId` lookup
- Webhook callbacks for import completion

## DI4: Phone History Setup Wizard Step

### Overview
An optional "Import Your Phone History" step added to the Setup Wizard between Phone Setup (Step 2) and Website (Step 3). This helps new tenant owners easily discover and use the migration wizard to bring their existing customer conversations into ServicePro.

### Location
- **Setup Wizard**: `/setup-wizard` - Step 3 (optional, purple-themed card with dashed border)
- **Cross-link**: Links to Migration Wizard at `/admin/migration-wizard`

### Design
- Optional step shown between Phone Setup and Website
- Purple-themed glassmorphism card with dashed border
- Displays "Optional" badge in header
- Shows "Done" badge when completed (via import or skip)
- Auto-completes if a successful phone history import already exists

### Database Schema
Extended `tenant_config` table with:
- **onboardingPhoneHistoryStepSeen**: Boolean (default: false) - Tracks if user has seen/skipped this step

### API Endpoints
Updated endpoints in `/api/onboarding/progress`:
- **GET**: Returns `phoneHistoryStepSeen` and `hasSuccessfulPhoneHistoryImport` flags
- **POST**: Accepts `phoneHistoryStepSeen` boolean to mark step as seen

### Completion Logic
The step is considered complete (`phoneHistoryComplete`) when:
1. `phoneHistoryStepSeen` is true (user clicked "Skip for Now"), OR
2. `hasSuccessfulPhoneHistoryImport` is true (user completed a migration)

### Progress Calculation
- The phone history step does NOT count toward the required 3 steps
- Progress bar shows "X of 3 required steps complete"
- Website step remains as Step 3 in the numbered display

### Key Files
- `shared/schema.ts`: Added `onboardingPhoneHistoryStepSeen` field
- `server/onboardingIndustryRoutes.ts`: Updated GET/POST endpoints
- `client/src/pages/SetupWizard.tsx`: Added Step 3 UI card