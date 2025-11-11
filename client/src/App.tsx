import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { useState, useEffect, useRef } from "react";
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
import { QuickActionButton } from "@/components/QuickActionButton";
import GalleryPage from './pages/gallery';
import ReviewsPage from './pages/reviews';
import MonitorDashboard from './pages/monitor';
import MessagesPage from './pages/messages';
import PhonePage from './pages/phone';
import SettingsPage from './pages/settings';
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
import AdminEmployees from './pages/admin-employees';
import AdminJobEditor from './pages/admin-job-editor';
import AdminQuoteRequests from './pages/admin-quote-requests';
import PayerApprovalPage from './pages/payer-approval';
import QuoteApprovalPage from './pages/quote-approval';
import SMSConsentPage from './pages/sms-consent';
import PrivacyPolicyPage from './pages/privacy-policy';
import CallMetricsPage from './pages/CallMetrics';
import Maintenance from './pages/maintenance';
import ShowcasePage from './pages/showcase';
import SecuritySettingsPage from './pages/security-settings';

// Helper function to render routes for a specific location
function renderRoutes(loc: string) {
  return (
    <Switch location={loc}>
      {/* Public maintenance page */}
      <Route path="/maintenance" component={Maintenance} />
      
      {/* Public showcase/demo page */}
      <Route path="/showcase" component={ShowcasePage} />
      
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
      <Route path="/settings">
        <AuthGuard><SettingsPage /></AuthGuard>
      </Route>
      <Route path="/security-settings">
        <AuthGuard><SecuritySettingsPage /></AuthGuard>
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
      <Route path="/notifications-settings">
        <AuthGuard><NotificationsSettings /></AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard><AnalyticsPage /></AuthGuard>
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

      {/* Technician portal routes */}
      <Route path="/tech/wizard" component={TechWizard} />
      <Route path="/tech/profile" component={TechProfile} />
      
      {/* Public tech profile (no auth required) */}
      <Route path="/p/:publicId" component={TechProfilePublic} />

      {/* Customer-facing pages (not protected) */}
      <Route path="/chat" component={ChatPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/quick-booking" component={QuickBookingPage} />
      <Route path="/directions" component={DirectionsPage} />
      <Route path="/service-history" component={ServiceHistoryPage} />
      <Route path="/demo" component={DemoPage} />
      <Route path="/rewards" component={LoyaltyPointsPage} />
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/reviews" component={ReviewsPage} />
      <Route path="/my-services" component={CustomerRecurringServicesPage} />
      <Route path="/recurring-booking/:serviceId" component={RecurringServiceBookingPage} />
      <Route path="/sms-consent" component={SMSConsentPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />

      {/* Home route must come after other routes */}
      <Route path="/" component={HomePage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const [currentLocation] = useLocation();
  const [activeLocation, setActiveLocation] = useState(currentLocation);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const navigationHistory = useRef<string[]>([currentLocation]);
  const historyIndex = useRef(0);
  const direction = useRef<'forward' | 'back'>('forward');

  useEffect(() => {
    if (currentLocation !== activeLocation) {
      // Check if this is a back navigation (location exists earlier in history)
      const previousIndex = navigationHistory.current.findIndex(
        (loc, idx) => idx < historyIndex.current && loc === currentLocation
      );
      
      if (previousIndex !== -1) {
        // Going back in history
        direction.current = 'back';
        historyIndex.current = previousIndex;
      } else {
        // Going forward (new page or re-visiting)
        direction.current = 'forward';
        historyIndex.current++;
        navigationHistory.current = [
          ...navigationHistory.current.slice(0, historyIndex.current),
          currentLocation
        ];
      }
      
      setPendingLocation(currentLocation);
    }
  }, [currentLocation, activeLocation]);

  const handleExitComplete = () => {
    if (pendingLocation) {
      setActiveLocation(pendingLocation);
      setPendingLocation(null);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'hidden', minHeight: '100vh' }}>
      <AnimatePresence mode="sync" initial={false} onExitComplete={handleExitComplete}>
        {/* Render outgoing page when navigation occurs */}
        {pendingLocation && (
          <PageTransition 
            key={activeLocation} 
            phase="outgoing" 
            direction={direction.current}
          >
            {renderRoutes(activeLocation)}
          </PageTransition>
        )}
        
        {/* Render incoming/active page */}
        <PageTransition 
          key={pendingLocation || activeLocation} 
          phase="incoming" 
          direction={direction.current}
        >
          {renderRoutes(pendingLocation || activeLocation)}
        </PageTransition>
      </AnimatePresence>
    </div>
  );
}

function App() {
  // Get current location to determine if we're on an admin page
  const [location] = useLocation();

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
      '/admin/employees',
      '/admin/jobs',
      '/admin/quote-requests'
    ];
    return !adminPages.some(page => location.startsWith(page));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PasswordChangeModal />
        <BannerDisplay />
        <Router />
        {/* Only show dashboard button on admin pages (except dashboard, messages, phone which have own nav) */}
        {!isCustomerFacingPage() && !location.startsWith('/dashboard') && !location.startsWith('/messages') && !location.startsWith('/phone') && !location.startsWith('/notifications-settings') && <DashboardNavButton />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;