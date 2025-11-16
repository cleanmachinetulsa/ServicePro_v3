export type TemplateVariant = 'glassmorphism' | 'split-screen' | 'grid' | 'neon' | 'minimal';

export type HeroStyle = 'centered' | 'split' | 'asymmetric' | 'full-bleed' | 'minimal';
export type ServicesLayout = 'carousel' | 'grid' | 'stacked' | 'marquee' | 'list';
export type AnimationSpeed = 'slow' | 'medium' | 'fast' | 'none';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  variant: TemplateVariant;
  previewImage?: string;
  
  layout: {
    heroStyle: HeroStyle;
    servicesLayout: ServicesLayout;
    showReviews: boolean;
    showFooter: boolean;
  };
  
  styling: {
    primaryGradient: string;
    accentGradient: string;
    backgroundStyle: 'gradient' | 'solid' | 'video' | 'image';
    glassEffect: boolean;
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  };
  
  animations: {
    speed: AnimationSpeed;
    parallax: boolean;
    floatingElements: boolean;
    hoverEffects: boolean;
  };
  
  features: {
    chatWidget: boolean;
    bookingCTA: boolean;
    phoneNumber: boolean;
    socialProof: boolean;
  };
}

export const HOME_TEMPLATES: Record<string, TemplateConfig> = {
  current: {
    id: 'current',
    name: 'Current Default',
    description: 'The existing homepage design with blue gradient background and centered layout',
    variant: 'glassmorphism',
    
    layout: {
      heroStyle: 'centered',
      servicesLayout: 'carousel',
      showReviews: true,
      showFooter: true,
    },
    
    styling: {
      primaryGradient: 'from-gray-900 via-blue-950/10 to-black',
      accentGradient: 'from-blue-600 to-blue-800',
      backgroundStyle: 'gradient',
      glassEffect: false,
      borderRadius: 'md',
    },
    
    animations: {
      speed: 'medium',
      parallax: false,
      floatingElements: true,
      hoverEffects: true,
    },
    
    features: {
      chatWidget: true,
      bookingCTA: true,
      phoneNumber: true,
      socialProof: true,
    },
  },
  
  luminous_concierge: {
    id: 'luminous_concierge',
    name: 'Luminous Concierge',
    description: 'Premium glassmorphism design with floating cards, AI assistant spotlight, and sophisticated animations',
    variant: 'glassmorphism',
    
    layout: {
      heroStyle: 'centered',
      servicesLayout: 'grid',
      showReviews: true,
      showFooter: true,
    },
    
    styling: {
      primaryGradient: 'from-slate-900 via-blue-900/20 to-slate-950',
      accentGradient: 'from-blue-500 to-cyan-500',
      backgroundStyle: 'gradient',
      glassEffect: true,
      borderRadius: 'xl',
    },
    
    animations: {
      speed: 'slow',
      parallax: true,
      floatingElements: true,
      hoverEffects: true,
    },
    
    features: {
      chatWidget: true,
      bookingCTA: true,
      phoneNumber: true,
      socialProof: true,
    },
  },
  
  dynamic_spotlight: {
    id: 'dynamic_spotlight',
    name: 'Dynamic Spotlight',
    description: 'Bold split-screen layout with kinetic service carousel, video hero, and stacked CTAs',
    variant: 'split-screen',
    
    layout: {
      heroStyle: 'split',
      servicesLayout: 'carousel',
      showReviews: true,
      showFooter: true,
    },
    
    styling: {
      primaryGradient: 'from-black via-gray-900 to-black',
      accentGradient: 'from-orange-500 to-red-600',
      backgroundStyle: 'video',
      glassEffect: false,
      borderRadius: 'sm',
    },
    
    animations: {
      speed: 'fast',
      parallax: false,
      floatingElements: false,
      hoverEffects: true,
    },
    
    features: {
      chatWidget: true,
      bookingCTA: true,
      phoneNumber: true,
      socialProof: true,
    },
  },
  
  prestige_grid: {
    id: 'prestige_grid',
    name: 'Prestige Grid',
    description: 'Modular grid system with service cards, testimonials, badges, and subtle parallax effects',
    variant: 'grid',
    
    layout: {
      heroStyle: 'asymmetric',
      servicesLayout: 'grid',
      showReviews: true,
      showFooter: true,
    },
    
    styling: {
      primaryGradient: 'from-gray-950 via-slate-900 to-gray-950',
      accentGradient: 'from-amber-500 to-yellow-600',
      backgroundStyle: 'gradient',
      glassEffect: false,
      borderRadius: 'lg',
    },
    
    animations: {
      speed: 'medium',
      parallax: true,
      floatingElements: false,
      hoverEffects: true,
    },
    
    features: {
      chatWidget: true,
      bookingCTA: true,
      phoneNumber: true,
      socialProof: true,
    },
  },
  
  night_drive_neon: {
    id: 'night_drive_neon',
    name: 'Night Drive Neon',
    description: 'Cyberpunk aesthetic with dark neon gradients, animated elements, and social proof marquee',
    variant: 'neon',
    
    layout: {
      heroStyle: 'full-bleed',
      servicesLayout: 'marquee',
      showReviews: true,
      showFooter: true,
    },
    
    styling: {
      primaryGradient: 'from-black via-purple-950/30 to-black',
      accentGradient: 'from-fuchsia-500 to-purple-600',
      backgroundStyle: 'gradient',
      glassEffect: false,
      borderRadius: 'none',
    },
    
    animations: {
      speed: 'fast',
      parallax: false,
      floatingElements: true,
      hoverEffects: true,
    },
    
    features: {
      chatWidget: true,
      bookingCTA: true,
      phoneNumber: true,
      socialProof: true,
    },
  },
  
  executive_minimal: {
    id: 'executive_minimal',
    name: 'Executive Minimal',
    description: 'Clean typographic hero with spotlight metrics, condensed navigation, and luxury minimalism',
    variant: 'minimal',
    
    layout: {
      heroStyle: 'minimal',
      servicesLayout: 'list',
      showReviews: true,
      showFooter: true,
    },
    
    styling: {
      primaryGradient: 'from-white to-gray-50',
      accentGradient: 'from-gray-900 to-black',
      backgroundStyle: 'solid',
      glassEffect: false,
      borderRadius: 'none',
    },
    
    animations: {
      speed: 'slow',
      parallax: false,
      floatingElements: false,
      hoverEffects: false,
    },
    
    features: {
      chatWidget: true,
      bookingCTA: true,
      phoneNumber: true,
      socialProof: true,
    },
  },
};

export function getTemplate(templateId: string): TemplateConfig {
  return HOME_TEMPLATES[templateId] || HOME_TEMPLATES.current;
}

export function getAllTemplates(): TemplateConfig[] {
  return Object.values(HOME_TEMPLATES);
}

export function getTemplateById(id: string): TemplateConfig | undefined {
  return HOME_TEMPLATES[id];
}
