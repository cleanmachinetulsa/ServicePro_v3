import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Phone, Clock, Edit, Trash2, Plus, Save, X, PhoneForwarded, Voicemail, Info, AlertCircle, Loader2, Timer, Settings, Upload, Bot, MessageSquare, CheckCircle2 } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import CommunicationsNav from '@/components/CommunicationsNav';
import { CustomRingtoneInstructions } from '@/components/phone/CustomRingtoneInstructions';
import {
  useTelephonySettings,
  type TelephonyMode,
  TELEPHONY_MODE_LABELS,
  TELEPHONY_MODE_DESCRIPTIONS,
} from '@/hooks/useTelephonySettings';

interface PhoneLine {
  id: number;
  phoneNumber: string;
  label: string;
  forwardingEnabled: boolean;
  forwardingNumber: string | null;
  ringDuration: number | null;
  voicemailGreeting: string | null;
  voicemailGreetingUrl: string | null;
  afterHoursVoicemailGreeting: string | null;
  afterHoursVoicemailGreetingUrl: string | null;
  // SIP routing fields
  sipEnabled: boolean;
  sipEndpoint: string | null;
  sipCredentialSid: string | null;
  sipFallbackNumber: string | null;
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

const MODE_ICONS: Record<TelephonyMode, any> = {
  FORWARD_ALL_CALLS: PhoneForwarded,
  AI_FIRST: Bot,
  AI_ONLY: Bot,
  TEXT_ONLY_BUSINESS: MessageSquare,
};

const MODE_BADGES: Record<TelephonyMode, { text: string; variant: 'default' | 'secondary' | 'outline' }> = {
  FORWARD_ALL_CALLS: { text: 'Simple', variant: 'outline' },
  AI_FIRST: { text: 'Recommended', variant: 'default' },
  AI_ONLY: { text: 'Automated', variant: 'secondary' },
  TEXT_ONLY_BUSINESS: { text: 'SMS Focus', variant: 'secondary' },
};

export default function PhoneSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedLine, setSelectedLine] = useState<PhoneLine | null>(null);
  const [showLineConfigModal, setShowLineConfigModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PhoneSchedule | null>(null);

  // Telephony mode selector state
  const {
    settings: telephonySettings,
    isLoading: telephonyLoading,
    updateSettings: updateTelephonySettings,
    isUpdating: telephonyUpdating,
  } = useTelephonySettings();
  
  const [selectedTelephonyMode, setSelectedTelephonyMode] = useState<TelephonyMode>('AI_FIRST');
  const [telephonyForwardingNumber, setTelephonyForwardingNumber] = useState('');
  const [allowVoicemailInTextOnly, setAllowVoicemailInTextOnly] = useState(false);
  const [hasTelephonyChanges, setHasTelephonyChanges] = useState(false);
  
  // Sync telephony settings when loaded
  useEffect(() => {
    if (telephonySettings) {
      setSelectedTelephonyMode(telephonySettings.telephonyMode);
      setTelephonyForwardingNumber(telephonySettings.forwardingNumber || '');
      setAllowVoicemailInTextOnly(telephonySettings.allowVoicemailInTextOnly);
    }
  }, [telephonySettings]);
  
  // Track telephony changes
  useEffect(() => {
    if (telephonySettings) {
      const modeChanged = selectedTelephonyMode !== telephonySettings.telephonyMode;
      const numberChanged = telephonyForwardingNumber !== (telephonySettings.forwardingNumber || '');
      const voicemailChanged = allowVoicemailInTextOnly !== telephonySettings.allowVoicemailInTextOnly;
      setHasTelephonyChanges(modeChanged || numberChanged || voicemailChanged);
    }
  }, [selectedTelephonyMode, telephonyForwardingNumber, allowVoicemailInTextOnly, telephonySettings]);
  
  const handleSaveTelephonyMode = () => {
    updateTelephonySettings({
      telephonyMode: selectedTelephonyMode,
      forwardingNumber: telephonyForwardingNumber || null,
      allowVoicemailInTextOnly,
    });
    setHasTelephonyChanges(false);
  };

  // Fetch phone lines with schedules
  const { data: linesData, isLoading } = useQuery<LinesResponse>({
    queryKey: ['/api/phone-settings/lines'],
  });

  // Line configuration form state
  const [lineConfig, setLineConfig] = useState({
    forwardingEnabled: false,
    forwardingNumber: '',
    ringDuration: 10,
    voicemailGreeting: '',
    voicemailGreetingUrl: null as string | null,
    afterHoursVoicemailGreeting: '',
    afterHoursVoicemailGreetingUrl: null as string | null,
    // SIP routing fields
    sipEnabled: false,
    sipEndpoint: '',
    sipCredentialSid: '',
    sipFallbackNumber: '',
  });

  // Audio file upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [afterHoursAudioFile, setAfterHoursAudioFile] = useState<File | null>(null);
  const [isUploadingAfterHoursAudio, setIsUploadingAfterHoursAudio] = useState(false);
  
  // File input refs for styled upload buttons
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const afterHoursAudioFileInputRef = useRef<HTMLInputElement>(null);

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
      return await apiRequest('PATCH', `/api/phone-settings/lines/${data.id}`, data.updates);
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
      return await apiRequest('POST', '/api/phone-settings/schedules', data);
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
      return await apiRequest('PATCH', `/api/phone-settings/schedules/${data.id}`, data.updates);
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
      return await apiRequest('DELETE', `/api/phone-settings/schedules/${id}`);
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
      ringDuration: line.ringDuration || 10,
      voicemailGreeting: line.voicemailGreeting || '',
      voicemailGreetingUrl: line.voicemailGreetingUrl || null,
      afterHoursVoicemailGreeting: line.afterHoursVoicemailGreeting || '',
      afterHoursVoicemailGreetingUrl: line.afterHoursVoicemailGreetingUrl || null,
      // SIP routing fields
      sipEnabled: line.sipEnabled || false,
      sipEndpoint: line.sipEndpoint || '',
      sipCredentialSid: line.sipCredentialSid || '',
      sipFallbackNumber: line.sipFallbackNumber || '',
    });
    setAudioFile(null);
    setAfterHoursAudioFile(null);
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

    // Validate after-hours voicemail greeting length
    if (lineConfig.afterHoursVoicemailGreeting && lineConfig.afterHoursVoicemailGreeting.length > 500) {
      toast({
        title: 'Validation Error',
        description: 'After-hours voicemail greeting must be 500 characters or less.',
        variant: 'destructive',
      });
      return;
    }

    // SIP Validation
    if (lineConfig.sipEnabled) {
      // If SIP is enabled, sipEndpoint is required
      if (!lineConfig.sipEndpoint || lineConfig.sipEndpoint.trim() === '') {
        toast({
          title: 'Validation Error',
          description: 'SIP endpoint is required when SIP routing is enabled.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate SIP endpoint format: username@domain
      const sipEndpointRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!sipEndpointRegex.test(lineConfig.sipEndpoint)) {
        toast({
          title: 'Validation Error',
          description: 'Invalid SIP endpoint format. Must be username@domain (e.g., jody@sip.cleanmachinetulsa.com)',
          variant: 'destructive',
        });
        return;
      }
    }
    
    // Validate SIP credential SID format if provided
    if (lineConfig.sipCredentialSid && lineConfig.sipCredentialSid.trim() !== '') {
      if (!lineConfig.sipCredentialSid.startsWith('CL')) {
        toast({
          title: 'Validation Error',
          description: 'Invalid credential SID format. Must start with "CL" (Twilio format)',
          variant: 'destructive',
        });
        return;
      }
    }
    
    // Validate SIP fallback number format if provided
    if (lineConfig.sipFallbackNumber && lineConfig.sipFallbackNumber.trim() !== '') {
      const e164Regex = /^\+[1-9]\d{10,14}$/;
      if (!e164Regex.test(lineConfig.sipFallbackNumber)) {
        toast({
          title: 'Validation Error',
          description: 'Invalid SIP fallback number. Must be in E.164 format (e.g., +19188565711)',
          variant: 'destructive',
        });
        return;
      }
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

  // Handle audio file upload
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLine) return;

    // Validate file type
    const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload an MP3, WAV, M4A, or OGG audio file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Audio file must be 5MB or less.',
        variant: 'destructive',
      });
      return;
    }

    setAudioFile(file);
    setIsUploadingAudio(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('phoneLineId', selectedLine.id.toString());

      const response = await fetch('/api/phone-settings/upload-voicemail-greeting', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      setLineConfig({
        ...lineConfig,
        voicemailGreetingUrl: data.greetingUrl,
      });

      toast({
        title: 'Upload Successful',
        description: 'Voicemail greeting audio uploaded successfully.',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload audio file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // Handle delete audio greeting
  const handleDeleteAudio = async () => {
    if (!selectedLine) return;

    try {
      const response = await fetch(`/api/phone-settings/delete-voicemail-greeting/${selectedLine.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setLineConfig({
        ...lineConfig,
        voicemailGreetingUrl: null,
      });

      setAudioFile(null);

      toast({
        title: 'Audio Deleted',
        description: 'Voicemail greeting audio has been removed.',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete audio file.',
        variant: 'destructive',
      });
    }
  };

  // Handle after-hours audio file upload
  const handleAfterHoursAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLine) return;

    // Validate file type
    const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload an MP3, WAV, M4A, or OGG audio file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Audio file must be 5MB or less.',
        variant: 'destructive',
      });
      return;
    }

    setAfterHoursAudioFile(file);
    setIsUploadingAfterHoursAudio(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('phoneLineId', selectedLine.id.toString());
      formData.append('type', 'after-hours');

      const response = await fetch('/api/phone-settings/upload-voicemail-greeting', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      setLineConfig({
        ...lineConfig,
        afterHoursVoicemailGreetingUrl: data.greetingUrl,
      });

      toast({
        title: 'Upload Successful',
        description: 'After-hours voicemail greeting audio uploaded successfully.',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload audio file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAfterHoursAudio(false);
    }
  };

  // Handle delete after-hours audio greeting
  const handleDeleteAfterHoursAudio = async () => {
    if (!selectedLine) return;

    try {
      const response = await fetch(`/api/phone-settings/delete-voicemail-greeting/${selectedLine.id}?type=after-hours`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setLineConfig({
        ...lineConfig,
        afterHoursVoicemailGreetingUrl: null,
      });

      setAfterHoursAudioFile(null);

      toast({
        title: 'Audio Deleted',
        description: 'After-hours voicemail greeting audio has been removed.',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete audio file.',
        variant: 'destructive',
      });
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

        {/* Call Handling Mode Selector */}
        <Card className="mb-8" data-testid="card-call-handling-mode">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Call Handling Mode
                </CardTitle>
                <CardDescription>
                  Choose how your business phone handles incoming calls
                </CardDescription>
              </div>
              <Button
                onClick={handleSaveTelephonyMode}
                disabled={!hasTelephonyChanges || telephonyUpdating}
                size="sm"
                data-testid="button-save-telephony-mode"
              >
                {telephonyUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Mode
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {telephonyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <RadioGroup
                  value={selectedTelephonyMode}
                  onValueChange={(value) => setSelectedTelephonyMode(value as TelephonyMode)}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                  data-testid="radio-telephony-mode"
                >
                  {(['FORWARD_ALL_CALLS', 'AI_FIRST', 'AI_ONLY', 'TEXT_ONLY_BUSINESS'] as TelephonyMode[]).map(
                    (mode) => {
                      const Icon = MODE_ICONS[mode];
                      const badge = MODE_BADGES[mode];
                      const isSelected = selectedTelephonyMode === mode;

                      return (
                        <div
                          key={mode}
                          className={`relative flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedTelephonyMode(mode)}
                          data-testid={`mode-option-${mode.toLowerCase()}`}
                        >
                          <RadioGroupItem
                            value={mode}
                            id={`telephony-${mode}`}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Icon className="h-4 w-4 text-primary shrink-0" />
                              <Label
                                htmlFor={`telephony-${mode}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {TELEPHONY_MODE_LABELS[mode]}
                              </Label>
                              <Badge variant={badge.variant} className="text-xs">{badge.text}</Badge>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {TELEPHONY_MODE_DESCRIPTIONS[mode]}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )}
                </RadioGroup>

                {selectedTelephonyMode === 'FORWARD_ALL_CALLS' && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                    <Label htmlFor="telephonyForwardingNumber" className="text-sm font-medium">
                      Forwarding Phone Number
                    </Label>
                    <Input
                      id="telephonyForwardingNumber"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={telephonyForwardingNumber}
                      onChange={(e) => setTelephonyForwardingNumber(e.target.value)}
                      className="max-w-md"
                      data-testid="input-telephony-forwarding-number"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the phone number where calls should be forwarded
                    </p>
                    {!telephonyForwardingNumber && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          A forwarding number is required. Without it, calls will fall back to AI mode.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {selectedTelephonyMode === 'TEXT_ONLY_BUSINESS' && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allowVoicemailTextOnly" className="text-sm font-medium">
                          Allow voicemail backup
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Let callers leave a voicemail after your text-only message
                        </p>
                      </div>
                      <Switch
                        id="allowVoicemailTextOnly"
                        checked={allowVoicemailInTextOnly}
                        onCheckedChange={setAllowVoicemailInTextOnly}
                        data-testid="switch-allow-voicemail"
                      />
                    </div>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Callers hear a brief message and automatically receive an SMS with your booking link.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {telephonySettings && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Current mode:</span>
                      <Badge variant="outline">
                        {TELEPHONY_MODE_LABELS[telephonySettings.telephonyMode]}
                      </Badge>
                      {telephonySettings.ivrMode && (
                        <>
                          <span className="hidden sm:inline">|</span>
                          <span className="hidden sm:inline">IVR: <span className="capitalize">{telephonySettings.ivrMode}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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

        {/* Custom Ringtone Instructions */}
        <CustomRingtoneInstructions />
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
              <div className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="ring-duration" className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Ring Duration: {lineConfig.ringDuration} seconds
                  </Label>
                  <Slider
                    id="ring-duration"
                    min={10}
                    max={60}
                    step={5}
                    value={[lineConfig.ringDuration]}
                    onValueChange={([value]) =>
                      setLineConfig({ ...lineConfig, ringDuration: value })
                    }
                    data-testid="slider-ring-duration"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    How long the phone will ring before going to voicemail (15-60 seconds)
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="voicemail-greeting">
                Voicemail Greeting (Text-to-Speech)
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
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This text will be converted to speech if no audio recording is uploaded.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Voicemail className="h-4 w-4" />
                Audio Recording (Optional)
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload a custom voicemail greeting audio file. This takes priority over text-to-speech.
              </p>

              {lineConfig.voicemailGreetingUrl ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Audio greeting uploaded
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Custom audio will be played for incoming calls
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteAudio}
                    data-testid="button-delete-audio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/ogg"
                    onChange={handleAudioUpload}
                    disabled={isUploadingAudio}
                    className="hidden"
                    data-testid="input-audio-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => audioFileInputRef.current?.click()}
                    disabled={isUploadingAudio}
                    className="w-full border-dashed border-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    data-testid="button-upload-audio"
                  >
                    {isUploadingAudio ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading audio...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Audio File
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Supported formats: MP3, WAV, M4A, OGG (max 5MB)
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <Label className="text-base font-semibold">After Hours Voicemail</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <Info className="h-3 w-3 inline mr-1" />
                    Automatically activates 30 minutes after your last schedule ends for the day
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="after-hours-greeting">
                  After Hours Greeting (Text-to-Speech)
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    ({lineConfig.afterHoursVoicemailGreeting.length}/500 characters)
                  </span>
                </Label>
                <Textarea
                  id="after-hours-greeting"
                  placeholder="You've reached Clean Machine Auto Detail after business hours. Please leave a brief message about your vehicle and we'll get back to you by the next business day."
                  value={lineConfig.afterHoursVoicemailGreeting}
                  onChange={(e) =>
                    setLineConfig({ ...lineConfig, afterHoursVoicemailGreeting: e.target.value })
                  }
                  maxLength={500}
                  rows={4}
                  data-testid="textarea-after-hours-greeting"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This greeting will play when callers reach you after hours. If not set, the regular voicemail greeting will be used.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Voicemail className="h-4 w-4" />
                  After Hours Audio Recording (Optional)
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Upload a custom after-hours greeting audio file. This takes priority over text-to-speech.
                </p>

                {lineConfig.afterHoursVoicemailGreetingUrl ? (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        After-hours audio greeting uploaded
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Custom audio will be played for after-hours calls
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAfterHoursAudio}
                      data-testid="button-delete-after-hours-audio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      ref={afterHoursAudioFileInputRef}
                      type="file"
                      accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/ogg"
                      onChange={handleAfterHoursAudioUpload}
                      disabled={isUploadingAfterHoursAudio}
                      className="hidden"
                      data-testid="input-after-hours-audio-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => afterHoursAudioFileInputRef.current?.click()}
                      disabled={isUploadingAfterHoursAudio}
                      className="w-full border-dashed border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      data-testid="button-upload-after-hours-audio"
                    >
                      {isUploadingAfterHoursAudio ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading after-hours audio...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Choose After-Hours Audio File
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Supported formats: MP3, WAV, M4A, OGG (max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* SIP Routing Configuration */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sip-enabled" className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Enable SIP Routing
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                    Route calls through SIP for custom ringtones on your Samsung phone. Requires Twilio SIP Domain setup.
                  </span>
                </Label>
                <Switch
                  id="sip-enabled"
                  checked={lineConfig.sipEnabled}
                  onCheckedChange={(checked) =>
                    setLineConfig({ ...lineConfig, sipEnabled: checked })
                  }
                  data-testid="toggle-sip-enabled"
                />
              </div>

              {lineConfig.sipEnabled && (
                <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="sip-endpoint" className="text-purple-900 dark:text-purple-100">
                      SIP Endpoint
                      <span className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                        (username@domain)
                      </span>
                    </Label>
                    <Input
                      id="sip-endpoint"
                      placeholder="jody@sip.cleanmachinetulsa.com"
                      value={lineConfig.sipEndpoint}
                      onChange={(e) =>
                        setLineConfig({ ...lineConfig, sipEndpoint: e.target.value })
                      }
                      data-testid="input-sip-endpoint"
                      className="border-purple-300 dark:border-purple-700 focus:ring-purple-500"
                    />
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Your SIP address from Twilio SIP Domain configuration
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sip-credential-sid" className="text-purple-900 dark:text-purple-100">
                      Credential SID
                      <span className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="sip-credential-sid"
                      placeholder="CLxxx..."
                      value={lineConfig.sipCredentialSid}
                      onChange={(e) =>
                        setLineConfig({ ...lineConfig, sipCredentialSid: e.target.value })
                      }
                      data-testid="input-sip-credential-sid"
                      className="border-purple-300 dark:border-purple-700 focus:ring-purple-500"
                    />
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      From Twilio Console → Voice → SIP Domains → Credential Lists
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sip-fallback-number" className="text-purple-900 dark:text-purple-100">
                      Fallback Number
                      <span className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                        (optional - E.164 format)
                      </span>
                    </Label>
                    <Input
                      id="sip-fallback-number"
                      placeholder="+19188565711"
                      value={lineConfig.sipFallbackNumber}
                      onChange={(e) =>
                        setLineConfig({ ...lineConfig, sipFallbackNumber: e.target.value })
                      }
                      data-testid="input-sip-fallback-number"
                      className="border-purple-300 dark:border-purple-700 focus:ring-purple-500"
                    />
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Tries SIP first, then this number if SIP fails (optional)
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-purple-100 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded">
                    <Info className="h-4 w-4 text-purple-700 dark:text-purple-300 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      <strong>Note:</strong> SIP routing allows you to set custom ringtones on your Samsung phone for business calls. 
                      You'll need to configure a Twilio SIP Domain and register it on your phone's SIP settings.
                    </p>
                  </div>

                  <Link href="/sip-setup-guide">
                    <Button
                      variant="outline"
                      className="w-full border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                      data-testid="button-sip-setup-guide"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      View Complete SIP Setup Guide
                    </Button>
                  </Link>
                </div>
              )}
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
