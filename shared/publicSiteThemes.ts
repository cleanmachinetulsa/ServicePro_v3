/**
 * SP-24: Public Site Theme Registry
 * Defines available themes for tenant public websites
 */

export type PublicSiteThemeKey = 
  | "clean-glass" 
  | "bold-gradient" 
  | "minimal-light"
  | "dark-professional"
  | "warm-friendly";

export type HeroLayoutKey = 
  | "centered"
  | "image-left"
  | "image-right"
  | "full-width-bg";

export type CtaStyleKey = 
  | "full-width-bar"
  | "centered-buttons"
  | "floating-sticky";

export type ServicesLayoutKey =
  | "grid-3"
  | "grid-2"
  | "list";

export type TestimonialsLayoutKey =
  | "carousel"
  | "stacked";

export interface PublicSiteTheme {
  key: PublicSiteThemeKey;
  label: string;
  description: string;
  colors: {
    background: string;
    surface: string;
    accent: string;
    textPrimary: string;
    textSecondary: string;
    gradientFrom: string;
    gradientTo: string;
  };
  heroVariants: Array<{ id: HeroLayoutKey; label: string }>;
  ctaStyles: Array<{ id: CtaStyleKey; label: string }>;
  servicesLayouts: Array<{ id: ServicesLayoutKey; label: string }>;
  testimonialLayouts: Array<{ id: TestimonialsLayoutKey; label: string }>;
}

export const PUBLIC_SITE_THEMES: PublicSiteTheme[] = [
  {
    key: "clean-glass",
    label: "Clean Glass",
    description: "Modern glassmorphism with soft gradients and transparency. Perfect for professional services.",
    colors: {
      background: "from-slate-50 via-purple-50/20 to-cyan-50/30",
      surface: "bg-white/70 backdrop-blur-md border-white/40",
      accent: "#6366f1",
      textPrimary: "#0f172a",
      textSecondary: "#64748b",
      gradientFrom: "#6366f1",
      gradientTo: "#a855f7",
    },
    heroVariants: [
      { id: "centered", label: "Centered Text" },
      { id: "image-left", label: "Image Left, Text Right" },
      { id: "image-right", label: "Image Right, Text Left" },
      { id: "full-width-bg", label: "Full Width Background" },
    ],
    ctaStyles: [
      { id: "full-width-bar", label: "Full Width Bar" },
      { id: "centered-buttons", label: "Centered Buttons" },
      { id: "floating-sticky", label: "Floating Sticky" },
    ],
    servicesLayouts: [
      { id: "grid-3", label: "3-Column Grid" },
      { id: "grid-2", label: "2-Column Grid" },
      { id: "list", label: "List View" },
    ],
    testimonialLayouts: [
      { id: "carousel", label: "Carousel" },
      { id: "stacked", label: "Stacked Cards" },
    ],
  },
  {
    key: "bold-gradient",
    label: "Bold Gradient",
    description: "Vibrant gradients with bold colors. Great for businesses wanting to stand out.",
    colors: {
      background: "from-indigo-900 via-purple-900 to-pink-800",
      surface: "bg-white/10 backdrop-blur-lg border-white/20",
      accent: "#f472b6",
      textPrimary: "#ffffff",
      textSecondary: "#e2e8f0",
      gradientFrom: "#ec4899",
      gradientTo: "#8b5cf6",
    },
    heroVariants: [
      { id: "centered", label: "Centered Text" },
      { id: "image-left", label: "Image Left, Text Right" },
      { id: "image-right", label: "Image Right, Text Left" },
      { id: "full-width-bg", label: "Full Width Background" },
    ],
    ctaStyles: [
      { id: "full-width-bar", label: "Full Width Bar" },
      { id: "centered-buttons", label: "Centered Buttons" },
      { id: "floating-sticky", label: "Floating Sticky" },
    ],
    servicesLayouts: [
      { id: "grid-3", label: "3-Column Grid" },
      { id: "grid-2", label: "2-Column Grid" },
      { id: "list", label: "List View" },
    ],
    testimonialLayouts: [
      { id: "carousel", label: "Carousel" },
      { id: "stacked", label: "Stacked Cards" },
    ],
  },
  {
    key: "minimal-light",
    label: "Minimal Light",
    description: "Clean, minimal design with lots of white space. Ideal for professional services.",
    colors: {
      background: "from-white to-gray-50",
      surface: "bg-white border-gray-200",
      accent: "#0ea5e9",
      textPrimary: "#111827",
      textSecondary: "#6b7280",
      gradientFrom: "#0ea5e9",
      gradientTo: "#22d3ee",
    },
    heroVariants: [
      { id: "centered", label: "Centered Text" },
      { id: "image-left", label: "Image Left, Text Right" },
      { id: "image-right", label: "Image Right, Text Left" },
      { id: "full-width-bg", label: "Full Width Background" },
    ],
    ctaStyles: [
      { id: "full-width-bar", label: "Full Width Bar" },
      { id: "centered-buttons", label: "Centered Buttons" },
      { id: "floating-sticky", label: "Floating Sticky" },
    ],
    servicesLayouts: [
      { id: "grid-3", label: "3-Column Grid" },
      { id: "grid-2", label: "2-Column Grid" },
      { id: "list", label: "List View" },
    ],
    testimonialLayouts: [
      { id: "carousel", label: "Carousel" },
      { id: "stacked", label: "Stacked Cards" },
    ],
  },
  {
    key: "dark-professional",
    label: "Dark Professional",
    description: "Sleek dark theme with professional aesthetics. Perfect for premium services.",
    colors: {
      background: "from-slate-900 via-slate-800 to-slate-900",
      surface: "bg-slate-800/80 backdrop-blur-sm border-slate-700",
      accent: "#fbbf24",
      textPrimary: "#f8fafc",
      textSecondary: "#94a3b8",
      gradientFrom: "#fbbf24",
      gradientTo: "#f59e0b",
    },
    heroVariants: [
      { id: "centered", label: "Centered Text" },
      { id: "image-left", label: "Image Left, Text Right" },
      { id: "image-right", label: "Image Right, Text Left" },
      { id: "full-width-bg", label: "Full Width Background" },
    ],
    ctaStyles: [
      { id: "full-width-bar", label: "Full Width Bar" },
      { id: "centered-buttons", label: "Centered Buttons" },
      { id: "floating-sticky", label: "Floating Sticky" },
    ],
    servicesLayouts: [
      { id: "grid-3", label: "3-Column Grid" },
      { id: "grid-2", label: "2-Column Grid" },
      { id: "list", label: "List View" },
    ],
    testimonialLayouts: [
      { id: "carousel", label: "Carousel" },
      { id: "stacked", label: "Stacked Cards" },
    ],
  },
  {
    key: "warm-friendly",
    label: "Warm & Friendly",
    description: "Warm tones with a welcoming feel. Great for family-oriented businesses.",
    colors: {
      background: "from-orange-50 via-amber-50 to-yellow-50",
      surface: "bg-white/80 backdrop-blur-sm border-orange-100",
      accent: "#ea580c",
      textPrimary: "#1c1917",
      textSecondary: "#78716c",
      gradientFrom: "#ea580c",
      gradientTo: "#f59e0b",
    },
    heroVariants: [
      { id: "centered", label: "Centered Text" },
      { id: "image-left", label: "Image Left, Text Right" },
      { id: "image-right", label: "Image Right, Text Left" },
      { id: "full-width-bg", label: "Full Width Background" },
    ],
    ctaStyles: [
      { id: "full-width-bar", label: "Full Width Bar" },
      { id: "centered-buttons", label: "Centered Buttons" },
      { id: "floating-sticky", label: "Floating Sticky" },
    ],
    servicesLayouts: [
      { id: "grid-3", label: "3-Column Grid" },
      { id: "grid-2", label: "2-Column Grid" },
      { id: "list", label: "List View" },
    ],
    testimonialLayouts: [
      { id: "carousel", label: "Carousel" },
      { id: "stacked", label: "Stacked Cards" },
    ],
  },
];

export function getTheme(key: PublicSiteThemeKey): PublicSiteTheme | undefined {
  return PUBLIC_SITE_THEMES.find(t => t.key === key);
}

export const THEME_REGISTRY: Record<PublicSiteThemeKey, PublicSiteTheme> = Object.fromEntries(
  PUBLIC_SITE_THEMES.map(theme => [theme.key, theme])
) as Record<PublicSiteThemeKey, PublicSiteTheme>;

export function getDefaultTheme(): PublicSiteTheme {
  return PUBLIC_SITE_THEMES[0]; // clean-glass as default
}

export interface PublicSiteThemeConfig {
  themeKey: PublicSiteThemeKey;
  heroLayout: HeroLayoutKey;
  servicesLayout: ServicesLayoutKey;
  testimonialsLayout: TestimonialsLayoutKey;
  ctaStyle: CtaStyleKey;
  showTestimonials: boolean;
  showFaq: boolean;
  showGallery: boolean;
  showWhyChooseUs: boolean;
  showAbout: boolean;
  showRewards: boolean;
}

export const DEFAULT_THEME_CONFIG: PublicSiteThemeConfig = {
  themeKey: "clean-glass",
  heroLayout: "centered",
  servicesLayout: "grid-3",
  testimonialsLayout: "stacked",
  ctaStyle: "centered-buttons",
  showTestimonials: true,
  showFaq: true,
  showGallery: false,
  showWhyChooseUs: true,
  showAbout: true,
  showRewards: true,
};
