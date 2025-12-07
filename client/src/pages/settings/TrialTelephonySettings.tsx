import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Phone, Plus, X, Shield, ArrowUpCircle, AlertTriangle } from 'lucide-react';

interface TrialSandboxStatus {
  isTrialTenant: boolean;
  sandboxEnabled: boolean;
  allowedNumbers: string[];
  messagesSentToday: number;
  dailyMessageCap: number;
  totalMessagesSent: number;
  totalMessageCap: number;
  canSendMessage: boolean;
  remainingDaily: number;
  remainingTotal: number;
}

const phoneSchema = z.object({
  phoneNumber: z.string().min(10, 'Please enter a valid phone number'),
});

type PhoneFormData = z.infer<typeof phoneSchema>;

export default function TrialTelephonySettings() {
  const { toast } = useToast();
  const [isAddingNumber, setIsAddingNumber] = useState(false);

  const { data, isLoading, error } = useQuery<{ success: boolean } & TrialSandboxStatus>({
    queryKey: ['/api/settings/trial-telephony'],
  });

  const form = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const addNumberMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest('/api/settings/trial-telephony/allowed-numbers', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/trial-telephony'] });
      form.reset();
      setIsAddingNumber(false);
      toast({
        title: 'Number added',
        description: 'Phone number has been added to your whitelist.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add phone number',
        variant: 'destructive',
      });
    },
  });

  const removeNumberMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest('/api/settings/trial-telephony/allowed-numbers', {
        method: 'DELETE',
        body: JSON.stringify({ phoneNumber }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/trial-telephony'] });
      toast({
        title: 'Number removed',
        description: 'Phone number has been removed from your whitelist.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove phone number',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PhoneFormData) => {
    addNumberMutation.mutate(data.phoneNumber);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return null;
  }

  if (!data.isTrialTenant) {
    return null;
  }

  const dailyPercent = (data.messagesSentToday / data.dailyMessageCap) * 100;
  const totalPercent = (data.totalMessagesSent / data.totalMessageCap) * 100;

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          <CardTitle data-testid="text-trial-sandbox-title">Trial SMS & Call Sandbox</CardTitle>
        </div>
        <CardDescription>
          During your trial, you can send messages only to whitelisted phone numbers with daily limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Today's Messages</span>
              <span className="font-medium">{data.messagesSentToday} / {data.dailyMessageCap}</span>
            </div>
            <Progress value={dailyPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {data.remainingDaily} remaining today (resets at midnight UTC)
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Trial Messages</span>
              <span className="font-medium">{data.totalMessagesSent} / {data.totalMessageCap}</span>
            </div>
            <Progress value={totalPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {data.remainingTotal} remaining in trial
            </p>
          </div>
        </div>

        {(data.remainingDaily <= 5 || data.remainingTotal <= 20) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Low message balance</AlertTitle>
            <AlertDescription>
              You're running low on trial messages. Upgrade your plan to unlock unlimited messaging.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Whitelisted Phone Numbers
            </h4>
            <Badge variant="outline" data-testid="badge-allowed-count">
              {data.allowedNumbers.length} / 5 numbers
            </Badge>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {data.allowedNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No numbers whitelisted yet. Add phone numbers to start sending messages.
              </p>
            ) : (
              data.allowedNumbers.map((number, index) => (
                <Badge 
                  key={number} 
                  variant="secondary" 
                  className="flex items-center gap-1 py-1 px-2"
                  data-testid={`badge-allowed-number-${index}`}
                >
                  {number}
                  <button
                    onClick={() => removeNumberMutation.mutate(number)}
                    disabled={removeNumberMutation.isPending}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-number-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>

          {isAddingNumber ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="(918) 555-1234"
                          data-testid="input-phone-number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={addNumberMutation.isPending}
                  data-testid="button-add-number-submit"
                >
                  {addNumberMutation.isPending ? 'Adding...' : 'Add'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsAddingNumber(false)}
                  data-testid="button-add-number-cancel"
                >
                  Cancel
                </Button>
              </form>
            </Form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingNumber(true)}
              disabled={data.allowedNumbers.length >= 5}
              data-testid="button-add-number"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Phone Number
            </Button>
          )}
        </div>

        <div className="pt-4 border-t">
          <Button className="w-full" data-testid="button-upgrade-cta">
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Upgrade to Unlock Full Customer Texting & Calling
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Remove all sandbox limits and get a dedicated business phone number
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
