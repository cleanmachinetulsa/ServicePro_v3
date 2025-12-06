/**
 * CM-4: Admin Public Site Settings Page
 * Allows tenant owners to customize their public website hero text, colors, and CTA toggles
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Globe, 
  Palette, 
  Eye, 
  Save, 
  ExternalLink, 
  Loader2,
  Type,
  ToggleLeft,
  Sparkles,
} from 'lucide-react';

interface PublicSiteSettings {
  heroTitle: string;
  heroSubtitle: string;
  primaryColor: string;
  secondaryColor: string;
  showRewardsCTA: boolean;
  showBookingCTA: boolean;
  showGiftCardCTA: boolean;
}

interface DefaultSettings {
  heroTitle: string;
  heroSubtitle: string;
  primaryColor: string;
  secondaryColor: string;
}

interface ApiResponse {
  success: boolean;
  settings: PublicSiteSettings;
  defaults?: DefaultSettings;
}

export default function AdminPublicSiteSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PublicSiteSettings>({
    heroTitle: '',
    heroSubtitle: '',
    primaryColor: '#6366f1',
    secondaryColor: '#a855f7',
    showRewardsCTA: true,
    showBookingCTA: true,
    showGiftCardCTA: false,
  });
  const [defaults, setDefaults] = useState<DefaultSettings>({
    heroTitle: 'Welcome to Your Business',
    heroSubtitle: 'Professional service you can trust',
    primaryColor: '#6366f1',
    secondaryColor: '#a855f7',
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['/api/admin/public-site-settings'],
  });

  useEffect(() => {
    if (data?.settings) {
      setSettings(data.settings);
      setHasChanges(false);
    }
    if (data?.defaults) {
      setDefaults(data.defaults);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: PublicSiteSettings) => {
      return await apiRequest('/api/admin/public-site-settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/public-site-settings'] });
      toast({
        title: 'Settings saved',
        description: 'Your public site settings have been updated successfully.',
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving settings',
        description: error.message || 'Failed to update public site settings',
        variant: 'destructive',
      });
    },
  });

  const handleChange = (field: keyof PublicSiteSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="p-6">
          <Card className="border-destructive">
            <CardContent className="py-6 text-center text-destructive">
              Failed to load public site settings. Please try again.
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                Public Site Settings
              </h1>
              <p className="text-muted-foreground text-sm">
                Customize how your public website appears to visitors
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/site/demo', '_blank')}
              data-testid="button-preview-site"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="settings-tabs">
            <TabsTrigger value="content" className="flex items-center gap-2" data-testid="tab-content">
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Content</span>
            </TabsTrigger>
            <TabsTrigger value="colors" className="flex items-center gap-2" data-testid="tab-colors">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Colors</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2" data-testid="tab-features">
              <ToggleLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Features</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6" data-testid="panel-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Hero Section
                </CardTitle>
                <CardDescription>
                  The main headline and subtitle shown on your public website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="heroTitle">Hero Title</Label>
                  <Input
                    id="heroTitle"
                    placeholder={defaults.heroTitle}
                    value={settings.heroTitle}
                    onChange={(e) => handleChange('heroTitle', e.target.value)}
                    data-testid="input-hero-title"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the default based on your industry
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                  <Textarea
                    id="heroSubtitle"
                    placeholder={defaults.heroSubtitle}
                    value={settings.heroSubtitle}
                    onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                    rows={3}
                    data-testid="input-hero-subtitle"
                  />
                  <p className="text-xs text-muted-foreground">
                    A brief description that appears below the title
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="py-6">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 text-center">
                  <h2 
                    className="text-2xl font-bold mb-2"
                    style={{ color: settings.primaryColor || '#6366f1' }}
                  >
                    {settings.heroTitle || 'Your Business Name'}
                  </h2>
                  <p className="text-muted-foreground">
                    {settings.heroSubtitle || 'Professional services you can trust'}
                  </p>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  Live preview of your hero section
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="colors" className="space-y-6" data-testid="panel-colors">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Colors
                </CardTitle>
                <CardDescription>
                  Override the default colors for your public website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          id="primaryColor"
                          value={settings.primaryColor}
                          onChange={(e) => handleChange('primaryColor', e.target.value)}
                          className="w-16 h-10 rounded-lg cursor-pointer border-2 border-border"
                          data-testid="input-primary-color"
                        />
                      </div>
                      <Input
                        value={settings.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        placeholder="#6366f1"
                        className="flex-1 font-mono text-sm"
                        data-testid="input-primary-color-hex"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for buttons, links, and accents
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          id="secondaryColor"
                          value={settings.secondaryColor}
                          onChange={(e) => handleChange('secondaryColor', e.target.value)}
                          className="w-16 h-10 rounded-lg cursor-pointer border-2 border-border"
                          data-testid="input-secondary-color"
                        />
                      </div>
                      <Input
                        value={settings.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        placeholder="#a855f7"
                        className="flex-1 font-mono text-sm"
                        data-testid="input-secondary-color-hex"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for gradients and highlights
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Color Preview</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="h-20 rounded-lg flex items-center justify-center text-white font-semibold shadow-md"
                      style={{ backgroundColor: settings.primaryColor }}
                    >
                      Primary
                    </div>
                    <div
                      className="h-20 rounded-lg flex items-center justify-center text-white font-semibold shadow-md"
                      style={{ backgroundColor: settings.secondaryColor }}
                    >
                      Secondary
                    </div>
                  </div>
                  <div
                    className="h-16 rounded-lg flex items-center justify-center text-white font-semibold shadow-md"
                    style={{ 
                      background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)` 
                    }}
                  >
                    Gradient Preview
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-6" data-testid="panel-features">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ToggleLeft className="h-5 w-5" />
                  Call-to-Action Buttons
                </CardTitle>
                <CardDescription>
                  Control which action buttons appear on your public website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-base">Booking CTA</Label>
                    <p className="text-sm text-muted-foreground">
                      Show a "Book Now" button for appointment scheduling
                    </p>
                  </div>
                  <Switch
                    checked={settings.showBookingCTA}
                    onCheckedChange={(checked) => handleChange('showBookingCTA', checked)}
                    data-testid="switch-booking-cta"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-base">Rewards Portal CTA</Label>
                    <p className="text-sm text-muted-foreground">
                      Show a button linking to the customer rewards portal
                    </p>
                  </div>
                  <Switch
                    checked={settings.showRewardsCTA}
                    onCheckedChange={(checked) => handleChange('showRewardsCTA', checked)}
                    data-testid="switch-rewards-cta"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-base">Gift Card CTA</Label>
                    <p className="text-sm text-muted-foreground">
                      Show a button for purchasing gift cards
                    </p>
                  </div>
                  <Switch
                    checked={settings.showGiftCardCTA}
                    onCheckedChange={(checked) => handleChange('showGiftCardCTA', checked)}
                    data-testid="switch-giftcard-cta"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {hasChanges && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto p-4 bg-background border rounded-lg shadow-lg flex items-center gap-4 z-50">
            <p className="text-sm text-muted-foreground flex-1">You have unsaved changes</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (data?.settings) {
                  setSettings(data.settings);
                  setHasChanges(false);
                }
              }}
              data-testid="button-discard-changes"
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-floating"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
