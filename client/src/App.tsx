import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useKeyboardDismiss } from "@/hooks/useKeyboardDismiss";
import { PwaProvider } from "@/contexts/PwaContext";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import DirectionsPage from "@/pages/directions";
import ServiceHistoryPage from "@/pages/service-history";
import Dashboard from "@/pages/dashboard";
import LiveConversationsPage from "@/pages/live-conversations";
import ConversationInsightsPage from "@/pages/conversation-insights";
import CustomerDatabasePage from "@/pages/customer-database";
import BusinessSettingsPage from "@/pages/business-settings";
import BannerManagement from "@/pages/banner-management";
import BannerDisplay from "@/components/BannerDisplay";
import DamageAssessmentPage from "@/pages/damage-assessment";
import DemoPage from "@/pages/demo";
import HomePage from "@/pages/home";
import SchedulePage from "@/pages/Schedule";
import QuickBookingPage from "@/pages/quick-booking";
import LoyaltyPointsPage from "@/pages/rewards";
import DashboardNavButton from "@/components/DashboardNavButton";
import GalleryPage from './pages/gallery';
import ReviewsPage from './pages/reviews';
import MonitorDashboard from './pages/monitor';
import MessagesPage from './pages/messages';
import PhonePage from './pages/phone';
import SettingsPage from './pages/settings';
import SettingsAdmin from './pages/settings-admin';
import SmsMonitoringPage from './pages/sms-monitoring';
import FacebookSettingsPage from './pages/facebook-settings';
import LoginPage from './pages/login';
import ForgotPasswordPage from './pages/forgot-password';
import ResetPasswordPage from './pages/reset-password';
import ChangePasswordPage from './pages/change-password';
import AuthGuard from './components/AuthGuard';
import UserManagement from './pages/user-management';
import PasswordChangeModal from './components/PasswordChangeModal';
import NotificationsSettings from './pages/notifications-settings';
import AnalyticsPage from './pages/analytics';
import CustomerRecurringServicesPage from './pages/customer-recurring-services';
import RecurringServiceBookingPage from './pages/recurring-service-booking';
import TechWizard from './pages/tech-wizard';
import TechProfile from './pages/tech-profile';
import TechProfilePublic from './pages/tech-profile-public';
import TechnicianSchedule from './pages/TechnicianSchedule';
import AdminEmployees from './pages/admin-employees';
import AdminJobEditor from './pages/admin-job-editor';
import AdminQuoteRequests from './pages/admin-quote-requests';
import AdminApplications from './pages/AdminApplications';
import PayerApprovalPage from './pages/payer-approval';
import QuoteApprovalPage from './pages/quote-approval';
import SMSConsentPage from './pages/sms-consent';
import PrivacyPolicyPage from './pages/privacy-policy';
import CallMetricsPage from './pages/CallMetrics';
import Maintenance from './pages/maintenance';
import Careers from './pages/Careers';
import ShowcasePage from './pages/Showcase';
import CleanMachineShowcase from './pages/clean-machine-showcase';
import SecuritySettingsPage from './pages/security-settings';
import TechnicianPage from './pages/technician';
import ReferralPage from './pages/ReferralPage';
import PhoneSettingsPage from './pages/phone-settings';
import Billing from './pages/billing';
import EscalationsPage from './pages/escalations';
import ReminderDashboard from './pages/ReminderDashboard';
import SchedulingDashboard from './pages/SchedulingDashboard';
import RequestPTO from './pages/RequestPTO';
import AdminPTO from './pages/AdminPTO';
import OpenShifts from './pages/OpenShifts';
import ShiftTrades from './pages/ShiftTrades';
import HomepageEditor from './pages/HomepageEditor';
import UsageDashboard from './pages/UsageDashboard';

function Router() {
  return (
    <Switch>
      {/* Public maintenance page */}
      <Route path="/maintenance" component={Maintenance} />
      
      {/* Public showcase/demo pages */}
      <Route path="/showcase" component={ShowcasePage} />
      <Route path="/clean-machine" component={CleanMachineShowcase} />
      
      {/* Public authentication routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      
      {/* Public payer approval (no auth required) */}
      <Route path="/approve/:token" component={PayerApprovalPage} />
      
      {/* Public quote approval (no auth required) */}
      <Route path="/quote-approval/:token" component={QuoteApprovalPage} />

      {/* Protected admin routes */}
      <Route path="/dashboard">
        <AuthGuard><Dashboard /></AuthGuard>
      </Route>
      <Route path="/monitor">
        <AuthGuard><MonitorDashboard /></AuthGuard>
      </Route>
      <Route path="/messages">
        <AuthGuard><MessagesPage /></AuthGuard>
      </Route>
      <Route path="/phone">
        <AuthGuard><PhonePage /></AuthGuard>
      </Route>
      <Route path="/call-metrics">
        <AuthGuard><CallMetricsPage /></AuthGuard>
      </Route>
      <Route path="/sms-monitoring">
        <AuthGuard><SmsMonitoringPage /></AuthGuard>
      </Route>
      <Route path="/facebook-settings">
        <AuthGuard><FacebookSettingsPage /></AuthGuard>
      </Route>
      <Route path="/quick-replies">
        <AuthGuard><SettingsPage /></AuthGuard>
      </Route>
      <Route path="/settings/:section?/:item?">
        <AuthGuard><SettingsAdmin /></AuthGuard>
      </Route>
      <Route path="/security-settings">
        <AuthGuard><SecuritySettingsPage /></AuthGuard>
      </Route>
      <Route path="/phone-settings">
        <AuthGuard><PhoneSettingsPage /></AuthGuard>
      </Route>
      <Route path="/live-conversations">
        <AuthGuard><LiveConversationsPage /></AuthGuard>
      </Route>
      <Route path="/conversation-insights">
        <AuthGuard><ConversationInsightsPage /></AuthGuard>
      </Route>
      <Route path="/customer-database">
        <AuthGuard><CustomerDatabasePage /></AuthGuard>
      </Route>
      <Route path="/business-settings">
        <AuthGuard><BusinessSettingsPage /></AuthGuard>
      </Route>
      <Route path="/banner-management">
        <AuthGuard><BannerManagement /></AuthGuard>
      </Route>
      <Route path="/damage-assessment">
        <AuthGuard><DamageAssessmentPage /></AuthGuard>
      </Route>
      <Route path="/user-management">
        <AuthGuard><UserManagement /></AuthGuard>
      </Route>
      <Route path="/escalations">
        <AuthGuard><EscalationsPage /></AuthGuard>
      </Route>
      <Route path="/reminders">
        <AuthGuard><ReminderDashboard /></AuthGuard>
      </Route>
      <Route path="/notifications-settings">
        <AuthGuard><NotificationsSettings /></AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard><AnalyticsPage /></AuthGuard>
      </Route>
      <Route path="/billing">
        <AuthGuard><Billing /></AuthGuard>
      </Route>
      <Route path="/admin/employees">
        <AuthGuard><AdminEmployees /></AuthGuard>
      </Route>
      <Route path="/admin/jobs/:id">
        <AuthGuard><AdminJobEditor /></AuthGuard>
      </Route>
      <Route path="/admin/quote-requests">
        <AuthGuard><AdminQuoteRequests /></AuthGuard>
      </Route>
      <Route path="/admin/applications">
        <AuthGuard><AdminApplications /></AuthGuard>
      </Route>
      <Route path="/admin/scheduling">
        <AuthGuard><SchedulingDashboard /></AuthGuard>
      </Route>
      <Route path="/admin/pto">
        <AuthGuard><AdminPTO /></AuthGuard>
      </Route>
      <Route path="/admin/homepage-editor">
        <AuthGuard><HomepageEditor /></AuthGuard>
      </Route>
      <Route path="/admin/usage-dashboard">
        <AuthGuard><UsageDashboard /></AuthGuard>
      </Route>

      {/* Technician portal routes */}
      <Route path="/technician">
        <AuthGuard><TechnicianPage /></AuthGuard>
      </Route>
      <Route path="/tech/wizard" component={TechWizard} />
      <Route path="/tech/profile" component={TechProfile} />
      <Route path="/tech/schedule">
        <AuthGuard><TechnicianSchedule /></AuthGuard>
      </Route>
      <Route path="/tech/pto">
        <AuthGuard><RequestPTO /></AuthGuard>
      </Route>
      <Route path="/tech/open-shifts">
        <AuthGuard><OpenShifts /></AuthGuard>
      </Route>
      <Route path="/tech/shift-trades">
        <AuthGuard><ShiftTrades /></AuthGuard>
      </Route>
      
      {/* Public tech profile (no auth required) */}
      <Route path="/p/:publicId" component={TechProfilePublic} />

      {/* Customer-facing pages (not protected) */}
      <Route path="/chat" component={ChatPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/book" component={SchedulePage} />
      <Route path="/quick-booking" component={QuickBookingPage} />
      <Route path="/directions" component={DirectionsPage} />
      <Route path="/service-history" component={ServiceHistoryPage} />
      <Route path="/demo" component={DemoPage} />
      <Route path="/rewards" component={LoyaltyPointsPage} />
      <Route path="/referrals">
        <AuthGuard><ReferralPage /></AuthGuard>
      </Route>
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/reviews" component={ReviewsPage} />
      <Route path="/my-services" component={CustomerRecurringServicesPage} />
      <Route path="/recurring-booking/:serviceId" component={RecurringServiceBookingPage} />
      <Route path="/sms-consent" component={SMSConsentPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/careers" component={Careers} />

      {/* Home route must come after other routes */}
      <Route path="/" component={HomePage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Get current location to determine if we're on an admin page
  const [location] = useLocation();
  
  // Universal keyboard auto-dismiss for mobile
  useKeyboardDismiss();

  // Check if current page is a customer-facing page
  const isCustomerFacingPage = () => {
    const adminPages = [
      '/dashboard', 
      '/live-conversations', 
      '/conversation-insights',
      '/customer-database',
      '/business-settings',
      '/damage-assessment',
      '/formatter-test',
      '/monitor',
      '/messages',
      '/sms-monitoring',
      '/facebook-settings',
      '/settings',
      '/admin/employees',
      '/admin/jobs',
      '/admin/quote-requests'
    ];
    return !adminPages.some(page => location.startsWith(page));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <PwaProvider>
        <Toaster />
        <PasswordChangeModal />
        <BannerDisplay />
        <Router />
        {/* Only show dashboard button on admin pages (except dashboard, messages, phone which have own nav) */}
        {!isCustomerFacingPage() && !location.startsWith('/dashboard') && !location.startsWith('/messages') && !location.startsWith('/phone') && !location.startsWith('/notifications-settings') && <DashboardNavButton />}
      </PwaProvider>
    </QueryClientProvider>
  );
}

export default App;