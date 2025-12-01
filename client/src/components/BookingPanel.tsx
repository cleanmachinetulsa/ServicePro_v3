import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, ChevronUp, Clock, MapPin, Save, Trash2, Wrench, Plus, X, Car } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { BookingDraft } from '@shared/bookingDraft';
import AddressAutocomplete from './AddressAutocomplete';

export interface VehicleData {
  id: string;
  year: string;
  make: string;
  model: string;
}

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
  addressLat?: number | string | null;
  addressLng?: number | string | null;
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
    enabled: !!conversationId && !appointmentData?.appointment && isEditing,
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

  // Form state - supports multiple services and vehicles
  const [formData, setFormData] = useState({
    serviceIds: [] as number[],
    scheduledTime: '',
    address: '',
    addressLat: null as number | null,
    addressLng: null as number | null,
    additionalRequests: '',
    vehicles: [] as VehicleData[],
  });
  
  // State for service multi-select popover
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);
  
  // Toggle service selection
  const toggleService = (serviceId: number) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId]
    }));
  };
  
  // Add new vehicle
  const addVehicle = () => {
    setFormData(prev => ({
      ...prev,
      vehicles: [...prev.vehicles, { id: crypto.randomUUID(), year: '', make: '', model: '' }]
    }));
  };
  
  // Remove vehicle
  const removeVehicle = (vehicleId: string) => {
    setFormData(prev => ({
      ...prev,
      vehicles: prev.vehicles.filter(v => v.id !== vehicleId)
    }));
  };
  
  // Update vehicle field
  const updateVehicle = (vehicleId: string, field: keyof VehicleData, value: string) => {
    setFormData(prev => ({
      ...prev,
      vehicles: prev.vehicles.map(v => 
        v.id === vehicleId ? { ...v, [field]: value } : v
      )
    }));
  };
  
  // Get selected services display text
  const getSelectedServicesText = () => {
    if (formData.serviceIds.length === 0) return 'Select services...';
    const selectedServices = services.filter(s => formData.serviceIds.includes(s.id));
    if (selectedServices.length === 1) return selectedServices[0].name;
    return `${selectedServices.length} services selected`;
  };

  // Update form when appointment loads
  useEffect(() => {
    if (appointment) {
      // Support both legacy single serviceId and new serviceIds array
      const existingServiceIds = (appointment as any).serviceIds?.length > 0 
        ? (appointment as any).serviceIds 
        : appointment.serviceId ? [appointment.serviceId] : [];
      
      // Parse vehicles from appointment if available
      const existingVehicles = (appointment as any).vehicles || [];
      
      setFormData({
        serviceIds: existingServiceIds,
        scheduledTime: appointment.scheduledTime,
        address: appointment.address,
        addressLat: appointment.addressLat ? Number(appointment.addressLat) : null,
        addressLng: appointment.addressLng ? Number(appointment.addressLng) : null,
        additionalRequests: appointment.additionalRequests?.join(', ') || '',
        vehicles: existingVehicles.map((v: any) => ({
          id: v.id || crypto.randomUUID(),
          year: v.year || '',
          make: v.make || '',
          model: v.model || ''
        })),
      });
    }
  }, [appointment]);

  // Auto-fill form with booking draft (AI Behavior V2 + Time Window Intelligence + Smart Notes)
  useEffect(() => {
    if (!appointment && bookingDraft && isEditing) {
      // Find matching service by name or use draft serviceId
      let draftServiceIds: number[] = [];
      if (bookingDraft.serviceId) {
        draftServiceIds = [bookingDraft.serviceId];
      } else if (bookingDraft.serviceName && services.length > 0) {
        const matchingService = services.find(
          s => s.name.toLowerCase() === bookingDraft.serviceName?.toLowerCase()
        );
        if (matchingService) draftServiceIds = [matchingService.id];
      }

      // Build scheduledTime from normalized date + time
      let scheduledTime = '';
      if (bookingDraft.preferredDate) {
        const time = bookingDraft.normalizedStartTime || '09:00';
        scheduledTime = new Date(`${bookingDraft.preferredDate}T${time}`).toISOString();
      }

      // Build additional requests with time preference and AI-suggested notes
      const requestParts: string[] = [];
      
      // Add time preference hint if available
      if (bookingDraft.rawTimePreference) {
        requestParts.push(`Preferred: ${bookingDraft.rawTimePreference}`);
      }
      
      // Add AI-suggested notes (Smart Notes Injection)
      if (bookingDraft.aiSuggestedNotes) {
        requestParts.push(bookingDraft.aiSuggestedNotes);
      }
      
      const additionalRequests = requestParts.join(', ');
      
      // Parse vehicle info from draft if available
      let draftVehicles: VehicleData[] = [];
      if (bookingDraft.vehicleSummary) {
        // Try to parse vehicle summary into structured data
        // Format often like "2020 Honda Accord"
        const parts = bookingDraft.vehicleSummary.split(' ');
        if (parts.length >= 3) {
          draftVehicles = [{
            id: crypto.randomUUID(),
            year: parts[0] || '',
            make: parts[1] || '',
            model: parts.slice(2).join(' ') || ''
          }];
        }
      }

      setFormData(prev => ({
        serviceIds: prev.serviceIds.length > 0 ? prev.serviceIds : draftServiceIds,
        scheduledTime: prev.scheduledTime || scheduledTime,
        address: prev.address || bookingDraft.formattedAddress || bookingDraft.address || '',
        addressLat: prev.addressLat || bookingDraft.addressLat || null,
        addressLng: prev.addressLng || bookingDraft.addressLng || null,
        additionalRequests: prev.additionalRequests || additionalRequests,
        vehicles: prev.vehicles.length > 0 ? prev.vehicles : draftVehicles,
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

    // Validate form fields - require at least one service
    if (!formData.serviceIds || formData.serviceIds.length === 0) {
      toast({
        title: 'Service required',
        description: 'Please select at least one service',
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

    // Determine if manual approval is required (outside service area with override)
    const requiresManualApproval = bookingDraft?.inServiceArea === false && override;
    
    // Prepare vehicles data (remove temp IDs)
    const vehiclesData = formData.vehicles
      .filter(v => v.year || v.make || v.model) // Only include vehicles with some data
      .map(({ year, make, model }) => ({ year, make, model }));
    
    saveAppointmentMutation.mutate({
      customerId: customerId,
      serviceId: formData.serviceIds[0], // Primary service for backward compatibility
      serviceIds: formData.serviceIds,   // All selected services
      scheduledTime: formData.scheduledTime,
      address: formData.address,
      addressLat: formData.addressLat,
      addressLng: formData.addressLng,
      additionalRequests: additionalRequestsArray,
      addOns: appointment?.addOns || null,
      vehicles: vehiclesData,
      requiresManualApproval,
    });
  };
  
  // Helper to determine save button text based on approval status
  const getCreateButtonText = () => {
    if (saveAppointmentMutation.isPending) return 'Creating...';
    if (bookingDraft?.inServiceArea === false && override) {
      return 'Submit for Manual Approval';
    }
    return 'Create Appointment';
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
                  serviceIds: [],
                  scheduledTime: '',
                  address: '',
                  addressLat: null,
                  addressLng: null,
                  additionalRequests: '',
                  vehicles: [{ id: crypto.randomUUID(), year: '', make: '', model: '' }], // Start with one empty vehicle
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
              {/* Multi-Select Services with Checkboxes */}
              <div>
                <Label className="text-xs">Services</Label>
                <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between mt-1 font-normal"
                      data-testid="select-services-trigger"
                    >
                      <span className="truncate">{getSelectedServicesText()}</span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-popover border shadow-lg" align="start">
                    <ScrollArea className="h-[200px]">
                      <div className="p-2 space-y-1">
                        {services.map((service) => (
                          <div
                            key={service.id}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => toggleService(service.id)}
                            data-testid={`service-option-${service.id}`}
                          >
                            <Checkbox
                              id={`service-${service.id}`}
                              checked={formData.serviceIds.includes(service.id)}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => toggleService(service.id)}
                            />
                            <label
                              htmlFor={`service-${service.id}`}
                              className="text-sm flex-1 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {service.name}
                              <span className="text-muted-foreground ml-1">({service.priceRange})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                {/* Selected services as chips */}
                {formData.serviceIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.serviceIds.map(id => {
                      const service = services.find(s => s.id === id);
                      return service ? (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
                        >
                          {service.name}
                          <button
                            type="button"
                            onClick={() => toggleService(id)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                            data-testid={`remove-service-${id}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Vehicle Data Collection */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Vehicle(s)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addVehicle}
                    className="h-6 text-xs"
                    data-testid="button-add-vehicle"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Vehicle
                  </Button>
                </div>
                <div className="space-y-2 mt-1">
                  {formData.vehicles.map((vehicle, index) => (
                    <div key={vehicle.id} className="flex gap-2 items-start p-2 border rounded-md bg-muted/30">
                      <Car className="h-4 w-4 mt-2 text-muted-foreground shrink-0" />
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Year"
                          value={vehicle.year}
                          onChange={(e) => updateVehicle(vehicle.id, 'year', e.target.value)}
                          className="h-8 text-sm"
                          data-testid={`input-vehicle-year-${index}`}
                        />
                        <Input
                          placeholder="Make"
                          value={vehicle.make}
                          onChange={(e) => updateVehicle(vehicle.id, 'make', e.target.value)}
                          className="h-8 text-sm"
                          data-testid={`input-vehicle-make-${index}`}
                        />
                        <Input
                          placeholder="Model"
                          value={vehicle.model}
                          onChange={(e) => updateVehicle(vehicle.id, 'model', e.target.value)}
                          className="h-8 text-sm"
                          data-testid={`input-vehicle-model-${index}`}
                        />
                      </div>
                      {formData.vehicles.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVehicle(vehicle.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          data-testid={`button-remove-vehicle-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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
                <AddressAutocomplete
                  label="Service Address"
                  value={formData.address}
                  placeholder="Start typing an address..."
                  testId="input-address-create"
                  onSelect={(result) => {
                    setFormData({
                      ...formData,
                      address: result.formatted,
                      addressLat: result.lat,
                      addressLng: result.lng,
                    });
                  }}
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
                  className={`flex-1 ${bookingDraft?.inServiceArea === false && override ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                  disabled={saveAppointmentMutation.isPending || (bookingDraft?.inServiceArea === false && !override)}
                  data-testid="button-save-appointment"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {getCreateButtonText()}
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
                    {/* Multi-Select Services with Checkboxes */}
                    <div>
                      <Label className="text-xs">Services</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between mt-1 font-normal"
                            data-testid="select-services-trigger-edit"
                          >
                            <span className="truncate">{getSelectedServicesText()}</span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0 bg-popover border shadow-lg" align="start">
                          <ScrollArea className="h-[200px]">
                            <div className="p-2 space-y-1">
                              {services.map((service) => (
                                <div
                                  key={service.id}
                                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                  onClick={() => toggleService(service.id)}
                                  data-testid={`service-option-edit-${service.id}`}
                                >
                                  <Checkbox
                                    id={`service-edit-${service.id}`}
                                    checked={formData.serviceIds.includes(service.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleService(service.id)}
                                  />
                                  <label
                                    htmlFor={`service-edit-${service.id}`}
                                    className="text-sm flex-1 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {service.name}
                                    <span className="text-muted-foreground ml-1">({service.priceRange})</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      {/* Selected services as chips */}
                      {formData.serviceIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {formData.serviceIds.map(id => {
                            const service = services.find(s => s.id === id);
                            return service ? (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
                              >
                                {service.name}
                                <button
                                  type="button"
                                  onClick={() => toggleService(id)}
                                  className="hover:bg-primary/20 rounded-full p-0.5"
                                  data-testid={`remove-service-edit-${id}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>

                    {/* Vehicle Data Collection */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Vehicle(s)</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addVehicle}
                          className="h-6 text-xs"
                          data-testid="button-add-vehicle-edit"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Vehicle
                        </Button>
                      </div>
                      <div className="space-y-2 mt-1">
                        {formData.vehicles.map((vehicle, index) => (
                          <div key={vehicle.id} className="flex gap-2 items-start p-2 border rounded-md bg-muted/30">
                            <Car className="h-4 w-4 mt-2 text-muted-foreground shrink-0" />
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <Input
                                placeholder="Year"
                                value={vehicle.year}
                                onChange={(e) => updateVehicle(vehicle.id, 'year', e.target.value)}
                                className="h-8 text-sm"
                                data-testid={`input-vehicle-year-edit-${index}`}
                              />
                              <Input
                                placeholder="Make"
                                value={vehicle.make}
                                onChange={(e) => updateVehicle(vehicle.id, 'make', e.target.value)}
                                className="h-8 text-sm"
                                data-testid={`input-vehicle-make-edit-${index}`}
                              />
                              <Input
                                placeholder="Model"
                                value={vehicle.model}
                                onChange={(e) => updateVehicle(vehicle.id, 'model', e.target.value)}
                                className="h-8 text-sm"
                                data-testid={`input-vehicle-model-edit-${index}`}
                              />
                            </div>
                            {formData.vehicles.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeVehicle(vehicle.id)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                data-testid={`button-remove-vehicle-edit-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {formData.vehicles.length === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addVehicle}
                            className="w-full"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Vehicle
                          </Button>
                        )}
                      </div>
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
                      <AddressAutocomplete
                        label="Service Address"
                        value={formData.address}
                        placeholder="Start typing an address..."
                        testId="input-address"
                        onSelect={(result) => {
                          setFormData({
                            ...formData,
                            address: result.formatted,
                            addressLat: result.lat,
                            addressLng: result.lng,
                          });
                        }}
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
                    {/* Services - show multiple if available */}
                    <div className="flex items-start gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {formData.serviceIds.length > 0 ? (
                          <div className="space-y-1">
                            {formData.serviceIds.map(id => {
                              const service = services.find(s => s.id === id);
                              return service ? (
                                <div key={id}>
                                  <p className="font-medium">{service.name}</p>
                                  <p className="text-xs text-muted-foreground">{service.priceRange}</p>
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : appointment?.service ? (
                          <>
                            <p className="font-medium">{appointment.service.name}</p>
                            <p className="text-xs text-muted-foreground">{appointment.service.priceRange}</p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">No service selected</p>
                        )}
                      </div>
                    </div>

                    {/* Vehicles */}
                    {formData.vehicles.length > 0 && formData.vehicles.some(v => v.year || v.make || v.model) && (
                      <div className="flex items-start gap-2">
                        <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="space-y-1">
                          {formData.vehicles.filter(v => v.year || v.make || v.model).map((vehicle, idx) => (
                            <p key={vehicle.id || idx} className="font-medium">
                              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p>{appointment ? format(new Date(appointment.scheduledTime), 'EEEE, MMMM d, yyyy') : 'Not scheduled'}</p>
                        <p className="text-xs text-muted-foreground">{appointment ? format(new Date(appointment.scheduledTime), 'h:mm a') : ''}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p>{appointment?.address || 'No address'}</p>
                    </div>

                    {appointment?.additionalRequests && appointment.additionalRequests.length > 0 && (
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
