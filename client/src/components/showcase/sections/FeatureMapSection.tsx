import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { PillTabs } from '../shared/PillTabs';
import { GlassCard } from '../shared/GlassCard';
import { Calendar, MessageSquare, Users, Truck, Settings, Check, Sparkles, TrendingUp, Zap, Edit, DollarSign, Briefcase, Phone, Map, QrCode, Smartphone, User, Star, Clock, FileText, Brain, Wallet, Gift, PhoneCall, Headphones } from 'lucide-react';

const mockupDetails: Record<string, { icon: any; text: string }[]> = {
  'Profile View': [
    { icon: User, text: 'Complete contact information & preferences' },
    { icon: Calendar, text: 'Full appointment history & scheduling' },
    { icon: MessageSquare, text: 'Communication logs across all channels' },
    { icon: Star, text: 'Service ratings & loyalty status' }
  ],
  'Service History': [
    { icon: Clock, text: 'Chronological service records with photos' },
    { icon: DollarSign, text: 'Payment history & invoices' },
    { icon: FileText, text: 'Service notes & technician feedback' },
    { icon: TrendingUp, text: 'Spending trends & service recommendations' }
  ]
};

const features = [
  {
    id: 'scheduling',
    label: 'Scheduling & Routing',
    icon: Calendar,
    accentColor: 'from-green-500 to-emerald-500',
    title: 'Smart Scheduling & Route Optimization',
    description: 'Calendar integration meets intelligent location clustering',
    bullets: [
      'Google Calendar API sync for real-time availability',
      'Location-based clustering reduces drive time',
      'Route optimization with Google Maps integration',
      'Conflict detection prevents double-booking',
      'Buffer time calculation between appointments',
      'Weather-aware rescheduling suggestions'
    ],
    mockups: [
      { title: 'Today\'s Route', desc: '5 stops, optimized path', color: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'Calendar View', desc: 'Week at a glance', color: 'from-purple-500/20 to-pink-500/20' }
    ]
  },
  {
    id: 'address-mapping',
    label: 'Address Verification',
    icon: Map,
    accentColor: 'from-cyan-500 to-blue-500',
    title: 'Interactive Address Confirmation',
    description: 'Google Maps integration ensures accurate service locations',
    bullets: [
      'Visual map confirmation with draggable pin',
      'Automatic address validation and geocoding',
      'Customers verify location before booking',
      'Lat/lng coordinates saved for technicians',
      'Address review flags for uncertain locations',
      'One-tap navigation to exact customer location'
    ],
    mockups: [
      { title: 'Map Confirm', desc: 'Drag pin to exact spot', color: 'from-cyan-500/20 to-blue-500/20' },
      { title: 'Auto-Geocode', desc: 'Validates addresses', color: 'from-blue-500/20 to-indigo-500/20' }
    ]
  },
  {
    id: 'qr-security',
    label: 'QR Security',
    icon: QrCode,
    accentColor: 'from-purple-500 to-pink-500',
    title: 'HMAC-Signed QR Codes',
    description: 'Secure customer identification without passwords',
    bullets: [
      'HMAC-SHA256 signed QR codes for security',
      'One-scan access to service history',
      'No passwords or login required',
      'Tamper-proof with cryptographic signatures',
      'Time-limited tokens prevent replay attacks',
      'Perfect for on-site customer verification'
    ],
    mockups: [
      { title: 'QR Generate', desc: 'Secure customer tokens', color: 'from-purple-500/20 to-pink-500/20' },
      { title: 'Scan Access', desc: 'Instant verification', color: 'from-pink-500/20 to-red-500/20' }
    ]
  },
  {
    id: 'phone-voice',
    label: 'Phone & Voice',
    icon: Phone,
    accentColor: 'from-teal-500 to-cyan-500',
    title: 'Advanced Twilio Voice System',
    description: 'Dual-line phone system with SIP integration and intelligent voicemail handling',
    bullets: [
      'Dual phone lines: Main (918-856-5304) + Jody\'s line (918-856-5711)',
      'Google Voice-style UI with line switching',
      'SIP routing with custom ringtones via Groundwire app',
      'Configurable ring duration (10-60 seconds before voicemail)',
      'After-hours voicemail with separate greeting (activates 30min after schedule)',
      'Caller ID passthrough preserves original caller number',
      'Recent Callers widget with click-to-call',
      'Voicemail transcription with AI-powered SMS responses',
      'Configurable notification preferences per line'
    ],
    mockups: [
      { title: 'Dual Lines', desc: 'Switch between lines', color: 'from-green-500/20 to-emerald-500/20' },
      { title: 'SIP Setup', desc: 'Groundwire integration', color: 'from-teal-500/20 to-cyan-500/20' }
    ]
  },
  {
    id: 'sms-email',
    label: 'Smart SMS & Email',
    icon: MessageSquare,
    accentColor: 'from-purple-500 to-pink-500',
    title: 'Automated Communication Suite',
    description: 'TCPA-compliant messaging with intelligent personalization',
    bullets: [
      'Auto-reply system with context awareness',
      'TCPA compliance built-in for SMS campaigns',
      'Template system with variable substitution',
      'Personalization based on service history',
      'Delivery tracking and read receipts',
      'Multi-channel orchestration (SMS + Email)'
    ],
    mockups: [
      { title: 'Auto-Reply', desc: 'Instant engagement', color: 'from-green-500/20 to-emerald-500/20' },
      { title: 'Templates', desc: '20+ pre-built', color: 'from-yellow-500/20 to-orange-500/20' }
    ]
  },
  {
    id: 'customer-profiles',
    label: 'Customer Profiles',
    icon: Users,
    accentColor: 'from-blue-500 to-cyan-500',
    title: 'Complete Customer Intelligence',
    description: 'Every vehicle, every service, every interaction tracked',
    bullets: [
      'Full service history with before/after photos',
      'Multi-vehicle tracking per customer',
      'Loyalty points system with rewards',
      'Referral tracking and credit management',
      'Automatic service reminders based on time/mileage',
      'Notes and preferences per customer'
    ],
    mockups: [
      { title: 'Profile View', desc: '360° customer data', color: 'from-indigo-500/20 to-purple-500/20' },
      { title: 'Service History', desc: 'Complete timeline', color: 'from-pink-500/20 to-red-500/20' }
    ]
  },
  {
    id: 'technician-mode',
    label: 'Technician iPad App',
    icon: Smartphone,
    accentColor: 'from-indigo-500 to-blue-500',
    title: 'App-Like PWA Experience',
    description: 'Install as an app on any device - no app store required',
    bullets: [
      'Progressive Web App with offline capability',
      'Add to home screen for native app feel',
      'Today\'s jobs with one-tap navigation',
      'Mobile workflow for check-in/check-out',
      'Push notifications for new assignments',
      'Real-time status updates to customers'
    ],
    mockups: [
      { title: 'PWA Install', desc: 'Works like a native app', color: 'from-blue-500/20 to-cyan-500/20' },
      { title: 'Offline Mode', desc: 'View jobs without signal', color: 'from-cyan-500/20 to-teal-500/20' }
    ]
  },
  {
    id: 'admin-dashboard',
    label: 'Admin Dashboard',
    icon: Settings,
    title: 'Business Control Center',
    description: 'Set the rules, let automation handle the rest',
    bullets: [
      'Service area radius configuration',
      'Minimum spend requirements per job',
      'Weather policy automation (rain rules)',
      'Upsell trigger configuration',
      'Pricing rules and dynamic adjustments',
      'Team permissions and role management'
    ],
    mockups: [
      { title: 'Rules Engine', desc: 'Set it and forget it', color: 'from-purple-500/20 to-pink-500/20' },
      { title: 'Analytics', desc: 'Real-time insights', color: 'from-orange-500/20 to-red-500/20' }
    ]
  },
  {
    id: 'employee-scheduling',
    label: 'Employee Scheduling',
    icon: Calendar,
    accentColor: 'from-fuchsia-500 to-purple-500',
    title: 'Employee Scheduling System',
    description: 'Complete shift management with automated conflict detection',
    bullets: [
      'Weekly calendar grid view',
      '30-day technician schedules',
      'PTO request workflows with approval',
      'Shift trading with race condition prevention',
      'Overtime warnings at 40+ hours/week',
      'SMS alerts for schedule changes',
      'Shift-appointment linking'
    ],
    mockups: [
      { title: 'Schedule Grid', desc: 'Weekly view', color: 'from-purple-500/20 to-pink-500/20' },
      { title: 'PTO Management', desc: 'Approval workflow', color: 'from-indigo-500/20 to-purple-500/20' }
    ]
  },
  {
    id: 'homepage-cms',
    label: 'Homepage CMS',
    icon: Edit,
    accentColor: 'from-sky-500 to-cyan-500',
    title: 'Homepage CMS Editor',
    description: 'Visual content management with real-time preview',
    bullets: [
      'Live split-screen editing',
      'Hero, About, Services sections',
      'Brand color customization (HSL)',
      'Logo upload and management',
      'SEO meta tags editor',
      'Real-time homepage updates'
    ],
    mockups: [
      { title: 'Live Preview', desc: 'Split-screen editing', color: 'from-cyan-500/20 to-blue-500/20' },
      { title: 'SEO Tools', desc: 'Meta tag editor', color: 'from-blue-500/20 to-indigo-500/20' }
    ]
  },
  {
    id: 'usage-dashboard',
    label: 'API Usage & Costs',
    icon: DollarSign,
    accentColor: 'from-emerald-500 to-green-500',
    title: 'API Usage & Cost Tracking',
    description: 'Real-time monitoring of all external service costs',
    bullets: [
      'Twilio SMS/Call tracking',
      'OpenAI token usage & costs',
      'Stripe payment processing fees',
      'SendGrid email statistics',
      'Service health monitoring',
      'MTD/YTD cost breakdowns'
    ],
    mockups: [
      { title: 'Cost Overview', desc: 'MTD/YTD breakdown', color: 'from-green-500/20 to-emerald-500/20' },
      { title: 'Health Status', desc: 'Service monitoring', color: 'from-emerald-500/20 to-teal-500/20' }
    ]
  },
  {
    id: 'careers-portal',
    label: 'Careers Portal',
    icon: Briefcase,
    accentColor: 'from-orange-500 to-red-500',
    title: 'Careers & Employment Portal',
    description: 'Attract and manage job applicants with ease',
    bullets: [
      'Public job listings page',
      'Application form with validation',
      'Resume upload (PDF/DOC/DOCX)',
      'Admin application review dashboard',
      'Status workflow management',
      'Candidate tracking & notes'
    ],
    mockups: [
      { title: 'Job Listings', desc: 'Public careers page', color: 'from-orange-500/20 to-red-500/20' },
      { title: 'Applications', desc: 'Admin review dashboard', color: 'from-red-500/20 to-pink-500/20' }
    ]
  },
  {
    id: 'customer-intelligence',
    label: 'Customer Intelligence',
    icon: Brain,
    accentColor: 'from-violet-500 to-purple-500',
    title: 'GPT-Powered Customer Intelligence',
    description: 'Returning customer tracking with personalized AI service recommendations',
    bullets: [
      'Automatic returning customer detection and tracking',
      'GPT personalization service analyzes customer history',
      'Personalized service recommendations based on past bookings',
      'Context-aware messaging references previous services',
      'Vehicle-specific maintenance reminders',
      'Intelligent upselling based on customer preferences',
      'Service frequency analysis and insights'
    ],
    mockups: [
      { title: 'Customer Insights', desc: 'AI-powered analysis', color: 'from-purple-500/20 to-pink-500/20' },
      { title: 'Smart Suggestions', desc: 'Personalized offers', color: 'from-pink-500/20 to-red-500/20' }
    ]
  },
  {
    id: 'cash-payments',
    label: 'Cash Tracking',
    icon: Wallet,
    accentColor: 'from-lime-500 to-green-500',
    title: 'Cash Payment & Deposit Management',
    description: 'Manual cash entry with daily deposit tracking for technicians',
    bullets: [
      'Manual cash payment entry for on-site collections',
      'Daily deposit summary widget for technicians',
      'Cash collections widget tracks amounts by technician',
      'Deposit history with date and amount tracking',
      'Integration with job completion workflow',
      'Admin oversight of all cash transactions',
      'Reconciliation tools for daily cash management'
    ],
    mockups: [
      { title: 'Cash Entry', desc: 'Quick payment logging', color: 'from-green-500/20 to-emerald-500/20' },
      { title: 'Daily Deposits', desc: 'Technician tracking', color: 'from-emerald-500/20 to-teal-500/20' }
    ]
  },
  {
    id: 'referral-system',
    label: 'Referral Program',
    icon: Gift,
    accentColor: 'from-amber-500 to-orange-500',
    title: 'Complete Referral Rewards System',
    description: '9 reward types with admin code generation and comprehensive tracking',
    bullets: [
      '9 reward types: percentage off, fixed amount, free service, BOGO, upgrade, points bonus, gift card, early access, VIP tier',
      'Admin tools for referral code generation and management',
      'Automatic referrer credit tracking on invoice payment',
      'Referral code input during booking flow',
      'Usage tracking and redemption analytics',
      'Configurable reward values and expiration dates',
      'Referral performance dashboard with conversion metrics'
    ],
    mockups: [
      { title: 'Code Generator', desc: '9 reward types', color: 'from-yellow-500/20 to-orange-500/20' },
      { title: 'Tracking Dashboard', desc: 'Analytics & credits', color: 'from-orange-500/20 to-red-500/20' }
    ]
  }
];

export function FeatureMapSection() {
  const [activeFeature, setActiveFeature] = useState('scheduling');
  const active = features.find(f => f.id === activeFeature) || features[0];
  const Icon = active.icon;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = features.findIndex(f => f.id === activeFeature);
      
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setActiveFeature(features[currentIndex - 1].id);
      } else if (e.key === 'ArrowRight' && currentIndex < features.length - 1) {
        e.preventDefault();
        setActiveFeature(features[currentIndex + 1].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFeature]);

  return (
    <section id="feature-map" className="py-12 md:py-20 lg:py-24 relative">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <SectionHeader
          badge="Core Capabilities"
          title="Feature Map"
          subtitle="Fifteen integrated systems working together to run your entire operation"
        />

        <div className="relative">
          <PillTabs
            tabs={features.map(f => ({ 
              id: f.id, 
              label: f.label,
              accentColor: f.accentColor
            }))}
            activeTab={activeFeature}
            onChange={setActiveFeature}
            className="mb-8 md:mb-12 lg:mb-16"
          />
          <p className="text-center text-xs text-blue-200/60 mt-2 hidden sm:block">
            Use arrow keys ← → to navigate
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid lg:grid-cols-2 gap-6 md:gap-6 lg:gap-8 items-start"
          >
            {/* Left: Description */}
            <div className="space-y-4 md:space-y-4 lg:space-y-6">
              <div className="flex items-start gap-3 md:gap-3 lg:gap-4 mb-4 md:mb-5 lg:mb-6">
                <div className="p-3 md:p-4 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl md:rounded-2xl border border-blue-500/30 flex-shrink-0">
                  <Icon className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white leading-tight">{active.title}</h3>
                  <p className="text-sm md:text-base text-blue-200 mt-1">{active.description}</p>
                </div>
              </div>

              <div className="space-y-2 md:space-y-3">
                {active.bullets.map((bullet, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-2 md:gap-3"
                  >
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-green-400 mt-0.5 md:mt-1 flex-shrink-0" />
                    <p className="text-sm md:text-base text-blue-100 leading-relaxed">{bullet}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: UI Mockups */}
            <div className="space-y-3 md:space-y-3 lg:space-y-4">
              {active.mockups.map((mockup, i) => {
                const details = mockupDetails[mockup.title];
                
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className={`bg-gradient-to-br ${mockup.color} backdrop-blur-xl border border-white/20 rounded-xl md:rounded-2xl p-5 md:p-4 lg:p-8 cursor-pointer group relative overflow-hidden`}
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="relative z-10">
                      <h4 className="text-lg md:text-xl font-semibold text-white mb-1 md:mb-2">{mockup.title}</h4>
                      <p className="text-sm md:text-base text-blue-200">{mockup.desc}</p>
                      
                      {details ? (
                        <div className="mt-4 md:mt-4 lg:mt-6 space-y-2 md:space-y-2 lg:space-y-3">
                          {details.map((feature, featureIndex) => {
                            const FeatureIcon = feature.icon;
                            return (
                              <motion.div
                                key={featureIndex}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: featureIndex * 0.1 }}
                                className="flex items-start gap-2 md:gap-3"
                              >
                                <div className="p-1.5 md:p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex-shrink-0">
                                  <FeatureIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-300" />
                                </div>
                                <span className="text-xs md:text-sm text-blue-100/80 leading-relaxed">{feature.text}</span>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-4 md:mt-4 lg:mt-6 space-y-2">
                          <div className="h-2.5 md:h-3 bg-white/10 rounded-full w-3/4" />
                          <div className="h-2.5 md:h-3 bg-white/10 rounded-full w-full" />
                          <div className="h-2.5 md:h-3 bg-white/10 rounded-full w-1/2" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
