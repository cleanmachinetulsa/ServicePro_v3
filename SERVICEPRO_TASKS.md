# ServicePro Build Tasks

## Phase 0 – Clone & Setup
- [ ] Clone Clean Machine → servicepro-v3-base
- [ ] Add MASTER_PLAN_V3.md
- [ ] Confirm TENANT_ISOLATION_IMPORT.md present

## Phase 1 – Tenant Isolation
- [ ] Add tenantDb.ts
- [ ] Add tenantMiddleware.ts
- [ ] Wire middleware into server/index.ts
- [ ] Run tenant isolation tests
- [ ] Migrate appointments routes to req.tenantDb
- [ ] Migrate Twilio voice/SMS routes to req.tenantDb

## Phase 2 – Telephony Spine
- [ ] Normalize /twilio/voice/incoming route
- [ ] Implement SIP → Groundwire flow for root tenant
- [ ] Add tenantPhoneConfig table

...
