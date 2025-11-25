import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, ChevronUp, Clock, MapPin, Save, Trash2, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { BookingDraft } from '@shared/bookingDraft';

interface Service {
  id: number;
  name: string;
  priceRange: string;
  durationHours: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface Appointment {
  id: number;
  customerId: number;
  serviceId: number;
  scheduledTime: string;
  address: string;
  additionalRequests: string[] | null;
  addOns: any;
  service?: Service;
  customer?: Customer;
}

interface BookingPanelProps {
  conversationId: number;
}

export default function BookingPanel({ conversationId }: BookingPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [override, setOverride] = useState(false);
  const { toast } = useToast();

  // Fetch appointment data
  const { data: appointmentData, isLoading: appointmentLoading } = useQuery<{ success: boolean; appointment: Appointment | null }>({
    queryKey: [`/api/conversations/${conversationId}/appointment`],
    enabled: !!conversationId,
  });

  // Fetch conversation to get customer ID
  const { data: conversationData } = useQuery<{ success: boolean; data: any }>({
    queryKey: [`/api/conversations/${conversationId}`],
    enabled: !!conversationId,
  });

  // Fetch all services for the dropdown
  const { data: servicesData } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  // Fetch booking draft (AI Behavior V2 auto-fill)
  // Only fetch when creating new appointment (no existing appointment, and editing)
  const { data: bookingDraft, isLoading: draftLoading, error: draftError } = useQuery<BookingDraft>({
    queryKey: ['bookingDraft', conversationId],
    enabled: !!conversationId && !appointment && isEditing,
    queryFn: async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/booking-draft`);
        if (!res.ok) {
          const errorData = await res.json();
          console.warn('[BOOKING DRAFT] Failed to load:', errorData.message);
          return null;
        }
        return res.json();
      } catch (error) {
        console.error('[BOOKING DRAFT] Error fetching draft:', error);
        return null;
      }
    },
    retry: false,
  });

  const appointment = appointmentData?.appointment;
  const conversation = conversationData?.data;
  const services = servicesData?.services || [];

  // Form state
  const [formData, setFormData] = useState({
    serviceId: 0,
    scheduledTime: '',
    address: '',
    additionalRequests: '',
  });

  // Update form when appointment loads
  useEffect(() => {
    if (appointment) {
      setFormData({
        serviceId: appointment.serviceId,
        scheduledTime: appointment.scheduledTime,
        address: appointment.address,
        additionalRequests: appointment.additionalRequests?.join(', ') || '',
      });
    }
  }, [appointment]);

  // Auto-fill form with booking draft (AI Behavior V2 + Time Window Intelligence + Smart Notes)
  useEffect(() => {
    if (!appointment && bookingDraft && isEditing) {
      // Find matching service by name or use draft serviceId
      let serviceId = bookingDraft.serviceId || 0;
      if (!serviceId && bookingDraft.serviceName && services.length > 0) {
        const matchingService = services.find(
          s => s.name.toLowerCase() === bookingDraft.serviceName?.toLowerCase()
        );
        serviceId = matchingService?.id || 0;
      }

      // Build scheduledTime from normalized date + time
      let scheduledTime = '';
      if (bookingDraft.preferredDate) {
        // If we have a normalized start time, combine date + time
        // Otherwise, default to 9:00 AM
        const time = bookingDraft.normalizedStartTime || '09:00';
        scheduledTime = new Date(`${bookingDraft.preferredDate}T${time}`).toISOString();
      }

      // Build additional requests with vehicle info, time preference, and AI-suggested notes
      // Use comma-separated format to match the save handler's split logic
      let additionalRequests = '';
      const requestParts: string[] = [];
      
      if (bookingDraft.vehicleSummary) {
        requestParts.push(`Vehicle: ${bookingDraft.vehicleSummary}`);
      }
      
      // Add time preference hint if available
      if (bookingDraft.rawTimePreference) {
        requestParts.push(`Preferred: ${bookingDraft.rawTimePreference}`);
      }
      
      // Add AI-suggested notes (Smart Notes Injection)
      if (bookingDraft.aiSuggestedNotes) {
        requestParts.push(bookingDraft.aiSuggestedNotes);
      }
      
      additionalRequests = requestParts.join(', ');

      setFormData(prev => ({
        serviceId: prev.serviceId || serviceId,
        scheduledTime: prev.scheduledTime || scheduledTime,
        address: prev.address || bookingDraft.address || '',
        additionalRequests: prev.additionalRequests || additionalRequests,
      }));
    }
  }, [bookingDraft, isEditing, appointment, services]);

  // Save appointment mutation
  const saveAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(
        'POST',
        `/api/conversations/${conversationId}/appointment`,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: 'Appointment saved',
        description: 'Booking details have been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/appointment`] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving appointment',
        description: error.message || 'Failed to save booking details',
        variant: 'destructive',
      });
    },
  });

  // Delete appointment mutation
  const deleteAppointmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}/appointment`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete appointment');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Appointment removed',
        description: 'Booking has been removed from this conversation.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/appointment`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error removing appointment',
        description: error.message || 'Failed to remove booking',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    // Get customer ID from either existing appointment or conversation
    const customerId = appointment?.customerId || conversation?.customerId;
    
    if (!customerId) {
      toast({
        title: 'Customer required',
        description: 'Cannot create appointment without customer information',
        variant: 'destructive',
      });
      return;
    }

    // Validate form fields
    if (!formData.serviceId || formData.serviceId === 0) {
      toast({
        title: 'Service required',
        description: 'Please select a service',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.scheduledTime) {
      toast({
        title: 'Date & time required',
        description: 'Please select a date and time',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.address || !formData.address.trim()) {
      toast({
        title: 'Address required',
        description: 'Please enter a service address',
        variant: 'destructive',
      });
      return;
    }

    const additionalRequestsArray = formData.additionalRequests
      .split(',')
      .map(req => req.trim())
      .filter(req => req.length > 0);

    saveAppointmentMutation.mutate({
      customerId: customerId,
      serviceId: formData.serviceId,
      scheduledTime: formData.scheduledTime,
      address: formData.address,
      additionalRequests: additionalRequestsArray,
      addOns: appointment?.addOns || null,
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to remove this appointment from the conversation?')) {
      deleteAppointmentMutation.mutate();
    }
  };

  // If no appointment exists and not editing, show a "Create Appointment" button
  if (!appointment && !isEditing) {
    return (
      <div className="border-t border-border">
        <Card className="rounded-none border-x-0 border-b-0">
          <CardContent className="px-4 py-3">
            <Button
              onClick={() => {
                setIsEditing(true);
                setIsOpen(true); // Open the panel when creating
                // Initialize form with empty values
                setFormData({
                  serviceId: services[0]?.id || 0,
                  scheduledTime: '',
                  address: '',
                  additionalRequests: '',
                });
              }}
              className="w-full"
              variant="outline"
              size="sm"
              data-testid="button-create-appointment"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Create Appointment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no appointment exists but we're editing (creating new), show the form
  if (!appointment && isEditing) {
    return (
      <div className="border-t border-border">
        <Card className="rounded-none border-x-0 border-b-0">
          <CardHeader className="py-3 px-4 bg-accent/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">
                Create New Appointment
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 space-y-4">
            {/* Create Mode - Same form as edit mode */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="service-create" className="text-xs">Service</Label>
                <Select
                  value={formData.serviceId.toString()}
                  onValueChange={(value) => setFormData({ ...formData, serviceId: parseInt(value) })}
                >
                  <SelectTrigger id="service-create" className="mt-1" data-testid="select-service">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name} ({service.priceRange})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="scheduledTime-create" className="text-xs">Date & Time</Label>
                <Input
                  id="scheduledTime-create"
                  type="datetime-local"
                  value={formData.scheduledTime ? format(new Date(formData.scheduledTime), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: new Date(e.target.value).toISOString() })}
                  className="mt-1"
                  data-testid="input-scheduled-time"
                />
              </div>

              <div>
                <Label htmlFor="address-create" className="text-xs">Address</Label>
                <Input
                  id="address-create"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter service address"
                  className="mt-1"
                  data-testid="input-address"
                />
              </div>

              {/* Service Area Warning */}
              {bookingDraft?.inServiceArea === false && !override && (
                <div className="p-3 border rounded-md bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200" data-testid="service-area-warning">
                  <div className="font-semibold mb-1">Outside Service Area</div>
                  <div className="text-sm">{bookingDraft.serviceAreaSoftDeclineMessage}</div>
                  {bookingDraft.travelMinutes != null && (
                    <div className="mt-2 text-xs opacity-70">
                      Estimated travel time: {bookingDraft.travelMinutes} minutes
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600"
                    onClick={() => setOverride(true)}
                    data-testid="button-override-service-area"
                  >
                    Submit Anyway (Requires Manual Approval)
                  </Button>
                </div>
              )}

              {/* Route-Aware Booking Suggestion */}
              {bookingDraft?.routeSuggestion && (
                <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100" data-testid="route-suggestion">
                  <div className="font-semibold text-sm">
                    Suggested time ({bookingDraft.routeSuggestion.reason})
                  </div>

                  {bookingDraft.routeSuggestion.suggestedDate && (
                    <div className="text-xs mt-1">Date: {bookingDraft.routeSuggestion.suggestedDate}</div>
                  )}

                  <div className="text-xs mt-1">
                    Time Window: {bookingDraft.routeSuggestion.suggestedStart} – {bookingDraft.routeSuggestion.suggestedEnd}
                  </div>

                  {bookingDraft.routeSuggestion.travelMinutes != null && (
                    <div className="text-xs opacity-70 mt-1">
                      Travel time: {bookingDraft.routeSuggestion.travelMinutes} minutes
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="additionalRequests-create" className="text-xs">Additional Requests</Label>
                <Input
                  id="additionalRequests-create"
                  value={formData.additionalRequests}
                  onChange={(e) => setFormData({ ...formData, additionalRequests: e.target.value })}
                  placeholder="Comma-separated requests"
                  className="mt-1"
                  data-testid="input-additional-requests"
                />
                {bookingDraft?.aiSuggestedNotes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    AI Suggestion: {bookingDraft.aiSuggestedNotes}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="flex-1"
                  disabled={saveAppointmentMutation.isPending}
                  data-testid="button-save-appointment"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {saveAppointmentMutation.isPending ? 'Creating...' : 'Create Appointment'}
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  size="sm"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="rounded-none border-x-0 border-b-0">
          <CollapsibleTrigger className="w-full" data-testid="button-toggle-booking-panel">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  Appointment Details
                </CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="px-4 pb-4 space-y-4">
              {isEditing ? (
                <>
                  {/* Edit Mode */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="service" className="text-xs">Service</Label>
                      <Select
                        value={formData.serviceId.toString()}
                        onValueChange={(value) => setFormData({ ...formData, serviceId: parseInt(value) })}
                      >
                        <SelectTrigger id="service" className="mt-1" data-testid="select-service">
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id.toString()}>
                              {service.name} ({service.priceRange})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="scheduledTime" className="text-xs">Date & Time</Label>
                      <Input
                        id="scheduledTime"
                        type="datetime-local"
                        value={formData.scheduledTime ? format(new Date(formData.scheduledTime), "yyyy-MM-dd'T'HH:mm") : ''}
                        onChange={(e) => setFormData({ ...formData, scheduledTime: new Date(e.target.value).toISOString() })}
                        className="mt-1"
                        data-testid="input-scheduled-time"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address" className="text-xs">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Enter service address"
                        className="mt-1"
                        data-testid="input-address"
                      />
                    </div>

                    {/* Service Area Warning */}
                    {bookingDraft?.inServiceArea === false && !override && (
                      <div className="p-3 border rounded-md bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200" data-testid="service-area-warning">
                        <div className="font-semibold mb-1">Outside Service Area</div>
                        <div className="text-sm">{bookingDraft.serviceAreaSoftDeclineMessage}</div>
                        {bookingDraft.travelMinutes != null && (
                          <div className="mt-2 text-xs opacity-70">
                            Estimated travel time: {bookingDraft.travelMinutes} minutes
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600"
                          onClick={() => setOverride(true)}
                          data-testid="button-override-service-area"
                        >
                          Submit Anyway (Requires Manual Approval)
                        </Button>
                      </div>
                    )}

                    {/* Route-Aware Booking Suggestion */}
                    {bookingDraft?.routeSuggestion && (
                      <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100" data-testid="route-suggestion">
                        <div className="font-semibold text-sm">
                          Suggested time ({bookingDraft.routeSuggestion.reason})
                        </div>

                        {bookingDraft.routeSuggestion.suggestedDate && (
                          <div className="text-xs mt-1">Date: {bookingDraft.routeSuggestion.suggestedDate}</div>
                        )}

                        <div className="text-xs mt-1">
                          Time Window: {bookingDraft.routeSuggestion.suggestedStart} – {bookingDraft.routeSuggestion.suggestedEnd}
                        </div>

                        {bookingDraft.routeSuggestion.travelMinutes != null && (
                          <div className="text-xs opacity-70 mt-1">
                            Travel time: {bookingDraft.routeSuggestion.travelMinutes} minutes
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="additionalRequests" className="text-xs">Additional Requests</Label>
                      <Input
                        id="additionalRequests"
                        value={formData.additionalRequests}
                        onChange={(e) => setFormData({ ...formData, additionalRequests: e.target.value })}
                        placeholder="Comma-separated requests"
                        className="mt-1"
                        data-testid="input-additional-requests"
                      />
                      {bookingDraft?.aiSuggestedNotes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          AI Suggestion: {bookingDraft.aiSuggestedNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSave}
                        size="sm"
                        className="flex-1"
                        disabled={saveAppointmentMutation.isPending}
                        data-testid="button-save-appointment"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {saveAppointmentMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        onClick={() => setIsEditing(false)}
                        variant="outline"
                        size="sm"
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* View Mode */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{appointment.service?.name}</p>
                        <p className="text-xs text-muted-foreground">{appointment.service?.priceRange}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p>{format(new Date(appointment.scheduledTime), 'EEEE, MMMM d, yyyy')}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(appointment.scheduledTime), 'h:mm a')}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p>{appointment.address}</p>
                    </div>

                    {appointment.additionalRequests && appointment.additionalRequests.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Additional Requests:</p>
                        <ul className="text-xs space-y-1">
                          {appointment.additionalRequests.map((request, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-muted-foreground">•</span>
                              <span>{request}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      data-testid="button-edit-appointment"
                    >
                      Edit Details
                    </Button>
                    <Button
                      onClick={handleDelete}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteAppointmentMutation.isPending}
                      data-testid="button-delete-appointment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
