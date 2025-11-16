import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import GoogleReviews from "@/components/GoogleReviews";
import { MessageSquare, CalendarClock, Phone, Zap, Award, TrendingUp } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface Service {
  id: number;
  name: string;
  priceRange: string;
  overview: string;
}

export default function DynamicSpotlight() {
  const { data: contentData } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
  });

  const { data: servicesData } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  const content = contentData?.content;
  const services = servicesData?.services || [];

  const { scrollYProgress } = useScroll();
  const heroX = useTransform(scrollYProgress, [0, 0.5], [0, -100]);

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
      {/* Kinetic animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-full filter blur-3xl"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[10%] left-[5%] w-[600px] h-[600px] bg-gradient-to-tl from-red-500/20 to-orange-500/20 rounded-full filter blur-3xl"
        />
      </div>

      {/* Bold header with orange accent */}
      <header className="relative z-20 bg-gradient-to-r from-black/90 to-gray-900/90 backdrop-blur-sm border-b border-orange-500/20">
        <nav className="flex justify-between items-center max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-600">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
              CLEAN MACHINE
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-white hover:bg-orange-500/20 hover:text-orange-400 transition-all"
            asChild
          >
            <Link href="/login" data-testid="button-login">
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Split-screen Hero Section */}
        <section className="min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto px-4 md:px-8 w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Content */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ x: heroX }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30 mb-6"
                >
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-orange-300 font-medium">Premium Mobile Detailing</span>
                </motion.div>
                
                <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                    Detailing
                  </span>
                  <br/>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-orange-600">
                    Redefined
                  </span>
                </h1>
                
                <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-xl leading-relaxed">
                  {content?.aboutText || 'Experience the future of auto detailing. AI-powered scheduling, real-time tracking, and concierge-level service at your location.'}
                </p>

                {/* Stacked CTAs */}
                <div className="flex flex-col gap-4 mb-8">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      size="lg"
                      className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-lg py-6 px-8 shadow-lg shadow-orange-500/50"
                      asChild
                    >
                      <Link href={content?.heroCtaLink || '/chat'} data-testid="button-chat">
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Chat with AI Assistant
                      </Link>
                    </Button>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        size="lg"
                        variant="outline"
                        className="w-full border-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 font-semibold py-6"
                        asChild
                      >
                        <Link href="/schedule" data-testid="button-schedule">
                          <CalendarClock className="mr-2 h-5 w-5" />
                          Book Now
                        </Link>
                      </Button>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        size="lg"
                        variant="outline"
                        className="w-full border-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 font-semibold py-6"
                        asChild
                      >
                        <a href={`tel:${content?.phoneNumber || '918-856-5711'}`} data-testid="button-call">
                          <Phone className="mr-2 h-5 w-5" />
                          Call Us
                        </a>
                      </Button>
                    </motion.div>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-orange-400" />
                    <span className="text-sm text-gray-400">5-Star Rated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-400" />
                    <span className="text-sm text-gray-400">Same Day Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-400" />
                    <span className="text-sm text-gray-400">AI-Powered</span>
                  </div>
                </div>
              </motion.div>

              {/* Right: Visual/Video Area */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                className="relative h-[500px] lg:h-[600px]"
              >
                <div className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-orange-500/30 shadow-2xl shadow-orange-500/20">
                  {/* Animated gradient placeholder for video */}
                  <motion.div 
                    animate={{ 
                      background: [
                        'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                        'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
                        'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                      ]
                    }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 opacity-20"
                  />
                  
                  {/* Floating service highlights */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ 
                        y: [0, -20, 0],
                        rotate: [0, 5, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className="text-center"
                    >
                      <div className="text-8xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500 mb-4">
                        Premium
                      </div>
                      <div className="text-2xl text-gray-300 font-semibold">
                        Auto Detailing
                      </div>
                    </motion.div>
                  </div>

                  {/* Animated accent lines */}
                  <motion.div
                    animate={{ 
                      scaleX: [0, 1, 0],
                      x: ['-100%', '0%', '100%']
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"
                  />
                  <motion.div
                    animate={{ 
                      scaleX: [0, 1, 0],
                      x: ['100%', '0%', '-100%']
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Services Carousel */}
        {services.length > 0 && (
          <section className="py-20 bg-gradient-to-b from-black to-gray-900">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12"
              >
                <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30 mb-4">
                  <span className="text-sm text-orange-400 font-semibold">Our Services</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-black mb-4">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    Premium Packages
                  </span>
                </h2>
                <p className="text-gray-500 text-lg">Tailored detailing solutions for every vehicle</p>
              </motion.div>

              {/* Kinetic carousel effect with horizontal scroll */}
              <div className="relative overflow-hidden">
                <motion.div 
                  className="flex gap-6 pb-8"
                  initial={{ x: 0 }}
                  animate={{ x: [0, -20, 0] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  {services.map((service, index) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -10 }}
                      className="min-w-[300px] md:min-w-[350px]"
                    >
                      <Card className="p-6 bg-gradient-to-br from-gray-900 to-black border-2 border-orange-500/30 hover:border-orange-500 transition-all duration-300 h-full shadow-lg shadow-orange-500/10">
                        <div className="mb-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-4">
                            <Zap className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-2">{service.name}</h3>
                          <p className="text-orange-400 font-bold text-xl mb-3">{service.priceRange}</p>
                        </div>
                        <p className="text-gray-400 line-clamp-3">{service.overview}</p>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              <div className="text-center mt-12">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold shadow-lg shadow-orange-500/30"
                  asChild
                >
                  <Link href="/schedule">
                    View All Services →
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="py-20 bg-black">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <GoogleReviews />
            </motion.div>
          </div>
        </section>
      </main>

      {/* Bold Footer */}
      <footer className="relative z-10 border-t-2 border-orange-500/30 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-600">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
                  Clean Machine
                </h3>
              </div>
              <p className="text-gray-400">
                Premium mobile auto detailing powered by AI technology
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg text-orange-400 mb-4">Quick Links</h3>
              <div className="flex flex-col gap-3">
                <Link href="/schedule" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Book Appointment
                </Link>
                <Link href="/careers" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Careers
                </Link>
                <Link href="/showcase" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Investor Showcase
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-orange-400 mb-4">Contact</h3>
              <p className="text-gray-400 mb-2 font-semibold">
                {content?.phoneNumber || '918-856-5711'}
              </p>
              <p className="text-gray-400">
                Tulsa, Oklahoma
              </p>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-orange-500/20">
            <p className="text-gray-500">
              © 2025 Clean Machine Auto Detail. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
