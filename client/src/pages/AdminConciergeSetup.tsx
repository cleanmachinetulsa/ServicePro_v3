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
import { Sparkles, Building2, MapPin, Mail, Briefcase, FileText, CheckCircle2, ArrowRight, UserCircle, Phone, Globe, Palette, Bell, User } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Link, useLocation } from 'wouter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const onboardTenantSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  slug: z.string().max(100).optional().or(z.literal('')),
  contactName: z.string().max(255).optional().or(z.literal('')),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  primaryCity: z.string().max(100).optional().or(z.literal('')),
  planTier: z.enum(['starter', 'pro', 'elite', 'internal'], {
    required_error: 'Please select a plan tier',
  }),
  status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'cancelled'], {
    required_error: 'Please select a status',
  }),
  industry: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().min(1, 'Phone number is required').max(50),
  messagingServiceSid: z.string().max(255).optional().or(z.literal('')),
  ivrMode: z.enum(['simple', 'ivr', 'ai-voice'], {
    required_error: 'Please select an IVR mode',
  }),
  websiteUrl: z.string().max(500).optional().or(z.literal('')),
  primaryColor: z.string().max(20).optional().or(z.literal('')),
  accentColor: z.string().max(20).optional().or(z.literal('')),
  internalNotes: z.string().optional().or(z.literal('')),
  sendWelcomeEmail: z.boolean().optional().default(false),
  sendWelcomeSms: z.boolean().optional().default(false),
});

type OnboardTenantForm = z.infer<typeof onboardTenantSchema>;

interface OnboardResponse {
  success: boolean;
  tenant: {
    tenantId: string;
    businessName: string;
    planTier: string;
    status: string;
    industry: string | null;
    phoneNumber: string;
    ivrMode: string;
    hasPhoneConfig: boolean;
    websiteUrl: string | null;
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
  const [, navigate] = useLocation();
  const [createdTenant, setCreatedTenant] = useState<OnboardResponse['tenant'] | null>(null);

  const form = useForm<OnboardTenantForm>({
    resolver: zodResolver(onboardTenantSchema),
    defaultValues: {
      businessName: '',
      slug: '',
      contactName: '',
      contactEmail: '',
      primaryCity: '',
      planTier: 'starter',
      status: 'trialing',
      industry: '',
      phoneNumber: '',
      messagingServiceSid: '',
      ivrMode: 'simple',
      websiteUrl: '',
      primaryColor: '',
      accentColor: '',
      internalNotes: '',
      sendWelcomeEmail: false,
      sendWelcomeSms: false,
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

  const impersonateMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await apiRequest('/api/admin/impersonate/start', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Impersonation Active',
        description: `You are now viewing the app as ${data.tenantName}`,
      });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start impersonation',
        variant: 'destructive',
      });
    },
  });

  const handleImpersonate = () => {
    if (createdTenant) {
      impersonateMutation.mutate(createdTenant.tenantId);
    }
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
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <p className="text-gray-900 dark:text-gray-100" data-testid="text-status">
                      {createdTenant.status.charAt(0).toUpperCase() + createdTenant.status.slice(1)}
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Phone Number</p>
                    <p className="text-gray-900 dark:text-gray-100" data-testid="text-phone-number">
                      {createdTenant.phoneNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">IVR Mode</p>
                    <p className="text-gray-900 dark:text-gray-100" data-testid="text-ivr-mode">
                      {createdTenant.ivrMode}
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
                <div className="space-y-3">
                  <Button
                    onClick={handleImpersonate}
                    variant="default"
                    className="w-full"
                    disabled={impersonateMutation.isPending}
                    data-testid="button-login-as-tenant"
                  >
                    <UserCircle className="w-4 h-4 mr-2" />
                    Login as this Tenant
                  </Button>
                  <Button
                    onClick={handleCreateAnother}
                    variant="outline"
                    className="w-full"
                    data-testid="button-create-another"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Another Tenant
                  </Button>
                </div>
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
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (Subdomain)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., acme-detailing"
                          data-testid="input-slug"
                        />
                      </FormControl>
                      <FormDescription>
                        URL-friendly identifier (optional, auto-generated if blank)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="e.g., John Smith"
                            className="pl-10"
                            data-testid="input-contact-name"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Primary contact person name (optional)
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
                          className="grid grid-cols-4 gap-3"
                        >
                          <div>
                            <RadioGroupItem
                              value="starter"
                              id="starter"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="starter"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-blue-500 [&:has([data-state=checked])]:border-blue-500 cursor-pointer"
                              data-testid="radio-tier-starter"
                            >
                              <span className="text-base font-semibold">Starter</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                Basic
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
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-blue-500 [&:has([data-state=checked])]:border-blue-500 cursor-pointer"
                              data-testid="radio-tier-pro"
                            >
                              <span className="text-base font-semibold">Pro</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                Advanced
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
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-purple-500 [&:has([data-state=checked])]:border-purple-500 cursor-pointer"
                              data-testid="radio-tier-elite"
                            >
                              <span className="text-base font-semibold">Elite</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                Full suite
                              </span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="internal"
                              id="internal"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="internal"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 peer-data-[state=checked]:border-green-500 [&:has([data-state=checked])]:border-green-500 cursor-pointer"
                              data-testid="radio-tier-internal"
                            >
                              <span className="text-base font-semibold">Internal</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                Owner use
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="trialing">Trialing</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="past_due">Past Due</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Account status for this tenant
                      </FormDescription>
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

              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <Phone className="w-5 h-5 text-green-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Telephony
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="+19185551234"
                            className="pl-10"
                            data-testid="input-phone-number"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        E.164 format (e.g., +19185551234) or 10-digit US number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="messagingServiceSid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Messaging Service SID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          data-testid="input-messaging-service-sid"
                        />
                      </FormControl>
                      <FormDescription>
                        Twilio Messaging Service SID (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ivrMode"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>IVR Mode *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-2"
                        >
                          <div className="flex items-center space-x-3 space-y-0">
                            <RadioGroupItem value="simple" id="ivr-simple" data-testid="radio-ivr-simple" />
                            <Label htmlFor="ivr-simple" className="font-normal cursor-pointer">
                              <span className="font-semibold">Simple</span> - Forward to existing phone
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 space-y-0">
                            <RadioGroupItem value="ivr" id="ivr-menu" data-testid="radio-ivr-menu" />
                            <Label htmlFor="ivr-menu" className="font-normal cursor-pointer">
                              <span className="font-semibold">IVR</span> - Keypad menu system
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 space-y-0">
                            <RadioGroupItem value="ai-voice" id="ivr-ai" data-testid="radio-ivr-ai" />
                            <Label htmlFor="ivr-ai" className="font-normal cursor-pointer">
                              <span className="font-semibold">AI Voice</span> - AI receptionist (beta)
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <Palette className="w-5 h-5 text-pink-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Website & Branding
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="https://example.com"
                            className="pl-10"
                            data-testid="input-website-url"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Tenant's existing website (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="#3b82f6"
                            data-testid="input-primary-color"
                          />
                        </FormControl>
                        <FormDescription>
                          Hex color (e.g., #3b82f6)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accentColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accent Color</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="#ec4899"
                            data-testid="input-accent-color"
                          />
                        </FormControl>
                        <FormDescription>
                          Secondary brand color
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <FileText className="w-5 h-5 text-orange-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Additional Options
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Owner-only notes about this tenant..."
                          className="min-h-[100px]"
                          data-testid="textarea-internal-notes"
                        />
                      </FormControl>
                      <FormDescription>
                        Private notes visible only to admins
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Onboarding Messaging
                  </p>
                  <FormField
                    control={form.control}
                    name="sendWelcomeEmail"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                            data-testid="checkbox-send-welcome-email"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Send welcome email to primary contact
                          </FormLabel>
                          <FormDescription>
                            (Feature coming soon - not yet implemented)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sendWelcomeSms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                            data-testid="checkbox-send-welcome-sms"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Send welcome SMS to primary contact
                          </FormLabel>
                          <FormDescription>
                            (Feature coming soon - not yet implemented)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
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
