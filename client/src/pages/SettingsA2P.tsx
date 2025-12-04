import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  MessageSquare, 
  Building2, 
  FileText, 
  Shield, 
  Sparkles, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { A2pCampaign } from '@shared/schema';

const USE_CASE_OPTIONS = [
  { value: 'appointment_reminders', label: 'Appointment Reminders' },
  { value: 'customer_care', label: 'Customer Care / Support' },
  { value: 'delivery_notifications', label: 'Delivery Notifications' },
  { value: 'account_notifications', label: 'Account Notifications' },
  { value: 'marketing', label: 'Marketing / Promotions' },
  { value: 'mixed', label: 'Mixed (Transactional + Marketing)' },
  { value: 'security_alerts', label: 'Security / Fraud Alerts' },
  { value: '2fa', label: 'Two-Factor Authentication' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  ready_to_submit: 'bg-yellow-500',
  submitted: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready_to_submit: 'Ready to Submit',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

interface CampaignFormData {
  brandName: string;
  websiteUrl: string;
  useCaseCategory: string;
  campaignDescription: string;
  sampleMessages: string[];
  optInDescription: string;
  optOutInstructions: string;
  helpInstructions: string;
  messageFrequency: string;
  termsUrl: string;
  privacyUrl: string;
}

export default function SettingsA2P() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CampaignFormData>({
    brandName: '',
    websiteUrl: '',
    useCaseCategory: 'mixed',
    campaignDescription: '',
    sampleMessages: ['', '', ''],
    optInDescription: '',
    optOutInstructions: 'Reply STOP to unsubscribe from all messages.',
    helpInstructions: 'Reply HELP to receive assistance or call us directly.',
    messageFrequency: '1-5 messages per month',
    termsUrl: '',
    privacyUrl: '',
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch campaign data
  const { data: campaignData, isLoading } = useQuery<{ 
    success: boolean; 
    campaign: A2pCampaign | Partial<A2pCampaign>; 
    isNew: boolean;
  }>({
    queryKey: ['/api/a2p/campaign'],
  });

  // Populate form when data loads
  useEffect(() => {
    if (campaignData?.campaign) {
      const c = campaignData.campaign;
      setFormData({
        brandName: c.brandName || '',
        websiteUrl: c.websiteUrl || '',
        useCaseCategory: c.useCaseCategory || 'mixed',
        campaignDescription: c.campaignDescription || '',
        sampleMessages: (c.sampleMessages as string[])?.length ? c.sampleMessages as string[] : ['', '', ''],
        optInDescription: c.optInDescription || '',
        optOutInstructions: c.optOutInstructions || 'Reply STOP to unsubscribe from all messages.',
        helpInstructions: c.helpInstructions || 'Reply HELP to receive assistance or call us directly.',
        messageFrequency: c.messageFrequency || '1-5 messages per month',
        termsUrl: c.termsUrl || '',
        privacyUrl: c.privacyUrl || '',
      });
    }
  }, [campaignData]);

  // Save campaign mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      return await apiRequest('PUT', '/api/a2p/campaign', {
        ...data,
        sampleMessages: data.sampleMessages.filter(m => m.trim()),
      });
    },
    onSuccess: () => {
      toast({ title: 'Campaign saved', description: 'Your A2P campaign draft has been saved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/a2p/campaign'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Save failed', 
        description: error.message || 'Failed to save campaign', 
        variant: 'destructive' 
      });
    },
  });

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest('POST', '/api/a2p/campaign/status', { status });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Status updated', 
        description: `Campaign marked as ${STATUS_LABELS[data.campaign.status]}` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/a2p/campaign'] });
    },
    onError: (error: any) => {
      const errorData = error.response?.data || error;
      if (errorData.validationErrors) {
        setValidationErrors(errorData.validationErrors);
      }
      toast({ 
        title: 'Status update failed', 
        description: errorData.error || error.message || 'Failed to update status', 
        variant: 'destructive' 
      });
    },
  });

  // AI suggestion mutation
  const aiMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/a2p/campaign/ai-suggest', {});
      return response;
    },
    onSuccess: (data: any) => {
      if (data.suggestions) {
        setFormData(prev => ({
          ...prev,
          campaignDescription: data.suggestions.campaign_description || prev.campaignDescription,
          sampleMessages: data.suggestions.sample_messages?.length 
            ? [...data.suggestions.sample_messages, '', ''].slice(0, 4)
            : prev.sampleMessages,
          optInDescription: data.suggestions.opt_in_description || prev.optInDescription,
          optOutInstructions: data.suggestions.opt_out_instructions || prev.optOutInstructions,
          helpInstructions: data.suggestions.help_instructions || prev.helpInstructions,
          messageFrequency: data.suggestions.message_frequency || prev.messageFrequency,
        }));
        toast({ 
          title: 'AI suggestions applied', 
          description: 'Review the suggested content and make any adjustments.' 
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: 'AI suggestion failed', 
        description: error.message || 'Failed to generate suggestions', 
        variant: 'destructive' 
      });
    },
  });

  const handleSave = () => {
    setValidationErrors([]);
    saveMutation.mutate(formData);
  };

  const handleMarkReady = () => {
    setValidationErrors([]);
    statusMutation.mutate('ready_to_submit');
  };

  const handleBackToDraft = () => {
    setValidationErrors([]);
    statusMutation.mutate('draft');
  };

  const updateSampleMessage = (index: number, value: string) => {
    const newMessages = [...formData.sampleMessages];
    newMessages[index] = value;
    setFormData(prev => ({ ...prev, sampleMessages: newMessages }));
  };

  const addSampleMessage = () => {
    if (formData.sampleMessages.length < 5) {
      setFormData(prev => ({ 
        ...prev, 
        sampleMessages: [...prev.sampleMessages, ''] 
      }));
    }
  };

  const removeSampleMessage = (index: number) => {
    if (formData.sampleMessages.length > 2) {
      setFormData(prev => ({
        ...prev,
        sampleMessages: prev.sampleMessages.filter((_, i) => i !== index),
      }));
    }
  };

  const campaign = campaignData?.campaign as A2pCampaign | undefined;
  const currentStatus = campaign?.status || 'draft';
  const isEditable = currentStatus === 'draft' || currentStatus === 'rejected';

  if (isLoading) {
    return (
      <AppShell title="SMS Compliance" showSearch={false}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="SMS Compliance" showSearch={false}>
      <TooltipProvider>
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          {/* Header with Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="title-a2p-campaign">A2P Campaign Registration</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Complete your SMS campaign registration for carrier approval
              </p>
            </div>
            <Badge 
              className={`${STATUS_COLORS[currentStatus]} text-white px-3 py-1`}
              data-testid="badge-campaign-status"
            >
              {STATUS_LABELS[currentStatus]}
            </Badge>
          </div>

          {/* Info Alert */}
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>What is A2P?</AlertTitle>
            <AlertDescription>
              A2P (Application-to-Person) registration is required by US carriers for business SMS. 
              This ensures your messages are delivered reliably and not blocked as spam. 
              Complete this form and mark it "Ready to Submit" when done.
            </AlertDescription>
          </Alert>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Please fix the following issues</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Section 1: Business & Brand */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business & Brand
              </CardTitle>
              <CardDescription>
                Basic information about your business for carrier registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand Name *</Label>
                  <Input
                    id="brandName"
                    value={formData.brandName}
                    onChange={(e) => setFormData(prev => ({ ...prev, brandName: e.target.value }))}
                    placeholder="Your Business Name"
                    disabled={!isEditable}
                    data-testid="input-brand-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL</Label>
                  <Input
                    id="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                    placeholder="https://yourbusiness.com"
                    disabled={!isEditable}
                    data-testid="input-website-url"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="useCaseCategory">Primary Use Case *</Label>
                <Select 
                  value={formData.useCaseCategory} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, useCaseCategory: value }))}
                  disabled={!isEditable}
                >
                  <SelectTrigger id="useCaseCategory" data-testid="select-use-case">
                    <SelectValue placeholder="Select use case" />
                  </SelectTrigger>
                  <SelectContent>
                    {USE_CASE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Campaign Description */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Campaign Description
                  </CardTitle>
                  <CardDescription>
                    Describe the purpose and types of messages you'll send
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiMutation.mutate()}
                  disabled={aiMutation.isPending || !isEditable}
                  data-testid="button-ai-suggest"
                >
                  {aiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AI Suggest
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignDescription">Campaign Description *</Label>
                <Textarea
                  id="campaignDescription"
                  value={formData.campaignDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, campaignDescription: e.target.value }))}
                  placeholder="Describe what types of messages you'll send and why customers receive them..."
                  rows={4}
                  disabled={!isEditable}
                  data-testid="textarea-campaign-description"
                />
                <p className="text-xs text-muted-foreground">
                  Be specific about the types of messages (reminders, confirmations, promotions, etc.)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Sample Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Sample Messages
              </CardTitle>
              <CardDescription>
                Provide 2-4 real examples of messages you'll send. Include opt-out language in each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.sampleMessages.map((message, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`sample-${index}`}>Sample Message {index + 1} {index < 2 && '*'}</Label>
                    {formData.sampleMessages.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSampleMessage(index)}
                        disabled={!isEditable}
                        data-testid={`button-remove-sample-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    id={`sample-${index}`}
                    value={message}
                    onChange={(e) => updateSampleMessage(index, e.target.value)}
                    placeholder={`Example: "Hi [Name], this is a reminder about your appointment tomorrow at 2pm. Reply STOP to unsubscribe."`}
                    rows={3}
                    disabled={!isEditable}
                    data-testid={`textarea-sample-message-${index}`}
                  />
                </div>
              ))}
              {formData.sampleMessages.length < 5 && isEditable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSampleMessage}
                  data-testid="button-add-sample"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Sample
                </Button>
              )}
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Each sample message should include opt-out language like "Reply STOP to unsubscribe"
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Section 4: Compliance Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance Details
              </CardTitle>
              <CardDescription>
                Required information about customer consent and message handling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="optInDescription">Opt-In Description *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Explain how customers consent to receive SMS messages (e.g., during booking, 
                      by checking a box, providing their phone number, etc.)
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="optInDescription"
                  value={formData.optInDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, optInDescription: e.target.value }))}
                  placeholder="Customers opt-in by providing their phone number when booking an appointment. They agree to receive service-related messages by checking the SMS consent checkbox during signup."
                  rows={3}
                  disabled={!isEditable}
                  data-testid="textarea-opt-in"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="optOutInstructions">Opt-Out Instructions *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Must include the STOP keyword. This is required by carriers for compliance.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="optOutInstructions"
                  value={formData.optOutInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, optOutInstructions: e.target.value }))}
                  placeholder="Reply STOP to unsubscribe from all messages."
                  rows={2}
                  disabled={!isEditable}
                  data-testid="textarea-opt-out"
                />
                <p className="text-xs text-muted-foreground">
                  Must include "STOP" keyword (e.g., "Reply STOP to unsubscribe")
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="helpInstructions">HELP Response *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      What customers receive when they reply HELP to your messages.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="helpInstructions"
                  value={formData.helpInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, helpInstructions: e.target.value }))}
                  placeholder="Reply HELP to receive assistance or call us directly at (555) 123-4567."
                  rows={2}
                  disabled={!isEditable}
                  data-testid="textarea-help"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="messageFrequency">Message Frequency *</Label>
                <Input
                  id="messageFrequency"
                  value={formData.messageFrequency}
                  onChange={(e) => setFormData(prev => ({ ...prev, messageFrequency: e.target.value }))}
                  placeholder="1-5 messages per month"
                  disabled={!isEditable}
                  data-testid="input-frequency"
                />
                <p className="text-xs text-muted-foreground">
                  Estimate how often customers will receive messages from you
                </p>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="termsUrl">Terms of Service URL</Label>
                  <Input
                    id="termsUrl"
                    value={formData.termsUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, termsUrl: e.target.value }))}
                    placeholder="https://yourbusiness.com/terms"
                    disabled={!isEditable}
                    data-testid="input-terms-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacyUrl">Privacy Policy URL</Label>
                  <Input
                    id="privacyUrl"
                    value={formData.privacyUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, privacyUrl: e.target.value }))}
                    placeholder="https://yourbusiness.com/privacy"
                    disabled={!isEditable}
                    data-testid="input-privacy-url"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {isEditable && (
                  <>
                    <Button 
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="flex-1"
                      data-testid="button-save-draft"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Draft
                    </Button>
                    <Button 
                      variant="default"
                      onClick={handleMarkReady}
                      disabled={statusMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="button-mark-ready"
                    >
                      {statusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark Ready to Submit
                    </Button>
                  </>
                )}
                {currentStatus === 'ready_to_submit' && (
                  <Button 
                    variant="outline"
                    onClick={handleBackToDraft}
                    disabled={statusMutation.isPending}
                    data-testid="button-back-to-draft"
                  >
                    Back to Draft
                  </Button>
                )}
              </div>

              {currentStatus === 'ready_to_submit' && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Ready for Review</AlertTitle>
                  <AlertDescription>
                    Your campaign is ready! The platform owner will review and submit it to Twilio for carrier approval.
                    You'll be notified when it's approved.
                  </AlertDescription>
                </Alert>
              )}

              {currentStatus === 'submitted' && (
                <Alert className="mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Under Review</AlertTitle>
                  <AlertDescription>
                    Your campaign has been submitted to carriers for approval. 
                    This typically takes 1-2 business days.
                  </AlertDescription>
                </Alert>
              )}

              {currentStatus === 'approved' && (
                <Alert className="mt-4 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Approved!</AlertTitle>
                  <AlertDescription className="text-green-700">
                    Your A2P campaign has been approved. Your SMS messages will be delivered reliably.
                  </AlertDescription>
                </Alert>
              )}

              {currentStatus === 'rejected' && campaign?.carrierRejectionReason && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Rejected</AlertTitle>
                  <AlertDescription>
                    {campaign.carrierRejectionReason}
                    <br />
                    Please update your campaign details and try again.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* FAQ Accordion */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger>What is A2P 10DLC registration?</AccordionTrigger>
              <AccordionContent>
                A2P 10DLC (Application-to-Person 10-Digit Long Code) is the industry standard for 
                business SMS in the United States. It requires businesses to register their SMS campaigns 
                with carriers to ensure messages are delivered reliably and not blocked as spam.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2">
              <AccordionTrigger>Why is opt-out language required?</AccordionTrigger>
              <AccordionContent>
                US carriers and regulations (TCPA, CTIA guidelines) require that all commercial SMS 
                messages include a way for recipients to opt out. The standard is to include 
                "Reply STOP to unsubscribe" in your messages.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-3">
              <AccordionTrigger>How long does approval take?</AccordionTrigger>
              <AccordionContent>
                After you mark your campaign as "Ready to Submit," the platform owner will review it 
                and submit to Twilio. Carrier approval typically takes 1-2 business days, but can 
                sometimes take longer depending on the campaign type.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-4">
              <AccordionTrigger>What content is not allowed?</AccordionTrigger>
              <AccordionContent>
                Carriers prohibit SHAFT content: Sex, Hate, Alcohol, Firearms, and Tobacco. 
                Additionally, misleading, deceptive, or spam-like content will be rejected. 
                Keep your messages professional, clear, and relevant to your business.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </TooltipProvider>
    </AppShell>
  );
}
