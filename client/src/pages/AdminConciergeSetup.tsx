import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Building2, MapPin, Mail, Briefcase, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Link } from 'wouter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const onboardTenantSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  primaryCity: z.string().max(100).optional().or(z.literal('')),
  planTier: z.enum(['starter', 'pro', 'elite'], {
    required_error: 'Please select a plan tier',
  }),
  industry: z.string().max(100).optional().or(z.literal('')),
  internalNotes: z.string().optional().or(z.literal('')),
  createPhoneConfigStub: z.boolean().optional().default(false),
});

type OnboardTenantForm = z.infer<typeof onboardTenantSchema>;

interface OnboardResponse {
  success: boolean;
  tenant: {
    tenantId: string;
    businessName: string;
    planTier: string;
    industry: string | null;
    hasPhoneConfigStub: boolean;
  };
}

const industryOptions = [
  { value: 'mobile-detailing', label: 'Mobile Auto Detailing' },
  { value: 'lawn-care', label: 'Lawn Care' },
  { value: 'house-cleaning', label: 'House Cleaning' },
  { value: 'window-washing', label: 'Window Washing' },
  { value: 'pet-grooming', label: 'Pet Grooming' },
  { value: 'hvac', label: 'HVAC Services' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical Services' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'other', label: 'Other' },
];

export default function AdminConciergeSetup() {
  const { toast } = useToast();
  const [createdTenant, setCreatedTenant] = useState<OnboardResponse['tenant'] | null>(null);

  const form = useForm<OnboardTenantForm>({
    resolver: zodResolver(onboardTenantSchema),
    defaultValues: {
      businessName: '',
      contactEmail: '',
      primaryCity: '',
      planTier: 'starter',
      industry: '',
      internalNotes: '',
      createPhoneConfigStub: false,
    },
  });

  const onboardMutation = useMutation({
    mutationFn: async (data: OnboardTenantForm) => {
      const response = await apiRequest<OnboardResponse>('/api/admin/concierge/onboard-tenant', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    },
    onSuccess: (data) => {
      setCreatedTenant(data.tenant);
      toast({
        title: 'Success',
        description: `Tenant "${data.tenant.businessName}" created successfully`,
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tenant',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: OnboardTenantForm) => {
    onboardMutation.mutate(data);
  };

  const handleCreateAnother = () => {
    setCreatedTenant(null);
    form.reset();
  };

  if (createdTenant) {
    return (
      <AppShell title="Concierge Setup">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Card className="p-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Tenant Created Successfully!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {createdTenant.businessName} is now set up on ServicePro
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 space-y-3 text-left border border-green-200 dark:border-green-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tenant ID</p>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100" data-testid="text-tenant-id">
                      {createdTenant.tenantId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Plan Tier</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100" data-testid="text-plan-tier">
                      {createdTenant.planTier.charAt(0).toUpperCase() + createdTenant.planTier.slice(1)}
                    </p>
                  </div>
                  {createdTenant.industry && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Industry</p>
                      <p className="text-gray-900 dark:text-gray-100" data-testid="text-industry">
                        {createdTenant.industry}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Phone Config</p>
                    <p className="text-gray-900 dark:text-gray-100">
                      {createdTenant.hasPhoneConfigStub ? 'Stub created' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Next Steps:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link href="/admin/tenants">
                    <Button variant="outline" className="w-full" data-testid="button-manage-tenants">
                      <Building2 className="w-4 h-4 mr-2" />
                      Manage Tenants
                    </Button>
                  </Link>
                  <Link href="/admin/phone-config">
                    <Button variant="outline" className="w-full" data-testid="button-configure-phone">
                      Configure Phone & IVR
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
                <Button
                  onClick={handleCreateAnother}
                  variant="default"
                  className="w-full"
                  data-testid="button-create-another"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Another Tenant
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Concierge Setup">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-500" />
            Concierge Setup
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Streamlined onboarding for new ServicePro tenants
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Business Basics
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Acme Mobile Detailing"
                          data-testid="input-business-name"
                        />
                      </FormControl>
                      <FormDescription>
                        The customer-facing name of this business
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="owner@business.com"
                            className="pl-10"
                            data-testid="input-contact-email"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Primary contact for this tenant (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary City</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="e.g., Tulsa"
                            className="pl-10"
                            data-testid="input-primary-city"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Primary service area (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <Briefcase className="w-5 h-5 text-purple-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Plan & Industry
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="planTier"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Plan Tier *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-3 gap-4"
                        >
                          <div>
                            <RadioGroupItem
                              value="starter"
                              id="starter"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="starter"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-blue-500 [&:has([data-state=checked])]:border-blue-500 cursor-pointer"
                              data-testid="radio-tier-starter"
                            >
                              <span className="text-lg font-semibold">Starter</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Basic features
                              </span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="pro"
                              id="pro"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="pro"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-blue-500 [&:has([data-state=checked])]:border-blue-500 cursor-pointer"
                              data-testid="radio-tier-pro"
                            >
                              <span className="text-lg font-semibold">Pro</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Advanced tools
                              </span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="elite"
                              id="elite"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="elite"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-purple-500 [&:has([data-state=checked])]:border-purple-500 cursor-pointer"
                              data-testid="radio-tier-elite"
                            >
                              <span className="text-lg font-semibold">Elite</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Full suite
                              </span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select an industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {industryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Business type (helps with templates and defaults)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Textarea
                            {...field}
                            placeholder="Owner-only notes about this tenant..."
                            className="pl-10 min-h-[100px]"
                            data-testid="textarea-internal-notes"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Private notes visible only to admins
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                data-testid="button-reset"
              >
                Reset Form
              </Button>
              <Button
                type="submit"
                disabled={onboardMutation.isPending}
                data-testid="button-submit"
              >
                {onboardMutation.isPending ? (
                  <>Creating Tenant...</>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Tenant via Concierge
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppShell>
  );
}
