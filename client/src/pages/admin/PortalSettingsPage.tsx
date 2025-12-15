import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Smartphone, Settings, Calendar, MessageSquare, Trophy, User, Home, 
  Palette, Bell, Plus, Pencil, Trash2, Loader2, ArrowUpDown, Save,
  Download, ExternalLink, Phone, Mail, FileText, LayoutGrid
} from 'lucide-react';
import type { PortalSettings, PortalAction } from '@shared/schema';

interface SettingsResponse {
  success: boolean;
  settings: PortalSettings | null;
  defaults: {
    pwaDisplayName: string;
    pwaShortName: string;
    portalTitle: string;
    portalWelcomeMessage: string;
    installPromptBannerText: string;
  };
  industryPackId: string | null;
}

interface ActionsResponse {
  success: boolean;
  actions: PortalAction[];
  defaults: Array<{
    actionKey: string;
    displayName: string;
    description?: string;
    icon: string;
    category: string;
    actionType: string;
    actionConfig: Record<string, any>;
    showOnHome: boolean;
    showInNav: boolean;
    sortOrder: number;
  }>;
  totalDefaultActions: number;
}

const MODULE_ICONS: Record<string, any> = {
  home: Home,
  book: Calendar,
  appointments: Calendar,
  messages: MessageSquare,
  loyalty: Trophy,
  profile: User,
};

const ACTION_TYPE_ICONS: Record<string, any> = {
  navigate: ExternalLink,
  open_form: FileText,
  call_phone: Phone,
  send_sms: MessageSquare,
  send_email: Mail,
  external_link: ExternalLink,
};

const TRIGGER_OPTIONS = [
  { value: 'booking_confirmed', label: 'After Booking Confirmation' },
  { value: 'first_login', label: 'After First Login' },
  { value: 'loyalty_earned', label: 'After Earning Points' },
  { value: 'page_visit', label: 'After Page Visits' },
  { value: 'manual_only', label: 'Manual Only (Settings/Banner)' },
];

export default function PortalSettingsPage() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const [formData, setFormData] = useState({
    portalEnabled: true,
    pwaStartUrl: '/portal',
    pwaDisplayName: '',
    pwaShortName: '',
    pwaThemeColor: '#3b82f6',
    pwaBackgroundColor: '#ffffff',
    moduleHomeEnabled: true,
    moduleBookEnabled: true,
    moduleAppointmentsEnabled: true,
    moduleMessagesEnabled: true,
    moduleLoyaltyEnabled: true,
    moduleProfileEnabled: true,
    installPromptEnabled: true,
    installPromptTrigger: 'booking_confirmed',
    installPromptCooldownDays: 21,
    installPromptPageVisitThreshold: 3,
    installPromptBannerText: '',
    installPromptButtonText: 'Install App',
    portalTitle: '',
    portalWelcomeMessage: '',
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery<SettingsResponse>({
    queryKey: ['/api/admin/portal/settings'],
  });

  const { data: actionsData, isLoading: actionsLoading, refetch: refetchActions } = useQuery<ActionsResponse>({
    queryKey: ['/api/admin/portal/actions'],
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setFormData({
        portalEnabled: s.portalEnabled ?? true,
        pwaStartUrl: s.pwaStartUrl ?? '/portal',
        pwaDisplayName: s.pwaDisplayName ?? '',
        pwaShortName: s.pwaShortName ?? '',
        pwaThemeColor: s.pwaThemeColor ?? '#3b82f6',
        pwaBackgroundColor: s.pwaBackgroundColor ?? '#ffffff',
        moduleHomeEnabled: s.moduleHomeEnabled ?? true,
        moduleBookEnabled: s.moduleBookEnabled ?? true,
        moduleAppointmentsEnabled: s.moduleAppointmentsEnabled ?? true,
        moduleMessagesEnabled: s.moduleMessagesEnabled ?? true,
        moduleLoyaltyEnabled: s.moduleLoyaltyEnabled ?? true,
        moduleProfileEnabled: s.moduleProfileEnabled ?? true,
        installPromptEnabled: s.installPromptEnabled ?? true,
        installPromptTrigger: s.installPromptTrigger ?? 'booking_confirmed',
        installPromptCooldownDays: s.installPromptCooldownDays ?? 21,
        installPromptPageVisitThreshold: s.installPromptPageVisitThreshold ?? 3,
        installPromptBannerText: s.installPromptBannerText ?? '',
        installPromptButtonText: s.installPromptButtonText ?? 'Install App',
        portalTitle: s.portalTitle ?? '',
        portalWelcomeMessage: s.portalWelcomeMessage ?? '',
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/admin/portal/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal/settings'] });
      setHasChanges(false);
      toast({ title: 'Settings Saved', description: 'Portal settings have been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    },
  });

  const seedActionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/portal/actions/seed', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      refetchActions();
      toast({ 
        title: 'Actions Seeded', 
        description: data.seeded > 0 ? `Added ${data.seeded} default actions.` : 'All default actions already exist.'
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to seed actions.', variant: 'destructive' });
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: async (actionId: number) => {
      return apiRequest(`/api/admin/portal/actions/${actionId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      refetchActions();
      toast({ title: 'Action Deleted', description: 'The action has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete action.', variant: 'destructive' });
    },
  });

  const toggleActionMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      return apiRequest(`/api/admin/portal/actions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isEnabled }),
      });
    },
    onSuccess: () => {
      refetchActions();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update action.', variant: 'destructive' });
    },
  });

  const updateField = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const getActionIcon = (iconName: string) => {
    const IconComponent = ACTION_TYPE_ICONS[iconName] || LayoutGrid;
    return <IconComponent className="h-4 w-4" />;
  };

  if (settingsLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Customer Portal Settings</h1>
          <p className="text-muted-foreground">Configure your customer-facing portal and PWA experience</p>
        </div>
        <Button 
          onClick={() => saveMutation.mutate(formData)} 
          disabled={!hasChanges || saveMutation.isPending}
          data-testid="button-save-settings"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-portal-settings">
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="modules" data-testid="tab-modules">Modules</TabsTrigger>
          <TabsTrigger value="install" data-testid="tab-install">Install Prompt</TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card data-testid="card-portal-status">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" /> Portal Status
              </CardTitle>
              <CardDescription>Enable or disable the customer portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Portal Enabled</Label>
                  <p className="text-sm text-muted-foreground">Allow customers to access the portal</p>
                </div>
                <Switch
                  checked={formData.portalEnabled}
                  onCheckedChange={(checked) => updateField('portalEnabled', checked)}
                  data-testid="switch-portal-enabled"
                />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pwa-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" /> PWA Branding
              </CardTitle>
              <CardDescription>Configure how your app appears when installed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pwaDisplayName">Display Name</Label>
                  <Input
                    id="pwaDisplayName"
                    placeholder={settingsData?.defaults?.pwaDisplayName || 'Customer Portal'}
                    value={formData.pwaDisplayName}
                    onChange={(e) => updateField('pwaDisplayName', e.target.value)}
                    data-testid="input-pwa-display-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwaShortName">Short Name</Label>
                  <Input
                    id="pwaShortName"
                    placeholder={settingsData?.defaults?.pwaShortName || 'Portal'}
                    value={formData.pwaShortName}
                    onChange={(e) => updateField('pwaShortName', e.target.value)}
                    data-testid="input-pwa-short-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pwaThemeColor">Theme Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="pwaThemeColor"
                      value={formData.pwaThemeColor}
                      onChange={(e) => updateField('pwaThemeColor', e.target.value)}
                      className="w-12 h-10 p-1"
                      data-testid="input-pwa-theme-color"
                    />
                    <Input
                      value={formData.pwaThemeColor}
                      onChange={(e) => updateField('pwaThemeColor', e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwaBackgroundColor">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="pwaBackgroundColor"
                      value={formData.pwaBackgroundColor}
                      onChange={(e) => updateField('pwaBackgroundColor', e.target.value)}
                      className="w-12 h-10 p-1"
                      data-testid="input-pwa-background-color"
                    />
                    <Input
                      value={formData.pwaBackgroundColor}
                      onChange={(e) => updateField('pwaBackgroundColor', e.target.value)}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="portalTitle">Portal Title</Label>
                <Input
                  id="portalTitle"
                  placeholder={settingsData?.defaults?.portalTitle || 'Customer Portal'}
                  value={formData.portalTitle}
                  onChange={(e) => updateField('portalTitle', e.target.value)}
                  data-testid="input-portal-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portalWelcomeMessage">Welcome Message</Label>
                <Textarea
                  id="portalWelcomeMessage"
                  placeholder={settingsData?.defaults?.portalWelcomeMessage || 'Welcome! How can we help you today?'}
                  value={formData.portalWelcomeMessage}
                  onChange={(e) => updateField('portalWelcomeMessage', e.target.value)}
                  rows={2}
                  data-testid="input-portal-welcome-message"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-6">
          <Card data-testid="card-modules">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Portal Modules
              </CardTitle>
              <CardDescription>Enable or disable sections of the customer portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'moduleHomeEnabled', label: 'Home', icon: 'home', description: 'Main dashboard with quick actions' },
                { key: 'moduleBookEnabled', label: 'Book Appointment', icon: 'book', description: 'Allow customers to schedule services' },
                { key: 'moduleAppointmentsEnabled', label: 'My Appointments', icon: 'appointments', description: 'View upcoming and past appointments' },
                { key: 'moduleMessagesEnabled', label: 'Messages', icon: 'messages', description: 'In-app messaging with your team' },
                { key: 'moduleLoyaltyEnabled', label: 'Loyalty & Rewards', icon: 'loyalty', description: 'Points balance and redemption' },
                { key: 'moduleProfileEnabled', label: 'Profile', icon: 'profile', description: 'Customer profile and settings' },
              ].map((module) => {
                const Icon = MODULE_ICONS[module.icon] || Settings;
                return (
                  <div key={module.key} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <Label>{module.label}</Label>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData[module.key as keyof typeof formData] as boolean}
                      onCheckedChange={(checked) => updateField(module.key as keyof typeof formData, checked)}
                      data-testid={`switch-${module.key}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="install" className="space-y-6">
          <Card data-testid="card-install-prompt">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> Install Prompt
              </CardTitle>
              <CardDescription>Configure when and how to prompt customers to install your app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Install Prompt</Label>
                  <p className="text-sm text-muted-foreground">Show the "Add to Home Screen" prompt</p>
                </div>
                <Switch
                  checked={formData.installPromptEnabled}
                  onCheckedChange={(checked) => updateField('installPromptEnabled', checked)}
                  data-testid="switch-install-prompt-enabled"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Trigger Event</Label>
                <Select
                  value={formData.installPromptTrigger}
                  onValueChange={(value) => updateField('installPromptTrigger', value)}
                  disabled={!formData.installPromptEnabled}
                >
                  <SelectTrigger data-testid="select-install-trigger">
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cooldownDays">Cooldown (Days)</Label>
                  <Input
                    id="cooldownDays"
                    type="number"
                    min={1}
                    max={365}
                    value={formData.installPromptCooldownDays}
                    onChange={(e) => updateField('installPromptCooldownDays', parseInt(e.target.value) || 21)}
                    disabled={!formData.installPromptEnabled}
                    data-testid="input-cooldown-days"
                  />
                  <p className="text-xs text-muted-foreground">Days between prompts if dismissed</p>
                </div>
                {formData.installPromptTrigger === 'page_visit' && (
                  <div className="space-y-2">
                    <Label htmlFor="pageVisitThreshold">Page Visits Required</Label>
                    <Input
                      id="pageVisitThreshold"
                      type="number"
                      min={1}
                      max={20}
                      value={formData.installPromptPageVisitThreshold}
                      onChange={(e) => updateField('installPromptPageVisitThreshold', parseInt(e.target.value) || 3)}
                      disabled={!formData.installPromptEnabled}
                      data-testid="input-page-visit-threshold"
                    />
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="bannerText">Banner Text</Label>
                <Textarea
                  id="bannerText"
                  placeholder={settingsData?.defaults?.installPromptBannerText || 'Install our app for quick access'}
                  value={formData.installPromptBannerText}
                  onChange={(e) => updateField('installPromptBannerText', e.target.value)}
                  rows={2}
                  disabled={!formData.installPromptEnabled}
                  data-testid="input-banner-text"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buttonText">Button Text</Label>
                <Input
                  id="buttonText"
                  placeholder="Install App"
                  value={formData.installPromptButtonText}
                  onChange={(e) => updateField('installPromptButtonText', e.target.value)}
                  disabled={!formData.installPromptEnabled}
                  data-testid="input-button-text"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <Card data-testid="card-actions">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5" /> Portal Actions
                  </CardTitle>
                  <CardDescription>
                    Quick actions available to customers on the portal home screen
                    {actionsData && (
                      <span className="ml-2">
                        ({actionsData.actions.length} configured, {actionsData.totalDefaultActions} available defaults)
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => seedActionsMutation.mutate()}
                  disabled={seedActionsMutation.isPending}
                  data-testid="button-seed-actions"
                >
                  {seedActionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Default Actions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : actionsData?.actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No actions configured yet.</p>
                  <p className="text-sm">Click "Add Default Actions" to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {actionsData?.actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      data-testid={`action-item-${action.actionKey}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getActionIcon(action.actionType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{action.displayName}</span>
                            {action.isFromIndustryPack && (
                              <Badge variant="secondary" className="text-xs">Industry Default</Badge>
                            )}
                            {action.showOnHome && (
                              <Badge variant="outline" className="text-xs">Home</Badge>
                            )}
                            {action.showInNav && (
                              <Badge variant="outline" className="text-xs">Nav</Badge>
                            )}
                          </div>
                          {action.description && (
                            <p className="text-sm text-muted-foreground">{action.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={action.isEnabled}
                          onCheckedChange={(checked) => toggleActionMutation.mutate({ id: action.id, isEnabled: checked })}
                          data-testid={`switch-action-${action.actionKey}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteActionMutation.mutate(action.id)}
                          disabled={deleteActionMutation.isPending}
                          data-testid={`button-delete-action-${action.actionKey}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
