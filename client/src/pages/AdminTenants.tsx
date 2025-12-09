import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, Shield, UserCircle, Settings } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import type { Tenant } from '@shared/schema';

const createTenantSchema = z.object({
  id: z.string().min(1, 'Tenant ID is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1, 'Name is required'),
  subdomain: z.string().optional(),
  businessName: z.string().min(1, 'Business name is required'),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  tier: z.enum(['starter', 'pro', 'elite', 'internal', 'family_free', 'family_paid']),
});

const editPlanSchema = z.object({
  planTier: z.enum(['starter', 'pro', 'elite', 'internal', 'family_free', 'family_paid']),
  status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'cancelled']),
});

type CreateTenantForm = z.infer<typeof createTenantSchema>;
type EditPlanForm = z.infer<typeof editPlanSchema>;

export default function AdminTenants() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  const { data: tenantsData, isLoading, error, isError } = useQuery<{ tenants: any[] }>({
    queryKey: ['/api/admin/tenants'],
  });

  const form = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      id: '',
      name: '',
      subdomain: '',
      businessName: '',
      logoUrl: '',
      primaryColor: '#3b82f6',
      tier: 'starter',
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: CreateTenantForm) => {
      return await apiRequest('POST', '/api/admin/tenants', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({
        title: 'Success',
        description: 'Tenant created successfully',
      });
      form.reset();
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tenant',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: CreateTenantForm) => {
    createTenantMutation.mutate(data);
  };

  const impersonateMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await apiRequest('POST', '/api/admin/impersonate/start', { tenantId });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Impersonation Active',
        description: `You are now viewing the app as ${data.tenantName}`,
      });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start impersonation',
        variant: 'destructive',
      });
    },
  });

  const handleImpersonate = (tenantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    impersonateMutation.mutate(tenantId);
  };

  const planForm = useForm<EditPlanForm>({
    resolver: zodResolver(editPlanSchema),
    defaultValues: {
      planTier: 'starter',
      status: 'trialing',
    },
  });

  const editPlanMutation = useMutation({
    mutationFn: async ({ tenantId, data }: { tenantId: string; data: EditPlanForm }) => {
      return await apiRequest('PATCH', `/api/admin/tenants/${tenantId}/plan`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({
        title: 'Success',
        description: 'Plan updated successfully',
      });
      setEditPlanDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update plan',
        variant: 'destructive',
      });
    },
  });

  const handleEditPlan = (tenant: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTenant(tenant);
    planForm.reset({
      planTier: tenant.planTier || 'starter',
      status: tenant.status || 'trialing',
    });
    setEditPlanDialogOpen(true);
  };

  const handleSavePlan = (data: EditPlanForm) => {
    if (selectedTenant) {
      editPlanMutation.mutate({ tenantId: selectedTenant.id, data });
    }
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      starter: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      elite: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      internal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    };
    return colors[tier as keyof typeof colors] || colors.starter;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      trialing: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    };
    return colors[status as keyof typeof colors] || colors.trialing;
  };

  const getTierLabel = (tier: string) => {
    const labels = {
      starter: 'Starter',
      pro: 'Pro',
      elite: 'Elite',
      internal: 'INTERNAL (at-cost)',
    };
    return labels[tier as keyof typeof labels] || tier;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      trialing: 'Trialing',
      active: 'Active',
      past_due: 'Past Due',
      suspended: 'Suspended',
      cancelled: 'Cancelled',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <AppShell title="Tenant Management">
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 max-w-[1800px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Tenant Management</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              Manage all tenants on the ServicePro platform
            </p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-tenant">
                <Plus className="w-4 h-4 mr-2" />
                Create Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Tenant</DialogTitle>
                <DialogDescription>
                  Add a new tenant to the ServicePro platform
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., acme-auto"
                            data-testid="input-tenant-id"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Acme Auto Detail"
                            data-testid="input-tenant-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Acme Auto Detailing"
                            data-testid="input-business-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subdomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subdomain (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., acme"
                            data-testid="input-subdomain"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subscription Tier</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tier">
                              <SelectValue placeholder="Select tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Professional</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="color"
                            data-testid="input-primary-color"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createTenantMutation.isPending}
                      data-testid="button-submit"
                    >
                      {createTenantMutation.isPending ? 'Creating...' : 'Create Tenant'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Plan & Status</DialogTitle>
                <DialogDescription>
                  Update the plan tier and status for {selectedTenant?.name}
                </DialogDescription>
              </DialogHeader>

              <Form {...planForm}>
                <form onSubmit={planForm.handleSubmit(handleSavePlan)} className="space-y-4">
                  <FormField
                    control={planForm.control}
                    name="planTier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Tier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-plan-tier">
                              <SelectValue placeholder="Select plan tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                            <SelectItem value="internal">Internal (at-cost)</SelectItem>
                            <SelectItem value="family_free">Family (All Free)</SelectItem>
                            <SelectItem value="family_paid">Family (Fee + Usage)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={planForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="trialing">Trialing</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="past_due">Past Due</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditPlanDialogOpen(false)}
                      data-testid="button-cancel-edit-plan"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={editPlanMutation.isPending}
                      data-testid="button-save-plan"
                    >
                      {editPlanMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card className="p-6 border-red-500 bg-red-50 dark:bg-red-950">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <Shield className="w-6 h-6" />
              <div>
                <h3 className="font-semibold">Failed to load tenants</h3>
                <p className="text-sm">{error?.message || 'Unknown error occurred'}</p>
              </div>
            </div>
            <Button 
              className="mt-4" 
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] })}
              data-testid="button-retry"
            >
              Retry
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tenantsData?.tenants.map((tenant) => (
              <Card
                key={tenant.id}
                className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                data-testid={`card-tenant-${tenant.id}`}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                      {tenant.isRoot ? (
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm sm:text-base truncate">
                        {tenant.name}
                        {tenant.isRoot && (
                          <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded flex-shrink-0">
                            ROOT
                          </span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                        {tenant.businessName || 'No business name'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tenant ID:</span>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {tenant.id}
                    </code>
                  </div>
                  
                  {tenant.subdomain && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subdomain:</span>
                      <span className="text-gray-900 dark:text-gray-100">{tenant.subdomain}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getTierBadge(tenant.planTier || 'starter')}`}>
                      {getTierLabel(tenant.planTier || 'starter')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusBadge(tenant.status || 'trialing')}`}>
                      {getStatusLabel(tenant.status || 'trialing')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Created:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {!tenant.isRoot && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => handleEditPlan(tenant, e)}
                      data-testid={`edit-plan-${tenant.id}`}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Plan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => handleImpersonate(tenant.id, e)}
                      disabled={impersonateMutation.isPending}
                      data-testid={`impersonate-tenant-${tenant.id}`}
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      Login as Tenant
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {!isLoading && tenantsData?.tenants.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No tenants yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by creating your first tenant
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-tenant">
              <Plus className="w-4 h-4 mr-2" />
              Create Tenant
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
