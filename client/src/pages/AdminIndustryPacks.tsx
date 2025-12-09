import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  Copy, 
  Eye, 
  Palette, 
  Building2, 
  Settings,
  Loader2,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'wouter';

interface IndustryPack {
  id: number;
  key: string;
  name: string;
  description: string | null;
  configJson: {
    industry?: string;
    services?: Array<{ name: string; description?: string; priceRange?: string; duration?: string }>;
    heroText?: string;
    heroSubtext?: string;
    ctaText?: string;
    colorPalette?: { primary?: string; secondary?: string; accent?: string };
    businessRules?: { appointmentBuffer?: number; maxDailyAppointments?: number; depositRequired?: boolean; depositPercent?: number };
  };
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminIndustryPacks() {
  const { toast } = useToast();
  const [selectedPack, setSelectedPack] = useState<IndustryPack | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [cloneForm, setCloneForm] = useState({ businessName: '', ownerEmail: '', subdomain: '', phone: '' });
  const [editForm, setEditForm] = useState<Partial<IndustryPack>>({});

  const { data: packsData, isLoading } = useQuery<{ success: boolean; data: IndustryPack[] }>({
    queryKey: ['/api/admin/industry-packs'],
  });

  const packs = packsData?.data || [];

  const updatePackMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      return apiRequest(`/api/admin/industry-packs/${data.id}`, { method: 'PUT', body: JSON.stringify(data.updates) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/industry-packs'] });
      toast({ title: 'Pack Updated', description: 'Industry pack has been updated successfully.' });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update pack', variant: 'destructive' });
    },
  });

  const deletePackMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/admin/industry-packs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/industry-packs'] });
      toast({ title: 'Pack Deleted', description: 'Industry pack has been deleted.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete pack', variant: 'destructive' });
    },
  });

  const cloneTenantMutation = useMutation({
    mutationFn: async (data: { packId: number; tenantInfo: typeof cloneForm }) => {
      return apiRequest('POST', `/api/admin/industry-packs/${data.packId}/clone-tenant`, data.tenantInfo);
    },
    onSuccess: (result: any) => {
      toast({ title: 'Tenant Created!', description: result.message || 'New tenant has been created from the pack.' });
      setIsCloneDialogOpen(false);
      setCloneForm({ businessName: '', ownerEmail: '', subdomain: '', phone: '' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to clone tenant', variant: 'destructive' });
    },
  });

  const importPackMutation = useMutation({
    mutationFn: async (json: string) => {
      return apiRequest('POST', '/api/admin/industry-packs/import', { json });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/industry-packs'] });
      toast({ title: 'Pack Imported', description: 'Industry pack has been imported successfully.' });
      setIsImportDialogOpen(false);
      setImportJson('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to import pack', variant: 'destructive' });
    },
  });

  const handleExport = async (packId: number) => {
    try {
      const response = await fetch(`/api/admin/industry-packs/${packId}/export`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `industry-pack-${packId}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Pack JSON downloaded.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export pack', variant: 'destructive' });
    }
  };

  const handleEditPack = (pack: IndustryPack) => {
    setSelectedPack(pack);
    setEditForm({
      name: pack.name,
      description: pack.description || '',
      isPublic: pack.isPublic,
      configJson: pack.configJson,
    });
    setIsEditDialogOpen(true);
  };

  const handleClonePack = (pack: IndustryPack) => {
    setSelectedPack(pack);
    setIsCloneDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2" data-testid="text-page-title">
                <Package className="h-6 w-6" />
                Industry Packs
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Manage industry templates and clone new tenants</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-pack">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Pack
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Industry Pack</DialogTitle>
                  <DialogDescription>Paste the JSON export of an industry pack</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="importJson">Pack JSON</Label>
                    <Textarea
                      id="importJson"
                      placeholder='{"key": "...", "name": "...", ...}'
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      rows={10}
                      data-testid="input-import-json"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => importPackMutation.mutate(importJson)}
                    disabled={!importJson || importPackMutation.isPending}
                    data-testid="button-confirm-import"
                  >
                    {importPackMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <Card key={pack.id} className="hover:shadow-lg transition-shadow" data-testid={`card-pack-${pack.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: pack.configJson?.colorPalette?.primary || '#1e40af' }}
                    >
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-pack-name-${pack.id}`}>{pack.name}</CardTitle>
                      <p className="text-xs text-gray-500 font-mono">{pack.key}</p>
                    </div>
                  </div>
                  <Badge variant={pack.isPublic ? 'default' : 'secondary'}>
                    {pack.isPublic ? 'Public' : 'Private'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {pack.description || 'No description'}
                </p>
                
                <div className="flex flex-wrap gap-1">
                  {pack.configJson?.services?.slice(0, 3).map((service, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {service.name}
                    </Badge>
                  ))}
                  {(pack.configJson?.services?.length || 0) > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{(pack.configJson?.services?.length || 0) - 3} more
                    </Badge>
                  )}
                </div>

                {pack.configJson?.colorPalette && (
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-gray-400" />
                    <div className="flex gap-1">
                      {Object.values(pack.configJson.colorPalette).map((color, i) => (
                        <div 
                          key={i} 
                          className="w-5 h-5 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => handleEditPack(pack)} data-testid={`button-edit-${pack.id}`}>
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport(pack.id)} data-testid={`button-export-${pack.id}`}>
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleClonePack(pack)}
                    data-testid={`button-clone-${pack.id}`}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Clone Tenant
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {packs.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Industry Packs</h3>
              <p className="text-gray-600 mb-4">Get started by importing a pack or creating one manually.</p>
              <Button onClick={() => setIsImportDialogOpen(true)} data-testid="button-get-started">
                <Plus className="h-4 w-4 mr-2" />
                Import Your First Pack
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Industry Pack</DialogTitle>
              <DialogDescription>Update pack settings and configuration</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="editName">Pack Name</Label>
                  <Input
                    id="editName"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    data-testid="input-edit-name"
                  />
                </div>
                <div>
                  <Label htmlFor="editDescription">Description</Label>
                  <Textarea
                    id="editDescription"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    data-testid="input-edit-description"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="editIsPublic"
                    checked={editForm.isPublic}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, isPublic: checked })}
                    data-testid="switch-edit-public"
                  />
                  <Label htmlFor="editIsPublic">Make pack publicly available</Label>
                </div>
              </TabsContent>
              <TabsContent value="services" className="space-y-4 mt-4">
                <div className="space-y-2">
                  {editForm.configJson?.services?.map((service, i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-gray-500">{service.priceRange} - {service.duration}</p>
                    </div>
                  )) || <p className="text-gray-500">No services configured</p>}
                </div>
              </TabsContent>
              <TabsContent value="branding" className="space-y-4 mt-4">
                <div>
                  <Label>Hero Text</Label>
                  <Input
                    value={editForm.configJson?.heroText || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      configJson: { ...editForm.configJson, heroText: e.target.value }
                    })}
                    data-testid="input-edit-hero"
                  />
                </div>
                <div>
                  <Label>Hero Subtext</Label>
                  <Input
                    value={editForm.configJson?.heroSubtext || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      configJson: { ...editForm.configJson, heroSubtext: e.target.value }
                    })}
                    data-testid="input-edit-subtext"
                  />
                </div>
                <div>
                  <Label>CTA Button Text</Label>
                  <Input
                    value={editForm.configJson?.ctaText || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      configJson: { ...editForm.configJson, ctaText: e.target.value }
                    })}
                    data-testid="input-edit-cta"
                  />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => selectedPack && updatePackMutation.mutate({
                  id: selectedPack.id,
                  updates: editForm
                })}
                disabled={updatePackMutation.isPending}
                data-testid="button-save-pack"
              >
                {updatePackMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Clone Tenant from {selectedPack?.name}
              </DialogTitle>
              <DialogDescription>
                Create a new tenant with all the settings and configuration from this pack.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="My Amazing Business"
                  value={cloneForm.businessName}
                  onChange={(e) => setCloneForm({ ...cloneForm, businessName: e.target.value })}
                  data-testid="input-clone-business-name"
                />
              </div>
              <div>
                <Label htmlFor="ownerEmail">Owner Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="owner@business.com"
                  value={cloneForm.ownerEmail}
                  onChange={(e) => setCloneForm({ ...cloneForm, ownerEmail: e.target.value })}
                  data-testid="input-clone-email"
                />
              </div>
              <div>
                <Label htmlFor="subdomain">Subdomain (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    placeholder="my-business"
                    value={cloneForm.subdomain}
                    onChange={(e) => setCloneForm({ ...cloneForm, subdomain: e.target.value })}
                    data-testid="input-clone-subdomain"
                  />
                  <span className="text-gray-500">.servicepro.app</span>
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Business Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={cloneForm.phone}
                  onChange={(e) => setCloneForm({ ...cloneForm, phone: e.target.value })}
                  data-testid="input-clone-phone"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCloneDialogOpen(false)}>Cancel</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => selectedPack && cloneTenantMutation.mutate({
                  packId: selectedPack.id,
                  tenantInfo: cloneForm
                })}
                disabled={!cloneForm.businessName || !cloneForm.ownerEmail || cloneTenantMutation.isPending}
                data-testid="button-confirm-clone"
              >
                {cloneTenantMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Create Tenant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
