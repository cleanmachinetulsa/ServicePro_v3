/**
 * Phase 2.5: Admin Phone Config UI
 * 
 * Manage tenant phone configurations and IVR modes
 * Follows same patterns as AdminTenants.tsx with react-hook-form + zodResolver
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Phone, Shield, Menu, Bot, Edit, Trash2, Plus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';

interface PhoneConfig {
  id: string;
  tenantId: string;
  phoneNumber: string;
  ivrMode: 'simple' | 'ivr' | 'ai-voice';
  sipDomain: string | null;
  sipUsername: string | null;
  messagingServiceSid: string | null;
  createdAt: string;
  tenantName: string | null;
  isRoot: boolean | null;
}

interface TenantOption {
  id: string;
  name: string;
  isRoot: boolean;
}

const createPhoneConfigSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +19185551234)'),
  ivrMode: z.enum(['simple', 'ivr', 'ai-voice']),
  sipDomain: z.preprocess((val) => !val || (typeof val === 'string' && val.trim() === '') ? null : val, z.string().optional()),
  sipUsername: z.preprocess((val) => !val || (typeof val === 'string' && val.trim() === '') ? null : val, z.string().optional()),
  messagingServiceSid: z.preprocess((val) => !val || (typeof val === 'string' && val.trim() === '') ? null : val, z.string().optional()),
});

const editPhoneConfigSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +19185551234)'),
  ivrMode: z.enum(['simple', 'ivr', 'ai-voice']),
  sipDomain: z.preprocess((val) => !val || (typeof val === 'string' && val.trim() === '') ? null : val, z.string().optional()),
  sipUsername: z.preprocess((val) => !val || (typeof val === 'string' && val.trim() === '') ? null : val, z.string().optional()),
  messagingServiceSid: z.preprocess((val) => !val || (typeof val === 'string' && val.trim() === '') ? null : val, z.string().optional()),
});

type CreatePhoneConfigForm = z.infer<typeof createPhoneConfigSchema>;
type EditPhoneConfigForm = z.infer<typeof editPhoneConfigSchema>;

export default function AdminPhoneConfig() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<PhoneConfig | null>(null);

  const { data: configsData, isLoading } = useQuery<{ configs: PhoneConfig[] }>({
    queryKey: ['/api/admin/phone-config'],
  });

  const { data: tenantsData } = useQuery<{ tenants: TenantOption[] }>({
    queryKey: ['/api/admin/phone-config/tenants/list'],
  });

  const createForm = useForm<CreatePhoneConfigForm>({
    resolver: zodResolver(createPhoneConfigSchema),
    defaultValues: {
      tenantId: '',
      phoneNumber: '',
      ivrMode: 'simple',
      sipDomain: '',
      sipUsername: '',
      messagingServiceSid: '',
    },
  });

  const editForm = useForm<EditPhoneConfigForm>({
    resolver: zodResolver(editPhoneConfigSchema),
    defaultValues: {
      phoneNumber: '',
      ivrMode: 'simple',
      sipDomain: '',
      sipUsername: '',
      messagingServiceSid: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreatePhoneConfigForm) => {
      return await apiRequest('/api/admin/phone-config', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/phone-config'] });
      toast({
        title: 'Success',
        description: 'Phone configuration created successfully',
      });
      createForm.reset();
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create phone configuration',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditPhoneConfigForm }) => {
      return await apiRequest(`/api/admin/phone-config/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/phone-config'] });
      toast({
        title: 'Success',
        description: 'Phone configuration updated successfully',
      });
      editForm.reset();
      setEditDialogOpen(false);
      setSelectedConfig(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update phone configuration',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/phone-config/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/phone-config'] });
      toast({
        title: 'Success',
        description: 'Phone configuration deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete phone configuration',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = (data: CreatePhoneConfigForm) => {
    createMutation.mutate(data);
  };

  const handleEdit = (config: PhoneConfig) => {
    setSelectedConfig(config);
    editForm.reset({
      phoneNumber: config.phoneNumber,
      ivrMode: config.ivrMode,
      sipDomain: config.sipDomain || '',
      sipUsername: config.sipUsername || '',
      messagingServiceSid: config.messagingServiceSid || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = (data: EditPhoneConfigForm) => {
    if (selectedConfig) {
      updateMutation.mutate({ id: selectedConfig.id, data });
    }
  };

  const handleDelete = (config: PhoneConfig) => {
    // Root tenant configs should never reach here (button disabled), but double-check
    if (config.isRoot) {
      toast({
        title: 'Cannot Delete',
        description: 'Cannot delete root tenant phone configuration. This is the flagship business phone number.',
        variant: 'destructive',
      });
      return;
    }

    if (confirm(`Delete phone configuration for ${config.phoneNumber}? This cannot be undone.`)) {
      deleteMutation.mutate(config.id);
    }
  };

  const getIvrModeIcon = (mode: string) => {
    switch (mode) {
      case 'simple': return <Phone className="h-4 w-4" />;
      case 'ivr': return <Menu className="h-4 w-4" />;
      case 'ai-voice': return <Bot className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const getIvrModeBadge = (mode: string) => {
    switch (mode) {
      case 'simple':
        return <Badge variant="secondary">Simple Forward</Badge>;
      case 'ivr':
        return <Badge variant="default">IVR Menu</Badge>;
      case 'ai-voice':
        return <Badge variant="outline">AI Voice (Future)</Badge>;
      default:
        return <Badge variant="secondary">{mode}</Badge>;
    }
  };

  return (
    <AppShell title="Phone & IVR Settings">
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Phone & IVR Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage phone configurations and IVR modes for all tenants
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-phone-config">
                <Plus className="w-4 h-4 mr-2" />
                Add Phone Config
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Phone Configuration</DialogTitle>
                <DialogDescription>
                  Configure a phone number and IVR mode for a tenant
                </DialogDescription>
              </DialogHeader>

              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="tenantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tenant">
                              <SelectValue placeholder="Select tenant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tenantsData?.tenants.map((tenant) => (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.name}
                                {tenant.isRoot && <Shield className="inline-block ml-2 h-3 w-3" />}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="+19185551234"
                            data-testid="input-phone-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="ivrMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IVR Mode</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ivr-mode">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="simple">Simple (Direct Forward)</SelectItem>
                            <SelectItem value="ivr">IVR (Press 1/2/3/7 Menu)</SelectItem>
                            <SelectItem value="ai-voice">AI Voice (Future)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="messagingServiceSid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twilio Messaging Service SID (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="MG..."
                            data-testid="input-messaging-service-sid"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="sipDomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIP Domain (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="example.sip.twilio.com"
                            data-testid="input-sip-domain"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="sipUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIP Username (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="username"
                            data-testid="input-sip-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      data-testid="button-save-create"
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">Loading...</div>
        ) : !configsData?.configs.length ? (
          <Card className="p-12 text-center">
            <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No phone configurations yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add a phone configuration to enable calling and IVR for a tenant
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-add-first-config">
              Add First Config
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configsData.configs.map((config) => (
              <Card key={config.id} className="p-6" data-testid={`card-phone-config-${config.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getIvrModeIcon(config.ivrMode)}
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        {config.tenantName || config.tenantId}
                        {config.isRoot && (
                          <Shield className="h-4 w-4 text-blue-500" data-testid={`icon-root-${config.id}`} />
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {config.phoneNumber}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mode</div>
                    {getIvrModeBadge(config.ivrMode)}
                  </div>

                  {config.sipDomain && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">SIP Domain</div>
                      <div className="text-sm font-mono">{config.sipDomain}</div>
                    </div>
                  )}

                  {config.sipUsername && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">SIP Username</div>
                      <div className="text-sm font-mono">{config.sipUsername}</div>
                    </div>
                  )}

                  {config.messagingServiceSid && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Messaging SID</div>
                      <div className="text-sm font-mono truncate">{config.messagingServiceSid}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleEdit(config)}
                    data-testid={`button-edit-${config.id}`}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!config.isRoot && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(config)}
                      data-testid={`button-delete-${config.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Phone Configuration</DialogTitle>
              <DialogDescription>
                Update phone configuration for {selectedConfig?.tenantName}
              </DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="+19185551234"
                          data-testid="input-edit-phone-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="ivrMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IVR Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-ivr-mode">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="simple">Simple (Direct Forward)</SelectItem>
                          <SelectItem value="ivr">IVR (Press 1/2/3/7 Menu)</SelectItem>
                          <SelectItem value="ai-voice">AI Voice (Future)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="messagingServiceSid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twilio Messaging Service SID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="MG..."
                          data-testid="input-edit-messaging-service-sid"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="sipDomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SIP Domain</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="example.sip.twilio.com"
                          data-testid="input-edit-sip-domain"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="sipUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SIP Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="username"
                          data-testid="input-edit-sip-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
