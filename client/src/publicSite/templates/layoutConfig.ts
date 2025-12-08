/**
 * SP-24: Layout Configuration for Public Site Templates
 * Defines section-level layout variations for the public site
 */

import type { 
  HeroLayoutKey, 
  CtaStyleKey, 
  ServicesLayoutKey, 
  TestimonialsLayoutKey 
} from '@shared/publicSiteThemes';

export interface HeroLayoutConfig {
  id: HeroLayoutKey;
  label: string;
  description: string;
  containerClasses: string;
  textContainerClasses: string;
  imageContainerClasses?: string;
  showImage: boolean;
  textAlign: 'left' | 'center' | 'right';
}

export const HERO_LAYOUTS: Record<HeroLayoutKey, HeroLayoutConfig> = {
  centered: {
    id: "centered",
    label: "Centered Text",
    description: "Text centered with decorative background elements",
    containerClasses: "flex flex-col items-center justify-center text-center",
    textContainerClasses: "max-w-2xl mx-auto",
    showImage: false,
    textAlign: "center",
  },
  "image-left": {
    id: "image-left",
    label: "Image Left",
    description: "Image on the left, text on the right",
    containerClasses: "flex flex-col md:flex-row items-center gap-8 md:gap-12",
    textContainerClasses: "flex-1 text-left",
    imageContainerClasses: "flex-1 order-first",
    showImage: true,
    textAlign: "left",
  },
  "image-right": {
    id: "image-right",
    label: "Image Right",
    description: "Text on the left, image on the right",
    containerClasses: "flex flex-col md:flex-row items-center gap-8 md:gap-12",
    textContainerClasses: "flex-1 text-left",
    imageContainerClasses: "flex-1 order-last",
    showImage: true,
    textAlign: "left",
  },
  "full-width-bg": {
    id: "full-width-bg",
    label: "Full Width Background",
    description: "Text overlay on a full-width background image",
    containerClasses: "relative flex flex-col items-center justify-center text-center min-h-[60vh]",
    textContainerClasses: "max-w-2xl mx-auto relative z-10",
    showImage: true,
    textAlign: "center",
  },
};

export interface CtaStyleConfig {
  id: CtaStyleKey;
  label: string;
  description: string;
  containerClasses: string;
  buttonClasses: string;
  position: 'inline' | 'fixed';
}

export const CTA_STYLES: Record<CtaStyleKey, CtaStyleConfig> = {
  "full-width-bar": {
    id: "full-width-bar",
    label: "Full Width Bar",
    description: "CTA section spans full width with centered content",
    containerClasses: "w-full py-12 px-4 bg-gradient-to-r",
    buttonClasses: "px-8 py-4 text-lg font-semibold shadow-xl",
    position: "inline",
  },
  "centered-buttons": {
    id: "centered-buttons",
    label: "Centered Buttons",
    description: "Clean centered button group",
    containerClasses: "max-w-xl mx-auto py-12 px-4 text-center",
    buttonClasses: "px-6 py-3 font-medium",
    position: "inline",
  },
  "floating-sticky": {
    id: "floating-sticky",
    label: "Floating Sticky",
    description: "Sticky floating CTA bar at the bottom",
    containerClasses: "fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 py-3",
    buttonClasses: "px-6 py-2 font-medium",
    position: "fixed",
  },
};

export interface ServicesLayoutConfig {
  id: ServicesLayoutKey;
  label: string;
  description: string;
  gridClasses: string;
  cardVariant: 'compact' | 'standard' | 'expanded';
}

export const SERVICES_LAYOUTS: Record<ServicesLayoutKey, ServicesLayoutConfig> = {
  "grid-3": {
    id: "grid-3",
    label: "3-Column Grid",
    description: "Services displayed in a 3-column grid",
    gridClasses: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
    cardVariant: "standard",
  },
  "grid-2": {
    id: "grid-2",
    label: "2-Column Grid",
    description: "Services displayed in a 2-column grid with larger cards",
    gridClasses: "grid grid-cols-1 md:grid-cols-2 gap-8",
    cardVariant: "expanded",
  },
  "list": {
    id: "list",
    label: "List View",
    description: "Services displayed as a vertical list",
    gridClasses: "flex flex-col gap-4",
    cardVariant: "compact",
  },
};

export interface TestimonialsLayoutConfig {
  id: TestimonialsLayoutKey;
  label: string;
  description: string;
  containerClasses: string;
  displayMode: 'carousel' | 'stack';
}

export const TESTIMONIALS_LAYOUTS: Record<TestimonialsLayoutKey, TestimonialsLayoutConfig> = {
  carousel: {
    id: "carousel",
    label: "Carousel",
    description: "Auto-rotating testimonial carousel",
    containerClasses: "relative overflow-hidden",
    displayMode: "carousel",
  },
  stacked: {
    id: "stacked",
    label: "Stacked Cards",
    description: "Testimonials displayed as stacked cards",
    containerClasses: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
    displayMode: "stack",
  },
};

export interface SectionConfig {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const TOGGLEABLE_SECTIONS: SectionConfig[] = [
  {
    id: "showAbout",
    label: "About Section",
    description: "Display an About Us section with your business description",
    defaultEnabled: true,
  },
  {
    id: "showTestimonials",
    label: "Testimonials",
    description: "Display customer testimonials and reviews",
    defaultEnabled: true,
  },
  {
    id: "showFaq",
    label: "FAQ Section",
    description: "Display frequently asked questions",
    defaultEnabled: true,
  },
  {
    id: "showGallery",
    label: "Photo Gallery",
    description: "Display a gallery of your work",
    defaultEnabled: false,
  },
  {
    id: "showWhyChooseUs",
    label: "Why Choose Us",
    description: "Display key differentiators and benefits",
    defaultEnabled: true,
  },
  {
    id: "showRewards",
    label: "Rewards Program",
    description: "Display your loyalty/rewards program",
    defaultEnabled: true,
  },
];
