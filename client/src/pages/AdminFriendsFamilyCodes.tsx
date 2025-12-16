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
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, Edit, Gift, Users, Calendar, Infinity, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface InviteCode {
  id: number;
  code: string;
  label: string;
  description: string | null;
  inviteType: string;
  planTier: string;
  maxRedemptions: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreateInviteCodeForm {
  label: string;
  description: string;
  planTier: string;
  maxRedemptions: number | null;
  expiresAt: string;
  isActive: boolean;
}

const defaultForm: CreateInviteCodeForm = {
  label: '',
  description: '',
  planTier: 'starter',
  maxRedemptions: null,
  expiresAt: '',
  isActive: true,
};

export default function AdminFriendsFamilyCodes() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateInviteCodeForm>(defaultForm);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: codesData, isLoading } = useQuery<{ success: boolean; codes: InviteCode[] }>({
    queryKey: ['/api/admin/invite-codes'],
  });

  const codes = codesData?.codes || [];

  const createMutation = useMutation({
    mutationFn: (data: CreateInviteCodeForm) => apiRequest('POST', '/api/admin/invite-codes', {
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invite-codes'] });
      setIsCreateOpen(false);
      setForm(defaultForm);
      toast({ title: 'Invite code created', description: 'The invite code has been created successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error creating code', description: error.message || 'Failed to create invite code', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & Partial<CreateInviteCodeForm>) => {
      const payload: any = { ...data };
      if (payload.expiresAt) {
        payload.expiresAt = new Date(payload.expiresAt).toISOString();
      }
      delete payload.id;
      return apiRequest('PATCH', `/api/admin/invite-codes/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invite-codes'] });
      setIsCreateOpen(false);
      setForm(defaultForm);
      setIsEditing(false);
      setEditingId(null);
      toast({ title: 'Invite code updated', description: 'The invite code has been updated successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error updating code', description: error.message || 'Failed to update invite code', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (code: InviteCode) => {
    setForm({
      label: code.label,
      description: code.description || '',
      planTier: code.planTier,
      maxRedemptions: code.maxRedemptions,
      expiresAt: code.expiresAt ? format(parseISO(code.expiresAt), "yyyy-MM-dd'T'HH:mm") : '',
      isActive: code.isActive,
    });
    setEditingId(code.id);
    setIsEditing(true);
    setIsCreateOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: 'Code copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const getStatusBadge = (code: InviteCode) => {
    if (!code.isActive) {
      return <Badge variant="secondary" data-testid={`badge-inactive-${code.id}`}>Inactive</Badge>;
    }
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return <Badge variant="destructive" data-testid={`badge-expired-${code.id}`}>Expired</Badge>;
    }
    if (code.maxRedemptions && code.usedCount >= code.maxRedemptions) {
      return <Badge variant="outline" data-testid={`badge-maxed-${code.id}`}>Max Uses Reached</Badge>;
    }
    return <Badge variant="default" className="bg-green-600" data-testid={`badge-active-${code.id}`}>Active</Badge>;
  };

  const getPlanBadge = (tier: string) => {
    const colors: Record<string, string> = {
      starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      elite: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return <Badge className={colors[tier] || ''} data-testid={`badge-plan-${tier}`}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Badge>;
  };

  return (
    <AppShell>
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Gift className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Friends & Family Codes</h1>
              <p className="text-muted-foreground">Create invite codes for complimentary accounts</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setForm(defaultForm);
              setIsEditing(false);
              setEditingId(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-code">
                <Plus className="h-4 w-4 mr-2" />
                Create Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Edit Invite Code' : 'Create Invite Code'}</DialogTitle>
                  <DialogDescription>
                    {isEditing ? 'Update the invite code settings.' : 'Create a new invite code for Friends & Family access.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Label *</Label>
                    <Input
                      id="label"
                      data-testid="input-label"
                      placeholder="e.g., John's Family"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      data-testid="input-description"
                      placeholder="Optional notes about this code"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planTier">Plan Tier *</Label>
                    <Select
                      value={form.planTier}
                      onValueChange={(value) => setForm({ ...form, planTier: value })}
                    >
                      <SelectTrigger id="planTier" data-testid="select-plan-tier">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxRedemptions">Max Redemptions</Label>
                    <Input
                      id="maxRedemptions"
                      data-testid="input-max-redemptions"
                      type="number"
                      min="1"
                      placeholder="Unlimited if empty"
                      value={form.maxRedemptions ?? ''}
                      onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value ? parseInt(e.target.value) : null })}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for unlimited uses</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expiration Date</Label>
                    <Input
                      id="expiresAt"
                      data-testid="input-expires-at"
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      data-testid="switch-is-active"
                      checked={form.isActive}
                      onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : isEditing ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invite Codes
            </CardTitle>
            <CardDescription>
              Manage invite codes that grant complimentary access to new tenants
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : codes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invite codes yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((code) => (
                      <TableRow key={code.id} data-testid={`row-invite-code-${code.id}`}>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            <span data-testid={`text-code-${code.id}`}>{code.code}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(code.code)}
                              data-testid={`button-copy-${code.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-label-${code.id}`}>{code.label}</div>
                            {code.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{code.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getPlanBadge(code.planTier)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" data-testid={`text-usage-${code.id}`}>
                            <span>{code.usedCount}</span>
                            <span className="text-muted-foreground">/</span>
                            {code.maxRedemptions ? (
                              <span>{code.maxRedemptions}</span>
                            ) : (
                              <Infinity className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {code.expiresAt ? (
                            <div className="flex items-center gap-1 text-sm" data-testid={`text-expires-${code.id}`}>
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(code.expiresAt), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Never</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(code)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(code)}
                            data-testid={`button-edit-${code.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
