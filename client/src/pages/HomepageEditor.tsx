import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, ExternalLink, Upload, X, Palette } from 'lucide-react';
import type { HomepageContent } from '@shared/schema';
import { getAllTemplates } from '@/lib/homeTemplates';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/AppShell';

export default function HomepageEditor() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<HomepageContent>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Fetch current content
  const { data, isLoading } = useQuery({
    queryKey: ['/api/homepage-content'],
  });

  // Initialize form with fetched data
  useEffect(() => {
    if (data?.content) {
      setFormData(data.content);
      setLogoPreview(data.content.logoUrl);
    }
  }, [data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upload logo first if changed
      let logoUrl = formData.logoUrl;
      if (logoFile) {
        const formDataObj = new FormData();
        formDataObj.append('logo', logoFile);
        const uploadRes = await fetch('/api/upload-logo', {
          method: 'POST',
          body: formDataObj,
        });
        
        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          throw new Error(errorData.message || 'Logo upload failed');
        }
        
        const uploadData = await uploadRes.json();
        logoUrl = uploadData.logoUrl;
      }

      return await apiRequest('PUT', '/api/homepage-content', {
        ...formData,
        logoUrl,
      });
    },
    onSuccess: () => {
      toast({ title: 'Saved!', description: 'Homepage content updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
      setLogoFile(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save changes',
        variant: 'destructive',
      });
    },
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest('PUT', '/api/homepage-content/template', { templateId });
    },
    onSuccess: () => {
      toast({ title: 'Template Applied!', description: 'Homepage template updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply template',
        variant: 'destructive',
      });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData({ ...formData, logoUrl: null });
  };

  if (isLoading) return <AppShell title="Homepage Editor"><div className="p-6">Loading...</div></AppShell>;

  const pageActions = (
    <>
      <Button
        variant="outline"
        onClick={() => window.open('/', '_blank')}
        data-testid="button-preview"
        size="sm"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Preview
      </Button>
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        data-testid="button-save"
        size="sm"
      >
        <Save className="mr-2 h-4 w-4" />
        {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </>
  );

  return (
    <AppShell title="Homepage Editor" pageActions={pageActions}>
      <div className="p-6">
        <div className="hidden flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open('/', '_blank')}
            data-testid="button-preview-hidden"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Content Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="hero">
              <TabsList className="grid grid-cols-4 lg:grid-cols-7">
                <TabsTrigger value="hero">Hero</TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="logo">Logo</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="templates">
                  <Palette className="w-4 h-4 mr-1" />
                  Templates
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hero" className="space-y-4">
                <div>
                  <Label>Hero Heading</Label>
                  <Input
                    value={formData.heroHeading || ''}
                    onChange={(e) => setFormData({ ...formData, heroHeading: e.target.value })}
                    data-testid="input-hero-heading"
                  />
                </div>
                <div>
                  <Label>Hero Subheading</Label>
                  <Input
                    value={formData.heroSubheading || ''}
                    onChange={(e) => setFormData({ ...formData, heroSubheading: e.target.value })}
                    data-testid="input-hero-subheading"
                  />
                </div>
                <div>
                  <Label>CTA Button Text</Label>
                  <Input
                    value={formData.heroCtaText || ''}
                    onChange={(e) => setFormData({ ...formData, heroCtaText: e.target.value })}
                    data-testid="input-cta-text"
                  />
                </div>
                <div>
                  <Label>CTA Button Link</Label>
                  <Input
                    value={formData.heroCtaLink || ''}
                    onChange={(e) => setFormData({ ...formData, heroCtaLink: e.target.value })}
                    data-testid="input-cta-link"
                  />
                </div>
              </TabsContent>

              <TabsContent value="about" className="space-y-4">
                <div>
                  <Label>About Heading</Label>
                  <Input
                    value={formData.aboutHeading || ''}
                    onChange={(e) => setFormData({ ...formData, aboutHeading: e.target.value })}
                    data-testid="input-about-heading"
                  />
                </div>
                <div>
                  <Label>About Text</Label>
                  <Textarea
                    rows={6}
                    value={formData.aboutText || ''}
                    onChange={(e) => setFormData({ ...formData, aboutText: e.target.value })}
                    data-testid="textarea-about-text"
                  />
                </div>
              </TabsContent>

              <TabsContent value="services" className="space-y-4">
                <div>
                  <Label>Services Heading</Label>
                  <Input
                    value={formData.servicesHeading || ''}
                    onChange={(e) => setFormData({ ...formData, servicesHeading: e.target.value })}
                    data-testid="input-services-heading"
                  />
                </div>
                <div>
                  <Label>Services Subheading (Optional)</Label>
                  <Input
                    value={formData.servicesSubheading || ''}
                    onChange={(e) => setFormData({ ...formData, servicesSubheading: e.target.value })}
                    data-testid="input-services-subheading"
                  />
                </div>
              </TabsContent>

              <TabsContent value="colors" className="space-y-4">
                <div>
                  <Label>Primary Color (HSL)</Label>
                  <Input
                    value={formData.primaryColor || ''}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    placeholder="220 90% 56%"
                    data-testid="input-primary-color"
                  />
                  <div
                    className="mt-2 h-12 w-full rounded border"
                    style={{ backgroundColor: `hsl(${formData.primaryColor})` }}
                  />
                </div>
                <div>
                  <Label>Secondary Color (HSL)</Label>
                  <Input
                    value={formData.secondaryColor || ''}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    placeholder="280 80% 60%"
                    data-testid="input-secondary-color"
                  />
                  <div
                    className="mt-2 h-12 w-full rounded border"
                    style={{ backgroundColor: `hsl(${formData.secondaryColor})` }}
                  />
                </div>
                <div>
                  <Label>Accent Color (HSL)</Label>
                  <Input
                    value={formData.accentColor || ''}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    placeholder="340 80% 55%"
                    data-testid="input-accent-color"
                  />
                  <div
                    className="mt-2 h-12 w-full rounded border"
                    style={{ backgroundColor: `hsl(${formData.accentColor})` }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="logo" className="space-y-4">
                <div>
                  <Label>Logo Image</Label>
                  {logoPreview && (
                    <div className="mt-2 relative inline-block">
                      <img src={logoPreview} alt="Logo preview" className="h-24 w-auto border rounded" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2"
                        onClick={removeLogo}
                        data-testid="button-remove-logo"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="mt-2"
                    data-testid="input-logo-file"
                  />
                </div>
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                <div>
                  <Label>Meta Title</Label>
                  <Input
                    value={formData.metaTitle || ''}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                    data-testid="input-meta-title"
                  />
                </div>
                <div>
                  <Label>Meta Description</Label>
                  <Textarea
                    rows={3}
                    value={formData.metaDescription || ''}
                    onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                    data-testid="textarea-meta-description"
                  />
                </div>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getAllTemplates().map((template) => {
                    const isActive = (formData.templateId || 'current') === template.id;
                    return (
                      <Card 
                        key={template.id} 
                        className={isActive ? 'border-primary shadow-lg' : ''}
                        data-testid={`card-template-${template.id}`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              {isActive && (
                                <Badge className="mt-1" data-testid={`badge-current-${template.id}`}>
                                  Current
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Hero Style:</span>
                              <span className="font-medium">{template.layout.heroStyle}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Services:</span>
                              <span className="font-medium">{template.layout.servicesLayout}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Animation:</span>
                              <span className="font-medium">{template.animations.speed}</span>
                            </div>
                          </div>
                          <Button
                            variant={isActive ? 'secondary' : 'default'}
                            className="w-full"
                            onClick={() => applyTemplateMutation.mutate(template.id)}
                            disabled={applyTemplateMutation.isPending || isActive}
                            data-testid={`button-apply-template-${template.id}`}
                          >
                            {isActive ? 'Currently Active' : 'Apply Template'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Live Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 p-4 border rounded bg-background">
              {/* Logo */}
              {logoPreview && (
                <div className="flex justify-center">
                  <img src={logoPreview} alt="Logo" className="h-16 w-auto" />
                </div>
              )}

              {/* Hero */}
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold" style={{ color: `hsl(${formData.primaryColor})` }}>
                  {formData.heroHeading || 'Hero Heading'}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {formData.heroSubheading || 'Hero Subheading'}
                </p>
                <Button
                  style={{
                    backgroundColor: `hsl(${formData.primaryColor})`,
                    color: 'white',
                  }}
                >
                  {formData.heroCtaText || 'CTA Button'}
                </Button>
              </div>

              {/* About */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold" style={{ color: `hsl(${formData.secondaryColor})` }}>
                  {formData.aboutHeading || 'About Heading'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formData.aboutText || 'About text goes here...'}
                </p>
              </div>

              {/* Services */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold" style={{ color: `hsl(${formData.accentColor})` }}>
                  {formData.servicesHeading || 'Services Heading'}
                </h2>
                {formData.servicesSubheading && (
                  <p className="text-sm text-muted-foreground">{formData.servicesSubheading}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
