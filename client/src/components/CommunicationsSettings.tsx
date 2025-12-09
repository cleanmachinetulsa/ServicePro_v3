import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Mail, MessageSquare, Send, Calendar, Users, Gift, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format as formatDate } from 'date-fns';

const emailCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  targetAudience: z.enum(['all', 'vip', 'loyalty']),
  scheduledDate: z.string().optional()
});

const smsCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  message: z.string().min(1, 'Message is required').max(300, 'Message too long (300 chars max)'),
  targetAudience: z.enum(['all', 'vip', 'loyalty']),
  scheduledDate: z.string().optional()
});

type EmailCampaignData = z.infer<typeof emailCampaignSchema>;
type SMSCampaignData = z.infer<typeof smsCampaignSchema>;

export function CommunicationsSettings() {
  const [activeTab, setActiveTab] = useState('email');
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Campaign Management</h2>
        <p className="text-muted-foreground">Create and manage email and SMS campaigns</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="email" data-testid="tab-email-campaigns">
            <Mail className="h-4 w-4 mr-2" />
            Email Campaigns
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-sms-campaigns">
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <EmailCampaigns />
        </TabsContent>

        <TabsContent value="sms">
          <SMSCampaigns />
        </TabsContent>
      </Tabs>

      {/* Special Campaigns Section */}
      <SpecialCampaignsSection />
    </div>
  );
}

function SpecialCampaignsSection() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="text-left">
                  <CardTitle className="text-xl">Special Campaigns</CardTitle>
                  <CardDescription>Advanced loyalty bonus campaigns and promotions</CardDescription>
                </div>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <WelcomeBackCampaign />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Campaign Settings Editor - form for editing VIP/Regular bonus points and SMS templates
interface CampaignSettingsEditorProps {
  config: any;
  isLoading: boolean;
  onUpdate: (data: any) => void;
  isPending: boolean;
}

function CampaignSettingsEditor({ config, isLoading, onUpdate, isPending }: CampaignSettingsEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [vipPoints, setVipPoints] = useState<number>(500);
  const [regularPoints, setRegularPoints] = useState<number>(100);
  const [vipTemplate, setVipTemplate] = useState<string>('');
  const [regularTemplate, setRegularTemplate] = useState<string>('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const { toast } = useToast();

  // Sync form state when config loads (only on first load)
  useEffect(() => {
    if (config && !hasLoaded) {
      setVipPoints(config.vipPointsBonus || 500);
      setRegularPoints(config.regularPointsBonus || 100);
      setVipTemplate(config.smsTemplateVip || '');
      setRegularTemplate(config.smsTemplateRegular || '');
      setHasLoaded(true);
    }
  }, [config, hasLoaded]);

  const handleSave = () => {
    if (vipTemplate.length < 10 || regularTemplate.length < 10) {
      toast({ title: 'SMS templates must be at least 10 characters', variant: 'destructive' });
      return;
    }
    onUpdate({
      vipPointsBonus: vipPoints,
      regularPointsBonus: regularPoints,
      smsTemplateVip: vipTemplate,
      smsTemplateRegular: regularTemplate,
    });
    setIsOpen(false);
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-sm font-medium">Campaign Settings</CardTitle>
                <CardDescription className="text-xs">Customize points, SMS templates, and more</CardDescription>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading settings...</div>
            ) : (
              <>
                {/* Points Configuration */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vip-points">VIP Bonus Points</Label>
                    <Input
                      id="vip-points"
                      type="number"
                      min={0}
                      max={10000}
                      value={vipPoints}
                      onChange={(e) => setVipPoints(parseInt(e.target.value) || 0)}
                      data-testid="input-vip-points"
                    />
                    <p className="text-xs text-muted-foreground">Points awarded to VIP customers</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regular-points">Regular Bonus Points</Label>
                    <Input
                      id="regular-points"
                      type="number"
                      min={0}
                      max={10000}
                      value={regularPoints}
                      onChange={(e) => setRegularPoints(parseInt(e.target.value) || 0)}
                      data-testid="input-regular-points"
                    />
                    <p className="text-xs text-muted-foreground">Points awarded to regular customers</p>
                  </div>
                </div>

                {/* SMS Templates */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vip-template">VIP SMS Template</Label>
                    <Textarea
                      id="vip-template"
                      rows={5}
                      value={vipTemplate}
                      onChange={(e) => setVipTemplate(e.target.value)}
                      placeholder="Enter VIP customer SMS message..."
                      data-testid="textarea-vip-template"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: {'{{customerName}}'}, {'{{businessName}}'}, {'{{bookingLink}}'}, {'{{rewardsLink}}'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regular-template">Regular SMS Template</Label>
                    <Textarea
                      id="regular-template"
                      rows={5}
                      value={regularTemplate}
                      onChange={(e) => setRegularTemplate(e.target.value)}
                      placeholder="Enter regular customer SMS message..."
                      data-testid="textarea-regular-template"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: {'{{customerName}}'}, {'{{businessName}}'}, {'{{bookingLink}}'}, {'{{rewardsLink}}'}
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSave} 
                    disabled={isPending}
                    data-testid="button-save-campaign-settings"
                  >
                    {isPending ? 'Saving...' : 'Save Campaign Settings'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function WelcomeBackCampaign() {
  const { toast } = useToast();
  const [previewMode, setPreviewMode] = useState<'vip' | 'regular' | null>(null);
  const [sending, setSending] = useState(false);
  const [includeNonLoyalty, setIncludeNonLoyalty] = useState(false);

  // Fetch campaign config
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['/api/admin/campaigns/welcome-back'],
  });

  const config = configData?.config;

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', '/api/admin/campaigns/welcome-back', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/campaigns/welcome-back'] });
      toast({ title: 'Campaign settings saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
    },
  });

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async ({ audience, previewOnly, includeNonLoyalty }: { audience: 'vip' | 'regular'; previewOnly: boolean; includeNonLoyalty: boolean }) => {
      const response = await apiRequest('POST', '/api/admin/campaigns/welcome-back/send', { audience, previewOnly, includeNonLoyalty });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.previewOnly) {
        const result = data.result;
        toast({
          title: `Preview: ${variables.audience.toUpperCase()} Campaign`,
          description: `Would send to ${result.total} customers. Sample message: ${result.sampleMessage?.slice(0, 100)}...`,
        });
        setPreviewMode(null);
      } else {
        toast({
          title: 'Campaign sent successfully',
          description: `Sent to ${data.result.success} customers. ${data.result.failed} failed.`,
        });
      }
      setSending(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error sending campaign', description: error.message, variant: 'destructive' });
      setSending(false);
      setPreviewMode(null);
    },
  });

  const handlePreview = (audience: 'vip' | 'regular') => {
    setPreviewMode(audience);
    sendCampaignMutation.mutate({ audience, previewOnly: true, includeNonLoyalty });
  };

  const handleSend = (audience: 'vip' | 'regular') => {
    const audienceDesc = includeNonLoyalty ? 'ALL customers' : 'loyalty opt-in customers only';
    if (!confirm(`Are you sure you want to send the ${audience.toUpperCase()} campaign to ${audienceDesc}? This will award points and send messages.`)) {
      return;
    }
    setSending(true);
    sendCampaignMutation.mutate({ audience, previewOnly: false, includeNonLoyalty });
  };

  if (configLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading campaign settings...</div>;
  }

  return (
    <div className="space-y-6" id="welcome-back-campaign">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Gift className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div>
          <h3 className="font-semibold text-lg">Welcome Back Campaign</h3>
          <p className="text-sm text-muted-foreground">
            Reward your VIP and regular customers with bonus loyalty points to bring them back!
          </p>
          <Badge className="mt-2" variant="secondary">
            <Sparkles className="h-3 w-3 mr-1" />
            New System Launch
          </Badge>
        </div>
      </div>

      {/* Audience Filter Option */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="include-non-loyalty"
              checked={includeNonLoyalty}
              onCheckedChange={(checked) => setIncludeNonLoyalty(checked === true)}
              data-testid="checkbox-include-non-loyalty"
            />
            <div className="space-y-1">
              <Label
                htmlFor="include-non-loyalty"
                className="text-sm font-medium cursor-pointer"
              >
                Send to ALL customers (not just loyalty program members)
              </Label>
              <p className="text-xs text-muted-foreground">
                When checked, this campaign will be sent to all VIP or Regular customers, including those who haven't opted into the loyalty program yet. 
                Bonus points will still be awarded to everyone who receives the campaign.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Preview */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* VIP Campaign */}
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              VIP Campaign
            </CardTitle>
            <CardDescription>{config?.vipPointsBonus || 500} Bonus Points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">SMS Template Preview</Label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                {configLoading ? (
                  <span className="text-muted-foreground italic">Loading template...</span>
                ) : config?.smsTemplateVip ? (
                  config.smsTemplateVip.slice(0, 150) + '...'
                ) : (
                  <span className="text-muted-foreground italic">No template configured</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePreview('vip')}
                disabled={previewMode === 'vip' || configLoading}
                data-testid="button-preview-vip"
              >
                {previewMode === 'vip' ? 'Previewing...' : 'Preview'}
              </Button>
              <Button
                size="sm"
                onClick={() => handleSend('vip')}
                disabled={sending || configLoading}
                data-testid="button-send-vip"
              >
                {sending ? 'Sending...' : 'Send VIP Campaign'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Regular Campaign */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Regular Campaign
            </CardTitle>
            <CardDescription>{config?.regularPointsBonus || 100} Bonus Points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">SMS Template Preview</Label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                {configLoading ? (
                  <span className="text-muted-foreground italic">Loading template...</span>
                ) : config?.smsTemplateRegular ? (
                  config.smsTemplateRegular.slice(0, 150) + '...'
                ) : (
                  <span className="text-muted-foreground italic">No template configured</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePreview('regular')}
                disabled={previewMode === 'regular' || configLoading}
                data-testid="button-preview-regular"
              >
                {previewMode === 'regular' ? 'Previewing...' : 'Preview'}
              </Button>
              <Button
                size="sm"
                onClick={() => handleSend('regular')}
                disabled={sending || configLoading}
                data-testid="button-send-regular"
              >
                {sending ? 'Sending...' : 'Send Regular Campaign'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Settings Editor */}
      <CampaignSettingsEditor config={config} isLoading={configLoading} onUpdate={updateConfigMutation.mutate} isPending={updateConfigMutation.isPending} />
    </div>
  );
}

function EmailCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['/api/campaigns/email']
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmailCampaignData) => {
      return apiRequest('POST', '/api/campaigns/email', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/email'] });
      setIsCreateOpen(false);
      toast({ title: 'Campaign created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating campaign', description: error.message, variant: 'destructive' });
    }
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/campaigns/email/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/email'] });
      toast({ title: 'Campaign is being sent' });
    }
  });

  const form = useForm<EmailCampaignData>({
    resolver: zodResolver(emailCampaignSchema),
    defaultValues: {
      name: '',
      subject: '',
      content: '',
      targetAudience: 'all'
    }
  });

  const onSubmit = (data: EmailCampaignData) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading campaigns...</div>;
  }

  const campaignsList = campaigns?.campaigns || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {campaignsList.length} campaign(s)
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-email-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Create Email Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Email Campaign</DialogTitle>
              <DialogDescription>
                Send personalized emails to your customers
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Monthly Newsletter" data-testid="input-campaign-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Special Offer Inside!" data-testid="input-email-subject" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Content</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={6} placeholder="Hi {name}, ..." data-testid="textarea-email-content" />
                      </FormControl>
                      <FormDescription>
                        Use {'{name}'} to personalize with customer name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-target-audience">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          <SelectItem value="vip">VIP Customers Only</SelectItem>
                          <SelectItem value="loyalty">Loyalty Members</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="datetime-local"
                          data-testid="input-scheduled-date"
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank to send immediately
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-campaign">
                    {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {campaignsList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No email campaigns yet</p>
            <p className="text-sm text-muted-foreground">Create your first campaign to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaignsList.map((campaign: any) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <CardDescription>{campaign.subject}</CardDescription>
                  </div>
                  <CampaignStatusBadge status={campaign.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Recipients</div>
                    <div className="font-medium flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign.recipient_count || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sent</div>
                    <div className="font-medium flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      {campaign.sent_count || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target</div>
                    <div className="font-medium capitalize">{campaign.target_audience}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {campaign.created_at ? formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true }) : 'N/A'}
                    </div>
                  </div>
                </div>
                {campaign.status === 'draft' && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => sendNowMutation.mutate(campaign.id)}
                      disabled={sendNowMutation.isPending}
                      data-testid={`button-send-campaign-${campaign.id}`}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Send Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SMSCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['/api/campaigns/sms']
  });

  const createMutation = useMutation({
    mutationFn: async (data: SMSCampaignData) => {
      return apiRequest('POST', '/api/campaigns/sms', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/sms'] });
      setIsCreateOpen(false);
      toast({ title: 'SMS campaign created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating campaign', description: error.message, variant: 'destructive' });
    }
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/campaigns/sms/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/sms'] });
      toast({ title: 'SMS campaign is being sent' });
    }
  });

  const form = useForm<SMSCampaignData>({
    resolver: zodResolver(smsCampaignSchema),
    defaultValues: {
      name: '',
      message: '',
      targetAudience: 'all'
    }
  });

  const onSubmit = (data: SMSCampaignData) => {
    createMutation.mutate(data);
  };

  const charCount = form.watch('message')?.length || 0;

  if (isLoading) {
    return <div className="text-center py-8">Loading SMS campaigns...</div>;
  }

  const campaignsList = campaigns?.campaigns || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {campaignsList.length} SMS campaign(s)
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sms-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Create SMS Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create SMS Campaign</DialogTitle>
              <DialogDescription>
                Send bulk SMS with TCPA quiet hours protection
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Weekend Special" data-testid="input-sms-campaign-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMS Message</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} placeholder="Hi {name}, ..." data-testid="textarea-sms-message" />
                      </FormControl>
                      <FormDescription>
                        {charCount}/300 characters • Use {'{name}'} to personalize
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-sms-target-audience">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Customers (SMS Consent)</SelectItem>
                          <SelectItem value="vip">VIP Customers Only</SelectItem>
                          <SelectItem value="loyalty">Loyalty Members</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-sms-campaign">
                    {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {campaignsList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No SMS campaigns yet</p>
            <p className="text-sm text-muted-foreground">Create your first campaign to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaignsList.map((campaign: any) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <CampaignStatusBadge status={campaign.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Recipients</div>
                    <div className="font-medium">{campaign.recipient_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sent</div>
                    <div className="font-medium">{campaign.sent_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target</div>
                    <div className="font-medium capitalize">{campaign.target_audience}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {campaign.created_at ? formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true }) : 'N/A'}
                    </div>
                  </div>
                </div>
                {campaign.status === 'draft' && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => sendNowMutation.mutate(campaign.id)}
                      disabled={sendNowMutation.isPending}
                      data-testid={`button-send-sms-campaign-${campaign.id}`}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Send Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'outline' },
    scheduled: { label: 'Scheduled', variant: 'secondary' },
    sending: { label: 'Sending', variant: 'default' },
    sent: { label: 'Sent', variant: 'default' },
    failed: { label: 'Failed', variant: 'destructive' }
  };

  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
