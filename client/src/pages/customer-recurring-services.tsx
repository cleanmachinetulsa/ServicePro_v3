import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Pause, Play, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface RecurringService {
  id: number;
  customerId: number;
  serviceId: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  nextScheduledDate: string;
  isActive: boolean;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: {
    name: string;
    phone: string;
  };
  service?: {
    name: string;
    minDuration: number;
    maxDuration: number;
  };
}

interface Appointment {
  id: number;
  customerId: number;
  serviceName: string;
  scheduledTime: string;
  status: string;
  address: string;
  notes?: string;
}

export default function CustomerRecurringServicesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [customerPhone, setCustomerPhone] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch recurring services for the customer (using customer-specific endpoint)
  const { data: recurringServices, isLoading } = useQuery<RecurringService[]>({
    queryKey: ['/api/recurring-services/customer', customerPhone],
    queryFn: async () => {
      const response = await fetch(`/api/recurring-services/customer/${encodeURIComponent(customerPhone)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch recurring services');
      }
      const json = await response.json();
      return json.data || [];
    },
    enabled: isAuthenticated && !!customerPhone,
  });

  // Fetch upcoming appointments (using customer-specific endpoint)
  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments/customer', customerPhone],
    queryFn: async () => {
      const response = await fetch(`/api/appointments/customer/${encodeURIComponent(customerPhone)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      const json = await response.json();
      return json.data || [];
    },
    enabled: isAuthenticated && !!customerPhone,
  });

  // Pause mutation (using customer-specific endpoint with ownership verification)
  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/recurring-services/customer/${encodeURIComponent(customerPhone)}/pause/${id}`, {
        reason: 'Customer requested pause',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-services/customer', customerPhone] });
      toast({
        title: 'Service Paused',
        description: 'Your recurring service has been paused successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to pause recurring service. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Resume mutation (using customer-specific endpoint with ownership verification)
  const resumeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/recurring-services/customer/${encodeURIComponent(customerPhone)}/resume/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-services/customer', customerPhone] });
      toast({
        title: 'Service Resumed',
        description: 'Your recurring service has been resumed successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to resume recurring service. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleAuthentication = () => {
    if (!customerPhone || customerPhone.length < 10) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid phone number.',
        variant: 'destructive',
      });
      return;
    }
    setIsAuthenticated(true);
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      weekly: 'Weekly',
      biweekly: 'Every 2 Weeks',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    };
    return labels[frequency] || frequency;
  };

  const getFrequencyColor = (frequency: string) => {
    const colors: Record<string, string> = {
      weekly: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      biweekly: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      monthly: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      quarterly: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      yearly: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return colors[frequency] || 'bg-gray-100 text-gray-800';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">My Recurring Services</CardTitle>
            <CardDescription>Enter your phone number to view your recurring service schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                data-testid="input-customer-phone"
              />
            </div>
            <Button 
              onClick={handleAuthentication} 
              className="w-full"
              data-testid="button-authenticate"
            >
              View My Services
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">My Recurring Services</h1>
            <p className="text-slate-600 dark:text-slate-400">Manage your auto detailing schedule</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setIsAuthenticated(false)}
            data-testid="button-logout"
          >
            Change Number
          </Button>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" data-testid="tab-active-services">Active Services</TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming-appointments">Upcoming Appointments</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100 mx-auto"></div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Loading your services...</p>
              </div>
            ) : !recurringServices || recurringServices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Recurring Services</h3>
                  <p className="text-slate-600 dark:text-slate-400">You don't have any recurring services scheduled yet.</p>
                  <Button className="mt-4" onClick={() => setLocation('/schedule')} data-testid="button-schedule-service">
                    Schedule a Service
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {recurringServices.map((service) => (
                  <Card key={service.id} className={!service.isActive ? 'opacity-60' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {service.service?.name || 'Service'}
                            {service.isActive ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Pause className="h-5 w-5 text-orange-600" />
                            )}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            <Badge className={getFrequencyColor(service.frequency)}>
                              {getFrequencyLabel(service.frequency)}
                            </Badge>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Calendar className="h-4 w-4" />
                        <span>Next Service: {format(new Date(service.nextScheduledDate), 'PPP')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span>Duration: {service.service?.minDuration}-{service.service?.maxDuration} min</span>
                      </div>
                      
                      <div className="flex gap-2">
                        {service.isActive ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="flex-1" data-testid={`button-pause-${service.id}`}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause Service
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Pause Recurring Service?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will pause your {getFrequencyLabel(service.frequency).toLowerCase()} {service.service?.name} schedule. You can resume it anytime.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => pauseMutation.mutate(service.id)}
                                  disabled={pauseMutation.isPending}
                                >
                                  {pauseMutation.isPending ? 'Pausing...' : 'Pause Service'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => resumeMutation.mutate(service.id)}
                            disabled={resumeMutation.isPending}
                            data-testid={`button-resume-${service.id}`}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            {resumeMutation.isPending ? 'Resuming...' : 'Resume Service'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            {!appointments || appointments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Upcoming Appointments</h3>
                  <p className="text-slate-600 dark:text-slate-400">You don't have any appointments scheduled yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {appointments
                  .filter(apt => new Date(apt.scheduledTime) >= new Date())
                  .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
                  .map((appointment) => (
                    <Card key={appointment.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{appointment.serviceName}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(appointment.scheduledTime), 'PPP')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{format(new Date(appointment.scheduledTime), 'p')}</span>
                              </div>
                            </div>
                            {appointment.address && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {appointment.address}
                              </p>
                            )}
                          </div>
                          <Badge variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}>
                            {appointment.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Need to make changes?</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  To reschedule an appointment or cancel a recurring service, please contact us at (555) 123-4567 or message us on our website.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
