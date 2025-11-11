import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Bot, MessageSquare, Calendar, CreditCard, TrendingUp, Lock, Database, Zap, CheckCircle2, ArrowRight, Clock, Users, Bell, Search, BarChart3, FileText, Mail, Phone, MessageCircle, Instagram, Facebook, Brain, Sparkles, Target, GitBranch, Workflow, Code2, Send, Megaphone, UserCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import logoUrl from "@assets/generated_images/Clean_Machine_hexagonal_shield_logo_46864b38.png";

export default function ShowcasePage() {
  const [, setLocation] = useLocation();
  const [activeFeature, setActiveFeature] = useState("overview");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-x-hidden">
      {/* Debug: Verify component renders */}
      <div className="fixed top-0 left-0 bg-red-500 text-white p-2 z-50">Showcase Loaded</div>
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-3xl"></div>
        
        <div className="relative container mx-auto px-4 py-16">
          {/* Header with Logo */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Clean Machine" className="w-16 h-16 md:w-20 md:h-20" />
              <div>
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
                  AI Business Assistant
                </h1>
                <p className="text-xl md:text-2xl text-blue-200">
                  Enterprise-Grade Automation Platform
                </p>
              </div>
            </div>
            
            <Button 
              onClick={() => setLocation("/")}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-home"
            >
              Back to Home
            </Button>
          </div>

          {/* Value Proposition */}
          <div className="text-center mb-16">
            <Badge className="mb-4 text-lg px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500">
              <Sparkles className="w-4 h-4 mr-2 inline" />
              Production-Ready • Enterprise Security • White-Label Available
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Transform Your Business with AI-Powered Automation
            </h2>
            <p className="text-xl text-blue-100 max-w-4xl mx-auto">
              A comprehensive business management platform featuring AI chatbots, multi-channel messaging, 
              appointment scheduling, payment processing, and enterprise security. Built for scalability and customization.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <StatCard icon={MessageSquare} value="5+" label="Communication Channels" />
            <StatCard icon={Bot} value="GPT-4o" label="AI Model Powered" />
            <StatCard icon={Lock} value="99%" label="Hack Prevention (2FA)" />
            <StatCard icon={Zap} value="<2s" label="Average Response Time" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <Tabs value={activeFeature} onValueChange={setActiveFeature} className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-slate-800/50 p-2">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai">AI Intelligence</TabsTrigger>
            <TabsTrigger value="communication" data-testid="tab-communication">Communications</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
            <TabsTrigger value="technical" data-testid="tab-technical">Technical Deep-Dive</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <OverviewSection />
          </TabsContent>

          {/* AI Intelligence Tab */}
          <TabsContent value="ai" className="space-y-8">
            <AIIntelligenceSection />
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communication" className="space-y-8">
            <CommunicationSection />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-8">
            <SecuritySection />
          </TabsContent>

          {/* Technical Deep-Dive Tab */}
          <TabsContent value="technical" className="space-y-8">
            <TechnicalSection />
          </TabsContent>
        </Tabs>

        {/* Call to Action */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            White-label versions available. Contact us to customize this platform for your industry.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-view-dashboard"
            >
              View Live Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              data-testid="button-contact-sales"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto px-4 py-8 text-center text-white/60">
        <p>Built with modern web technologies • Fully customizable • Enterprise support available</p>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, value, label }: { icon: any, value: string, label: string }) {
  return (
    <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
      <CardContent className="pt-6 text-center">
        <Icon className="w-8 h-8 mx-auto mb-2 text-blue-300" />
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-blue-200">{label}</div>
      </CardContent>
    </Card>
  );
}

// Overview Section
function OverviewSection() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">Complete Business Automation Platform</h2>
        <p className="text-xl text-blue-200 max-w-3xl mx-auto">
          Everything you need to run a modern service business - from customer acquisition to payment collection.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard
          icon={Bot}
          title="AI-Powered Chatbot"
          description="GPT-4o powered conversational AI that understands context, detects intent, and provides intelligent responses across all channels."
          features={[
            "Natural language understanding",
            "Context-aware responses",
            "Multi-language support",
            "Sentiment analysis"
          ]}
        />

        <FeatureCard
          icon={MessageSquare}
          title="Multi-Channel Messaging"
          description="Unified inbox for SMS, web chat, email, Facebook Messenger, and Instagram DMs with real-time delivery tracking."
          features={[
            "Real-time message sync",
            "Read receipts & typing indicators",
            "Message reactions (emoji)",
            "Conversation search & history"
          ]}
        />

        <FeatureCard
          icon={Calendar}
          title="Smart Scheduling"
          description="Google Calendar integration with weather checking, conflict detection, and automated reminders."
          features={[
            "Real-time availability",
            "Weather-based scheduling",
            "Automatic conflict resolution",
            "SMS/Email reminders"
          ]}
        />

        <FeatureCard
          icon={CreditCard}
          title="Payment Processing"
          description="Stripe & PayPal integration with invoice generation, payment links, and automated follow-ups."
          features={[
            "Secure payment processing",
            "Automated invoice emails",
            "Payment link generation",
            "Subscription management"
          ]}
        />

        <FeatureCard
          icon={TrendingUp}
          title="Loyalty & Upselling"
          description="Automated loyalty program with points tracking and context-aware product recommendations."
          features={[
            "Points-based rewards",
            "Automated tier upgrades",
            "Smart upsell suggestions",
            "Customer lifetime value tracking"
          ]}
        />

        <FeatureCard
          icon={Shield}
          title="Enterprise Security"
          description="Military-grade security with 2FA, audit logging, brute-force protection, and encrypted data storage."
          features={[
            "Two-factor authentication (TOTP)",
            "Login attempt monitoring",
            "Audit trail logging",
            "Bcrypt password hashing"
          ]}
        />
      </div>
    </div>
  );
}

// AI Intelligence Section
function AIIntelligenceSection() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          <Brain className="inline w-12 h-12 mr-4 text-purple-400" />
          AI Intelligence Engine
        </h2>
        <p className="text-xl text-blue-200 max-w-3xl mx-auto">
          Powered by OpenAI's GPT-4o, our AI doesn't just respond - it understands context, learns from interactions, and makes intelligent decisions.
        </p>
      </div>

      {/* AI Capabilities */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-purple-400" />
              Intent Detection & Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-100 space-y-4">
            <p>The AI automatically detects what customers want and routes conversations appropriately:</p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Booking Intent:</strong> "I need a detail next Tuesday" → Triggers appointment flow</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Service Inquiry:</strong> "What do you offer?" → Provides service catalog</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Specialty Jobs:</strong> "Can you fix this scratch?" → Requests custom quote</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Support Questions:</strong> "Where are you located?" → Provides business info</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-cyan-400" />
              Dynamic Knowledge Base
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-100 space-y-4">
            <p>Real-time integration with Google Sheets as a living knowledge base:</p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Services & Pricing:</strong> Auto-synced from Google Sheets</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>FAQs:</strong> Updated in real-time without code changes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Business Policies:</strong> Automatically incorporated into responses</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Seasonal Updates:</strong> No developer needed for content changes</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* AI Decision Flow */}
      <Card className="bg-slate-800/50 border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Workflow className="w-6 h-6 text-blue-400" />
            AI Decision Flow & Logic Tree
          </CardTitle>
          <CardDescription className="text-blue-200">
            How the AI processes and responds to customer messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-white">
            <AIFlowDiagram />
          </div>
        </CardContent>
      </Card>

      {/* Customer Memory System */}
      <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-green-400" />
            Customer Memory & Personalization
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-100 space-y-4">
          <p>The AI remembers every customer interaction and personalizes future conversations:</p>
          <ul className="space-y-2 ml-4">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Service History:</strong> "Welcome back! Ready for another ceramic coating?"</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Preferences:</strong> Remembers vehicle details, preferred times, special requests</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Loyalty Status:</strong> Automatically applies points and suggests upgrades</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Past Issues:</strong> References previous concerns or special accommodations</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// AI Flow Diagram Component
function AIFlowDiagram() {
  return (
    <div className="bg-slate-900/50 p-6 rounded-lg border border-blue-500/20">
      <div className="space-y-6">
        {/* Step 1 */}
        <AIFlowStep
          number={1}
          title="Message Receipt"
          description="Customer sends message via SMS, web chat, Facebook, Instagram, or email"
          icon={MessageCircle}
          color="blue"
        />
        
        <AIFlowArrow />

        {/* Step 2 */}
        <AIFlowStep
          number={2}
          title="Customer Identification"
          description="Lookup in database by phone/email • Check service history • Load loyalty status"
          icon={Search}
          color="cyan"
        />
        
        <AIFlowArrow />

        {/* Step 3 */}
        <AIFlowStep
          number={3}
          title="Context Building"
          description="Load conversation history • Fetch knowledge base • Check business hours • Get calendar availability"
          icon={Brain}
          color="purple"
        />
        
        <AIFlowArrow />

        {/* Step 4 */}
        <AIFlowStep
          number={4}
          title="Intent Classification (GPT-4o)"
          description="Analyze message content • Detect intent: booking, inquiry, support, specialty job • Extract key entities: dates, services, vehicles"
          icon={Target}
          color="pink"
        />
        
        <AIFlowArrow />

        {/* Decision Tree */}
        <div className="grid md:grid-cols-3 gap-4">
          <DecisionBranch
            condition="Booking Intent"
            actions={[
              "Check calendar availability",
              "Suggest open slots",
              "Verify customer info",
              "Send booking link"
            ]}
            color="green"
          />
          
          <DecisionBranch
            condition="Specialty Job"
            actions={[
              "Request damage photos",
              "Create quote request",
              "Notify business owner",
              "Set 48h auto-approve"
            ]}
            color="orange"
          />
          
          <DecisionBranch
            condition="General Inquiry"
            actions={[
              "Search knowledge base",
              "Generate AI response",
              "Include service links",
              "Suggest upsells"
            ]}
            color="blue"
          />
        </div>
        
        <AIFlowArrow />

        {/* Step 5 */}
        <AIFlowStep
          number={5}
          title="Response Generation & Formatting"
          description="GPT-4o generates contextual response • Format for channel (SMS/email/web) • Apply character limits • Add CTAs and links"
          icon={FileText}
          color="violet"
        />
        
        <AIFlowArrow />

        {/* Step 6 */}
        <AIFlowStep
          number={6}
          title="Delivery & Tracking"
          description="Send via appropriate channel • Track delivery status • Monitor read receipts • Log interaction for future context"
          icon={Bell}
          color="green"
        />
      </div>
    </div>
  );
}

interface AIFlowStepProps {
  number: number;
  title: string;
  description: string;
  icon: any;
  color: 'blue' | 'cyan' | 'purple' | 'pink' | 'green' | 'violet';
}

function AIFlowStep({ number, title, description, icon: Icon, color }: AIFlowStepProps) {
  const colorClasses: Record<AIFlowStepProps['color'], string> = {
    blue: "bg-blue-500/20 border-blue-500/40 text-blue-300",
    cyan: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
    purple: "bg-purple-500/20 border-purple-500/40 text-purple-300",
    pink: "bg-pink-500/20 border-pink-500/40 text-pink-300",
    green: "bg-green-500/20 border-green-500/40 text-green-300",
    violet: "bg-violet-500/20 border-violet-500/40 text-violet-300",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold">
            {number}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-5 h-5" />
            <h4 className="font-bold text-white text-lg">{title}</h4>
          </div>
          <p className="text-sm text-white/80">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AIFlowArrow() {
  return (
    <div className="flex justify-center">
      <ArrowRight className="w-6 h-6 text-blue-400 rotate-90" />
    </div>
  );
}

interface DecisionBranchProps {
  condition: string;
  actions: string[];
  color: 'green' | 'orange' | 'blue';
}

function DecisionBranch({ condition, actions, color }: DecisionBranchProps) {
  const colorClasses: Record<DecisionBranchProps['color'], string> = {
    green: "border-green-500/40 bg-green-500/10",
    orange: "border-orange-500/40 bg-orange-500/10",
    blue: "border-blue-500/40 bg-blue-500/10",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="font-bold text-white mb-3 flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        {condition}
      </div>
      <ul className="space-y-1.5">
        {actions.map((action: string, i: number) => (
          <li key={i} className="text-sm text-white/70 flex items-start gap-2">
            <span className="text-blue-400">→</span>
            <span>{action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Communication Section
function CommunicationSection() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          <MessageSquare className="inline w-12 h-12 mr-4 text-blue-400" />
          Multi-Channel Communications
        </h2>
        <p className="text-xl text-blue-200 max-w-3xl mx-auto">
          Unified messaging platform that connects all your communication channels in one place.
        </p>
      </div>

      {/* Channels Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ChannelCard
          icon={Phone}
          title="SMS / Text Messaging"
          description="Twilio-powered SMS with delivery tracking, auto-replies, and voicemail transcription."
          features={[
            "Real-time delivery status",
            "TCPA/CTIA compliance",
            "Missed call auto-SMS",
            "Voicemail transcription"
          ]}
        />

        <ChannelCard
          icon={MessageCircle}
          title="Web Chat Widget"
          description="Real-time chat widget with typing indicators, read receipts, and message reactions."
          features={[
            "iMessage-quality UI",
            "Typing indicators",
            "Read receipts",
            "Emoji reactions"
          ]}
        />

        <ChannelCard
          icon={Mail}
          title="Email Integration"
          description="SendGrid-powered email with branded templates and invoice delivery."
          features={[
            "Branded HTML emails",
            "Invoice attachments",
            "Open/click tracking",
            "Automated follow-ups"
          ]}
        />

        <ChannelCard
          icon={Facebook}
          title="Facebook Messenger"
          description="Native integration with Facebook Messenger via Graph API."
          features={[
            "Auto-sync conversations",
            "Quick reply templates",
            "Image/attachment support",
            "Business page integration"
          ]}
        />

        <ChannelCard
          icon={Instagram}
          title="Instagram Direct Messages"
          description="Manage Instagram DMs from the unified inbox."
          features={[
            "Story reply handling",
            "Media message support",
            "Auto-response templates",
            "Conversation threading"
          ]}
        />

        <ChannelCard
          icon={Bell}
          title="Push Notifications"
          description="Progressive Web App push notifications for instant updates."
          features={[
            "Browser notifications",
            "Message alerts",
            "Appointment reminders",
            "Custom notification rules"
          ]}
        />
      </div>

      {/* Campaign Management */}
      <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-purple-400" />
            Email & SMS Campaign Management
          </CardTitle>
          <CardDescription className="text-purple-200">
            Production-ready bulk messaging with enterprise compliance and rate limiting
          </CardDescription>
        </CardHeader>
        <CardContent className="text-blue-100 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2 text-white">
                <Mail className="w-5 h-5 text-blue-400" />
                Email Campaigns
              </h4>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Bottleneck Rate Limiting:</strong> 600 emails/min (SendGrid API compliance)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Atomic Quota Management:</strong> Daily send limits prevent overages</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Suppression List:</strong> Auto-skip bounced/unsubscribed emails</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>CAN-SPAM Compliance:</strong> Unsubscribe links, sender verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Delivery Tracking:</strong> SendGrid webhooks track opens, clicks, bounces</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Personalization:</strong> Dynamic {'{name}'} replacement per recipient</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2 text-white">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                SMS Campaigns
              </h4>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>TCPA Quiet Hours:</strong> Auto-blocks 9 PM - 8 AM per recipient timezone</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Timezone Intelligence:</strong> Uses date-fns-tz for accurate local time</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Auto-Rescheduling:</strong> Quiet hour messages sent at next 8 AM</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Consent Verification:</strong> Only sends to opted-in customers</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Segment Estimation:</strong> Auto-calculates SMS credits needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Character Limits:</strong> 300 chars max with live counter UI</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-purple-500/30">
            <h4 className="font-bold mb-3 flex items-center gap-2 text-white">
              <UserCheck className="w-5 h-5 text-green-400" />
              Campaign Features
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-500/20">
                <div className="font-semibold text-white mb-2">Target Audiences</div>
                <ul className="text-sm space-y-1 text-blue-200">
                  <li>• All Customers</li>
                  <li>• VIP Customers Only</li>
                  <li>• Loyalty Members</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-500/20">
                <div className="font-semibold text-white mb-2">Scheduling</div>
                <ul className="text-sm space-y-1 text-blue-200">
                  <li>• Send immediately</li>
                  <li>• Schedule for later</li>
                  <li>• Hourly batch processing</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-500/20">
                <div className="font-semibold text-white mb-2">Tracking</div>
                <ul className="text-sm space-y-1 text-blue-200">
                  <li>• Recipient count</li>
                  <li>• Sent/failed status</li>
                  <li>• Delivery webhooks</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Features */}
      <Card className="bg-slate-800/50 border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-white">Advanced Messaging Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 text-white">
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Real-Time Capabilities
              </h4>
              <ul className="space-y-2 ml-6 text-blue-100">
                <li>• WebSocket-powered live updates</li>
                <li>• Typing indicators for all channels</li>
                <li>• Read receipts and delivery status</li>
                <li>• Offline draft auto-save</li>
                <li>• Conversation sync across devices</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                Organization & Search
              </h4>
              <ul className="space-y-2 ml-6 text-blue-100">
                <li>• Full-text conversation search</li>
                <li>• Filter by channel, customer, date</li>
                <li>• Tag conversations for follow-up</li>
                <li>• Archive and bulk actions</li>
                <li>• Export conversation history</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Security Section
function SecuritySection() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          <Shield className="inline w-12 h-12 mr-4 text-green-400" />
          Enterprise-Grade Security
        </h2>
        <p className="text-xl text-blue-200 max-w-3xl mx-auto">
          Military-grade security features that protect your business and customer data.
        </p>
      </div>

      {/* Security Features Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-6 h-6 text-green-400" />
              Two-Factor Authentication (2FA)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-100 space-y-4">
            <p className="font-semibold text-green-300">
              Reduces hack likelihood by 99% (2024 security research)
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Two-Phase Login Flow:</strong> Password verification → TOTP code → Full access (prevents bypass)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Session Security:</strong> 5-minute pending session TTL, IP validation, automatic invalidation on enable</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Single-Use Backup Codes:</strong> 10 emergency recovery codes (each expires after one use)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>QR Code Setup:</strong> Works with Google Authenticator, Authy, Microsoft Authenticator</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Global API Protection:</strong> All /api/* routes enforce 2FA (no bypass possible)</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-400" />
              Brute-Force Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-100 space-y-4">
            <p className="font-semibold text-red-300">
              Automatic account lockout after failed login attempts
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Login Attempt Tracking:</strong> Monitor all login attempts by IP and username</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Smart Lockouts:</strong> 5 failed attempts = 30-minute lockout</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Rate Limiting:</strong> 300 requests/minute per IP</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Admin Unlock:</strong> Manual account unlock by authorized users</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              Comprehensive Audit Logging
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-100 space-y-4">
            <p className="font-semibold text-blue-300">
              Forensic-grade audit trail with security event correlation
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Security Event Tracking:</strong> 2FA enable/disable, failed login attempts, password changes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Real-Time Activity Log:</strong> View all actions as they happen with timestamps</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Geolocation & Context:</strong> IP address, user agent, device fingerprinting</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Suspicious Activity Alerts:</strong> Multiple failed attempts, unusual IP addresses</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/40 to-violet-900/40 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-400" />
              Data Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-100 space-y-4">
            <p className="font-semibold text-purple-300">
              Multi-layered encryption and secure data handling
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Bcrypt Password Hashing:</strong> Industry-standard 10-round bcrypt</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>Encrypted 2FA Secrets:</strong> Base32-encoded TOTP secrets</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>HTTPS/TLS:</strong> End-to-end encryption for all data in transit</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>SQL Injection Protection:</strong> Parameterized queries with Drizzle ORM</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Security Settings Management Card */}
      <Card className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-cyan-500/30 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Security Settings Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-100 space-y-4">
          <p className="font-semibold text-cyan-300">
            Centralized security management with real-time activity monitoring
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2 text-white">
                <Lock className="w-5 h-5 text-cyan-400" />
                2FA Management
              </h4>
              <ul className="space-y-2 ml-6 text-blue-100">
                <li>• Enable/disable 2FA with QR code</li>
                <li>• Regenerate backup codes</li>
                <li>• View enrolled devices</li>
                <li>• Session management</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2 text-white">
                <FileText className="w-5 h-5 text-blue-400" />
                Activity Logs
              </h4>
              <ul className="space-y-2 ml-6 text-blue-100">
                <li>• Real-time security events</li>
                <li>• Login history with IP/location</li>
                <li>• Failed attempt tracking</li>
                <li>• Export audit logs</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2 text-white">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Security Stats
              </h4>
              <ul className="space-y-2 ml-6 text-blue-100">
                <li>• Login success rate</li>
                <li>• Failed attempt trends</li>
                <li>• Active sessions count</li>
                <li>• Geographic access patterns</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Dashboard Stats */}
      <Card className="bg-slate-800/50 border-green-500/30 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-green-400" />
            Real-Time Security Metrics
          </CardTitle>
          <CardDescription className="text-blue-200">
            Live security monitoring and threat detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <div className="text-3xl font-bold text-white mb-1">247</div>
              <div className="text-sm text-blue-200">Logins (24h)</div>
            </div>
            <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30">
              <div className="text-3xl font-bold text-white mb-1">3</div>
              <div className="text-sm text-red-200">Failed Attempts (24h)</div>
            </div>
            <div className="p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
              <div className="text-3xl font-bold text-white mb-1">0</div>
              <div className="text-sm text-yellow-200">Locked Accounts</div>
            </div>
            <div className="p-4 bg-green-500/20 rounded-lg border border-green-500/30">
              <div className="text-3xl font-bold text-white mb-1">12</div>
              <div className="text-sm text-green-200">Users with 2FA</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Technical Section
function TechnicalSection() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          <Code2 className="inline w-12 h-12 mr-4 text-cyan-400" />
          Technical Architecture
        </h2>
        <p className="text-xl text-blue-200 max-w-3xl mx-auto">
          Built with modern, scalable technologies and best practices for enterprise deployments.
        </p>
      </div>

      {/* Tech Stack */}
      <Card className="bg-slate-800/50 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-white">Technology Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <TechStackSection
              title="Frontend"
              tech={[
                "React 18 with TypeScript",
                "Vite for blazing-fast builds",
                "TailwindCSS + shadcn/ui",
                "TanStack React Query",
                "React Hook Form + Zod",
                "Wouter routing",
                "PWA with Service Workers"
              ]}
            />
            <TechStackSection
              title="Backend"
              tech={[
                "Node.js + Express.js",
                "TypeScript for type safety",
                "Drizzle ORM",
                "PostgreSQL (Neon serverless)",
                "Session-based auth",
                "WebSocket (Socket.io)",
                "Rate limiting middleware"
              ]}
            />
            <TechStackSection
              title="Integrations"
              tech={[
                "OpenAI GPT-4o",
                "Twilio (SMS/Voice)",
                "SendGrid (Email)",
                "Stripe + PayPal",
                "Google Workspace APIs",
                "Facebook Graph API",
                "Open-Meteo Weather"
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Architecture Patterns */}
      <Card className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-white">Architecture & Design Patterns</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-100 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-white mb-3">Backend Patterns</h4>
              <ul className="space-y-2 ml-4">
                <li>• Monolithic service layer with clean separation</li>
                <li>• Repository pattern with Drizzle ORM</li>
                <li>• Middleware chain for auth & validation</li>
                <li>• Multi-channel response formatting</li>
                <li>• Webhook signature verification</li>
                <li>• Background job processing (Bull queue)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Frontend Patterns</h4>
              <ul className="space-y-2 ml-4">
                <li>• Component-based architecture</li>
                <li>• Optimistic UI updates</li>
                <li>• Client-side caching with React Query</li>
                <li>• Form validation with Zod schemas</li>
                <li>• Real-time WebSocket sync</li>
                <li>• Responsive mobile-first design</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Schema Highlights */}
      <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white">Database Design</CardTitle>
          <CardDescription className="text-purple-200">
            Optimized schema with strategic indexing for performance
          </CardDescription>
        </CardHeader>
        <CardContent className="text-blue-100 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-black/20 rounded-lg border border-purple-500/20">
              <h4 className="font-bold text-white mb-2">Core Tables (40+)</h4>
              <ul className="text-sm space-y-1 ml-4">
                <li>• users, customers, appointments</li>
                <li>• messages, conversations, contacts</li>
                <li>• services, recurring_services</li>
                <li>• loyalty_points, transactions</li>
                <li>• totp_secrets, login_attempts, audit_logs</li>
                <li>• banners, quick_replies, tags</li>
              </ul>
            </div>
            <div className="p-4 bg-black/20 rounded-lg border border-pink-500/20">
              <h4 className="font-bold text-white mb-2">Performance Features</h4>
              <ul className="text-sm space-y-1 ml-4">
                <li>• 25+ strategic indexes</li>
                <li>• Compound indexes for complex queries</li>
                <li>• Foreign key constraints</li>
                <li>• JSONB columns for flexible data</li>
                <li>• Timestamps for audit trails</li>
                <li>• Unique constraints for data integrity</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Design */}
      <Card className="bg-slate-800/50 border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-white">API Design & Security</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-100 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-white mb-3">RESTful Endpoints (100+)</h4>
              <ul className="space-y-1 text-sm ml-4">
                <li>• /api/auth/* - Authentication & 2FA</li>
                <li>• /api/messages/* - Multi-channel messaging</li>
                <li>• /api/appointments/* - Scheduling & calendar</li>
                <li>• /api/customers/* - CRM operations</li>
                <li>• /api/invoices/* - Payment & billing</li>
                <li>• /api/loyalty/* - Rewards program</li>
                <li>• /api/admin/* - Dashboard & analytics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Security Features</h4>
              <ul className="space-y-1 text-sm ml-4">
                <li>• JWT + session-based authentication</li>
                <li>• Role-based access control (RBAC)</li>
                <li>• Input validation with Zod</li>
                <li>• Rate limiting (300 req/min)</li>
                <li>• CORS protection</li>
                <li>• Helmet security headers</li>
                <li>• Twilio webhook signature verification</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components
function FeatureCard({ icon: Icon, title, description, features }: any) {
  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
      <CardHeader>
        <Icon className="w-10 h-10 mb-3 text-blue-400" />
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-blue-200">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-blue-100">
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ChannelCard({ icon: Icon, title, description, features }: any) {
  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
      <CardHeader>
        <Icon className="w-10 h-10 mb-3 text-blue-400" />
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-blue-200">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-blue-100">
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TechStackSection({ title, tech }: any) {
  return (
    <div>
      <h4 className="font-bold text-white mb-3">{title}</h4>
      <ul className="space-y-1.5 text-blue-100">
        {tech.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="text-cyan-400">▸</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
