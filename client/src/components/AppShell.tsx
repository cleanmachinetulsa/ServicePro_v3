import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AiHelpSearch } from '@/components/AiHelpSearch';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { navigationItems } from '@/config/navigationItems';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface AuthContext {
  success: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  };
  impersonation: {
    isActive: boolean;
    tenantId: string | null;
    tenantName: string | null;
    startedAt: string | null;
  };
}

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
  pageActions?: React.ReactNode;
  sidebarActions?: React.ReactNode;
}

export function AppShell({ 
  children, 
  title, 
  showSearch = true, 
  pageActions,
  sidebarActions
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const { data: authContext } = useQuery<AuthContext>({
    queryKey: ['/api/auth/context'],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const handleNavigate = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location === '/' || location === '/dashboard';
    }
    return location.startsWith(path);
  };

  const renderNavigationItems = (isMobile = false) => {
    // Filter out owner-only items when impersonating
    const ownerOnlyIds = ['concierge-setup', 'tenants', 'phone-config'];
    const isImpersonating = authContext?.impersonation?.isActive || false;
    
    const filteredItems = isImpersonating
      ? navigationItems.filter(item => !ownerOnlyIds.includes(item.id))
      : navigationItems;

    return (
      <nav className="space-y-1" data-tour-id="sidebar-nav">
        {filteredItems.map((item) => {
          if (item.separator) {
            return (
              <div key={item.id} className="my-3">
                {item.sectionHeader && (
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 mb-2">
                    {item.sectionHeader}
                  </p>
                )}
                <Separator className="my-1" />
              </div>
            );
          }

          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <Button
              key={item.id}
              variant={active ? 'default' : 'ghost'}
              className={`w-full justify-start ${
                active
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleNavigate(item.path)}
              data-testid={`nav-${item.id}`}
              data-tour-id={`nav-${item.id}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar (≥lg) */}
      <aside className="hidden lg:flex lg:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
            Clean Machine
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Business Dashboard
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-2">
          <div className="px-2 mb-4">
            <AiHelpSearch />
          </div>
          {sidebarActions && (
            <div className="mb-4 px-2">
              {sidebarActions}
              <Separator className="mt-4" />
            </div>
          )}
          {renderNavigationItems()}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <p>© 2025 Clean Machine</p>
          <p className="text-gray-400 dark:text-gray-500">v1.0.0</p>
        </div>
      </aside>

      {/* Mobile Drawer (<lg) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent 
          side="left" 
          className="w-64 p-0 bg-white dark:bg-gray-900 flex flex-col"
        >
          <SheetHeader className="p-4 border-b border-gray-200 dark:border-gray-800">
            <SheetTitle className="text-gray-900 dark:text-white">
              Clean Machine
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 px-2">
            <div className="px-2 mb-4">
              <AiHelpSearch />
            </div>
            {sidebarActions && (
              <div className="mb-4 px-2">
                {sidebarActions}
                <Separator className="mt-4" />
              </div>
            )}
            {renderNavigationItems(true)}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <p>© 2025 Clean Machine</p>
            <p className="text-gray-400 dark:text-gray-500">v1.0.0</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Impersonation Banner */}
        <ImpersonationBanner />
        
        {/* Top Bar */}
        <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center gap-1 sm:gap-3 p-2 sm:p-4 min-h-14">
            {/* Hamburger (mobile only) - ALWAYS VISIBLE AND NEVER SHRINKS */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0 h-10 w-10"
              onClick={() => setDrawerOpen(true)}
              data-testid="button-hamburger-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Page Title */}
            {title && (
              <h1 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate flex-shrink">
                {title}
              </h1>
            )}

            {/* Search */}
            {showSearch && (
              <div className="flex-1 max-w-md hidden sm:block" data-tour-id="ai-help-search">
                <AiHelpSearch />
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Page Actions - Always visible, compact on mobile */}
            {pageActions && (
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {pageActions}
              </div>
            )}

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-gray-700 dark:text-gray-300 flex-shrink-0 h-10 w-10"
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
