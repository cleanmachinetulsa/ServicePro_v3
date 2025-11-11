import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecurringServicesCalendar } from '@/components/RecurringServicesCalendar';
import { FlexibleIntervalPicker, IntervalType } from '@/components/FlexibleIntervalPicker';
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2, CalendarClock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Service {
  id: number;
  name: string;
  priceRange: string;
  minDurationHours: string | number;
  maxDurationHours: string | number;
}

interface CalendarDay {
  date: string;
  isAvailable: boolean;
  reason?: string;
  timeSlots?: any[];
}

export default function RecurringServiceBookingPage() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute('/recurring-booking/:serviceId');
  const { toast } = useToast();

  // State
  const [selectedInterval, setSelectedInterval] = useState<IntervalType>('monthly');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isDeferred, setIsDeferred] = useState(false);
  const [currentStep, setCurrentStep] = useState<'interval' | 'dates' | 'confirm'>('interval');
  const [customerId, setCustomerId] = useState<number | null>(null);

  const serviceId = params?.serviceId ? parseInt(params.serviceId) : null;

  // Get customer ID from URL parameter (phone) or sessionStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const phone = urlParams.get('phone') || sessionStorage.getItem('customerPhone');
    
    if (phone) {
      // Lookup customer by phone
      fetch(`/api/customers/by-phone?phone=${encodeURIComponent(phone)}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setCustomerId(data.data.id);
            sessionStorage.setItem('customerPhone', phone);
          }
        })
        .catch(err => console.error('Failed to lookup customer:', err));
    }
  }, []);

  // Fetch service details
  const { data: service, isLoading: serviceLoading } = useQuery<Service>({
    queryKey: ['/api/services', serviceId],
    enabled: !!serviceId,
  });

  // Fetch calendar availability
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<CalendarDay[]>({
    queryKey: ['/api/calendar/availability', selectedInterval, service?.maxDurationHours],
    queryFn: async () => {
      if (!service) return [];

      const today = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // 3 months ahead

      const response = await fetch(
        `/api/calendar/availability?` +
        `startDate=${format(today, 'yyyy-MM-dd')}&` +
        `endDate=${format(endDate, 'yyyy-MM-dd')}&` +
        `serviceDurationMinutes=${(Number(service.maxDurationHours) || 2) * 60}`
      );

      if (!response.ok) throw new Error('Failed to fetch availability');
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!service && currentStep === 'dates',
  });

  // Create recurring service mutation (no automatic redirect for defer flow)
  const createRecurringMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/recurring-services', data);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create recurring service',
        variant: 'destructive',
      });
    },
  });

  // Defer scheduling mutation
  const deferMutation = useMutation({
    mutationFn: async (recurringServiceId: number) => {
      return apiRequest('POST', `/api/recurring-services/defer/${recurringServiceId}`, {
        deferredUntilDays: 30,
      });
    },
    onSuccess: (response: any) => {
      toast({
        title: 'Scheduling Deferred',
        description: 'We\'ll send you a reminder to schedule your appointments. Check your email and SMS!',
      });
      setLocation('/my-services');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to defer scheduling',
        variant: 'destructive',
      });
    },
  });

  const handleIntervalChange = (interval: IntervalType) => {
    setSelectedInterval(interval);
    setSelectedDates([]); // Reset dates when interval changes
  };

  const handleDateSelect = (date: string) => {
    setSelectedDates([date]);
  };

  const handleMultiDateSelect = (dates: string[]) => {
    setSelectedDates(dates);
  };

  const handleConfirmBooking = async () => {
    if (!serviceId || !customerId) {
      toast({
        title: 'Error',
        description: 'Customer information not found. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const bookingData: any = {
      serviceId,
      customerId,
      frequency: selectedInterval,
      intervalType: selectedInterval,
      autoRenew: true,
      status: 'active',
      preferredTime: '9:00 AM', // TODO: Add time picker
    };

    // Only include intervalCustomDates for custom_dates interval
    if (selectedInterval === 'custom_dates') {
      bookingData.intervalCustomDates = selectedDates;
    } else if (selectedDates.length > 0) {
      // For regular intervals, set the first selected date as next scheduled date
      bookingData.nextScheduledDate = selectedDates[0];
    }

    try {
      await createRecurringMutation.mutateAsync(bookingData);
      
      // Success toast and redirect
      toast({
        title: 'Recurring Service Created',
        description: 'Your recurring service has been set up successfully!',
      });
      setLocation('/my-services');
    } catch (error) {
      // Error already handled by mutation onError
    }
  };

  const handleDeferScheduling = async () => {
    if (!serviceId || !customerId) {
      toast({
        title: 'Error',
        description: 'Customer information not found. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Create the recurring service in deferred state
    const deferredService = {
      serviceId,
      customerId,
      frequency: selectedInterval,
      intervalType: selectedInterval,
      status: 'deferred',
      autoRenew: true,
    };

    try {
      // First create the service in deferred state
      const response = await createRecurringMutation.mutateAsync(deferredService);
      const recurringServiceId = response.data.id;

      // Then defer it to send reminders (waits for completion before redirect)
      await deferMutation.mutateAsync(recurringServiceId);
      
      // Success handled by deferMutation onSuccess
    } catch (error) {
      // Error already handled by mutation onError
    }
  };

  const isCustomDates = selectedInterval === 'custom_dates';
  const canProceed =
    currentStep === 'interval' ||
    (currentStep === 'dates' && selectedDates.length > 0) ||
    currentStep === 'confirm';

  if (serviceLoading || !service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Set Up Recurring Service
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {service.name} - {service.priceRange}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${currentStep === 'interval' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'interval' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              1
            </div>
            <span>Choose Frequency</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${currentStep === 'dates' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'dates' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              2
            </div>
            <span>Select Dates</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${currentStep === 'confirm' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              3
            </div>
            <span>Confirm</span>
          </div>
        </div>

        {/* Content */}
        {currentStep === 'interval' && (
          <div className="space-y-6">
            <FlexibleIntervalPicker
              value={selectedInterval}
              onChange={handleIntervalChange}
              showPreview={true}
            />

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setLocation('/my-services')}
              >
                Cancel
              </Button>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={handleDeferScheduling}
                  disabled={deferMutation.isPending}
                >
                  {deferMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Schedule Later
                </Button>
                <Button
                  onClick={() => setCurrentStep('dates')}
                  data-testid="button-proceed-to-dates"
                >
                  Continue to Dates
                </Button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'dates' && (
          <div className="space-y-6">
            <RecurringServicesCalendar
              serviceDurationMinutes={(Number(service.maxDurationHours) || 2) * 60}
              selectedDates={selectedDates}
              onDateSelect={handleDateSelect}
              onMultiDateSelect={handleMultiDateSelect}
              multiSelectMode={isCustomDates}
              maxSelections={5}
              availabilityData={availabilityData}
              loading={availabilityLoading}
            />

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('interval')}
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('confirm')}
                disabled={selectedDates.length === 0}
                data-testid="button-proceed-to-confirm"
              >
                Continue to Confirm
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'confirm' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Confirm Your Recurring Service
                </CardTitle>
                <CardDescription>
                  Review your selections before finalizing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-gray-600 dark:text-gray-400">Service</h3>
                  <p className="text-lg">{service.name}</p>
                  <p className="text-sm text-gray-500">{service.priceRange}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-gray-600 dark:text-gray-400">Frequency</h3>
                  <p className="text-lg capitalize">{selectedInterval.replace(/_/g, ' ')}</p>
                </div>

                {selectedDates.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                      {isCustomDates ? 'Selected Dates' : 'First Appointment'}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedDates.map((date, idx) => (
                        <Badge key={idx} variant="outline" className="text-sm">
                          {format(new Date(date), 'MMM d, yyyy')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    You'll receive SMS/email reminders before each appointment. You can pause or modify your recurring service anytime from your dashboard.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('dates')}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmBooking}
                disabled={createRecurringMutation.isPending}
                data-testid="button-confirm-booking"
              >
                {createRecurringMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Confirm Recurring Service
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
