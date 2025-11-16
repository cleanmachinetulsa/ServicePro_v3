import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import GoogleReviews from "@/components/GoogleReviews";
import { MessageSquare, CalendarClock, Phone, Award, Shield, Clock, CheckCircle, Star } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface Service {
  id: number;
  name: string;
  priceRange: string;
  overview: string;
}

export default function PrestigeGrid() {
  const { data: contentData } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
  });

  const { data: servicesData } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  const content = contentData?.content;
  const services = servicesData?.services || [];

  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const yReverse = useTransform(scrollYProgress, [0, 1], [0, -80]);

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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-slate-900 to-gray-950 text-white overflow-hidden relative">
      {/* Subtle parallax background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent"></div>
        <motion.div 
          style={{ y }}
          className="absolute top-[15%] right-[10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full filter blur-3xl"
        />
        <motion.div 
          style={{ y: yReverse }}
          className="absolute bottom-[25%] left-[5%] w-80 h-80 bg-yellow-600/10 rounded-full filter blur-3xl"
        />
      </div>

      {/* Premium header */}
      <header className="relative z-20 bg-black/20 backdrop-blur-sm border-b border-amber-900/20">
        <nav className="flex justify-between items-center max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-2">
            <Award className="h-8 w-8 text-amber-500" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-yellow-400">
              CLEAN MACHINE
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-white hover:bg-amber-500/10 hover:text-amber-400 transition-all"
            asChild
          >
            <Link href="/login" data-testid="button-login">
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        {/* Asymmetric Hero Section - Content Left */}
        <section className="py-16 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="space-y-8"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-6">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-100">Premium Mobile Detailing</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 leading-tight">
                Prestige Detail<br/>Delivered
              </h1>
              
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                {content?.aboutText || 'Experience elevated auto care with modular service packages, professional-grade results, and seamless booking.'}
              </p>
            </div>

            {/* Trust Badges - Integrated into Hero */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-amber-900/20">
                <Shield className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Fully Insured</h3>
                  <p className="text-xs text-gray-400">Licensed & Protected</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-amber-900/20">
                <Clock className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Same Day</h3>
                  <p className="text-xs text-gray-400">Fast Scheduling</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-amber-900/20">
                <CheckCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Satisfaction</h3>
                  <p className="text-xs text-gray-400">100% Guaranteed</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-amber-900/20">
                <Award className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Top Rated</h3>
                  <p className="text-xs text-gray-400">5-Star Reviews</p>
                </div>
              </div>
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white border-0"
                asChild
              >
                <Link href={content?.heroCtaLink || '/schedule'} data-testid="button-book-now">
                  Book Now
                </Link>
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                asChild
              >
                <a href={`tel:${content?.phoneNumber || '918-856-5711'}`} data-testid="button-call">
                  <Phone className="h-4 w-4 mr-2" />
                  {content?.phoneNumber || '918-856-5711'}
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Right side - Quick Action Cards */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="space-y-4"
          >
            <Card className="p-6 bg-gradient-to-br from-amber-950/30 to-yellow-950/20 border-amber-800/30 hover:border-amber-600/50 transition-all duration-300 cursor-pointer group">
              <Link href={content?.heroCtaLink || '/chat'}>
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30 group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="h-8 w-8 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">AI Assistant</h3>
                    <p className="text-sm text-gray-400">Get instant answers & quotes</p>
                  </div>
                </div>
              </Link>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-amber-950/30 to-yellow-950/20 border-amber-800/30 hover:border-amber-600/50 transition-all duration-300 cursor-pointer group">
              <Link href="/schedule">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30 group-hover:scale-110 transition-transform duration-300">
                    <CalendarClock className="h-8 w-8 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">Visual Scheduler</h3>
                    <p className="text-sm text-gray-400">See live availability & book</p>
                  </div>
                </div>
              </Link>
            </Card>

            <div className="text-center pt-4 text-sm text-gray-400">
              Trusted by 500+ vehicle owners in Tulsa
            </div>
          </motion.div>
        </section>

        {/* Services Grid - Modular 3-Column */}
        {services.length > 0 && (
          <section className="py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-yellow-500">
                Our Services
              </h2>
              <p className="text-gray-400 text-lg">Modular packages tailored to your needs</p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 9).map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className="p-6 bg-gradient-to-br from-slate-900/50 to-gray-900/50 border-amber-900/20 hover:border-amber-600/40 hover:bg-gradient-to-br hover:from-amber-950/30 hover:to-yellow-950/20 transition-all duration-300 h-full group">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold group-hover:text-amber-400 transition-colors">{service.name}</h3>
                      <CheckCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    </div>
                    <p className="text-amber-400 font-bold mb-3 text-lg">{service.priceRange}</p>
                    <p className="text-sm text-gray-400 line-clamp-3">{service.overview}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Button 
                size="lg"
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                asChild
              >
                <Link href="/schedule">
                  View All Services & Pricing →
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

      {/* Footer */}
      <footer className="relative z-10 mt-20 border-t border-amber-900/20 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4 text-amber-400">Clean Machine</h3>
              <p className="text-sm text-gray-400">
                Premium mobile auto detailing with professional results
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Quick Links</h3>
              <div className="flex flex-col gap-2">
                <Link href="/schedule" className="text-sm text-gray-400 hover:text-amber-400 transition-colors">
                  Book Appointment
                </Link>
                <Link href="/careers" className="text-sm text-gray-400 hover:text-amber-400 transition-colors">
                  Careers
                </Link>
                <Link href="/showcase" className="text-sm text-gray-400 hover:text-amber-400 transition-colors">
                  Investor Showcase
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contact</h3>
              <p className="text-sm text-gray-400 mb-2">
                {content?.phoneNumber || '918-856-5711'}
              </p>
              <p className="text-sm text-gray-400">
                Tulsa, Oklahoma
              </p>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-amber-900/20">
            <p className="text-sm text-gray-500">
              © 2025 Clean Machine Auto Detail. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
