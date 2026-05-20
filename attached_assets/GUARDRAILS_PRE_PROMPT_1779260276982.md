# SERVICEPRO REPLIT AGENT — GUARDRAILS PRE-PROMPT
## Paste this FIRST before every Stage prompt. Do not skip it.

---

You are the Replit AI agent working on the **ServicePro v3** repo. This is a live, multi-tenant SaaS platform. Before you touch a single file, internalize every rule below.

## IDENTITY OF THIS CODEBASE
- Multi-tenant SaaS. Every tenant has isolated data. Tenant isolation is not optional.
- Every DB query touching tenant data must go through the `tenantDb` wrapper (`wrapTenantDb`). Never use the raw `db` singleton for tenant-scoped data.
- Clean Machine (`root` tenant) is a real business. Breaking it breaks a live customer.

## NON-NEGOTIABLE RULES

### Before writing any code
1. **Read every file in the SEARCH BLOCK of the stage prompt.** Not a skim — read the actual content.
2. **Grep for existing implementations before creating anything new.** If it exists, extend it. Never create a parallel version.
3. **If you find something in the search block that contradicts the task description, STOP and report it before proceeding.** Do not work around ambiguity silently.

### While writing code
4. **No destructive schema changes.** No `drizzle-kit push`. No `DROP`, `ALTER COLUMN`, or `DROP COLUMN`. Additive-only. If a migration is needed, write a safe `.sql` file and note it in the completion report.
5. **No new npm packages** unless the stage prompt explicitly pre-approves one.
6. **No new top-level services or route files** unless the stage prompt explicitly requires one.
7. **Do not change function signatures** unless the stage prompt explicitly instructs it. Changing a signature breaks callers you may not be able to see.
8. **Do not rewrite working code.** If something works, make the minimum targeted edit. Rewriting causes regressions.
9. **Do not comment out tests.** If a test fails after your change, fix the code — not the test.

### Tenant safety checklist (run mentally before every DB write)
- Is this query scoped to a single tenant via `tenantDb`? ✓
- Could this query accidentally return or mutate another tenant's data? ✗
- Does this new route have `requireAuth` and tenant middleware? ✓

### Do not touch these systems unless the stage prompt explicitly scopes them
- `server/services/tenantCommRouter.ts` — tenant routing
- `server/services/smsSendGuard.ts` — outbound SMS choke point
- `server/twilioSignatureMiddleware.ts` — webhook security
- `server/services/customerThreadService.ts` — cross-channel thread model
- `shared/schema.ts` — database schema (read-only unless adding a column with a safe migration)
- `server/tenantDb.ts` — tenant isolation wrapper
- `server/authMiddleware.ts` / `server/rbacMiddleware.ts` — auth

## COMPLETION REPORT IS MANDATORY
Every stage ends with the structured report defined in that stage's prompt. Do not skip it. Do not abbreviate it. If something is unresolved, say so explicitly in the "Unresolved issues" section — do not hide gaps.

---
