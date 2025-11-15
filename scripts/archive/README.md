# Archived Server Utilities

**Archive Date**: November 15, 2025  
**Phase**: 6-2 Dead Code Removal  
**Source**: `server/` directory

---

## Purpose

These scripts were moved from the `server/` directory during dead code cleanup (Phase 6-2, Nov 15, 2025).

They are **not actively used in production** but may be useful for:
- Manual database operations
- Debugging and troubleshooting
- Future migrations
- One-time setup tasks
- Reference for similar functionality

---

## Archived Files (13 total)

### Database Setup & Migration Scripts
1. **addColumnsToAddons.ts** - Migration script for adding columns to addons table
2. **populateAddonDetails.ts** - Script to populate addon details in database
3. **seedTags.ts** - Seed script for tags data

### Data Fetching & Sync Scripts
4. **fetch-addons.ts** - Fetch addons from external source
5. **fetch-services.ts** - Fetch services from external source
6. **sync-all-services.ts** - Sync all services script
7. **sync-services.ts** - Sync services script

### Testing & Debugging Scripts
8. **calendarTest.ts** - Calendar integration testing script
9. **mapApiTest.ts** - Google Maps API testing script

### Maintenance Scripts
10. **photoCleanup.ts** - Photo cleanup and maintenance script
11. **createAdmin.ts** - Script to create admin users
12. **generateVapidKeys.ts** - Generate VAPID keys for push notifications
13. **pdfDocumentation.ts** - PDF documentation generation utility

---

## Files NOT Archived (Still Actively Used)

The following files were initially planned for archiving but are still actively imported in the codebase:

1. **seedPhoneLines.ts** - Imported dynamically in `server/index.ts`
2. **portMonitoring.ts** - Imported dynamically in `server/index.ts`
3. **updateCustomer.ts** - Imported dynamically in `server/routes.ts`

These files remain in the `server/` directory.

---

## Important Notes

⚠️ **Do not delete these files without careful review**

These scripts may be needed for:
- Emergency database operations
- Setting up new environments
- Troubleshooting production issues
- Creating test data
- One-time administrative tasks

If you need to use any of these scripts:
1. Review the code carefully before running
2. Test in a development environment first
3. Update import paths if dependencies have changed
4. Check that all required environment variables are set

---

## Running Archived Scripts

To run an archived script:

```bash
# Using tsx (recommended)
tsx scripts/archive/scriptName.ts

# Using ts-node (alternative)
ts-node scripts/archive/scriptName.ts
```

**Example:**
```bash
tsx scripts/archive/createAdmin.ts
```

---

## Salvaged Code Reference

For code patterns and logic extracted from these files before archiving, see:
- `docs/SALVAGED_CODE_SNIPPETS.md`

---

**Archive maintained by**: Phase 6-2 Dead Code Removal Process  
**Last updated**: November 15, 2025
