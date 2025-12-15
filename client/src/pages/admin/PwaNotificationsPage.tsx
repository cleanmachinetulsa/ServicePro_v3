import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, Send, Settings, Clock, Mail, MessageSquare, Smartphone, Check, X, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { PwaNotificationSettings, NotificationEventLog } from '@shared/schema';

interface SettingsResponse {
  success: boolean;
  settings: PwaNotificationSettings | null;
}

interface LogsResponse {
  success: boolean;
  logs: NotificationEventLog[];
  pagination: { limit: number; offset: number; count: number };
}

interface StatsResponse {
  success: boolean;
  stats: {
    total: number;
    last24h: number;
    last7d: number;
    byChannel: { push: number; sms: number; email: number };
    byStatus: { sent: number; failed: number; suppressed: number; queued: number };
    byType: Record<string, number>;
  };
}

export default function PwaNotificationsPage() {
  const { toast } = useToast();
  const push = usePushNotifications();
  const [hasChanges, setHasChanges] = useState(false);

  const [formData, setFormData] = useState({
    notifyBookingFailed: true,
    notifyNeedsHuman: true,
    notifyNewLead: true,
    notifyBookingConfirmed: false,
    notifyAfterHoursReply: true,
    notifyDailyDigest: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    quietHoursOverrideNeedsHuman: true,
    digestMode: 'off',
    digestIntervalHours: 4,
    digestFixedTimes: [] as string[],
    channelSms: true,
    channelEmail: false,
    channelPush: true,
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery<SettingsResponse>({
    queryKey: ['/api/admin/pwa-notifications/settings'],
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<LogsResponse>({
    queryKey: ['/api/admin/pwa-notifications/logs'],
  });

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ['/api/admin/pwa-notifications/stats'],
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setFormData({
        notifyBookingFailed: s.notifyBookingFailed ?? true,
        notifyNeedsHuman: s.notifyNeedsHuman ?? true,
        notifyNewLead: s.notifyNewLead ?? true,
        notifyBookingConfirmed: s.notifyBookingConfirmed ?? false,
        notifyAfterHoursReply: s.notifyAfterHoursReply ?? true,
        notifyDailyDigest: s.notifyDailyDigest ?? false,
        quietHoursEnabled: s.quietHoursEnabled ?? false,
        quietHoursStart: s.quietHoursStart ?? '22:00',
        quietHoursEnd: s.quietHoursEnd ?? '07:00',
        quietHoursOverrideNeedsHuman: s.quietHoursOverrideNeedsHuman ?? true,
        digestMode: s.digestMode ?? 'off',
        digestIntervalHours: s.digestIntervalHours ?? 4,
        digestFixedTimes: s.digestFixedTimes ?? [],
        channelSms: s.channelSms ?? true,
        channelEmail: s.channelEmail ?? false,
        channelPush: s.channelPush ?? true,
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/admin/pwa-notifications/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pwa-notifications/settings'] });
      setHasChanges(false);
      toast({ title: 'Settings Saved', description: 'Your notification settings have been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/pwa-notifications/test', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pwa-notifications/logs'] });
      toast({ title: 'Test Sent', description: data.message || 'Check your device for the notification.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send test notification.', variant: 'destructive' });
    },
  });

  const updateField = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge variant="default" className="bg-green-600" data-testid="badge-status-sent">Sent</Badge>;
      case 'failed': return <Badge variant="destructive" data-testid="badge-status-failed">Failed</Badge>;
      case 'suppressed': return <Badge variant="secondary" data-testid="badge-status-suppressed">Suppressed</Badge>;
      case 'queued': return <Badge variant="outline" data-testid="badge-status-queued">Queued</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'push': return <Smartphone className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Push Notification Settings</h1>
          <p className="text-muted-foreground">Configure how and when you receive notifications</p>
        </div>
        <Button onClick={() => saveMutation.mutate(formData)} disabled={!hasChanges || saveMutation.isPending} data-testid="button-save-settings">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
      </div>

      <Card data-testid="card-push-status">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Push Notification Status</CardTitle>
          <CardDescription>Current status of push notifications on this device</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Browser Permission:</span>
              {push.permission === 'granted' ? (
                <Badge className="bg-green-600" data-testid="badge-permission-granted"><Check className="h-3 w-3 mr-1" /> Granted</Badge>
              ) : push.permission === 'denied' ? (
                <Badge variant="destructive" data-testid="badge-permission-denied"><X className="h-3 w-3 mr-1" /> Denied</Badge>
              ) : (
                <Badge variant="secondary" data-testid="badge-permission-default">Not Set</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>Subscription:</span>
              {push.isSubscribed ? (
                <Badge className="bg-green-600" data-testid="badge-subscribed"><Check className="h-3 w-3 mr-1" /> Active</Badge>
              ) : (
                <Badge variant="secondary" data-testid="badge-not-subscribed">Inactive</Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {!push.isSubscribed && push.permission !== 'denied' && (
              <Button onClick={() => push.subscribe()} disabled={push.isLoading} variant="outline" data-testid="button-subscribe">
                {push.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                Enable Notifications
              </Button>
            )}
            {push.isSubscribed && (
              <>
                <Button onClick={() => push.unsubscribe()} disabled={push.isLoading} variant="outline" data-testid="button-unsubscribe">
                  Disable Notifications
                </Button>
                <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-send-test">
                  {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Test
                </Button>
              </>
            )}
          </div>
          {push.error && <p className="text-sm text-destructive">{push.error}</p>}
        </CardContent>
      </Card>

      <Card data-testid="card-notification-types">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Notification Types</CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notifyBookingFailed' as const, label: 'Booking Failed', desc: 'When a booking attempt fails' },
            { key: 'notifyNeedsHuman' as const, label: 'Needs Human Attention', desc: 'When AI escalates to a human' },
            { key: 'notifyNewLead' as const, label: 'New Lead', desc: 'When a new customer reaches out' },
            { key: 'notifyBookingConfirmed' as const, label: 'Booking Confirmed', desc: 'When a customer confirms a booking' },
            { key: 'notifyAfterHoursReply' as const, label: 'After Hours Reply', desc: 'Customer messages outside business hours' },
            { key: 'notifyDailyDigest' as const, label: 'Daily Digest', desc: 'Summary of daily activity' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={formData[item.key]} onCheckedChange={v => updateField(item.key, v)} data-testid={`switch-${item.key}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="card-quiet-hours">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Quiet Hours</CardTitle>
          <CardDescription>Pause non-critical notifications during specified hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Quiet Hours</Label>
            <Switch checked={formData.quietHoursEnabled} onCheckedChange={v => updateField('quietHoursEnabled', v)} data-testid="switch-quiet-hours" />
          </div>
          
          {formData.quietHoursEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={formData.quietHoursStart} onChange={e => updateField('quietHoursStart', e.target.value)} data-testid="input-quiet-start" />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={formData.quietHoursEnd} onChange={e => updateField('quietHoursEnd', e.target.value)} data-testid="input-quiet-end" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Override for "Needs Human"</Label>
                  <p className="text-sm text-muted-foreground">Always notify for escalations, even during quiet hours</p>
                </div>
                <Switch checked={formData.quietHoursOverrideNeedsHuman} onCheckedChange={v => updateField('quietHoursOverrideNeedsHuman', v)} data-testid="switch-quiet-override" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-digest-mode">
        <CardHeader>
          <CardTitle>Digest Mode</CardTitle>
          <CardDescription>Batch notifications into periodic summaries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Digest Mode</Label>
            <Select value={formData.digestMode} onValueChange={v => updateField('digestMode', v)} data-testid="select-digest-mode">
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="hourly">Every N Hours</SelectItem>
                <SelectItem value="fixed_times">Fixed Times</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.digestMode === 'hourly' && (
            <div className="flex items-center gap-4">
              <Label>Send every</Label>
              <Input type="number" min={1} max={24} value={formData.digestIntervalHours} onChange={e => updateField('digestIntervalHours', parseInt(e.target.value) || 4)} className="w-20" data-testid="input-digest-interval" />
              <span>hours</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-channels">
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Choose how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'channelPush' as const, label: 'Push Notifications', icon: <Smartphone className="h-4 w-4" /> },
            { key: 'channelSms' as const, label: 'SMS', icon: <MessageSquare className="h-4 w-4" /> },
            { key: 'channelEmail' as const, label: 'Email', icon: <Mail className="h-4 w-4" /> },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">{item.icon}<Label>{item.label}</Label></div>
              <Switch checked={formData[item.key]} onCheckedChange={v => updateField(item.key, v)} data-testid={`switch-${item.key}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="card-recent-logs">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Notifications</CardTitle>
            <CardDescription>Log of recent notification events</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchLogs()} data-testid="button-refresh-logs">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !logsData?.logs?.length ? (
            <p className="text-center text-muted-foreground py-8">No notification logs yet</p>
          ) : (
            <div className="space-y-2">
              {logsData.logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    {getChannelIcon(log.channel)}
                    <div>
                      <p className="font-medium text-sm">{log.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(log.createdAt!).toLocaleString()}</p>
                    </div>
                  </div>
                  {getStatusBadge(log.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {statsData?.stats && (
        <Card data-testid="card-stats">
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold">{statsData.stats.total}</p><p className="text-sm text-muted-foreground">Total</p></div>
              <div><p className="text-2xl font-bold">{statsData.stats.last24h}</p><p className="text-sm text-muted-foreground">Last 24h</p></div>
              <div><p className="text-2xl font-bold text-green-600">{statsData.stats.byStatus.sent}</p><p className="text-sm text-muted-foreground">Sent</p></div>
              <div><p className="text-2xl font-bold text-red-600">{statsData.stats.byStatus.failed}</p><p className="text-sm text-muted-foreground">Failed</p></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
