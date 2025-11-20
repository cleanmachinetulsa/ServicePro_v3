import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import GoogleReviews from "@/components/GoogleReviews";
import { MessageSquare, CalendarClock, Phone, Sparkles, Shield, Clock } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface Service {
  id: number;
  name: string;
  priceRange: string;
  overview: string;
}

interface LuminousConciergeProps {
  content?: HomepageContent;
}

export default function LuminousConcierge({ content: propsContent }: LuminousConciergeProps = {}) {
  const { data: contentData } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
    enabled: !propsContent,
  });

  const { data: servicesData } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  const content = propsContent || contentData?.content;
  const services = servicesData?.services || [];

  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900/20 to-slate-950 text-white overflow-hidden relative">
      {/* Premium animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent"></div>
        <motion.div 
          style={{ y }}
          className="absolute top-[10%] left-[5%] w-[600px] h-[600px] bg-blue-500/10 rounded-full filter blur-3xl"
        />
        <motion.div 
          style={{ y: useTransform(scrollYProgress, [0, 1], [0, -100]) }}
          className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl"
        />
      </div>

      {/* Glass morphism header */}
      <header className="relative z-20 backdrop-blur-md bg-white/5 border-b border-white/10">
        <nav className="flex justify-between items-center max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-cyan-400" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              CLEAN MACHINE
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-white hover:bg-white/10 transition-all backdrop-blur-sm"
            asChild
          >
            <Link href="/login" data-testid="button-login">
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        {/* Hero Section with Glassmorphism */}
        <section className="py-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-cyan-100">AI-Powered Auto Detailing</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-cyan-200">
              Premium Detail<br/>At Your Door
            </h1>
            
            <p className="text-lg md:text-xl text-blue-100/80 mb-12 max-w-3xl mx-auto leading-relaxed">
              {content?.aboutText || 'Experience luxury auto detailing with AI-powered booking, real-time updates, and concierge-level service.'}
            </p>
          </motion.div>

          {/* Floating Glass Cards for CTAs */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/20 hover:bg-white/10 transition-all duration-300 cursor-pointer group">
                <Link href={content?.heroCtaLink || '/chat'}>
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 group-hover:scale-110 transition-transform">
                      <MessageSquare className="h-8 w-8 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">AI Assistant</h3>
                      <p className="text-sm text-blue-200/70">Ask anything, get instant answers</p>
                    </div>
                  </div>
                </Link>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/20 hover:bg-white/10 transition-all duration-300 cursor-pointer group">
                <Link href="/schedule">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 group-hover:scale-110 transition-transform">
                      <CalendarClock className="h-8 w-8 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Visual Scheduler</h3>
                      <p className="text-sm text-blue-200/70">Book in seconds with live availability</p>
                    </div>
                  </div>
                </Link>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/20 hover:bg-white/10 transition-all duration-300 cursor-pointer group">
                <a href={`tel:${content?.phoneNumber || '918-856-5304'}`}>
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30 group-hover:scale-110 transition-transform">
                      <Phone className="h-8 w-8 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Call Now</h3>
                      <p className="text-sm text-blue-200/70">{content?.phoneNumber || '918-856-5304'}</p>
                    </div>
                  </div>
                </a>
              </Card>
            </motion.div>
          </div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-8 py-8 border-y border-white/10"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              <span className="text-sm text-blue-200/80">Fully Insured</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-400" />
              <span className="text-sm text-blue-200/80">Same-Day Available</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              <span className="text-sm text-blue-200/80">AI-Powered Service</span>
            </div>
          </motion.div>
        </section>

        {/* Services Grid */}
        {services.length > 0 && (
          <section className="py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                Our Services
              </h2>
              <p className="text-blue-200/70">Premium detailing packages for every need</p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/20 hover:bg-white/10 hover:border-cyan-400/40 transition-all duration-300 h-full">
                    <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                    <p className="text-cyan-400 font-bold mb-3">{service.priceRange}</p>
                    <p className="text-sm text-blue-200/70 line-clamp-3">{service.overview}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-8">
              <Button 
                size="lg"
                variant="outline"
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
                asChild
              >
                <Link href="/schedule">
                  View All Services →
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <GoogleReviews />
          </motion.div>
        </section>
      </main>

      {/* Glass Footer */}
      <footer className="relative z-10 mt-20 border-t border-white/10 backdrop-blur-md bg-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4 text-cyan-400">Clean Machine</h3>
              <p className="text-sm text-blue-200/70">
                Premium mobile auto detailing powered by AI
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Quick Links</h3>
              <div className="flex flex-col gap-2">
                <Link href="/schedule" className="text-sm text-blue-200/70 hover:text-cyan-400 transition-colors">
                  Book Appointment
                </Link>
                <Link href="/careers" className="text-sm text-blue-200/70 hover:text-cyan-400 transition-colors">
                  Careers
                </Link>
                <Link href="/showcase" className="text-sm text-blue-200/70 hover:text-cyan-400 transition-colors">
                  Investor Showcase
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contact</h3>
              <p className="text-sm text-blue-200/70 mb-2">
                {content?.phoneNumber || '918-856-5304'}
              </p>
              <p className="text-sm text-blue-200/70">
                Tulsa, Oklahoma
              </p>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-white/10">
            <p className="text-sm text-blue-200/50">
              © 2025 Clean Machine Auto Detail. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
