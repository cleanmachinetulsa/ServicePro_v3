import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'wouter';
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
import { Plus, Building2, Shield } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import type { Tenant } from '@shared/schema';

const createTenantSchema = z.object({
  id: z.string().min(1, 'Tenant ID is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1, 'Name is required'),
  subdomain: z.string().optional(),
  businessName: z.string().min(1, 'Business name is required'),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  tier: z.enum(['starter', 'pro', 'elite']),
});

type CreateTenantForm = z.infer<typeof createTenantSchema>;

export default function AdminTenants() {
  const { toast } = useToast();
  const [, navigate] = useState();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: tenantsData, isLoading } = useQuery<{ tenants: any[] }>({
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
      return await apiRequest('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
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

  const getTierBadge = (tier: string) => {
    const colors = {
      starter: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      elite: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    };
    return colors[tier as keyof typeof colors] || colors.starter;
  };

  return (
    <AppShell title="Tenant Management">
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tenant Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tenantsData?.tenants.map((tenant) => (
              <Card
                key={tenant.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                data-testid={`card-tenant-${tenant.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      {tenant.isRoot ? (
                        <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {tenant.name}
                        {tenant.isRoot && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded">
                            ROOT
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
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
                    <span className="text-gray-600 dark:text-gray-400">Tier:</span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getTierBadge(tenant.tier || 'starter')}`}>
                      {tenant.tier || 'starter'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Created:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
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
