import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Bell, MessageSquare, DollarSign, AlertTriangle } from 'lucide-react';

export function NotificationPreferences() {
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['/api/notification-preferences/me']
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest('/api/notification-preferences/me', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences/me'] });
      toast({
        title: 'Preferences updated',
        description: 'Notification settings saved successfully'
      });
    }
  });

  const handleToggle = (field: string, value: boolean) => {
    updateMutation.mutate({ ...prefs, [field]: value });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Voicemail Notifications</CardTitle>
          </div>
          <CardDescription>Get notified when customers leave voicemails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="voicemail-sms">SMS Text Message</Label>
            <Switch
              id="voicemail-sms"
              data-testid="toggle-voicemail-sms"
              checked={prefs?.voicemailSms ?? true}
              onCheckedChange={(checked) => handleToggle('voicemailSms', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="voicemail-push">Push Notification</Label>
            <Switch
              id="voicemail-push"
              data-testid="toggle-voicemail-push"
              checked={prefs?.voicemailPush ?? true}
              onCheckedChange={(checked) => handleToggle('voicemailPush', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Cash Payment Notifications</CardTitle>
          </div>
          <CardDescription>Alerts when technicians collect cash/check payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="cash-sms">SMS Text Message</Label>
            <Switch
              id="cash-sms"
              data-testid="toggle-cash-sms"
              checked={prefs?.cashPaymentSms ?? true}
              onCheckedChange={(checked) => handleToggle('cashPaymentSms', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cash-push">Push Notification</Label>
            <Switch
              id="cash-push"
              data-testid="toggle-cash-push"
              checked={prefs?.cashPaymentPush ?? true}
              onCheckedChange={(checked) => handleToggle('cashPaymentPush', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>System Error Notifications</CardTitle>
          </div>
          <CardDescription>Critical system alerts and errors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="error-sms">SMS Text Message</Label>
            <Switch
              id="error-sms"
              data-testid="toggle-error-sms"
              checked={prefs?.systemErrorSms ?? true}
              onCheckedChange={(checked) => handleToggle('systemErrorSms', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="error-push">Push Notification</Label>
            <Switch
              id="error-push"
              data-testid="toggle-error-push"
              checked={prefs?.systemErrorPush ?? true}
              onCheckedChange={(checked) => handleToggle('systemErrorPush', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Other Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="reminder-push">Appointment Reminders (Push)</Label>
            <Switch
              id="reminder-push"
              data-testid="toggle-reminder-push"
              checked={prefs?.appointmentReminderPush ?? true}
              onCheckedChange={(checked) => handleToggle('appointmentReminderPush', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
