import React, { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import ServicesCarousel from "@/components/ServicesCarousel";
import GoogleReviews from "@/components/GoogleReviews";
import SophisticatedAnimatedLogo from "@/components/SophisticatedAnimatedLogo";
import FeatureActionButtons from "@/components/FeatureActionButtons";
import EnhancedChatbotUI from "@/components/EnhancedChatbotUI";
import { CalendarClock, MessageSquare, Phone } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface CurrentTemplateProps {
  content?: HomepageContent;
}

// ============================================
// ANIMATION VARIANTS - Apple-Level Professional
// ============================================

// Container variant for orchestrating child animations with stagger
const containerVariants = {
  hidden: { opacity: 1 }, // Keep opacity 1 to prevent layout shift
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    }
  }
};

// Logo animation - Scale + Fade In
const logoVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.6, 
      ease: [0.16, 1, 0.3, 1] // Custom easing for smooth Apple-like feel
    }
  }
};

// Fade in from below - for text elements
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.7, 
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

// Spring animation for CTA buttons
const springIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: 'spring', 
      stiffness: 260, 
      damping: 22,
      mass: 0.8
    }
  }
};

// Subtle slide in from left
const slideInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.8, 
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

// Subtle slide in from right  
const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.8, 
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

// Background gradient animation
const backgroundVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 1.2, ease: "easeOut" }
  }
};

export default function CurrentTemplate({ content: propsContent }: CurrentTemplateProps = {}) {
  // ALWAYS use props content - fetching is handled by parent (home.tsx)
  // This prevents double-fetching and content flash
  const content = propsContent;
  
  // Accessibility: Respect user's motion preferences
  const shouldReduceMotion = useReducedMotion();

  // Create accessible variants that respect motion preferences
  const getVariants = (variants: any) => {
    if (shouldReduceMotion) {
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.3 } }
      };
    }
    return variants;
  };

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
      {/* Animated gradient background with soft pulse - Hardware accelerated */}
      <motion.div 
        className="absolute inset-0 z-0"
        initial="hidden"
        animate="visible"
        variants={getVariants(backgroundVariants)}
        style={{ willChange: 'opacity' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/30 to-indigo-950/20 animate-gradient-slow"></div>
      </motion.div>
      
      {/* Premium background elements - Animated orbs */}
      <motion.div 
        className="absolute inset-0 z-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
      >
        <motion.div 
          className="absolute top-[20%] left-[10%] w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.7, 0.5]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ willChange: 'transform, opacity' }}
        />
        <motion.div 
          className="absolute bottom-[10%] right-[20%] w-64 h-64 bg-blue-600/5 rounded-full filter blur-3xl"
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.4, 0.6, 0.4]
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          style={{ willChange: 'transform, opacity' }}
        />
      </motion.div>

      {/* Header with fade-in animation */}
      <motion.header 
        className="relative z-20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
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
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        {/* HERO SECTION - Orchestrated Cascade Animation */}
        <motion.section 
          className="text-center"
          initial="hidden"
          animate="visible"
          variants={shouldReduceMotion ? {} : containerVariants}
        >
          {/* Logo - Fade + Scale In */}
          <motion.div 
            className="mb-2 -mt-8"
            variants={getVariants(logoVariants)}
            style={{ willChange: 'transform, opacity' }}
          >
            <SophisticatedAnimatedLogo />
          </motion.div>
          
          {/* About Text - Fade In Up */}
          <motion.div className="py-6">
            <motion.p 
              variants={getVariants(fadeInUp)}
              className="text-base md:text-lg text-blue-100/70 mb-8 max-w-3xl mx-auto leading-relaxed font-light"
              style={{ willChange: 'transform, opacity' }}
            >
              {content?.aboutText || 'Clean Machine Auto Detail offers extensive detailing services ranging from Upholstery shampoo & Headlight restoration to Paint Correction & Ceramic Coatings, right in your driveway!'}
            </motion.p>
            
            {/* Tagline - Fade In Up (staggered) */}
            <motion.p 
              variants={getVariants(fadeInUp)}
              className="text-blue-200/90 mb-3 italic"
              style={{ willChange: 'transform, opacity' }}
            >
              book anytime. chat with our floating assistant.
            </motion.p>
            
            {/* CTA Buttons Container - Fade In Up */}
            <motion.div
              variants={getVariants(fadeInUp)}
              className="flex flex-col items-center"
            >
              <div className="flex flex-col items-center gap-4">
                {/* Primary CTA - Spring Animation */}
                <motion.div
                  variants={getVariants(springIn)}
                  style={{ willChange: 'transform, opacity' }}
                >
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
                    <Link href="/schedule" className="relative z-10 flex items-center gap-2" data-testid="button-schedule">
                      <CalendarClock className="h-5 w-5 mr-1" />
                      <span>Visual Scheduler</span>
                      <span className="ml-1 group-hover:ml-2 transition-all duration-300">→</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-400/5 to-blue-600/0 w-[200%] h-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></span>
                    </Link>
                  </Button>
                </motion.div>
                
                {/* Secondary CTA - Spring Animation (staggered) */}
                <motion.div
                  variants={getVariants(springIn)}
                  style={{ willChange: 'transform, opacity' }}
                >
                  <Button 
                    size="default" 
                    className="bg-green-600 hover:bg-green-700 text-white transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-green-500/30 font-medium relative overflow-hidden group px-6 py-3 rounded-md"
                    asChild
                  >
                    <a href="tel:+19188565304" className="relative z-10 flex items-center gap-2" data-testid="button-call">
                      <Phone className="h-4 w-4 mr-1" />
                      <span>Call Now</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-green-600/0 via-green-400/10 to-green-600/0 w-[200%] h-full transform -translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></span>
                    </a>
                  </Button>
                </motion.div>
              </div>
              
              {/* Feature Action Buttons - Fade In (staggered) */}
              <motion.div
                variants={getVariants(fadeInUp)}
                style={{ willChange: 'transform, opacity' }}
              >
                <FeatureActionButtons />
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* SERVICES SECTION - Scroll-Triggered Animation */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="py-20 relative"
        >
          <motion.div 
            className="absolute inset-0 bg-gray-900 rounded-3xl mx-4 transform -skew-y-1"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative z-10 px-4 py-2"
          >
            <motion.h2 
              className="text-2xl md:text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-100px" }}
            >
              {content?.servicesHeading || 'Premium Auto Detailing Services'}
            </motion.h2>
            {content?.servicesSubheading && (
              <motion.p 
                className="text-center text-blue-200/70 mb-8 -mt-8"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
                viewport={{ once: true, margin: "-100px" }}
              >
                {content.servicesSubheading}
              </motion.p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <ServicesCarousel />
            </motion.div>
          </motion.div>
        </motion.section>
        
        {/* TESTIMONIALS SECTION - Scroll-Triggered with Slide Animations */}
        <motion.section 
          className="py-16 relative" 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div 
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            viewport={{ once: true, margin: "-80px" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-12"
          >
            <motion.h2 
              className="text-2xl md:text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-80px" }}
            >
              What Our Customers Say
            </motion.h2>
            <motion.p 
              className="text-blue-200/60 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              viewport={{ once: true, margin: "-80px" }}
            >
              The finest automobiles deserve the finest care. See what other discerning vehicle owners have to say about our premium detailing services.
            </motion.p>
          </motion.div>
          <motion.div 
            className="px-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-80px" }}
          >
            <GoogleReviews />
          </motion.div>
        </motion.section>
        
        {/* FOOTER SECTION - Subtle Fade In with Slide Animations */}
        <motion.section 
          className="py-10 border-t border-blue-900/30 mt-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true, margin: "-50px" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Left side - Logo and contact info - Slide in from left */}
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-50px" }}
            >
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
            </motion.div>
            
            {/* Right side - Links and copyright - Slide in from right */}
            <motion.div 
              className="text-center md:text-right"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, margin: "-50px" }}
            >
              <div className="flex gap-4 justify-center md:justify-end mb-2">
                <Link href="/my-services" className="text-blue-300 hover:text-blue-100 text-sm transition-all duration-300 hover:translate-x-1">
                  My Services
                </Link>
                <Link href="/careers" className="text-blue-300 hover:text-blue-100 text-sm transition-all duration-300 hover:translate-x-1">
                  Careers
                </Link>
                <Link href="/showcase" className="text-blue-300 hover:text-blue-100 text-sm transition-all duration-300 hover:translate-x-1">
                  Showcase
                </Link>
              </div>
              <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Clean Machine Auto Detail. All rights reserved.</p>
              <p className="text-gray-500 text-xs mt-1">Serving Tulsa and surrounding areas</p>
            </motion.div>
          </div>
        </motion.section>
      </main>
      
      {/* Floating Chat Widget - now shares state with full-page chat */}
      <div className="fixed bottom-4 right-4 z-50">
        <EnhancedChatbotUI />
      </div>
    </div>
  );
}
