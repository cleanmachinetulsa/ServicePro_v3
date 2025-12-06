📘 MASTER PLAN v3.7 — ServicePro

This is not a patch.
This is a complete replacement for v3.6 — fully aligned with everything we’ve built (CM-1 → CM-4, SP phases, loyalty v2/v3, telephony, AI support systems, public sites, billing roadmap, etc.) and everything still required to bring ServicePro to a commercial-grade v1, v2, and v3 lifecycle.

You can paste this directly into the repo as:

/docs/MASTER_PLAN_v3.7_SERVICEPRO.md


---

📘 MASTER PLAN v3.7 — ServicePro

The Canonical Architecture, Roadmap, & Delivery Blueprint
Supersedes v3.6 entirely.


---

0. Vision Statement

ServicePro is a premium, AI-powered automation platform for service businesses.
It must be:

Frictionless for non-technical users

Industrial-grade for power users

Multi-tenant, modular, and upgradable

Capable of running an entire business end-to-end

Able to onboard any new business in minutes

Beautiful and modern across every touchpoint

Stable under scale, fault-tolerant, and reliable


ServicePro v3.7 is built around simplicity, automation, and human-quality AI, with the long-term goal of becoming:

> “The Shopify of service businesses.”




---

1. Global Architecture Overview

1.1 Core Systems (Completed in v1)

Multi-tenant architecture with DB isolation

Tenant creation flows

Safe server wrappers (wrapTenantDb, wrapGlobalDb)

Authentication via Clerk

Role-based access control

Public endpoints with tenant resolution

Content delivery encryption, caching, rate limiting

Configurable industry packs

Frontend component library

Global configuration nodes for PHONE, EMAIL, AI, BILLING, SITE


1.2 Phase Buckets

The entire roadmap now lives in these buckets:

1. CM– CleanMachine Migration & Launch Tasks (CM-1 → CM-4, completed)


2. SP– ServicePro Core Platform


3. LL– Loyalty & Rewards System


4. TELE– Telephony Engine & Modes


5. AI– AI Automation, Support, Setup & Agent Systems


6. SITE– Public Website Generator & Branding


7. BILL– Billing, Usage Metering, Subscriptions


8. INT– Integrations (GCal, Email, SMS, GPT, QR, Plans)


9. OPS– Observability, Stability, Performance


10. LANG– Internationalization (Spanish v1, future languages)


11. V2 & V3 – Upgrades & Premium Experience Layers




---

2. Completed Work (Up to v3.7)

2.1 CleanMachine Launch Work (CM-1 → CM-4 COMPLETE)

CM-1: Full SMS ingestion, loyalty sync, conversation recovery

CM-2: Rewards Portal v1

CM-3: Port Recovery + Holiday Campaign Engine

CM-4: Public Site Settings + Hero/Brand editor


2.2 Telephony Foundations

SIP routing via IVR

Call → AI voicemail → transcription → threaded into conversation

SMS passthrough + AI agent replies

Telephony Modes (AI first, hybrid, human-first) in progress


2.3 Loyalty Upgrades

Points v2 engine

Achievements & Milestones

Public Rewards Portal v2 w/ recent & next achievements

Rewards → Booking flow integration

Fallback scheduler for Google Calendar failures


2.4 Support & Setup Systems

Support ticket system (admin + user portals)

Support AI Assistant backend service

Floating Support Chat widget

Suggestion system (platform + tenant customers)


2.5 Admin UX & SaaS Feature Systems

Pricing & Feature Gating

Tenant Plan upgrades

Public site generator

Email Settings v1

Industry Packs foundation

Multilingual scaffolding


2.6 API & Backend Improvements

Rate limits on sensitive routes

Tenant context extraction

Public API tenant resolver

Scheduler v2 fallback

Secure campaign engines

Error-hardened public site endpoint



---

3. Remaining Roadmap (The Canonical v3.7 → v4.0 Roadmap)

Below is EVERYTHING left to build — fully structured.


---

🎯 PHASE SP-1 — Telephony Modes (Hybrid Engine)

Status: In Progress

Deliverables

AI-First Mode

Human-First Mode

Hybrid Smart Mode

Missed-call escalation

“Always text + notifications to owner” toggle

Pronunciation correction (customer → GPT voice)


Why It Matters

Telephony is central to the platform. This phase completes the flexible routing options needed for real-world deployment.


---

🎯 PHASE SP-2 — Simple Mode vs Advanced Mode Dashboard

Status: Planned

Deliverables

Mode toggle on dashboard

Auto-hide advanced configurators

Auto-apply recommended defaults

Simple view:

Phone setup

Business hours

Services

Pricing

Public site basics

Loyalty basics


Backend config to persist selected mode


Why It Matters

90% of users will want simplicity.
10% will want deep control.
This solves both.


---

🎯 PHASE SP-3 — Billing & Usage Metering System

Status: Planned

1. Usage Counters (Required)

SMS sent/received

Minutes used (inbound/outbound)

AI minutes (OpenAI API)

Email sends

QR scans

Number of bookings

Campaign sends


2. Billing Subsystem

Stripe integration

Subscription plans + add-ons

Metered billing

Overages

Free trial handling

Grace period + reminders

Auto-suspend + reactivation


3. Billing Page (Frontend)

Current plan

Usage bars

Upcoming invoice

Payment method

Billing history

Upgrade/cancel



---

🎯 PHASE SP-4 — Add-On Marketplace

Status: Planned

Deliverables

Add-On infrastructure

Examples:

Additional seats

AI premium voice

Automated follow-ups

Weather-aware scheduling

Expanded service area

Extra SMS bundles


Auto-activate on purchase

Auto-disable if unpaid



---

🎯 PHASE SP-5 — Loyalty Identity Hardening (OTP v2)

Status: Revisit List

Deliverables

Optional OTP verification

Fraud protection

Phone + last name or DOB

Rate limit fraud attempts



---

🎯 PHASE SITE-2 — Public Site v3

Status: Planned

Deliverables

Multilingual support (English/Spanish)

Improved templates

Industry-specific blocks

Customer reviews section

Dynamic service cards

Loyalty CTA

Referral CTA

Gift-card CTA

Fully mobile-optimized



---

🎯 PHASE LL-3 — Loyalty v3

Status: Planned

Deliverables

Referral Program Engine

QR code generator (high-res + branded center logo)

Referral dashboard

Gift cards as loyalty boosters

Automated “near milestone” nudges

“Earn More Points” logic expansion



---

🎯 PHASE INT-2 — AI Message Importer (SMS Parser Integration)

Status: Planned

Deliverables

Wizard for CSV/HTML uploads

Backend ingestion system

Automatic customer matching

Conversation threading

Loyalty point generation retroactively

Full automation (no manual user steps)



---

🎯 PHASE BILL-2 — Tenant Usage Transparency

Status: Planned

Deliverables

Real-time usage dashboard

Exportable CSV

API access for power users

Alerts for high usage

Included vs overage meters



---

🎯 PHASE LANG-1 — Full Spanish Mode

Status: Planned

Deliverables

100% UI translation

Customer-facing pages translated

Industry pack translated

Telephony prompts in Spanish

Calendar/scheduler Spanish mode

Onboarding wizard Spanish mode

Contextual language preference suggestion



---

🎯 PHASE OPS-1 — Performance Pass

Status: Planned

Deliverables

Load time reductions

Bundle splitting

CDN cache tuning

SQL indexing review

Endpoint profiling

Request waterfall audit

Warm-start server improvements



---

🎯 PHASE SP-X — V3 Premium Experience Layer

Status: Future

Deliverables

White-label PWA installer

Advanced analytics

Heatmaps

Customer lifetime value engine

Route optimizer v2

Multi-team workforce support

Online bookings dashboard

Drag-and-drop automations builder



---

4. Revisit List (Active Tracking Zone)

Items currently parked:

1. Loyalty OTP / Identity Hardening


2. Public Site → "Site Not Found" 401 issue


3. Deeper campaign templating system


4. SMS Parser integration wizard


5. Expanded multilingual support


6. Gift-card engine v2


7. Portfolio galleries per tenant


8. Industry Pack enrichment


9. Stripe test/live mode toggling


10. CleanMachine DNS mapping + SSL fix (GoDaddy)




---

5. How All Future Work Must Be Designed

5.1 ALWAYS use:

Multi-tenant isolation

Tenant context injection

Nodes for global configs

Realtime dynamic linking via config nodes

Industry standard patterns

Layman-friendly UX

Advanced mode available

Clear state machine for flows

Minimal technical jargon


5.2 UX Principles

Friction kills adoption

Defaults must be correct

Every screen should explain itself

Spanish should never feel like a “secondary” mode

AI should feel like a helpful human, not a bot



---

6. Versioning Specification

v1 — Commercial-ready MVP

Telephony modes

Billing

Simple mode

DNS + SSL

Public site v2

Loyalty v2


v2 — Premium polish

Add-ons marketplace

Loyalty v3

Spanish v1

Support AI v3

Scheduling v3


v3 — Differentiator stage

Route optimization

Multi-team assignments

Pro-level analytics

Marketplace apps

Automations builder



---

7. Final Notes

This plan (v3.7) is the canonical living document.
Every future change should update this file.
Every module must reference this roadmap for required positioning.


---

