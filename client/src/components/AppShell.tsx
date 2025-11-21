import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AiHelpSearch } from '@/components/AiHelpSearch';
import { navigationItems } from '@/config/navigationItems';
import { Menu } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
  pageActions?: React.ReactNode;
}

export function AppShell({ 
  children, 
  title, 
  showSearch = true, 
  pageActions 
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [location, navigate] = useLocation();

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
    return (
      <nav className="space-y-1">
        {navigationItems.map((item) => {
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
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar (≥lg) */}
      <aside className="hidden lg:flex lg:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
            Clean Machine
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ServicePro Dashboard
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-2">
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ServicePro Dashboard
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 px-2">
            {renderNavigationItems(true)}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <p>© 2025 Clean Machine</p>
            <p className="text-gray-400 dark:text-gray-500">v1.0.0</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center gap-3 p-4">
            {/* Hamburger (mobile only) */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
              data-testid="button-hamburger-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Page Title */}
            {title && (
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h1>
            )}

            {/* Search (hidden on mobile to save space) */}
            {showSearch && (
              <div className="hidden md:flex flex-1 max-w-md">
                <AiHelpSearch />
              </div>
            )}

            {/* Page Actions */}
            {pageActions && (
              <div className="ml-auto flex items-center gap-2">
                {pageActions}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
