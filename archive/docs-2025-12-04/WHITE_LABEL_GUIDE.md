# ServicePro White-Label Integration Guide

> **Audience**: AI Agent building ServicePro white-label business management system
> 
> **Purpose**: Comprehensive guide to understand and reuse Clean Machine Auto Detail codebase
> 
> **Last Updated**: November 16, 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Core Features Inventory](#core-features-inventory)
4. [Database Schema Reference](#database-schema-reference)
5. [API Routes Reference](#api-routes-reference)
6. [Frontend Components Library](#frontend-components-library)
7. [External Integrations](#external-integrations)
8. [Reusable Patterns & Code](#reusable-patterns--code)
9. [White-Labeling Checklist](#white-labeling-checklist)
10. [Implementation Roadmap](#implementation-roadmap)

---

## 1. System Overview

Clean Machine Auto Detail is a comprehensive AI-powered business management system built for auto detailing services. The system achieves 91% automation and includes:

### Key Capabilities
- **Multi-channel communication** (SMS, Email, Facebook Messenger, Instagram DMs, Web Chat)
- **AI-powered chatbot** (GPT-4o) for customer service and bookings
- **Complete employee scheduling** with shift management and PTO
- **Real-time API usage tracking** and cost monitoring
- **Homepage CMS** for non-technical content management
- **Careers portal** with job applications and resume uploads
- **Loyalty program** with 9 reward types
- **Payment processing** (Stripe, PayPal, Cash)
- **Referral system** with QR codes
- **Real-time WebSocket** updates for admin dashboards

### Target Metrics (Achieved)
- 91% automation rate
- <2min avg response time
- 24/7 AI availability
- 13+ admin dashboard features

---

## 2. Architecture & Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight client-side routing)
- **UI Library**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **State Management**: TanStack React Query v5
- **Form Handling**: React Hook Form + Zod validation
- **Real-time**: Socket.io-client
- **Charts**: Recharts
- **Icons**: Lucide React + React Icons (for brand logos)
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Session Management**: express-session with pg-simple
- **File Uploads**: Multer
- **Validation**: Zod schemas
- **Real-time**: Socket.io
- **Job Scheduling**: node-cron
- **API Rate Limiting**: express-rate-limit

### External Services
- **Communication**: Twilio (SMS/Voice), SendGrid (Email), Facebook Graph API
- **AI**: OpenAI GPT-4o
- **Payments**: Stripe, PayPal
- **Google Workspace**: Calendar, Sheets, Drive, Maps, Places
- **Weather**: Open-Meteo
- **Internal Alerts**: Slack

### Deployment
- **Platform**: Replit (with auto-scaling)
- **Database**: Neon PostgreSQL (serverless)
- **File Storage**: Local filesystem (`attached_assets/uploads/`)
- **Environment**: Production & Development modes

---

## 3. Core Features Inventory

### A. Customer Management
**Files**: `server/routes.ts` (customers endpoints), `shared/schema.ts` (customers table)

**Capabilities**:
- Customer CRUD operations
- Phone number normalization (E.164)
- Loyalty points tracking
- Referral code generation
- Returning customer detection
- QR code customer identification

**Database Tables**: `customers`, `referrals`, `loyaltyTransactions`

**Reusability**: 95% - Only need to rename "auto detailing" references

---

### B. Multi-Channel Messaging
**Files**: 
- `server/routes.ts` (SMS/Facebook endpoints)
- `server/notifications.ts` (Twilio SMS)
- `server/routes.facebook.ts` (Facebook Messenger/Instagram)
- `client/src/pages/Messages.tsx` (Unified inbox)

**Capabilities**:
- SMS via Twilio
- Facebook Messenger integration
- Instagram DM integration
- Web chat widget
- Unified conversation view
- Real-time typing indicators
- Read receipts
- Message reactions
- Offline draft saving
- Attachment uploads (images, PDFs)

**Database Tables**: `conversations`, `messages`, `messageAttachments`

**Reusability**: 90% - Fully reusable with business name changes

---

### C. AI Chatbot (GPT-4o)
**Files**:
- `server/openai.ts` (AI response generation)
- `server/knowledge.ts` (Knowledge base from Google Sheets)
- `server/customerMemory.ts` (Conversation memory)
- `server/schedulingTools.ts` (Function calling tools)

**Capabilities**:
- Conversational AI with GPT-4o
- Function calling for:
  - Appointment booking
  - Address validation
  - Customer lookup
  - Service recommendations
- Knowledge base integration (Google Sheets)
- Customer memory across conversations
- Intent detection for human handoff
- Tone: Professional, friendly, helpful

**Reusability**: 85% - Update knowledge base, service types, and system prompts

---

### D. Appointment Scheduling
**Files**:
- `server/routes.ts` (appointments endpoints)
- `server/calendarApi.ts` (Google Calendar integration)
- `server/schedulingTools.ts` (AI booking functions)
- `client/src/pages/SchedulingDashboard.tsx` (Admin calendar view)

**Capabilities**:
- Google Calendar two-way sync
- Availability checking
- Conflict detection
- Weather checking (rain reschedule)
- Recurring appointments
- SMS reminders
- Technician assignment
- Drive time calculation

**Database Tables**: `appointments`, `recurringServices`

**Reusability**: 90% - Change service types and duration logic

---

### E. Employee Scheduling System
**Files**:
- `server/routes.ts` (shifts endpoints)
- `client/src/pages/SchedulingDashboard.tsx` (Calendar grid)
- `client/src/pages/TechnicianSchedules.tsx` (30-day view)
- `client/src/pages/PTOManagement.tsx` (PTO workflows)
- `client/src/pages/ShiftTrading.tsx` (Shift swaps)

**Capabilities**:
- Weekly calendar grid view
- 30-day technician schedules
- PTO request/approval workflows
- Shift trading with validation
- Overtime warnings (40+ hours/week)
- SMS alerts for schedule changes
- Shift-appointment linking
- Conflict detection

**Database Tables**: `technicians`, `shifts`, `ptoRequests`, `shiftTrades`

**Reusability**: 95% - Fully reusable for any service business with employees

---

### F. Loyalty & Referral Programs
**Files**:
- `server/routes.ts` (loyalty/referral endpoints)
- `server/loyaltyService.ts` (Points calculation)
- `server/referralService.ts` (Referral rewards)
- `client/src/pages/Referrals.tsx` (Admin management)

**Capabilities**:
- Points earned per dollar spent
- 9 reward types:
  1. Loyalty points
  2. Percentage discount
  3. Fixed dollar discount
  4. Service credit
  5. Gift card
  6. Free add-on
  7. Tier upgrade
  8. Priority booking
  9. Milestone reward
- QR code generation for referrals
- SMS invites
- Referral tracking and analytics
- Admin code management

**Database Tables**: `loyaltyTransactions`, `referrals`, `referralRewards`

**Reusability**: 100% - Fully reusable for any business

---

### G. Payment Processing
**Files**:
- `server/paymentHandler.ts` (Stripe integration)
- `server/routes.ts` (payment endpoints)
- `server/routes.stripeWebhooks.ts` (Webhook handlers)
- `client/src/pages/Payments.tsx` (Admin payment view)

**Capabilities**:
- Stripe payment intents
- PayPal integration (placeholder)
- Cash payment tracking
- Invoice email generation
- Branded invoice HTML
- HMAC-signed payment links
- Upsell recommendations in emails

**Database Tables**: `payments`

**Reusability**: 95% - Update branding and email templates

---

### H. API Usage & Cost Dashboard
**Files**:
- `server/usageTracker.ts` (API tracking)
- `server/routes.ts` (usage endpoints)
- `client/src/pages/UsageDashboard.tsx` (Visual dashboard)

**Capabilities**:
- Real-time usage tracking for:
  - Twilio (SMS/calls)
  - OpenAI (tokens)
  - Stripe (fees)
  - SendGrid (emails)
  - Google APIs
- Service health monitoring
- Cost calculations
- MTD/YTD summaries
- Failure logs
- Manual sync trigger
- Auto-refresh dashboard

**Database Tables**: `apiUsageLogs`, `serviceHealth`, `usageSummary`

**Reusability**: 100% - Fully reusable for any business using these APIs

---

### I. Homepage CMS Editor
**Files**:
- `server/routes.ts` (homepage content endpoints)
- `client/src/pages/HomepageEditor.tsx` (Visual editor)
- `client/src/pages/home.tsx` (Public homepage)

**Capabilities**:
- Live split-screen editing
- 6 content tabs:
  1. Hero section (heading, subheading, CTA)
  2. About section
  3. Services section
  4. Brand colors (HSL format)
  5. Logo upload
  6. SEO meta tags
- Real-time preview
- File upload validation
- Database persistence

**Database Tables**: `homepageContent`

**Reusability**: 100% - Fully reusable for any business

---

### J. Careers/Employment Portal
**Files**:
- `server/routes.ts` (jobs/applications endpoints)
- `client/src/pages/Careers.tsx` (Public job listings)
- `client/src/pages/AdminApplications.tsx` (Admin review)

**Capabilities**:
- Public job postings
- Application form with validation
- Resume uploads (PDF/DOC/DOCX, 5MB limit)
- Admin application dashboard
- Status management (New/Reviewing/Interviewing/Rejected/Hired)
- Candidate notes
- Resume/LinkedIn/Portfolio links

**Database Tables**: `jobPostings`, `jobApplications`

**Reusability**: 100% - Fully reusable for any business

---

## 4. Database Schema Reference

### Key Tables (47 total)

**Core Entities**:
- `users` - Admin accounts (owner, manager, technician)
- `customers` - Customer records with loyalty points
- `appointments` - Service bookings
- `services` - Service catalog
- `addOns` - Service add-ons

**Communication**:
- `conversations` - Multi-channel conversation threads
- `messages` - Individual messages
- `messageAttachments` - File uploads for messages

**Employees**:
- `technicians` - Employee records
- `shifts` - Work schedules
- `ptoRequests` - PTO management
- `shiftTrades` - Shift swapping

**Payments**:
- `payments` - Payment records
- `invoices` - Invoice generation
- `loyaltyTransactions` - Points history

**Content Management**:
- `homepageContent` - CMS data
- `jobPostings` - Career listings
- `jobApplications` - Candidate submissions

**Monitoring**:
- `apiUsageLogs` - API call tracking
- `serviceHealth` - Integration health
- `errorLogs` - System error tracking
- `callLogs` - Twilio call records

### Schema Patterns

**Timestamps**: Most tables have `createdAt` and `updatedAt`

**Foreign Keys**: Proper relationships with references

**Enums**: Use varchar with specific allowed values

**JSON Fields**: Use jsonb for flexible metadata

**Indexes**: Strategic indexes on frequently queried fields

---

## 5. API Routes Reference

### Route Structure

All routes in `server/routes.ts` follow RESTful patterns:

**Public Routes**:
- `GET /api/jobs` - Job listings
- `POST /api/jobs/apply` - Submit application
- `GET /api/homepage-content` - CMS content

**Authenticated Routes** (require session):
- `GET /api/conversations` - User conversations
- `POST /api/messages` - Send message
- `GET /api/appointments` - User appointments

**Admin Routes** (require owner/manager role):
- `GET /api/admin/*` - Admin-only endpoints
- `POST /api/usage-sync` - Trigger API sync
- `PUT /api/admin/applications/:id` - Update application

### Authentication Middleware

**`requireAuth`**: Ensures user is logged in

**Custom checks**: Role validation (owner, manager)

**Session management**: express-session with PostgreSQL store

---

## 6. Frontend Components Library

### UI Components (shadcn/ui)

All in `client/src/components/ui/`:
- `button.tsx` - Button component
- `card.tsx` - Card layouts
- `dialog.tsx` - Modal dialogs
- `form.tsx` - React Hook Form wrapper
- `input.tsx` - Text inputs
- `select.tsx` - Dropdown selects
- `table.tsx` - Data tables
- `tabs.tsx` - Tabbed interfaces
- `toast.tsx` - Toast notifications
- Many more (40+ components)

### Custom Components

**`client/src/components/`**:
- `AuthGuard.tsx` - Route protection
- `GoogleReviews.tsx` - Review widget
- `AdminNav.tsx` - Admin navigation

### Page Structure

**Public Pages** (`client/src/pages/`):
- `home.tsx` - Landing page
- `Careers.tsx` - Job listings
- `showcase.tsx` - Marketing showcase

**Admin Pages** (`client/src/pages/`):
- `Dashboard.tsx` - Main admin dashboard
- `Messages.tsx` - Communication hub
- `SchedulingDashboard.tsx` - Calendar view
- `UsageDashboard.tsx` - API costs
- `HomepageEditor.tsx` - CMS editor
- `AdminApplications.tsx` - HR management
- Many more (30+ pages)

---

## 7. External Integrations

### Twilio (SMS & Voice)
**Setup**: Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

**Features**:
- Send SMS notifications
- Receive SMS webhooks
- Voice calls with IVR
- Voicemail transcription
- Call forwarding

**Files**: `server/notifications.ts`, `server/routes.voiceWebhook.ts`

---

### OpenAI (GPT-4o)
**Setup**: Requires `OPENAI_API_KEY`

**Features**:
- Conversational AI
- Function calling
- Token usage tracking
- GPT-4o pricing: $2.50/1M input, $10.00/1M output tokens

**Files**: `server/openai.ts`, `server/usageTracker.ts`

---

### Stripe (Payments)
**Setup**: Requires `STRIPE_SECRET_KEY`

**Features**:
- Payment intents
- Customer management
- Fee tracking
- Webhook handlers

**Files**: `server/paymentHandler.ts`, `server/routes.stripeWebhooks.ts`

---

### Google Workspace
**Setup**: Uses Replit OAuth connectors

**APIs Used**:
- Calendar API (appointments)
- Sheets API (knowledge base)
- Drive API (file storage)
- Maps API (geocoding)
- Places API (reviews)

**Files**: `server/googleCalendarConnector.ts`, `server/googleSheetsConnector.ts`, `server/googleIntegration.ts`

---

### SendGrid (Email)
**Setup**: Requires `SENDGRID_API_KEY`

**Features**:
- Transactional emails
- Email campaigns
- Usage statistics

**Files**: `server/emailService.ts`, `server/emailCampaignService.ts`

---

### Facebook Graph API
**Setup**: Requires page tokens

**Features**:
- Facebook Messenger
- Instagram DMs

**Files**: `server/routes.facebook.ts`

---

## 8. Reusable Patterns & Code

### Form Validation Pattern

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { name: '', email: '' },
});
```

---

### API Request Pattern

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Query
const { data, isLoading } = useQuery({
  queryKey: ['/api/resource'],
});

// Mutation
const mutation = useMutation({
  mutationFn: async (data) => {
    return await apiRequest('/api/resource', 'POST', data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
  },
});
```

---

### Protected API Route Pattern

```typescript
app.post('/api/admin/resource', requireAuth, async (req, res) => {
  if (req.user.role !== 'owner' && req.user.role !== 'manager') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // Validate input
  const schema = z.object({ ... });
  const parsed = schema.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.issues });
  }

  // Database operation
  try {
    const result = await db.insert(table).values(parsed.data).returning();
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ERROR]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
```

---

### Real-time WebSocket Pattern

```typescript
// Server (server/index.ts)
io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });
});

// Broadcast update
export function broadcastUpdate(roomId: string, data: any) {
  io.to(roomId).emit('update', data);
}

// Client
useEffect(() => {
  socket.on('update', (data) => {
    queryClient.invalidateQueries({ queryKey: ['/api/data'] });
  });
}, []);
```

---

## 9. White-Labeling Checklist

### Brand Customization

**Text Content**:
- [ ] Replace "Clean Machine Auto Detail" with business name
- [ ] Update service descriptions
- [ ] Change industry-specific terminology
- [ ] Update contact information

**Visual Branding**:
- [ ] Update logo (attached_assets/logo.png)
- [ ] Change primary/secondary/accent colors (tailwind.config.ts)
- [ ] Replace favicon
- [ ] Update SEO meta tags

**Database Seeds**:
- [ ] Update knowledge base (Google Sheets)
- [ ] Populate services table with new offerings
- [ ] Set up initial admin users

**Environment Variables**:
- [ ] Configure Twilio credentials
- [ ] Set up Stripe account
- [ ] Connect Google Workspace
- [ ] Configure SendGrid

---

### Service-Specific Changes

**Auto Detailing → New Business**:
- [ ] Update service types in database
- [ ] Modify pricing structure
- [ ] Change appointment duration logic
- [ ] Update AI system prompts (server/openai.ts)
- [ ] Revise knowledge base content
- [ ] Adjust loyalty points calculation

---

### Feature Removal (Optional)

**Not Needed?**:
- Comment out route registrations
- Hide pages from navigation
- Keep database tables (for future)
- Remove from Admin sidebar

**Examples**:
- Weather checking (if not location-based)
- Technician photos (if remote service)
- Drive time calculation (if fixed location)

---

## 10. Implementation Roadmap

### Phase 1: Core Setup (Week 1)
1. Clone repository
2. Update branding (name, colors, logo)
3. Configure environment variables
4. Set up database
5. Deploy to Replit/hosting

### Phase 2: Service Configuration (Week 2)
1. Define service offerings
2. Update pricing
3. Populate knowledge base
4. Configure AI prompts
5. Set up Google Calendar

### Phase 3: Communication (Week 3)
1. Configure Twilio (SMS/Voice)
2. Set up SendGrid (Email)
3. Optional: Facebook/Instagram integration
4. Test message flows
5. Configure auto-responses

### Phase 4: Payments & Loyalty (Week 4)
1. Set up Stripe account
2. Configure payment webhooks
3. Define loyalty program rules
4. Set up referral rewards
5. Test payment flows

### Phase 5: Employee Management (Week 5)
1. Add technicians/employees
2. Set up shift schedules
3. Configure PTO policies
4. Test scheduling workflows

### Phase 6: Testing & Launch (Week 6)
1. End-to-end testing
2. Admin training
3. Customer testing
4. Performance optimization
5. Public launch

---

## Key Takeaways for ServicePro

### What Works Great
✅ **Multi-channel messaging** - Customers can reach you anywhere
✅ **AI automation** - 91% of tasks handled automatically
✅ **Employee scheduling** - Prevents conflicts and overtime
✅ **Usage tracking** - See exactly what APIs cost
✅ **CMS editor** - Non-technical users can update homepage
✅ **Loyalty & referrals** - Built-in customer retention

### What to Customize
🔧 **Service types** - Replace auto detailing with your offerings
🔧 **AI prompts** - Tailor chatbot personality to your brand
🔧 **Knowledge base** - Populate with your FAQs and policies
🔧 **Branding** - Logo, colors, copy

### What's Universal
♻️ **Architecture** - Works for any service business
♻️ **Auth system** - Role-based access control
♻️ **Payment processing** - Stripe/PayPal/Cash
♻️ **Communication** - SMS/Email/Chat
♻️ **Employee management** - Scheduling/PTO/Trading
♻️ **Admin dashboards** - Analytics and monitoring

---

## Additional Resources

**Replit Documentation**: https://docs.replit.com
**Drizzle ORM**: https://orm.drizzle.team
**shadcn/ui**: https://ui.shadcn.com
**TanStack Query**: https://tanstack.com/query
**Twilio Docs**: https://www.twilio.com/docs
**Stripe Docs**: https://stripe.com/docs
**OpenAI Docs**: https://platform.openai.com/docs

---

## Contact & Support

For questions about this codebase:
1. Review this guide thoroughly
2. Check replit.md for project-specific notes
3. Search codebase for implementation examples
4. Test features in development mode first

---

**Last Updated**: November 16, 2025

**Version**: 1.0.0

**Features Count**: 60+ features across 13 admin pages

**Code Reusability**: 85-100% depending on industry

**Good luck building ServicePro! 🚀**
