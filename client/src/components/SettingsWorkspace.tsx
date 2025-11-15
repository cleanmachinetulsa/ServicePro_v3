import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Menu, Settings as SettingsIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { settingsSections } from "@/config/settingsSections";

interface SettingsWorkspaceProps {
  initialSection?: string;
  initialItem?: string;
}

export default function SettingsWorkspace({ initialSection, initialItem }: SettingsWorkspaceProps = {}) {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState(initialSection || 'operations');
  const [activeItem, setActiveItem] = useState(initialItem || 'services');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync initial props to state when they change
  useEffect(() => {
    if (initialSection && initialSection !== activeSection) {
      setActiveSection(initialSection);
    }
    if (initialItem && initialItem !== activeItem) {
      setActiveItem(initialItem);
    }
  }, [initialSection, initialItem]);

  // Sync URL when active section/item changes
  useEffect(() => {
    // Only update URL if we're on a settings page (check current location)
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/settings')) {
      // Update URL to reflect current section and item
      setLocation(`/settings/${activeSection}/${activeItem}`);
    }
  }, [activeSection, activeItem, setLocation]);

  // Find active item component
  const ActiveComponent = settingsSections
    .flatMap(s => s.items)
    .find(item => item.id === activeItem)?.component || null;

  // Sidebar navigation component
  const SidebarNavigation = ({ isMobile = false, collapsed = false }: { isMobile?: boolean; collapsed?: boolean }) => (
    <div className={`space-y-2 ${isMobile ? 'p-4' : ''}`}>
      <div className={`flex items-center mb-4 px-3 ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <SettingsIcon className="h-5 w-5 text-primary" />
        {!collapsed && <h2 className="text-lg font-semibold">Settings</h2>}
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
              <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground ${collapsed ? 'justify-center' : ''}`}>
                {section.icon}
                {!collapsed && <span>{section.label}</span>}
              </div>
              {section.items.map(item => (
                <Button
                  key={item.id}
                  variant={activeItem === item.id ? "secondary" : "ghost"}
                  className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start pl-9'}`}
                  onClick={() => {
                    setActiveItem(item.id);
                    setActiveSection(section.id);
                  }}
                  data-testid={`settings-item-${item.id}`}
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed ? item.label.charAt(0) : item.label}
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

      {/* Desktop Sidebar - Collapsible on large screens */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}>
        <Card className="sticky top-4 relative">
          {/* Collapse/Expand Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-md"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <SidebarNavigation collapsed={sidebarCollapsed} />
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

