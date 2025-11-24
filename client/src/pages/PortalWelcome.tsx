import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Star,
  Gift,
  LogIn,
  Calendar,
  CreditCard,
  Shield,
  Check,
  Phone,
  Award,
  TrendingUp,
} from 'lucide-react';
import type { PortalWelcomeConfig } from '@shared/schema';

export default function PortalWelcome() {
  const [, setLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  // Fetch welcome config
  const { data, isLoading, error } = useQuery<{ success: boolean; config: PortalWelcomeConfig }>({
    queryKey: ['/api/public/customer-auth/welcome-config'],
  });

  const config = data?.config;

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Helper to navigate - handles both internal and external URLs
  const handleNavigate = (href: string) => {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // External URL - open in new tab
      window.open(href, '_blank');
    } else if (href.startsWith('#')) {
      // Anchor link - scroll to section
      const element = document.querySelector(href);
      element?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Internal route - use wouter
      setLocation(href);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading your rewards...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Unable to load welcome page. Please try again later.
            </p>
            <Button className="w-full mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-blue-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-purple-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16 lg:py-20">
        <motion.div
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Badge */}
          {config.badge && (
            <Badge className="mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none px-4 py-2 text-sm">
              <Sparkles className="h-3 w-3 mr-2" />
              {config.badge}
            </Badge>
          )}

          {/* Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            {config.heading.split(' ').map((word, idx) => {
              const isRewards = word.toLowerCase().includes('reward');
              const isLoyalty = word.toLowerCase().includes('loyalty');
              if (isRewards || isLoyalty) {
                return (
                  <span
                    key={idx}
                    className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                  >
                    {word}{' '}
                  </span>
                );
              }
              return <span key={idx}>{word} </span>;
            })}
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto mb-8">
            {config.subheading}
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all px-8 py-6 text-lg"
              onClick={() => handleNavigate(config.ctas.primary.href)}
              data-testid="button-primary-cta"
            >
              <LogIn className="h-5 w-5 mr-2" />
              {config.ctas.primary.label}
            </Button>
            {config.ctas.secondary && (
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-blue-400/50 text-white hover:bg-blue-500/20 hover:border-blue-400 px-8 py-6 text-lg backdrop-blur-sm"
                onClick={() => handleNavigate(config.ctas.secondary!.href)}
                data-testid="button-secondary-cta"
              >
                <Calendar className="h-5 w-5 mr-2" />
                {config.ctas.secondary.label}
              </Button>
            )}
            {config.ctas.giftCard && (
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-purple-400/50 text-white hover:bg-purple-500/20 hover:border-purple-400 px-8 py-6 text-lg backdrop-blur-sm"
                onClick={() => handleNavigate(config.ctas.giftCard!.href)}
                data-testid="button-giftcard-cta"
              >
                <Gift className="h-5 w-5 mr-2" />
                {config.ctas.giftCard.label}
              </Button>
            )}
          </div>
        </motion.div>

        {/* How It Works Section */}
        <motion.div
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-white text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {config.bullets.map((bullet, idx) => {
              const icons = [Phone, Calendar, Award];
              const Icon = icons[idx] || Star;
              return (
                <Card
                  key={idx}
                  className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 transition-all hover:shadow-xl hover:shadow-blue-500/20"
                  data-testid={`card-how-it-works-${idx}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-2">Step {idx + 1}</h3>
                        <p className="text-slate-200 text-sm">{bullet}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* Welcome Offer Highlight */}
        <motion.div
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16"
        >
          <Card className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-md border-2 border-blue-400/30 hover:border-blue-400/50 transition-all shadow-2xl shadow-blue-500/30">
            <CardContent className="pt-8 pb-8 text-center">
              <Badge className="mb-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white border-none px-6 py-2 text-lg">
                <Gift className="h-4 w-4 mr-2" />
                Limited-Time Welcome Bonus
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {config.welcomeOffer.points} Bonus Points
              </h2>
              <p className="text-slate-100 text-lg mb-6 max-w-2xl mx-auto">
                {config.welcomeOffer.label}
              </p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all px-12 py-6 text-lg mb-4"
                onClick={() => handleNavigate(config.ctas.primary.href)}
                data-testid="button-claim-bonus"
              >
                <Star className="h-5 w-5 mr-2" />
                {config.ctas.primary.label}
              </Button>
              <p className="text-slate-300 text-xs max-w-2xl mx-auto">
                {config.welcomeOffer.finePrint}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Reward Tiers Section */}
        <motion.div
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
          id="rewards"
        >
          <h2 className="text-3xl font-bold text-white text-center mb-3">Reward Tiers</h2>
          <p className="text-slate-200 text-center mb-8">Earn 1 point per dollar and unlock these rewards:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {config.tiers.map((tier, idx) => {
              const isWelcomeTier = tier.points === config.welcomeOffer.points;
              return (
                <Card
                  key={idx}
                  className={`${
                    isWelcomeTier
                      ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-400/50'
                      : 'bg-white/10 border border-white/20'
                  } backdrop-blur-md hover:shadow-xl transition-all`}
                  data-testid={`card-tier-${tier.points}`}
                >
                  <CardContent className="pt-6">
                    {isWelcomeTier && (
                      <Badge className="mb-3 bg-amber-500 text-white border-none">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Great Starting Point
                      </Badge>
                    )}
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {tier.points}
                      </span>
                      <span className="text-slate-300 text-sm">Points</span>
                    </div>
                    <h3 className="text-white font-semibold mb-2 leading-tight">{tier.label}</h3>
                    {tier.description && (
                      <p className="text-slate-300 text-sm">{tier.description}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* Trust Section */}
        <motion.div
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <Card className="bg-white/10 backdrop-blur-md border border-white/20">
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Shield className="h-6 w-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">{config.trust.heading}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {config.trust.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-3" data-testid={`trust-bullet-${idx}`}>
                    <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-200 text-sm">{bullet}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom CTA Strip */}
        <motion.div
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Earning Points?</h2>
          <p className="text-slate-200 mb-6">
            Join the portal, book your next service, and claim your {config.welcomeOffer.points}-point welcome bonus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all px-8 py-6 text-lg"
              onClick={() => handleNavigate(config.ctas.primary.href)}
              data-testid="button-bottom-signin"
            >
              <LogIn className="h-5 w-5 mr-2" />
              {config.ctas.primary.label}
            </Button>
            {config.ctas.secondary && (
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-blue-400/50 text-white hover:bg-blue-500/20 hover:border-blue-400 px-8 py-6 text-lg backdrop-blur-sm"
                onClick={() => handleNavigate(config.ctas.secondary!.href)}
                data-testid="button-bottom-book"
              >
                <Calendar className="h-5 w-5 mr-2" />
                {config.ctas.secondary.label}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
