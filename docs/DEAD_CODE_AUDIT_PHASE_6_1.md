# Dead Code Audit Report
**Date:** November 15, 2025  
**Phase:** 6-1 Component Audit

---

## Executive Summary

**Total Dead Code Found:** ~6,930 lines across 47 files

### Breakdown by Category:
- **Components:** 13 files (2,256 lines)
- **UI Components:** 15 files (2,636 lines)
- **Server Utilities:** 16 files (2,038 lines)
- **Libs/Data/Other:** 3 files (~236 lines)
- **CSS Files:** 2 files

### Impact Assessment:
- **High Impact Removals:** InstantChatButton (387 lines), ui/sidebar (771 lines), ui/chart (365 lines)
- **Medium Impact Removals:** messages/HeaderActions (273 lines), InvoiceReferralCodeInput (290 lines)
- **Low Impact Removals:** Small utility scripts and minimal UI components

---

## 🔴 DEFINITELY DEAD (Not imported anywhere)

### Frontend Components (13 files, 2,256 lines)

| File Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `client/src/components/ActionableNotificationsBanner.tsx` | 185 | ❌ Dead | No imports found |
| `client/src/components/ChatbotEscalationOption.tsx` | 47 | ❌ Dead | No imports found |
| `client/src/components/CustomerSelector.tsx` | 160 | ❌ Dead | No imports found |
| `client/src/components/DashboardSidebar.tsx` | 137 | ❌ Dead | No imports found |
| `client/src/components/DemoMode.tsx` | 160 | ❌ Dead | No imports found |
| `client/src/components/InstantChatButton.tsx` | 387 | ❌ Dead | No imports found - **LARGEST COMPONENT** |
| `client/src/components/InvoiceReferralCodeInput.tsx` | 290 | ❌ Dead | No imports found |
| `client/src/components/LiveConversationMobileStyles.tsx` | 58 | ❌ Dead | Style component, not imported |
| `client/src/components/LoyaltyBanner.tsx` | 160 | ❌ Dead | No imports found |
| `client/src/components/PageTransition.tsx` | 101 | ❌ Dead | No imports found |
| `client/src/components/ServiceVerificationAnimation.tsx` | 198 | ❌ Dead | No imports found |
| `client/src/components/SocialShareButtons.tsx` | 100 | ❌ Dead | No imports found |
| `client/src/components/messages/HeaderActions.tsx` | 273 | ❌ Dead | No imports found |

### UI Components (15 files, 2,636 lines)

| File Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `client/src/components/ui/aspect-ratio.tsx` | 5 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/breadcrumb.tsx` | 115 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/chart.tsx` | 365 | ❌ Dead | Recharts wrapper, not used |
| `client/src/components/ui/context-menu.tsx` | 198 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/drawer.tsx` | 118 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/google-reviews.tsx` | 60 | ❌ Dead | Custom component, not used |
| `client/src/components/ui/hover-card.tsx` | 29 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/input-otp.tsx` | 69 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/menubar.tsx` | 256 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/navigation-menu.tsx` | 128 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/pagination.tsx` | 117 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/resizable.tsx` | 45 | ❌ Dead | Shadcn component, not used |
| `client/src/components/ui/sidebar.tsx` | 771 | ❌ Dead | Shadcn component, not used - **LARGEST UI COMPONENT** |
| `client/src/components/ui/switch-icons.tsx` | 63 | ❌ Dead | Custom component, not used |
| `client/src/components/ui/toggle-group.tsx` | 61 | ❌ Dead | Shadcn component, not used |

### Server Utilities & Scripts (16 files, 2,038 lines)

| File Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `server/addColumnsToAddons.ts` | 146 | ❌ Dead | Migration/setup script |
| `server/calendarTest.ts` | 49 | ❌ Dead | Test script |
| `server/createAdmin.ts` | 65 | ❌ Dead | Setup script |
| `server/fetch-addons.ts` | 83 | ❌ Dead | Utility script |
| `server/fetch-services.ts` | 10 | ❌ Dead | Utility script |
| `server/generateVapidKeys.ts` | 12 | ❌ Dead | Setup script |
| `server/mapApiTest.ts` | 37 | ❌ Dead | Test script |
| `server/pdfDocumentation.ts` | 366 | ❌ Dead | Documentation generator - **LARGEST SERVER FILE** |
| `server/photoCleanup.ts` | 226 | ❌ Dead | Maintenance script |
| `server/populateAddonDetails.ts` | 166 | ❌ Dead | Setup script |
| `server/portMonitoring.ts` | 323 | ❌ Dead | Monitoring utility |
| `server/seedPhoneLines.ts` | 74 | ❌ Dead | Seed script |
| `server/seedTags.ts` | 43 | ❌ Dead | Seed script |
| `server/sync-all-services.ts` | 145 | ❌ Dead | Sync script |
| `server/sync-services.ts` | 53 | ❌ Dead | Sync script |
| `server/updateCustomer.ts` | 240 | ❌ Dead | Update script |

### Lib Files (1 file, 55 lines)

| File Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `client/src/lib/invoiceLoyalty.ts` | 55 | ❌ Dead | No imports found |

### Data Files (1 file, 92 lines)

| File Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `client/src/data/galleryPhotos.ts` | 92 | ❌ Dead | Mock data, not imported |

### Other Files (2 files, ~89 lines)

| File Path | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `client/src/MobileTabsMenu.tsx` | 89 | ❌ Dead | No imports found |
| `client/src/assets/logo.tsx` | ? | ❌ Dead | No imports found |

### CSS Files (2 files)

| File Path | Status | Notes |
|-----------|--------|-------|
| `client/src/components/LiveConversationStyles.css` | ❌ Dead | Not imported anywhere |
| `client/src/pages/live-conversations-mobile.css` | ❌ Dead | Not imported anywhere |

---

## 🟡 POTENTIALLY DEAD (Needs Investigation)

### Data Files

| File Path | Status | Notes |
|-----------|--------|-------|
| `client/src/data/reviews.ts` | 🟡 Conditional | Dynamically imported in GoogleReviews.tsx as fallback mock data |

---

## ✅ ACTIVELY USED (Verified in use)

### All Pages (50 files)
**Status:** ✅ All 50 pages in `client/src/pages/` are imported and routed in `App.tsx`

### All Hooks (5 files)
**Status:** ✅ All hooks in `client/src/hooks/` are actively imported
- `use-debounce.ts` (1 import)
- `use-mobile.tsx` (1 import)
- `usePushNotifications.ts` (1 import)
- `useReadReceipts.ts` (1 import)
- `use-toast.ts` (82 imports) - **HEAVILY USED**

### Most Lib Files (4/5 files)
**Status:** ✅ Most lib files are actively used
- `lib/phone.ts` (2 imports)
- `lib/queryClient.ts` (55 imports) - **HEAVILY USED**
- `lib/searchIndex.ts` (1 import)
- `lib/utils.ts` (53 imports) - **HEAVILY USED**

### Core Components
**Status:** ✅ Most components in `client/src/components/` are actively imported and used
- Notable examples: AppShell, AuthGuard, DashboardNavButton, AppointmentScheduler, etc.

### All Route Files
**Status:** ✅ All `server/routes.*.ts` files are imported and used by the main Express app

---

## Recommendations

### High Priority (Safe to Remove)
1. **UI Components:** All 15 unused Shadcn UI components (2,636 lines)
   - These are boilerplate components that can be regenerated if needed
   - Removal will significantly reduce bundle size

2. **Dead Components:** Remove all 13 unused components (2,256 lines)
   - Start with smaller ones (ChatbotEscalationOption, LiveConversationMobileStyles)
   - Carefully review InstantChatButton (387 lines) for any valuable logic before deletion

3. **CSS Files:** Remove both unused CSS files
   - LiveConversationStyles.css
   - live-conversations-mobile.css

### Medium Priority (Review Before Removal)
1. **Server Scripts:** Archive or remove 16 utility scripts (2,038 lines)
   - These appear to be one-time setup/migration scripts
   - Consider keeping createAdmin.ts, generateVapidKeys.ts for future use
   - Archive the rest to a `/scripts/archive/` directory

2. **Lib/Data Files:**
   - Remove `lib/invoiceLoyalty.ts` if confirmed unused
   - Remove `data/galleryPhotos.ts` if confirmed unused
   - Keep `data/reviews.ts` (used as fallback)

### Low Priority
1. **MobileTabsMenu.tsx:** Review and remove if confirmed unused
2. **logo.tsx:** Review and remove if confirmed unused

---

## Potential Code Salvage

Before deletion, consider extracting valuable logic from:

1. **InstantChatButton.tsx (387 lines)**
   - May contain chat/support integration logic worth preserving

2. **InvoiceReferralCodeInput.tsx (290 lines)**
   - Referral code validation logic may be reusable

3. **messages/HeaderActions.tsx (273 lines)**
   - Message management actions may be useful elsewhere

4. **pdfDocumentation.ts (366 lines)**
   - PDF generation logic may be valuable for future features

5. **portMonitoring.ts (323 lines)**
   - Monitoring utilities may be useful for debugging

---

## Total Impact of Removal

**Estimated Lines Removed:** ~6,930 lines  
**Estimated Files Removed:** 47 files  
**Bundle Size Reduction:** Significant (especially from UI components)  
**Maintenance Burden Reduction:** High (less code to maintain and update)

---

## Next Steps (Phase 6-2)

1. Create backup branch before any deletions
2. Start with high-priority removals (UI components)
3. Run full test suite after each removal batch
4. Verify application still builds and runs
5. Check for any dynamic imports or indirect usage
6. Document any extracted logic for future reference
