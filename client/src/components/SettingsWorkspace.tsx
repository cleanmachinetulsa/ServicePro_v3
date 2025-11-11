import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AgentSettings from "./AgentSettings";
import BusinessSettings from "../pages/business-settings";
import NotificationsSettings from "../pages/notifications-settings";
import { UpsellManagement } from "./UpsellManagement";
import RecurringServicesManager from "./RecurringServicesManager";
import { EmailCampaignsManager } from "./EmailCampaignsManager";
import CancellationDemo from "./CancellationDemo";
import SubscriptionManager from "./SubscriptionManager";
import { PhoneSettings } from "./PhoneSettings";
import ServicesManagement from "./ServicesManagement";
import { CustomerManagement } from "./CustomerManagement";
import { LoyaltyPointsSystem } from "./LoyaltyPointsSystem";
import GalleryPhotoManager from "./GalleryPhotoManager";
import { 
  Menu, 
  Settings as SettingsIcon, 
  Wrench, 
  MessageSquare, 
  Building, 
  Users, 
  Shield,
  Phone,
  Image,
  Award
} from "lucide-react";

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  label: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

export default function SettingsWorkspace() {
  const [activeSection, setActiveSection] = useState('operations');
  const [activeItem, setActiveItem] = useState('services');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Settings hierarchy configuration - ALL legacy features included
  const settingsSections: SettingsSection[] = [
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
        { id: 'gallery', label: 'Gallery Photos', component: GalleryPhotoManager },
      ]
    },
    {
      id: 'communications',
      label: 'Communications',
      icon: <MessageSquare className="h-4 w-4" />,
      items: [
        { id: 'notifications', label: 'Notifications', component: NotificationsSettings },
        { id: 'upsell', label: 'Upsell Offers', component: UpsellManagement },
        { id: 'cancellation', label: 'Cancellation Feedback', component: CancellationDemo },
        { id: 'email-campaigns', label: 'Email Campaigns', component: EmailCampaignsManager },
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
  ];

  // Find active item component
  const ActiveComponent = settingsSections
    .flatMap(s => s.items)
    .find(item => item.id === activeItem)?.component || null;

  // Sidebar navigation component
  const SidebarNavigation = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`space-y-2 ${isMobile ? 'p-4' : ''}`}>
      <div className="flex items-center gap-2 mb-4 px-3">
        <SettingsIcon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>
      
      {isMobile ? (
        <Accordion type="single" collapsible className="w-full">
          {settingsSections.map(section => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <span>{section.label}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-1 pl-6">
                  {section.items.map(item => (
                    <Button
                      key={item.id}
                      variant={activeItem === item.id ? "secondary" : "ghost"}
                      className="justify-start"
                      onClick={() => {
                        setActiveItem(item.id);
                        setActiveSection(section.id);
                        setMobileMenuOpen(false);
                      }}
                      data-testid={`settings-item-${item.id}`}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="space-y-1">
          {settingsSections.map(section => (
            <div key={section.id} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
                {section.icon}
                <span>{section.label}</span>
              </div>
              {section.items.map(item => (
                <Button
                  key={item.id}
                  variant={activeItem === item.id ? "secondary" : "ghost"}
                  className="w-full justify-start pl-9"
                  onClick={() => {
                    setActiveItem(item.id);
                    setActiveSection(section.id);
                  }}
                  data-testid={`settings-item-${item.id}`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Mobile/Tablet Collapsible Menu */}
      <div className="lg:hidden w-full">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="default" size="default" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Menu className="h-5 w-5 mr-2" />
              Settings Menu - Click to Open
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[350px]">
            <SidebarNavigation isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar - Always visible on large screens */}
      <div className="hidden lg:block lg:w-72 flex-shrink-0">
        <Card className="sticky top-4">
          <ScrollArea className="h-[calc(100vh-120px)]">
            <SidebarNavigation />
          </ScrollArea>
        </Card>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full min-w-0">
        {ActiveComponent ? <ActiveComponent /> : (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Select a settings item from the menu</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

