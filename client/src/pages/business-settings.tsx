import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import BackNavigation from '@/components/BackNavigation';
import { 
  Clock, 
  Calendar,
  Settings,
  Save,
  Link as LinkIcon,
  Image as ImageIcon,
  TrendingDown,
  Plus,
  Trash2,
  Shield
} from "lucide-react";
import logoBlue from '@assets/generated_images/Clean_Machine_logo_blue_0f30335d.png';
import logoBadge from '@assets/generated_images/Clean_Machine_badge_circular_ff904963.png';
import logoShield from '@assets/generated_images/Clean_Machine_shield_hexagonal_89fc94d0.png';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";

interface BusinessHours {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  lunchHour: number;
  lunchMinute: number;
  daysOfWeek: number[];
}

interface Service {
  id: number;
  name: string;
  priceRange: string;
}

interface ServiceLimit {
  id?: number;
  serviceId: number;
  serviceName?: string;
  dailyLimit: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive: boolean;
}

function ServiceLimitsTab() {
  const { toast } = useToast();
  const [isAddingLimit, setIsAddingLimit] = useState(false);
  const [editingLimit, setEditingLimit] = useState<ServiceLimit | null>(null);

  // Fetch all services
  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/admin/services'],
  });

  // Fetch service limits
  const { data: limitsData, isLoading: limitsLoading } = useQuery<{ success: boolean; limits: ServiceLimit[] }>({
    queryKey: ['/api/service-limits'],
  });

  // Create limit mutation
  const createLimitMutation = useMutation({
    mutationFn: async (data: Omit<ServiceLimit, 'id'>) => {
      return await apiRequest('POST', '/api/service-limits', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-limits'] });
      toast({
        title: "Success",
        description: "Service limit created successfully",
      });
      setIsAddingLimit(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service limit",
        variant: "destructive",
      });
    },
  });

  // Update limit mutation
  const updateLimitMutation = useMutation({
    mutationFn: async ({ id, ...data }: ServiceLimit) => {
      return await apiRequest('PUT', `/api/service-limits/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-limits'] });
      toast({
        title: "Success",
        description: "Service limit updated successfully",
      });
      setEditingLimit(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service limit",
        variant: "destructive",
      });
    },
  });

  // Delete limit mutation
  const deleteLimitMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/service-limits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-limits'] });
      toast({
        title: "Success",
        description: "Service limit removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove service limit",
        variant: "destructive",
      });
    },
  });

  const services = servicesData?.services || [];
  const limits = limitsData?.limits || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              <div className="flex items-center">
                <TrendingDown className="mr-2 h-5 w-5" />
                Daily Service Limits
              </div>
            </CardTitle>
            <CardDescription>
              Manage maximum daily capacity for each service type to prevent overbooking
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddingLimit(true)} data-testid="button-add-limit">
            <Plus className="mr-2 h-4 w-4" />
            Add Limit
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {limitsLoading || servicesLoading ? (
          <div className="text-center py-8 text-gray-500">Loading service limits...</div>
        ) : limits.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No service limits configured. Click "Add Limit" to set daily capacity caps.
          </div>
        ) : (
          <div className="space-y-3">
            {limits.map((limit) => (
              <div
                key={limit.id}
                className={`p-4 rounded-lg border ${
                  limit.isActive ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-800'
                }`}
                data-testid={`limit-${limit.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{limit.serviceName}</h4>
                      {limit.isActive ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Maximum {limit.dailyLimit} appointment{limit.dailyLimit !== 1 ? 's' : ''} per day
                    </p>
                    {(limit.effectiveFrom || limit.effectiveTo) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {limit.effectiveFrom && `From ${new Date(limit.effectiveFrom).toLocaleDateString()}`}
                        {limit.effectiveFrom && limit.effectiveTo && ' • '}
                        {limit.effectiveTo && `Until ${new Date(limit.effectiveTo).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingLimit(limit)}
                      data-testid={`button-edit-limit-${limit.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => limit.id && deleteLimitMutation.mutate(limit.id)}
                      data-testid={`button-delete-limit-${limit.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Add/Edit Limit Form */}
        {(isAddingLimit || editingLimit) && (
          <ServiceLimitForm
            limit={editingLimit}
            services={services}
            onClose={() => {
              setIsAddingLimit(false);
              setEditingLimit(null);
            }}
            onSubmit={(data) => {
              if (editingLimit?.id) {
                updateLimitMutation.mutate({ ...data, id: editingLimit.id });
              } else {
                createLimitMutation.mutate(data);
              }
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ServiceLimitForm({
  limit,
  services,
  onClose,
  onSubmit,
}: {
  limit: ServiceLimit | null;
  services: Service[];
  onClose: () => void;
  onSubmit: (data: Omit<ServiceLimit, 'id'>) => void;
}) {
  const [serviceId, setServiceId] = useState<number>(limit?.serviceId || 0);
  const [dailyLimit, setDailyLimit] = useState<number>(limit?.dailyLimit || 1);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(limit?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState<string>(limit?.effectiveTo || '');
  const [isActive, setIsActive] = useState<boolean>(limit?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) {
      return;
    }
    onSubmit({
      serviceId,
      dailyLimit,
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
      isActive,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{limit ? 'Edit' : 'Add'} Service Limit</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select
              value={serviceId.toString()}
              onValueChange={(value) => setServiceId(parseInt(value))}
              disabled={!!limit}
            >
              <SelectTrigger data-testid="select-service">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id.toString()}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dailyLimit">Daily Limit</Label>
            <Input
              id="dailyLimit"
              type="number"
              min="1"
              max="50"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 1)}
              required
              data-testid="input-daily-limit"
            />
            <p className="text-xs text-gray-500">Maximum bookings allowed per day for this service</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective From (Optional)</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                data-testid="input-effective-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveTo">Effective To (Optional)</Label>
              <Input
                id="effectiveTo"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                data-testid="input-effective-to"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-gray-500">Enable this limit immediately</p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid="switch-is-active"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-limit">
              Cancel
            </Button>
            <Button type="submit" disabled={!serviceId} data-testid="button-save-limit">
              {limit ? 'Update' : 'Create'} Limit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MaintenanceModeTab() {
  const { toast } = useToast();

  // Fetch maintenance settings
  const { data: maintenanceData, isLoading } = useQuery<{
    success: boolean;
    settings: {
      maintenanceMode: boolean;
      maintenanceMessage: string;
      backupEmail: string | null;
      alertPhone: string | null;
      autoFailoverThreshold: number;
      lastFailoverAt: Date | null;
    };
  }>({
    queryKey: ['/api/maintenance/settings'],
  });

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "We're currently performing maintenance. Please check back soon or contact us directly."
  );
  const [backupEmail, setBackupEmail] = useState('');
  const [alertPhone, setAlertPhone] = useState('');
  const [autoFailoverThreshold, setAutoFailoverThreshold] = useState(5);

  // Update state when data loads
  useEffect(() => {
    if (maintenanceData?.settings) {
      setMaintenanceMode(maintenanceData.settings.maintenanceMode);
      setMaintenanceMessage(maintenanceData.settings.maintenanceMessage);
      setBackupEmail(maintenanceData.settings.backupEmail || '');
      setAlertPhone(maintenanceData.settings.alertPhone || '');
      setAutoFailoverThreshold(maintenanceData.settings.autoFailoverThreshold);
    }
  }, [maintenanceData]);

  // Update maintenance settings mutation
  const updateMaintenanceMutation = useMutation({
    mutationFn: async (data: {
      maintenanceMode?: boolean;
      maintenanceMessage?: string;
      backupEmail?: string | null;
      alertPhone?: string | null;
      autoFailoverThreshold?: number;
    }) => {
      return await apiRequest('PUT', '/api/maintenance/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/settings'] });
      toast({
        title: "Success",
        description: "Maintenance settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update maintenance settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    updateMaintenanceMutation.mutate({
      maintenanceMode,
      maintenanceMessage,
      backupEmail: backupEmail || null,
      alertPhone: alertPhone || null,
      autoFailoverThreshold,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Maintenance & Failover Controls
          </div>
        </CardTitle>
        <CardDescription>
          Configure system maintenance mode and automated failover protection
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading maintenance settings...</div>
        ) : (
          <>
            {/* Maintenance Mode Toggle */}
            <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-1">
                  <Label htmlFor="maintenanceMode" className="text-base font-semibold">
                    Maintenance Mode
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enable to temporarily disable public bookings and display maintenance message
                  </p>
                </div>
                <Switch
                  id="maintenanceMode"
                  checked={maintenanceMode}
                  onCheckedChange={setMaintenanceMode}
                  data-testid="switch-maintenance-mode"
                />
              </div>
              {maintenanceData?.settings?.lastFailoverAt && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                  Last failover: {new Date(maintenanceData.settings.lastFailoverAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Maintenance Message */}
            <div className="space-y-2">
              <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
              <Textarea
                id="maintenanceMessage"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Enter the message to display during maintenance"
                rows={3}
                data-testid="textarea-maintenance-message"
              />
              <p className="text-xs text-gray-500">
                This message will be shown to users when maintenance mode is active
              </p>
            </div>

            {/* Backup Email */}
            <div className="space-y-2">
              <Label htmlFor="backupEmail">Backup Email (Optional)</Label>
              <Input
                id="backupEmail"
                type="email"
                value={backupEmail}
                onChange={(e) => setBackupEmail(e.target.value)}
                placeholder="backup@example.com"
                data-testid="input-backup-email"
              />
              <p className="text-xs text-gray-500">
                All booking requests will be forwarded to this email during system failures
              </p>
            </div>

            {/* Alert Phone */}
            <div className="space-y-2">
              <Label htmlFor="alertPhone">Alert Phone Number (Optional)</Label>
              <Input
                id="alertPhone"
                type="tel"
                value={alertPhone}
                onChange={(e) => setAlertPhone(e.target.value)}
                placeholder="+1 (918) 555-0123"
                data-testid="input-alert-phone"
              />
              <p className="text-xs text-gray-500">
                SMS alerts will be sent to this number for critical system failures
              </p>
            </div>

            {/* Auto-Failover Threshold */}
            <div className="space-y-2">
              <Label htmlFor="autoFailoverThreshold">Auto-Failover Threshold</Label>
              <Input
                id="autoFailoverThreshold"
                type="number"
                min="1"
                max="20"
                value={autoFailoverThreshold}
                onChange={(e) => setAutoFailoverThreshold(parseInt(e.target.value) || 5)}
                data-testid="input-auto-failover-threshold"
              />
              <p className="text-xs text-gray-500">
                Number of consecutive failures before triggering automatic failover (recommended: 3-10)
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How Failover Protection Works:</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>System monitors for consecutive booking/API failures</li>
                <li>When threshold is reached, maintenance mode activates automatically</li>
                <li>Backup email receives all booking requests during downtime</li>
                <li>SMS alerts notify you of critical issues immediately</li>
                <li>You can manually disable maintenance mode once issues are resolved</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSaveSettings}
          disabled={updateMaintenanceMutation.isPending || isLoading}
          className="ml-auto"
          data-testid="button-save-maintenance"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateMaintenanceMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function BusinessSettings() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Business hours state
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    startHour: 9,
    startMinute: 0,
    endHour: 15,
    endMinute: 0,
    lunchHour: 12,
    lunchMinute: 0,
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday (0 = Sunday, 6 = Saturday)
  });
  
  // Seasonal hours state
  const [activeScheduleType, setActiveScheduleType] = useState<'regular' | 'summer' | 'winter'>('regular');
  const [summerHours, setSummerHours] = useState({ startHour: 8, startMinute: 0, endHour: 18, endMinute: 0 });
  const [winterHours, setWinterHours] = useState({ startHour: 10, startMinute: 0, endHour: 17, endMinute: 0 });
  
  const [allowWeekendBookings, setAllowWeekendBookings] = useState<boolean>(false);
  const [halfHourIncrements, setHalfHourIncrements] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [minimumNoticeHours, setMinimumNoticeHours] = useState<number>(24);
  const [maxDriveTimeMinutes, setMaxDriveTimeMinutes] = useState<number>(26);
  const [enableLunchBreak, setEnableLunchBreak] = useState<boolean>(true);
  const [etaPadding, setEtaPadding] = useState<number>(15);
  const [googlePlaceId, setGooglePlaceId] = useState<string>('');
  
  // Available hours and minutes for select dropdowns
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];
  
  const daysOfWeek = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];
  
  const handleSaveBusinessHours = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/business-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startHour: businessHours.startHour,
          startMinute: businessHours.startMinute,
          endHour: businessHours.endHour,
          endMinute: businessHours.endMinute,
          lunchHour: businessHours.lunchHour,
          lunchMinute: businessHours.lunchMinute,
          daysOfWeek: businessHours.daysOfWeek,
          enableLunchBreak,
          allowWeekendBookings,
          halfHourIncrements,
          minimumNoticeHours,
          maxDriveTimeMinutes,
          etaPadding,
          googlePlaceId,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }
      
      toast({
        title: "Settings Saved",
        description: "Your business hours and settings have been updated.",
      });
    } catch (error) {
      console.error('Error saving business hours:', error);
      toast({
        title: "Error",
        description: "Failed to save business settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Effect to load saved settings from API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/business-settings', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.success && data.settings) {
          const settings = data.settings;
          setBusinessHours({
            startHour: settings.startHour,
            startMinute: settings.startMinute,
            endHour: settings.endHour,
            endMinute: settings.endMinute,
            lunchHour: settings.lunchHour,
            lunchMinute: settings.lunchMinute,
            daysOfWeek: settings.daysOfWeek,
          });
          setEnableLunchBreak(settings.enableLunchBreak);
          setAllowWeekendBookings(settings.allowWeekendBookings);
          setHalfHourIncrements(settings.halfHourIncrements);
          setMinimumNoticeHours(settings.minimumNoticeHours);
          setMaxDriveTimeMinutes(settings.maxDriveTimeMinutes || 26);
          setEtaPadding(settings.etaPadding || 15);
          setGooglePlaceId(settings.googlePlaceId || '');
          
          // Load seasonal hours data
          setActiveScheduleType(settings.activeScheduleType || 'regular');
          setSummerHours({
            startHour: settings.summerStartHour || 8,
            startMinute: settings.summerStartMinute || 0,
            endHour: settings.summerEndHour || 18,
            endMinute: settings.summerEndMinute || 0
          });
          setWinterHours({
            startHour: settings.winterStartHour || 10,
            startMinute: settings.winterStartMinute || 0,
            endHour: settings.winterEndHour || 17,
            endMinute: settings.winterEndMinute || 0
          });
        }
      } catch (e) {
        console.error('Error loading business settings:', e);
      }
    };
    
    loadSettings();
  }, []);
  
  const formatTimeDisplay = (hour: number, minute: number) => {
    const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${hourDisplay}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };
  
  const toggleDayOfWeek = (day: number) => {
    if (businessHours.daysOfWeek.includes(day)) {
      setBusinessHours({
        ...businessHours,
        daysOfWeek: businessHours.daysOfWeek.filter(d => d !== day)
      });
    } else {
      setBusinessHours({
        ...businessHours,
        daysOfWeek: [...businessHours.daysOfWeek, day].sort()
      });
    }
  };
  
  // Switch to a different schedule type (regular/summer/winter)
  const handleSwitchSchedule = async (scheduleType: 'regular' | 'summer' | 'winter') => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/business-settings/switch-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scheduleType }),
      });
      
      const data = await response.json();
      
      if (data.success && data.settings) {
        setActiveScheduleType(scheduleType);
        setBusinessHours({
          ...businessHours,
          startHour: data.settings.startHour,
          startMinute: data.settings.startMinute,
          endHour: data.settings.endHour,
          endMinute: data.settings.endMinute,
        });
        
        toast({
          title: "Success",
          description: `Switched to ${scheduleType} schedule`,
        });
      } else {
        throw new Error(data.message || 'Failed to switch schedule');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to switch schedule",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="mb-4">
        <BackNavigation fallbackPath="/dashboard" />
      </div>
      <header className="mb-8">
        <div>
          <h1 className="text-3xl font-bold">Business Settings</h1>
          <p className="text-gray-500">Configure your business hours and booking settings</p>
        </div>
      </header>
      
      <Tabs defaultValue="hours">
        <TabsList className="flex flex-wrap justify-start gap-1 h-auto p-1 bg-muted">
          <TabsTrigger value="hours" className="flex items-center whitespace-nowrap">
            <Clock className="mr-2 h-4 w-4" />
            Business Hours
          </TabsTrigger>
          <TabsTrigger value="booking" className="flex items-center whitespace-nowrap">
            <Calendar className="mr-2 h-4 w-4" />
            Booking Settings
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex items-center whitespace-nowrap">
            <TrendingDown className="mr-2 h-4 w-4" />
            Service Limits
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center whitespace-nowrap">
            <LinkIcon className="mr-2 h-4 w-4" />
            Google Integration
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center whitespace-nowrap">
            <Settings className="mr-2 h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center whitespace-nowrap">
            <Shield className="mr-2 h-4 w-4" />
            Maintenance
          </TabsTrigger>
        </TabsList>
        
        {/* Business Hours Tab */}
        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Business Hours
                </div>
              </CardTitle>
              <CardDescription>
                Set your business hours and availability for appointments
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Seasonal Hours Toggle */}
              <div className="space-y-3 border-b pb-6">
                <Label>Schedule Type</Label>
                <p className="text-sm text-muted-foreground">
                  Quick switch between Regular, Summer (early start), and Winter (late start) schedules
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={activeScheduleType === 'regular' ? 'default' : 'outline'}
                    onClick={() => handleSwitchSchedule('regular')}
                    disabled={isSaving}
                    data-testid="button-schedule-regular"
                    className="flex-1"
                  >
                    {activeScheduleType === 'regular' && '✓ '}Regular
                  </Button>
                  <Button
                    type="button"
                    variant={activeScheduleType === 'summer' ? 'default' : 'outline'}
                    onClick={() => handleSwitchSchedule('summer')}
                    disabled={isSaving}
                    data-testid="button-schedule-summer"
                    className="flex-1"
                  >
                    {activeScheduleType === 'summer' && '✓ '}Summer ({formatTimeDisplay(summerHours.startHour, summerHours.startMinute)} - {formatTimeDisplay(summerHours.endHour, summerHours.endMinute)})
                  </Button>
                  <Button
                    type="button"
                    variant={activeScheduleType === 'winter' ? 'default' : 'outline'}
                    onClick={() => handleSwitchSchedule('winter')}
                    disabled={isSaving}
                    data-testid="button-schedule-winter"
                    className="flex-1"
                  >
                    {activeScheduleType === 'winter' && '✓ '}Winter ({formatTimeDisplay(winterHours.startHour, winterHours.startMinute)} - {formatTimeDisplay(winterHours.endHour, winterHours.endMinute)})
                  </Button>
                </div>
                {activeScheduleType !== 'regular' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Active:</strong> {activeScheduleType.charAt(0).toUpperCase() + activeScheduleType.slice(1)} schedule is currently in use. Changes below will update the {activeScheduleType} preset.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Working Days */}
              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={businessHours.daysOfWeek.includes(day.value) ? "default" : "outline"}
                      className="capitalize"
                      onClick={() => toggleDayOfWeek(day.value)}
                    >
                      {day.label.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Start Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="startTime">Opening Time</Label>
                  <div className="flex space-x-2">
                    <Select
                      value={businessHours.startHour.toString()}
                      onValueChange={(value) => setBusinessHours({
                        ...businessHours,
                        startHour: parseInt(value)
                      })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {hours.map(hour => (
                          <SelectItem key={hour} value={hour.toString()}>
                            {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={businessHours.startMinute.toString()}
                      onValueChange={(value) => setBusinessHours({
                        ...businessHours,
                        startMinute: parseInt(value)
                      })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Minute" />
                      </SelectTrigger>
                      <SelectContent>
                        {minutes.map(minute => (
                          <SelectItem key={minute} value={minute.toString()}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* End Time */}
                <div className="space-y-1">
                  <Label htmlFor="endTime">Closing Time</Label>
                  <div className="flex space-x-2">
                    <Select
                      value={businessHours.endHour.toString()}
                      onValueChange={(value) => setBusinessHours({
                        ...businessHours,
                        endHour: parseInt(value)
                      })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {hours.map(hour => (
                          <SelectItem key={hour} value={hour.toString()}>
                            {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={businessHours.endMinute.toString()}
                      onValueChange={(value) => setBusinessHours({
                        ...businessHours,
                        endMinute: parseInt(value)
                      })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Minute" />
                      </SelectTrigger>
                      <SelectContent>
                        {minutes.map(minute => (
                          <SelectItem key={minute} value={minute.toString()}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Lunch Break Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enableLunchBreak">Enable Lunch Break</Label>
                  <p className="text-sm text-gray-500">Block appointments during lunch hour</p>
                </div>
                <Switch
                  id="enableLunchBreak"
                  checked={enableLunchBreak}
                  onCheckedChange={setEnableLunchBreak}
                  data-testid="switch-enable-lunch-break"
                />
              </div>
              
              {/* Lunch Time - only shown when enabled */}
              {enableLunchBreak && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="lunchTime">Lunch Time (Not bookable)</Label>
                    <div className="flex space-x-2">
                      <Select
                        value={businessHours.lunchHour.toString()}
                        onValueChange={(value) => setBusinessHours({
                          ...businessHours,
                          lunchHour: parseInt(value)
                        })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent>
                          {hours.map(hour => (
                            <SelectItem key={hour} value={hour.toString()}>
                              {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={businessHours.lunchMinute.toString()}
                        onValueChange={(value) => setBusinessHours({
                          ...businessHours,
                          lunchMinute: parseInt(value)
                        })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Minute" />
                        </SelectTrigger>
                        <SelectContent>
                          {minutes.map(minute => (
                            <SelectItem key={minute} value={minute.toString()}>
                              {minute.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Summary */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-medium mb-2">Business Hours Summary</h3>
                <p>Working days: {businessHours.daysOfWeek.map(day => daysOfWeek.find(d => d.value === day)?.label.slice(0, 3)).join(', ')}</p>
                <p>Hours: {formatTimeDisplay(businessHours.startHour, businessHours.startMinute)} to {formatTimeDisplay(businessHours.endHour, businessHours.endMinute)}</p>
                {enableLunchBreak && (
                  <p>Lunch break: {formatTimeDisplay(businessHours.lunchHour, businessHours.lunchMinute)} (1 hour)</p>
                )}
                {!enableLunchBreak && (
                  <p>Lunch break: Disabled - appointments available all day</p>
                )}
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                onClick={handleSaveBusinessHours} 
                disabled={isSaving}
                className="ml-auto"
              >
                {isSaving ? 'Saving...' : 'Save Business Hours'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Booking Settings Tab */}
        <TabsContent value="booking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Appointment Settings
                </div>
              </CardTitle>
              <CardDescription>
                Configure how customers can book appointments
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="allowWeekendBookings">Allow Weekend Bookings</Label>
                  <p className="text-sm text-gray-500">For emergency services only</p>
                </div>
                <Switch
                  id="allowWeekendBookings"
                  checked={allowWeekendBookings}
                  onCheckedChange={setAllowWeekendBookings}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="halfHourIncrements">Half-hour Booking Increments</Label>
                  <p className="text-sm text-gray-500">Allow 30-minute booking slots</p>
                </div>
                <Switch
                  id="halfHourIncrements"
                  checked={halfHourIncrements}
                  onCheckedChange={setHalfHourIncrements}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="minimumNoticeHours">Minimum Notice Period (hours)</Label>
                <Input
                  id="minimumNoticeHours"
                  type="number"
                  min="0"
                  max="168"
                  value={minimumNoticeHours}
                  onChange={(e) => setMinimumNoticeHours(parseInt(e.target.value) || 0)}
                  placeholder="Enter hours (e.g., 24)"
                  data-testid="input-minimum-notice-hours"
                />
                <p className="text-sm text-gray-500">
                  Minimum hours before customers can book. Examples: 0 (no minimum), 2, 24, 48
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxDriveTimeMinutes">Maximum Service Area Drive Time (minutes)</Label>
                <Input
                  id="maxDriveTimeMinutes"
                  type="number"
                  min="1"
                  max="120"
                  value={maxDriveTimeMinutes}
                  onChange={(e) => setMaxDriveTimeMinutes(parseInt(e.target.value) || 26)}
                  placeholder="Enter minutes (e.g., 26)"
                  data-testid="input-max-drive-time"
                />
                <p className="text-sm text-gray-500">
                  Maximum drive time from your Tulsa base. Customers outside this area will be offered extended-area booking. Examples: 15, 26, 30, 45
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Maximum Future Booking</Label>
                <Select defaultValue="30">
                  <SelectTrigger>
                    <SelectValue placeholder="Select days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">1 week</SelectItem>
                    <SelectItem value="14">2 weeks</SelectItem>
                    <SelectItem value="30">1 month</SelectItem>
                    <SelectItem value="90">3 months</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  How far in advance customers can book appointments
                </p>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                onClick={handleSaveBusinessHours} 
                disabled={isSaving}
                className="ml-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Service Limits Tab */}
        <TabsContent value="limits" className="space-y-4">
          <ServiceLimitsTab />
        </TabsContent>
        
        {/* Google Integration Tab */}
        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center">
                  <LinkIcon className="mr-2 h-5 w-5" />
                  Google Business Integration
                </div>
              </CardTitle>
              <CardDescription>
                Connect your Google Business Profile to sync photos and reviews
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="googlePlaceId">Google Place ID</Label>
                <Input
                  id="googlePlaceId"
                  value={googlePlaceId}
                  onChange={(e) => setGooglePlaceId(e.target.value)}
                  placeholder="ChIJ..."
                  data-testid="input-google-place-id"
                />
                <p className="text-sm text-gray-500">
                  Your Google Business Profile Place ID (e.g., "ChIJVX4B3d2TtocRCjnc7bJevHw")
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How to find your Google Place ID:</h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="underline">Google Maps</a></li>
                  <li>Search for "Clean Machine Tulsa" (or your business name)</li>
                  <li>Look at the URL - it will contain your Place ID after "!1s"</li>
                  <li>Or use Google's <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="underline">Place ID Finder</a></li>
                </ol>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> This Place ID is used to automatically sync your Google Business Profile photos and reviews. Make sure you enter the correct ID for your business.
                </p>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                onClick={handleSaveBusinessHours} 
                disabled={isSaving}
                className="ml-auto"
                data-testid="button-save-google-place-id"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center">
                  <ImageIcon className="mr-2 h-5 w-5" />
                  Logo Options
                </div>
              </CardTitle>
              <CardDescription>
                AI-generated logo options for your business
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Blue Logo */}
                <div className="space-y-3">
                  <div className="aspect-square bg-white rounded-lg border-2 border-gray-200 p-6 flex items-center justify-center">
                    <img 
                      src={logoBlue} 
                      alt="Clean Machine Blue Logo" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Blue Logo</h3>
                    <p className="text-sm text-gray-500">Minimalist professional design</p>
                  </div>
                </div>

                {/* Circular Badge */}
                <div className="space-y-3">
                  <div className="aspect-square bg-white rounded-lg border-2 border-gray-200 p-6 flex items-center justify-center">
                    <img 
                      src={logoBadge} 
                      alt="Clean Machine Circular Badge" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Circular Badge</h3>
                    <p className="text-sm text-gray-500">Modern badge design (current PWA icon)</p>
                  </div>
                </div>

                {/* Hexagonal Shield */}
                <div className="space-y-3">
                  <div className="aspect-square bg-white rounded-lg border-2 border-gray-200 p-6 flex items-center justify-center">
                    <img 
                      src={logoShield} 
                      alt="Clean Machine Hexagonal Shield" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Hexagonal Shield</h3>
                    <p className="text-sm text-gray-500">Professional emblem style</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> These logos are AI-generated and ready to use. The circular badge is currently being used as your PWA app icon. You can download any of these images for use in marketing materials, social media, or other branding needs.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <MaintenanceModeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}