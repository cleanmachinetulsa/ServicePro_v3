import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, QrCode, Trash2, Edit, Eye, Download, RefreshCw, Calendar, Lock, Users, Percent, Clock, HelpCircle, Shield, Filter, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import type { PromoCodeSummary, PromoCodeDetails, PromoOverrideType } from '@shared/promos';
import { generatePromoCode, formatPromoDiscount } from '@shared/promos';

interface CreatePromoForm {
  code: string;
  label: string;
  description: string;
  isActive: boolean;
  isInternal: boolean;
  appliesToPlan: string | null;
  subscriptionDiscountPercent: number;
  usageRateMultiplier: number | null;
  trialExtensionDays: number;
  setOverrideType: PromoOverrideType | null;
  isReusable: boolean;
  maxRedemptions: number | null;
  perTenantLimit: number;
  lockedToEmail: string | null;
  startsAt: string | null;
  expiresAt: string | null;
}

const defaultForm: CreatePromoForm = {
  code: '',
  label: '',
  description: '',
  isActive: true,
  isInternal: false,
  appliesToPlan: null,
  subscriptionDiscountPercent: 0,
  usageRateMultiplier: null,
  trialExtensionDays: 0,
  setOverrideType: null,
  isReusable: false,
  maxRedemptions: null,
  perTenantLimit: 1,
  lockedToEmail: null,
  startsAt: null,
  expiresAt: null,
};

type PromoFilter = 'all' | 'active' | 'internal' | 'reusable' | 'expired';

export default function AdminPromos() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<PromoCodeSummary | null>(null);
  const [promoDetails, setPromoDetails] = useState<PromoCodeDetails | null>(null);
  const [form, setForm] = useState<CreatePromoForm>(defaultForm);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<PromoFilter>('all');

  const { data: promosData, isLoading } = useQuery<{ success: boolean; promos: PromoCodeSummary[] }>({
    queryKey: ['/api/admin/promos'],
  });

  const allPromos = promosData?.promos || [];
  
  const promos = allPromos.filter((promo) => {
    switch (activeFilter) {
      case 'active':
        return promo.status === 'active';
      case 'internal':
        return promo.isInternal;
      case 'reusable':
        return promo.isReusable;
      case 'expired':
        return promo.status === 'expired';
      default:
        return true;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePromoForm) => apiRequest('POST', '/api/admin/promos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promos'] });
      setIsCreateOpen(false);
      setForm(defaultForm);
      toast({ title: 'Promo code created', description: 'The promo code has been created successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error creating promo', description: error.message || 'Failed to create promo code', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & Partial<CreatePromoForm>) => apiRequest('PUT', `/api/admin/promos/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promos'] });
      setIsCreateOpen(false);
      setForm(defaultForm);
      setIsEditing(false);
      setEditingId(null);
      toast({ title: 'Promo code updated', description: 'The promo code has been updated successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error updating promo', description: error.message || 'Failed to update promo code', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/promos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promos'] });
      toast({ title: 'Promo code deleted', description: 'The promo code has been deleted.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting promo', description: error.message || 'Failed to delete promo code', variant: 'destructive' });
    },
  });

  const handleGenerateCode = () => {
    setForm({ ...form, code: generatePromoCode() });
  };

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setIsEditing(false);
    setEditingId(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (promo: PromoCodeSummary) => {
    setForm({
      code: promo.code,
      label: promo.label,
      description: promo.description || '',
      isActive: promo.status === 'active' || promo.status === 'scheduled',
      isInternal: promo.isInternal,
      appliesToPlan: promo.appliesToPlan,
      subscriptionDiscountPercent: promo.subscriptionDiscountPercent,
      usageRateMultiplier: promo.usageRateMultiplier,
      trialExtensionDays: promo.trialExtensionDays,
      setOverrideType: promo.setOverrideType,
      isReusable: promo.isReusable,
      maxRedemptions: promo.maxRedemptions,
      perTenantLimit: promo.perTenantLimit,
      lockedToEmail: promo.lockedToEmail,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
    });
    setIsEditing(true);
    setEditingId(promo.id);
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    if (!form.code || !form.label) {
      toast({ title: 'Missing fields', description: 'Code and label are required', variant: 'destructive' });
      return;
    }

    if (isEditing && editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleViewDetails = async (promo: PromoCodeSummary) => {
    try {
      const response = await fetch(`/api/admin/promos/${promo.id}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setPromoDetails(data.promo);
        setIsViewOpen(true);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load promo details', variant: 'destructive' });
    }
  };

  const handleOpenQr = (promo: PromoCodeSummary) => {
    setSelectedPromo(promo);
    setIsQrOpen(true);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied!', description: 'Promo code copied to clipboard' });
  };

  const handleCopyUrl = (code: string) => {
    const url = `${window.location.origin}/signup?promo=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'Signup URL copied to clipboard' });
  };

  const handleDownloadQr = () => {
    if (!selectedPromo) return;

    const svg = document.getElementById('promo-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `promo-${selectedPromo.code}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Scheduled</Badge>;
      case 'expired':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Expired</Badge>;
      case 'inactive':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white" data-testid="page-title">Promo Codes</h1>
            <p className="text-gray-400">Manage subscription discounts and promotional offers</p>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2" data-testid="button-create-promo">
            <Plus className="h-4 w-4" />
            Create Promo Code
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('all')}
            data-testid="filter-all"
          >
            All ({allPromos.length})
          </Button>
          <Button
            variant={activeFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('active')}
            className={activeFilter === 'active' ? '' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}
            data-testid="filter-active"
          >
            Active ({allPromos.filter(p => p.status === 'active').length})
          </Button>
          <Button
            variant={activeFilter === 'internal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('internal')}
            className={activeFilter === 'internal' ? '' : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'}
            data-testid="filter-internal"
          >
            <Shield className="h-3 w-3 mr-1" />
            Internal ({allPromos.filter(p => p.isInternal).length})
          </Button>
          <Button
            variant={activeFilter === 'reusable' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('reusable')}
            className={activeFilter === 'reusable' ? '' : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'}
            data-testid="filter-reusable"
          >
            <Users className="h-3 w-3 mr-1" />
            Reusable ({allPromos.filter(p => p.isReusable).length})
          </Button>
          <Button
            variant={activeFilter === 'expired' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('expired')}
            className={activeFilter === 'expired' ? '' : 'border-gray-500/30 text-gray-400 hover:bg-gray-500/10'}
            data-testid="filter-expired"
          >
            Expired ({allPromos.filter(p => p.status === 'expired').length})
          </Button>
          {activeFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter('all')}
              className="text-gray-400 hover:text-white"
              data-testid="filter-clear"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Code</TableHead>
                  <TableHead className="text-gray-400">Label</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Discount</TableHead>
                  <TableHead className="text-gray-400">Uses</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : promos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                      No promo codes yet. Create your first one!
                    </TableCell>
                  </TableRow>
                ) : (
                  promos.map((promo) => (
                    <TableRow key={promo.id} className="border-gray-800" data-testid={`row-promo-${promo.id}`}>
                      <TableCell className="font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          {promo.code}
                          {promo.isInternal && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5">
                                    <Shield className="h-2.5 w-2.5 mr-0.5" />
                                    INT
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Internal promo - admin only</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopyCode(promo.code)} data-testid={`button-copy-${promo.id}`}>
                            <Copy className="h-3 w-3 text-gray-400" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">{promo.label}</TableCell>
                      <TableCell>{getStatusBadge(promo.status)}</TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center gap-1">
                          {promo.subscriptionDiscountPercent > 0 && (
                            <span className="text-green-400">{promo.subscriptionDiscountPercent}% off</span>
                          )}
                          {promo.trialExtensionDays > 0 && (
                            <span className="text-blue-400 ml-1">+{promo.trialExtensionDays}d trial</span>
                          )}
                          {promo.subscriptionDiscountPercent === 0 && promo.trialExtensionDays === 0 && (
                            <span className="text-gray-500">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {promo.currentRedemptions}/{promo.maxRedemptions || '∞'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {promo.isReusable ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs">
                                    <Users className="h-3 w-3 mr-1" /> Reusable
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Can be used by multiple tenants</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Badge variant="outline" className="text-xs text-gray-400">Single-use</Badge>
                          )}
                          {promo.lockedToEmail && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Lock className="h-3 w-3 text-yellow-400" />
                                </TooltipTrigger>
                                <TooltipContent>Locked to: {promo.lockedToEmail}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(promo)} data-testid={`button-view-${promo.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenQr(promo)} data-testid={`button-qr-${promo.id}`}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(promo)} data-testid={`button-edit-${promo.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => deleteMutation.mutate(promo.id)} data-testid={`button-delete-${promo.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">{isEditing ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update the promo code settings' : 'Create a new promo code for subscription discounts'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="SAVE50"
                      className="font-mono uppercase"
                      data-testid="input-promo-code"
                    />
                    <Button variant="outline" onClick={handleGenerateCode} data-testid="button-generate-code">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="50% Launch Discount"
                    data-testid="input-promo-label"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Internal notes about this promo..."
                  data-testid="input-promo-description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount" className="flex items-center gap-1">
                    <Percent className="h-4 w-4" />
                    Subscription Discount
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    max={100}
                    value={form.subscriptionDiscountPercent}
                    onChange={(e) => setForm({ ...form, subscriptionDiscountPercent: parseInt(e.target.value) || 0 })}
                    data-testid="input-discount-percent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trialDays" className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Extra Trial Days
                  </Label>
                  <Input
                    id="trialDays"
                    type="number"
                    min={0}
                    max={365}
                    value={form.trialExtensionDays}
                    onChange={(e) => setForm({ ...form, trialExtensionDays: parseInt(e.target.value) || 0 })}
                    data-testid="input-trial-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usageRate" className="flex items-center gap-1">
                    Usage Rate Multiplier
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                        <TooltipContent>Multiplier for usage-based charges (e.g., 0.5 = 50% off usage)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="usageRate"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={form.usageRateMultiplier || ''}
                    onChange={(e) => setForm({ ...form, usageRateMultiplier: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="1.0"
                    data-testid="input-usage-rate"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="overrideType">Override Type</Label>
                  <Select value={form.setOverrideType || ''} onValueChange={(v) => setForm({ ...form, setOverrideType: v as PromoOverrideType || null })}>
                    <SelectTrigger data-testid="select-override-type">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="friends_and_family">Friends & Family</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="internal_test">Internal Test</SelectItem>
                      <SelectItem value="beta_user">Beta User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appliesToPlan">Applies to Plan</Label>
                  <Select value={form.appliesToPlan || ''} onValueChange={(v) => setForm({ ...form, appliesToPlan: v || null })}>
                    <SelectTrigger data-testid="select-applies-to-plan">
                      <SelectValue placeholder="All Plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Plans</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="family_free">Family (Free)</SelectItem>
                      <SelectItem value="family_paid">Family (Fee+Usage)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxRedemptions">Max Redemptions</Label>
                  <Input
                    id="maxRedemptions"
                    type="number"
                    min={1}
                    value={form.maxRedemptions || ''}
                    onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Unlimited"
                    data-testid="input-max-redemptions"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="perTenantLimit">Per Tenant Limit</Label>
                  <Input
                    id="perTenantLimit"
                    type="number"
                    min={1}
                    value={form.perTenantLimit}
                    onChange={(e) => setForm({ ...form, perTenantLimit: parseInt(e.target.value) || 1 })}
                    data-testid="input-per-tenant-limit"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lockedToEmail" className="flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Locked to Email
                </Label>
                <Input
                  id="lockedToEmail"
                  type="email"
                  value={form.lockedToEmail || ''}
                  onChange={(e) => setForm({ ...form, lockedToEmail: e.target.value || null })}
                  placeholder="user@example.com (leave empty for anyone)"
                  data-testid="input-locked-to-email"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startsAt" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Starts At
                  </Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={form.startsAt ? form.startsAt.slice(0, 16) : ''}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    data-testid="input-starts-at"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Expires At
                  </Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={form.expiresAt ? form.expiresAt.slice(0, 16) : ''}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    data-testid="input-expires-at"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isActive"
                      checked={form.isActive}
                      onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                      data-testid="switch-is-active"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isReusable"
                      checked={form.isReusable}
                      onCheckedChange={(checked) => setForm({ ...form, isReusable: checked })}
                      data-testid="switch-is-reusable"
                    />
                    <Label htmlFor="isReusable" className="flex items-center gap-1">
                      Reusable
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                          <TooltipContent>If enabled, multiple tenants can use this code</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isInternal"
                      checked={form.isInternal}
                      onCheckedChange={(checked) => setForm({ ...form, isInternal: checked })}
                      data-testid="switch-is-internal"
                    />
                    <Label htmlFor="isInternal" className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-purple-400" />
                      Internal
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                          <TooltipContent>Internal promos are only visible to admins and not publicly discoverable</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-promo">
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-lg bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">Promo Code Details</DialogTitle>
            </DialogHeader>

            {promoDetails && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-white">{promoDetails.code}</span>
                  {getStatusBadge(promoDetails.status)}
                </div>

                <div className="text-lg text-gray-300">{promoDetails.label}</div>
                {promoDetails.description && (
                  <div className="text-sm text-gray-400">{promoDetails.description}</div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Discount</div>
                    <div className="text-white">{formatPromoDiscount(promoDetails.subscriptionDiscountPercent, promoDetails.trialExtensionDays)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Redemptions</div>
                    <div className="text-white">{promoDetails.currentRedemptions} / {promoDetails.maxRedemptions || '∞'}</div>
                  </div>
                  {promoDetails.lockedToEmail && (
                    <div className="col-span-2">
                      <div className="text-gray-500">Locked to</div>
                      <div className="text-yellow-400">{promoDetails.lockedToEmail}</div>
                    </div>
                  )}
                  {promoDetails.expiresAt && (
                    <div className="col-span-2">
                      <div className="text-gray-500">Expires</div>
                      <div className="text-white">{format(new Date(promoDetails.expiresAt), 'PPpp')}</div>
                    </div>
                  )}
                </div>

                {promoDetails.recentRedemptions.length > 0 && (
                  <div>
                    <div className="text-gray-500 mb-2">Recent Redemptions</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {promoDetails.recentRedemptions.map((r) => (
                        <div key={r.id} className="text-sm bg-gray-800 rounded p-2">
                          <div className="text-white">{r.tenantId}</div>
                          <div className="text-gray-400">{r.redeemedByEmail} • {format(new Date(r.redeemedAt), 'PP')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
          <DialogContent className="max-w-md bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">QR Code</DialogTitle>
              <DialogDescription>
                Share this QR code to direct users to sign up with the promo applied
              </DialogDescription>
            </DialogHeader>

            {selectedPromo && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="font-mono text-xl font-bold text-white mb-2">{selectedPromo.code}</div>
                  <div className="text-gray-400">{formatPromoDiscount(selectedPromo.subscriptionDiscountPercent, selectedPromo.trialExtensionDays)}</div>
                </div>

                <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                  <QRCode
                    id="promo-qr-code"
                    value={`${window.location.origin}/signup?promo=${encodeURIComponent(selectedPromo.code)}`}
                    size={256}
                    level="H"
                    data-testid="qr-code-image"
                  />
                </div>

                <div className="text-xs text-gray-400 text-center break-all">
                  {window.location.origin}/signup?promo={encodeURIComponent(selectedPromo.code)}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => handleCopyUrl(selectedPromo.code)} data-testid="button-copy-url">
                    <Copy className="h-4 w-4" />
                    Copy URL
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleDownloadQr} data-testid="button-download-qr">
                    <Download className="h-4 w-4" />
                    Download PNG
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
