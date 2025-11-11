import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Wand2,
  Sparkles,
  Copy,
  CheckCircle,
  ChevronRight,
  Mail,
  Image,
  Settings,
  Users,
  Zap,
  MessageSquare,
  Palette,
  Layout,
  Trash2
} from 'lucide-react';

interface TemplateSection {
  id: string;
  type: 'header' | 'content' | 'image' | 'button' | 'footer';
  content: string;
  settings?: {
    align?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    padding?: string;
    imageUrl?: string;
    buttonLink?: string;
    buttonText?: string;
    buttonColor?: string;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preheader?: string;
  sections: TemplateSection[];
  settings: {
    brandColor: string;
    backgroundColor: string;
    fontFamily: string;
    containerWidth: string;
    includeUnsubscribe: boolean;
    includeSocialLinks: boolean;
  };
}

interface EmailTemplateWizardProps {
  onSaveTemplate: (template: EmailTemplate) => void;
  onCancel: () => void;
  initialTemplate?: EmailTemplate;
}

const DEFAULT_TEMPLATE: EmailTemplate = {
  id: `template-${Date.now()}`,
  name: 'New Template',
  subject: '',
  preheader: '',
  sections: [
    {
      id: 'header-1',
      type: 'header',
      content: 'Clean Machine Auto Detail',
      settings: {
        align: 'center',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        fontSize: '24px',
        padding: '20px'
      }
    },
    {
      id: 'content-1',
      type: 'content',
      content: 'Welcome to our newsletter. We provide premium auto detailing services to keep your vehicle looking its best.',
      settings: {
        align: 'left',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        fontSize: '16px',
        padding: '20px'
      }
    },
    {
      id: 'button-1',
      type: 'button',
      content: 'Book Now',
      settings: {
        align: 'center',
        backgroundColor: '#ffffff',
        buttonText: 'Book Now',
        buttonColor: '#3b82f6',
        buttonLink: 'https://cleanmachine.com/book',
        padding: '20px'
      }
    },
    {
      id: 'footer-1',
      type: 'footer',
      content: '© 2025 Clean Machine Auto Detail. All rights reserved.',
      settings: {
        align: 'center',
        backgroundColor: '#f8f9fa',
        textColor: '#6b7280',
        fontSize: '14px',
        padding: '20px'
      }
    }
  ],
  settings: {
    brandColor: '#3b82f6',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif',
    containerWidth: '600px',
    includeUnsubscribe: true,
    includeSocialLinks: true
  }
};

// Template preset options
const TEMPLATE_PRESETS = [
  {
    id: 'promotional',
    name: 'Promotional Offer',
    description: 'Highlight a special promotion or discount',
    preview: '💰 Special offer template'
  },
  {
    id: 'newsletter',
    name: 'Monthly Newsletter',
    description: 'Share news and updates with your customers',
    preview: '📰 Newsletter template'
  },
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Greet new customers and explain your services',
    preview: '👋 Welcome template'
  },
  {
    id: 'seasonal',
    name: 'Seasonal Special',
    description: 'Highlight seasonal services and tips',
    preview: '🌞 Seasonal template'
  },
  {
    id: 'appointment',
    name: 'Appointment Reminder',
    description: 'Remind customers of upcoming appointments',
    preview: '📅 Appointment template'
  },
  {
    id: 'loyalty',
    name: 'Loyalty Program',
    description: 'Promote your loyalty program and rewards',
    preview: '🏆 Loyalty template'
  }
];

// Color palette options
const COLOR_PALETTES = [
  {
    id: 'blue',
    name: 'Professional Blue',
    brandColor: '#3b82f6',
    backgroundColor: '#f8f9fa'
  },
  {
    id: 'green',
    name: 'Fresh Green',
    brandColor: '#10b981',
    backgroundColor: '#f0fdf4'
  },
  {
    id: 'purple',
    name: 'Elegant Purple',
    brandColor: '#8b5cf6',
    backgroundColor: '#f5f3ff'
  },
  {
    id: 'orange',
    name: 'Vibrant Orange',
    brandColor: '#f97316',
    backgroundColor: '#fff7ed'
  },
  {
    id: 'gray',
    name: 'Classic Gray',
    brandColor: '#4b5563',
    backgroundColor: '#f9fafb'
  },
  {
    id: 'red',
    name: 'Bold Red',
    brandColor: '#ef4444',
    backgroundColor: '#fef2f2'
  }
];

export const EmailTemplateWizard: React.FC<EmailTemplateWizardProps> = ({ 
  onSaveTemplate, 
  onCancel,
  initialTemplate 
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [template, setTemplate] = useState<EmailTemplate>(initialTemplate || DEFAULT_TEMPLATE);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Handle template preset selection
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    
    // Apply preset changes to the template
    let newTemplate = {...template};
    
    switch (presetId) {
      case 'promotional':
        newTemplate.name = 'Promotional Offer';
        newTemplate.subject = 'Special Offer Inside - Limited Time Only!';
        newTemplate.preheader = 'Exclusive deal for our valued customers';
        newTemplate.sections[0].content = 'EXCLUSIVE OFFER';
        newTemplate.sections[1].content = 'Take advantage of our limited-time promotion! Book any premium detailing service and receive 15% off your total bill. Our premium services include complete interior and exterior detailing with premium products for long-lasting protection.';
        newTemplate.sections[2].content = 'Book Now';
        newTemplate.sections[2].settings = {
          ...newTemplate.sections[2].settings,
          buttonText: 'Claim Your Discount',
          buttonColor: '#ef4444'
        };
        break;
        
      case 'newsletter':
        newTemplate.name = 'Monthly Newsletter';
        newTemplate.subject = 'Clean Machine Monthly: Tips & Updates';
        newTemplate.preheader = 'Your monthly auto care newsletter';
        newTemplate.sections[0].content = 'CLEAN MACHINE MONTHLY';
        newTemplate.sections[1].content = 'Welcome to our monthly newsletter! This month, we\'re sharing expert tips on maintaining your vehicle\'s finish during the summer months, introducing our new ceramic coating service, and highlighting our customer of the month.';
        newTemplate.sections[2].settings = {
          ...newTemplate.sections[2].settings,
          buttonText: 'Read More',
          buttonColor: '#3b82f6'
        };
        break;
        
      case 'welcome':
        newTemplate.name = 'Welcome Email';
        newTemplate.subject = 'Welcome to Clean Machine Auto Detail!';
        newTemplate.preheader = 'Thank you for choosing us';
        newTemplate.sections[0].content = 'WELCOME TO THE FAMILY';
        newTemplate.sections[1].content = 'Thank you for choosing Clean Machine Auto Detail! We\'re excited to have you as a customer. Our team is dedicated to providing exceptional service and ensuring your vehicle always looks its best. As a new customer, enjoy 10% off your first booking!';
        newTemplate.sections[2].settings = {
          ...newTemplate.sections[2].settings,
          buttonText: 'Book Your First Service',
          buttonColor: '#10b981'
        };
        break;
        
      // Add more presets as needed
        
      default:
        break;
    }
    
    setTemplate(newTemplate);
    
    toast({
      title: "Template preset applied",
      description: `Applied the ${TEMPLATE_PRESETS.find(p => p.id === presetId)?.name} preset.`,
    });
  };

  // Handle color palette selection
  const handlePaletteSelect = (paletteId: string) => {
    setSelectedPalette(paletteId);
    
    const palette = COLOR_PALETTES.find(p => p.id === paletteId);
    if (palette) {
      setTemplate({
        ...template,
        settings: {
          ...template.settings,
          brandColor: palette.brandColor,
          backgroundColor: palette.backgroundColor
        }
      });
      
      toast({
        title: "Color palette applied",
        description: `Applied the ${palette.name} color scheme.`,
      });
    }
  };

  // Handle adding a new section
  const handleAddSection = (type: TemplateSection['type']) => {
    const newSection: TemplateSection = {
      id: `${type}-${Date.now()}`,
      type,
      content: type === 'header' ? 'New Header' : 
               type === 'content' ? 'New content block. Replace with your own text.' : 
               type === 'button' ? 'Click Here' : 
               type === 'image' ? 'Image Description' : 'Footer Content',
      settings: {
        align: 'left',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        fontSize: type === 'header' ? '24px' : '16px',
        padding: '20px'
      }
    };
    
    if (type === 'button') {
      newSection.settings = {
        ...newSection.settings,
        buttonText: 'Click Here',
        buttonColor: template.settings.brandColor,
        buttonLink: '#'
      };
    }
    
    setTemplate({
      ...template,
      sections: [...template.sections, newSection]
    });
  };

  // Handle removing a section
  const handleRemoveSection = (sectionId: string) => {
    setTemplate({
      ...template,
      sections: template.sections.filter(section => section.id !== sectionId)
    });
  };

  // Handle updating a section
  const handleUpdateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setTemplate({
      ...template,
      sections: template.sections.map(section => 
        section.id === sectionId ? { ...section, ...updates } : section
      )
    });
  };

  // Handle saving the template
  const handleSaveTemplate = async () => {
    setIsLoading(true);
    try {
      // Save to Sendgrid or your backend here
      onSaveTemplate(template);
      toast({
        title: "Template saved",
        description: "Your email template has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate HTML preview of the template
  const generateTemplatePreview = () => {
    // This would generate the HTML code for the email template
    // For now, we'll just show a simplified representation
    return (
      <div
        className="mx-auto border rounded-md overflow-hidden shadow-sm"
        style={{
          backgroundColor: template.settings.backgroundColor,
          fontFamily: template.settings.fontFamily,
          width: previewMode === 'desktop' ? template.settings.containerWidth : '320px',
          maxWidth: '100%'
        }}
      >
        {template.sections.map((section) => (
          <div 
            key={section.id}
            className="relative border-b last:border-b-0 group hover:outline hover:outline-blue-500 hover:outline-2"
            style={{
              backgroundColor: section.settings?.backgroundColor,
              padding: section.settings?.padding,
              textAlign: section.settings?.align as any
            }}
          >
            {section.type === 'header' && (
              <h2 
                style={{
                  color: section.settings?.textColor,
                  fontSize: section.settings?.fontSize
                }}
                className="font-bold"
              >
                {section.content}
              </h2>
            )}
            
            {section.type === 'content' && (
              <p 
                style={{
                  color: section.settings?.textColor,
                  fontSize: section.settings?.fontSize
                }}
              >
                {section.content}
              </p>
            )}
            
            {section.type === 'button' && (
              <button
                className="px-6 py-2 rounded-md font-medium"
                style={{
                  backgroundColor: section.settings?.buttonColor,
                  color: '#ffffff'
                }}
              >
                {section.settings?.buttonText || section.content}
              </button>
            )}
            
            {section.type === 'image' && (
              <div className="text-center">
                {section.settings?.imageUrl ? (
                  <img 
                    src={section.settings.imageUrl} 
                    alt={section.content}
                    className="max-w-full"
                  />
                ) : (
                  <div className="bg-gray-200 py-8 text-gray-500 flex items-center justify-center">
                    <Image className="w-5 h-5 mr-2" />
                    Image Placeholder
                  </div>
                )}
              </div>
            )}
            
            {section.type === 'footer' && (
              <p 
                style={{
                  color: section.settings?.textColor,
                  fontSize: section.settings?.fontSize
                }}
                className="text-sm"
              >
                {section.content}
                {template.settings.includeUnsubscribe && (
                  <div className="text-xs mt-2 text-gray-500">
                    <a href="#" className="underline">Unsubscribe</a> | <a href="#" className="underline">View in browser</a>
                  </div>
                )}
                {template.settings.includeSocialLinks && (
                  <div className="mt-2 flex justify-center gap-4">
                    <span>FB</span>
                    <span>TW</span>
                    <span>IG</span>
                  </div>
                )}
              </p>
            )}
            
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0 bg-white"
                onClick={() => handleRemoveSection(section.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Wand2 className="h-6 w-6 mr-2 text-blue-500" />
          Email Template Wizard
        </CardTitle>
        <CardDescription>
          Create professional email templates in minutes with our step-by-step wizard
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="design" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="setup">
              <div className="flex items-center">
                <div className={`rounded-full h-6 w-6 flex items-center justify-center mr-2 ${currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>1</div>
                Setup
              </div>
            </TabsTrigger>
            <TabsTrigger value="design">
              <div className="flex items-center">
                <div className={`rounded-full h-6 w-6 flex items-center justify-center mr-2 ${currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>2</div>
                Design
              </div>
            </TabsTrigger>
            <TabsTrigger value="content">
              <div className="flex items-center">
                <div className={`rounded-full h-6 w-6 flex items-center justify-center mr-2 ${currentStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>3</div>
                Content
              </div>
            </TabsTrigger>
            <TabsTrigger value="preview">
              <div className="flex items-center">
                <div className={`rounded-full h-6 w-6 flex items-center justify-center mr-2 ${currentStep >= 4 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>4</div>
                Preview
              </div>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="setup" className="space-y-6">
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input 
                    id="template-name" 
                    value={template.name}
                    onChange={(e) => setTemplate({...template, name: e.target.value})}
                    placeholder="e.g. Monthly Newsletter" 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="template-subject">Email Subject Line</Label>
                  <Input 
                    id="template-subject" 
                    value={template.subject}
                    onChange={(e) => setTemplate({...template, subject: e.target.value})}
                    placeholder="e.g. May Newsletter: Special Summer Offers" 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="template-preheader">
                    Preheader Text <span className="text-xs text-gray-500">(optional)</span>
                  </Label>
                  <Input 
                    id="template-preheader" 
                    value={template.preheader || ''}
                    onChange={(e) => setTemplate({...template, preheader: e.target.value})}
                    placeholder="Brief text shown after the subject line in email clients" 
                  />
                  <p className="text-xs text-gray-500">
                    This text appears in the inbox preview after the subject line.
                  </p>
                </div>
              </div>
              
              <div className="pt-4">
                <h3 className="text-lg font-medium mb-4">Quick Start Templates</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Choose a template preset to get started quickly, or create your own from scratch.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {TEMPLATE_PRESETS.map((preset) => (
                    <Card 
                      key={preset.id}
                      className={`cursor-pointer hover:shadow transition-shadow ${
                        selectedPreset === preset.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => handlePresetSelect(preset.id)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-md">{preset.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-sm text-gray-500">{preset.description}</p>
                      </CardContent>
                      <CardFooter className="pt-0 text-xs text-gray-400">
                        {preset.preview}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center"
                >
                  Next: Design
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="design" className="space-y-6">
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-medium">Design Settings</h3>
              
              <div className="grid gap-4">
                <div>
                  <Label className="mb-2 block">Color Palette</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COLOR_PALETTES.map((palette) => (
                      <div
                        key={palette.id}
                        className={`border rounded-md p-2 cursor-pointer ${
                          selectedPalette === palette.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => handlePaletteSelect(palette.id)}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="h-4 w-4 rounded-full" 
                            style={{ backgroundColor: palette.brandColor }}
                          ></div>
                          <span className="text-sm font-medium">{palette.name}</span>
                        </div>
                        <div 
                          className="h-8 w-full rounded overflow-hidden flex"
                        >
                          <div 
                            className="w-1/3"
                            style={{ backgroundColor: palette.brandColor }}
                          ></div>
                          <div 
                            className="w-2/3"
                            style={{ backgroundColor: palette.backgroundColor }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="brand-color">Brand Color</Label>
                    <div className="flex gap-2">
                      <div 
                        className="h-10 w-10 rounded-md border"
                        style={{ backgroundColor: template.settings.brandColor }}
                      ></div>
                      <Input 
                        id="brand-color" 
                        value={template.settings.brandColor}
                        onChange={(e) => setTemplate({
                          ...template,
                          settings: {
                            ...template.settings,
                            brandColor: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="background-color">Background Color</Label>
                    <div className="flex gap-2">
                      <div 
                        className="h-10 w-10 rounded-md border"
                        style={{ backgroundColor: template.settings.backgroundColor }}
                      ></div>
                      <Input 
                        id="background-color" 
                        value={template.settings.backgroundColor}
                        onChange={(e) => setTemplate({
                          ...template,
                          settings: {
                            ...template.settings,
                            backgroundColor: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="font-family">Font Family</Label>
                    <Select
                      value={template.settings.fontFamily}
                      onValueChange={(value) => setTemplate({
                        ...template,
                        settings: {
                          ...template.settings,
                          fontFamily: value
                        }
                      })}
                    >
                      <SelectTrigger id="font-family">
                        <SelectValue placeholder="Select font family" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                        <SelectItem value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</SelectItem>
                        <SelectItem value="Georgia, serif">Georgia</SelectItem>
                        <SelectItem value="'Times New Roman', Times, serif">Times New Roman</SelectItem>
                        <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                        <SelectItem value="Tahoma, sans-serif">Tahoma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="container-width">Container Width</Label>
                    <Select
                      value={template.settings.containerWidth}
                      onValueChange={(value) => setTemplate({
                        ...template,
                        settings: {
                          ...template.settings,
                          containerWidth: value
                        }
                      })}
                    >
                      <SelectTrigger id="container-width">
                        <SelectValue placeholder="Select width" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500px">Narrow (500px)</SelectItem>
                        <SelectItem value="600px">Standard (600px)</SelectItem>
                        <SelectItem value="700px">Wide (700px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Footer Options</h4>
                  <div className="flex items-center gap-8">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="include-unsubscribe" 
                        checked={template.settings.includeUnsubscribe}
                        onCheckedChange={(checked) => setTemplate({
                          ...template,
                          settings: {
                            ...template.settings,
                            includeUnsubscribe: checked
                          }
                        })}
                      />
                      <Label htmlFor="include-unsubscribe">Include Unsubscribe Link</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="include-social" 
                        checked={template.settings.includeSocialLinks}
                        onCheckedChange={(checked) => setTemplate({
                          ...template,
                          settings: {
                            ...template.settings,
                            includeSocialLinks: checked
                          }
                        })}
                      />
                      <Label htmlFor="include-social">Include Social Media Links</Label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center"
                >
                  Next: Content
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="content" className="space-y-6">
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Email Content</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSection('header')}
                  >
                    Add Header
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSection('content')}
                  >
                    Add Text
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSection('image')}
                  >
                    Add Image
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSection('button')}
                  >
                    Add Button
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                {template.sections.map((section, index) => (
                  <Card key={section.id} className="border border-gray-200">
                    <CardHeader className="pb-2 bg-gray-50">
                      <CardTitle className="text-sm flex justify-between items-center">
                        <div className="flex items-center">
                          {section.type === 'header' && <h4 className="font-bold">Header Section</h4>}
                          {section.type === 'content' && <p>Text Content</p>}
                          {section.type === 'image' && <Image className="h-4 w-4 mr-2" />}
                          {section.type === 'button' && <button className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Button</button>}
                          {section.type === 'footer' && <p className="text-gray-500 text-xs">Footer Section</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveSection(section.id)}
                          className="h-8 w-8 p-0 text-gray-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {(section.type === 'header' || section.type === 'content' || section.type === 'footer') && (
                        <div className="grid gap-2">
                          <Label>Content</Label>
                          <Textarea
                            value={section.content}
                            onChange={(e) => handleUpdateSection(section.id, { content: e.target.value })}
                            rows={section.type === 'content' ? 4 : 2}
                          />
                        </div>
                      )}
                      
                      {section.type === 'button' && (
                        <div className="space-y-4">
                          <div className="grid gap-2">
                            <Label>Button Text</Label>
                            <Input
                              value={section.settings?.buttonText || section.content}
                              onChange={(e) => handleUpdateSection(section.id, { 
                                content: e.target.value,
                                settings: { ...section.settings, buttonText: e.target.value }
                              })}
                            />
                          </div>
                          
                          <div className="grid gap-2">
                            <Label>Button Link</Label>
                            <Input
                              value={section.settings?.buttonLink || ''}
                              onChange={(e) => handleUpdateSection(section.id, { 
                                settings: { ...section.settings, buttonLink: e.target.value }
                              })}
                              placeholder="https://example.com"
                            />
                          </div>
                          
                          <div className="grid gap-2">
                            <Label>Button Color</Label>
                            <div className="flex gap-2">
                              <div 
                                className="h-10 w-10 rounded-md border"
                                style={{ backgroundColor: section.settings?.buttonColor || template.settings.brandColor }}
                              ></div>
                              <Input
                                value={section.settings?.buttonColor || template.settings.brandColor}
                                onChange={(e) => handleUpdateSection(section.id, { 
                                  settings: { ...section.settings, buttonColor: e.target.value }
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {section.type === 'image' && (
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label>Image URL</Label>
                            <Input
                              value={section.settings?.imageUrl || ''}
                              onChange={(e) => handleUpdateSection(section.id, { 
                                settings: { ...section.settings, imageUrl: e.target.value }
                              })}
                              placeholder="https://example.com/image.jpg"
                            />
                          </div>
                          
                          <div className="grid gap-2">
                            <Label>Alt Text</Label>
                            <Input
                              value={section.content}
                              onChange={(e) => handleUpdateSection(section.id, { content: e.target.value })}
                              placeholder="Image description for accessibility"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 pt-4 border-t">
                        <details>
                          <summary className="text-sm font-medium cursor-pointer">
                            Appearance Settings
                          </summary>
                          <div className="mt-2 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                <Label>Alignment</Label>
                                <Select
                                  value={section.settings?.align || 'left'}
                                  onValueChange={(value) => handleUpdateSection(section.id, { 
                                    settings: { ...section.settings, align: value as any }
                                  })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select alignment" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {(section.type === 'header' || section.type === 'content' || section.type === 'footer') && (
                                <div className="grid gap-2">
                                  <Label>Font Size</Label>
                                  <Select
                                    value={section.settings?.fontSize || '16px'}
                                    onValueChange={(value) => handleUpdateSection(section.id, { 
                                      settings: { ...section.settings, fontSize: value }
                                    })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="12px">Small (12px)</SelectItem>
                                      <SelectItem value="16px">Normal (16px)</SelectItem>
                                      <SelectItem value="20px">Large (20px)</SelectItem>
                                      <SelectItem value="24px">X-Large (24px)</SelectItem>
                                      <SelectItem value="32px">XX-Large (32px)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="pt-4 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(4)}
                  className="flex items-center"
                >
                  Next: Preview
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-6">
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Preview Your Email</h3>
                <div className="flex bg-gray-100 rounded-md p-1">
                  <Button
                    variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('desktop')}
                    className="text-xs"
                  >
                    Desktop
                  </Button>
                  <Button
                    variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('mobile')}
                    className="text-xs"
                  >
                    Mobile
                  </Button>
                </div>
              </div>
              
              <div className="bg-gray-100 py-6 px-4 rounded-md">
                <div className="mb-4 bg-white rounded-md p-3 border max-w-xs mx-auto">
                  <div className="font-medium">Subject: {template.subject}</div>
                  {template.preheader && (
                    <div className="text-gray-500 text-sm truncate">{template.preheader}</div>
                  )}
                </div>
                
                {generateTemplatePreview()}
              </div>
              
              <div className="pt-4 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveTemplate}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isLoading ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Save Template
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};