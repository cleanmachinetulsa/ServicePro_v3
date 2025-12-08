/**
 * SP-24: Public Site Theme Hook
 * Provides computed theme styles for public site rendering
 */

import { useMemo } from 'react';
import { 
  THEME_REGISTRY, 
  DEFAULT_THEME_CONFIG,
  type PublicSiteTheme,
  type PublicSiteThemeConfig,
  type PublicSiteThemeKey,
} from '@shared/publicSiteThemes';

export interface ComputedThemeStyles {
  theme: PublicSiteTheme;
  config: PublicSiteThemeConfig;
  gradientFrom: string;
  gradientTo: string;
  primaryColor: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  backgroundClass: string;
  surfaceClass: string;
  heroLayoutId: string;
  servicesLayoutId: string;
  testimonialsLayoutId: string;
  ctaStyleId: string;
  showRewards: boolean;
  showFaq: boolean;
  showTestimonials: boolean;
  showAbout: boolean;
  showGallery: boolean;
  showWhyChooseUs: boolean;
}

interface UsePublicSiteThemeOptions {
  themeConfig?: Partial<PublicSiteThemeConfig> | null;
  tenantPrimaryColor?: string | null;
  tenantAccentColor?: string | null;
}

/**
 * Hook to compute theme styles from theme configuration
 * Falls back to default theme and tenant branding colors
 */
export function usePublicSiteTheme({
  themeConfig,
  tenantPrimaryColor,
  tenantAccentColor,
}: UsePublicSiteThemeOptions): ComputedThemeStyles {
  return useMemo(() => {
    const config: PublicSiteThemeConfig = {
      ...DEFAULT_THEME_CONFIG,
      ...themeConfig,
    };

    const themeKey = (config.themeKey || 'clean-glass') as PublicSiteThemeKey;
    const theme = THEME_REGISTRY[themeKey] || THEME_REGISTRY['clean-glass'];

    const gradientFrom = tenantPrimaryColor || theme.colors.gradientFrom;
    const gradientTo = tenantAccentColor || theme.colors.gradientTo;
    const primaryColor = tenantPrimaryColor || theme.colors.gradientFrom;
    const accentColor = tenantAccentColor || theme.colors.accent;

    return {
      theme,
      config,
      gradientFrom,
      gradientTo,
      primaryColor,
      accentColor,
      textPrimary: theme.colors.textPrimary,
      textSecondary: theme.colors.textSecondary,
      backgroundClass: theme.colors.background,
      surfaceClass: theme.colors.surface,
      heroLayoutId: config.heroLayout,
      servicesLayoutId: config.servicesLayout,
      testimonialsLayoutId: config.testimonialsLayout,
      ctaStyleId: config.ctaStyle,
      showRewards: config.showRewards,
      showFaq: config.showFaq,
      showTestimonials: config.showTestimonials,
      showAbout: config.showAbout,
      showGallery: config.showGallery,
      showWhyChooseUs: config.showWhyChooseUs,
    };
  }, [themeConfig, tenantPrimaryColor, tenantAccentColor]);
}

/**
 * Get CSS gradient string for a theme
 */
export function getThemeGradient(primaryColor: string, accentColor: string, angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${primaryColor}, ${accentColor})`;
}

/**
 * Get hero layout classes based on layout ID
 * Uses actual layout keys from PublicSiteThemeKey types
 */
export function getHeroLayoutClasses(layoutId: string): {
  containerClass: string;
  textAlignment: string;
  showBadge: boolean;
} {
  switch (layoutId) {
    case 'centered':
      return {
        containerClass: 'text-center',
        textAlignment: 'center',
        showBadge: true,
      };
    case 'image-left':
      return {
        containerClass: 'grid grid-cols-1 lg:grid-cols-2 gap-8 items-center',
        textAlignment: 'left',
        showBadge: true,
      };
    case 'image-right':
      return {
        containerClass: 'grid grid-cols-1 lg:grid-cols-2 gap-8 items-center',
        textAlignment: 'right',
        showBadge: true,
      };
    case 'full-width-bg':
      return {
        containerClass: 'text-center relative',
        textAlignment: 'center',
        showBadge: false,
      };
    default:
      return {
        containerClass: 'text-center',
        textAlignment: 'center',
        showBadge: true,
      };
  }
}

/**
 * Get services layout grid classes based on layout ID
 * Uses actual layout keys from ServicesLayoutKey types
 */
export function getServicesGridClasses(layoutId: string): string {
  switch (layoutId) {
    case 'grid-3':
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    case 'grid-2':
      return 'grid grid-cols-1 md:grid-cols-2 gap-6';
    case 'list':
      return 'space-y-4';
    default:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  }
}

/**
 * Get CTA style classes based on style ID
 * Uses actual layout keys from CtaStyleKey types
 */
export function getCtaStyleClasses(styleId: string): {
  containerClass: string;
  buttonClass: string;
  variant: 'full-width-bar' | 'centered-buttons' | 'floating-sticky';
} {
  switch (styleId) {
    case 'full-width-bar':
      return {
        containerClass: 'bg-gradient-to-r py-16 w-full',
        buttonClass: 'bg-white text-slate-900 hover:bg-slate-100',
        variant: 'full-width-bar',
      };
    case 'centered-buttons':
      return {
        containerClass: 'py-16 text-center',
        buttonClass: 'shadow-lg hover:shadow-xl transition-shadow',
        variant: 'centered-buttons',
      };
    case 'floating-sticky':
      return {
        containerClass: 'fixed bottom-4 right-4 z-50',
        buttonClass: 'shadow-2xl hover:scale-105 transition-transform',
        variant: 'floating-sticky',
      };
    default:
      return {
        containerClass: 'py-16 text-center',
        buttonClass: 'shadow-lg hover:shadow-xl transition-shadow',
        variant: 'centered-buttons',
      };
  }
}
