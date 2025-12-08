/**
 * SP-24: Admin Public Site Theme Page
 * Allows tenant owners to configure their public website theme and layout
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Palette, 
  Layout, 
  Eye, 
  Save, 
  Loader2,
  Sparkles,
  LayoutGrid,
  ToggleLeft,
  Undo2,
} from 'lucide-react';
import type { 
  PublicSiteTheme, 
  PublicSiteThemeConfig,
  PublicSiteThemeKey,
  HeroLayoutKey,
  CtaStyleKey,
  ServicesLayoutKey,
  TestimonialsLayoutKey,
} from '@shared/publicSiteThemes';
import { DEFAULT_THEME_CONFIG } from '@shared/publicSiteThemes';
import { TOGGLEABLE_SECTIONS } from '@/publicSite/templates/layoutConfig';

interface ApiResponse {
  success: boolean;
  themeConfig: PublicSiteThemeConfig;
  availableThemes: PublicSiteTheme[];
  tenantInfo: {
    businessName: string;
    primaryColor: string;
    accentColor: string;
  };
}

export default function AdminPublicSiteTheme() {
  const { toast } = useToast();
  const [config, setConfig] = useState<PublicSiteThemeConfig>(DEFAULT_THEME_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['/api/admin/public-site-theme'],
  });

  useEffect(() => {
    if (data?.themeConfig) {
      setConfig(data.themeConfig);
      setHasChanges(false);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (newConfig: Partial<PublicSiteThemeConfig>) => {
      return await apiRequest('PUT', '/api/admin/public-site-theme', newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/public-site-theme'] });
      toast({
        title: 'Theme saved',
        description: 'Your public site theme has been updated successfully.',
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving theme',
        description: error.message || 'Failed to update theme configuration',
        variant: 'destructive',
      });
    },
  });

  const handleThemeChange = (themeKey: PublicSiteThemeKey) => {
    setConfig(prev => ({ ...prev, themeKey }));
    setHasChanges(true);
  };

  const handleLayoutChange = <K extends keyof PublicSiteThemeConfig>(
    field: K, 
    value: PublicSiteThemeConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSectionToggle = (sectionId: string, enabled: boolean) => {
    setConfig(prev => ({ ...prev, [sectionId]: enabled }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_THEME_CONFIG);
    setHasChanges(true);
  };

  const selectedTheme = data?.availableThemes?.find(t => t.key === config.themeKey);

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
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-destructive" data-testid="error-message">Failed to load theme settings</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Palette className="h-6 w-6 text-primary" />
              Public Site Theme
            </h1>
            <p className="text-muted-foreground mt-1">
              Customize the look and feel of your public website
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={updateMutation.isPending}
              data-testid="button-reset"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              data-testid="button-save"
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

        <Tabs defaultValue="theme" className="w-full">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
            <TabsTrigger value="theme" data-testid="tab-theme">
              <Palette className="h-4 w-4 mr-2" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="layouts" data-testid="tab-layouts">
              <Layout className="h-4 w-4 mr-2" />
              Layouts
            </TabsTrigger>
            <TabsTrigger value="sections" data-testid="tab-sections">
              <ToggleLeft className="h-4 w-4 mr-2" />
              Sections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theme" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Choose a Theme
                </CardTitle>
                <CardDescription>
                  Select a visual theme that matches your brand identity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data?.availableThemes?.map((theme) => (
                    <div
                      key={theme.key}
                      onClick={() => handleThemeChange(theme.key)}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                        config.themeKey === theme.key 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      data-testid={`theme-option-${theme.key}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{theme.label}</h3>
                          <p className="text-sm text-muted-foreground">{theme.description}</p>
                        </div>
                        {config.themeKey === theme.key && (
                          <Badge variant="default" className="shrink-0">Selected</Badge>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <div 
                          className="w-8 h-8 rounded-full border" 
                          style={{ backgroundColor: theme.colors.gradientFrom }}
                          title="Primary"
                        />
                        <div 
                          className="w-8 h-8 rounded-full border" 
                          style={{ backgroundColor: theme.colors.gradientTo }}
                          title="Secondary"
                        />
                        <div 
                          className="w-8 h-8 rounded-full border" 
                          style={{ backgroundColor: theme.colors.accent }}
                          title="Accent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedTheme && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Theme Preview
                  </CardTitle>
                  <CardDescription>
                    Preview of the selected "{selectedTheme.label}" theme
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`rounded-lg p-6 bg-gradient-to-br ${selectedTheme.colors.background}`}
                    data-testid="theme-preview"
                  >
                    <div className={`rounded-lg p-4 ${selectedTheme.colors.surface}`}>
                      <h3 
                        className="text-lg font-bold mb-2"
                        style={{ color: selectedTheme.colors.textPrimary }}
                      >
                        {data?.tenantInfo?.businessName || 'Your Business Name'}
                      </h3>
                      <p 
                        className="text-sm mb-4"
                        style={{ color: selectedTheme.colors.textSecondary }}
                      >
                        Professional services you can trust
                      </p>
                      <div 
                        className="inline-block px-4 py-2 rounded-lg text-white font-medium"
                        style={{ 
                          background: `linear-gradient(135deg, ${selectedTheme.colors.gradientFrom}, ${selectedTheme.colors.gradientTo})` 
                        }}
                      >
                        Book Now
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="layouts" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Section Layouts
                </CardTitle>
                <CardDescription>
                  Configure how different sections of your site are displayed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="heroLayout">Hero Section Layout</Label>
                    <Select 
                      value={config.heroLayout} 
                      onValueChange={(value: HeroLayoutKey) => handleLayoutChange('heroLayout', value)}
                    >
                      <SelectTrigger id="heroLayout" data-testid="select-hero-layout">
                        <SelectValue placeholder="Select hero layout" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTheme?.heroVariants.map(variant => (
                          <SelectItem key={variant.id} value={variant.id}>
                            {variant.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="servicesLayout">Services Section Layout</Label>
                    <Select 
                      value={config.servicesLayout} 
                      onValueChange={(value: ServicesLayoutKey) => handleLayoutChange('servicesLayout', value)}
                    >
                      <SelectTrigger id="servicesLayout" data-testid="select-services-layout">
                        <SelectValue placeholder="Select services layout" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTheme?.servicesLayouts.map(layout => (
                          <SelectItem key={layout.id} value={layout.id}>
                            {layout.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="testimonialsLayout">Testimonials Layout</Label>
                    <Select 
                      value={config.testimonialsLayout} 
                      onValueChange={(value: TestimonialsLayoutKey) => handleLayoutChange('testimonialsLayout', value)}
                    >
                      <SelectTrigger id="testimonialsLayout" data-testid="select-testimonials-layout">
                        <SelectValue placeholder="Select testimonials layout" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTheme?.testimonialLayouts.map(layout => (
                          <SelectItem key={layout.id} value={layout.id}>
                            {layout.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="ctaStyle">Call-to-Action Style</Label>
                    <Select 
                      value={config.ctaStyle} 
                      onValueChange={(value: CtaStyleKey) => handleLayoutChange('ctaStyle', value)}
                    >
                      <SelectTrigger id="ctaStyle" data-testid="select-cta-style">
                        <SelectValue placeholder="Select CTA style" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTheme?.ctaStyles.map(style => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ToggleLeft className="h-5 w-5" />
                  Section Visibility
                </CardTitle>
                <CardDescription>
                  Toggle which sections appear on your public site
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {TOGGLEABLE_SECTIONS.map((section) => (
                  <div 
                    key={section.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <Label htmlFor={section.id} className="font-medium">
                        {section.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <Switch
                      id={section.id}
                      checked={config[section.id as keyof PublicSiteThemeConfig] as boolean}
                      onCheckedChange={(checked) => handleSectionToggle(section.id, checked)}
                      data-testid={`switch-${section.id}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
