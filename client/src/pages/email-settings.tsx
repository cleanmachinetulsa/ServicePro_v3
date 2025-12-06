import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Send, CheckCircle, AlertCircle, Settings, Eye, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const emailSettingsSchema = z.object({
  fromName: z.string().min(1, 'From name is required').max(255),
  replyToEmail: z.string().email('Invalid email address').max(255).optional().or(z.literal('')),
});

type EmailSettingsForm = z.infer<typeof emailSettingsSchema>;

interface EmailSettings {
  fromName: string;
  replyToEmail: string | null;
  status: 'not_configured' | 'needs_verification' | 'healthy' | 'error';
  lastVerifiedAt: string | null;
  lastError: string | null;
  globalFromEmail: string | null;
  isConfigured: boolean;
}

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const { data: settingsData, isLoading } = useQuery<{ success: boolean; data: EmailSettings }>({
    queryKey: ['/api/settings/email'],
  });

  const settings = settingsData?.data;

  const form = useForm<EmailSettingsForm>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      fromName: '',
      replyToEmail: '',
    },
    values: settings ? {
      fromName: settings.fromName || '',
      replyToEmail: settings.replyToEmail || '',
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EmailSettingsForm) => {
      const response = await apiRequest('PUT', '/api/settings/email', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Your email settings have been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/email'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save settings',
        description: error.message || 'An error occurred while saving your settings.',
        variant: 'destructive',
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (to: string) => {
      const response = await apiRequest('POST', '/api/settings/email/test', { to });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test email sent',
        description: `Check your inbox at ${testEmailAddress}`,
      });
      setTestDialogOpen(false);
      setTestEmailAddress('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send test email',
        description: error.message || 'An error occurred while sending the test email.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EmailSettingsForm) => {
    updateMutation.mutate(data);
  };

  const handleSendTestEmail = () => {
    if (testEmailAddress) {
      testEmailMutation.mutate(testEmailAddress);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Healthy</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'needs_verification':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Needs Verification</Badge>;
      default:
        return <Badge variant="secondary">Not Configured</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-email-settings-title">Email Settings</h1>
          <p className="text-muted-foreground text-sm">Configure how your business emails appear to customers</p>
        </div>
      </div>

      {!settings?.isConfigured && (
        <Card className="mb-6 border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-200">Email service not configured</p>
                <p className="text-sm text-amber-200/70">
                  The platform email service is not yet configured. Please contact support to enable email notifications.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Email Profile
            </CardTitle>
            <CardDescription>
              Configure your business email identity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Your Business Name" 
                          {...field} 
                          data-testid="input-from-name"
                        />
                      </FormControl>
                      <FormDescription>
                        This name will appear as the sender in customer emails
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="replyToEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reply-To Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="support@yourbusiness.com" 
                          {...field} 
                          value={field.value || ''}
                          data-testid="input-reply-to-email"
                        />
                      </FormControl>
                      <FormDescription>
                        Customer replies will be sent to this address
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    data-testid="button-save-email-settings"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              </form>
            </Form>

            <Separator className="my-6" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(settings?.status || 'not_configured')}
              </div>

              {settings?.globalFromEmail && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sending From</span>
                  <span className="text-sm font-mono">{settings.globalFromEmail}</span>
                </div>
              )}

              {settings?.lastVerifiedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Verified</span>
                  <span className="text-sm">{new Date(settings.lastVerifiedAt).toLocaleDateString()}</span>
                </div>
              )}

              {settings?.lastError && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive">{settings.lastError}</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-send-test-email">
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Email
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Test Email</DialogTitle>
                    <DialogDescription>
                      Send a test email to verify your settings are working correctly.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="test-email">Email Address</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="your@email.com"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      className="mt-2"
                      data-testid="input-test-email-address"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setTestDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSendTestEmail}
                      disabled={!testEmailAddress || testEmailMutation.isPending}
                      data-testid="button-confirm-send-test"
                    >
                      {testEmailMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Test'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Email Preview
            </CardTitle>
            <CardDescription>
              How your emails will appear to customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {(form.watch('fromName') || 'YB').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {form.watch('fromName') || 'Your Business Name'}
                    </span>
                    {settings?.isConfigured && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {settings?.globalFromEmail || 'notify@servicepro.app'}
                  </p>
                  {form.watch('replyToEmail') && (
                    <p className="text-xs text-muted-foreground">
                      Reply-to: {form.watch('replyToEmail')}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-medium">Your appointment is confirmed! 🎉</p>
                <p className="text-sm text-muted-foreground">
                  Hi John, thank you for choosing {form.watch('fromName') || 'Your Business'}. 
                  Your appointment has been confirmed for...
                </p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  — Email from {form.watch('fromName') || 'Your Business'} —
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> All emails are sent from the ServicePro platform domain. 
                Your business name and reply-to address are displayed to customers, 
                ensuring responses come directly to you.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
