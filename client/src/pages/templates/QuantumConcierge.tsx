import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import ServiceShowcaseGrid from "@/components/ServiceShowcaseGrid";
import GoogleReviews from "@/components/GoogleReviews";
import { 
  CalendarClock, 
  MessageSquare, 
  Phone, 
  Sparkles,
  Shield,
  Zap,
  Star,
  ArrowRight
} from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface QuantumConciergeProps {
  content?: HomepageContent;
}

export default function QuantumConcierge({ content }: QuantumConciergeProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Smooth parallax scrolling
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
  
  const heroY = useTransform(smoothProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.5], [1, 0]);

  // Update SEO meta tags
  useEffect(() => {
    if (content) {
      document.title = content.metaTitle;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', content.metaDescription);
    }
  }, [content]);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Premium GPU-accelerated background */}
      <div className="fixed inset-0 z-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-blue-950/20 to-purple-950/20" />
        
        {/* Animated gradient orbs - GPU optimized */}
        <motion.div 
          className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'conic-gradient(from 0deg, #3b82f6, #8b5cf6, #3b82f6)',
            filter: 'blur(120px)',
            willChange: 'transform'
          }}
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        <motion.div 
          className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'conic-gradient(from 180deg, #8b5cf6, #3b82f6, #8b5cf6)',
            filter: 'blur(100px)',
            willChange: 'transform'
          }}
          animate={{
            rotate: -360,
            scale: [1, 1.15, 1]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }} />
      </div>

      {/* Top Navigation - Glass morphism */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <nav className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            CLEAN MACHINE
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-100 hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
              asChild
            >
              <Link href="/login" data-testid="button-login">
                Dashboard
              </Link>
            </Button>
          </motion.div>
        </nav>
      </header>

      {/* Hero Section - Split design with parallax */}
      <section 
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center pt-20 pb-10 px-4 overflow-hidden"
      >
        <motion.div 
          className="max-w-7xl mx-auto w-full"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="space-y-8 z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 backdrop-blur-sm mb-6">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300">AI-Powered Auto Detailing</span>
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight">
                  <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                    Premium Detail,
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-gradient-x">
                    Zero Hassle
                  </span>
                </h1>
                
                <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-xl">
                  {content?.aboutText || 'Book instantly with AI, schedule visually, or call anytime. Professional auto detailing right in your driveway.'}
                </p>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Button 
                  size="lg"
                  className="
                    group relative overflow-hidden
                    bg-gradient-to-r from-blue-500 to-purple-600
                    hover:from-blue-600 hover:to-purple-700
                    text-white font-bold
                    px-8 py-6 text-lg
                    shadow-2xl shadow-blue-500/30
                    border-0
                    transition-all duration-300
                  "
                  asChild
                  data-testid="button-hero-ai-chat"
                >
                  <Link href={content?.heroCtaLink || '/chat'} className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5" />
                    <span>{content?.heroCtaText || 'Chat with AI'}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </Link>
                </Button>
                
                <Button 
                  size="lg"
                  variant="outline"
                  className="
                    group
                    border-2 border-blue-400/50 
                    hover:border-blue-400
                    bg-white/5 hover:bg-white/10
                    backdrop-blur-sm
                    text-white font-semibold
                    px-8 py-6 text-lg
                    transition-all duration-300
                  "
                  asChild
                  data-testid="button-hero-visual-scheduler"
                >
                  <Link href="/schedule" className="flex items-center gap-3">
                    <CalendarClock className="w-5 h-5" />
                    <span>Visual Scheduler</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-wrap items-center gap-6 pt-4"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 border-2 border-black" />
                    ))}
                  </div>
                  <span className="text-sm text-gray-400">1,200+ Happy Customers</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-semibold">4.9/5.0</span>
                  <span className="text-sm text-gray-400">on Google</span>
                </div>
              </motion.div>
            </div>

            {/* Right: Interactive feature cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="grid grid-cols-2 gap-4 lg:gap-6"
            >
              {[
                { icon: MessageSquare, label: 'AI Assistant', desc: '24/7 Instant Booking' },
                { icon: Zap, label: 'Same Day', desc: 'Service Available' },
                { icon: Shield, label: 'Insured', desc: '100% Protected' },
                { icon: CalendarClock, label: 'Flexible', desc: 'You Pick the Time' }
              ].map((feature, i) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                  whileHover={{ 
                    scale: 1.05, 
                    rotateZ: i % 2 === 0 ? 2 : -2,
                    transition: { duration: 0.2 }
                  }}
                  className="
                    group p-6 rounded-2xl
                    bg-gradient-to-br from-white/[0.07] to-white/[0.03]
                    border border-white/10
                    hover:border-blue-400/50
                    backdrop-blur-xl
                    cursor-pointer
                    transition-all duration-300
                  "
                >
                  <feature.icon className="w-8 h-8 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-white mb-1">{feature.label}</h3>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
          >
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Services Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 backdrop-blur-sm mb-6">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">Our Services</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                {content?.servicesHeading || 'Choose Your Detail'}
              </span>
            </h2>
            
            {content?.servicesSubheading && (
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                {content.servicesSubheading}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <ServiceShowcaseGrid />
          </motion.div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                What Customers Say
              </span>
            </h2>
          </motion.div>

          <GoogleReviews />
        </div>
      </section>

      {/* Call to Action Strip */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="
              p-8 sm:p-12 rounded-3xl
              bg-gradient-to-br from-blue-500/10 to-purple-500/10
              border border-blue-400/20
              backdrop-blur-xl
              text-center
            "
          >
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Ready to Transform Your Ride?
              </span>
            </h3>
            <p className="text-gray-300 mb-8 max-w-xl mx-auto">
              Book in 60 seconds with our AI assistant, or call us directly for personalized service.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                className="
                  bg-gradient-to-r from-blue-500 to-purple-600
                  hover:from-blue-600 hover:to-purple-700
                  text-white font-bold
                  px-8 py-6
                  shadow-2xl shadow-blue-500/30
                  border-0
                "
                asChild
                data-testid="button-cta-chat"
              >
                <Link href="/chat" className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Chat Now
                </Link>
              </Button>
              
              <Button 
                size="lg"
                className="
                  bg-green-600 hover:bg-green-700
                  text-white font-bold
                  px-8 py-6
                  shadow-2xl shadow-green-500/30
                  border-0
                "
                asChild
                data-testid="button-cta-call"
              >
                <a href="tel:+19188565304" className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  (918) 856-5304
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-12 px-4 mt-20">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>© 2024 Clean Machine Auto Detail. All rights reserved.</p>
          <div className="flex gap-6 justify-center mt-4">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/careers" className="hover:text-white transition-colors">
              Careers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
