import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Phone, Clock, Save, CheckCircle2 } from 'lucide-react';
import type { PhoneLine } from '@shared/schema';

type PhoneLineWithSchedules = PhoneLine & {
  schedules: Array<{
    id: number;
    phoneLineId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    action: string;
    createdAt: Date | null;
  }>;
};

export function PhoneSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery<{ success: boolean; lines: PhoneLineWithSchedules[] }>({
    queryKey: ['/api/phone-settings/lines'],
  });

  const phoneLines = response?.lines || [];

  const updateLineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PhoneLine> }) => {
      return apiRequest(`/api/phone-settings/lines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/phone-settings/lines'] });
      toast({ 
        title: 'Settings saved', 
        description: 'Phone line settings updated successfully',
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
    },
  });

  const formatSchedules = (schedules: PhoneLineWithSchedules['schedules']) => {
    if (schedules.length === 0) return 'No schedule configured';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grouped = schedules.reduce((acc, schedule) => {
      const key = `${schedule.startTime}-${schedule.endTime}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(schedule.dayOfWeek);
      return acc;
    }, {} as Record<string, number[]>);

    return Object.entries(grouped).map(([timeRange, days]) => {
      const [start, end] = timeRange.split('-');
      const dayList = days.sort().map(d => dayNames[d]).join(', ');
      return `${dayList}: ${start} - ${end}`;
    }).join(' | ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phone & Voice Settings</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Lines & Call Routing
          </CardTitle>
          <CardDescription>
            Configure business hours, call forwarding, and voicemail settings for your Twilio phone lines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {phoneLines.map((line) => (
            <PhoneLineSettings
              key={line.id}
              line={line}
              onUpdate={(data) => updateLineMutation.mutate({ id: line.id, data })}
              isSaving={updateLineMutation.isPending}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PhoneLineSettings({
  line,
  onUpdate,
  isSaving,
}: {
  line: PhoneLineWithSchedules;
  onUpdate: (data: Partial<PhoneLine>) => void;
  isSaving: boolean;
}) {
  const [localLine, setLocalLine] = useState(line);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: keyof PhoneLine, value: any) => {
    setLocalLine((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: Partial<PhoneLine> = {};
    
    if (localLine.forwardingEnabled !== line.forwardingEnabled) {
      updates.forwardingEnabled = localLine.forwardingEnabled;
    }
    if (localLine.forwardingNumber !== line.forwardingNumber) {
      updates.forwardingNumber = localLine.forwardingNumber;
    }
    if (localLine.voicemailGreeting !== line.voicemailGreeting) {
      updates.voicemailGreeting = localLine.voicemailGreeting;
    }
    if (localLine.label !== line.label) {
      updates.label = localLine.label;
    }
    if (localLine.ringDuration !== line.ringDuration) {
      updates.ringDuration = localLine.ringDuration;
    }
    if (localLine.sipEndpoint !== line.sipEndpoint) {
      updates.sipEndpoint = localLine.sipEndpoint;
    }
    if (localLine.voicemailGreetingUrl !== line.voicemailGreetingUrl) {
      updates.voicemailGreetingUrl = localLine.voicemailGreetingUrl;
    }
    if (localLine.sipEnabled !== line.sipEnabled) {
      updates.sipEnabled = localLine.sipEnabled;
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
      setHasChanges(false);
    }
  };

  const formatSchedules = (schedules: PhoneLineWithSchedules['schedules']) => {
    if (schedules.length === 0) return 'No schedule configured';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grouped = schedules.reduce((acc, schedule) => {
      const key = `${schedule.startTime}-${schedule.endTime}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(schedule.dayOfWeek);
      return acc;
    }, {} as Record<string, number[]>);

    return Object.entries(grouped).map(([timeRange, days]) => {
      const [start, end] = timeRange.split('-');
      const dayList = days.sort().map(d => dayNames[d]).join(', ');
      return `${dayList}: ${start} - ${end}`;
    }).join('\n');
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{localLine.label}</h3>
          <p className="text-sm text-muted-foreground">{localLine.phoneNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`forwarding-${line.id}`} className="text-sm">
            Call Forwarding
          </Label>
          <Switch
            id={`forwarding-${line.id}`}
            checked={localLine.forwardingEnabled}
            onCheckedChange={(checked) => handleChange('forwardingEnabled', checked)}
            data-testid={`switch-forwarding-${line.phoneNumber}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`forward-number-${line.id}`}>Forward Calls To</Label>
          <Input
            id={`forward-number-${line.id}`}
            type="tel"
            placeholder="+1 (918) 555-0100"
            value={localLine.forwardingNumber || ''}
            onChange={(e) => handleChange('forwardingNumber', e.target.value)}
            disabled={!localLine.forwardingEnabled}
            data-testid={`input-forwarding-number-${line.phoneNumber}`}
          />
          <p className="text-xs text-muted-foreground">
            Your personal cell phone number for call forwarding
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Business Hours
          </Label>
          <div className="bg-muted rounded-md p-3 min-h-[2.5rem]">
            {line.schedules.length > 0 ? (
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {formatSchedules(line.schedules)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">No business hours configured</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Calls forward during these hours, otherwise go to voicemail
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor={`ring-duration-${line.id}`} className="flex items-center justify-between">
          <span>Ring Duration</span>
          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {localLine.ringDuration || 10}s
          </span>
        </Label>
        <Slider
          id={`ring-duration-${line.id}`}
          min={10}
          max={60}
          step={5}
          value={[localLine.ringDuration || 10]}
          onValueChange={(value) => handleChange('ringDuration', value[0])}
          className="w-full"
          data-testid={`slider-ring-duration-${line.phoneNumber}`}
        />
        <p className="text-xs text-muted-foreground">
          How long to ring your phone before going to voicemail (10-60 seconds)
        </p>
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-2">
        <Switch
          id={`sip-enabled-${line.id}`}
          checked={localLine.sipEnabled || false}
          onCheckedChange={(checked) => handleChange('sipEnabled', checked)}
          data-testid={`switch-sip-enabled-${line.phoneNumber}`}
        />
        <Label htmlFor={`sip-enabled-${line.id}`} className="cursor-pointer flex-1">
          <span className="font-semibold">Enable SIP Routing</span>
          <p className="text-xs text-muted-foreground mt-1">Route calls through SIP for custom ringtones on your Samsung phone with Groundwire</p>
        </Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`sip-endpoint-${line.id}`}>SIP Endpoint (Groundwire)</Label>
          <Input
            id={`sip-endpoint-${line.id}`}
            type="text"
            placeholder="jody@cleanmachinetulsa.sip.twilio.com"
            value={localLine.sipEndpoint || ''}
            onChange={(e) => handleChange('sipEndpoint', e.target.value)}
            disabled={!localLine.sipEnabled}
            data-testid={`input-sip-endpoint-${line.phoneNumber}`}
          />
          <p className="text-xs text-muted-foreground">
            SIP address for Groundwire (format: username@cleanmachinetulsa.sip.twilio.com)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`greeting-url-${line.id}`}>Voicemail Greeting Audio URL</Label>
          <Input
            id={`greeting-url-${line.id}`}
            type="text"
            placeholder="/assets/voicemail-greeting.mp3"
            value={localLine.voicemailGreetingUrl || ''}
            onChange={(e) => handleChange('voicemailGreetingUrl', e.target.value)}
            data-testid={`input-greeting-url-${line.phoneNumber}`}
          />
          <p className="text-xs text-muted-foreground">
            URL to MP3 file played when customer leaves voicemail (e.g., /assets/voicemail-greeting.mp3)
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`greeting-${line.id}`}>Voicemail / IVR Greeting (Text)</Label>
        <Textarea
          id={`greeting-${line.id}`}
          placeholder="Thank you for calling Clean Machine Auto Detail..."
          value={localLine.voicemailGreeting || ''}
          onChange={(e) => handleChange('voicemailGreeting', e.target.value)}
          rows={3}
          data-testid={`textarea-voicemail-greeting-${line.phoneNumber}`}
        />
        <p className="text-xs text-muted-foreground">
          Message played to callers after hours or when forwarding is disabled (used if no audio URL is set)
        </p>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid={`button-save-${line.phoneNumber}`}
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setLocalLine(line);
              setHasChanges(false);
            }}
            disabled={isSaving}
            data-testid={`button-cancel-${line.phoneNumber}`}
          >
            Cancel
          </Button>
        </div>
      )}

      {!hasChanges && !isSaving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>Settings saved</span>
        </div>
      )}
    </div>
  );
}
