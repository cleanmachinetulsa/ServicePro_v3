import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  Calendar,
  List,
  Phone,
  Gift,
  ExternalLink,
  ChevronRight,
  Download,
} from 'lucide-react';
import { InstallPromptBanner } from '@/components/PwaComponents';

interface PortalSettingsData {
  success: boolean;
  data: {
    portalEnabled: boolean;
    branding: {
      businessName: string;
      logoUrl: string | null;
      primaryColor: string;
      accentColor: string | null;
      themeColor: string;
      backgroundColor: string;
    };
    pwa: {
      displayName: string;
      shortName: string;
      startUrl: string;
    };
    modules: {
      home: boolean;
      book: boolean;
      appointments: boolean;
      messages: boolean;
      loyalty: boolean;
      profile: boolean;
    };
    tiles: {
      showRewards: boolean;
      showBooking: boolean;
      showServices: boolean;
      showContact: boolean;
    };
    content: {
      title: string | null;
      welcomeMessage: string | null;
      landingPath: string | null;
    };
    installPrompt: {
      enabled: boolean;
      bannerText: string;
      buttonText: string;
    };
    actions: Array<{
      key: string;
      displayName: string;
      description: string | null;
      icon: string;
      category: string;
      actionType: string;
      actionConfig: any;
      showOnHome: boolean;
      showInNav: boolean;
    }>;
  };
}

function GlassCard({ 
  children, 
  className = '', 
  delay = 0,
  onClick,
}: { 
  children: React.ReactNode; 
  className?: string; 
  delay?: number;
  onClick?: () => void;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay }}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : ''}
    >
      <Card
        className={`
          relative overflow-hidden
          bg-slate-900/40 backdrop-blur-xl
          border border-white/10
          shadow-2xl shadow-black/40
          transition-all duration-300 ease-out
          hover:scale-[1.02] hover:shadow-3xl
          hover:shadow-blue-500/20 hover:border-white/20
          hover:-translate-y-1
          ${className}
        `}
      >
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative z-10">
          {children}
        </div>
      </Card>
    </motion.div>
  );
}

function TileIcon({ icon, primaryColor }: { icon: string; primaryColor: string }) {
  const iconMap: Record<string, any> = {
    gift: Gift,
    sparkles: Sparkles,
    calendar: Calendar,
    list: List,
    phone: Phone,
    download: Download,
  };
  
  const IconComponent = iconMap[icon.toLowerCase()] || Gift;
  
  return (
    <div 
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
      style={{ backgroundColor: `${primaryColor}30` }}
    >
      <IconComponent className="w-7 h-7" style={{ color: primaryColor }} />
    </div>
  );
}

export default function Portal() {
  const [, setLocation] = useLocation();
  const heroRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: true });
  
  const subdomain = window.location.hostname.split('.')[0];

  const { data, isLoading, error } = useQuery<PortalSettingsData>({
    queryKey: ['/api/public/portal', subdomain, 'settings'],
    queryFn: async () => {
      const res = await fetch(`/api/public/portal/${subdomain}/settings`);
      if (!res.ok) throw new Error('Failed to load portal');
      return res.json();
    },
    retry: false,
  });

  const handleNavigate = (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank');
    } else if (path.startsWith('tel:') || path.startsWith('mailto:')) {
      window.location.href = path;
    } else {
      setLocation(path);
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
          <p className="text-white text-lg font-medium">Loading portal...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 flex items-center justify-center p-4">
        <GlassCard className="max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Portal Not Found</h3>
            <p className="text-slate-300 mb-6">
              We couldn't find a portal for this site.
            </p>
            <Button 
              onClick={() => setLocation('/')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-go-home"
            >
              Go Home
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  const { branding, tiles, content, installPrompt, actions } = data.data;
  const primaryColor = branding.primaryColor || '#3b82f6';

  const defaultTiles = [
    {
      key: 'rewards',
      show: tiles.showRewards,
      icon: 'sparkles',
      title: 'Rewards',
      description: 'View your points and redeem rewards',
      path: '/rewards',
    },
    {
      key: 'book',
      show: tiles.showBooking,
      icon: 'calendar',
      title: 'Book Appointment',
      description: 'Schedule your next service',
      path: '/book',
    },
    {
      key: 'services',
      show: tiles.showServices,
      icon: 'list',
      title: 'Services',
      description: 'View our services and pricing',
      path: '/services',
    },
    {
      key: 'contact',
      show: tiles.showContact,
      icon: 'phone',
      title: 'Contact Us',
      description: 'Get in touch with our team',
      path: '/contact',
    },
  ];

  const visibleTiles = defaultTiles.filter(t => t.show);

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${primaryColor}20 0%, transparent 70%)`,
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
        
        <motion.div
          className="absolute -top-1/3 -right-1/4 w-1/2 h-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, -30, 0],
            y: [0, 50, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 safe-area-inset">
        {installPrompt.enabled && <InstallPromptBanner />}
        
        <motion.div
          ref={heroRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          {branding.logoUrl && (
            <img 
              src={branding.logoUrl} 
              alt={branding.businessName}
              className="h-16 mx-auto mb-6 object-contain"
            />
          )}
          
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {content.title || `Welcome to ${branding.businessName}`}
          </h1>
          
          {content.welcomeMessage && (
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              {content.welcomeMessage}
            </p>
          )}
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleTiles.map((tile, index) => (
            <GlassCard 
              key={tile.key} 
              delay={0.1 * (index + 1)}
              onClick={() => handleNavigate(tile.path)}
            >
              <CardContent className="p-6">
                <TileIcon icon={tile.icon} primaryColor={primaryColor} />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {tile.title}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {tile.description}
                </p>
                <div className="flex items-center text-sm font-medium" style={{ color: primaryColor }}>
                  <span>Get Started</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </GlassCard>
          ))}
        </div>

        {actions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {actions.filter(a => a.showOnHome).map((action, index) => (
                <GlassCard 
                  key={action.key}
                  delay={0.1 * (visibleTiles.length + index + 1)}
                  onClick={() => {
                    if (action.actionType === 'link' && action.actionConfig?.url) {
                      handleNavigate(action.actionConfig.url);
                    } else if (action.actionType === 'route' && action.actionConfig?.route) {
                      handleNavigate(action.actionConfig.route);
                    }
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <TileIcon icon={action.icon || 'sparkles'} primaryColor={primaryColor} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{action.displayName}</h4>
                      {action.description && (
                        <p className="text-slate-400 text-xs truncate">{action.description}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </CardContent>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center text-slate-500 text-sm"
        >
          <p>Powered by {branding.businessName}</p>
        </motion.div>
      </div>
    </div>
  );
}
