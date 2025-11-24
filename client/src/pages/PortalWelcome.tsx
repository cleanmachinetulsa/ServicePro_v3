import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Star,
  Gift,
  LogIn,
  Calendar,
  Shield,
  Check,
  Phone,
  Award,
  TrendingUp,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { PortalWelcomeConfig } from '@shared/schema';

// Glass Card Component with premium styling
function GlassCard({ 
  children, 
  className = '', 
  delay = 0,
  highlight = false 
}: { 
  children: React.ReactNode; 
  className?: string; 
  delay?: number;
  highlight?: boolean;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card
        className={`
          relative overflow-hidden
          bg-slate-900/40 backdrop-blur-xl
          border ${highlight ? 'border-amber-400/40' : 'border-white/10'}
          shadow-2xl ${highlight ? 'shadow-amber-500/20' : 'shadow-black/40'}
          transition-all duration-300 ease-out
          hover:scale-[1.02] hover:shadow-3xl
          ${highlight ? 'hover:shadow-amber-500/30 hover:border-amber-400/60' : 'hover:shadow-blue-500/20 hover:border-white/20'}
          hover:-translate-y-1
          ${className}
        `}
      >
        {/* Subtle gradient overlay */}
        <div className={`absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 ${
          highlight 
            ? 'bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10' 
            : 'bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5'
        }`} />
        
        {/* Glass reflection effect */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <div className="relative z-10">
          {children}
        </div>
      </Card>
    </motion.div>
  );
}

export default function PortalWelcome() {
  const [, setLocation] = useLocation();
  const heroRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: true });

  // Fetch welcome config
  const { data, isLoading, error } = useQuery<{ success: boolean; config: PortalWelcomeConfig }>({
    queryKey: ['/api/public/customer-auth/welcome-config'],
  });

  const config = data?.config;

  // Helper to navigate - handles both internal and external URLs
  const handleNavigate = (href: string) => {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank');
    } else if (href.startsWith('#')) {
      const element = document.querySelector(href);
      element?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setLocation(href);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-white text-lg font-medium">Loading your rewards portal...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 flex items-center justify-center p-4">
        <GlassCard className="max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Unable to Load</h3>
            <p className="text-slate-300 mb-6">
              We couldn't load the welcome page. Please try again.
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Reload Page
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      {/* CINEMATIC BACKGROUND */}
      {/* Deep gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950" />
      
      {/* Animated glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top left glow */}
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Top right glow */}
        <motion.div
          className="absolute -top-1/3 -right-1/4 w-1/2 h-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, -50, 0],
            y: [0, 40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Bottom center glow */}
        <motion.div
          className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-2/3 h-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Subtle noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-24">
        
        {/* HERO SECTION */}
        <motion.div
          ref={heroRef}
          initial={{ opacity: 0, y: 40 }}
          animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-20 md:mb-28"
        >
          {/* Premium Badge */}
          {config.badge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isHeroInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-block mb-6"
            >
              <Badge className="
                relative px-6 py-2.5 text-sm font-semibold
                bg-gradient-to-r from-blue-600 to-purple-600
                border border-white/20
                shadow-lg shadow-blue-500/50
                transition-all duration-300
                hover:shadow-xl hover:shadow-blue-500/60
                hover:scale-105
              ">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-xl" />
                <Sparkles className="h-4 w-4 mr-2 inline-block" />
                {config.badge}
              </Badge>
            </motion.div>
          )}

          {/* Main Heading with Gradient Text */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
          >
            {config.heading.split(' ').map((word, idx) => {
              const isHighlight = word.toLowerCase().includes('reward') || 
                                 word.toLowerCase().includes('loyalty') ||
                                 word.toLowerCase().includes('points');
              if (isHighlight) {
                return (
                  <span
                    key={idx}
                    className="relative inline-block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient"
                  >
                    {word}{' '}
                  </span>
                );
              }
              return <span key={idx}>{word} </span>;
            })}
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg sm:text-xl md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed"
          >
            {config.subheading}
          </motion.p>

          {/* Premium CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            {/* PRIMARY CTA - Glowing Gradient Button */}
            <Button
              size="lg"
              onClick={() => handleNavigate(config.ctas.primary.href)}
              data-testid="button-primary-cta"
              className="
                group relative px-8 py-6 text-lg font-semibold
                bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600
                hover:from-blue-500 hover:via-purple-500 hover:to-pink-500
                border border-white/20
                shadow-2xl shadow-blue-500/50
                transition-all duration-300
                hover:shadow-3xl hover:shadow-blue-500/70
                hover:scale-105
                overflow-hidden
              "
            >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              <LogIn className="h-5 w-5 mr-2 inline-block group-hover:rotate-12 transition-transform" />
              <span className="relative z-10">{config.ctas.primary.label}</span>
              <ArrowRight className="h-5 w-5 ml-2 inline-block group-hover:translate-x-1 transition-transform" />
            </Button>

            {/* SECONDARY CTAs - Glass Buttons */}
            {config.ctas.secondary && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleNavigate(config.ctas.secondary!.href)}
                data-testid="button-secondary-cta"
                className="
                  group px-8 py-6 text-lg font-semibold text-white
                  bg-white/5 backdrop-blur-xl
                  border-2 border-white/20
                  hover:bg-white/10 hover:border-white/30
                  shadow-lg hover:shadow-xl
                  transition-all duration-300
                  hover:scale-105
                "
              >
                <Calendar className="h-5 w-5 mr-2 inline-block group-hover:scale-110 transition-transform" />
                {config.ctas.secondary.label}
              </Button>
            )}

            {config.ctas.giftCard && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleNavigate(config.ctas.giftCard!.href)}
                data-testid="button-giftcard-cta"
                className="
                  group px-8 py-6 text-lg font-semibold text-white
                  bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl
                  border-2 border-purple-400/30
                  hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-400/50
                  shadow-lg hover:shadow-xl
                  transition-all duration-300
                  hover:scale-105
                "
              >
                <Gift className="h-5 w-5 mr-2 inline-block group-hover:rotate-12 transition-transform" />
                {config.ctas.giftCard.label}
              </Button>
            )}
          </motion.div>
        </motion.div>

        {/* HOW IT WORKS SECTION */}
        <section className="mb-24 md:mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Three simple steps to start earning rewards on every service
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {config.bullets.map((bullet, idx) => {
              const icons = [Phone, Calendar, Award];
              const Icon = icons[idx] || Zap;
              const colors = [
                'from-blue-500 to-cyan-500',
                'from-purple-500 to-pink-500',
                'from-amber-500 to-orange-500'
              ];
              
              return (
                <GlassCard key={idx} delay={idx * 0.1}>
                  <CardContent className="pt-8 pb-8">
                    <div className="flex items-start gap-5">
                      {/* Circular Icon Badge */}
                      <div className={`
                        flex-shrink-0 w-16 h-16 rounded-2xl
                        bg-gradient-to-br ${colors[idx]}
                        flex items-center justify-center
                        shadow-lg
                        transition-transform duration-300
                        group-hover:scale-110
                      `}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-bold text-blue-400">Step {idx + 1}</span>
                        </div>
                        <p className="text-slate-200 text-base leading-relaxed">{bullet}</p>
                      </div>
                    </div>
                  </CardContent>
                </GlassCard>
              );
            })}
          </div>
        </section>

        {/* WELCOME BONUS HIGHLIGHT - Hero Card */}
        <section className="mb-24 md:mb-32">
          <GlassCard highlight className="relative overflow-hidden">
            {/* Radial glow background */}
            <div className="absolute inset-0 bg-gradient-radial from-amber-500/20 via-transparent to-transparent opacity-50" />
            
            <CardContent className="pt-12 pb-12 text-center relative z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Badge className="
                  mb-6 px-6 py-2.5 text-base font-bold
                  bg-gradient-to-r from-amber-500 to-orange-500
                  border border-amber-300/30
                  shadow-xl shadow-amber-500/50
                ">
                  <Gift className="h-5 w-5 mr-2 inline-block animate-pulse" />
                  Limited-Time Welcome Bonus
                </Badge>

                <div className="mb-6">
                  <div className="inline-flex items-baseline gap-3">
                    <span className="text-6xl md:text-7xl lg:text-8xl font-black bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 bg-clip-text text-transparent">
                      {config.welcomeOffer.points}
                    </span>
                    <span className="text-2xl md:text-3xl font-bold text-amber-200">Points</span>
                  </div>
                </div>

                <p className="text-xl md:text-2xl text-slate-100 mb-8 max-w-3xl mx-auto leading-relaxed">
                  {config.welcomeOffer.label}
                </p>

                <Button
                  size="lg"
                  onClick={() => handleNavigate(config.ctas.primary.href)}
                  data-testid="button-claim-bonus"
                  className="
                    group px-12 py-7 text-xl font-bold
                    bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500
                    hover:from-amber-400 hover:via-yellow-400 hover:to-amber-400
                    text-slate-900
                    border-2 border-amber-300/50
                    shadow-2xl shadow-amber-500/60
                    hover:shadow-3xl hover:shadow-amber-500/80
                    transition-all duration-300
                    hover:scale-105
                  "
                >
                  <Star className="h-6 w-6 mr-2 inline-block group-hover:rotate-180 transition-transform duration-500" />
                  {config.ctas.primary.label}
                  <Sparkles className="h-6 w-6 ml-2 inline-block group-hover:scale-125 transition-transform" />
                </Button>

                <p className="text-slate-400 text-sm mt-6 max-w-2xl mx-auto">
                  {config.welcomeOffer.finePrint}
                </p>
              </motion.div>
            </CardContent>
          </GlassCard>
        </section>

        {/* REWARD TIERS SECTION */}
        <section className="mb-24 md:mb-32" id="rewards">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Reward Tiers
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Earn 1 point per dollar and unlock amazing rewards at every milestone
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {config.tiers.map((tier, idx) => {
              const isWelcomeTier = tier.points === config.welcomeOffer.points;
              
              return (
                <GlassCard
                  key={idx}
                  delay={idx * 0.05}
                  highlight={isWelcomeTier}
                >
                  <CardContent className="pt-8 pb-8">
                    {isWelcomeTier && (
                      <Badge className="mb-4 bg-amber-500/90 text-white border-amber-400/50">
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                        Perfect Welcome Reward
                      </Badge>
                    )}
                    
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className={`
                          text-4xl font-black
                          ${isWelcomeTier 
                            ? 'bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent' 
                            : 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                          }
                        `}>
                          {tier.points}
                        </span>
                        <span className="text-slate-400 text-sm font-medium">pts</span>
                      </div>
                    </div>

                    <h3 className="text-white font-bold text-lg mb-2 leading-tight">
                      {tier.label}
                    </h3>
                    
                    {tier.description && (
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {tier.description}
                      </p>
                    )}
                  </CardContent>
                </GlassCard>
              );
            })}
          </div>
        </section>

        {/* TRUST SECTION */}
        <section className="mb-24 md:mb-32">
          <GlassCard>
            <CardContent className="pt-10 pb-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center justify-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {config.trust.heading}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  {config.trust.bullets.map((bullet, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      className="flex items-start gap-3"
                      data-testid={`trust-bullet-${idx}`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                        <Check className="h-4 w-4 text-green-400" />
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">{bullet}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </CardContent>
          </GlassCard>
        </section>

        {/* BOTTOM CTA STRIP */}
        <section>
          <GlassCard className="relative overflow-hidden">
            {/* Background gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10" />
            
            <CardContent className="pt-12 pb-12 text-center relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to Start Earning Points?
                </h2>
                <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
                  Join the portal today, book your next service, and claim your {config.welcomeOffer.points}-point welcome bonus
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button
                    size="lg"
                    onClick={() => handleNavigate(config.ctas.primary.href)}
                    data-testid="button-bottom-signin"
                    className="
                      group px-10 py-6 text-lg font-semibold
                      bg-gradient-to-r from-blue-600 to-purple-600
                      hover:from-blue-500 hover:to-purple-500
                      border border-white/20
                      shadow-2xl shadow-blue-500/50
                      hover:shadow-3xl hover:shadow-blue-500/70
                      transition-all duration-300
                      hover:scale-105
                    "
                  >
                    <LogIn className="h-5 w-5 mr-2 inline-block" />
                    {config.ctas.primary.label}
                  </Button>

                  {config.ctas.secondary && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handleNavigate(config.ctas.secondary!.href)}
                      data-testid="button-bottom-book"
                      className="
                        group px-10 py-6 text-lg font-semibold text-white
                        bg-white/5 backdrop-blur-xl
                        border-2 border-white/20
                        hover:bg-white/10 hover:border-white/30
                        shadow-lg hover:shadow-xl
                        transition-all duration-300
                        hover:scale-105
                      "
                    >
                      <Calendar className="h-5 w-5 mr-2 inline-block" />
                      {config.ctas.secondary.label}
                    </Button>
                  )}
                </div>
              </motion.div>
            </CardContent>
          </GlassCard>
        </section>

        {/* Spacer for bottom */}
        <div className="h-16" />
      </div>
    </div>
  );
}
