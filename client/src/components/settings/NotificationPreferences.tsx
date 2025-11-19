import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Bell, MessageSquare, DollarSign, AlertTriangle, PhoneForwarded, Save } from 'lucide-react';

export function NotificationPreferences() {
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['/api/notification-preferences/me']
  });

  const { data: businessSettings, isLoading: isLoadingBusiness } = useQuery({
    queryKey: ['/api/business-settings']
  });

  // Derive SMS fallback settings directly from business settings (prevents stale defaults)
  const smsFallbackDefaults = useMemo(() => ({
    enabled: businessSettings?.data?.smsFallbackEnabled || false,
    phone: businessSettings?.data?.smsFallbackPhone || '',
    autoReply: businessSettings?.data?.smsFallbackAutoReply || "Thanks for your message! Our automated system is currently offline. You'll receive a personal response shortly."
  }), [businessSettings?.data]);

  const [smsFallbackSettings, setSmsFallbackSettings] = useState(smsFallbackDefaults);

  // Sync local state when businessSettings data changes (e.g., after query refetch)
  useEffect(() => {
    setSmsFallbackSettings(smsFallbackDefaults);
  }, [smsFallbackDefaults]);

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

  const updateSmsFallbackMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest('/api/business-settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...businessSettings?.data,
          smsFallbackEnabled: updates.enabled,
          smsFallbackPhone: updates.phone,
          smsFallbackAutoReply: updates.autoReply
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      toast({
        title: 'SMS Fallback updated',
        description: 'Emergency fallback settings saved successfully'
      });
    }
  });

  const handleToggle = (field: string, value: boolean) => {
    updateMutation.mutate({ ...prefs, [field]: value });
  };

  const handleSmsFallbackSave = () => {
    updateSmsFallbackMutation.mutate(smsFallbackSettings);
  };

  if (isLoading || isLoadingBusiness) return <div>Loading...</div>;

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

      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PhoneForwarded className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-orange-600 dark:text-orange-400">Emergency SMS Fallback</CardTitle>
          </div>
          <CardDescription>
            When the main system is down, forward customer messages to your personal phone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sms-fallback-enabled">Enable SMS Fallback System</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically forward messages when the system is offline
              </p>
            </div>
            <Switch
              id="sms-fallback-enabled"
              data-testid="toggle-sms-fallback-enabled"
              checked={smsFallbackSettings.enabled}
              onCheckedChange={(checked) => setSmsFallbackSettings({ ...smsFallbackSettings, enabled: checked })}
            />
          </div>

          {smsFallbackSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="sms-fallback-phone">Forwarding Phone Number</Label>
                <Input
                  id="sms-fallback-phone"
                  data-testid="input-sms-fallback-phone"
                  type="tel"
                  placeholder="+1 918-856-5711"
                  value={smsFallbackSettings.phone}
                  onChange={(e) => setSmsFallbackSettings({ ...smsFallbackSettings, phone: e.target.value })}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Customer messages will be forwarded here when the system is down
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms-fallback-auto-reply">Auto-Reply Message</Label>
                <Textarea
                  id="sms-fallback-auto-reply"
                  data-testid="textarea-sms-fallback-auto-reply"
                  placeholder="Thanks for your message! Our automated system is currently offline..."
                  value={smsFallbackSettings.autoReply}
                  onChange={(e) => setSmsFallbackSettings({ ...smsFallbackSettings, autoReply: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Customers receive this automatic response during system downtime
                </p>
              </div>

              <Button
                onClick={handleSmsFallbackSave}
                disabled={updateSmsFallbackMutation.isPending}
                data-testid="button-save-sms-fallback"
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateSmsFallbackMutation.isPending ? 'Saving...' : 'Save Fallback Settings'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
