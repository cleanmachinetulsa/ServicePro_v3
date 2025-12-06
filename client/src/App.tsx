// src/App.tsx

import React, { lazy } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useKeyboardDismiss } from "@/hooks/useKeyboardDismiss";
import { PwaProvider } from "@/contexts/PwaContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import DirectionsPage from "@/pages/directions";
import ServiceHistoryPage from "@/pages/service-history";
import Dashboard from "@/pages/dashboard";
import CustomerDatabasePage from "@/pages/customer-database";
import BusinessSettingsPage from "@/pages/business-settings";
import BannerManagement from "@/pages/banner-management";
import BannerDisplay from "@/components/BannerDisplay";
import DamageAssessmentPage from "@/pages/damage-assessment";
import DemoPage from "@/pages/demo";
import HomePage from "@/pages/home";
import LandingPage from "@/pages/LandingPage";
import SchedulePage from "@/pages/Schedule";
import QuickBookingPage from "@/pages/quick-booking";
import LoyaltyPointsPage from "@/pages/rewards";
import DashboardNavButton from "@/components/DashboardNavButton";
import GalleryPage from "./pages/gallery";
import ReviewsPage from "./pages/reviews";
import MessagesPage from "./pages/messages";
import PhonePage from "./pages/phone";
import SettingsPage from "./pages/settings";
import SettingsAdmin from "./pages/settings-admin";
import FacebookSettingsPage from "./pages/facebook-settings";
import LoginPage from "./pages/login";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import ChangePasswordPage from "./pages/change-password";
import AuthGuard from "./components/AuthGuard";
import UserManagement from "./pages/user-management";
import PasswordChangeModal from "./components/PasswordChangeModal";
import NotificationsSettings from "./pages/notifications-settings";
import AnalyticsPage from "./pages/analytics";
import CustomerRecurringServicesPage from "./pages/customer-recurring-services";
import RecurringServiceBookingPage from "./pages/recurring-service-booking";
import TechWizard from "./pages/tech-wizard";
import TechProfile from "./pages/tech-profile";
import TechProfilePublic from "./pages/tech-profile-public";
import TechnicianSchedule from "./pages/TechnicianSchedule";
import AdminEmployees from "./pages/admin-employees";
import AdminJobEditor from "./pages/admin-job-editor";
import AdminQuoteRequests from "./pages/admin-quote-requests";
import AdminApplications from "./pages/AdminApplications";
import AdminTenants from "./pages/AdminTenants";
import AdminTenantDetail from "./pages/AdminTenantDetail";
import AdminPromos from "./pages/AdminPromos";
import AdminPhoneConfig from "./pages/AdminPhoneConfig";
import AdminIvrConfig from "./pages/AdminIvrConfig";
import AdminConciergeSetup from "./pages/AdminConciergeSetup";
import PlatformSuggestions from "./pages/PlatformSuggestions";
import TenantSuggestions from "./pages/TenantSuggestions";
import AdminCustomerSuggestions from "./pages/admin-customer-suggestions";
import ThemeGallery from "./pages/ThemeGallery";
import PayerApprovalPage from "./pages/payer-approval";
import QuoteApprovalPage from "./pages/quote-approval";
import SMSConsentPage from "./pages/sms-consent";
import PrivacyPolicyPage from "./pages/privacy-policy";
import CallMetricsPage from "./pages/CallMetrics";
import Maintenance from "./pages/maintenance";
import Careers from "./pages/Careers";
import ShowcasePage from "./pages/Showcase";
import CleanMachineShowcase from "./pages/clean-machine-showcase";
import SecuritySettingsPage from "./pages/security-settings";
import TechnicianPage from "./pages/technician";
import ReferralPage from "./pages/ReferralPage";
import PhoneSettingsPage from "./pages/phone-settings";
import EmailSettingsPage from "./pages/email-settings";
import SipSetupGuide from "./pages/sip-setup-guide";
import Billing from "./pages/billing";
import EscalationsPage from "./pages/escalations";
import ReminderDashboard from "./pages/ReminderDashboard";
import SchedulingDashboard from "./pages/SchedulingDashboard";
import RequestPTO from "./pages/RequestPTO";
import AdminPTO from "./pages/AdminPTO";
import OpenShifts from "./pages/OpenShifts";
import ShiftTrades from "./pages/ShiftTrades";
import HomepageEditor from "./pages/HomepageEditor";
import UsageDashboard from "./pages/UsageDashboard";
import GalleryManagementPage from "./pages/gallery-management";
import DownloadExportPage from "./pages/download-export";
import LaunchPage from "./pages/launch";
import SetupCopilot from "./pages/SetupCopilot";
import SetupWizard from "./pages/SetupWizard";
import SettingsA2P from "./pages/SettingsA2P";
import AdminPortRecovery from "./pages/AdminPortRecovery";
import AdminPublicSiteSettings from "./pages/admin-public-site-settings";

// 🆕 Industry onboarding page
import OnboardingIndustryPage from "./pages/OnboardingIndustry";
import AdminIndustryImages from "./pages/AdminIndustryImages";

// Phase 15: Customer Portal (OTP Authentication)
import CustomerLogin from "./pages/CustomerLogin";
import CustomerPortalDashboard from "./pages/CustomerPortalDashboard";
import CustomerSettings from "./pages/CustomerSettings";

// Phase 16.5: Portal Welcome Page
import PortalWelcome from "./pages/PortalWelcome";

// Phase 9: Public Website Generator
import PublicSite from "./pages/PublicSite";

// Phase 7B: Pricing & Tier Comparison
import PricingPage from "./pages/PricingPage";

// Phase 7C: Stripe Billing Integration
import BillingSuccess from "./pages/BillingSuccess";
import SubscriptionPage from "./pages/subscription";

// Phase 26: Support System
import SupportCenter from "./pages/SupportCenter";
import AdminSupportTickets from "./pages/AdminSupportTickets";
import { SupportAssistantWidget } from "./components/SupportAssistantWidget";

function Router() {
  return (
    <Switch>
      {/* Phase 9: Public Website Generator (PUBLIC ROUTE - NO AUTH) */}
      <Route path="/site/:subdomain" component={PublicSite} />

      {/* Phase 7B: Pricing & Tier Comparison (PUBLIC ROUTE - NO AUTH) */}
      <Route path="/pricing" component={PricingPage} />

      {/* 🆕 PUBLIC INDUSTRY ONBOARDING ROUTE (NO AUTHGUARD FOR NOW) */}
      <Route path="/onboarding/industry" component={OnboardingIndustryPage} />
      
      {/* 🆕 ADMIN INDUSTRY IMAGE UPLOAD PAGE */}
      <Route path="/admin/industry-images">
        <AuthGuard>
          <AdminIndustryImages />
        </AuthGuard>
      </Route>

      {/* Existing routes below */}

      <Route path="/launch">
        <AuthGuard>
          <LaunchPage />
        </AuthGuard>
      </Route>

      <Route path="/export-download" component={DownloadExportPage} />
      <Route path="/maintenance" component={Maintenance} />

      <Route path="/showcase" component={ShowcasePage} />
      <Route path="/clean-machine" component={CleanMachineShowcase} />

      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/change-password" component={ChangePasswordPage} />

      <Route path="/approve/:token" component={PayerApprovalPage} />

      <Route
        path="/deposit-payment-success"
        component={lazy(() => import("./pages/deposit-payment-success"))}
      />
      <Route
        path="/deposit-payment-cancelled"
        component={lazy(() => import("./pages/deposit-payment-cancelled"))}
      />

      <Route path="/quote-approval/:token" component={QuoteApprovalPage} />

      <Route path="/dashboard">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      </Route>
      <Route path="/messages">
        <AuthGuard>
          <MessagesPage />
        </AuthGuard>
      </Route>
      <Route path="/phone">
        <AuthGuard>
          <PhonePage />
        </AuthGuard>
      </Route>
      <Route path="/call-metrics">
        <AuthGuard>
          <CallMetricsPage />
        </AuthGuard>
      </Route>
      <Route path="/facebook-settings">
        <AuthGuard>
          <FacebookSettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/quick-replies">
        <AuthGuard>
          <SettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/settings/a2p">
        <AuthGuard>
          <SettingsA2P />
        </AuthGuard>
      </Route>
      <Route path="/settings/email">
        <AuthGuard>
          <EmailSettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/admin/port-recovery">
        <AuthGuard>
          <AdminPortRecovery />
        </AuthGuard>
      </Route>
      <Route path="/admin/public-site-settings">
        <AuthGuard>
          <AdminPublicSiteSettings />
        </AuthGuard>
      </Route>
      <Route path="/settings/:section?/:item?">
        <AuthGuard>
          <SettingsAdmin />
        </AuthGuard>
      </Route>
      <Route path="/security-settings">
        <AuthGuard>
          <SecuritySettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/phone-settings">
        <AuthGuard>
          <PhoneSettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/sip-setup-guide">
        <AuthGuard>
          <SipSetupGuide />
        </AuthGuard>
      </Route>
      <Route path="/customer-database">
        <AuthGuard>
          <CustomerDatabasePage />
        </AuthGuard>
      </Route>
      <Route path="/business-settings">
        <AuthGuard>
          <BusinessSettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/banner-management">
        <AuthGuard>
          <BannerManagement />
        </AuthGuard>
      </Route>
      <Route path="/damage-assessment">
        <AuthGuard>
          <DamageAssessmentPage />
        </AuthGuard>
      </Route>
      <Route path="/user-management">
        <AuthGuard>
          <UserManagement />
        </AuthGuard>
      </Route>
      <Route path="/escalations">
        <AuthGuard>
          <EscalationsPage />
        </AuthGuard>
      </Route>
      <Route path="/reminders">
        <AuthGuard>
          <ReminderDashboard />
        </AuthGuard>
      </Route>
      <Route path="/notifications-settings">
        <AuthGuard>
          <NotificationsSettings />
        </AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard>
          <AnalyticsPage />
        </AuthGuard>
      </Route>
      <Route path="/billing">
        <AuthGuard>
          <Billing />
        </AuthGuard>
      </Route>

      {/* Phase 7C: Billing Success (after Stripe checkout) */}
      <Route path="/billing/success">
        <AuthGuard>
          <BillingSuccess />
        </AuthGuard>
      </Route>
      
      {/* Subscription/Plan Management */}
      <Route path="/subscription">
        <AuthGuard>
          <SubscriptionPage />
        </AuthGuard>
      </Route>
      
      <Route path="/admin/employees">
        <AuthGuard>
          <AdminEmployees />
        </AuthGuard>
      </Route>
      <Route path="/admin/jobs/:id">
        <AuthGuard>
          <AdminJobEditor />
        </AuthGuard>
      </Route>
      <Route path="/admin/quote-requests">
        <AuthGuard>
          <AdminQuoteRequests />
        </AuthGuard>
      </Route>
      <Route path="/admin/applications">
        <AuthGuard>
          <AdminApplications />
        </AuthGuard>
      </Route>
      <Route path="/admin/tenants">
        <AuthGuard>
          <AdminTenants />
        </AuthGuard>
      </Route>
      <Route path="/admin/tenants/:tenantId">
        <AuthGuard>
          <AdminTenantDetail />
        </AuthGuard>
      </Route>
      <Route path="/admin/promos">
        <AuthGuard>
          <AdminPromos />
        </AuthGuard>
      </Route>
      <Route path="/admin/phone-config">
        <AuthGuard>
          <AdminPhoneConfig />
        </AuthGuard>
      </Route>
      <Route path="/admin/ivr-config">
        <AuthGuard>
          <AdminIvrConfig />
        </AuthGuard>
      </Route>
      <Route path="/admin/concierge-setup">
        <AuthGuard>
          <AdminConciergeSetup />
        </AuthGuard>
      </Route>
      <Route path="/admin/suggestions">
        <AuthGuard>
          <PlatformSuggestions />
        </AuthGuard>
      </Route>
      <Route path="/suggestions">
        <AuthGuard>
          <TenantSuggestions />
        </AuthGuard>
      </Route>
      <Route path="/admin/customer-suggestions">
        <AuthGuard>
          <AdminCustomerSuggestions />
        </AuthGuard>
      </Route>
      {/* Phase 26: Support System */}
      <Route path="/support">
        <AuthGuard>
          <SupportCenter />
        </AuthGuard>
      </Route>
      <Route path="/admin/support-tickets">
        <AuthGuard>
          <AdminSupportTickets />
        </AuthGuard>
      </Route>
      <Route path="/admin/theme-gallery">
        <AuthGuard>
          <ThemeGallery />
        </AuthGuard>
      </Route>
      <Route path="/admin/scheduling">
        <AuthGuard>
          <SchedulingDashboard />
        </AuthGuard>
      </Route>
      <Route path="/admin/pto">
        <AuthGuard>
          <AdminPTO />
        </AuthGuard>
      </Route>
      <Route path="/admin/homepage-editor">
        <AuthGuard>
          <HomepageEditor />
        </AuthGuard>
      </Route>
      <Route path="/admin/usage-dashboard">
        <AuthGuard>
          <UsageDashboard />
        </AuthGuard>
      </Route>
      <Route path="/admin/gallery-management">
        <AuthGuard>
          <GalleryManagementPage />
        </AuthGuard>
      </Route>
      <Route path="/admin/banner-management">
        <AuthGuard>
          <BannerManagement />
        </AuthGuard>
      </Route>
      <Route path="/admin/setup-copilot">
        <AuthGuard>
          <SetupCopilot />
        </AuthGuard>
      </Route>
      
      {/* Setup Wizard - post-signup onboarding flow */}
      <Route path="/setup-wizard">
        <AuthGuard>
          <SetupWizard />
        </AuthGuard>
      </Route>

      <Route path="/technician">
        <AuthGuard>
          <TechnicianPage />
        </AuthGuard>
      </Route>
      <Route path="/tech/wizard">
        <AuthGuard>
          <TechWizard />
        </AuthGuard>
      </Route>
      <Route path="/tech/profile">
        <AuthGuard>
          <TechProfile />
        </AuthGuard>
      </Route>
      <Route path="/tech/schedule">
        <AuthGuard>
          <TechnicianSchedule />
        </AuthGuard>
      </Route>
      <Route path="/tech/pto">
        <AuthGuard>
          <RequestPTO />
        </AuthGuard>
      </Route>
      <Route path="/tech/open-shifts">
        <AuthGuard>
          <OpenShifts />
        </AuthGuard>
      </Route>
      <Route path="/tech/shift-trades">
        <AuthGuard>
          <ShiftTrades />
        </AuthGuard>
      </Route>

      <Route path="/p/:publicId" component={TechProfilePublic} />

      <Route path="/chat" component={ChatPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/book" component={SchedulePage} />
      <Route path="/quick-booking" component={QuickBookingPage} />
      <Route path="/directions" component={DirectionsPage} />
      <Route path="/service-history" component={ServiceHistoryPage} />
      <Route path="/demo" component={DemoPage} />
      <Route path="/rewards" component={LoyaltyPointsPage} />
      <Route path="/referrals">
        <AuthGuard>
          <ReferralPage />
        </AuthGuard>
      </Route>
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/reviews" component={ReviewsPage} />
      <Route path="/my-services" component={CustomerRecurringServicesPage} />
      <Route
        path="/recurring-booking/:serviceId"
        component={RecurringServiceBookingPage}
      />
      <Route path="/sms-consent" component={SMSConsentPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/careers" component={Careers} />

      {/* Phase 15 & 16.5: Customer Portal Routes */}
      <Route path="/portal/welcome" component={PortalWelcome} />
      <Route path="/portal/login" component={CustomerLogin} />
      <Route path="/portal/settings" component={CustomerSettings} />
      <Route path="/portal" component={CustomerPortalDashboard} />

      {/* Customer-facing homepage for Clean Machine (tenant booking site) */}
      <Route path="/home" component={HomePage} />
      
      {/* Public landing page for ServicePro platform */}
      <Route path="/" component={LandingPage} />
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
          <Toaster />
          <PasswordChangeModal />
          <BannerDisplay />
          <Router />
          {!isCustomerFacingPage() &&
            !location.startsWith("/dashboard") &&
            !location.startsWith("/messages") &&
            !location.startsWith("/phone") &&
            !location.startsWith("/notifications-settings") && (
              <DashboardNavButton />
            )}
          <SupportAssistantWidget />
        </PwaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
