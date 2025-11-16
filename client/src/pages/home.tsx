import React, { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import ServicesCarousel from "@/components/ServicesCarousel";
import GoogleReviews from "@/components/GoogleReviews";
import SophisticatedAnimatedLogo from "@/components/SophisticatedAnimatedLogo";
import FeatureActionButtons from "@/components/FeatureActionButtons";
import EnhancedChatbotUI from "@/components/EnhancedChatbotUI";
import { CalendarClock, MessageSquare, Phone } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

export default function HomePage() {
  // Fetch CMS content for homepage
  const { data } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
  });

  const content = data?.content;

  // Update SEO meta tags when content loads
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white overflow-hidden relative">
      {/* Animated gradient background with soft pulse */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/30 to-indigo-950/20 animate-gradient-slow"></div>
      </div>
      
      {/* Premium background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[10%] right-[20%] w-64 h-64 bg-blue-600/5 rounded-full filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <header className="relative z-20">
        <nav className="flex justify-end items-center max-w-7xl mx-auto px-4 md:px-8 py-4">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-blue-100 hover:bg-blue-500/20 hover:text-white transition-colors"
            asChild
          >
            <Link href="/login" data-testid="button-login">
              Login
            </Link>
          </Button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        {/* Sophisticated Animated Logo Component at the top of the page */}
        <div className="mb-2 -mt-8">
          <SophisticatedAnimatedLogo />
        </div>
        
        <section className="py-6 text-center">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-base md:text-lg text-blue-100/70 mb-8 max-w-3xl mx-auto leading-relaxed font-light"
          >
            {content?.aboutText || 'Clean Machine Auto Detail offers extensive detailing services ranging from Upholstery shampoo & Headlight restoration to Paint Correction & Ceramic Coatings, right in your driveway!'}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <p className="text-blue-200/90 mb-3 italic">ask anything. book anytime.</p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button 
                size="lg" 
                className="transform hover:scale-105 transition-all duration-300 shadow-lg text-white font-semibold relative overflow-hidden group px-8 py-6 rounded-md"
                style={{
                  backgroundColor: content?.primaryColor ? `hsl(${content.primaryColor})` : 'hsl(220, 90%, 56%)',
                }}
                asChild
              >
                <Link href={content?.heroCtaLink || '/chat'} className="relative z-10 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 mr-1" />
                  <span>{content?.heroCtaText || 'Clean Machine Assistant'}</span>
                  <span className="ml-1 group-hover:ml-2 transition-all duration-300">→</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-400/10 to-blue-600/0 w-[200%] h-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></span>
                </Link>
              </Button>
              
              <div className="flex flex-col items-center">
                <p className="text-blue-200 text-xs mb-1">Or use our</p>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="transform hover:scale-105 transition-all duration-300 shadow-lg font-semibold relative overflow-hidden group px-8 py-6 rounded-md text-white"
                  style={{
                    borderColor: content?.accentColor ? `hsl(${content.accentColor})` : 'hsl(340, 80%, 55%)',
                    backgroundColor: content?.accentColor ? `hsl(${content.accentColor} / 0.1)` : 'hsl(220, 90%, 56% / 0.1)',
                  }}
                  asChild
                >
                  <Link href="/schedule" className="relative z-10 flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 mr-1" />
                    <span>Visual Scheduler</span>
                    <span className="ml-1 group-hover:ml-2 transition-all duration-300">→</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-400/5 to-blue-600/0 w-[200%] h-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></span>
                  </Link>
                </Button>
                
                {/* Call Now Button */}
                <Button 
                  size="default" 
                  className="bg-green-600 hover:bg-green-700 text-white transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-green-500/30 font-medium relative overflow-hidden group px-6 py-3 rounded-md mt-3"
                  asChild
                >
                  <a href="tel:+19188565304" className="relative z-10 flex items-center gap-2">
                    <Phone className="h-4 w-4 mr-1" />
                    <span>Call Now</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-green-600/0 via-green-400/10 to-green-600/0 w-[200%] h-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></span>
                  </a>
                </Button>
              </div>
            </div>
            
            {/* Feature Action Buttons */}
            <FeatureActionButtons />
          </motion.div>
        </section>

        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="py-20 relative"
        >
          <div className="absolute inset-0 bg-gray-900 rounded-3xl mx-4 transform -skew-y-1"></div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative z-10 px-4 py-2"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200">
              {content?.servicesHeading || 'Premium Auto Detailing Services'}
            </h2>
            {content?.servicesSubheading && (
              <p className="text-center text-blue-200/70 mb-8 -mt-8">
                {content.servicesSubheading}
              </p>
            )}
            <ServicesCarousel />
          </motion.div>
        </motion.section>
        
        {/* Testimonials section with advanced animation */}
        <motion.section 
          className="py-16 relative" 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200">
              What Our Customers Say
            </h2>
            <p className="text-blue-200/60 max-w-2xl mx-auto">
              The finest automobiles deserve the finest care. See what other discerning vehicle owners have to say about our premium detailing services.
            </p>
          </motion.div>
          <div className="px-4">
            <GoogleReviews placeId="ChIJVX4B3d2TtocRCjnc7bJevHw" />
          </div>
        </motion.section>
        
        {/* Footer section */}
        <section className="py-10 border-t border-blue-900/30 mt-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              {content?.logoUrl ? (
                <img 
                  src={content.logoUrl} 
                  alt={content.metaTitle || 'Clean Machine Auto Detail'} 
                  className="h-16 w-auto transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-blue-500/20 rounded cursor-pointer" 
                />
              ) : (
                <img 
                  src="/logo.jpg" 
                  alt="Clean Machine Auto Detail" 
                  className="h-16 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-blue-500/20 rounded cursor-pointer" 
                />
              )}
              <div>
                <p className="text-white font-medium">Clean Machine Auto Detail</p>
                <p className="text-sm text-gray-400">Premium detailing services in Tulsa</p>
                <div className="flex flex-col mt-2">
                  <a href="tel:9188565304" className="text-blue-300 hover:text-blue-100 transition-all duration-300 text-sm flex items-center gap-1 hover:translate-x-1 hover:shadow-sm hover:shadow-blue-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    (918) 856-5304
                  </a>
                  <a href="mailto:cleanmachinetulsa@gmail.com" className="text-blue-300 hover:text-blue-100 transition-all duration-300 text-sm flex items-center gap-1 hover:translate-x-1 hover:shadow-sm hover:shadow-blue-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    cleanmachinetulsa@gmail.com
                  </a>
                </div>
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Clean Machine Auto Detail. All rights reserved.</p>
              <p className="text-gray-500 text-xs mt-1">Serving Tulsa and surrounding areas</p>
            </div>
          </div>
        </section>
      </main>
      
      {/* Floating Chat Widget - now shares state with full-page chat */}
      <div className="fixed bottom-4 right-4 z-50">
        <EnhancedChatbotUI />
      </div>
    </div>
  );
}