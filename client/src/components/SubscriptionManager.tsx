import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DollarSign,
  Plus,
  X,
  Calendar,
  ExternalLink,
  Loader2,
  Edit2,
  Trash2,
  AlertCircle,
  Zap
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Subscription {
  id: number;
  serviceName: string;
  description: string | null;
  monthlyCost: string;
  billingCycle: string;
  status: string;
  renewalDate: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: number | null;
}

export default function SubscriptionManager() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [deleteSubscriptionId, setDeleteSubscriptionId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    serviceName: '',
    description: '',
    monthlyCost: '',
    billingCycle: 'monthly',
    status: 'active',
    renewalDate: '',
    website: '',
    notes: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subscriptions
  const { data: subscriptionsData, isLoading } = useQuery<{
    success: boolean;
    subscriptions: Subscription[];
    totalMonthlyCost: string;
  }>({
    queryKey: ['/api/subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      return response.json();
    },
  });

  const subscriptions = subscriptionsData?.subscriptions || [];
  const totalMonthlyCost = subscriptionsData?.totalMonthlyCost || '0.00';

  // Create subscription mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('POST', '/api/subscriptions', data);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Subscription added successfully' });
      setShowAddDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create subscription',
        variant: 'destructive' 
      });
    },
  });

  // Update subscription mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return await apiRequest('PATCH', `/api/subscriptions/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Subscription updated successfully' });
      setEditingSubscription(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update subscription',
        variant: 'destructive' 
      });
    },
  });

  // Delete subscription mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/subscriptions/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Subscription deleted successfully' });
      setDeleteSubscriptionId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete subscription',
        variant: 'destructive' 
      });
    },
  });

  // Seed/populate subscriptions mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/subscriptions/seed');
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Success', 
        description: data.message || 'Subscriptions populated successfully' 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to populate subscriptions',
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      serviceName: '',
      description: '',
      monthlyCost: '',
      billingCycle: 'monthly',
      status: 'active',
      renewalDate: '',
      website: '',
      notes: ''
    });
  };

  const handleAdd = () => {
    setShowAddDialog(true);
    resetForm();
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      serviceName: subscription.serviceName,
      description: subscription.description || '',
      monthlyCost: subscription.monthlyCost,
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      renewalDate: subscription.renewalDate || '',
      website: subscription.website || '',
      notes: subscription.notes || ''
    });
  };

  const handleSubmit = () => {
    if (editingSubscription) {
      updateMutation.mutate({ id: editingSubscription.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <Card className="bg-blue-50/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
              <DollarSign className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
              Subscription Cost Manager
            </CardTitle>
            <CardDescription>
              Track all monthly/yearly subscription costs for website services
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {subscriptions.length === 0 && (
              <Button 
                onClick={() => seedMutation.mutate()} 
                size="sm" 
                variant="outline"
                disabled={seedMutation.isPending}
                data-testid="button-populate-subscriptions"
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Auto-Populate
              </Button>
            )}
            <Button onClick={handleAdd} size="sm" data-testid="button-add-subscription">
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Cost Summary */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg text-white">
          <div className="text-sm font-medium opacity-90">Total Monthly Cost</div>
          <div className="text-4xl font-bold mt-2">${totalMonthlyCost}</div>
          <div className="text-xs opacity-75 mt-1">
            {subscriptions.filter(s => s.isActive).length} active subscriptions
          </div>
        </div>

        {/* Subscriptions Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No subscriptions added yet</p>
            <Button onClick={handleAdd} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Subscription
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-white dark:bg-gray-900 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Cost/Month</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{subscription.serviceName}</div>
                        {subscription.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {subscription.description}
                          </div>
                        )}
                        {subscription.website && (
                          <a
                            href={subscription.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            Visit site <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      $
                      {subscription.billingCycle === 'yearly'
                        ? (parseFloat(subscription.monthlyCost) / 12).toFixed(2)
                        : parseFloat(subscription.monthlyCost).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {subscription.billingCycle}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription.renewalDate ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(subscription.renewalDate).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(subscription)}
                          data-testid={`button-edit-${subscription.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteSubscriptionId(subscription.id)}
                          data-testid={`button-delete-${subscription.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || editingSubscription !== null} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingSubscription(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSubscription ? 'Edit Subscription' : 'Add New Subscription'}
            </DialogTitle>
            <DialogDescription>
              {editingSubscription 
                ? 'Update subscription details' 
                : 'Add a new service subscription to track costs'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name *</Label>
              <Input
                id="serviceName"
                value={formData.serviceName}
                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                placeholder="e.g., Stripe, Twilio, SendGrid"
                data-testid="input-service-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What this service is used for"
                rows={2}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyCost">Cost *</Label>
                <Input
                  id="monthlyCost"
                  type="number"
                  step="0.01"
                  value={formData.monthlyCost}
                  onChange={(e) => setFormData({ ...formData, monthlyCost: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingCycle">Billing Cycle *</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value) => setFormData({ ...formData, billingCycle: value })}
                >
                  <SelectTrigger data-testid="select-billing-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewalDate">Renewal Date</Label>
                <Input
                  id="renewalDate"
                  type="date"
                  value={formData.renewalDate}
                  onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                  data-testid="input-renewal-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                data-testid="input-website"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or account info"
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false);
                setEditingSubscription(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.serviceName || !formData.monthlyCost || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-subscription"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingSubscription ? 'Update' : 'Add'} Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteSubscriptionId !== null} onOpenChange={(open) => !open && setDeleteSubscriptionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this subscription from your records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSubscriptionId && deleteMutation.mutate(deleteSubscriptionId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
