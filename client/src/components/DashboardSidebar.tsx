import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Home, Users, MessageSquare, Image, TrendingUp, Settings, Shield, Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

export function DashboardSidebar({ 
  collapsed, 
  onToggle, 
  activeTab, 
  onTabChange,
  mobileOpen = false,
  onMobileOpenChange = () => {}
}: SidebarProps) {
  // 8-tab structure with Security and Technician Hub as first-class navigation
  const navigationItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'gallery', label: 'Gallery', icon: Image },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'technician', label: 'Technician', icon: Wrench },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (itemId: string) => {
    onTabChange(itemId);
    // Close mobile sheet when item is clicked
    onMobileOpenChange(false);
  };

  const renderNavItems = (isMobile = false) => {
    return (
      <div className="space-y-1">
        {navigationItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            className={`w-full ${
              (collapsed && !isMobile) ? 'justify-center px-2' : 'justify-start'
            } ${
              activeTab === item.id
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-blue-200 hover:bg-blue-900 hover:text-white'
            }`}
            onClick={() => handleNavClick(item.id)}
            data-testid={`sidebar-nav-${item.id}`}
          >
            <item.icon className={`h-4 w-4 ${(collapsed && !isMobile) ? '' : 'mr-2'}`} />
            {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
          </Button>
        ))}
      </div>
    );
  };

  // Desktop sidebar (hidden on mobile)
  const DesktopSidebar = () => (
    <aside
      className={`hidden md:flex ${
        collapsed ? 'w-16' : 'w-64'
      } bg-blue-950 border-r border-blue-800 transition-all duration-300 flex-col h-full`}
    >
      {/* Sidebar Header with Toggle */}
      <div className="p-4 flex items-center justify-between border-b border-blue-800">
        {!collapsed && <h2 className="font-semibold text-white">Navigation</h2>}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-white hover:bg-blue-900"
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-2">
          {renderNavItems()}
        </div>
      </nav>

      {/* Sidebar Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-blue-800 text-xs text-blue-300">
          <p>Clean Machine Dashboard</p>
          <p className="text-blue-400">v1.0.0</p>
        </div>
      )}
    </aside>
  );

  // Mobile sidebar (Sheet drawer)
  const MobileSidebar = () => (
    <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <SheetContent side="left" className="w-64 bg-blue-950 border-blue-800 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-blue-800 flex-shrink-0">
          <SheetTitle className="text-white">Navigation</SheetTitle>
        </SheetHeader>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-2">
            {renderNavItems(true)}
          </div>
        </nav>

        <div className="p-4 border-t border-blue-800 text-xs text-blue-300 flex-shrink-0">
          <p>Clean Machine Dashboard</p>
          <p className="text-blue-400">v1.0.0</p>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
