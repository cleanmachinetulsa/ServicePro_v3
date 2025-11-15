import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MessageSquare, Save, RotateCcw, Sparkles, Loader2, Bell, Send, AlertTriangle, Shield, Trash2, Plus } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import CommunicationsNav from '@/components/CommunicationsNav';

interface VoiceWebhookConfig {
  ringDuration: number;
  autoReplyMessage: string;
  offerVoicemail: boolean;
  voicemailGreeting: string;
  enableVoicemailTranscription: boolean;
  forwardingEnabled: boolean;
}

interface NotificationSettingsResponse {
  success: boolean;
  settings: {
    id: number;
    settingKey: string;
    enabled: boolean;
    config: VoiceWebhookConfig;
    updatedAt: Date;
    updatedBy: number | null;
  };
}

interface CriticalMonitoringSettings {
  id: number;
  alertChannels: { sms: boolean; push: boolean; email: boolean };
  smsRecipients: string[];
  emailRecipients: string[];
  pushRoles: string[];
  failureThreshold: number;
  cooldownMinutes: number;
  updatedAt: Date;
  updatedBy: number | null;
}

interface CriticalMonitoringResponse {
  success: boolean;
  settings: CriticalMonitoringSettings;
  monitoring: {
    integrationsCount: number;
    healthStatus: Record<string, any>;
  };
}

export default function NotificationsSettings() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [criticalHasChanges, setCriticalHasChanges] = useState(false);
  
  // Push notifications hook
  const pushNotifications = usePushNotifications();
  
  // AI Rephrasing controls
  const [showRephrase, setShowRephrase] = useState(false);
  const [rephraseSettings, setRephraseSettings] = useState({
    creativity: 50,
    tone: 'friendly',
    length: 'same',
  });

  // Fetch voice webhook settings
  const { data: voiceSettings, isLoading } = useQuery<NotificationSettingsResponse>({
    queryKey: ['/api/notifications/settings/voice_webhook'],
  });

  // Fetch critical monitoring settings
  const { data: criticalSettings, isLoading: criticalLoading } = useQuery<CriticalMonitoringResponse>({
    queryKey: ['/api/critical-monitoring/settings'],
  });

  const [formData, setFormData] = useState({
    enabled: true,
    ringDuration: 20,
    autoReplyMessage: '',
    offerVoicemail: true,
    voicemailGreeting: '',
    enableVoicemailTranscription: true,
    forwardingEnabled: true,
    useAIConversation: true, // Default to AI mode
  });

  const [criticalFormData, setCriticalFormData] = useState({
    alertChannels: { sms: true, push: true, email: false },
    smsRecipients: [] as string[],
    emailRecipients: [] as string[],
    pushRoles: ['owner', 'manager'] as string[],
    failureThreshold: 3,
    cooldownMinutes: 30,
  });

  const [newSmsRecipient, setNewSmsRecipient] = useState('');
  const [newEmailRecipient, setNewEmailRecipient] = useState('');

  // Update form data when settings are loaded
  useEffect(() => {
    if (voiceSettings?.settings) {
      setFormData({
        enabled: voiceSettings.settings.enabled,
        ringDuration: voiceSettings.settings.config.ringDuration,
        autoReplyMessage: voiceSettings.settings.config.autoReplyMessage,
        offerVoicemail: voiceSettings.settings.config.offerVoicemail,
        voicemailGreeting: voiceSettings.settings.config.voicemailGreeting,
        enableVoicemailTranscription: voiceSettings.settings.config.enableVoicemailTranscription,
        forwardingEnabled: voiceSettings.settings.config.forwardingEnabled,
        useAIConversation: voiceSettings.settings.config.useAIConversation !== false,
      });
    }
  }, [voiceSettings]);

  // Update critical form data when settings are loaded
  useEffect(() => {
    if (criticalSettings?.settings) {
      setCriticalFormData({
        alertChannels: criticalSettings.settings.alertChannels,
        smsRecipients: criticalSettings.settings.smsRecipients,
        emailRecipients: criticalSettings.settings.emailRecipients,
        pushRoles: criticalSettings.settings.pushRoles,
        failureThreshold: criticalSettings.settings.failureThreshold,
        cooldownMinutes: criticalSettings.settings.cooldownMinutes,
      });
    }
  }, [criticalSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/notifications/settings/voice_webhook', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          enabled: data.enabled,
          config: {
            ringDuration: data.ringDuration,
            autoReplyMessage: data.autoReplyMessage,
            offerVoicemail: data.offerVoicemail,
            voicemailGreeting: data.voicemailGreeting,
            enableVoicemailTranscription: data.enableVoicemailTranscription,
            forwardingEnabled: data.forwardingEnabled,
            useAIConversation: data.useAIConversation,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/settings/voice_webhook'] });
      setHasChanges(false);
      toast({
        title: 'Settings Saved',
        description: 'Your notification settings have been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update notification settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const rephraseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/rephrase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: formData.autoReplyMessage,
          creativity: rephraseSettings.creativity,
          tone: rephraseSettings.tone,
          length: rephraseSettings.length,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to rephrase');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      handleInputChange('autoReplyMessage', data.rephrased);
      toast({
        title: 'Message Rephrased',
        description: 'Your message has been rephrased by AI!',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to rephrase message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  const handleReset = () => {
    if (voiceSettings?.settings) {
      setFormData({
        enabled: voiceSettings.settings.enabled,
        ringDuration: voiceSettings.settings.config.ringDuration,
        autoReplyMessage: voiceSettings.settings.config.autoReplyMessage,
        offerVoicemail: voiceSettings.settings.config.offerVoicemail,
        voicemailGreeting: voiceSettings.settings.config.voicemailGreeting,
        enableVoicemailTranscription: voiceSettings.settings.config.enableVoicemailTranscription,
        forwardingEnabled: voiceSettings.settings.config.forwardingEnabled,
        useAIConversation: voiceSettings.settings.config.useAIConversation !== false,
      });
      setHasChanges(false);
    }
  };

  // Critical monitoring mutations and handlers
  const updateCriticalSettingsMutation = useMutation({
    mutationFn: async (data: typeof criticalFormData) => {
      const response = await fetch('/api/critical-monitoring/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to update critical monitoring settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/critical-monitoring/settings'] });
      setCriticalHasChanges(false);
      toast({
        title: 'Critical Alert Settings Saved',
        description: 'Your critical monitoring settings have been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update critical monitoring settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleCriticalInputChange = (field: string, value: any) => {
    setCriticalFormData((prev) => ({ ...prev, [field]: value }));
    setCriticalHasChanges(true);
  };

  const handleCriticalChannelChange = (channel: 'sms' | 'push' | 'email', value: boolean) => {
    setCriticalFormData((prev) => ({
      ...prev,
      alertChannels: { ...prev.alertChannels, [channel]: value },
    }));
    setCriticalHasChanges(true);
  };

  const handleCriticalRoleChange = (role: string, checked: boolean) => {
    setCriticalFormData((prev) => ({
      ...prev,
      pushRoles: checked
        ? [...prev.pushRoles, role]
        : prev.pushRoles.filter((r) => r !== role),
    }));
    setCriticalHasChanges(true);
  };

  const handleAddSmsRecipient = () => {
    const phone = newSmsRecipient.trim();
    if (phone && !criticalFormData.smsRecipients.includes(phone)) {
      setCriticalFormData((prev) => ({
        ...prev,
        smsRecipients: [...prev.smsRecipients, phone],
      }));
      setNewSmsRecipient('');
      setCriticalHasChanges(true);
    }
  };

  const handleRemoveSmsRecipient = (phone: string) => {
    setCriticalFormData((prev) => ({
      ...prev,
      smsRecipients: prev.smsRecipients.filter((p) => p !== phone),
    }));
    setCriticalHasChanges(true);
  };

  const handleAddEmailRecipient = () => {
    const email = newEmailRecipient.trim();
    if (email && !criticalFormData.emailRecipients.includes(email)) {
      setCriticalFormData((prev) => ({
        ...prev,
        emailRecipients: [...prev.emailRecipients, email],
      }));
      setNewEmailRecipient('');
      setCriticalHasChanges(true);
    }
  };

  const handleRemoveEmailRecipient = (email: string) => {
    setCriticalFormData((prev) => ({
      ...prev,
      emailRecipients: prev.emailRecipients.filter((e) => e !== email),
    }));
    setCriticalHasChanges(true);
  };

  const handleSaveCritical = () => {
    updateCriticalSettingsMutation.mutate(criticalFormData);
  };

  const handleResetCritical = () => {
    if (criticalSettings?.settings) {
      setCriticalFormData({
        alertChannels: criticalSettings.settings.alertChannels,
        smsRecipients: criticalSettings.settings.smsRecipients,
        emailRecipients: criticalSettings.settings.emailRecipients,
        pushRoles: criticalSettings.settings.pushRoles,
        failureThreshold: criticalSettings.settings.failureThreshold,
        cooldownMinutes: criticalSettings.settings.cooldownMinutes,
      });
      setCriticalHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <CommunicationsNav showBackButton backUrl="/messages" backLabel="Back to Messages" />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 dark:text-white">Notification Settings</h1>
          <p className="text-muted-foreground">
            Configure how your business communicates with customers through voice calls, SMS, and email.
          </p>
        </div>

      {/* Voice Webhook Settings */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            <CardTitle>Missed Call Auto-Response</CardTitle>
          </div>
          <CardDescription>
            Automatically text customers when you miss their call with service information and pricing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="voice-enabled">Enable Missed Call Auto-Response</Label>
              <p className="text-sm text-muted-foreground">
                Send automatic text messages when calls are missed
              </p>
            </div>
            <Switch
              id="voice-enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => handleInputChange('enabled', checked)}
              data-testid="switch-voice-enabled"
            />
          </div>

          <Separator />

          {/* AI Conversation Mode Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <Label htmlFor="use-ai-conversation" className="font-semibold">AI-Powered Scheduling (Recommended)</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.useAIConversation 
                  ? '✅ AI will check your calendar and provide real available appointment times instantly'
                  : '⚠️ Using static template - customers will NOT see real availability'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.useAIConversation
                  ? 'Customers can book appointments through automated SMS conversation'
                  : 'Switch to AI mode for automated scheduling with real calendar times'}
              </p>
            </div>
            <Switch
              id="use-ai-conversation"
              checked={formData.useAIConversation}
              onCheckedChange={(checked) => handleInputChange('useAIConversation', checked)}
              data-testid="switch-use-ai-conversation"
            />
          </div>

          <Separator />

          {/* Ring Duration */}
          <div className="space-y-2">
            <Label htmlFor="ring-duration">Ring Duration (seconds)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              How long to ring your phone before considering the call "missed"
            </p>
            <Input
              id="ring-duration"
              type="number"
              min="10"
              max="60"
              value={formData.ringDuration}
              onChange={(e) => handleInputChange('ringDuration', parseInt(e.target.value))}
              data-testid="input-ring-duration"
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 20-30 seconds (too short may miss calls, too long frustrates customers)
            </p>
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending}
                size="sm"
                className="mt-2"
              >
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Ring Duration'}
              </Button>
            )}
          </div>

          <Separator />

          {/* Auto-Reply Message */}
          <div className="space-y-2">
            <Label htmlFor="auto-reply-message">
              {formData.useAIConversation ? 'Static Template Message (Backup)' : 'Auto-Reply Text Message'}
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              {formData.useAIConversation 
                ? 'This template is NOT used when AI mode is enabled. AI generates dynamic responses with real calendar data.'
                : 'The static message customers receive when you miss their call'}
            </p>
            <Textarea
              id="auto-reply-message"
              value={formData.autoReplyMessage}
              onChange={(e) => handleInputChange('autoReplyMessage', e.target.value)}
              rows={18}
              className="font-mono text-sm"
              placeholder="Enter your auto-reply message..."
              data-testid="textarea-auto-reply-message"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Include your services, pricing, and website link. Keep it friendly and professional!
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              Character count: {formData.autoReplyMessage.length}
              {formData.autoReplyMessage.length > 1600 && (
                <span className="text-destructive ml-2">
                  (Warning: Long messages may be split into multiple texts)
                </span>
              )}
            </div>
            
            {/* AI Rephrasing Controls */}
            <div className="mt-4 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <Label className="text-sm font-semibold">AI Rephrase Assistant</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRephrase(!showRephrase)}
                  data-testid="button-toggle-rephrase"
                >
                  {showRephrase ? 'Hide' : 'Show'} Controls
                </Button>
              </div>
              
              {showRephrase && (
                <div className="space-y-4 mt-4">
                  {/* Creativity Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Creativity Level: {rephraseSettings.creativity}%</Label>
                      <span className="text-xs text-muted-foreground">
                        {rephraseSettings.creativity < 30 ? 'Minimal changes' : 
                         rephraseSettings.creativity < 70 ? 'Moderate rewrite' : 
                         'Creative rewrite'}
                      </span>
                    </div>
                    <Slider
                      value={[rephraseSettings.creativity]}
                      onValueChange={([value]) => setRephraseSettings(prev => ({ ...prev, creativity: value }))}
                      min={0}
                      max={100}
                      step={10}
                      className="w-full"
                      data-testid="slider-creativity"
                    />
                    <p className="text-xs text-muted-foreground">
                      0% = Keep your exact words, just fix grammar • 100% = Completely rewrite with fresh language
                    </p>
                  </div>

                  {/* Tone Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Tone</Label>
                    <Select
                      value={rephraseSettings.tone}
                      onValueChange={(value) => setRephraseSettings(prev => ({ ...prev, tone: value }))}
                    >
                      <SelectTrigger data-testid="select-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Length Preference */}
                  <div className="space-y-2">
                    <Label className="text-sm">Message Length</Label>
                    <Select
                      value={rephraseSettings.length}
                      onValueChange={(value) => setRephraseSettings(prev => ({ ...prev, length: value }))}
                    >
                      <SelectTrigger data-testid="select-length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shorter">Shorter (more concise)</SelectItem>
                        <SelectItem value="same">Same length</SelectItem>
                        <SelectItem value="longer">Longer (more detailed)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rephrase Button */}
                  <Button
                    onClick={() => rephraseMutation.mutate()}
                    disabled={rephraseMutation.isPending || !formData.autoReplyMessage}
                    className="w-full"
                    variant="default"
                    data-testid="button-rephrase"
                  >
                    {rephraseMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Rephrasing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Rephrase with AI
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground italic">
                    AI will rephrase your message based on your preferences. You can always undo changes manually.
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Voicemail Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="offer-voicemail">Offer Voicemail Option</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to leave a voicemail message
                </p>
              </div>
              <Switch
                id="offer-voicemail"
                checked={formData.offerVoicemail}
                onCheckedChange={(checked) => handleInputChange('offerVoicemail', checked)}
                data-testid="switch-offer-voicemail"
              />
            </div>

            {formData.offerVoicemail && (
              <>
                <div className="space-y-2 pl-4">
                  <Label htmlFor="voicemail-greeting">Voicemail Greeting</Label>
                  <Textarea
                    id="voicemail-greeting"
                    value={formData.voicemailGreeting}
                    onChange={(e) => handleInputChange('voicemailGreeting', e.target.value)}
                    rows={3}
                    placeholder="Sorry we missed your call..."
                    data-testid="textarea-voicemail-greeting"
                  />
                </div>

                <div className="flex items-center justify-between pl-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="voicemail-transcription">Enable Voicemail Transcription</Label>
                    <p className="text-sm text-muted-foreground">
                      Convert voicemails to text and receive via SMS
                    </p>
                  </div>
                  <Switch
                    id="voicemail-transcription"
                    checked={formData.enableVoicemailTranscription}
                    onCheckedChange={(checked) => handleInputChange('enableVoicemailTranscription', checked)}
                    data-testid="switch-voicemail-transcription"
                  />
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Call Forwarding */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="forwarding-enabled">Forward Calls to Your Phone</Label>
              <p className="text-sm text-muted-foreground">
                Ring your personal phone when customers call
              </p>
            </div>
            <Switch
              id="forwarding-enabled"
              checked={formData.forwardingEnabled}
              onCheckedChange={(checked) => handleInputChange('forwardingEnabled', checked)}
              data-testid="switch-forwarding-enabled"
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <CardTitle>Push Notifications</CardTitle>
            {pushNotifications.isSubscribed && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2 py-1 rounded">Active</span>
            )}
          </div>
          <CardDescription>
            Receive real-time notifications for new messages, appointments, and important updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pushNotifications.error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{pushNotifications.error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* DEBUG INFO */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs font-mono">
                <strong>DEBUG:</strong> permission={pushNotifications.permission} | 
                isSubscribed={pushNotifications.isSubscribed.toString()} | 
                isLoading={pushNotifications.isLoading.toString()} | 
                buttonDisabled={(pushNotifications.isLoading || pushNotifications.permission === 'denied').toString()}
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notification Status</Label>
                <p className="text-sm text-muted-foreground">
                  {pushNotifications.isLoading ? 'Checking...' : 
                   pushNotifications.isSubscribed ? 'You are subscribed to push notifications' : 
                   'Not subscribed'}
                </p>
              </div>
              <div className="flex gap-2">
                {!pushNotifications.isSubscribed ? (
                  <Button
                    onClick={async () => {
                      const success = await pushNotifications.subscribe();
                      if (success) {
                        toast({
                          title: 'Subscribed!',
                          description: 'You will now receive push notifications.',
                        });
                      }
                    }}
                    disabled={pushNotifications.isLoading || pushNotifications.permission === 'denied'}
                    data-testid="button-subscribe-push"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    {pushNotifications.isLoading ? 'Loading...' : 'Enable Notifications'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const success = await pushNotifications.sendTestNotification();
                        if (success) {
                          toast({
                            title: 'Test Sent',
                            description: 'Check your notifications!',
                          });
                        } else {
                          toast({
                            title: 'Failed',
                            description: 'Could not send test notification.',
                            variant: 'destructive',
                          });
                        }
                      }}
                      disabled={pushNotifications.isLoading}
                      data-testid="button-test-push"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Test
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const success = await pushNotifications.unsubscribe();
                        if (success) {
                          toast({
                            title: 'Unsubscribed',
                            description: 'You will no longer receive push notifications.',
                          });
                        }
                      }}
                      disabled={pushNotifications.isLoading}
                      data-testid="button-unsubscribe-push"
                    >
                      Disable
                    </Button>
                  </>
                )}
              </div>
            </div>

            {pushNotifications.permission === 'denied' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Notifications Blocked:</strong> You have blocked notifications for this site. 
                  To enable them, click the lock icon in your browser's address bar and allow notifications.
                </p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>What are push notifications?</strong> Push notifications allow you to receive real-time alerts 
                for new customer messages, appointments, and important updates even when the app is not open. 
                They work on desktop and mobile devices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Reminders */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <CardTitle>SMS Appointment Reminders</CardTitle>
          </div>
          <CardDescription>
            Automatic reminders are sent the day before appointments at 4:00 PM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>How it works:</strong> When customers book appointments, SMS reminders are automatically scheduled 
                for 4:00 PM the day before their appointment. The reminders include appointment details, service information, 
                and options to reschedule or cancel. Email reminders are also sent if the customer provided an email address.
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Reminder Message Preview:</p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm font-mono">
                Hi [Name], this is Clean Machine Auto Detail reminding you of your appointment tomorrow at [Time] at [Address].
                <br /><br />
                Services: [Service List]
                <br />
                Vehicle: [Vehicle Info]
                <br /><br />
                Please ensure vehicle is accessible and keys available. Remove valuables.
                <br /><br />
                To reschedule: Reply "RESCHEDULE"
                <br />
                To cancel: Reply "CANCEL"
                <br />
                Questions? Text back or call (918) 856-5304
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Status:</strong> SMS appointment reminders are active and working. All new appointments automatically 
                receive reminders. No additional configuration needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical System Alerts */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <CardTitle>Critical System Alerts</CardTitle>
          </div>
          <CardDescription>
            Configure multi-channel alerts for critical system failures (calendar, payments, SMS, email integrations)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {criticalLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading critical monitoring settings...</div>
          ) : (
            <>
              {/* Monitoring Status */}
              {criticalSettings?.monitoring && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Monitoring Status
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Currently monitoring {criticalSettings.monitoring.integrationsCount} critical integrations
                      </p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
              )}

              {/* Alert Channels */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Alert Channels</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="critical-sms">SMS Alerts</Label>
                      <p className="text-xs text-muted-foreground">Send text messages</p>
                    </div>
                    <Switch
                      id="critical-sms"
                      checked={criticalFormData.alertChannels.sms}
                      onCheckedChange={(checked) => handleCriticalChannelChange('sms', checked)}
                      data-testid="switch-critical-sms"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="critical-push">Push Notifications</Label>
                      <p className="text-xs text-muted-foreground">Browser notifications</p>
                    </div>
                    <Switch
                      id="critical-push"
                      checked={criticalFormData.alertChannels.push}
                      onCheckedChange={(checked) => handleCriticalChannelChange('push', checked)}
                      data-testid="switch-critical-push"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="critical-email">Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">Future feature</p>
                    </div>
                    <Switch
                      id="critical-email"
                      checked={criticalFormData.alertChannels.email}
                      onCheckedChange={(checked) => handleCriticalChannelChange('email', checked)}
                      disabled
                      data-testid="switch-critical-email"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* SMS Recipients */}
              {criticalFormData.alertChannels.sms && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">SMS Recipients</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Phone numbers to receive SMS alerts (include country code, e.g., +19185551234)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="+19185551234"
                      value={newSmsRecipient}
                      onChange={(e) => setNewSmsRecipient(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSmsRecipient()}
                      data-testid="input-new-sms-recipient"
                    />
                    <Button onClick={handleAddSmsRecipient} variant="outline" data-testid="button-add-sms">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {criticalFormData.smsRecipients.length > 0 && (
                    <div className="space-y-2">
                      {criticalFormData.smsRecipients.map((phone) => (
                        <div key={phone} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="text-sm font-mono">{phone}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSmsRecipient(phone)}
                            data-testid={`button-remove-sms-${phone}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Email Recipients */}
              {criticalFormData.alertChannels.email && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Email Recipients</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Email addresses to receive alert emails
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newEmailRecipient}
                      onChange={(e) => setNewEmailRecipient(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddEmailRecipient()}
                      data-testid="input-new-email-recipient"
                    />
                    <Button onClick={handleAddEmailRecipient} variant="outline" data-testid="button-add-email">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {criticalFormData.emailRecipients.length > 0 && (
                    <div className="space-y-2">
                      {criticalFormData.emailRecipients.map((email) => (
                        <div key={email} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="text-sm">{email}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEmailRecipient(email)}
                            data-testid={`button-remove-email-${email}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Push Notification Roles */}
              {criticalFormData.alertChannels.push && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Push Notification Roles</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      User roles that will receive browser push notifications
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="role-owner"
                        checked={criticalFormData.pushRoles.includes('owner')}
                        onChange={(e) => handleCriticalRoleChange('owner', e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-role-owner"
                      />
                      <Label htmlFor="role-owner">Owner</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="role-manager"
                        checked={criticalFormData.pushRoles.includes('manager')}
                        onChange={(e) => handleCriticalRoleChange('manager', e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-role-manager"
                      />
                      <Label htmlFor="role-manager">Manager</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="role-employee"
                        checked={criticalFormData.pushRoles.includes('employee')}
                        onChange={(e) => handleCriticalRoleChange('employee', e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-role-employee"
                      />
                      <Label htmlFor="role-employee">Employee</Label>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Alert Thresholds */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Alert Thresholds</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="failure-threshold">Failure Threshold</Label>
                    <Input
                      id="failure-threshold"
                      type="number"
                      min="1"
                      max="10"
                      value={criticalFormData.failureThreshold}
                      onChange={(e) => handleCriticalInputChange('failureThreshold', parseInt(e.target.value))}
                      data-testid="input-failure-threshold"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of consecutive failures before sending alert
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cooldown-minutes">Cooldown (minutes)</Label>
                    <Input
                      id="cooldown-minutes"
                      type="number"
                      min="5"
                      max="1440"
                      value={criticalFormData.cooldownMinutes}
                      onChange={(e) => handleCriticalInputChange('cooldownMinutes', parseInt(e.target.value))}
                      data-testid="input-cooldown-minutes"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum time between repeat alerts
                    </p>
                  </div>
                </div>
              </div>

              {/* Save/Reset Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveCritical}
                  disabled={!criticalHasChanges || updateCriticalSettingsMutation.isPending}
                  data-testid="button-save-critical"
                >
                  {updateCriticalSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Critical Alert Settings
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetCritical}
                  disabled={!criticalHasChanges}
                  data-testid="button-reset-critical"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      </div>
    </div>
  );
}
