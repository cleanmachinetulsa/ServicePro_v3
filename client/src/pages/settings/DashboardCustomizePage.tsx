/**
 * SP-15: Dashboard Customize Page
 * 
 * Allows tenants to choose which panels appear in Simple Mode.
 * This page is always accessible, even in Simple Mode.
 */

import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/AppShell';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { useSimpleModeConfig, useUiExperienceMode } from '@/hooks/useUiExperienceMode';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  LayoutDashboard, 
  Save, 
  Loader2, 
  Info,
  MessageSquare,
  Calendar,
  TrendingUp,
  Megaphone,
  Gift,
  Settings,
  Wrench,
  Phone,
  DollarSign,
  FileArchive,
  Users,
  FileQuestion,
  Briefcase,
  Image,
  Bot,
  Navigation,
  RotateCcw
} from 'lucide-react';
import type { DashboardPanelId } from '@shared/schema';
import { getCustomizableNavItems, getDefaultSimpleModeItems, type NavigationItem } from '@/config/navigationItems';

interface PanelInfo {
  id: DashboardPanelId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'core' | 'operations' | 'advanced';
}

const PANEL_INFO: PanelInfo[] = [
  { id: 'conversations', label: 'Conversations', description: 'Messages and chat inbox', icon: MessageSquare, category: 'core' },
  { id: 'calendar', label: 'Calendar', description: 'Appointment scheduling', icon: Calendar, category: 'core' },
  { id: 'booking-requests', label: 'Booking Requests', description: 'Incoming appointment requests', icon: FileQuestion, category: 'core' },
  { id: 'customers', label: 'Customers', description: 'Customer database', icon: Users, category: 'core' },
  { id: 'rewards', label: 'Rewards', description: 'Loyalty program and rewards', icon: Gift, category: 'core' },
  { id: 'settings', label: 'Settings', description: 'Business settings', icon: Settings, category: 'core' },
  { id: 'analytics', label: 'Analytics', description: 'Reports and metrics', icon: TrendingUp, category: 'operations' },
  { id: 'campaigns', label: 'Campaigns', description: 'Marketing campaigns', icon: Megaphone, category: 'operations' },
  { id: 'services', label: 'Services', description: 'Service catalog', icon: Wrench, category: 'operations' },
  { id: 'technician', label: 'Technician Hub', description: 'Technician management', icon: Briefcase, category: 'operations' },
  { id: 'employees', label: 'Employees', description: 'Staff management', icon: Users, category: 'operations' },
  { id: 'gallery', label: 'Gallery', description: 'Photo gallery', icon: Image, category: 'operations' },
  { id: 'referrals', label: 'Referrals', description: 'Referral program', icon: Gift, category: 'operations' },
  { id: 'automations', label: 'Automations', description: 'AI and automation settings', icon: Bot, category: 'advanced' },
  { id: 'ivr', label: 'IVR', description: 'Voice menu configuration', icon: Phone, category: 'advanced' },
  { id: 'telephony', label: 'Telephony', description: 'Phone settings', icon: Phone, category: 'advanced' },
  { id: 'billing', label: 'Billing', description: 'Billing and invoices', icon: DollarSign, category: 'advanced' },
  { id: 'imports', label: 'Data Imports', description: 'Import customer data', icon: FileArchive, category: 'advanced' },
];

function getCategoryLabel(category: PanelInfo['category']): string {
  switch (category) {
    case 'core': return 'Core Features';
    case 'operations': return 'Operations';
    case 'advanced': return 'Advanced';
    default: return category;
  }
}

interface AuthContext {
  success: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

export default function DashboardCustomizePage() {
  const { toast } = useToast();
  const { 
    mode: dashboardMode, 
    simpleVisiblePanels, 
    isLoading, 
    isSaving, 
    updatePanels 
  } = useDashboardPreferences();
  
  const { mode: uiMode } = useUiExperienceMode();
  const { config: simpleModeConfig, saveConfig: saveNavConfig, isSaving: isNavSaving } = useSimpleModeConfig();

  const { data: authContext } = useQuery<AuthContext>({
    queryKey: ['/api/auth/context'],
  });
  
  const userRole = authContext?.user?.role;

  const [selectedPanels, setSelectedPanels] = useState<DashboardPanelId[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [selectedNavItems, setSelectedNavItems] = useState<string[]>([]);
  const [hasNavChanges, setHasNavChanges] = useState(false);
  
  const customizableNavItems = useMemo(() => getCustomizableNavItems(userRole), [userRole]);
  const defaultNavItems = useMemo(() => getDefaultSimpleModeItems(userRole), [userRole]);

  useEffect(() => {
    if (simpleVisiblePanels && simpleVisiblePanels.length > 0) {
      setSelectedPanels([...simpleVisiblePanels]);
    }
  }, [simpleVisiblePanels]);
  
  useEffect(() => {
    const currentNavItems = simpleModeConfig?.visibleNavItems || defaultNavItems;
    setSelectedNavItems([...currentNavItems]);
  }, [simpleModeConfig]);

  useEffect(() => {
    const currentSet = new Set(simpleVisiblePanels);
    const selectedSet = new Set(selectedPanels);
    const isDifferent = 
      currentSet.size !== selectedSet.size || 
      [...currentSet].some(p => !selectedSet.has(p));
    setHasChanges(isDifferent);
  }, [selectedPanels, simpleVisiblePanels]);
  
  useEffect(() => {
    const currentNavItems = simpleModeConfig?.visibleNavItems || defaultNavItems;
    const currentSet = new Set(currentNavItems);
    const selectedSet = new Set(selectedNavItems);
    const isDifferent = 
      currentSet.size !== selectedSet.size || 
      [...currentSet].some(p => !selectedSet.has(p));
    setHasNavChanges(isDifferent);
  }, [selectedNavItems, simpleModeConfig]);

  const handleTogglePanel = (panelId: DashboardPanelId) => {
    setSelectedPanels(prev => {
      if (prev.includes(panelId)) {
        return prev.filter(p => p !== panelId);
      } else {
        return [...prev, panelId];
      }
    });
  };
  
  const handleToggleNavItem = (navId: string) => {
    setSelectedNavItems(prev => {
      if (prev.includes(navId)) {
        return prev.filter(p => p !== navId);
      } else {
        return [...prev, navId];
      }
    });
  };

  const handleSave = async () => {
    try {
      await updatePanels(selectedPanels);
      toast({
        title: 'Preferences saved',
        description: 'Your dashboard has been customized.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const handleSaveNav = async () => {
    try {
      await saveNavConfig({ visibleNavItems: selectedNavItems });
      toast({
        title: 'Navigation saved',
        description: 'Your navigation menu has been customized.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save navigation settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setSelectedPanels([...simpleVisiblePanels]);
  };
  
  const handleResetNav = () => {
    setSelectedNavItems([...defaultNavItems]);
  };

  const groupedPanels = PANEL_INFO.reduce((acc, panel) => {
    if (!acc[panel.category]) {
      acc[panel.category] = [];
    }
    acc[panel.category].push(panel);
    return acc;
  }, {} as Record<string, PanelInfo[]>);

  const categoryOrder: PanelInfo['category'][] = ['core', 'operations', 'advanced'];

  const getNavItemsByComplexity = (complexity: 'simple' | 'advanced' | 'expert' | 'other') => {
    return customizableNavItems.filter(item => {
      if (complexity === 'other') {
        return !item.complexity;
      }
      return item.complexity === complexity;
    });
  };

  return (
    <AppShell>
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Customize Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Choose which features appear in Simple Mode
            </p>
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-300">
            These settings only affect <strong>Simple Mode</strong>. In Advanced Mode, all features are always visible.
            {uiMode === 'advanced' && (
              <span className="block mt-1 text-sm">
                You're currently in Advanced Mode. Switch to Simple Mode to see these changes.
              </span>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3 mb-4">
          <Badge variant={uiMode === 'simple' ? 'default' : 'secondary'}>
            Current Mode: {uiMode === 'simple' ? 'Simple' : 'Advanced'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="navigation" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="navigation" className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Navigation Menu
              </TabsTrigger>
              <TabsTrigger value="panels" className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard Panels
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="navigation" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Navigation className="w-5 h-5" />
                        Simple Mode Navigation
                      </CardTitle>
                      <CardDescription>
                        Choose which menu items appear in the sidebar when using Simple Mode
                      </CardDescription>
                    </div>
                    {hasNavChanges && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Unsaved changes
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(['simple', 'advanced', 'expert'] as const).map((complexity) => {
                    const items = getNavItemsByComplexity(complexity);
                    if (items.length === 0) return null;
                    
                    return (
                      <div key={complexity} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm capitalize">{complexity} Features</h4>
                          <Badge variant="outline" className="text-xs">
                            {items.filter(i => selectedNavItems.includes(i.id)).length} / {items.length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div
                                key={item.id}
                                className="flex items-center space-x-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                              >
                                <Checkbox
                                  id={`nav-${item.id}`}
                                  checked={selectedNavItems.includes(item.id)}
                                  onCheckedChange={() => handleToggleNavItem(item.id)}
                                  data-testid={`checkbox-nav-${item.id}`}
                                />
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <Label
                                  htmlFor={`nav-${item.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {item.label}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6">
                  <Button
                    variant="outline"
                    onClick={handleResetNav}
                    disabled={isNavSaving}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Defaults
                  </Button>
                  <Button
                    onClick={handleSaveNav}
                    disabled={!hasNavChanges || isNavSaving}
                    data-testid="button-save-nav"
                  >
                    {isNavSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Navigation
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="panels" className="space-y-6">
              {categoryOrder.map(category => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{getCategoryLabel(category)}</CardTitle>
                    <CardDescription>
                      {category === 'core' && 'Essential features for daily operations'}
                      {category === 'operations' && 'Additional tools for managing your business'}
                      {category === 'advanced' && 'Advanced settings and integrations'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupedPanels[category]?.map((panel, index) => (
                      <div key={panel.id}>
                        {index > 0 && <Separator className="my-3" />}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <panel.icon className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <Label htmlFor={`panel-${panel.id}`} className="font-medium cursor-pointer">
                                {panel.label}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {panel.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id={`panel-${panel.id}`}
                            checked={selectedPanels.includes(panel.id)}
                            onCheckedChange={() => handleTogglePanel(panel.id)}
                            data-testid={`switch-panel-${panel.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardFooter className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={!hasChanges || isSaving}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    data-testid="button-save-preferences"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
