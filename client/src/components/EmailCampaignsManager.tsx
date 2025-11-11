import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CheckCircle, 
  XCircle, 
  Calendar as CalendarIcon, 
  Mail, 
  MessageSquare, 
  MailPlus, 
  Zap, 
  Send, 
  Edit, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  Gift,
  ChevronRight,
  Users,
  Wand2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmailTemplateWizard } from './EmailTemplateWizard';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  unsubscribed: boolean;
}

interface Campaign {
  id: number;
  name: string;
  subject: string;
  content: string;
  scheduledDate: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  openRate?: number;
  clickRate?: number;
  targetAudience: string;
  recipientCount: number;
  createdAt: string;
  template?: string;
  designStyle?: 'professional' | 'vibrant' | 'elegant' | 'fresh' | 'bold';
  layoutStyle?: 'standard' | 'wide' | 'narrow';
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  content: string;
  category: string;
  lastUsed?: string;
}

interface HolidayTemplate {
  id: string;
  name: string;
  description: string;
  dateInfo: string;
  suggestedSubject: string;
  suggestedContent: string;
  type: 'holiday' | 'seasonal' | 'occasion';
}

const holidayTemplates: HolidayTemplate[] = [
  {
    id: 'valentine',
    name: "Valentine's Day Special",
    description: "Romantic holiday offers for couples",
    dateInfo: "February 14",
    suggestedSubject: "Give the Gift of Shine: Valentine's Day Special Offer",
    suggestedContent: "Show your love with a gift card for a premium detailing package. We'll make their car look as special as they are!",
    type: 'holiday'
  },
  {
    id: 'mothersday',
    name: "Mother's Day",
    description: "Special offers for mom",
    dateInfo: "Second Sunday in May",
    suggestedSubject: "Treat Mom to a Spotless Ride: Mother's Day Gift Cards Now Available",
    suggestedContent: "Mom deserves the best! Give her a Clean Machine gift card and we'll make her vehicle shine like new.",
    type: 'holiday'
  },
  {
    id: 'fathersday',
    name: "Father's Day",
    description: "Special offers for dad",
    dateInfo: "Third Sunday in June",
    suggestedSubject: "For the Dad Who Loves His Ride: Father's Day Gift Cards",
    suggestedContent: "Dad takes pride in his vehicle - give him our premium detailing service and watch his face light up!",
    type: 'holiday'
  },
  {
    id: 'christmas',
    name: "Christmas Holiday",
    description: "End of year holiday specials",
    dateInfo: "December 25",
    suggestedSubject: "Wrap Up the Perfect Gift: Clean Machine Holiday Gift Cards",
    suggestedContent: "Looking for the perfect gift? Our gift cards for premium auto detailing services bring joy that lasts all year!",
    type: 'holiday'
  },
  {
    id: 'newyear',
    name: "New Year Special",
    description: "New year, new car look",
    dateInfo: "January 1",
    suggestedSubject: "New Year, New Shine: Start Fresh with Our Detailing Packages",
    suggestedContent: "Kick off the new year with a vehicle that looks brand new. Book our signature detailing service now!",
    type: 'seasonal'
  },
  {
    id: 'spring',
    name: "Spring Cleaning",
    description: "Post-winter detailing specials",
    dateInfo: "March-April",
    suggestedSubject: "Spring Cleaning for Your Vehicle: Schedule Now & Save",
    suggestedContent: "Winter's salt and grime can damage your vehicle. Book our spring cleaning detail and protect your investment!",
    type: 'seasonal'
  },
  {
    id: 'summer',
    name: "Summer Road Trip Ready",
    description: "Prepare for summer driving",
    dateInfo: "June-July",
    suggestedSubject: "Road Trip Ready: Prepare Your Vehicle for Summer Adventures",
    suggestedContent: "Before you hit the road this summer, let us get your vehicle in perfect condition with our Road Trip Ready package!",
    type: 'seasonal'
  },
  {
    id: 'fall',
    name: "Fall Protection Package",
    description: "Prepare for fall and winter",
    dateInfo: "September-October",
    suggestedSubject: "Protect Your Vehicle This Fall with Our Seasonal Package",
    suggestedContent: "Falling leaves and upcoming winter weather can damage your vehicle's finish. Our Fall Protection Package has you covered!",
    type: 'seasonal'
  },
  {
    id: 'birthday',
    name: "Birthday Offer",
    description: "Special offer for customer birthdays",
    dateInfo: "Customer birthday",
    suggestedSubject: "Happy Birthday from Clean Machine! A Special Offer Just for You",
    suggestedContent: "To celebrate your birthday, we're offering 20% off any detailing package this month. Your vehicle deserves a birthday present too!",
    type: 'occasion'
  },
  {
    id: 'anniversary',
    name: "Customer Anniversary",
    description: "Special offer for loyal customers",
    dateInfo: "Customer signup anniversary",
    suggestedSubject: "Celebrating Another Year Together: A Special Thank You",
    suggestedContent: "It's been another year since your first visit to Clean Machine, and we want to say thank you with a special loyalty discount!",
    type: 'occasion'
  }
];

const EmailCampaignsManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<EmailTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedHolidayTemplate, setSelectedHolidayTemplate] = useState<HolidayTemplate | null>(null);
  const [showWizardDialog, setShowWizardDialog] = useState(false);
  const [customerSegment, setCustomerSegment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [generatedEmail, setGeneratedEmail] = useState<{subject: string; content: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'draft' | 'scheduled' | 'sent' | 'cancelled'>('all');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [newCampaign, setNewCampaign] = useState<{
    name: string;
    subject: string;
    content: string;
    scheduledDate: Date | null;
    targetAudience: string;
    designStyle?: 'professional' | 'vibrant' | 'elegant' | 'fresh' | 'bold';
    layoutStyle?: 'standard' | 'wide' | 'narrow';
  }>({
    name: '',
    subject: '',
    content: '',
    scheduledDate: null,
    targetAudience: 'all'
  });

  // Fetch actual email campaigns from the database
  // Create fallback demo data for the email campaigns
  const createDemoCampaigns = () => {
    return [
      {
        id: 1,
        name: 'Summer Special',
        subject: 'Get Your Vehicle Ready for Summer with 15% Off!',
        content: 'Heat and sun can damage your vehicle\'s appearance. Protect your investment with our summer detailing package - now 15% off when you book before June 30th!\n\nOur professional service includes:\n- Complete exterior wash and clay bar treatment\n- Paint protection application\n- Interior deep cleaning\n- UV protection for all surfaces\n\nBook your appointment today at Clean Machine Auto Detail!',
        scheduledDate: null,
        targetAudience: 'all',
        recipientCount: 125,
        status: 'draft',
        createdAt: new Date().toISOString(),
        designStyle: 'vibrant',
        layoutStyle: 'image-top'
      },
      {
        id: 2,
        name: 'Service Reminder',
        subject: 'Time for Your Regular Detail Service',
        content: 'Dear valued customer,\n\nIt\'s been three months since your last service with us. Regular maintenance is key to preserving your vehicle\'s appearance and value.\n\nWe recommend scheduling your next appointment to maintain that showroom-quality finish.\n\nAs a loyal customer, you\'ll receive priority scheduling and a complimentary air freshener with your next visit.\n\nBest regards,\nClean Machine Auto Detail Team',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        targetAudience: 'previous_customers',
        recipientCount: 87,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        designStyle: 'professional',
        layoutStyle: 'side-by-side'
      },
      {
        id: 3,
        name: 'Father\'s Day Gift Cards',
        subject: 'The Perfect Father\'s Day Gift - Auto Detailing Gift Cards',
        content: 'Looking for the perfect Father\'s Day gift? Give Dad something he\'ll truly appreciate - a professional detailing service for his pride and joy!\n\nOur gift cards are available in any denomination and never expire. Purchase before June 15th and receive a complimentary air freshener with your gift card.\n\nOrder online or call us today!',
        scheduledDate: null,
        targetAudience: 'all',
        recipientCount: 210,
        status: 'draft',
        createdAt: new Date().toISOString(),
        designStyle: 'elegant',
        layoutStyle: 'image-top'
      },
      {
        id: 4,
        name: 'Ceramic Coating Special',
        subject: 'Limited Time Offer: 20% Off Premium Ceramic Coating',
        content: 'Protect your vehicle\'s finish for years to come with our premium ceramic coating service.\n\nFor a limited time, we\'re offering 20% off our ceramic coating packages. These professional-grade coatings provide:\n\n- Superior protection against UV rays, bird droppings, and environmental contaminants\n- Hydrophobic properties that make washing easier\n- A deep, glossy finish that enhances your vehicle\'s appearance\n- Long-lasting protection (up to 5 years with proper maintenance)\n\nSpaces are limited. Book your appointment today!',
        scheduledDate: null,
        targetAudience: 'high_value',
        recipientCount: 45,
        status: 'draft',
        createdAt: new Date().toISOString(),
        designStyle: 'professional',
        layoutStyle: 'side-by-side',
        openRate: 48,
        clickRate: 12
      },
      {
        id: 5,
        name: 'Spring Newsletter',
        subject: 'Spring Auto Care Tips from Clean Machine',
        content: 'Spring has arrived, and it\'s time to shake off winter\'s effects on your vehicle!\n\nThis season brings unique challenges for your car\'s appearance and performance. Our latest newsletter includes:\n\n- How to properly remove road salt residue\n- Protecting your interior from increased UV exposure\n- Special spring maintenance checklist\n- Exclusive spring discount code: SPRING15\n\nRead on for expert tips from our detailing professionals!',
        scheduledDate: '2025-04-15T10:00:00.000Z',
        targetAudience: 'all',
        recipientCount: 315,
        status: 'sent',
        createdAt: '2025-04-10T08:30:00.000Z',
        openRate: 62,
        clickRate: 23
      }
    ];
  };

  // For demo purposes, create mock customers
  const createDemoCustomers = () => {
    return [
      { id: 1, name: 'Alex Johnson', email: 'alex@example.com', phone: '123-456-7890', unsubscribed: false },
      { id: 2, name: 'Jamie Smith', email: 'jamie@example.com', phone: '234-567-8901', unsubscribed: false },
      { id: 3, name: 'Jordan Miller', email: 'jordan@example.com', phone: '345-678-9012', unsubscribed: false },
      { id: 4, name: 'Casey Brown', email: 'casey@example.com', phone: '456-789-0123', unsubscribed: true },
      { id: 5, name: 'Taylor Wilson', email: 'taylor@example.com', phone: '567-890-1234', unsubscribed: false }
    ];
  };

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ['/api/email-campaigns'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/email-campaigns');
        const data = await response.json();

        if (data.success && Array.isArray(data.campaigns) && data.campaigns.length > 0) {
          return data.campaigns;
        } else {
          // If no campaigns exist yet, create some initial campaigns based on real services
          const servicesResponse = await fetch('/api/services');
          const servicesData = await servicesResponse.json();

          const now = new Date();
          const futureDate1 = new Date(now);
          futureDate1.setDate(now.getDate() + 7);

          const futureDate2 = new Date(now);
          futureDate2.setDate(now.getDate() + 14);

          // Use your actual services to create relevant campaigns
          const initialCampaigns: Campaign[] = [];

          if (servicesData.success && Array.isArray(servicesData.services)) {
            const services = servicesData.services;

            // Father's Day Campaign
            initialCampaigns.push({
              id: 1,
              name: "Father's Day Gift Cards",
              subject: "The Perfect Gift for Dad: Clean Machine Gift Cards",
              content: "Father's Day is coming soon! Give dad what he really wants - a spotless, professionally detailed vehicle. Our gift cards are available now for any of our premium services including " + 
                services.slice(0, 3).map((s: any) => s.name).join(", ") + ".",
              scheduledDate: futureDate1.toISOString(),
              status: "scheduled",
              targetAudience: "all",
              recipientCount: 0,
              createdAt: now.toISOString()
            });

            // Summer service campaign
            const summerService = services.find((s: any) => 
              s.name.toLowerCase().includes("premium") || 
              s.name.toLowerCase().includes("full") ||
              s.name.toLowerCase().includes("deluxe")
            );

            if (summerService) {
              initialCampaigns.push({
                id: 2,
                name: "Summer Road Trip Package",
                subject: "Prepare Your Vehicle for Summer Adventures",
                content: `Planning a road trip? Let us get your car ready with our ${summerService.name}. Book now and ensure your vehicle is in perfect condition for your summer travels.`,
                scheduledDate: futureDate2.toISOString(),
                status: "draft",
                targetAudience: "all",
                recipientCount: 0,
                createdAt: now.toISOString()
              });
            }

            // Loyalty program campaign
            initialCampaigns.push({
              id: 3,
              name: "Loyalty Program Enrollment",
              subject: "Earn Rewards With Every Clean Machine Service",
              content: "Did you know you can earn loyalty points with every service? Join our loyalty program today and earn 1 point per dollar spent. Redeem your points for free services including Leather Protector, Engine Bay Cleaning, Maintenance Detail, and more!",
              scheduledDate: null,
              status: "draft",
              targetAudience: "all",
              recipientCount: 0,
              createdAt: now.toISOString()
            });
          }

          // Return the initial campaigns
          return initialCampaigns;
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error);

        // Return basic starter campaigns if API fails
        return [
          {
            id: 1,
            name: "Summer Special Promotion",
            subject: "Summer Special: 15% Off Premium Detailing",
            content: "Summer is here! Treat your vehicle to a premium detail service and save 15% when you book this month. Our premium detailing includes interior/exterior cleaning, polish, and protection treatments.",
            scheduledDate: null,
            status: "draft",
            targetAudience: "all",
            recipientCount: 0,
            createdAt: new Date().toISOString()
          }
        ];
      }
    }
  });

  // Fetch customers from the real database or Google Sheets
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['/api/customers-for-email'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/customers-for-email');
        const data = await response.json();

        if (data.success && Array.isArray(data.customers)) {
          return data.customers;
        } else {
          console.error("Invalid customer data format:", data);
          return [];
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    }
  });

  // Fetch email templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/email-templates'],
    queryFn: async () => {
      try {
        // For demo purposes, generating mock data until API is ready
        const mockTemplates: EmailTemplate[] = [
          {
            id: 1,
            name: "New Service Announcement",
            subject: "Introducing Our New [Service Name] Service",
            content: "We're excited to announce our new [Service Name] service! This premium offering includes [Service Details]. Book now to be among the first to experience it!",
            category: "promotional",
            lastUsed: "2025-04-15T10:00:00Z"
          },
          {
            id: 2,
            name: "Seasonal Offer",
            subject: "[Season] Special: Save on Premium Detailing",
            content: "Get your vehicle ready for [Season] with our special seasonal offer. Book any premium detailing package and save 15% through [End Date].",
            category: "promotional"
          },
          {
            id: 3,
            name: "Service Reminder",
            subject: "Time for Your Regular Detail Service",
            content: "It's been [Time Period] since your last detailing service. Keep your vehicle looking its best with our [Recommended Service] package.",
            category: "transactional"
          }
        ];
        return mockTemplates;
      } catch (error) {
        console.error("Error fetching templates:", error);
        return [];
      }
    }
  });

  // Create or update campaign mutation
  const createUpdateCampaignMutation = useMutation({
    mutationFn: async (campaign: any) => {
      setIsSendingCampaign(true);
      // Simulate API request
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsSendingCampaign(false);
      return { success: true, campaign: { ...campaign, id: campaign.id || Date.now() } };
    },
    onSuccess: (data) => {
      toast({
        title: `Campaign ${editMode === 'create' ? 'created' : 'updated'} successfully`,
        description: `${newCampaign.name} has been ${editMode === 'create' ? 'created' : 'updated'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
      resetCampaignForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editMode === 'create' ? 'create' : 'update'} campaign. Please try again.`,
        variant: "destructive"
      });
      setIsSendingCampaign(false);
    }
  });

  // AI generate email content mutation
  const generateEmailContentMutation = useMutation({
    mutationFn: async (data: { prompt: string, template?: string }) => {
      setIsGenerating(true);
      try {
        const response = await apiRequest('/api/generate-email-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: data.prompt,
            template: data.template || ''
          }),
        });
        return response;
      } catch (error) {
        console.error("Error generating email content:", error);
        // For demo purposes, generate something even if API fails
        await new Promise(resolve => setTimeout(resolve, 2000));

        let subject = "Your Vehicle Deserves the Best: Special Offer Inside";
        let content = "Dear valued customer,\n\nYour vehicle deserves the highest quality care, and we're here to provide it. For a limited time, we're offering 15% off our premium detailing package.\n\nBook now to transform your vehicle and experience the Clean Machine difference.\n\nBest regards,\nThe Clean Machine Team";

        if (data.prompt.toLowerCase().includes("father")) {
          subject = "Give Dad What He Really Wants: A Clean Machine Gift Card";
          content = "Dear valued customer,\n\nFather's Day is approaching, and what better gift than a spotless, professionally detailed vehicle?\n\nOur gift cards are the perfect present for the dad who takes pride in his ride. Purchase online or in-store and get a complimentary air freshener with every gift card.\n\nBest regards,\nThe Clean Machine Team";
        } else if (data.prompt.toLowerCase().includes("mother")) {
          subject = "Show Mom Some Love with a Clean Machine Gift Card";
          content = "Dear valued customer,\n\nMother's Day is almost here! Treat the special mom in your life to our premium detailing service.\n\nOur gift cards make the perfect gift, and we'll add a complimentary interior sanitization with every Mother's Day gift card purchase.\n\nBest regards,\nThe Clean Machine Team";
        } else if (data.prompt.toLowerCase().includes("holiday") || data.prompt.toLowerCase().includes("christmas")) {
          subject = "Unwrap the Gift of a Clean Vehicle This Holiday Season";
          content = "Dear valued customer,\n\nThe holidays are here, and our gift cards make the perfect present for anyone with a vehicle!\n\nGive the gift of a pristine, professionally detailed car. Purchase a holiday gift card today and receive a bonus $10 add-on service voucher.\n\nHappy Holidays!\nThe Clean Machine Team";
        }

        return { success: true, data: { subject, content } };
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        setGeneratedEmail({
          subject: response.data.subject,
          content: response.data.content
        });

        // Auto-populate the campaign form with generated content
        setNewCampaign(prev => ({
          ...prev,
          subject: response.data.subject,
          content: response.data.content
        }));

        toast({
          title: "Email content generated",
          description: "AI-generated content ready to use in your campaign.",
        });
      } else {
        toast({
          title: "Generation failed",
          description: "Unable to generate content. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate email content. Please try again.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  });

  const filteredCampaigns = campaigns.filter(campaign => {
    if (campaignFilter === 'all') return true;
    return campaign.status === campaignFilter;
  });

  const subscriptionCount = customers.filter(c => !c.unsubscribed).length;
  const unsubscribedCount = customers.filter(c => c.unsubscribed).length;

  const handleCreateCampaign = () => {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.content) {
      toast({
        title: "Missing information",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    const campaignData = {
      ...newCampaign,
      id: campaignToEdit?.id,
      scheduledDate: newCampaign.scheduledDate ? format(newCampaign.scheduledDate, 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'') : null,
      status: newCampaign.scheduledDate ? 'scheduled' : 'draft',
      recipientCount: getRecipientCount(newCampaign.targetAudience)
    };

    createUpdateCampaignMutation.mutate(campaignData);
  };

  const handleGenerateContent = () => {
    if (!aiPrompt && !selectedHolidayTemplate) {
      toast({
        title: "Missing information",
        description: "Please enter a prompt or select a template",
        variant: "destructive"
      });
      return;
    }

    // Create a richer prompt based on design preferences
    let enrichedPrompt = selectedHolidayTemplate 
      ? `Create an email marketing campaign for ${selectedHolidayTemplate.name} to promote automotive detailing gift cards. The email should emphasize the holiday as a perfect opportunity to give the gift of a clean vehicle. Use compelling language that encourages immediate purchase.`
      : aiPrompt;

    // Add design styling instructions based on selected options
    if (newCampaign.designStyle) {
      enrichedPrompt += ` Format the email with a ${newCampaign.designStyle} design style - `;

      if (newCampaign.designStyle === 'professional') {
        enrichedPrompt += 'clean, business-appropriate with a formal tone that emphasizes our professional detailing expertise.';
      } else if (newCampaign.designStyle === 'vibrant') {
        enrichedPrompt += 'energetic, colorful with an enthusiastic tone that highlights the transformation we deliver.';
      } else if (newCampaign.designStyle === 'elegant') {
        enrichedPrompt += 'sophisticated, premium feel with refined language that appeals to luxury vehicle owners.';
      }
    }

    // Add layout instructions if chosen
    if (newCampaign.layoutStyle) {
      enrichedPrompt += ` Structure the content for a ${newCampaign.layoutStyle} layout with appropriate sections.`;
    }

    // Add Clean Machine branding instruction
    enrichedPrompt += " Always include Clean Machine Auto Detail branding and our focus on professional quality service.";

    // Generate the email content with the enhanced prompt
    generateEmailContentMutation.mutate({ 
      prompt: enrichedPrompt,
      template: selectedTemplate?.name
    });
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setCampaignToEdit(campaign);
    setEditMode('edit');
    setNewCampaign({
      name: campaign.name,
      subject: campaign.subject,
      content: campaign.content,
      scheduledDate: campaign.scheduledDate ? new Date(campaign.scheduledDate) : null,
      targetAudience: campaign.targetAudience,
      // Preserve any existing design/layout styles
      designStyle: campaign.designStyle as any,
      layoutStyle: campaign.layoutStyle as any
    });
  };

  // Handle sending a campaign immediately
  const handleSendCampaign = async (campaignId: number) => {
    try {
      const response = await fetch(`/api/email-campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: "Campaign sent",
            description: "Your campaign has been sent successfully.",
          });
          // Refresh campaign list
          queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
        } else {
          throw new Error(data.message || "Failed to send campaign");
        }
      } else {
        throw new Error("API error: " + response.status);
      }
    } catch (error) {
      console.error("Error sending campaign:", error);
      toast({
        title: "Error",
        description: "Failed to send campaign. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle cancelling a scheduled campaign
  const handleCancelCampaign = async (campaignId: number) => {
    try {
      const response = await fetch(`/api/email-campaigns/${campaignId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: "Campaign cancelled",
            description: "Your scheduled campaign has been cancelled.",
          });
          // Refresh campaign list
          queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
        } else {
          throw new Error(data.message || "Failed to cancel campaign");
        }
      } else {
        throw new Error("API error: " + response.status);
      }
    } catch (error) {
      console.error("Error cancelling campaign:", error);
      toast({
        title: "Error",
        description: "Failed to cancel campaign. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTemplateSelection = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateDialog(false);

    // Apply template to current campaign
    setNewCampaign(prev => ({
      ...prev,
      subject: template.subject,
      content: template.content
    }));

    toast({
      title: "Template applied",
      description: `"${template.name}" template has been applied to your campaign.`
    });
  };

  const handleHolidayTemplateSelection = (template: HolidayTemplate) => {
    setSelectedHolidayTemplate(template);
    setShowAIDialog(true);

    // Apply suggested content to AI form
    setAiPrompt(`Create an email campaign for ${template.name} to promote automotive detailing gift cards.`);

    // Also pre-populate the email form
    setNewCampaign(prev => ({
      ...prev,
      name: `${template.name} Campaign`,
      subject: template.suggestedSubject,
      content: template.suggestedContent
    }));
  };

  const getRecipientCount = (audience: string): number => {
    const total = customers.filter(c => !c.unsubscribed).length;

    switch (audience) {
      case 'all':
        return total;
      case 'repeat_customers':
        return Math.floor(total * 0.6); // 60% of all customers for demo
      case 'new_customers':
        return Math.floor(total * 0.3); // 30% of all customers for demo
      case 'premium_customers':
        return Math.floor(total * 0.2); // 20% of all customers for demo
      default:
        return total;
    }
  };

  const resetCampaignForm = () => {
    setCampaignToEdit(null);
    setEditMode('create');
    setNewCampaign({
      name: '',
      subject: '',
      content: '',
      scheduledDate: null,
      targetAudience: 'all'
    });
    setSelectedTemplate(null);
    setSelectedHolidayTemplate(null);
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'scheduled': return 'bg-blue-200 text-blue-800';
      case 'sent': return 'bg-green-200 text-green-800';
      case 'cancelled': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <TabsContent value="email-campaigns" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 mb-6 pb-4 border-b border-blue-100">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-blue-800">Email Marketing Hub</h2>
          <p className="text-gray-600 mt-1">Create, manage, and send emails to your customer base</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-blue-50 p-1 rounded-lg flex items-center">
            <Button
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'default' : 'outline'}
              className={viewMode === 'list' ? 'bg-blue-600' : 'bg-transparent text-blue-800 hover:text-blue-900 hover:bg-blue-100'}
              size="sm"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              List
            </Button>
            <Button
              onClick={() => setViewMode('calendar')}
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              className={viewMode === 'calendar' ? 'bg-blue-600' : 'bg-transparent text-blue-800 hover:text-blue-900 hover:bg-blue-100'}
              size="sm"
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              Calendar
            </Button>
          </div>
          <Button 
            onClick={() => {
              setEditMode('create');
              setCampaignToEdit(null);
              setNewCampaign({
                name: '',
                subject: '',
                content: '',
                scheduledDate: null,
                targetAudience: 'all'
              });
            }}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
          >
            <MailPlus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dashboard stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Audience Overview</CardTitle>
            <CardDescription>Manage your email audience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Subscribers</span>
              <span className="font-bold text-green-600">{subscriptionCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Unsubscribed</span>
              <span className="font-bold text-red-600">{unsubscribedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average Open Rate</span>
              <span className="font-bold">38.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average Click Rate</span>
              <span className="font-bold">12.5%</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Manage Audience
            </Button>
          </CardFooter>
        </Card>

        {/* Quick campaign creator */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Create New Campaign</CardTitle>
                <CardDescription>Craft your email campaign</CardDescription>
              </div>
              <Button 
                onClick={() => setShowWizardDialog(true)} 
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
              >
                <Wand2 className="h-5 w-5 mr-2" />
                One-Click Template Wizard
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input 
                  id="campaign-name" 
                  placeholder="Summer Special Offer" 
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="campaign-subject">Email Subject</Label>
                <Input 
                  id="campaign-subject" 
                  placeholder="Get Your Car Summer-Ready!" 
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({...newCampaign, subject: e.target.value})}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="campaign-content">Email Content</Label>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setShowTemplateDialog(true)} 
                      size="sm" 
                      variant="outline"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Templates
                    </Button>
                    <Button 
                      onClick={() => setShowAIDialog(true)} 
                      size="sm" 
                      className="bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600"
                    >
                      <Zap className="h-4 w-4 mr-2 text-amber-300" />
                      AI Email Designer
                    </Button>
                    <Button 
                      onClick={() => setShowWizardDialog(true)} 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      Template Wizard
                    </Button>
                  </div>
                </div>
                <Textarea 
                  id="campaign-content" 
                  placeholder="Enter your email content here..."
                  className="min-h-[200px]"
                  value={newCampaign.content}
                  onChange={(e) => setNewCampaign({...newCampaign, content: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Schedule Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newCampaign.scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newCampaign.scheduledDate ? (
                          format(newCampaign.scheduledDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newCampaign.scheduledDate || undefined}
                        onSelect={(date) => setNewCampaign({...newCampaign, scheduledDate: date})}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Select
                    value={newCampaign.targetAudience}
                    onValueChange={(value) => setNewCampaign({...newCampaign, targetAudience: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers ({getRecipientCount('all')})</SelectItem>
                      <SelectItem value="repeat_customers">Repeat Customers ({getRecipientCount('repeat_customers')})</SelectItem>
                      <SelectItem value="new_customers">New Customers ({getRecipientCount('new_customers')})</SelectItem>
                      <SelectItem value="premium_customers">Premium Customers ({getRecipientCount('premium_customers')})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={resetCampaignForm}
            >
              Reset
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  createUpdateCampaignMutation.mutate({
                    ...newCampaign,
                    id: campaignToEdit?.id,
                    status: 'draft',
                    recipientCount: getRecipientCount(newCampaign.targetAudience)
                  });
                }}
                disabled={isSendingCampaign || !newCampaign.name || !newCampaign.subject}
              >
                Save as Draft
              </Button>
              <Button 
                onClick={handleCreateCampaign} 
                disabled={isSendingCampaign || !newCampaign.name || !newCampaign.subject || !newCampaign.content}
              >
                {isSendingCampaign ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {newCampaign.scheduledDate ? 'Schedule' : 'Save'} Campaign
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Campaign list or calendar view */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Campaign Manager</CardTitle>
              <CardDescription>View and manage all your email campaigns</CardDescription>
            </div>

            <div className="flex gap-2">
              <Select
                value={campaignFilter}
                onValueChange={(value: any) => setCampaignFilter(value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white border-none shadow-sm"
              >
                <span className="mr-2">🎁</span>
                Holiday Campaigns
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.length > 0 ? (
                  filteredCampaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors">
                      <TableCell>
                        <div className="font-medium flex items-center text-gray-900 dark:text-gray-100">
                          {campaign.status === 'draft' && <span className="text-blue-500 dark:text-blue-400 mr-2">📝</span>}
                          {campaign.status === 'scheduled' && <span className="text-purple-500 dark:text-purple-400 mr-2">🗓️</span>}
                          {campaign.status === 'sent' && <span className="text-green-500 dark:text-green-400 mr-2">✉️</span>}
                          {campaign.status === 'cancelled' && <span className="text-gray-400 dark:text-gray-500 mr-2">❌</span>}
                          {campaign.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 ml-6">{campaign.subject}</div>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </div>
                        {campaign.status === 'sent' && (
                          <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-1.5 rounded">
                            <div className="flex items-center">
                              <span className="text-green-500 mr-1">📈</span>
                              <span>Open rate: <span className="font-medium">{campaign.openRate}%</span></span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-blue-500 mr-1">🔗</span>
                              <span>Click rate: <span className="font-medium">{campaign.clickRate}%</span></span>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full w-fit">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{campaign.recipientCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {campaign.scheduledDate ? (
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 text-purple-500 mr-2" />
                            <span>{format(new Date(campaign.scheduledDate), 'MMM d, yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditCampaign(campaign)}
                            className="bg-white hover:bg-blue-50 border-blue-200"
                          >
                            <Edit className="h-4 w-4 text-blue-500" />
                          </Button>
                          {campaign.status === 'draft' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="bg-white hover:bg-green-50 border-green-200"
                              onClick={() => handleSendCampaign(campaign.id)}
                            >
                              <Send className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          {campaign.status === 'scheduled' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="bg-white hover:bg-red-50 border-red-200"
                              onClick={() => handleCancelCampaign(campaign.id)}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          {campaign.status === 'sent' && (
                            <Button size="sm" variant="outline">
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No campaigns found. Create your first campaign!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Calendar view is coming soon. Switch to list view to manage campaigns.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holiday Campaign Quick Creator */}
      <Card>
        <CardHeader>
          <CardTitle>Holiday & Seasonal Campaigns</CardTitle>
          <CardDescription>Quickly create themed campaigns for holidays and special occasions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {holidayTemplates.filter(t => t.type === 'holiday').map(template => (
              <Card key={template.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleHolidayTemplateSelection(template)}>
                <div className="bg-blue-600 py-2 px-4 text-white font-semibold">
                  <Gift className="h-4 w-4 inline mr-2" />
                  {template.name}
                </div>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">{template.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{template.dateInfo}</p>
                </CardContent>
                <CardFooter className="pt-0 pb-2">
                  <Button variant="outline" size="sm" className="w-full">
                    <Zap className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Seasonal Campaigns</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {holidayTemplates.filter(t => t.type === 'seasonal').map(template => (
                <Card key={template.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleHolidayTemplateSelection(template)}>
                  <div className="bg-green-600 py-2 px-4 text-white font-semibold">
                    {template.name}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">{template.description}</p>
                  </CardContent>
                  <CardFooter className="pt-0 pb-2">
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      Use Template
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email template dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email Templates</DialogTitle>
            <DialogDescription>Choose a template for your campaign</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
            {templates.map(template => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTemplateSelection(template)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-md">{template.name}</CardTitle>
                  <CardDescription className="text-xs">Category: {template.category}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="text-sm font-medium">Subject: {template.subject}</div>
                  <div className="text-sm mt-2 line-clamp-3">{template.content}</div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button size="sm" variant="ghost">
                    <Copy className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Email Designer dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-800 flex items-center">
              <span className="text-amber-500 mr-2">⚡</span>
              AI Email Designer
            </DialogTitle>
            <DialogDescription>
              Create professionally designed email campaigns with AI assistance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Tabs defaultValue="custom" className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-blue-50">
                <TabsTrigger value="custom" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <span className="mr-2">💬</span>
                  Custom Message
                </TabsTrigger>
                <TabsTrigger value="templates" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <span className="mr-2">🎁</span>
                  Holiday Templates
                </TabsTrigger>
                <TabsTrigger value="styles" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <span className="mr-2">✓</span>
                  Style Options
                </TabsTrigger>
              </TabsList>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <div>
                  <div className="flex items-center">
                    <div className="rounded-full bg-gradient-to-r from-blue-600 to-blue-400 w-7 h-7 flex items-center justify-center text-white font-semibold mr-2">1</div>
                    <Label htmlFor="ai-prompt" className="text-lg font-medium">What would you like to promote?</Label>
                  </div>
                  <Textarea 
                    id="ai-prompt"
                    placeholder="e.g., Write an email promoting our summer detail package with 15% discount for returning customers that emphasizes our professional service quality and convenient booking process."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="min-h-[120px] mt-2"
                  />
                  <div className="mt-2 flex items-start">
                    <div className="bg-blue-50 p-2 rounded-md mr-2">
                      <span className="text-amber-500 text-lg">⚡</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Be specific about your offer, timing, and customer benefits. Include any special conditions or deadlines to create urgency.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {holidayTemplates.map(template => (
                    <Card 
                      key={template.id}
                      className={`cursor-pointer hover:shadow-md transition-all ${selectedHolidayTemplate?.id === template.id 
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-md' 
                        : 'hover:border-blue-200'}`}
                      onClick={() => handleHolidayTemplateSelection(template)}
                    >
                      <CardHeader className={`pb-2 ${selectedHolidayTemplate?.id === template.id ? 'bg-blue-50' : ''}`}>
                        <CardTitle className="text-base font-medium flex items-center text-blue-800">
                          {template.type === 'holiday' && <span className="mr-2 text-red-500">🎁</span>}
                          {template.type === 'seasonal' && <span className="mr-2 text-green-500">📅</span>}
                          {template.type === 'occasion' && <span className="mr-2 text-amber-500">✓</span>}
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-xs">{template.dateInfo}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <p>{template.description}</p>
                        {selectedHolidayTemplate?.id === template.id && (
                          <div className="mt-2 pt-2 border-t border-blue-100">
                            <p className="font-medium text-xs text-blue-800">Preview:</p>
                            <p className="text-xs italic mt-1">"{template.suggestedSubject}"</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="styles" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 gap-4">
                  <Label className="text-lg font-medium flex items-center">
                    <div className="rounded-full bg-gradient-to-r from-blue-600 to-blue-400 w-7 h-7 flex items-center justify-center text-white font-semibold mr-2">2</div>
                    Choose your email style
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <Button 
                      variant="outline" 
                      className={`border-2 h-auto py-3 flex flex-col items-center ${newCampaign.designStyle === 'professional' ? 'border-blue-500 bg-blue-50' : ''}`}
                      onClick={() => setNewCampaign({...newCampaign, designStyle: 'professional'})}
                    >
                      <div className="rounded-full bg-blue-100 p-2 mb-2">
                        <span className="text-blue-700">✓</span>
                      </div>
                      <span className="font-medium">Professional</span>
                      <span className="text-xs text-gray-500 mt-1">Clean, corporate look</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className={`border-2 h-auto py-3 flex flex-col items-center ${newCampaign.designStyle === 'vibrant' ? 'border-blue-500 bg-blue-50' : ''}`}
                      onClick={() => setNewCampaign({...newCampaign, designStyle: 'vibrant'})}
                    >
                      <div className="rounded-full bg-amber-100 p-2 mb-2">
                        <span className="text-amber-700">⚡</span>
                      </div>
                      <span className="font-medium">Vibrant</span>
                      <span className="text-xs text-gray-500 mt-1">Bold colors & graphics</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className={`border-2 h-auto py-3 flex flex-col items-center ${newCampaign.designStyle === 'elegant' ? 'border-blue-500 bg-blue-50' : ''}`}
                      onClick={() => setNewCampaign({...newCampaign, designStyle: 'elegant'})}
                    >
                      <div className="rounded-full bg-gray-100 p-2 mb-2">
                        <span className="text-gray-700">🎁</span>
                      </div>
                      <span className="font-medium">Elegant</span>
                      <span className="text-xs text-gray-500 mt-1">Sophisticated & premium</span>
                    </Button>
                  </div>

                  <div className="mt-4">
                    <Label className="text-lg font-medium flex items-center">
                      <div className="rounded-full bg-gradient-to-r from-blue-600 to-blue-400 w-7 h-7 flex items-center justify-center text-white font-semibold mr-2">3</div>
                      Layout options
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <Button 
                        variant="outline" 
                        className={`border-2 h-auto py-3 flex items-center justify-between ${newCampaign.layoutStyle === 'image-top' ? 'border-blue-500 bg-blue-50' : ''}`}
                        onClick={() => setNewCampaign({...newCampaign, layoutStyle: 'image-top'})}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Image at Top</span>
                          <span className="text-xs text-gray-500 mt-1">Header image followed by content</span>
                        </div>
                        <div className="w-12 h-12 bg-gray-100 rounded flex flex-col">
                          <div className="h-4 bg-blue-200 w-full rounded-t"></div>
                          <div className="flex-1 p-1">
                            <div className="h-1 bg-gray-300 w-full mb-1 rounded-sm"></div>
                            <div className="h-1 bg-gray-300 w-4/5 rounded-sm"></div>
                          </div>
                        </div>
                      </Button>
                      <Button 
                        variant="outline" 
                        className={`border-2 h-auto py-3 flex items-center justify-between ${newCampaign.layoutStyle === 'side-by-side' ? 'border-blue-500 bg-blue-50' : ''}`}
                        onClick={() => setNewCampaign({...newCampaign, layoutStyle: 'side-by-side'})}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Side-by-Side</span>
                          <span className="text-xs text-gray-500 mt-1">Image and text columns</span>
                        </div>
                        <div className="w-12 h-12 bg-gray-100 rounded flex">
                          <div className="w-1/2 bg-blue-200 h-full rounded-l"></div>
                          <div className="w-1/2 p-1">
                            <div className="h-1 bg-gray-300 w-full mb-1 rounded-sm"></div>
                            <div className="h-1 bg-gray-300 w-4/5 rounded-sm"></div>
                          </div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {generatedEmail && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium flex items-center text-blue-800">
                  <span className="mr-2 text-green-500">✓</span>
                  Preview Your Email
                </h3>
                <div className="border rounded-md overflow-hidden bg-white shadow-md">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-white">
                    <p className="font-medium">Subject: {generatedEmail.subject}</p>
                  </div>
                  <div className="p-4">
                    <div className="whitespace-pre-wrap text-gray-700 bg-white p-3 rounded-md border">
                      {generatedEmail.content}
                    </div>
                    {newCampaign.designStyle && (
                      <div className="mt-4 text-sm text-center italic text-blue-500">
                        * Email will be styled using the "{newCampaign.designStyle}" design with {newCampaign.layoutStyle || 'default'} layout *
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (generatedEmail) {
                    setNewCampaign({
                      ...newCampaign,
                      subject: generatedEmail.subject,
                      content: generatedEmail.content
                    });
                    setShowAIDialog(false);
                    toast({
                      title: "Content applied",
                      description: "AI-generated content has been added to your campaign."
                    });
                  }
                }}
                disabled={!generatedEmail}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Use Content
              </Button>
              <Button 
                onClick={handleGenerateContent}
                disabled={isGenerating || (!aiPrompt && !selectedHolidayTemplate)}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Content
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Template Wizard Dialog */}
      <Dialog open={showWizardDialog} onOpenChange={setShowWizardDialog}>
        <DialogContent className="max-w-6xl w-full p-0">
          <EmailTemplateWizard 
            onSaveTemplate={(template) => {
              // Convert the EmailTemplateWizard template format to the campaign format
              const emailContent = template.sections.map(section => {
                if (section.type === 'header') {
                  return `# ${section.content}\n\n`;
                } else if (section.type === 'content') {
                  return `${section.content}\n\n`;
                } else if (section.type === 'button') {
                  return `[${section.settings?.buttonText || section.content}](${section.settings?.buttonLink || '#'})
`;
                } else if (section.type === 'footer') {
                  return `---\n${section.content}`;
                }
                return '';
              }).join('');

              // Update the campaign with the template content
              setNewCampaign({
                ...newCampaign,
                subject: template.subject,
                content: emailContent,
                // Add design and layout styles based on the template settings
                designStyle: template.settings.brandColor.includes('#10b981') ? 'fresh' as const : 
                            template.settings.brandColor.includes('#8b5cf6') ? 'elegant' as const : 
                            template.settings.brandColor.includes('#f97316') ? 'vibrant' as const : 
                            template.settings.brandColor.includes('#ef4444') ? 'bold' as const : 'professional' as const,
                layoutStyle: template.settings.containerWidth === '700px' ? 'wide' as const : 
                            template.settings.containerWidth === '500px' ? 'narrow' as const : 'standard' as const
              });

              toast({
                title: "Template applied",
                description: "Email template has been applied to your campaign.",
              });

              setShowWizardDialog(false);
            }}
            onCancel={() => setShowWizardDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
};

export { EmailCampaignsManager };