import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HolidayAwarenessTable, defaultHolidays } from './HolidayAwareness';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Save,
  RotateCcw,
  MessageSquare,
  ThumbsUp,
  Brain,
  Calendar,
  Phone,
  MessageCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// Define all agent settings types
interface PersonalitySettings {
  professionalismLevel: number; // 1-5 scale
  friendliness: number; // 1-5 scale
  detailOrientation: number; // 1-5 scale
  humorLevel: number; // 1-5 scale
  enthusiasm: number; // 1-5 scale
}

interface BehaviorSettings {
  useCustomerName: boolean;
  askFollowUpQuestions: boolean;
  offerSuggestions: boolean;
  sendConfirmationMessages: boolean;
  proactiveServiceReminders: boolean;
  holidayGreetings: boolean;
}

interface LanguageSettings {
  formality: number; // 1-5 scale (casual to formal)
  technicalTerms: number; // 1-5 scale (simple to technical)
  messageLength: number; // 1-5 scale (concise to detailed)
  defaultLanguage: string;
  useEmojis: boolean;
}

interface MessagingSettings {
  smsOpeningMessage: string;
  websiteOpeningMessage: string;
  facebookOpeningMessage: string;
}

interface AgentSettingsProps {
  onSave?: (settings: any) => void;
}

export default function AgentSettings({ onSave }: AgentSettingsProps) {
  const { toast } = useToast();
  
  // Load agent preferences from backend
  const { data: preferencesData, isLoading } = useQuery({
    queryKey: ['/api/agent-preferences'],
  });
  
  const preferences = preferencesData?.preferences;
  
  // Initialize state - these will be populated from backend via useEffect
  const [personalitySettings, setPersonalitySettings] = useState<PersonalitySettings>({
    professionalismLevel: 4,
    friendliness: 4,
    detailOrientation: 3,
    humorLevel: 2,
    enthusiasm: 3,
  });

  const [behaviorSettings, setBehaviorSettings] = useState<BehaviorSettings>({
    useCustomerName: true,
    askFollowUpQuestions: true,
    offerSuggestions: true,
    sendConfirmationMessages: true,
    proactiveServiceReminders: true,
    holidayGreetings: true,
  });

  const [languageSettings, setLanguageSettings] = useState<LanguageSettings>({
    formality: 3,
    technicalTerms: 2,
    messageLength: 3,
    defaultLanguage: 'en', // Match backend schema (2-letter language code)
    useEmojis: true,
  });

  const [holidays, setHolidays] = useState(defaultHolidays);

  const [messagingSettings, setMessagingSettings] = useState<MessagingSettings>({
    smsOpeningMessage: "Hi! Thanks for reaching out to Clean Machine Auto Detail. How can I help you today?",
    websiteOpeningMessage: "Welcome to Clean Machine! I'm here to help you schedule a detailing appointment or answer any questions.",
    facebookOpeningMessage: "Hey there! Thanks for messaging Clean Machine. What can I do for you?",
  });
  
  // Load preferences from backend when available
  useEffect(() => {
    if (preferences) {
      setPersonalitySettings({
        professionalismLevel: preferences.professionalismLevel || 4,
        friendliness: preferences.friendliness || 4,
        detailOrientation: preferences.detailOrientation || 3,
        humorLevel: preferences.humorLevel || 2,
        enthusiasm: preferences.enthusiasm || 3,
      });
      
      setBehaviorSettings({
        useCustomerName: preferences.useCustomerName ?? true,
        askFollowUpQuestions: preferences.askFollowUpQuestions ?? true,
        offerSuggestions: preferences.offerSuggestions ?? true,
        sendConfirmationMessages: preferences.sendConfirmationMessages ?? true,
        proactiveServiceReminders: preferences.proactiveServiceReminders ?? true,
        holidayGreetings: preferences.holidayGreetings ?? true,
      });
      
      setLanguageSettings({
        formality: preferences.formality || 3,
        technicalTerms: preferences.technicalTerms || 2,
        messageLength: preferences.messageLength || 3,
        defaultLanguage: preferences.defaultLanguage || 'en',
        useEmojis: preferences.useEmojis ?? true,
      });
      
      setMessagingSettings({
        smsOpeningMessage: preferences.smsOpeningMessage || "Hi! Thanks for reaching out to Clean Machine Auto Detail. How can I help you today?",
        websiteOpeningMessage: preferences.websiteOpeningMessage || "Welcome to Clean Machine! I'm here to help you schedule a detailing appointment or answer any questions.",
        facebookOpeningMessage: preferences.facebookOpeningMessage || "Hey there! Thanks for messaging Clean Machine. What can I do for you?",
      });
      
      if (preferences.knownHolidays && Array.isArray(preferences.knownHolidays)) {
        setHolidays(preferences.knownHolidays);
      }
    }
  }, [preferences]);
  
  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', '/api/agent-preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-preferences'] });
      toast({
        title: 'Settings Saved',
        description: 'Your agent preferences have been updated successfully.',
      });
      if (onSave) {
        onSave({ personality: personalitySettings, behavior: behaviorSettings, language: languageSettings, messaging: messagingSettings, holidays });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save agent preferences. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Reset all settings to default
  const handleReset = () => {
    setPersonalitySettings({
      professionalismLevel: 4,
      friendliness: 4,
      detailOrientation: 3,
      humorLevel: 2,
      enthusiasm: 3,
    });
    
    setBehaviorSettings({
      useCustomerName: true,
      askFollowUpQuestions: true,
      offerSuggestions: true,
      sendConfirmationMessages: true,
      proactiveServiceReminders: true,
      holidayGreetings: true,
    });
    
    setLanguageSettings({
      formality: 3,
      technicalTerms: 2,
      messageLength: 3,
      defaultLanguage: 'en', // Match backend schema (2-letter language code)
      useEmojis: true,
    });
    
    setHolidays(defaultHolidays);

    setMessagingSettings({
      smsOpeningMessage: "Hi! Thanks for reaching out to Clean Machine Auto Detail. How can I help you today?",
      websiteOpeningMessage: "Welcome to Clean Machine! I'm here to help you schedule a detailing appointment or answer any questions.",
      facebookOpeningMessage: "Hey there! Thanks for messaging Clean Machine. What can I do for you?",
    });
  };
  
  // Handle holiday toggle
  const handleHolidayToggle = (index: number) => {
    const newHolidays = [...holidays];
    newHolidays[index].enabled = !newHolidays[index].enabled;
    setHolidays(newHolidays);
  };
  
  // Handle holiday greeting update
  const handleGreetingUpdate = (index: number, greeting: string) => {
    const newHolidays = [...holidays];
    newHolidays[index].greeting = greeting;
    setHolidays(newHolidays);
  };
  
  // Handle save all settings
  const handleSave = () => {
    const saveData = {
      professionalismLevel: personalitySettings.professionalismLevel,
      friendliness: personalitySettings.friendliness,
      detailOrientation: personalitySettings.detailOrientation,
      humorLevel: personalitySettings.humorLevel,
      enthusiasm: personalitySettings.enthusiasm,
      useCustomerName: behaviorSettings.useCustomerName,
      askFollowUpQuestions: behaviorSettings.askFollowUpQuestions,
      offerSuggestions: behaviorSettings.offerSuggestions,
      sendConfirmationMessages: behaviorSettings.sendConfirmationMessages,
      proactiveServiceReminders: behaviorSettings.proactiveServiceReminders,
      holidayGreetings: behaviorSettings.holidayGreetings,
      formality: languageSettings.formality,
      technicalTerms: languageSettings.technicalTerms,
      messageLength: languageSettings.messageLength,
      defaultLanguage: languageSettings.defaultLanguage,
      useEmojis: languageSettings.useEmojis,
      smsOpeningMessage: messagingSettings.smsOpeningMessage,
      websiteOpeningMessage: messagingSettings.websiteOpeningMessage,
      facebookOpeningMessage: messagingSettings.facebookOpeningMessage,
      knownHolidays: holidays,
    };
    
    saveMutation.mutate(saveData);
  };
  
  // Format slider labels based on value
  const getSliderLabel = (type: string, value: number): string => {
    switch(type) {
      case 'professionalism':
        return ['Very Casual', 'Casual', 'Balanced', 'Professional', 'Very Professional'][value-1];
      case 'friendliness':
        return ['Neutral', 'Friendly', 'Warm', 'Very Friendly', 'Extremely Friendly'][value-1];
      case 'detailOrientation':
        return ['Minimal Detail', 'Basic Detail', 'Moderate Detail', 'Detailed', 'Very Detailed'][value-1];
      case 'humor':
        return ['No Humor', 'Subtle Humor', 'Moderate Humor', 'Playful', 'Very Humorous'][value-1];
      case 'enthusiasm':
        return ['Subdued', 'Calm', 'Balanced', 'Enthusiastic', 'Very Enthusiastic'][value-1];
      case 'formality':
        return ['Very Casual', 'Casual', 'Neutral', 'Formal', 'Very Formal'][value-1];
      case 'technicalTerms':
        return ['Simple Language', 'Basic Terms', 'Moderate Terms', 'Technical', 'Very Technical'][value-1];
      case 'messageLength':
        return ['Very Concise', 'Concise', 'Moderate', 'Detailed', 'Very Detailed'][value-1];
      default:
        return value.toString();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Agent Settings</h2>
          <p className="text-blue-200">Customize how your AI agent interacts with customers</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="personality" className="w-full">
        <TabsList className="bg-blue-900/20 border border-blue-800/30 p-1">
          <TabsTrigger value="personality" className="data-[state=active]:bg-blue-600">
            <Brain className="mr-2 h-4 w-4" />
            Personality
          </TabsTrigger>
          <TabsTrigger value="behavior" className="data-[state=active]:bg-blue-600">
            <ThumbsUp className="mr-2 h-4 w-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="language" className="data-[state=active]:bg-blue-600">
            <MessageSquare className="mr-2 h-4 w-4" />
            Language
          </TabsTrigger>
          <TabsTrigger value="messaging" className="data-[state=active]:bg-blue-600">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messaging
          </TabsTrigger>
          <TabsTrigger value="holidays" className="data-[state=active]:bg-blue-600">
            <Calendar className="mr-2 h-4 w-4" />
            Holiday Awareness
          </TabsTrigger>
        </TabsList>
        
        {/* Personality Tab */}
        <TabsContent value="personality">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-500/20 shadow-lg">
            <CardHeader>
              <CardTitle>Personality Settings</CardTitle>
              <CardDescription className="text-blue-200">
                Adjust how your agent's personality comes across in communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Professionalism Level */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Professionalism Level</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('professionalism', personalitySettings.professionalismLevel)}
                  </span>
                </div>
                <Slider
                  value={[personalitySettings.professionalismLevel]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setPersonalitySettings({...personalitySettings, professionalismLevel: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">Adjust how professionally the agent presents information to customers</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Friendliness */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Friendliness</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('friendliness', personalitySettings.friendliness)}
                  </span>
                </div>
                <Slider
                  value={[personalitySettings.friendliness]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setPersonalitySettings({...personalitySettings, friendliness: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">Controls how warm and friendly the agent's tone will be</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Detail Orientation */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Detail Orientation</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('detailOrientation', personalitySettings.detailOrientation)}
                  </span>
                </div>
                <Slider
                  value={[personalitySettings.detailOrientation]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setPersonalitySettings({...personalitySettings, detailOrientation: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">How detailed the agent will be when explaining services</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Humor Level */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Humor Level</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('humor', personalitySettings.humorLevel)}
                  </span>
                </div>
                <Slider
                  value={[personalitySettings.humorLevel]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setPersonalitySettings({...personalitySettings, humorLevel: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">How much light humor the agent will include in responses</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Enthusiasm */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Enthusiasm</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('enthusiasm', personalitySettings.enthusiasm)}
                  </span>
                </div>
                <Slider
                  value={[personalitySettings.enthusiasm]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setPersonalitySettings({...personalitySettings, enthusiasm: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">How enthusiastic the agent will be when speaking about services</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Behavior Tab */}
        <TabsContent value="behavior">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-500/20 shadow-lg">
            <CardHeader>
              <CardTitle>Behavior Settings</CardTitle>
              <CardDescription className="text-blue-200">
                Control how the agent interacts with customers. The AI automatically keeps conversations focused on auto detailing topics and steers discussions back to Clean Machine services when needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Use Customer Name */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Use Customer Names</Label>
                    <p className="text-xs text-blue-200 mt-1">Agent will personalize messages with customer's name</p>
                  </div>
                  <Switch 
                    checked={behaviorSettings.useCustomerName}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, useCustomerName: checked})}
                  />
                </div>
                
                {/* Ask Follow-up Questions */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Ask Follow-up Questions</Label>
                    <p className="text-xs text-blue-200 mt-1">Agent will ask relevant follow-up questions</p>
                  </div>
                  <Switch 
                    checked={behaviorSettings.askFollowUpQuestions}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, askFollowUpQuestions: checked})}
                  />
                </div>
                
                {/* Offer Suggestions */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Offer Suggestions</Label>
                    <p className="text-xs text-blue-200 mt-1">Agent will suggest related services</p>
                  </div>
                  <Switch 
                    checked={behaviorSettings.offerSuggestions}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, offerSuggestions: checked})}
                  />
                </div>
                
                {/* Send Confirmation Messages */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Send Confirmations</Label>
                    <p className="text-xs text-blue-200 mt-1">Agent will confirm bookings and requests</p>
                  </div>
                  <Switch 
                    checked={behaviorSettings.sendConfirmationMessages}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, sendConfirmationMessages: checked})}
                  />
                </div>
                
                {/* Proactive Service Reminders */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Service Reminders</Label>
                    <p className="text-xs text-blue-200 mt-1">Send proactive reminders for upcoming services</p>
                  </div>
                  <Switch 
                    checked={behaviorSettings.proactiveServiceReminders}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, proactiveServiceReminders: checked})}
                  />
                </div>
                
                {/* Holiday Greetings */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Holiday Greetings</Label>
                    <p className="text-xs text-blue-200 mt-1">Include holiday greetings when appropriate</p>
                  </div>
                  <Switch 
                    checked={behaviorSettings.holidayGreetings}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, holidayGreetings: checked})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Language Tab */}
        <TabsContent value="language">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-500/20 shadow-lg">
            <CardHeader>
              <CardTitle>Language Settings</CardTitle>
              <CardDescription className="text-blue-200">
                Customize the language and communication style
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formality */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Formality</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('formality', languageSettings.formality)}
                  </span>
                </div>
                <Slider
                  value={[languageSettings.formality]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setLanguageSettings({...languageSettings, formality: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">How formal the agent's language will be</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Technical Terms */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Technical Language</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('technicalTerms', languageSettings.technicalTerms)}
                  </span>
                </div>
                <Slider
                  value={[languageSettings.technicalTerms]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setLanguageSettings({...languageSettings, technicalTerms: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">How much technical car terminology to use</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Message Length */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Message Length</Label>
                  <span className="text-sm text-blue-300">
                    {getSliderLabel('messageLength', languageSettings.messageLength)}
                  </span>
                </div>
                <Slider
                  value={[languageSettings.messageLength]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) => setLanguageSettings({...languageSettings, messageLength: value[0]})}
                  className="py-2"
                />
                <p className="text-xs text-blue-200">How lengthy the agent responses will be</p>
              </div>
              
              <Separator className="bg-blue-500/20" />
              
              {/* Use Emojis */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="text-base">Use Emojis</Label>
                  <p className="text-xs text-blue-200 mt-1">Include emojis in messages for a friendly touch</p>
                </div>
                <Switch 
                  checked={languageSettings.useEmojis}
                  onCheckedChange={(checked) => setLanguageSettings({...languageSettings, useEmojis: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messaging Tab */}
        <TabsContent value="messaging">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-500/20 shadow-lg">
            <CardHeader>
              <CardTitle>Opening Messages by Channel</CardTitle>
              <CardDescription className="text-blue-200">
                Customize the first message customers receive on each communication channel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* SMS Opening Message */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-400" />
                  <Label htmlFor="smsOpeningMessage" className="text-base font-semibold">SMS Opening Message</Label>
                </div>
                <p className="text-xs text-blue-200">
                  First message sent when a customer texts your business number
                </p>
                <textarea
                  id="smsOpeningMessage"
                  value={messagingSettings.smsOpeningMessage}
                  onChange={(e) => setMessagingSettings({
                    ...messagingSettings,
                    smsOpeningMessage: e.target.value
                  })}
                  className="w-full min-h-[100px] p-3 rounded-md bg-blue-900/40 border border-blue-700/30 text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your SMS opening message..."
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-blue-200">
                    Character count: {messagingSettings.smsOpeningMessage.length}
                  </p>
                  <Badge variant="outline" className="text-xs">SMS</Badge>
                </div>
                <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700/30">
                  <p className="text-sm text-white">{messagingSettings.smsOpeningMessage}</p>
                </div>
              </div>

              <Separator className="bg-blue-500/20" />

              {/* Website Opening Message */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-400" />
                  <Label htmlFor="websiteOpeningMessage" className="text-base font-semibold">Website Chat Opening Message</Label>
                </div>
                <p className="text-xs text-blue-200">
                  First message customers see when they open the chat widget on your website
                </p>
                <textarea
                  id="websiteOpeningMessage"
                  value={messagingSettings.websiteOpeningMessage}
                  onChange={(e) => setMessagingSettings({
                    ...messagingSettings,
                    websiteOpeningMessage: e.target.value
                  })}
                  className="w-full min-h-[100px] p-3 rounded-md bg-blue-900/40 border border-blue-700/30 text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your website chat opening message..."
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-blue-200">
                    Character count: {messagingSettings.websiteOpeningMessage.length}
                  </p>
                  <Badge variant="outline" className="text-xs">Website</Badge>
                </div>
                <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700/30">
                  <p className="text-sm text-white">{messagingSettings.websiteOpeningMessage}</p>
                </div>
              </div>

              <Separator className="bg-blue-500/20" />

              {/* Facebook/Embedded Widget Opening Message */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-blue-400" />
                  <Label htmlFor="facebookOpeningMessage" className="text-base font-semibold">Facebook / Embedded Widget Opening Message</Label>
                </div>
                <p className="text-xs text-blue-200">
                  First message for customers reaching out via Facebook Messenger or embedded chat widgets
                </p>
                <textarea
                  id="facebookOpeningMessage"
                  value={messagingSettings.facebookOpeningMessage}
                  onChange={(e) => setMessagingSettings({
                    ...messagingSettings,
                    facebookOpeningMessage: e.target.value
                  })}
                  className="w-full min-h-[100px] p-3 rounded-md bg-blue-900/40 border border-blue-700/30 text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your Facebook/widget opening message..."
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-blue-200">
                    Character count: {messagingSettings.facebookOpeningMessage.length}
                  </p>
                  <Badge variant="outline" className="text-xs">Facebook / Widget</Badge>
                </div>
                <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700/30">
                  <p className="text-sm text-white">{messagingSettings.facebookOpeningMessage}</p>
                </div>
              </div>

              <Separator className="bg-blue-500/20" />

              <div className="p-4 bg-blue-900/30 rounded-lg">
                <h3 className="font-medium mb-2 text-white flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Channel-Specific Customization
                </h3>
                <p className="text-sm text-blue-200">
                  Each channel displays its own customized opening message. This allows you to tailor your tone and content based on where customers are reaching out from - keeping SMS concise, website chat professional, and Facebook/widget friendly.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Holiday Awareness Tab */}
        <TabsContent value="holidays">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-500/20 shadow-lg">
            <CardHeader>
              <CardTitle>Holiday Awareness</CardTitle>
              <CardDescription className="text-blue-200">
                Customize how the agent recognizes holidays in conversations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-blue-900/30 rounded-lg mb-4">
                <h3 className="font-medium mb-2">How Holiday Awareness Works</h3>
                <p className="text-sm text-blue-200 mb-2">
                  When enabled, the agent will automatically include holiday greetings in conversations that occur on or near major holidays.
                  This helps create a more personalized and human-like interaction experience for your customers.
                </p>
                <p className="text-sm text-blue-200">
                  Customize which holidays to recognize and what greetings to use for each one below.
                </p>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-medium">Enable Holiday Awareness</Label>
                  <Switch 
                    checked={behaviorSettings.holidayGreetings}
                    onCheckedChange={(checked) => setBehaviorSettings({...behaviorSettings, holidayGreetings: checked})}
                  />
                </div>
                
                <p className="text-sm text-blue-200 mb-4">
                  When a conversation happens during an enabled holiday, the agent will include the appropriate greeting.
                </p>
              </div>
              
              <div className="rounded-lg overflow-hidden">
                <HolidayAwarenessTable 
                  holidays={holidays} 
                  onToggle={handleHolidayToggle}
                  onUpdateGreeting={handleGreetingUpdate}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}