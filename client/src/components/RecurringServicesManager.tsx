import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pause, Play, XCircle, Calendar, Clock, User, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const createRecurringServiceSchema = z.object({
  customerId: z.number().min(1, 'Customer is required'),
  serviceId: z.number().min(1, 'Service is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  nextScheduledDate: z.string().min(1, 'Next scheduled date is required'),
  preferredTime: z.string().optional(),
  preferredDayOfWeek: z.number().optional(),
  preferredDayOfMonth: z.number().optional(),
  notes: z.string().optional(),
  autoRenew: z.boolean().default(true),
});

type CreateRecurringServiceInput = z.infer<typeof createRecurringServiceSchema>;

export default function RecurringServicesManager() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch recurring services
  const { data: recurringData, isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['/api/recurring-services'],
  });

  // Fetch customers
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
  });

  // Fetch services
  const { data: servicesData } = useQuery({
    queryKey: ['/api/services'],
  });

  const recurringServices = (recurringData as any)?.data || [];
  const customers = (customersData as any)?.data || [];
  const services = (servicesData as any)?.data || [];

  const form = useForm<CreateRecurringServiceInput>({
    resolver: zodResolver(createRecurringServiceSchema),
    defaultValues: {
      autoRenew: true,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateRecurringServiceInput) => {
      return await apiRequest('POST', '/api/recurring-services', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-services'] });
      setShowCreateDialog(false);
      form.reset();
    },
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      return await apiRequest('POST', `/api/recurring-services/${id}/pause`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-services'] });
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/recurring-services/${id}/resume`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-services'] });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/recurring-services/${id}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-services'] });
    },
  });

  const filteredServices = recurringServices.filter((rs: any) =>
    rs.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rs.serviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rs.customerPhone?.includes(searchQuery)
  );

  const activeServices = filteredServices.filter((rs: any) => rs.status === 'active');
  const pausedServices = filteredServices.filter((rs: any) => rs.status === 'paused');
  const cancelledServices = filteredServices.filter((rs: any) => rs.status === 'cancelled');

  const onSubmit = (data: CreateRecurringServiceInput) => {
    createMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={styles[status as keyof typeof styles] || styles.active}>{status.toUpperCase()}</Badge>;
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      weekly: 'Weekly',
      biweekly: 'Every 2 Weeks',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      every_3_months: 'Every 3 Months',
      every_6_months: 'Every 6 Months',
      yearly: 'Yearly',
    };
    return labels[frequency] || frequency;
  };

  if (isLoadingRecurring) {
    return <div className="p-6 text-center">Loading recurring services...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Recurring Services</h2>
          <p className="text-sm text-muted-foreground">Manage customer subscription schedules</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-recurring-service">
              <Plus className="h-4 w-4 mr-2" />
              New Recurring Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Recurring Service</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer: any) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.name} - {customer.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-service">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {services.map((service: any) => (
                            <SelectItem key={service.id} value={service.id.toString()}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="every_3_months">Every 3 Months</SelectItem>
                          <SelectItem value="every_6_months">Every 6 Months</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextScheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Scheduled Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-next-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Time (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 9:00 AM" {...field} data-testid="input-preferred-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Special instructions..." {...field} data-testid="textarea-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-recurring">
                    {createMutation.isPending ? 'Creating...' : 'Create Recurring Service'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by customer name, phone, or service..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="input-search-recurring"
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeServices.length}</div>
            <div className="text-sm text-muted-foreground">Active Subscriptions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pausedServices.length}</div>
            <div className="text-sm text-muted-foreground">Paused</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{cancelledServices.length}</div>
            <div className="text-sm text-muted-foreground">Cancelled</div>
          </CardContent>
        </Card>
      </div>

      {/* Recurring Services List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredServices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No recurring services found. Create one to get started!
            </CardContent>
          </Card>
        ) : (
          filteredServices.map((rs: any) => (
            <Card key={rs.id} data-testid={`recurring-service-${rs.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {rs.customerName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{rs.customerPhone}</p>
                  </div>
                  {getStatusBadge(rs.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{rs.serviceName}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{getFrequencyLabel(rs.frequency)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Next: {format(new Date(rs.nextScheduledDate), 'MMM d, yyyy')}</span>
                  {rs.preferredTime && <span className="text-muted-foreground">at {rs.preferredTime}</span>}
                </div>

                {rs.notes && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {rs.notes}
                  </div>
                )}

                {rs.pauseReason && (
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 p-2 rounded">
                    Paused: {rs.pauseReason}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {rs.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseMutation.mutate({ id: rs.id, reason: 'Paused by user' })}
                      disabled={pauseMutation.isPending}
                      data-testid={`button-pause-${rs.id}`}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  {rs.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resumeMutation.mutate(rs.id)}
                      disabled={resumeMutation.isPending}
                      data-testid={`button-resume-${rs.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  )}
                  {rs.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelMutation.mutate(rs.id)}
                      disabled={cancelMutation.isPending}
                      data-testid={`button-cancel-${rs.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
