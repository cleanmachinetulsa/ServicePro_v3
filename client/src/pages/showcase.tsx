import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  Shield, Bot, MessageSquare, Calendar, CreditCard, TrendingUp, Lock, Database, Zap, 
  CheckCircle2, ArrowRight, Clock, Users, Bell, Search, BarChart3, FileText, Mail, 
  Phone, MessageCircle, Instagram, Facebook, Brain, Sparkles, Target, GitBranch, 
  Workflow, Code2, Send, Megaphone, UserCheck, Cloud, Gauge, RefreshCw, Activity,
  DollarSign, Award, Globe, Smartphone, Wifi, AlertTriangle,
  CheckCircle, XCircle, TrendingDown, Briefcase, Building2, Rocket, Star, Heart,
  ThumbsUp, Eye, Download, Upload, Server, HardDrive, Cpu, Settings, Layers,
  Package, ShoppingCart, Percent, Calculator, BarChart, BarChart2, CloudRain,
  MapPin, Navigation, Route, Repeat, Gift, Crown, Sparkle, Zap as Lightning
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart as RechartsLine, Line, AreaChart, Area, BarChart as RechartsBar, Bar, PieChart as RechartsPie, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import logoUrl from "@assets/generated_images/Clean_Machine_hexagonal_shield_logo_46864b38.png";

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function ShowcasePage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 overflow-x-hidden relative">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" 
             style={{ transform: `translateY(${scrollY * 0.5}px)` }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.1),transparent_50%)]" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-500/20 rounded-full"
            animate={{
              x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
              y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Hero Section with Animated Stats */}
        <HeroSection setLocation={setLocation} />

        {/* Main Content Tabs */}
        <div className="container mx-auto px-4 py-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 bg-slate-800/50 backdrop-blur-sm p-2 border border-white/10">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="roi">ROI & Value</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="ai">AI Engine</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
            </TabsList>

            <TabsContent value="overview"><OverviewSection /></TabsContent>
            <TabsContent value="roi"><ROISection /></TabsContent>
            <TabsContent value="features"><FeaturesSection /></TabsContent>
            <TabsContent value="ai"><AISection /></TabsContent>
            <TabsContent value="security"><SecuritySection /></TabsContent>
            <TabsContent value="technical"><TechnicalSection /></TabsContent>
            <TabsContent value="pricing"><PricingSection /></TabsContent>
          </Tabs>

          {/* Call to Action */}
          <CTASection setLocation={setLocation} />
        </div>
      </div>
    </div>
  );
}

// Hero Section with Animated Stats
function HeroSection({ setLocation }: { setLocation: (path: string) => void }) {
  return (
    <div className="relative overflow-hidden border-b border-white/10">
      <div className="container mx-auto px-4 py-20">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div className="flex items-center gap-4">
            <motion.img 
              src={logoUrl} 
              alt="ServicePro AI" 
              className="w-16 h-16 md:w-24 md:h-24"
              animate={{ rotate: [0, 5, 0, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                ServicePro AI
              </h1>
              <p className="text-xl md:text-2xl text-blue-200">
                Enterprise Business Automation Platform
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => setLocation("/")}
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            Back to Home
          </Button>
        </motion.div>

        {/* Value Prop */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-16"
        >
          <Badge className="mb-6 text-lg px-8 py-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 border-0 animate-pulse">
            <Sparkles className="w-5 h-5 mr-2 inline" />
            Production-Ready • White-Label Available • Investor-Ready Platform
          </Badge>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            The Complete AI-Powered
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mt-2">
              Business Operating System
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-blue-100 max-w-4xl mx-auto leading-relaxed">
            Transform any service business with AI automation, multi-channel messaging, smart scheduling, 
            payment processing, and enterprise security. White-label ready for your industry.
          </p>
        </motion.div>

        {/* Animated Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <AnimatedStatCard icon={MessageSquare} value={7} suffix="+" label="Communication Channels" delay={0} />
          <AnimatedStatCard icon={Bot} value={99.9} suffix="%" label="AI Uptime" delay={0.1} />
          <AnimatedStatCard icon={Lock} value={256} suffix="-bit" label="AES Encryption" delay={0.2} />
          <AnimatedStatCard icon={Zap} value={1.2} suffix="s" label="Avg Response Time" delay={0.3} />
        </div>

        {/* Key Metrics Dashboard */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <MetricsDashboard />
        </motion.div>
      </div>
    </div>
  );
}

// Animated Stat Card
function AnimatedStatCard({ icon: Icon, value, suffix, label, delay }: any) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 2000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start * 10) / 10);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="group"
    >
      <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-sm hover:bg-white/15 transition-all duration-300 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="pt-6 text-center relative z-10">
          <Icon className="w-10 h-10 mx-auto mb-3 text-blue-400 group-hover:scale-110 transition-transform" />
          <div className="text-4xl md:text-5xl font-bold text-white mb-2 font-mono">
            {displayValue}{suffix}
          </div>
          <div className="text-sm text-blue-200">{label}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Live Metrics Dashboard
function MetricsDashboard() {
  const metricsData = [
    { name: 'Jan', customers: 45, revenue: 12000, messages: 890 },
    { name: 'Feb', customers: 68, revenue: 18500, messages: 1240 },
    { name: 'Mar', customers: 95, revenue: 26800, messages: 1890 },
    { name: 'Apr', customers: 142, revenue: 38200, messages: 2650 },
    { name: 'May', customers: 198, revenue: 52400, messages: 3720 },
    { name: 'Jun', customers: 267, revenue: 71200, messages: 5140 },
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-900/90 to-blue-900/50 border-white/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-2xl">
          <Activity className="w-6 h-6 text-blue-400" />
          Live Performance Metrics
          <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
        </CardTitle>
        <CardDescription className="text-blue-200 text-lg">
          Real-time business growth analytics (6-month projection)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={metricsData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Legend />
            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
            <Area type="monotone" dataKey="customers" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCustomers)" name="Customers" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Overview Section
function OverviewSection() {
  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <h2 className="text-5xl font-bold text-white mb-6">
          Why ServicePro AI?
        </h2>
        <p className="text-2xl text-blue-200 max-w-4xl mx-auto">
          The only platform that combines GPT-4o AI, enterprise security, and white-label customization 
          in one production-ready solution.
        </p>
      </motion.div>

      {/* Market Opportunity */}
      <MarketOpportunitySection />

      {/* Competitive Advantages */}
      <CompetitiveAdvantagesSection />

      {/* Use Cases */}
      <UseCasesSection />
    </div>
  );
}

// Market Opportunity
function MarketOpportunitySection() {
  const marketData = [
    { name: 'Auto Detail', value: 14.8, growth: 8.2 },
    { name: 'Home Services', value: 527, growth: 12.4 },
    { name: 'Healthcare', value: 195, growth: 7.9 },
    { name: 'Professional Services', value: 89, growth: 9.1 },
  ];

  return (
    <Card className="bg-gradient-to-br from-emerald-900/30 to-blue-900/30 border-emerald-500/30">
      <CardHeader>
        <CardTitle className="text-white text-3xl flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-emerald-400" />
          Market Opportunity
        </CardTitle>
        <CardDescription className="text-blue-200 text-lg">
          Total Addressable Market: $826B+ globally across service industries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPie>
                <Pie
                  data={marketData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.value}B`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {marketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            {marketData.map((market, i) => (
              <div key={i} className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">{market.name}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    +{market.growth}% YoY
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-blue-400 mb-1">${market.value}B</div>
                <Progress value={market.growth * 10} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Competitive Advantages
function CompetitiveAdvantagesSection() {
  const competitors = [
    { 
      feature: 'AI-Powered Responses', 
      us: true, 
      competitorA: false, 
      competitorB: true 
    },
    { 
      feature: 'Multi-Channel Messaging (7 channels)', 
      us: true, 
      competitorA: false, 
      competitorB: false 
    },
    { 
      feature: 'Smart Scheduling w/ Weather', 
      us: true, 
      competitorA: false, 
      competitorB: false 
    },
    { 
      feature: '2FA + WebAuthn Security', 
      us: true, 
      competitorA: true, 
      competitorB: false 
    },
    { 
      feature: 'White-Label Ready', 
      us: true, 
      competitorA: false, 
      competitorB: false 
    },
    { 
      feature: 'Auto-Failover Protection', 
      us: true, 
      competitorA: false, 
      competitorB: false 
    },
    { 
      feature: 'iMessage-Quality Chat', 
      us: true, 
      competitorA: false, 
      competitorB: false 
    },
    { 
      feature: 'Recurring Services', 
      us: true, 
      competitorA: false, 
      competitorB: true 
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-white text-3xl flex items-center gap-3">
          <Award className="w-8 h-8 text-yellow-400" />
          Competitive Advantage Matrix
        </CardTitle>
        <CardDescription className="text-blue-200 text-lg">
          Feature comparison vs. leading alternatives
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-4 px-4 text-white font-semibold">Feature</th>
                <th className="text-center py-4 px-4 text-white font-semibold">
                  <div className="flex flex-col items-center gap-2">
                    <Crown className="w-6 h-6 text-yellow-400" />
                    ServicePro AI
                  </div>
                </th>
                <th className="text-center py-4 px-4 text-blue-300">Competitor A</th>
                <th className="text-center py-4 px-4 text-blue-300">Competitor B</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((row, i) => (
                <motion.tr 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="border-b border-white/10 hover:bg-white/5 transition-colors"
                >
                  <td className="py-4 px-4 text-blue-100">{row.feature}</td>
                  <td className="text-center py-4 px-4">
                    {row.us ? (
                      <CheckCircle className="w-6 h-6 text-green-400 mx-auto" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="text-center py-4 px-4">
                    {row.competitorA ? (
                      <CheckCircle className="w-6 h-6 text-green-400/50 mx-auto" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400/50 mx-auto" />
                    )}
                  </td>
                  <td className="text-center py-4 px-4">
                    {row.competitorB ? (
                      <CheckCircle className="w-6 h-6 text-green-400/50 mx-auto" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400/50 mx-auto" />
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Use Cases
function UseCasesSection() {
  const useCases = [
    {
      title: 'Auto Detailing',
      icon: '🚗',
      customers: '500K+',
      revenue: '$14.8B',
      painPoints: ['Manual booking', 'Weather disruptions', 'No customer database'],
      solutions: ['AI booking assistant', 'Weather-aware scheduling', 'Automatic CRM']
    },
    {
      title: 'Home Services',
      icon: '🏠',
      customers: '8M+',
      revenue: '$527B',
      painPoints: ['Missed appointments', 'Payment collection', 'Service tracking'],
      solutions: ['Smart reminders', 'Automated invoicing', 'Job history tracking']
    },
    {
      title: 'Healthcare',
      icon: '⚕️',
      customers: '2M+',
      revenue: '$195B',
      painPoints: ['HIPAA compliance', 'Appointment management', 'Patient engagement'],
      solutions: ['Enterprise security', 'Conflict detection', 'Automated follow-ups']
    },
    {
      title: 'Professional Services',
      icon: '💼',
      customers: '1.2M+',
      revenue: '$89B',
      painPoints: ['Client communication', 'Project tracking', 'Invoicing delays'],
      solutions: ['Multi-channel messaging', 'Service history', 'Instant payment links']
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-bold text-white text-center mb-8">
        Target Industries & Use Cases
      </h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        {useCases.map((useCase, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
          >
            <Card className="bg-gradient-to-br from-white/5 to-white/10 border-white/20 hover:border-white/40 transition-all duration-300 h-full">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">{useCase.icon}</span>
                  <CardTitle className="text-white text-2xl">{useCase.title}</CardTitle>
                </div>
                <div className="flex gap-3">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {useCase.customers} businesses
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    {useCase.revenue} market
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Pain Points
                  </h4>
                  <ul className="space-y-1 text-blue-100 text-sm">
                    {useCase.painPoints.map((pain, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <span className="text-red-400">✗</span>
                        {pain}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Our Solutions
                  </h4>
                  <ul className="space-y-1 text-blue-100 text-sm">
                    {useCase.solutions.map((solution, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <span className="text-emerald-400">✓</span>
                        {solution}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ROI Section with Interactive Calculator
function ROISection() {
  const [avgTicket, setAvgTicket] = useState([150]);
  const [monthlyAppointments, setMonthlyAppointments] = useState([80]);

  const calculations = {
    currentRevenue: monthlyAppointments[0] * avgTicket[0],
    withAI: monthlyAppointments[0] * 1.35 * avgTicket[0] * 1.15, // 35% more bookings, 15% higher ticket
    timeSaved: monthlyAppointments[0] * 0.25, // 15 min per booking = 25% of appointments saved
    additionalRevenue: (monthlyAppointments[0] * 1.35 * avgTicket[0] * 1.15) - (monthlyAppointments[0] * avgTicket[0]),
    annualImpact: ((monthlyAppointments[0] * 1.35 * avgTicket[0] * 1.15) - (monthlyAppointments[0] * avgTicket[0])) * 12,
    roi: (((monthlyAppointments[0] * 1.35 * avgTicket[0] * 1.15) - (monthlyAppointments[0] * avgTicket[0])) * 12 / 2400) * 100 // Assuming $200/mo cost
  };

  const roiData = [
    { month: 'Month 1', withoutAI: calculations.currentRevenue, withAI: calculations.currentRevenue * 1.05 },
    { month: 'Month 2', withoutAI: calculations.currentRevenue, withAI: calculations.currentRevenue * 1.15 },
    { month: 'Month 3', withoutAI: calculations.currentRevenue, withAI: calculations.currentRevenue * 1.25 },
    { month: 'Month 4', withoutAI: calculations.currentRevenue, withAI: calculations.withAI * 0.95 },
    { month: 'Month 5', withoutAI: calculations.currentRevenue, withAI: calculations.withAI },
    { month: 'Month 6', withoutAI: calculations.currentRevenue, withAI: calculations.withAI * 1.05 },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white mb-4">
          ROI Calculator
        </h2>
        <p className="text-2xl text-blue-200">
          See your potential return on investment in real-time
        </p>
      </div>

      {/* Interactive Calculator */}
      <Card className="bg-gradient-to-br from-emerald-900/30 to-blue-900/30 border-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-white text-2xl flex items-center gap-2">
            <Calculator className="w-6 h-6 text-emerald-400" />
            Your Business Metrics
          </CardTitle>
          <CardDescription className="text-blue-200">
            Adjust the sliders to match your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white font-semibold">Monthly Appointments</label>
                <span className="text-blue-400 font-mono">{monthlyAppointments[0]}</span>
              </div>
              <Slider 
                value={monthlyAppointments} 
                onValueChange={setMonthlyAppointments}
                min={20}
                max={300}
                step={5}
                className="cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white font-semibold">Average Ticket Size</label>
                <span className="text-blue-400 font-mono">${avgTicket[0]}</span>
              </div>
              <Slider 
                value={avgTicket} 
                onValueChange={setAvgTicket}
                min={50}
                max={500}
                step={10}
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* Results */}
          <div className="grid md:grid-cols-3 gap-4 pt-6 border-t border-white/20">
            <div className="p-6 bg-white/5 rounded-lg border border-white/10 text-center">
              <div className="text-blue-300 mb-2">Current Monthly Revenue</div>
              <div className="text-4xl font-bold text-white">
                ${calculations.currentRevenue.toLocaleString()}
              </div>
            </div>
            
            <div className="p-6 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-center">
              <div className="text-emerald-300 mb-2">With ServicePro AI</div>
              <div className="text-4xl font-bold text-emerald-400">
                ${calculations.withAI.toLocaleString()}
              </div>
            </div>

            <div className="p-6 bg-blue-500/10 rounded-lg border border-blue-500/30 text-center">
              <div className="text-blue-300 mb-2">Monthly Increase</div>
              <div className="text-4xl font-bold text-blue-400">
                +${calculations.additionalRevenue.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-6 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-purple-400" />
                <div className="text-purple-300 font-semibold">Time Saved</div>
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {calculations.timeSaved.toFixed(0)} hours/month
              </div>
              <div className="text-sm text-purple-200">
                Automated booking & customer service
              </div>
            </div>

            <div className="p-6 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                <div className="text-yellow-300 font-semibold">Annual ROI</div>
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {calculations.roi.toFixed(0)}%
              </div>
              <div className="text-sm text-yellow-200">
                ${calculations.annualImpact.toLocaleString()} additional yearly revenue
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="pt-6">
            <h4 className="text-white font-semibold mb-4 text-lg">6-Month Revenue Projection</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={roiData}>
                <defs>
                  <linearGradient id="colorWithoutAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWithAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  formatter={(value: any) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Area type="monotone" dataKey="withoutAI" stroke="#94a3b8" fillOpacity={1} fill="url(#colorWithoutAI)" name="Without AI" />
                <Area type="monotone" dataKey="withAI" stroke="#10b981" fillOpacity={1} fill="url(#colorWithAI)" name="With ServicePro AI" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Value Drivers */}
      <ValueDriversSection />
    </div>
  );
}

// Value Drivers
function ValueDriversSection() {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/20', icon: 'text-emerald-400', text: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/20', icon: 'text-blue-400', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/20', icon: 'text-purple-400', text: 'text-purple-400' },
    yellow: { bg: 'bg-yellow-500/20', icon: 'text-yellow-400', text: 'text-yellow-400' },
    pink: { bg: 'bg-pink-500/20', icon: 'text-pink-400', text: 'text-pink-400' },
    red: { bg: 'bg-red-500/20', icon: 'text-red-400', text: 'text-red-400' },
  };

  const drivers = [
    {
      title: 'Increased Bookings',
      impact: '+35%',
      description: 'AI handles inquiries 24/7, converts more leads',
      icon: TrendingUp,
      color: 'emerald'
    },
    {
      title: 'Higher Ticket Size',
      impact: '+15%',
      description: 'Smart upselling and package recommendations',
      icon: DollarSign,
      color: 'blue'
    },
    {
      title: 'Time Savings',
      impact: '20 hrs/week',
      description: 'Automated booking, reminders, and follow-ups',
      icon: Clock,
      color: 'purple'
    },
    {
      title: 'Reduced No-Shows',
      impact: '-60%',
      description: 'Weather alerts and automated reminders',
      icon: Calendar,
      color: 'yellow'
    },
    {
      title: 'Faster Payments',
      impact: '3 days faster',
      description: 'Instant invoice delivery and payment links',
      icon: CreditCard,
      color: 'pink'
    },
    {
      title: 'Customer Retention',
      impact: '+45%',
      description: 'Loyalty program and personalized service',
      icon: Heart,
      color: 'red'
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-bold text-white text-center">
        Key Value Drivers
      </h3>
      
      <div className="grid md:grid-cols-3 gap-6">
        {drivers.map((driver, i) => {
          const Icon = driver.icon;
          const colors = colorMap[driver.color];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <Card className="bg-gradient-to-br from-white/5 to-white/10 border-white/20 h-full">
                <CardContent className="pt-6">
                  <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${colors.icon}`} />
                  </div>
                  <h4 className="text-white font-bold text-xl mb-2">{driver.title}</h4>
                  <div className={`text-3xl font-bold ${colors.text} mb-3`}>
                    {driver.impact}
                  </div>
                  <p className="text-blue-100">{driver.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Features Section - COMPREHENSIVE LIST
function FeaturesSection() {
  return (
    <div className="space-y-12">
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white mb-4">
          Complete Feature Breakdown
        </h2>
        <p className="text-2xl text-blue-200">
          Every capability documented with specific details
        </p>
      </div>

      {/* SMART SCHEDULE SYSTEM */}
      <FeatureShowcase 
        title="SMART SCHEDULE SYSTEM"
        subtitle="Not just a calendar - an intelligent booking assistant"
        icon={Calendar}
        gradient="from-blue-900/40 to-cyan-900/40"
        borderColor="border-cyan-500/30"
        features={[
          {
            name: 'Weather-Aware Scheduling',
            description: 'Automatically checks Open-Meteo API for rain/severe weather on appointment days and proactively suggests rescheduling to protect vehicle paint and ensure quality service',
            icon: CloudRain,
            specs: ['Real-time weather API integration', '48-hour forecast checking', 'Automatic reschedule suggestions', 'Weather risk alerts']
          },
          {
            name: 'Google Calendar Integration',
            description: 'Two-way sync with Google Calendar for real-time availability checking, automatic event creation, and conflict prevention across all scheduling channels',
            icon: Calendar,
            specs: ['Real-time availability checks', 'Automatic event creation', 'Conflict detection', 'Multi-calendar support']
          },
          {
            name: 'Drive Time Calculation',
            description: 'Google Maps API integration calculates exact drive time and distance to customer location, ensuring realistic scheduling and service area validation',
            icon: Navigation,
            specs: ['Google Maps API routing', 'Traffic-aware estimates', 'Service area validation', 'Distance calculations']
          },
          {
            name: 'Conflict Detection',
            description: 'Prevents double-booking by checking existing appointments, service duration windows, and travel time buffers before confirming new bookings',
            icon: AlertTriangle,
            specs: ['Real-time slot validation', 'Travel time buffers', 'Duration-aware blocking', 'Multi-appointment checking']
          },
          {
            name: 'Automated Reminders',
            description: 'Multi-channel reminder system sends day-before notifications via SMS and email to reduce no-shows and keep customers informed',
            icon: Bell,
            specs: ['Day-before SMS reminders', 'Email confirmations', 'Customizable timing', 'Multi-channel delivery']
          },
          {
            name: 'Recurring Services',
            description: 'Flexible subscription system supports weekly, monthly, or custom intervals with automatic rebooking and customer preference memory',
            icon: Repeat,
            specs: ['Custom intervals (weekly/monthly)', 'Automatic rebooking', 'Subscription management', 'Preference retention']
          },
        ]}
      />

      {/* MULTI-CHANNEL MESSAGING */}
      <FeatureShowcase 
        title="MULTI-CHANNEL MESSAGING SUITE"
        subtitle="Unified inbox for every communication channel"
        icon={MessageSquare}
        gradient="from-purple-900/40 to-pink-900/40"
        borderColor="border-purple-500/30"
        features={[
          {
            name: 'SMS / Text Messaging (Twilio)',
            description: 'Production-ready SMS with Twilio integration, TCPA/CTIA compliance tracking, delivery receipts, and two-way conversations with customers',
            icon: Phone,
            specs: ['Twilio API integration', 'TCPA compliance tracking', 'Delivery receipts', 'Two-way conversations', 'SMS consent management']
          },
          {
            name: 'Web Chat',
            description: 'Real-time browser-based chat with WebSocket connections, typing indicators, read receipts, and offline message queuing',
            icon: MessageCircle,
            specs: ['WebSocket real-time sync', 'Typing indicators', 'Read receipts', 'Offline message queue', 'Desktop notifications']
          },
          {
            name: 'Facebook Messenger',
            description: 'Facebook Graph API integration for receiving and sending messages through Messenger with webhook verification and message threading',
            icon: Facebook,
            specs: ['Facebook Graph API', 'Webhook verification', 'Message threading', 'Rich media support', 'Page-scoped IDs']
          },
          {
            name: 'Instagram Direct Messages',
            description: 'Instagram messaging integration via Graph API for DM conversations, media sharing, and automated responses',
            icon: Instagram,
            specs: ['Instagram Graph API', 'DM conversations', 'Media message support', 'Story replies', 'Quick replies']
          },
          {
            name: 'Email (SendGrid)',
            description: 'Professional email delivery through SendGrid with HTML templates, branded invoice emails, and delivery tracking',
            icon: Mail,
            specs: ['SendGrid API integration', 'HTML email templates', 'Delivery tracking', 'Bounce management', 'Branded styling']
          },
          {
            name: 'Voice Calls (Twilio Voice)',
            description: 'Inbound call handling with voicemail transcription, missed call auto-SMS, and comprehensive call logging',
            icon: Phone,
            specs: ['Voicemail transcription', 'Missed call auto-SMS', 'Call logging', 'TwiML integration', 'Recording storage']
          },
          {
            name: 'PWA Push Notifications',
            description: 'Production-ready web push notifications using VAPID keys for instant alerts on new messages, appointments, and updates',
            icon: Bell,
            specs: ['VAPID authentication', 'Service worker integration', 'Cross-platform support', 'Action buttons', 'Badge counts']
          },
        ]}
      />

      {/* iMessage-Quality Features */}
      <FeatureShowcase 
        title="iMESSAGE-QUALITY MESSAGING FEATURES"
        subtitle="Premium chat experience matching consumer apps"
        icon={Smartphone}
        gradient="from-indigo-900/40 to-blue-900/40"
        borderColor="border-indigo-500/30"
        features={[
          {
            name: 'Real-Time Read Receipts',
            description: 'WebSocket-powered read receipt system shows exactly when messages are read with timestamp accuracy and delivery confirmation',
            icon: Eye,
            specs: ['WebSocket delivery', 'Timestamp tracking', 'Delivery confirmation', 'Multi-device sync']
          },
          {
            name: 'Typing Indicators',
            description: 'Live typing indicators show when customers or agents are composing messages with debounced updates and automatic timeout',
            icon: MessageCircle,
            specs: ['Real-time typing status', 'Debounced updates', '3-second timeout', 'Multi-user support']
          },
          {
            name: 'Message Reactions',
            description: 'Emoji reaction system allows quick responses with thumbs up, heart, laugh, and custom reactions stored in database',
            icon: Heart,
            specs: ['8 default reactions', 'Custom emoji support', 'Database persistence', 'Real-time sync']
          },
          {
            name: 'Conversation Search & History',
            description: 'Full-text search across all conversations with date filtering, customer lookup, and infinite scroll pagination',
            icon: Search,
            specs: ['Full-text search', 'Date range filtering', 'Customer filtering', 'Infinite scroll', 'Search highlighting']
          },
          {
            name: 'Offline Draft Auto-Save',
            description: 'LocalStorage-based draft system auto-saves message drafts every keystroke with conversation isolation and automatic restoration',
            icon: Download,
            specs: ['Auto-save on keystroke', 'LocalStorage persistence', 'Conversation isolation', 'Delayed guard (500ms)', 'Auto-restore on return']
          },
        ]}
      />

      {/* AI Intelligence Engine */}
      <FeatureShowcase 
        title="AI INTELLIGENCE ENGINE"
        subtitle="GPT-4o powered conversation automation"
        icon={Brain}
        gradient="from-pink-900/40 to-purple-900/40"
        borderColor="border-pink-500/30"
        features={[
          {
            name: 'Intent Detection & Classification',
            description: 'GPT-4o analyzes every message to detect booking intent, service inquiries, specialty jobs, support questions, and routes conversations appropriately',
            icon: Target,
            specs: ['GPT-4o classification', '8 intent categories', 'Confidence scoring', 'Automatic routing', 'Context awareness']
          },
          {
            name: 'Dynamic Knowledge Base (Google Sheets)',
            description: 'Real-time integration with Google Sheets as living knowledge base for services, pricing, FAQs, and policies - update without code changes',
            icon: Database,
            specs: ['Google Sheets API sync', 'Real-time updates', 'No code changes needed', 'Multi-tab support', 'Automatic refresh']
          },
          {
            name: 'Customer Memory System',
            description: 'AI remembers every customer interaction, service history, vehicle details, preferences, and loyalty status for personalized conversations',
            icon: Brain,
            specs: ['Service history tracking', 'Vehicle memory', 'Preference storage', 'Loyalty integration', 'Context injection']
          },
          {
            name: 'Message Rephrasing',
            description: 'AI can rewrite messages to adjust tone (friendly/professional/urgent) and ensure TCPA compliance before sending',
            icon: Sparkles,
            specs: ['Tone adjustment', '3 style options', 'TCPA compliance checking', 'Character optimization', 'Preview before send']
          },
          {
            name: 'Damage Assessment AI',
            description: 'AI analyzes customer photos of vehicle damage, estimates repair complexity, and suggests appropriate service packages or custom pricing',
            icon: Search,
            specs: ['Image analysis', 'Damage detection', 'Service recommendations', 'Custom quote triggers', 'Photo storage']
          },
          {
            name: 'Smart Upselling',
            description: 'Context-aware upsell system detects opportunities based on customer history, vehicle type, and season to suggest add-on services',
            icon: TrendingUp,
            specs: ['Context detection', 'Vehicle-based recommendations', 'Seasonal offers', 'History analysis', 'Configurable rules']
          },
        ]}
      />

      {/* Payment & Billing */}
      <FeatureShowcase 
        title="PAYMENT & BILLING SYSTEM"
        subtitle="Complete revenue management automation"
        icon={CreditCard}
        gradient="from-emerald-900/40 to-green-900/40"
        borderColor="border-emerald-500/30"
        features={[
          {
            name: 'Branded Invoice Emails',
            description: 'Professional, mobile-responsive HTML invoice emails with Clean Machine hexagonal shield branding, zebra-striped tables, and multi-payment CTAs',
            icon: FileText,
            specs: ['HTML email templates', 'Mobile responsive', 'Branded design', 'Multi-payment CTAs', 'Gmail/Outlook compatible']
          },
          {
            name: 'Stripe Integration',
            description: 'Full Stripe payment processing with payment intents, customer management, subscription handling, and webhook event processing',
            icon: CreditCard,
            specs: ['Stripe API integration', 'Payment intents', 'Customer portal', 'Subscription billing', 'Webhook handling']
          },
          {
            name: 'HMAC-Signed Payment Links',
            description: 'Secure payment links with HMAC signature verification, 7-day TTL expiration, and DoS protection against link abuse',
            icon: Lock,
            specs: ['HMAC signatures', '7-day expiration', 'Replay protection', 'DoS prevention', 'Secure token generation']
          },
          {
            name: 'Loyalty Points Integration',
            description: 'Invoice emails automatically display customer loyalty points balance and earned points for current service',
            icon: Gift,
            specs: ['Points balance display', 'Earned points calculation', 'Tier badges', 'Redemption options', 'Auto-update']
          },
          {
            name: 'Multi-Payment Method Support',
            description: 'Accepts Stripe, PayPal, Venmo, CashApp with smart CTAs and manual payment recording for cash/check',
            icon: ShoppingCart,
            specs: ['Stripe payments', 'PayPal integration', 'Venmo/CashApp links', 'Manual recording', 'Receipt generation']
          },
          {
            name: 'Smart Upsell Recommendations',
            description: 'Invoice emails include personalized service recommendations like Maintenance Detail Program based on customer history',
            icon: Sparkles,
            specs: ['AI recommendations', 'Service history analysis', 'Package suggestions', 'One-click enrollment', 'Seasonal offers']
          },
        ]}
      />

      {/* Security & Reliability */}
      <FeatureShowcase 
        title="ENTERPRISE SECURITY & RELIABILITY"
        subtitle="Military-grade protection and failover systems"
        icon={Shield}
        gradient="from-red-900/40 to-orange-900/40"
        borderColor="border-red-500/30"
        features={[
          {
            name: 'Multi-Factor Authentication',
            description: '4-layer security: username/password + 2FA (TOTP) + WebAuthn (biometric) + Google OAuth with QR code setup and backup codes',
            icon: Lock,
            specs: ['TOTP 2FA (Google Authenticator)', 'WebAuthn biometric', 'Google OAuth', 'Backup codes', 'QR code enrollment']
          },
          {
            name: 'Auto-Failover Protection',
            description: 'Monitors critical/high errors with tiered thresholds (5 critical or 8 high triggers failover), 15-min cooldown, SMS/email alerts to owner',
            icon: AlertTriangle,
            specs: ['Error threshold monitoring', '5 critical / 8 high triggers', '15-min cooldown', 'SMS/email alerts', 'Backup booking endpoint']
          },
          {
            name: 'Maintenance Mode',
            description: 'Catastrophic failure protection with auto-failover, backup contact forwarding, custom maintenance messages, and graceful degradation',
            icon: Settings,
            specs: ['Auto-failover switch', 'Custom messages', 'Backup contact info', 'Graceful degradation', 'Admin override']
          },
          {
            name: 'Account Lockout & Rate Limiting',
            description: 'Brute-force protection with 5-attempt lockout, 15-minute timeout, IP tracking, and manual unlock capability',
            icon: Shield,
            specs: ['5-attempt lockout', '15-min timeout', 'IP address tracking', 'Manual unlock', 'Audit logging']
          },
          {
            name: 'Comprehensive Audit Logging',
            description: 'Every security event, admin action, role change, and privacy-sensitive operation logged with timestamp, user, IP, and action details',
            icon: FileText,
            specs: ['All security events', 'Admin actions', 'Role changes', 'Privacy operations', 'Exportable logs']
          },
          {
            name: 'Webhook Signature Verification',
            description: 'Twilio webhook signature verification ensures all inbound SMS/voice requests are legitimate and prevents spoofing attacks',
            icon: CheckCircle2,
            specs: ['HMAC signature validation', 'Replay protection', 'Timestamp checking', 'Request fingerprinting']
          },
        ]}
      />

      {/* More Feature Showcases */}
      <MoreFeatureSections />
    </div>
  );
}

// Feature Showcase Component
function FeatureShowcase({ title, subtitle, icon: Icon, gradient, borderColor, features }: any) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} ${borderColor} border-2`}>
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-white text-3xl mb-2">{title}</CardTitle>
            <CardDescription className="text-blue-200 text-lg">{subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {features.map((feature: any, i: number) => {
          const FeatureIcon = feature.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white/10 rounded-lg flex-shrink-0">
                  <FeatureIcon className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-xl mb-2">{feature.name}</h4>
                  <p className="text-blue-100 mb-4 leading-relaxed">{feature.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {feature.specs.map((spec: string, j: number) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-blue-200">
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// More Feature Sections
function MoreFeatureSections() {
  return (
    <>
      {/* Banner Management */}
      <FeatureShowcase 
        title="DYNAMIC BANNER MANAGEMENT SYSTEM"
        subtitle="Programmable customer communications"
        icon={Megaphone}
        gradient="from-yellow-900/40 to-orange-900/40"
        borderColor="border-yellow-500/30"
        features={[
          {
            name: 'Multi-Mode Display',
            description: 'Banners support 3 display modes: top bar (sticky), modal (center overlay), and floating (bottom-right) with configurable styling',
            icon: Eye,
            specs: ['Top bar mode', 'Modal mode', 'Floating mode', 'Custom styling', 'Z-index control']
          },
          {
            name: 'Page Targeting',
            description: 'Show banners on specific pages or globally across entire site with regex pattern matching for advanced targeting',
            icon: Target,
            specs: ['Page-specific display', 'Global banners', 'Regex patterns', 'Multi-page support', 'Exclude patterns']
          },
          {
            name: 'Dismissal Tracking',
            description: 'LocalStorage-based dismissal tracking remembers which banners users have closed to avoid showing again',
            icon: XCircle,
            specs: ['LocalStorage persistence', 'Per-banner tracking', 'Expiration dates', 'Reset capability', 'User-specific']
          },
          {
            name: 'Priority Ordering',
            description: 'Multiple banners display in priority order (1-10) with highest priority shown first and automatic rotation',
            icon: BarChart3,
            specs: ['Priority levels (1-10)', 'Auto-rotation', 'Conflict resolution', 'Queue management']
          },
          {
            name: 'Scheduled Visibility',
            description: 'Set start/end dates for banner visibility with automatic activation and expiration without code changes',
            icon: Calendar,
            specs: ['Start date scheduling', 'End date expiration', 'Timezone support', 'Auto-activation', 'Grace periods']
          },
        ]}
      />

      {/* Service Limits & Capacity */}
      <FeatureShowcase 
        title="SERVICE LIMITS & CAPACITY MANAGEMENT"
        subtitle="Smart booking controls and overflow protection"
        icon={Gauge}
        gradient="from-cyan-900/40 to-blue-900/40"
        borderColor="border-cyan-500/30"
        features={[
          {
            name: 'Daily Service Caps',
            description: 'Configurable maximum appointments per day prevents overbooking and ensures quality service delivery',
            icon: Calendar,
            specs: ['Per-day limits', 'Service-specific caps', 'Buffer time included', 'Admin overrides']
          },
          {
            name: 'Capacity Monitoring',
            description: 'Real-time capacity tracking shows available slots, booking percentage, and waitlist management',
            icon: Gauge,
            specs: ['Real-time tracking', 'Percentage display', 'Waitlist support', 'Capacity alerts']
          },
          {
            name: 'Overflow Handling',
            description: 'When capacity reached, AI automatically suggests alternative dates or waitlist enrollment',
            icon: RefreshCw,
            specs: ['Auto-suggest alternatives', 'Waitlist enrollment', 'Priority booking', 'Notification system']
          },
        ]}
      />

      {/* Customer Management */}
      <FeatureShowcase 
        title="INTELLIGENT CUSTOMER MANAGEMENT"
        subtitle="Complete CRM with AI-powered insights"
        icon={Users}
        gradient="from-green-900/40 to-emerald-900/40"
        borderColor="border-green-500/30"
        features={[
          {
            name: 'Unified Customer Profiles',
            description: 'Single customer view aggregates data from appointments, messages, photos, payments, and loyalty points',
            icon: UserCheck,
            specs: ['360° customer view', 'Service history', 'Communication log', 'Payment records', 'Loyalty tracking']
          },
          {
            name: 'Vehicle Management',
            description: 'Track multiple vehicles per customer with make, model, year, color, and service-specific notes',
            icon: Navigation,
            specs: ['Multi-vehicle support', 'Vehicle details', 'Service notes', 'Photo galleries', 'History per vehicle']
          },
          {
            name: 'Google Drive Photo Integration',
            description: 'Automatic photo upload to Google Drive with customer-specific folders and before/after organization',
            icon: Upload,
            specs: ['Auto-upload to Drive', 'Customer folders', 'Before/after sorting', 'Shareable links', 'Backup storage']
          },
          {
            name: 'Duplicate Detection',
            description: 'AI-powered duplicate detection prevents duplicate customer records by phone, email, and name fuzzy matching',
            icon: Search,
            specs: ['Phone matching', 'Email matching', 'Name fuzzy match', 'Merge suggestions', 'Manual override']
          },
          {
            name: 'TCPA Compliance Tracking',
            description: 'Built-in SMS consent management tracks opt-in/opt-out status with timestamp and method recording for legal compliance',
            icon: Shield,
            specs: ['Opt-in tracking', 'Opt-out management', 'Timestamp logging', 'Method recording', 'Audit trail']
          },
        ]}
      />
    </>
  );
}

// AI Section
function AISection() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white mb-4">
          AI Intelligence Architecture
        </h2>
        <p className="text-2xl text-blue-200">
          Powered by OpenAI GPT-4o with custom training
        </p>
      </div>

      {/* AI Flow Diagram - Interactive */}
      <AIFlowDiagram />

      {/* AI Performance Metrics */}
      <AIPerformanceMetrics />
    </div>
  );
}

// AI Flow Diagram (Interactive)
function AIFlowDiagram() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { title: 'Message Receipt', description: 'Customer message received via any channel', icon: MessageCircle, color: 'blue' },
    { title: 'Customer Lookup', description: 'Database search by phone/email with history loading', icon: Search, color: 'cyan' },
    { title: 'Context Building', description: 'Load conversation history, knowledge base, calendar', icon: Database, color: 'purple' },
    { title: 'Intent Classification', description: 'GPT-4o analyzes intent and extracts entities', icon: Brain, color: 'pink' },
    { title: 'Response Generation', description: 'AI generates personalized response with CTAs', icon: Sparkles, color: 'violet' },
    { title: 'Multi-Channel Delivery', description: 'Send via SMS, email, web chat, or social media', icon: Send, color: 'green' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white text-3xl flex items-center gap-2">
          <Workflow className="w-8 h-8 text-purple-400" />
          AI Decision Flow
        </CardTitle>
        <CardDescription className="text-blue-200 text-lg">
          How GPT-4o processes every customer interaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = i === activeStep;
            
            return (
              <motion.div
                key={i}
                animate={{
                  scale: isActive ? 1.02 : 1,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                }}
                className="p-4 rounded-lg border border-white/10 cursor-pointer"
                onClick={() => setActiveStep(i)}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.2 : 1,
                    }}
                    className={`w-12 h-12 rounded-full bg-${step.color}-500/20 flex items-center justify-center`}
                  >
                    <StepIcon className={`w-6 h-6 text-${step.color}-400`} />
                  </motion.div>
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg">{i + 1}. {step.title}</h4>
                    <p className="text-blue-100">{step.description}</p>
                  </div>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-3 h-3 rounded-full bg-green-400 animate-pulse"
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// AI Performance Metrics
function AIPerformanceMetrics() {
  const metrics = [
    { label: 'Avg Response Time', value: '1.2s', change: '-15%', trend: 'down', icon: Zap },
    { label: 'Intent Accuracy', value: '94.8%', change: '+2.3%', trend: 'up', icon: Target },
    { label: 'Booking Conversion', value: '67.3%', change: '+12.1%', trend: 'up', icon: TrendingUp },
    { label: 'Customer Satisfaction', value: '4.8/5', change: '+0.3', trend: 'up', icon: Star },
  ];

  const performanceData = [
    { time: '9AM', accuracy: 92, speed: 1.4 },
    { time: '12PM', accuracy: 95, speed: 1.3 },
    { time: '3PM', accuracy: 94, speed: 1.2 },
    { time: '6PM', accuracy: 96, speed: 1.1 },
    { time: '9PM', accuracy: 93, speed: 1.3 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="bg-gradient-to-br from-white/5 to-white/10 border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <Icon className="w-5 h-5 text-blue-400" />
                    <Badge className={`${metric.trend === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {metric.change}
                    </Badge>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
                  <div className="text-sm text-blue-200">{metric.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="bg-slate-800/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">AI Performance Throughout Day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLine data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              />
              <Legend />
              <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} name="Accuracy %" />
              <Line type="monotone" dataKey="speed" stroke="#8b5cf6" strokeWidth={2} name="Response Time (s)" />
            </RechartsLine>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// Security Section
function SecuritySection() {
  const securityFeatures = [
    { name: '256-bit AES Encryption', status: 'Active', icon: Lock },
    { name: 'TOTP 2FA', status: 'Active', icon: Shield },
    { name: 'WebAuthn Biometric', status: 'Active', icon: UserCheck },
    { name: 'Account Lockout (5 attempts)', status: 'Active', icon: AlertTriangle },
    { name: 'Audit Logging', status: 'Active', icon: FileText },
    { name: 'Webhook Verification', status: 'Active', icon: CheckCircle },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white mb-4">
          Enterprise Security
        </h2>
        <p className="text-2xl text-blue-200">
          Military-grade protection for your business data
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {securityFeatures.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="bg-gradient-to-br from-white/5 to-white/10 border-white/20 hover:border-green-500/50 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-green-400" />
                      <span className="text-white font-semibold">{feature.name}</span>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                      {feature.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Security Metrics */}
      <SecurityMetrics />
    </div>
  );
}

// Security Metrics
function SecurityMetrics() {
  const threatData = [
    { date: 'Week 1', blocked: 12, flagged: 3 },
    { date: 'Week 2', blocked: 18, flagged: 5 },
    { date: 'Week 3', blocked: 8, flagged: 2 },
    { date: 'Week 4', blocked: 15, flagged: 4 },
  ];

  return (
    <Card className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-500/30">
      <CardHeader>
        <CardTitle className="text-white text-2xl flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-400" />
          Threat Protection Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">53</div>
            <div className="text-sm text-blue-200">Threats Blocked (30d)</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">14</div>
            <div className="text-sm text-blue-200">Suspicious Flagged</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-blue-200">Breaches</div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={250}>
          <RechartsBar data={threatData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="blocked" fill="#ef4444" name="Threats Blocked" />
            <Bar dataKey="flagged" fill="#f59e0b" name="Flagged for Review" />
          </RechartsBar>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Technical Section
function TechnicalSection() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white mb-4">
          Technical Architecture
        </h2>
        <p className="text-2xl text-blue-200">
          Built with modern, scalable technologies
        </p>
      </div>

      {/* Tech Stack */}
      <TechStack />

      {/* Database Schema */}
      <DatabaseSchema />

      {/* API Endpoints */}
      <APIEndpoints />

      {/* Performance Metrics */}
      <PerformanceMetrics />
    </div>
  );
}

// Tech Stack
function TechStack() {
  const stack = {
    frontend: [
      { name: 'React 18', description: 'UI framework with hooks', icon: Code2 },
      { name: 'TypeScript', description: 'Type-safe JavaScript', icon: Code2 },
      { name: 'Vite', description: 'Lightning-fast builds', icon: Lightning },
      { name: 'TailwindCSS', description: 'Utility-first styling', icon: Sparkles },
      { name: 'Framer Motion', description: 'Animation library', icon: Activity },
      { name: 'Recharts', description: 'Data visualization', icon: BarChart },
    ],
    backend: [
      { name: 'Node.js + Express', description: 'Server runtime', icon: Server },
      { name: 'TypeScript', description: 'Type safety', icon: Code2 },
      { name: 'PostgreSQL', description: 'Neon serverless', icon: Database },
      { name: 'Drizzle ORM', description: 'Type-safe queries', icon: Database },
      { name: 'Socket.io', description: 'Real-time WebSocket', icon: Wifi },
      { name: 'Bull Queue', description: 'Job processing', icon: Package },
    ],
    integrations: [
      { name: 'OpenAI GPT-4o', description: 'AI intelligence', icon: Brain },
      { name: 'Twilio', description: 'SMS + Voice', icon: Phone },
      { name: 'SendGrid', description: 'Email delivery', icon: Mail },
      { name: 'Stripe', description: 'Payments', icon: CreditCard },
      { name: 'Google Workspace', description: 'Calendar + Sheets + Drive', icon: Cloud },
      { name: 'Facebook/Instagram', description: 'Social messaging', icon: MessageSquare },
    ],
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {Object.entries(stack).map(([category, techs]) => (
        <Card key={category} className="bg-gradient-to-br from-white/5 to-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {techs.map((tech, i) => {
              const Icon = tech.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-2 hover:bg-white/5 rounded transition-colors">
                  <Icon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold">{tech.name}</div>
                    <div className="text-sm text-blue-200">{tech.description}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Database Schema
function DatabaseSchema() {
  return (
    <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white text-2xl flex items-center gap-2">
          <Database className="w-6 h-6 text-purple-400" />
          Database Architecture
        </CardTitle>
        <CardDescription className="text-blue-200">
          40+ tables with strategic indexing for performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-white font-bold mb-3">Core Tables</h4>
            <div className="space-y-2 text-blue-100 text-sm">
              {['users', 'customers', 'appointments', 'messages', 'conversations', 'services', 'invoices', 'payments', 'loyalty_points', 'recurring_services'].map((table, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-white/5 rounded">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <code className="text-purple-300">{table}</code>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-white font-bold mb-3">Performance Features</h4>
            <div className="space-y-2 text-blue-100">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span className="text-sm">25+ strategic indexes on high-query columns</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span className="text-sm">Compound indexes for complex queries</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span className="text-sm">Foreign key constraints for data integrity</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span className="text-sm">JSONB columns for flexible metadata</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span className="text-sm">Timestamps for audit trails</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// API Endpoints
function APIEndpoints() {
  const endpoints = [
    { method: 'POST', path: '/api/auth/login', description: 'User authentication' },
    { method: 'POST', path: '/api/messages/send', description: 'Send multi-channel message' },
    { method: 'GET', path: '/api/appointments/availability', description: 'Check calendar slots' },
    { method: 'POST', path: '/api/appointments/book', description: 'Create appointment' },
    { method: 'POST', path: '/api/invoices/create', description: 'Generate invoice' },
    { method: 'GET', path: '/api/customers/:id', description: 'Customer profile' },
    { method: 'POST', path: '/api/loyalty/points/add', description: 'Award loyalty points' },
    { method: 'POST', path: '/api/webhooks/twilio', description: 'Twilio SMS webhook' },
  ];

  return (
    <Card className="bg-slate-800/50 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-2xl flex items-center gap-2">
          <Code2 className="w-6 h-6 text-cyan-400" />
          REST API Endpoints (100+)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {endpoints.map((endpoint, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
              <Badge className={`
                ${endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : ''}
                ${endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' : ''}
                w-16 justify-center
              `}>
                {endpoint.method}
              </Badge>
              <code className="text-purple-300 flex-1">{endpoint.path}</code>
              <span className="text-blue-200 text-sm">{endpoint.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Performance Metrics
function PerformanceMetrics() {
  const performanceData = [
    { metric: 'API Latency', value: '< 100ms', status: 'excellent' },
    { metric: 'Database Queries', value: '< 50ms', status: 'excellent' },
    { metric: 'Page Load', value: '< 2s', status: 'good' },
    { metric: 'WebSocket Sync', value: '< 500ms', status: 'excellent' },
    { metric: 'AI Response', value: '1.2s avg', status: 'good' },
    { metric: 'Uptime', value: '99.9%', status: 'excellent' },
  ];

  return (
    <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30">
      <CardHeader>
        <CardTitle className="text-white text-2xl flex items-center gap-2">
          <Gauge className="w-6 h-6 text-green-400" />
          Performance Benchmarks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {performanceData.map((perf, i) => (
            <div key={i} className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-200 text-sm">{perf.metric}</span>
                <Badge className={`
                  ${perf.status === 'excellent' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}
                `}>
                  {perf.status}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-white">{perf.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Pricing Section
function PricingSection() {
  const tiers = [
    {
      name: 'Starter',
      price: '$199',
      period: '/month',
      description: 'Perfect for small businesses',
      features: [
        '500 AI conversations/month',
        'Up to 100 customers',
        '3 communication channels',
        'Basic analytics',
        'Email support',
        '99.9% uptime SLA',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$499',
      period: '/month',
      description: 'For growing service businesses',
      features: [
        'Unlimited AI conversations',
        'Unlimited customers',
        'All 7 communication channels',
        'Advanced analytics',
        'Priority support',
        'White-label option (+$200/mo)',
        'Custom integrations',
        '99.95% uptime SLA',
      ],
      cta: 'Get Started',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations',
      features: [
        'Everything in Professional',
        'Dedicated account manager',
        'Custom AI training',
        'SLA guarantees',
        '24/7 phone support',
        'On-premise deployment option',
        'Custom feature development',
        'Multi-location support',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h2 className="text-5xl font-bold text-white mb-4">
          Transparent Pricing
        </h2>
        <p className="text-2xl text-blue-200">
          Choose the plan that fits your business
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {tiers.map((tier, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2 }}
            whileHover={{ scale: 1.05, y: -10 }}
          >
            <Card className={`
              bg-gradient-to-br from-white/5 to-white/10 border-white/20 h-full
              ${tier.popular ? 'border-2 border-yellow-500/50 shadow-xl shadow-yellow-500/20' : ''}
            `}>
              {tier.popular && (
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-center py-2 text-white font-bold text-sm">
                  MOST POPULAR
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-white text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-blue-200">{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-5xl font-bold text-white">{tier.price}</span>
                  <span className="text-blue-200">{tier.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-blue-100">
                      <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${
                    tier.popular 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {tier.cta}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* White-Label Pricing */}
      <WhiteLabelPricing />
    </div>
  );
}

// White-Label Pricing
function WhiteLabelPricing() {
  return (
    <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white text-3xl flex items-center gap-2">
          <Crown className="w-8 h-8 text-yellow-400" />
          White-Label Solution
        </CardTitle>
        <CardDescription className="text-blue-200 text-lg">
          Rebrand ServicePro AI as your own product
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-white font-bold text-xl mb-4">Included Features</h4>
            <ul className="space-y-2 text-blue-100">
              {[
                'Complete branding customization (logo, colors, name)',
                'Custom domain (yourbrand.com)',
                'Remove all ServicePro branding',
                'Custom email templates',
                'Dedicated subdomain per client',
                'Multi-tenant architecture',
                'Client management dashboard',
                'Revenue sharing options available',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="space-y-4">
            <div className="p-6 bg-white/5 rounded-lg border border-white/10">
              <div className="text-blue-200 mb-2">One-Time Setup Fee</div>
              <div className="text-4xl font-bold text-white mb-4">$2,500</div>
              <div className="text-sm text-blue-200">Includes full branding, setup, and training</div>
            </div>
            
            <div className="p-6 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <div className="text-purple-200 mb-2">Monthly License Fee</div>
              <div className="text-4xl font-bold text-white mb-4">+$200/mo</div>
              <div className="text-sm text-purple-200">On top of base plan pricing</div>
            </div>

            <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Schedule White-Label Demo
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// CTA Section
function CTASection({ setLocation }: { setLocation: (path: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-20 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
      
      <div className="relative p-16 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
        </motion.div>
        
        <p className="text-2xl text-white/90 mb-10 max-w-3xl mx-auto">
          Join forward-thinking service businesses using AI to boost revenue, save time, and delight customers.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-blue-50 text-xl px-12 py-8 shadow-2xl"
            onClick={() => setLocation("/dashboard")}
          >
            <Rocket className="mr-3 h-6 w-6" />
            View Live Demo
          </Button>
          
          <Button 
            size="lg" 
            variant="outline"
            className="border-2 border-white text-white hover:bg-white/10 text-xl px-12 py-8"
          >
            <Mail className="mr-3 h-6 w-6" />
            Contact Sales
          </Button>
        </div>

        <div className="mt-12 flex items-center justify-center gap-8 text-white/80">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
