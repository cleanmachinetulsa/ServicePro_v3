import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Phone, Clock, Edit, Trash2, Plus, Save, X, PhoneForwarded, Voicemail, Info, AlertCircle, Loader2 } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import CommunicationsNav from '@/components/CommunicationsNav';

interface PhoneLine {
  id: number;
  phoneNumber: string;
  label: string;
  forwardingEnabled: boolean;
  forwardingNumber: string | null;
  voicemailGreeting: string | null;
  createdAt: Date;
  updatedAt: Date;
  schedules: PhoneSchedule[];
}

interface PhoneSchedule {
  id: number;
  phoneLineId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  action: 'forward' | 'voicemail';
  createdAt: Date;
}

interface LinesResponse {
  success: boolean;
  lines: PhoneLine[];
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PhoneSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedLine, setSelectedLine] = useState<PhoneLine | null>(null);
  const [showLineConfigModal, setShowLineConfigModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PhoneSchedule | null>(null);

  // Fetch phone lines with schedules
  const { data: linesData, isLoading } = useQuery<LinesResponse>({
    queryKey: ['/api/phone-settings/lines'],
  });

  // Line configuration form state
  const [lineConfig, setLineConfig] = useState({
    forwardingEnabled: false,
    forwardingNumber: '',
    voicemailGreeting: '',
  });

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '17:00',
    action: 'forward' as 'forward' | 'voicemail',
  });

  // Update line configuration mutation
  const updateLineMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      return await apiRequest(`/api/phone-settings/lines/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
      setShowLineConfigModal(false);
      toast({
        title: 'Line Updated',
        description: 'Phone line settings have been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update phone line settings.',
        variant: 'destructive',
      });
    },
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/phone-settings/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
      setShowScheduleModal(false);
      toast({
        title: 'Schedule Created',
        description: 'Business hours schedule has been created.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create schedule.',
        variant: 'destructive',
      });
    },
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      return await apiRequest(`/api/phone-settings/schedules/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
      setShowScheduleModal(false);
      setEditingSchedule(null);
      toast({
        title: 'Schedule Updated',
        description: 'Business hours schedule has been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update schedule.',
        variant: 'destructive',
      });
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/phone-settings/schedules/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
      toast({
        title: 'Schedule Deleted',
        description: 'Business hours schedule has been deleted.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete schedule.',
        variant: 'destructive',
      });
    },
  });

  // Open line config modal
  const handleEditLine = (line: PhoneLine) => {
    setSelectedLine(line);
    setLineConfig({
      forwardingEnabled: line.forwardingEnabled,
      forwardingNumber: line.forwardingNumber || '',
      voicemailGreeting: line.voicemailGreeting || '',
    });
    setShowLineConfigModal(true);
  };

  // Save line configuration
  const handleSaveLineConfig = () => {
    if (!selectedLine) return;

    // Validate forwarding number if forwarding is enabled
    if (lineConfig.forwardingEnabled && lineConfig.forwardingNumber) {
      const e164Regex = /^\+[1-9]\d{10,14}$/;
      if (!e164Regex.test(lineConfig.forwardingNumber)) {
        toast({
          title: 'Validation Error',
          description: 'Forwarding number must be in E.164 format (e.g., +19188565304)',
          variant: 'destructive',
        });
        return;
      }
    }

    // Validate voicemail greeting length
    if (lineConfig.voicemailGreeting && lineConfig.voicemailGreeting.length > 500) {
      toast({
        title: 'Validation Error',
        description: 'Voicemail greeting must be 500 characters or less.',
        variant: 'destructive',
      });
      return;
    }

    updateLineMutation.mutate({
      id: selectedLine.id,
      updates: lineConfig,
    });
  };

  // Open schedule modal for adding
  const handleAddSchedule = (line: PhoneLine) => {
    setSelectedLine(line);
    setScheduleForm({
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '17:00',
      action: 'forward',
    });
    setEditingSchedule(null);
    setShowScheduleModal(true);
  };

  // Open schedule modal for editing
  const handleEditSchedule = (schedule: PhoneSchedule, line: PhoneLine) => {
    setSelectedLine(line);
    setEditingSchedule(schedule);
    setScheduleForm({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      action: schedule.action,
    });
    setShowScheduleModal(true);
  };

  // Save schedule
  const handleSaveSchedule = () => {
    if (!selectedLine) return;

    // Validate time format
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(scheduleForm.startTime) || !timeRegex.test(scheduleForm.endTime)) {
      toast({
        title: 'Validation Error',
        description: 'Times must be in HH:MM 24-hour format (e.g., 09:00, 17:00)',
        variant: 'destructive',
      });
      return;
    }

    if (editingSchedule) {
      // Update existing schedule
      updateScheduleMutation.mutate({
        id: editingSchedule.id,
        updates: scheduleForm,
      });
    } else {
      // Create new schedule
      createScheduleMutation.mutate({
        phoneLineId: selectedLine.id,
        ...scheduleForm,
      });
    }
  };

  // Delete schedule
  const handleDeleteSchedule = (scheduleId: number) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      deleteScheduleMutation.mutate(scheduleId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CommunicationsNav />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  const lines = linesData?.lines || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <CommunicationsNav />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Phone className="h-8 w-8 text-primary" />
            Phone Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage your business phone lines, call forwarding, and business hours schedules
          </p>
        </div>

        {/* Phone Lines Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {lines.map((line) => (
            <Card key={line.id} data-testid={`phone-line-card-${line.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    {line.label}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditLine(line)}
                    data-testid={`edit-line-${line.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </CardTitle>
                <CardDescription>{line.phoneNumber}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {line.forwardingEnabled ? (
                      <PhoneForwarded className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Voicemail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                    <span className="text-sm font-medium">
                      {line.forwardingEnabled ? 'Forwarding Enabled' : 'Using IVR'}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    line.forwardingEnabled 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`} data-testid={`line-status-${line.id}`}>
                    {line.forwardingEnabled ? 'Active' : 'IVR Mode'}
                  </span>
                </div>

                {line.forwardingNumber && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Forwarding to:</span> {line.forwardingNumber}
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Business Hours Schedule
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddSchedule(line)}
                      data-testid={`add-schedule-${line.id}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  {line.schedules.length > 0 ? (
                    <div className="space-y-2">
                      {line.schedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded"
                          data-testid={`schedule-${schedule.id}`}
                        >
                          <div>
                            <span className="font-medium">{DAYS_OF_WEEK[schedule.dayOfWeek]}</span>
                            {' '}
                            <span className="text-gray-600 dark:text-gray-400">
                              {schedule.startTime} - {schedule.endTime}
                            </span>
                            {' '}
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              schedule.action === 'forward'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {schedule.action === 'forward' ? 'Forward' : 'Voicemail'}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSchedule(schedule, line)}
                              data-testid={`edit-schedule-${schedule.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              data-testid={`delete-schedule-${schedule.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No schedules configured
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* IVR Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              IVR System Information
            </CardTitle>
            <CardDescription>
              Interactive Voice Response (IVR) system for automated call handling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                How IVR Works
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                When call forwarding is disabled, incoming calls will be handled by our intelligent IVR system:
              </p>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Main Line:</strong> Typically uses IVR for customer service, bookings, and general inquiries</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Owner Line:</strong> Can ring directly to your personal phone during business hours</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Business Hours:</strong> All times are in <strong>America/Chicago (Central Time)</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Voicemail:</strong> Messages are transcribed and delivered via SMS/email</span>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Current IVR Status:
              </p>
              <div className="space-y-2">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded"
                  >
                    <span className="font-medium">{line.label} ({line.phoneNumber})</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      !line.forwardingEnabled
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {!line.forwardingEnabled ? 'Using IVR' : 'Forwarding Active'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => setLocation('/notifications-settings')}
                data-testid="link-voicemail-settings"
              >
                <Voicemail className="h-4 w-4 mr-2" />
                Configure Voicemail Notifications
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Configuration Modal */}
      <Dialog open={showLineConfigModal} onOpenChange={setShowLineConfigModal}>
        <DialogContent data-testid="line-config-modal">
          <DialogHeader>
            <DialogTitle>Configure {selectedLine?.label}</DialogTitle>
            <DialogDescription>
              {selectedLine?.phoneNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="forwarding-enabled" className="flex flex-col gap-1">
                <span>Call Forwarding</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                  Forward calls to your personal phone
                </span>
              </Label>
              <Switch
                id="forwarding-enabled"
                checked={lineConfig.forwardingEnabled}
                onCheckedChange={(checked) =>
                  setLineConfig({ ...lineConfig, forwardingEnabled: checked })
                }
                data-testid="toggle-forwarding"
              />
            </div>

            {lineConfig.forwardingEnabled && (
              <div className="space-y-2">
                <Label htmlFor="forwarding-number">
                  Forwarding Number
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    (E.164 format: +19188565304)
                  </span>
                </Label>
                <Input
                  id="forwarding-number"
                  placeholder="+19188565304"
                  value={lineConfig.forwardingNumber}
                  onChange={(e) =>
                    setLineConfig({ ...lineConfig, forwardingNumber: e.target.value })
                  }
                  data-testid="input-forwarding-number"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="voicemail-greeting">
                Voicemail Greeting
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({lineConfig.voicemailGreeting.length}/500 characters)
                </span>
              </Label>
              <Textarea
                id="voicemail-greeting"
                placeholder="Thank you for calling. Please leave a message..."
                value={lineConfig.voicemailGreeting}
                onChange={(e) =>
                  setLineConfig({ ...lineConfig, voicemailGreeting: e.target.value })
                }
                maxLength={500}
                rows={4}
                data-testid="textarea-voicemail-greeting"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLineConfigModal(false)}
              data-testid="button-cancel-line"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveLineConfig}
              disabled={updateLineMutation.isPending}
              data-testid="button-save-line"
            >
              {updateLineMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Configuration Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent data-testid="schedule-modal">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
            </DialogTitle>
            <DialogDescription>
              Configure business hours for {selectedLine?.label}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="day-of-week">Day of Week</Label>
              <Select
                value={scheduleForm.dayOfWeek.toString()}
                onValueChange={(value) =>
                  setScheduleForm({ ...scheduleForm, dayOfWeek: parseInt(value) })
                }
              >
                <SelectTrigger id="day-of-week" data-testid="select-day-of-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">
                  Start Time
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    (24-hour)
                  </span>
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, startTime: e.target.value })
                  }
                  data-testid="input-start-time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-time">
                  End Time
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    (24-hour)
                  </span>
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, endTime: e.target.value })
                  }
                  data-testid="input-end-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select
                value={scheduleForm.action}
                onValueChange={(value: 'forward' | 'voicemail') =>
                  setScheduleForm({ ...scheduleForm, action: value })
                }
              >
                <SelectTrigger id="action" data-testid="select-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">Forward to phone</SelectItem>
                  <SelectItem value="voicemail">Go to voicemail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowScheduleModal(false);
                setEditingSchedule(null);
              }}
              data-testid="button-cancel-schedule"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveSchedule}
              disabled={createScheduleMutation.isPending || updateScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {(createScheduleMutation.isPending || updateScheduleMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
