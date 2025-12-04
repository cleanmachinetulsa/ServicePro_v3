import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  Phone,
  MessageSquare,
  Calendar,
  Zap,
  CheckCircle2,
  Building2,
  Car,
  Home,
  Camera,
  Wrench,
  Scissors,
  Paintbrush,
  Leaf,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const FEATURED_INDUSTRIES = [
  { id: "auto_detailing_mobile", label: "Auto Detailing", icon: Car, color: "from-blue-500 to-cyan-500" },
  { id: "lawn_care", label: "Lawn Care", icon: Leaf, color: "from-green-500 to-emerald-500" },
  { id: "house_cleaning", label: "House Cleaning", icon: Home, color: "from-purple-500 to-pink-500" },
  { id: "photography_full", label: "Photography", icon: Camera, color: "from-amber-500 to-orange-500" },
  { id: "hvac", label: "HVAC", icon: Wrench, color: "from-red-500 to-rose-500" },
  { id: "barber_beauty", label: "Barber & Beauty", icon: Scissors, color: "from-indigo-500 to-violet-500" },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Pick your industry",
    description: "Choose from 20+ pre-configured industry templates with services, pricing, and AI behavior ready to go.",
    icon: Building2,
  },
  {
    step: 2,
    title: "Answer a few questions",
    description: "Set your business name, create your account, and customize your services in minutes.",
    icon: MessageSquare,
  },
  {
    step: 3,
    title: "Connect phone & SMS",
    description: "Link your Twilio number to enable AI-powered calls, voicemail, and text messaging.",
    icon: Phone,
  },
  {
    step: 4,
    title: "Launch your AI booking site",
    description: "Your public website goes live instantly with online booking, reviews, and customer portal.",
    icon: Zap,
  },
];

const FEATURES = [
  "AI SMS & voice agents that handle inquiries 24/7",
  "Automated appointment scheduling with calendar sync",
  "Customer loyalty & referral programs built-in",
  "Professional invoicing with Stripe payments",
  "Multi-channel messaging (SMS, web chat, Facebook)",
  "Public website with online booking",
];

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-600/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">ServicePro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing">
              <Button variant="ghost" className="text-slate-300 hover:text-white" data-testid="link-pricing">
                Pricing
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" data-testid="link-login">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 pt-16 pb-24 md:pt-24 md:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <Badge variant="secondary" className="mb-6 bg-blue-500/20 text-blue-300 border-blue-500/30">
            AI-Powered Business Automation
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
              ServicePro
            </span>
            <br />
            <span className="text-slate-300 text-3xl md:text-5xl">
              AI-powered automation for service businesses
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Bookings, messages, and follow-ups handled for you — so you can focus on the work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-lg px-8 py-6 h-auto"
              onClick={() => navigate("/onboarding/industry")}
              data-testid="button-get-started"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800 text-lg px-8 py-6 h-auto"
              onClick={() => window.open("/site/demo-detailing", "_blank")}
              data-testid="button-view-demo"
            >
              View Demo Site
              <ExternalLink className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features List */}
      <section className="relative z-10 container mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
        >
          {FEATURES.map((feature, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-slate-300">{feature}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            How It Works
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Get your AI-powered service business up and running in 4 simple steps
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="bg-slate-800/50 border-slate-700/50 h-full hover:border-blue-500/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                        {step.step}
                      </div>
                      <step.icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Supported Industries */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Built for Your Industry
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Pre-configured templates with services, pricing, and AI behavior tailored to your business
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {FEATURED_INDUSTRIES.map((industry, i) => (
              <motion.div
                key={industry.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Card
                  className="bg-slate-800/50 border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group"
                  onClick={() => navigate("/onboarding/industry")}
                  data-testid={`industry-card-${industry.id}`}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${industry.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <industry.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{industry.label}</h3>
                      <span className="text-xs text-slate-400">Ready to go</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => navigate("/onboarding/industry")}
              data-testid="button-see-all-industries"
            >
              See All 20+ Industries
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-3xl p-8 md:p-12 border border-blue-500/30 text-center max-w-4xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to automate your business?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Join hundreds of service businesses using AI to handle bookings, messages, and follow-ups automatically.
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-lg px-8 py-6 h-auto"
            onClick={() => navigate("/onboarding/industry")}
            data-testid="button-start-free-trial"
          >
            Start Your Free Trial
            <Sparkles className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 mt-12">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-400">Powered by ServicePro</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors" data-testid="footer-link-login">
                Login
              </Link>
              <Link href="/privacy-policy" className="text-slate-400 hover:text-white transition-colors" data-testid="footer-link-privacy">
                Privacy
              </Link>
              <a href="#" className="text-slate-400 hover:text-white transition-colors" data-testid="footer-link-terms">
                Terms
              </a>
            </div>

            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} ServicePro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
