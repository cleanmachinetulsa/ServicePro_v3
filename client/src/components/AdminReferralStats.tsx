import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Users, 
  Gift, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Award,
  Target,
  Settings as SettingsIcon,
  Save
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

// Referral Program Config Types
interface ReferralProgramConfig {
  id: number;
  enabled: boolean;
  referrerRewardType: string;
  referrerRewardAmount: string;
  referrerRewardExpiry: number | null;
  refereeRewardType: string;
  refereeRewardAmount: string;
  refereeRewardExpiry: number | null;
  allowStackableRewards: boolean;
}

// Form schema for config updates
const referralConfigSchema = z.object({
  enabled: z.boolean(),
  referrerRewardType: z.string(),
  referrerRewardAmount: z.string(),
  referrerRewardExpiry: z.coerce.number().nullable(),
  refereeRewardType: z.string(),
  refereeRewardAmount: z.string(),
  refereeRewardExpiry: z.coerce.number().nullable(),
  allowStackableRewards: z.boolean(),
});

type ReferralConfigForm = z.infer<typeof referralConfigSchema>;

// Reward type helper - maps type to display info
const REWARD_TYPES = [
  { value: 'loyalty_points', label: 'Loyalty Points', amountLabel: 'Points', placeholder: '500' },
  { value: 'fixed_discount', label: 'Fixed Dollar Discount', amountLabel: 'Amount ($)', placeholder: '10.00' },
  { value: 'percent_discount', label: 'Percentage Discount', amountLabel: 'Percentage', placeholder: '15' },
  { value: 'service_credit', label: 'Service Credit', amountLabel: 'Amount ($)', placeholder: '25.00' },
  { value: 'free_addon', label: 'Free Add-on', amountLabel: 'Add-on Name', placeholder: 'Tire Shine' },
  { value: 'tier_upgrade', label: 'Tier Upgrade', amountLabel: 'Tier Name', placeholder: 'Gold' },
  { value: 'priority_booking', label: 'Priority Booking', amountLabel: 'Days Valid', placeholder: '90' },
  { value: 'milestone_reward', label: 'Milestone Reward', amountLabel: 'Threshold', placeholder: '5' },
  { value: 'gift_card', label: 'Gift Card', amountLabel: 'Amount ($)', placeholder: '50.00' },
];

// Configuration Panel Component
function ReferralConfigurationPanel() {
  const { toast } = useToast();

  // Fetch current config
  const { data: configData, isLoading: configLoading } = useQuery<{ success: boolean; config: ReferralProgramConfig }>({
    queryKey: ['/api/admin/referral-config'],
  });

  const config = configData?.config;

  // Initialize form
  const form = useForm<ReferralConfigForm>({
    resolver: zodResolver(referralConfigSchema),
    defaultValues: {
      enabled: config?.enabled ?? true,
      referrerRewardType: config?.referrerRewardType ?? 'loyalty_points',
      referrerRewardAmount: config?.referrerRewardAmount ?? '500',
      referrerRewardExpiry: config?.referrerRewardExpiry ?? null,
      refereeRewardType: config?.refereeRewardType ?? 'loyalty_points',
      refereeRewardAmount: config?.refereeRewardAmount ?? '250',
      refereeRewardExpiry: config?.refereeRewardExpiry ?? null,
      allowStackableRewards: config?.allowStackableRewards ?? false,
    },
  });

  // Reset form when config loads
  React.useEffect(() => {
    if (config) {
      form.reset({
        enabled: config.enabled,
        referrerRewardType: config.referrerRewardType,
        referrerRewardAmount: config.referrerRewardAmount,
        referrerRewardExpiry: config.referrerRewardExpiry,
        refereeRewardType: config.refereeRewardType,
        refereeRewardAmount: config.refereeRewardAmount,
        refereeRewardExpiry: config.refereeRewardExpiry,
        allowStackableRewards: config.allowStackableRewards,
      });
    }
  }, [config, form]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: ReferralConfigForm) => {
      return await apiRequest('/api/admin/referral-config', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: 'Referral configuration updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/referral-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/referral-stats'] });
      form.reset(form.getValues()); // Mark as pristine
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update configuration', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (data: ReferralConfigForm) => {
    saveConfigMutation.mutate(data);
  };

  // Generate preview text
  const generatePreview = () => {
    const formValues = form.watch();
    const referrerType = REWARD_TYPES.find(t => t.value === formValues.referrerRewardType);
    const refereeType = REWARD_TYPES.find(t => t.value === formValues.refereeRewardType);
    
    let referrerText = `${formValues.referrerRewardAmount} ${referrerType?.label || ''}`;
    let refereeText = `${formValues.refereeRewardAmount} ${refereeType?.label || ''}`;
    
    return `"Share your referral code! You get ${referrerText}, they get ${refereeText}!"`;
  };

  if (configLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <CardTitle>Referral Program Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading configuration...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-referral-config">
      <CardHeader>
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          <CardTitle>Referral Program Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure rewards for referrers and referees. Changes apply to new referrals immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Enable/Disable Program */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Referral Program</FormLabel>
                    <FormDescription>
                      Allow customers to generate and share referral codes
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-referral-enabled"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Referrer Reward Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold text-sm">Referrer Reward (Person Sharing)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="referrerRewardType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reward Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-referrer-reward-type">
                            <SelectValue placeholder="Select reward type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REWARD_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="referrerRewardAmount"
                  render={({ field }) => {
                    const selectedType = REWARD_TYPES.find(
                      t => t.value === form.watch('referrerRewardType')
                    );
                    return (
                      <FormItem>
                        <FormLabel>{selectedType?.amountLabel || 'Amount'}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={selectedType?.placeholder || ''}
                            data-testid="input-referrer-reward-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="referrerRewardExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry (Days)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          placeholder="Never"
                          data-testid="input-referrer-expiry"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Leave empty for no expiration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Referee Reward Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold text-sm">Referee Reward (New Customer)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="refereeRewardType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reward Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-referee-reward-type">
                            <SelectValue placeholder="Select reward type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REWARD_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="refereeRewardAmount"
                  render={({ field }) => {
                    const selectedType = REWARD_TYPES.find(
                      t => t.value === form.watch('refereeRewardType')
                    );
                    return (
                      <FormItem>
                        <FormLabel>{selectedType?.amountLabel || 'Amount'}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={selectedType?.placeholder || ''}
                            data-testid="input-referee-reward-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="refereeRewardExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry (Days)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          placeholder="Never"
                          data-testid="input-referee-expiry"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Leave empty for no expiration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-2">SMS Message Preview:</p>
              <p className="text-sm text-muted-foreground italic">{generatePreview()}</p>
            </div>

            {/* Advanced Options */}
            <FormField
              control={form.control}
              name="allowStackableRewards"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Allow Stackable Rewards</FormLabel>
                    <FormDescription>
                      Permit customers to receive multiple referral rewards simultaneously
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-stackable-rewards"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!form.formState.isDirty || saveConfigMutation.isPending}
                data-testid="button-save-config"
              >
                {saveConfigMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

interface ReferralRecord {
  id: number;
  referrerId: number;
  referrerName: string;
  referralCode: string;
  refereeName: string | null;
  refereePhone: string | null;
  refereeEmail: string | null;
  status: string;
  pointsAwarded: number;
  createdAt: string;
  signedUpAt: string | null;
  completedAt: string | null;
  rewardedAt: string | null;
}

interface AdminReferralStats {
  totalReferrals: number;
  pending: number;
  signedUp: number;
  completed: number;
  rewarded: number;
  totalPointsAwarded: number;
  conversionRate: number;
  topReferrers: {
    customerId: number;
    customerName: string;
    referralCount: number;
    completedCount: number;
    totalPoints: number;
  }[];
  recentReferrals: ReferralRecord[];
}

export default function AdminReferralStats() {
  const { data, isLoading } = useQuery<{ success: boolean; data: AdminReferralStats }>({
    queryKey: ['/api/admin/referral-stats'],
  });

  const stats = data?.data;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'signed_up':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'first_service_completed':
      case 'rewarded':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      signed_up: 'default',
      first_service_completed: 'default',
      rewarded: 'default',
    };

    const labels: Record<string, string> = {
      pending: 'Pending',
      signed_up: 'Signed Up',
      first_service_completed: 'Service Completed',
      rewarded: 'Rewarded',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600 dark:text-gray-400">Loading referral statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600 dark:text-gray-400">No referral data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <ReferralConfigurationPanel />

      {/* Statistics Section */}
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              <CardTitle>Referral Program Summary</CardTitle>
            </div>
            <CardDescription>
              Track referral performance and conversion metrics
            </CardDescription>
          </CardHeader>
        </Card>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Referrals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{stats.signedUp}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Signed Up</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="h-6 w-6 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold">{stats.rewarded}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Rewarded</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Conversion</div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Referral Program Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Points Awarded</span>
              <span className="font-semibold">{stats.totalPointsAwarded.toLocaleString()} points</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate (Rewarded / Total)</span>
              <span className="font-semibold">
                {stats.totalReferrals > 0 
                  ? Math.round((stats.rewarded / stats.totalReferrals) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Signup Rate (Signed Up / Total)</span>
              <span className="font-semibold">
                {stats.totalReferrals > 0 
                  ? Math.round(((stats.signedUp + stats.completed + stats.rewarded) / stats.totalReferrals) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Referrers */}
      {stats.topReferrers && stats.topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
            <CardDescription>Customers with the most successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total Referrals</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Points Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topReferrers.map((referrer, index) => (
                  <TableRow key={referrer.customerId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {index === 0 && <Award className="h-5 w-5 text-yellow-500" />}
                        {index === 1 && <Award className="h-5 w-5 text-gray-400" />}
                        {index === 2 && <Award className="h-5 w-5 text-orange-600" />}
                        <span className="font-semibold">#{index + 1}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{referrer.customerName}</TableCell>
                    <TableCell className="text-right">{referrer.referralCount}</TableCell>
                    <TableCell className="text-right">{referrer.completedCount}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {referrer.totalPoints.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Referrals */}
      {stats.recentReferrals && stats.recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>Latest referral activity across all customers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentReferrals.map((referral) => (
                  <TableRow key={referral.id} data-testid={`admin-referral-${referral.id}`}>
                    <TableCell className="text-sm">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{referral.referrerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{referral.referralCode}</Badge>
                    </TableCell>
                    <TableCell>
                      {referral.refereeName || referral.refereePhone || referral.refereeEmail || 'Pending'}
                    </TableCell>
                    <TableCell>{getStatusBadge(referral.status)}</TableCell>
                    <TableCell className="text-right">
                      {referral.status === 'rewarded' ? (
                        <span className="font-semibold text-green-600">
                          +{referral.pointsAwarded}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </section>
    </div>
  );
}
