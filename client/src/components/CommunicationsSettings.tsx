import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, MessageSquare, Send, Calendar, Users } from 'lucide-react';
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
