import { 
  Wrench, 
  Users, 
  MessageSquare, 
  Building,
  Palette,
  Shield
} from "lucide-react";
import AgentSettings from "../components/AgentSettings";
import BusinessSettings from "../pages/business-settings";
import NotificationsSettings from "../pages/notifications-settings";
import { UpsellManagement } from "../components/UpsellManagement";
import RecurringServicesManager from "../components/RecurringServicesManager";
import { EmailCampaignsManager } from "../components/EmailCampaignsManager";
import { SmsTemplatesManager } from "../components/SmsTemplatesManager";
import EmailTemplatesManager from "../components/EmailTemplatesManager";
import CancellationDemo from "../components/CancellationDemo";
import SubscriptionManager from "../components/SubscriptionManager";
import { PhoneSettings } from "../components/PhoneSettings";
import ServicesManagement from "../components/ServicesManagement";
import { CustomerManagement } from "../components/CustomerManagement";
import { LoyaltyPointsSystem } from "../components/LoyaltyPointsSystem";
import AdminReferralStats from "../components/AdminReferralStats";
import HomepageEditor from "../pages/HomepageEditor";
import DemoModeSettings from "../components/settings/DemoModeSettings";

export interface SettingsItem {
  id: string;
  label: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

export interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

export const settingsSections: SettingsSection[] = [
  {
    id: 'operations',
    label: 'Operations',
    icon: <Wrench className="h-4 w-4" />,
    items: [
      { id: 'services', label: 'Services & Add-ons', component: ServicesManagement },
      { id: 'recurring', label: 'Recurring Services', component: RecurringServicesManager },
      { id: 'phone-settings', label: 'Phone & Voice', component: PhoneSettings },
    ]
  },
  {
    id: 'customers',
    label: 'Customer Management',
    icon: <Users className="h-4 w-4" />,
    items: [
      { id: 'customer-management', label: 'Customer Database', component: CustomerManagement },
      { id: 'loyalty', label: 'Loyalty Program', component: LoyaltyPointsSystem },
      { id: 'referrals', label: 'Referral Program', component: AdminReferralStats },
    ]
  },
  {
    id: 'communications',
    label: 'Communications',
    icon: <MessageSquare className="h-4 w-4" />,
    items: [
      { id: 'notifications', label: 'Notifications', component: NotificationsSettings },
      { id: 'sms-templates', label: 'SMS Templates', component: SmsTemplatesManager },
      { id: 'email-templates', label: 'Email Templates', component: EmailTemplatesManager },
      { id: 'email-campaigns', label: 'Email Campaigns', component: EmailCampaignsManager },
      { id: 'upsell', label: 'Upsell Offers', component: UpsellManagement },
      { id: 'cancellation', label: 'Cancellation Feedback', component: CancellationDemo },
    ]
  },
  {
    id: 'business',
    label: 'Business',
    icon: <Building className="h-4 w-4" />,
    items: [
      { id: 'business-settings', label: 'Business Settings', component: BusinessSettings },
      { id: 'agent-settings', label: 'Agent Settings', component: AgentSettings },
      { id: 'subscriptions', label: 'Subscription Plans', component: SubscriptionManager },
    ]
  },
  {
    id: 'website',
    label: 'Website & Branding',
    icon: <Palette className="h-4 w-4" />,
    items: [
      { id: 'homepage-editor', label: 'Homepage Editor', component: HomepageEditor },
    ]
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield className="h-4 w-4" />,
    items: [
      { id: 'demo-mode', label: 'Demo Mode', component: DemoModeSettings },
    ]
  },
];

// Helper function to find section for an item ID
export const findSectionForItem = (itemId: string): string | null => {
  for (const section of settingsSections) {
    if (section.items.some(item => item.id === itemId)) {
      return section.id;
    }
  }
  return null;
};

// Helper function to validate that an item exists in a section
export const isValidItem = (sectionId: string, itemId: string): boolean => {
  const section = settingsSections.find(s => s.id === sectionId);
  return section ? section.items.some(item => item.id === itemId) : false;
};

// Helper function to check if a section exists
export const isSectionValid = (sectionId: string): boolean => {
  return settingsSections.some(s => s.id === sectionId);
};
