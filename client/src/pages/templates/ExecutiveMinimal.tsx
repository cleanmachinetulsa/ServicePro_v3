import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import GoogleReviews from "@/components/GoogleReviews";
import { MessageSquare, CalendarClock, Phone, Shield, Clock, Sparkles } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface Service {
  id: number;
  name: string;
  priceRange: string;
  overview: string;
}

interface ExecutiveMinimalProps {
  content?: HomepageContent;
}

export default function ExecutiveMinimal({ content: propsContent }: ExecutiveMinimalProps = {}) {
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
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.3]);

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
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900 text-gray-900 dark:text-gray-100">
      {/* Minimal header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <nav className="flex justify-between items-center max-w-6xl mx-auto px-6 md:px-12 py-6">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-gray-900 dark:text-gray-100" strokeWidth={1.5} />
            <span className="text-lg font-light tracking-wide text-gray-900 dark:text-gray-100">
              CLEAN MACHINE
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 font-light"
            asChild
          >
            <Link href="/login" data-testid="button-login">
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-12">
        {/* Minimal Hero Section */}
        <section className="py-24 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center"
            style={{ opacity }}
          >
            <div className="mb-8">
              <span className="text-sm tracking-widest text-gray-500 dark:text-gray-400 uppercase">
                Premium Mobile Detailing
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-light mb-8 text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
              Excellence<br/>Delivered
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto font-light leading-relaxed">
              {content?.aboutText || 'Exceptional auto detailing with precision service, intelligent booking, and unwavering attention to detail.'}
            </p>

            {/* Minimal CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
              <Button 
                size="lg"
                className="bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 px-8 py-6 text-base font-light tracking-wide min-w-[200px]"
                asChild
              >
                <Link href={content?.heroCtaLink || '/chat'} data-testid="button-chat">
                  Get Started
                </Link>
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 px-8 py-6 text-base font-light tracking-wide min-w-[200px]"
                asChild
              >
                <Link href="/schedule">
                  Book Appointment
                </Link>
              </Button>
            </div>

            {/* Trust Indicators - Minimal */}
            <div className="flex flex-wrap justify-center gap-12 py-12 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                <span className="text-sm text-gray-600 dark:text-gray-300 font-light">Fully Insured</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                <span className="text-sm text-gray-600 dark:text-gray-300 font-light">Same-Day Available</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                <span className="text-sm text-gray-600 dark:text-gray-300 font-light">AI-Powered Service</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Contact Options - Minimal Grid */}
        <section className="py-16 border-t border-gray-200 dark:border-gray-800">
          <div className="grid md:grid-cols-3 gap-px bg-gray-200 dark:bg-gray-800">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-white dark:bg-gray-950 p-8 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
            >
              <Link href={content?.heroCtaLink || '/chat'}>
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 text-gray-900 dark:text-gray-100 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="text-lg font-light mb-2 text-gray-900 dark:text-gray-100">AI Assistant</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-light">Instant answers to your questions</p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="bg-white dark:bg-gray-950 p-8 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
            >
              <Link href="/schedule">
                <div className="text-center">
                  <CalendarClock className="h-8 w-8 text-gray-900 dark:text-gray-100 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="text-lg font-light mb-2 text-gray-900 dark:text-gray-100">Visual Scheduler</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-light">Real-time availability</p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white dark:bg-gray-950 p-8 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
            >
              <a href={`tel:${content?.phoneNumber || '918-856-5304'}`}>
                <div className="text-center">
                  <Phone className="h-8 w-8 text-gray-900 dark:text-gray-100 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="text-lg font-light mb-2 text-gray-900 dark:text-gray-100">Call Direct</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-light">{content?.phoneNumber || '918-856-5304'}</p>
                </div>
              </a>
            </motion.div>
          </div>
        </section>

        {/* Services - Vertical List Layout */}
        {services.length > 0 && (
          <section className="py-20 border-t border-gray-200 dark:border-gray-800">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-light mb-4 text-gray-900 dark:text-gray-100 tracking-tight">
                Services
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-light">Tailored detailing for every vehicle</p>
            </motion.div>

            <div className="space-y-px bg-gray-200 dark:bg-gray-800">
              {services.slice(0, 8).map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.05 }}
                >
                  <div className="bg-white dark:bg-gray-950 p-8 md:p-10 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-xl md:text-2xl font-light mb-2 text-gray-900 dark:text-gray-100">{service.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-light leading-relaxed max-w-2xl">
                          {service.overview}
                        </p>
                      </div>
                      <div className="md:text-right">
                        <p className="text-lg text-gray-900 dark:text-gray-100 font-light">{service.priceRange}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button 
                size="lg"
                variant="outline"
                className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 font-light tracking-wide"
                asChild
              >
                <Link href="/schedule">
                  View All Services
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="py-20 border-t border-gray-200 dark:border-gray-800">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <GoogleReviews />
          </motion.div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-20">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-16">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="font-light text-lg mb-4 text-gray-900 dark:text-gray-100 tracking-wide">Clean Machine</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-light leading-relaxed">
                Premium mobile auto detailing service
              </p>
            </div>
            <div>
              <h3 className="font-light text-lg mb-4 text-gray-900 dark:text-gray-100">Navigation</h3>
              <div className="flex flex-col gap-3">
                <Link href="/schedule" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-light">
                  Book Appointment
                </Link>
                <Link href="/careers" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-light">
                  Careers
                </Link>
                <Link href="/showcase" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-light">
                  Investor Showcase
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-light text-lg mb-4 text-gray-900 dark:text-gray-100">Contact</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-light mb-2">
                {content?.phoneNumber || '918-856-5304'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-light">
                Tulsa, Oklahoma
              </p>
            </div>
          </div>
          <div className="text-center pt-12 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
              © 2025 Clean Machine Auto Detail. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
