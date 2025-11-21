import { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Phone,
  Brain,
  Calendar,
  Zap,
  Shield,
  Star,
  TrendingUp,
  CheckCircle,
  Clock,
  Mail,
  Facebook,
  Instagram,
  Smartphone,
  MapPin,
  CloudRain,
  Users,
  DollarSign,
  Bell,
  Eye,
  Heart,
  Sparkles,
  Target,
  Activity,
  Award,
  PhoneCall,
  QrCode,
  Wallet,
  Gift,
  Headphones
} from 'lucide-react';
import CleanMachineLogo from '../components/CleanMachineLogo';

export default function CleanMachineShowcase() {
  const [, setLocation] = useLocation();
  const [activeFeature, setActiveFeature] = useState(0);
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    });
  }, [controls]);

  const intelligentFeatures = [
    {
      icon: Phone,
      title: "Voicemail-Aware Call Handling",
      description: "Revolutionary missed call intelligence",
      details: [
        "Waits 5-10 seconds after missed call to check for voicemail",
        "Reads voicemail transcription via Twilio's speech-to-text",
        "Crafts personalized SMS response addressing the caller's message",
        "Falls back to generic missed call SMS only if no voicemail left",
        "Prevents awkward 'We missed your call' texts when caller already left details"
      ],
      stat: "95% caller satisfaction",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: MessageSquare,
      title: "Multi-Channel Messaging Hub",
      description: "Unified conversations across all platforms",
      details: [
        "SMS via Twilio with delivery tracking and read receipts",
        "Facebook Messenger integration with Graph API",
        "Instagram Direct Messages with real-time sync",
        "Web chat widget with AI-powered responses",
        "All platforms unified in single conversation view",
        "Smart routing based on customer preference history"
      ],
      stat: "4 channels, 1 inbox",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Brain,
      title: "GPT-4o AI Engine",
      description: "Intelligent customer service automation",
      details: [
        "Natural conversation flow with context memory",
        "Service recommendation based on vehicle condition",
        "Quote generation for specialty detailing jobs",
        "Intent detection: booking, question, complaint, pricing",
        "Automatic upselling with context-aware offers",
        "Manual takeover mode for complex situations"
      ],
      stat: "87% automation rate",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Calendar,
      title: "Smart Scheduling System",
      description: "Weather-aware appointment booking",
      details: [
        "Google Calendar API integration for real-time availability",
        "Weather forecast checking (Open-Meteo API)",
        "Automatic rescheduling suggestions for rain forecasts",
        "Conflict detection and double-booking prevention",
        "Service duration calculation with buffer time",
        "Drive time estimation via Google Maps API"
      ],
      stat: "Zero scheduling conflicts",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Sparkles,
      title: "iMessage-Quality Messaging",
      description: "Modern chat experience for customers",
      details: [
        "Real-time read receipts with timestamp tracking",
        "Typing indicators ('typing...' animation)",
        "Message reactions with emoji support",
        "Conversation search and history",
        "Offline draft saving with localStorage",
        "Conversation isolation prevents draft leakage"
      ],
      stat: "Real-time engagement",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: Star,
      title: "Gamified Loyalty Program",
      description: "Points-based rewards system",
      details: [
        "Automatic points for every service (10 points per $1)",
        "Milestone rewards with canvas confetti celebrations",
        "Tiered benefits: Bronze, Silver, Gold, Platinum",
        "Birthday bonus points with automated emails",
        "Referral rewards tracking",
        "Points redemption for service discounts"
      ],
      stat: "40% repeat customers",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: PhoneCall,
      title: "Dual Phone Line System",
      description: "Google Voice-style multi-line management",
      details: [
        "Main business line (918-856-5304) + Jody's line (918-856-5711)",
        "Google Voice-style UI with seamless line switching",
        "Independent voicemail boxes per line",
        "Twilio routing with caller ID passthrough",
        "Configurable ring duration (10-60 seconds before voicemail)",
        "Recent Callers widget with click-to-call functionality",
        "Line-specific notification preferences"
      ],
      stat: "2 lines, 1 interface",
      color: "from-cyan-500 to-blue-500"
    },
    {
      icon: QrCode,
      title: "QR Code Security System",
      description: "HMAC-SHA256 secure customer identification",
      details: [
        "Cryptographically signed QR codes with HMAC-SHA256",
        "Tamper-proof customer verification tokens",
        "One-scan access to complete service history",
        "No passwords or login credentials required",
        "Time-limited tokens prevent replay attacks",
        "Perfect for on-site customer verification by technicians",
        "Secure URL generation with expiration tracking"
      ],
      stat: "Zero password friction",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Brain,
      title: "Customer Intelligence Engine",
      description: "GPT-powered personalization and tracking",
      details: [
        "Automatic returning customer detection and flagging",
        "GPT personalization service analyzes full customer history",
        "Context-aware service recommendations based on past bookings",
        "Intelligent messaging references previous services",
        "Vehicle-specific maintenance reminders and scheduling",
        "Predictive upselling based on customer preferences",
        "Service frequency analysis with insights dashboard"
      ],
      stat: "Personalized experiences",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: Wallet,
      title: "Cash Payment Tracking",
      description: "Manual entry with daily deposit management",
      details: [
        "Quick manual cash payment entry for on-site collections",
        "Daily deposit summary widget for technicians",
        "Cash collections widget tracks amounts by technician",
        "Deposit history with date and amount tracking",
        "Integrated with job completion workflow",
        "Admin oversight dashboard for all cash transactions",
        "Reconciliation tools for end-of-day cash management"
      ],
      stat: "Full cash visibility",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Gift,
      title: "Comprehensive Referral System",
      description: "9 reward types with advanced tracking",
      details: [
        "9 reward types: percentage off, fixed amount, free service, BOGO, upgrade",
        "Points bonus, gift card, early access, VIP tier promotions",
        "Admin code generation with custom reward configuration",
        "Automatic referrer credit tracking upon invoice payment",
        "Referral code input integrated into booking flow",
        "Usage analytics and redemption tracking dashboard",
        "Performance metrics with conversion rate analysis"
      ],
      stat: "9 reward types",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: Headphones,
      title: "SIP Routing & Custom Ringtones",
      description: "Groundwire app integration for personalized call handling",
      details: [
        "Twilio SIP integration with custom endpoint configuration",
        "Groundwire app support for Android with custom ringtones",
        "Different ringtones per phone line for instant recognition",
        "SIP credentials auto-generated and securely stored",
        "After-hours voicemail with separate greeting message",
        "Voicemail activates 30 minutes after last scheduled shift",
        "Professional call routing with IVR menu system"
      ],
      stat: "Professional phone system",
      color: "from-teal-500 to-cyan-500"
    }
  ];

  const advancedCapabilities = [
    {
      category: "Payment Processing",
      icon: DollarSign,
      features: [
        "Stripe integration with payment intents",
        "Branded invoice emails with HTML templates",
        "Multi-payment options (Stripe, PayPal, Venmo, CashApp)",
        "Cash payment tracking with daily deposit widgets",
        "HMAC-signed payment links with 7-day TTL",
        "Auto-generated invoice numbers (INV-2025-001)",
        "Referral credit application on invoice payment",
        "DoS protection with rate limiting"
      ]
    },
    {
      category: "Security & Compliance",
      icon: Shield,
      features: [
        "HMAC-SHA256 signed QR codes for customer verification",
        "TCPA/CTIA SMS consent with double opt-in",
        "Twilio webhook signature verification",
        "E.164 phone number normalization",
        "Session-based authentication with 2FA support",
        "Google OAuth integration",
        "WebAuthn biometric login support",
        "Time-limited security tokens prevent replay attacks"
      ]
    },
    {
      category: "Business Intelligence",
      icon: TrendingUp,
      features: [
        "Real-time dashboard analytics",
        "Call metrics and duration tracking",
        "SMS delivery monitoring",
        "Conversation sentiment analysis",
        "Revenue tracking and forecasting",
        "Customer lifetime value calculation",
        "Returning customer detection and insights",
        "Referral performance and conversion metrics"
      ]
    },
    {
      category: "Phone System",
      icon: PhoneCall,
      features: [
        "Dual phone lines with independent routing",
        "Caller ID passthrough preserves original number",
        "Configurable ring duration (10-60 seconds)",
        "After-hours voicemail (activates 30min after schedule)",
        "Recent Callers widget with click-to-call",
        "SIP integration with Groundwire for custom ringtones",
        "Configurable notification preferences per line",
        "IVR menu with intelligent call routing"
      ]
    },
    {
      category: "Operational Features",
      icon: Activity,
      features: [
        "Auto-failover protection for system errors",
        "Service capacity limits with maintenance mode",
        "Dynamic banner management for announcements",
        "Technician job routing and dispatch",
        "Photo gallery with Google Drive integration",
        "Recurring service subscriptions",
        "Interactive address validation with Google Maps",
        "Smart scheduling with location clustering"
      ]
    }
  ];

  const techStack = [
    { name: "OpenAI GPT-4o", purpose: "AI conversations & service intelligence" },
    { name: "Twilio", purpose: "SMS, voice calls, voicemail transcription" },
    { name: "Facebook Graph API", purpose: "Messenger & Instagram DMs" },
    { name: "Google Workspace", purpose: "Calendar, Sheets, Drive, Maps" },
    { name: "Stripe", purpose: "Payment processing" },
    { name: "PostgreSQL + Drizzle", purpose: "Customer data & conversation history" },
    { name: "React + TypeScript", purpose: "Modern UI with type safety" },
    { name: "Express.js", purpose: "API backend with WebSocket support" }
  ];

  const uniqueIntelligence = [
    {
      scenario: "Customer Calls After Hours",
      flow: [
        "Call goes to voicemail",
        "System waits 5-10 seconds",
        "Twilio transcribes voicemail",
        "AI reads: 'Hi, I need a full detail tomorrow at 2pm for my Jeep'",
        "SMS sent: 'Thanks for your message! I can schedule your Jeep for full detail tomorrow at 2pm. Reply YES to confirm.'",
        "Customer replies YES",
        "Appointment auto-created in Google Calendar",
        "Confirmation email sent with service details"
      ],
      highlight: "Zero human interaction required"
    },
    {
      scenario: "Dual Phone Line Intelligence",
      flow: [
        "Main line (918-856-5304) receives customer booking call",
        "Jody's line (918-856-5711) receives supplier call simultaneously",
        "Custom ringtones via Groundwire identify which line is ringing",
        "Both lines show caller ID passthrough with original numbers",
        "Main line: Customer schedules appointment → auto-added to calendar",
        "Jody's line: Supplier voicemail → transcribed and texted within 10 seconds",
        "Recent Callers widget shows both conversations separately",
        "Line-specific notifications ensure proper routing"
      ],
      highlight: "Professional multi-line management"
    },
    {
      scenario: "Returning Customer Recognition",
      flow: [
        "Customer texts: 'Hey, can I get another detail?'",
        "GPT Intelligence Service detects returning customer",
        "Analyzes history: Last service was Full Detail 3 months ago",
        "AI responds: 'Welcome back! Last time we did your Tesla Model 3. Ready for another Full Detail, or interested in our new Ceramic Coating?'",
        "Customer asks about ceramic coating pricing",
        "AI provides personalized quote based on previous vehicle",
        "Suggests scheduling 2 weeks out based on optimal service interval",
        "Applies loyalty discount automatically"
      ],
      highlight: "GPT-powered personalization"
    },
    {
      scenario: "Customer Texts About Damage",
      flow: [
        "Customer: 'I have some scratches on my door, can you fix them?'",
        "AI detects damage repair intent",
        "Responds: 'I can help! Please text 3 photos: close-up of damage, full door view, overall vehicle'",
        "Customer sends photos → uploaded to Google Drive",
        "AI analyzes severity and suggests: 'This looks like light scratches. I recommend our Paint Correction ($150) or full Detail + Correction ($250)'",
        "Customer selects service",
        "Custom quote generated with photo evidence attached"
      ],
      highlight: "AI-powered damage assessment workflow"
    },
    {
      scenario: "Referral System in Action",
      flow: [
        "Existing customer shares referral code CLEAN25 (25% off first service)",
        "New customer books via website, enters code CLEAN25",
        "System validates code and applies 25% discount to invoice",
        "New customer completes service and pays $112.50 (originally $150)",
        "Upon payment confirmation, $20 referral credit auto-applied to referrer's account",
        "Referrer receives SMS: 'Thanks for the referral! $20 credit added to your account'",
        "Admin dashboard shows conversion: 1 use, $150 revenue, $20 credit issued",
        "Referral analytics track code performance across all 9 reward types"
      ],
      highlight: "Automated referral tracking"
    },
    {
      scenario: "Multi-Channel Conversation",
      flow: [
        "Customer starts on Facebook Messenger: 'Do you detail trucks?'",
        "Business responds via unified inbox",
        "Customer switches to SMS: 'What's the price for F-150?'",
        "System recognizes same customer (phone matching)",
        "Continues conversation seamlessly",
        "Full history visible across both platforms",
        "Booking completed via web chat widget"
      ],
      highlight: "Seamless cross-platform continuity"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => {
          const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
          const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
          return (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
              animate={{
                x: [Math.random() * width, Math.random() * width],
                y: [Math.random() * height, Math.random() * height],
                opacity: [0.2, 0.8, 0.2]
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 space-y-24">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-6"
        >
          <div className="flex justify-center mb-8">
            <CleanMachineLogo className="w-24 h-24" />
          </div>
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Clean Machine Auto Detail
          </h1>
          <p className="text-2xl md:text-3xl text-slate-300 font-light">
            AI-Powered Business Management System
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-6">
            <Badge className="px-6 py-2 text-lg bg-gradient-to-r from-green-500 to-emerald-500">
              <CheckCircle className="w-5 h-5 mr-2" />
              87% Automation Rate
            </Badge>
            <Badge className="px-6 py-2 text-lg bg-gradient-to-r from-blue-500 to-cyan-500">
              <PhoneCall className="w-5 h-5 mr-2" />
              Dual Phone Lines
            </Badge>
            <Badge className="px-6 py-2 text-lg bg-gradient-to-r from-purple-500 to-pink-500">
              <Brain className="w-5 h-5 mr-2" />
              AI Customer Intelligence
            </Badge>
            <Badge className="px-6 py-2 text-lg bg-gradient-to-r from-yellow-500 to-orange-500">
              <Gift className="w-5 h-5 mr-2" />
              9 Referral Reward Types
            </Badge>
          </div>
        </motion.div>

        {/* Intelligent Features Grid */}
        <section className="space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center space-y-4"
          >
            <h2 className="text-5xl font-bold text-white">Intelligent Features</h2>
            <p className="text-xl text-slate-400">Revolutionary automation that understands context</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {intelligentFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                >
                  <Card className="h-full bg-slate-900/50 border-slate-700 backdrop-blur hover:bg-slate-900/70 transition-all duration-300">
                    <CardHeader>
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <CardTitle className="text-2xl text-white">{feature.title}</CardTitle>
                      <CardDescription className="text-slate-400 text-base">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {feature.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="pt-4 border-t border-slate-700">
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                          {feature.stat}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Real-World Intelligence Scenarios */}
        <section className="space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4"
          >
            <h2 className="text-5xl font-bold text-white">See The Intelligence In Action</h2>
            <p className="text-xl text-slate-400">Real scenarios showing how Clean Machine thinks</p>
          </motion.div>

          <div className="space-y-8">
            {uniqueIntelligence.map((scenario, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
              >
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-900/30 to-purple-900/30">
                    <CardTitle className="text-2xl text-white flex items-center gap-3">
                      <Target className="w-6 h-6 text-cyan-400" />
                      {scenario.scenario}
                    </CardTitle>
                    <Badge className="w-fit bg-green-500/20 text-green-300 border-green-500/30">
                      {scenario.highlight}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {scenario.flow.map((step, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.2 + i * 0.1 }}
                          className="flex items-start gap-4"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            {i + 1}
                          </div>
                          <p className="text-slate-300 pt-1">{step}</p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Advanced Capabilities */}
        <section className="space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4"
          >
            <h2 className="text-5xl font-bold text-white">Advanced Capabilities</h2>
            <p className="text-xl text-slate-400">Enterprise-grade features built in</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {advancedCapabilities.map((capability, idx) => {
              const Icon = capability.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="h-full bg-slate-900/50 border-slate-700 backdrop-blur">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-4">
                        <Icon className="w-8 h-8 text-cyan-400" />
                        <CardTitle className="text-2xl text-white">{capability.category}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {capability.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-slate-300">
                            <Zap className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4"
          >
            <h2 className="text-5xl font-bold text-white">Powered By Industry Leaders</h2>
            <p className="text-xl text-slate-400">Best-in-class integrations</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {techStack.map((tech, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05 }}
              >
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 h-full">
                  <CardHeader>
                    <CardTitle className="text-lg text-cyan-400">{tech.name}</CardTitle>
                    <CardDescription className="text-slate-400 text-sm">
                      {tech.purpose}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center space-y-8 py-12"
        >
          <h2 className="text-4xl font-bold text-white">
            The Future of Auto Detailing Business Management
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Clean Machine combines intelligent automation with human-like understanding 
            to deliver exceptional customer experiences while reducing operational overhead.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-6">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-6 text-lg"
              onClick={() => setLocation('/schedule')}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book Now
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 px-8 py-6 text-lg"
              onClick={() => setLocation('/login')}
            >
              <Shield className="w-5 h-5 mr-2" />
              Dashboard Login
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
