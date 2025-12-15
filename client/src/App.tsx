// src/App.tsx

import React, { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useKeyboardDismiss } from "@/hooks/useKeyboardDismiss";
import { PwaProvider } from "@/contexts/PwaContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UiExperienceProvider } from "@/contexts/UiExperienceContext";
import { DashboardPreferencesProvider } from "@/contexts/DashboardPreferencesContext";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

// Core components that should load immediately (no lazy)
import NotFound from "@/pages/not-found";
import LoginPage from "./pages/login";
import AuthGuard from "./components/AuthGuard";
import BannerDisplay from "@/components/BannerDisplay";
import PasswordChangeModal from "./components/PasswordChangeModal";
import RootDomainHandler from "@/components/RootDomainHandler";
import { SupportAssistantWidget } from "./components/SupportAssistantWidget";
import FeedbackWidget from "./components/FeedbackWidget";

// ==========================
// LAZY-LOADED HEAVY PAGES
// ==========================

// Dashboard & Messages (frequently accessed - still lazy for initial load)
const Dashboard = lazy(() => import("@/pages/dashboard"));
const MessagesPage = lazy(() => import("./pages/messages"));
const PhonePage = lazy(() => import("./pages/phone"));

// Public-facing pages (lazy load for faster initial bundle)
const HomePage = lazy(() => import("@/pages/home"));
const PublicSite = lazy(() => import("./pages/PublicSite"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SchedulePage = lazy(() => import("@/pages/Schedule"));
const QuickBookingPage = lazy(() => import("@/pages/quick-booking"));
const LoyaltyPointsPage = lazy(() => import("@/pages/rewards"));
const PointsWelcomeLandingPage = lazy(() => import("@/pages/rewards/PointsWelcomeLandingPage"));
const GalleryPage = lazy(() => import("./pages/gallery"));
const ReviewsPage = lazy(() => import("./pages/reviews"));
const ChatPage = lazy(() => import("@/pages/chat"));
const DirectionsPage = lazy(() => import("@/pages/directions"));
const ServiceHistoryPage = lazy(() => import("@/pages/service-history"));
const Careers = lazy(() => import("./pages/Careers"));

// Demo pages
const DemoLandingPage = lazy(() => import("@/pages/DemoLandingPage"));
const DemoVerifyPage = lazy(() => import("@/pages/DemoVerifyPage"));
const DemoDashboardPage = lazy(() => import("@/pages/DemoDashboardPage"));
const DemoPage = lazy(() => import("@/pages/demo"));

// Auth & Account pages
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const ChangePasswordPage = lazy(() => import("./pages/change-password"));

// Settings pages (heavy - lazy load)
const SettingsPage = lazy(() => import("./pages/settings"));
const SettingsAdmin = lazy(() => import("./pages/settings-admin"));
const BusinessSettingsPage = lazy(() => import("@/pages/business-settings"));
const SecuritySettingsPage = lazy(() => import("./pages/security-settings"));
const PhoneSettingsPage = lazy(() => import("./pages/phone-settings"));
const EmailSettingsPage = lazy(() => import("./pages/email-settings"));
const NotificationsSettings = lazy(() => import("./pages/notifications-settings"));
const UiModeSettingsPage = lazy(() => import("./pages/settings/UiModeSettingsPage"));
const SettingsBillingPage = lazy(() => import("./pages/settings/BillingUsagePage"));
const UsageDashboardV2 = lazy(() => import("./pages/settings/UsageDashboardV2"));
const UsageDashboardPage = lazy(() => import("./pages/settings/UsageDashboardPage"));
const DomainsPage = lazy(() => import("./pages/settings/DomainsPage"));
const DashboardCustomizePage = lazy(() => import("./pages/settings/DashboardCustomizePage"));
const AddonsPage = lazy(() => import("./pages/settings/AddonsPage"));
const GiftCardsAdminPage = lazy(() => import("./pages/settings/GiftCardsAdminPage"));
const SettingsA2P = lazy(() => import("./pages/SettingsA2P"));

// Billing pages
const Billing = lazy(() => import("./pages/billing"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const SubscriptionPage = lazy(() => import("./pages/subscription"));
const BillingUsagePage = lazy(() => import("./pages/BillingUsagePage"));

// Admin pages (heavy - lazy load)
const AdminEmployees = lazy(() => import("./pages/admin-employees"));
const AdminJobEditor = lazy(() => import("./pages/admin-job-editor"));
const AdminQuoteRequests = lazy(() => import("./pages/admin-quote-requests"));
const AdminApplications = lazy(() => import("./pages/AdminApplications"));
const AdminTenants = lazy(() => import("./pages/AdminTenants"));
const AdminTenantDetail = lazy(() => import("./pages/AdminTenantDetail"));
const AdminPromos = lazy(() => import("./pages/AdminPromos"));
const AdminPhoneConfig = lazy(() => import("./pages/AdminPhoneConfig"));
const AdminIvrConfig = lazy(() => import("./pages/AdminIvrConfig"));
const AdminConciergeSetup = lazy(() => import("./pages/AdminConciergeSetup"));
const AdminIndustryPacks = lazy(() => import("./pages/AdminIndustryPacks"));
const AdminImportHistory = lazy(() => import("./pages/AdminImportHistory"));
const BookingsInbox = lazy(() => import("./pages/BookingsInbox"));
const CustomerSheetsImportPage = lazy(() => import("./pages/admin/CustomerSheetsImportPage"));
const AdminMigrationWizard = lazy(() => import("./pages/AdminMigrationWizard"));
const AdminParserHistory = lazy(() => import("./pages/admin/ParserHistory"));
const AdminPlansAndAddons = lazy(() => import("./pages/AdminPlansAndAddons"));
const AdminPortRecovery = lazy(() => import("./pages/AdminPortRecovery"));
const SmsCampaignAnalytics = lazy(() => import("./pages/admin/SmsCampaignAnalytics"));
const AdminPublicSiteSettings = lazy(() => import("./pages/admin-public-site-settings"));
const AdminPublicSiteTheme = lazy(() => import("./pages/admin-public-site-theme"));
const AdminIndustryImages = lazy(() => import("./pages/AdminIndustryImages"));
const AdminSupportTickets = lazy(() => import("./pages/AdminSupportTickets"));
const SupportIssuesPage = lazy(() => import("./pages/admin/SupportIssuesPage"));
const AdminPTO = lazy(() => import("./pages/AdminPTO"));
const AdminBilling = lazy(() => import("./pages/admin-billing"));
const SystemBillingAdmin = lazy(() => import("./pages/SystemBillingAdmin"));
const SystemUsageAdmin = lazy(() => import("./pages/SystemUsageAdmin"));
const AdminSystemUsagePage = lazy(() => import("./pages/admin/AdminSystemUsagePage"));
const TenantDebugPage = lazy(() => import("./pages/admin/TenantDebugPage"));
const PwaNotificationsPage = lazy(() => import("./pages/admin/PwaNotificationsPage"));
const PortalSettingsPage = lazy(() => import("./pages/admin/PortalSettingsPage"));
const AdminBillingOverview = lazy(() => import("./pages/AdminBillingOverview"));
const HomepageEditor = lazy(() => import("./pages/HomepageEditor"));
const ThemeGallery = lazy(() => import("./pages/ThemeGallery"));
const AdminCustomerSuggestions = lazy(() => import("./pages/admin-customer-suggestions"));

// Customer management pages
const CustomerDatabasePage = lazy(() => import("@/pages/customer-database"));
const DamageAssessmentPage = lazy(() => import("@/pages/damage-assessment"));
const UserManagement = lazy(() => import("./pages/user-management"));
const EscalationsPage = lazy(() => import("./pages/escalations"));
const ReminderDashboard = lazy(() => import("./pages/ReminderDashboard"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const CallMetricsPage = lazy(() => import("./pages/CallMetrics"));

// Technician pages
const TechnicianPage = lazy(() => import("./pages/technician"));
const TechWizard = lazy(() => import("./pages/tech-wizard"));
const TechProfile = lazy(() => import("./pages/tech-profile"));
const TechProfilePublic = lazy(() => import("./pages/tech-profile-public"));
const TechnicianSchedule = lazy(() => import("./pages/TechnicianSchedule"));
const RequestPTO = lazy(() => import("./pages/RequestPTO"));
const OpenShifts = lazy(() => import("./pages/OpenShifts"));
const ShiftTrades = lazy(() => import("./pages/ShiftTrades"));

// Scheduling pages
const SchedulingDashboard = lazy(() => import("./pages/SchedulingDashboard"));

// Suggestions pages
const PlatformSuggestions = lazy(() => import("./pages/PlatformSuggestions"));
const TenantSuggestions = lazy(() => import("./pages/TenantSuggestions"));

// Content pages
const BannerManagement = lazy(() => import("@/pages/banner-management"));
const GalleryManagementPage = lazy(() => import("./pages/gallery-management"));
const FacebookSettingsPage = lazy(() => import("./pages/facebook-settings"));

// Onboarding & Setup
const OnboardingIndustryPage = lazy(() => import("./pages/OnboardingIndustry"));
const SetupCopilot = lazy(() => import("./pages/SetupCopilot"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const LaunchPage = lazy(() => import("./pages/launch"));

// Customer Portal pages
const CustomerLogin = lazy(() => import("./pages/CustomerLogin"));
const CustomerPortalDashboard = lazy(() => import("./pages/CustomerPortalDashboard"));
const CustomerSettings = lazy(() => import("./pages/CustomerSettings"));
const PortalWelcome = lazy(() => import("./pages/PortalWelcome"));
const Portal = lazy(() => import("./pages/Portal"));

// Recurring services
const CustomerRecurringServicesPage = lazy(() => import("./pages/customer-recurring-services"));
const RecurringServiceBookingPage = lazy(() => import("./pages/recurring-service-booking"));

// Referral pages
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const ReferralLanding = lazy(() => import("./pages/ReferralLanding"));

// Support pages
const SupportCenter = lazy(() => import("./pages/SupportCenter"));

// Miscellaneous pages
const PayerApprovalPage = lazy(() => import("./pages/payer-approval"));
const QuoteApprovalPage = lazy(() => import("./pages/quote-approval"));
const SMSConsentPage = lazy(() => import("./pages/sms-consent"));
const PrivacyPolicyPage = lazy(() => import("./pages/privacy-policy"));
const Maintenance = lazy(() => import("./pages/maintenance"));
const ShowcasePage = lazy(() => import("./pages/Showcase"));
const CleanMachineShowcase = lazy(() => import("./pages/clean-machine-showcase"));
const SipSetupGuide = lazy(() => import("./pages/sip-setup-guide"));
const DownloadExportPage = lazy(() => import("./pages/download-export"));
const UsageDashboard = lazy(() => import("./pages/UsageDashboard"));
const UsageCostsPage = lazy(() => import("./pages/UsageCostsPage"));
const RootSystemUsagePage = lazy(() => import("./pages/RootSystemUsagePage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const DashboardNavButton = lazy(() => import("@/components/DashboardNavButton"));

// Suspense wrapper for lazy components
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSkeleton type="page" />}>
      {children}
    </Suspense>
  );
}

function LazyDashboard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSkeleton type="dashboard" />}>
      {children}
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/* Phase 9: Public Website Generator (PUBLIC ROUTE - NO AUTH) */}
      <Route path="/site/:subdomain">
        <LazyPage><PublicSite /></LazyPage>
      </Route>

      {/* Phase 7B: Pricing & Tier Comparison (PUBLIC ROUTE - NO AUTH) */}
      <Route path="/pricing">
        <LazyPage><PricingPage /></LazyPage>
      </Route>

      {/* CM-DEMO-1: Demo Mode Routes (PUBLIC - NO AUTH) */}
      <Route path="/demo">
        <LazyPage><DemoLandingPage /></LazyPage>
      </Route>
      <Route path="/demo/verify">
        <LazyPage><DemoVerifyPage /></LazyPage>
      </Route>
      <Route path="/demo/dashboard">
        <LazyDashboard><DemoDashboardPage /></LazyDashboard>
      </Route>

      {/* 🆕 PUBLIC INDUSTRY ONBOARDING ROUTE (NO AUTHGUARD FOR NOW) */}
      <Route path="/onboarding/industry">
        <LazyPage><OnboardingIndustryPage /></LazyPage>
      </Route>
      
      {/* 🆕 ADMIN INDUSTRY IMAGE UPLOAD PAGE */}
      <Route path="/admin/industry-images">
        <AuthGuard>
          <LazyPage><AdminIndustryImages /></LazyPage>
        </AuthGuard>
      </Route>

      {/* Existing routes below */}

      <Route path="/launch">
        <AuthGuard>
          <LazyPage><LaunchPage /></LazyPage>
        </AuthGuard>
      </Route>

      <Route path="/export-download">
        <LazyPage><DownloadExportPage /></LazyPage>
      </Route>
      <Route path="/maintenance">
        <LazyPage><Maintenance /></LazyPage>
      </Route>

      <Route path="/showcase">
        <LazyPage><ShowcasePage /></LazyPage>
      </Route>
      <Route path="/clean-machine">
        <LazyPage><CleanMachineShowcase /></LazyPage>
      </Route>

      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password">
        <LazyPage><ForgotPasswordPage /></LazyPage>
      </Route>
      <Route path="/reset-password">
        <LazyPage><ResetPasswordPage /></LazyPage>
      </Route>
      <Route path="/change-password">
        <LazyPage><ChangePasswordPage /></LazyPage>
      </Route>

      <Route path="/approve/:token">
        <LazyPage><PayerApprovalPage /></LazyPage>
      </Route>

      <Route path="/deposit-payment-success">
        <LazyPage>
          <Suspense fallback={<LoadingSkeleton />}>
            {React.createElement(lazy(() => import("./pages/deposit-payment-success")))}
          </Suspense>
        </LazyPage>
      </Route>
      <Route path="/deposit-payment-cancelled">
        <LazyPage>
          <Suspense fallback={<LoadingSkeleton />}>
            {React.createElement(lazy(() => import("./pages/deposit-payment-cancelled")))}
          </Suspense>
        </LazyPage>
      </Route>

      <Route path="/quote-approval/:token">
        <LazyPage><QuoteApprovalPage /></LazyPage>
      </Route>

      <Route path="/dashboard">
        <AuthGuard>
          <LazyDashboard><Dashboard /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/messages">
        <AuthGuard>
          <LazyPage><MessagesPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/phone">
        <AuthGuard>
          <LazyPage><PhonePage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/call-metrics">
        <AuthGuard>
          <LazyDashboard><CallMetricsPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/facebook-settings">
        <AuthGuard>
          <LazyPage><FacebookSettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/quick-replies">
        <AuthGuard>
          <LazyPage><SettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/a2p">
        <AuthGuard>
          <LazyPage><SettingsA2P /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/email">
        <AuthGuard>
          <LazyPage><EmailSettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/ui-mode">
        <AuthGuard>
          <LazyPage><UiModeSettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/billing">
        <AuthGuard>
          <LazyPage><SettingsBillingPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/usage">
        <AuthGuard>
          <LazyDashboard><UsageDashboardV2 /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/settings/usage-caps">
        <AuthGuard>
          <LazyDashboard><UsageDashboardPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/settings/domains">
        <AuthGuard>
          <LazyPage><DomainsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/dashboard/customize">
        <AuthGuard>
          <LazyPage><DashboardCustomizePage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/billing/addons">
        <AuthGuard>
          <LazyPage><AddonsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/gift-cards">
        <AuthGuard>
          <LazyPage><GiftCardsAdminPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/plans-and-addons">
        <AuthGuard>
          <LazyPage><AdminPlansAndAddons /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/port-recovery">
        <AuthGuard>
          <LazyPage><AdminPortRecovery /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/sms-analytics">
        <AuthGuard>
          <LazyPage><SmsCampaignAnalytics /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/sms-analytics/campaign/:campaignId">
        <AuthGuard>
          <LazyPage><SmsCampaignAnalytics /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/public-site-settings">
        <AuthGuard>
          <LazyPage><AdminPublicSiteSettings /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/public-site-theme">
        <AuthGuard>
          <LazyPage><AdminPublicSiteTheme /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/settings/:section?/:item?">
        <AuthGuard>
          <LazyPage><SettingsAdmin /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/security-settings">
        <AuthGuard>
          <LazyPage><SecuritySettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/phone-settings">
        <AuthGuard>
          <LazyPage><PhoneSettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/sip-setup-guide">
        <AuthGuard>
          <LazyPage><SipSetupGuide /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/customer-database">
        <AuthGuard>
          <LazyDashboard><CustomerDatabasePage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/business-settings">
        <AuthGuard>
          <LazyPage><BusinessSettingsPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/banner-management">
        <AuthGuard>
          <LazyPage><BannerManagement /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/damage-assessment">
        <AuthGuard>
          <LazyDashboard><DamageAssessmentPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/user-management">
        <AuthGuard>
          <LazyDashboard><UserManagement /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/escalations">
        <AuthGuard>
          <LazyDashboard><EscalationsPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/reminders">
        <AuthGuard>
          <LazyDashboard><ReminderDashboard /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/notifications-settings">
        <AuthGuard>
          <LazyPage><NotificationsSettings /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard>
          <LazyDashboard><AnalyticsPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/billing">
        <AuthGuard>
          <LazyPage><Billing /></LazyPage>
        </AuthGuard>
      </Route>

      {/* Phase 7C: Billing Success (after Stripe checkout) */}
      <Route path="/billing/success">
        <AuthGuard>
          <LazyPage><BillingSuccess /></LazyPage>
        </AuthGuard>
      </Route>
      
      {/* Subscription/Plan Management */}
      <Route path="/subscription">
        <AuthGuard>
          <LazyPage><SubscriptionPage /></LazyPage>
        </AuthGuard>
      </Route>
      
      <Route path="/admin/employees">
        <AuthGuard>
          <LazyDashboard><AdminEmployees /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/jobs/:id">
        <AuthGuard>
          <LazyPage><AdminJobEditor /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/quote-requests">
        <AuthGuard>
          <LazyDashboard><AdminQuoteRequests /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/applications">
        <AuthGuard>
          <LazyDashboard><AdminApplications /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/tenants">
        <AuthGuard>
          <LazyDashboard><AdminTenants /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/tenants/:tenantId">
        <AuthGuard>
          <LazyPage><AdminTenantDetail /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/promos">
        <AuthGuard>
          <LazyDashboard><AdminPromos /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/phone-config">
        <AuthGuard>
          <LazyPage><AdminPhoneConfig /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/ivr-config">
        <AuthGuard>
          <LazyPage><AdminIvrConfig /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/concierge-setup">
        <AuthGuard>
          <LazyPage><AdminConciergeSetup /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/suggestions">
        <AuthGuard>
          <LazyDashboard><PlatformSuggestions /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/suggestions">
        <AuthGuard>
          <LazyDashboard><TenantSuggestions /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/customer-suggestions">
        <AuthGuard>
          <LazyDashboard><AdminCustomerSuggestions /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* PWA Notification Settings V2 */}
      <Route path="/admin/pwa-notifications">
        <AuthGuard>
          <LazyDashboard><PwaNotificationsPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/portal-settings">
        <AuthGuard>
          <LazyDashboard><PortalSettingsPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* Phase 5.2: Industry Pack Editor + Clone-a-Tenant Factory */}
      <Route path="/admin/industry-packs">
        <AuthGuard>
          <LazyDashboard><AdminIndustryPacks /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* INT-3: Phone History Import Engine */}
      <Route path="/admin/import-history">
        <AuthGuard>
          <LazyDashboard><AdminImportHistory /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/bookings-inbox">
        <AuthGuard>
          <LazyDashboard><BookingsInbox /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* SP-GSHEETS-CUSTOMER-RESYNC: Customer Import from Google Sheets */}
      <Route path="/admin/customer-sheets-import">
        <AuthGuard>
          <LazyDashboard><CustomerSheetsImportPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* INT-4: Migration Wizard */}
      <Route path="/admin/migration-wizard">
        <AuthGuard>
          <LazyPage><AdminMigrationWizard /></LazyPage>
        </AuthGuard>
      </Route>
      {/* SP-PARSER-3: Parser History */}
      <Route path="/admin/parser-history">
        <AuthGuard>
          <LazyDashboard><AdminParserHistory /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* Debug: Tenant Visibility Snapshot */}
      <Route path="/admin/debug/tenant">
        <AuthGuard>
          <LazyPage><TenantDebugPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/parser-history/:id">
        <AuthGuard>
          <LazyPage><AdminParserHistory /></LazyPage>
        </AuthGuard>
      </Route>
      {/* Phase 26: Support System */}
      <Route path="/support">
        <AuthGuard>
          <LazyPage><SupportCenter /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/support-tickets">
        <AuthGuard>
          <LazyDashboard><AdminSupportTickets /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* SP-SUPPORT-1: Support Issues & Error Logging */}
      <Route path="/admin/support-issues">
        <AuthGuard>
          <LazyDashboard><SupportIssuesPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/theme-gallery">
        <AuthGuard>
          <LazyDashboard><ThemeGallery /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/scheduling">
        <AuthGuard>
          <LazyDashboard><SchedulingDashboard /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/pto">
        <AuthGuard>
          <LazyDashboard><AdminPTO /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/homepage-editor">
        <AuthGuard>
          <LazyPage><HomepageEditor /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/usage-dashboard">
        <AuthGuard>
          <LazyDashboard><UsageDashboard /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/billing-usage">
        <AuthGuard>
          <LazyDashboard><BillingUsagePage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/billing">
        <AuthGuard>
          <LazyDashboard><AdminBilling /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/system-billing">
        <AuthGuard>
          <LazyDashboard><SystemBillingAdmin /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/system-usage">
        <AuthGuard>
          <LazyDashboard><SystemUsageAdmin /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/system-usage-v2">
        <AuthGuard>
          <LazyDashboard><AdminSystemUsagePage /></LazyDashboard>
        </AuthGuard>
      </Route>
      {/* SP-26: Usage Transparency v2 */}
      <Route path="/admin/usage-costs">
        <AuthGuard>
          <LazyDashboard><UsageCostsPage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/root/system-usage">
        <AuthGuard>
          <LazyDashboard><RootSystemUsagePage /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/billing-overview">
        <AuthGuard>
          <LazyDashboard><AdminBillingOverview /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/admin/gallery-management">
        <AuthGuard>
          <LazyPage><GalleryManagementPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/banner-management">
        <AuthGuard>
          <LazyPage><BannerManagement /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/admin/setup-copilot">
        <AuthGuard>
          <LazyPage><SetupCopilot /></LazyPage>
        </AuthGuard>
      </Route>
      
      {/* Setup Wizard - post-signup onboarding flow */}
      <Route path="/setup-wizard">
        <AuthGuard>
          <LazyPage><SetupWizard /></LazyPage>
        </AuthGuard>
      </Route>

      <Route path="/technician">
        <AuthGuard>
          <LazyPage><TechnicianPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/tech/wizard">
        <AuthGuard>
          <LazyPage><TechWizard /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/tech/profile">
        <AuthGuard>
          <LazyPage><TechProfile /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/tech/schedule">
        <AuthGuard>
          <LazyDashboard><TechnicianSchedule /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/tech/pto">
        <AuthGuard>
          <LazyPage><RequestPTO /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/tech/open-shifts">
        <AuthGuard>
          <LazyDashboard><OpenShifts /></LazyDashboard>
        </AuthGuard>
      </Route>
      <Route path="/tech/shift-trades">
        <AuthGuard>
          <LazyDashboard><ShiftTrades /></LazyDashboard>
        </AuthGuard>
      </Route>

      <Route path="/p/:publicId">
        <LazyPage><TechProfilePublic /></LazyPage>
      </Route>

      <Route path="/chat">
        <LazyPage><ChatPage /></LazyPage>
      </Route>
      <Route path="/schedule">
        <LazyPage><SchedulePage /></LazyPage>
      </Route>
      <Route path="/book">
        <LazyPage><SchedulePage /></LazyPage>
      </Route>
      <Route path="/booking">
        <LazyPage><SchedulePage /></LazyPage>
      </Route>
      <Route path="/quick-booking">
        <LazyPage><QuickBookingPage /></LazyPage>
      </Route>
      <Route path="/directions">
        <LazyPage><DirectionsPage /></LazyPage>
      </Route>
      <Route path="/service-history">
        <LazyPage><ServiceHistoryPage /></LazyPage>
      </Route>
      <Route path="/demo">
        <LazyPage><DemoPage /></LazyPage>
      </Route>
      <Route path="/rewards">
        <LazyPage><LoyaltyPointsPage /></LazyPage>
      </Route>
      {/* CM-REWARDS-WELCOME-LANDING: Points welcome landing from SMS campaigns */}
      <Route path="/rewards/welcome">
        <LazyPage><PointsWelcomeLandingPage /></LazyPage>
      </Route>
      <Route path="/referrals">
        <AuthGuard>
          <LazyPage><ReferralPage /></LazyPage>
        </AuthGuard>
      </Route>
      <Route path="/gallery">
        <LazyPage><GalleryPage /></LazyPage>
      </Route>
      <Route path="/reviews">
        <LazyPage><ReviewsPage /></LazyPage>
      </Route>
      <Route path="/my-services">
        <LazyPage><CustomerRecurringServicesPage /></LazyPage>
      </Route>
      <Route path="/recurring-booking/:serviceId">
        <LazyPage><RecurringServiceBookingPage /></LazyPage>
      </Route>
      <Route path="/sms-consent">
        <LazyPage><SMSConsentPage /></LazyPage>
      </Route>
      <Route path="/privacy-policy">
        <LazyPage><PrivacyPolicyPage /></LazyPage>
      </Route>
      <Route path="/careers">
        <LazyPage><Careers /></LazyPage>
      </Route>

      {/* Phase 3.2: Public Referral Landing Page */}
      <Route path="/ref/:code">
        <LazyPage><ReferralLanding /></LazyPage>
      </Route>

      {/* Phase 15 & 16.5: Customer Portal Routes */}
      <Route path="/portal/welcome">
        <LazyPage><PortalWelcome /></LazyPage>
      </Route>
      <Route path="/portal/home">
        <LazyPage><Portal /></LazyPage>
      </Route>
      <Route path="/portal/login">
        <LazyPage><CustomerLogin /></LazyPage>
      </Route>
      <Route path="/portal/settings">
        <LazyPage><CustomerSettings /></LazyPage>
      </Route>
      <Route path="/portal">
        <LazyDashboard><CustomerPortalDashboard /></LazyDashboard>
      </Route>

      {/* Customer-facing homepage for Clean Machine (tenant booking site) */}
      <Route path="/home">
        <LazyPage><HomePage /></LazyPage>
      </Route>
      
      {/* CM-DNS-2: Root route with domain-based routing */}
      <Route path="/" component={RootDomainHandler} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  useKeyboardDismiss();

  const isCustomerFacingPage = () => {
    const adminPages = [
      "/dashboard",
      "/customer-database",
      "/business-settings",
      "/damage-assessment",
      "/formatter-test",
      "/messages",
      "/facebook-settings",
      "/settings",
      "/admin/employees",
      "/admin/jobs",
      "/admin/quote-requests",
    ];
    return !adminPages.some((page) => location.startsWith(page));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PwaProvider>
          <UiExperienceProvider>
            <DashboardPreferencesProvider>
              <Toaster />
              <PasswordChangeModal />
              <BannerDisplay />
              <Router />
              {!isCustomerFacingPage() && <SupportAssistantWidget />}
              {!isCustomerFacingPage() && <FeedbackWidget />}
            </DashboardPreferencesProvider>
          </UiExperienceProvider>
        </PwaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
