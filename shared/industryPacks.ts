/**
 * Phase 8 - Industry Packs Configuration
 * 
 * Industry packs provide seed data for new tenants including:
 * - Recommended services with pricing/duration
 * - FAQ entries
 * - Website content seeds
 * - AI tone and style guidance
 * 
 * This file is used by both frontend (dropdowns) and backend (pack application).
 */

export type IndustryPackId =
  | 'auto_detailing'
  | 'lawn_care'
  | 'house_cleaning'
  | 'mobile_pet_grooming'
  | 'photography'
  | 'pressure_washing'
  | 'moving_help'
  | 'personal_training'
  | 'massage_therapy'
  | 'mobile_car_wash'
  | 'hvac_service'
  | 'plumbing'
  | 'electrical'
  | 'handyman'
  | 'generic_home_services';

export interface IndustryServiceSeed {
  id: string; // Unique identifier for this service
  name: string; // Display name
  description?: string; // Short description
  category?: string; // Category like "Interior", "Exterior", "Package"
  defaultPrice?: number | null; // Suggested price in cents (null = custom quote)
  priceRange?: string; // Display text like "$150-$300" or "Starting at $99"
  defaultDurationMinutes?: number | null; // Suggested duration
  minDurationHours?: number | null; // Minimum duration for calendar blocking
  maxDurationHours?: number | null; // Maximum duration for calendar blocking
  isAddon?: boolean; // True if this is an add-on/upsell item
  overview?: string; // Brief overview for service page
  detailedDescription?: string; // Full description
}

export interface IndustryFaqSeed {
  category: string; // Category like 'pricing', 'services', 'policies'
  question: string;
  answer: string;
  keywords?: string[]; // Search keywords for AI matching
}

export interface IndustryWebsiteSeed {
  heroHeadline: string;
  heroSubheadline: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  aboutBlurb?: string; // Short "About Us" paragraph
}

export interface IndustryAiStyleNotes {
  toneDescription?: string; // e.g. "Friendly, expert, down-to-earth"
  avoidPhrases?: string[]; // Phrases AI should avoid
  preferredTerms?: string[]; // Industry-specific terminology to use
}

export interface IndustryPack {
  id: IndustryPackId;
  name: string; // Display name
  shortLabel: string; // For compact dropdowns
  description: string; // One-line overview
  icon?: string; // Emoji or icon identifier
  recommendedPlanTier?: 'starter' | 'pro' | 'elite';
  services: IndustryServiceSeed[];
  faqs: IndustryFaqSeed[];
  websiteSeed?: IndustryWebsiteSeed;
  aiStyleNotes?: IndustryAiStyleNotes;
}

// ===================================================================
// INDUSTRY PACK DEFINITIONS
// ===================================================================

export const INDUSTRY_PACKS: IndustryPack[] = [
  // Auto Detailing (Clean Machine template)
  {
    id: 'auto_detailing',
    name: 'Auto Detailing',
    shortLabel: 'Auto Detailing',
    description: 'Mobile auto detailing and car care services',
    icon: '🚗',
    recommendedPlanTier: 'pro',
    services: [
      {
        id: 'full_detail',
        name: 'Full Detail',
        category: 'Package',
        priceRange: '$200-$350',
        defaultPrice: 27500,
        defaultDurationMinutes: 240,
        minDurationHours: 3,
        maxDurationHours: 5,
        overview: 'Complete interior and exterior detailing',
        detailedDescription: 'Our signature full detail includes deep cleaning of interior surfaces, shampooing carpets and seats, exterior wash and wax, tire shine, and window cleaning inside and out. Your vehicle will look showroom fresh.',
      },
      {
        id: 'exterior_detail',
        name: 'Exterior Detail',
        category: 'Exterior',
        priceRange: '$100-$175',
        defaultPrice: 13500,
        defaultDurationMinutes: 120,
        minDurationHours: 1.5,
        maxDurationHours: 2.5,
        overview: 'Professional exterior wash, wax, and shine',
        detailedDescription: 'Hand wash, clay bar treatment, wax application, tire dressing, and window cleaning. Restores exterior shine and protection.',
      },
      {
        id: 'interior_detail',
        name: 'Interior Detail',
        category: 'Interior',
        priceRange: '$125-$200',
        defaultPrice: 16000,
        defaultDurationMinutes: 150,
        minDurationHours: 2,
        maxDurationHours: 3,
        overview: 'Deep interior cleaning and conditioning',
        detailedDescription: 'Vacuum, shampoo carpets and upholstery, leather conditioning, dashboard cleaning, door jambs, and interior window cleaning.',
      },
      {
        id: 'ceramic_coating',
        name: 'Ceramic Coating',
        category: 'Premium',
        priceRange: '$500-$1,200',
        defaultPrice: 80000,
        defaultDurationMinutes: 480,
        minDurationHours: 6,
        maxDurationHours: 8,
        overview: 'Long-lasting paint protection',
        detailedDescription: 'Multi-year ceramic coating application with paint correction. Provides superior protection against UV, chemicals, and scratches. Hydrophobic finish for easy maintenance.',
      },
      {
        id: 'headlight_restoration',
        name: 'Headlight Restoration',
        category: 'Add-on',
        priceRange: '$75-$125',
        defaultPrice: 9500,
        defaultDurationMinutes: 60,
        isAddon: true,
        overview: 'Restore cloudy headlights to like-new clarity',
        detailedDescription: 'Professional sanding, polishing, and UV sealing to restore headlight clarity and improve nighttime visibility.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'How long does a full detail take?',
        answer: 'A full detail typically takes 3-5 hours depending on the vehicle size and condition. We recommend scheduling a half-day appointment.',
        keywords: ['duration', 'time', 'how long', 'full detail'],
      },
      {
        category: 'pricing',
        question: 'Do you charge extra for larger vehicles?',
        answer: 'Yes, SUVs and trucks typically cost 20-30% more than sedans due to the additional surface area and interior space. We provide exact quotes based on your specific vehicle.',
        keywords: ['pricing', 'cost', 'suv', 'truck', 'large vehicle'],
      },
      {
        category: 'policies',
        question: 'What is your cancellation policy?',
        answer: 'We require 24 hours notice for cancellations. Cancellations with less than 24 hours notice may incur a $50 fee.',
        keywords: ['cancel', 'cancellation', 'policy', 'reschedule'],
      },
      {
        category: 'location',
        question: 'Do you come to my location?',
        answer: 'Yes! We are a mobile detailing service and come directly to your home or office. All we need is access to water and electricity.',
        keywords: ['mobile', 'location', 'come to me', 'my house'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Premium Mobile Auto Detailing',
      heroSubheadline: 'We come to you. Professional results. Every time.',
      primaryCtaLabel: 'Book Your Detail',
      secondaryCtaLabel: 'View Services',
      aboutBlurb: 'We bring professional auto detailing directly to your driveway. With years of experience and premium products, we make your vehicle look showroom fresh without you leaving home.',
    },
    aiStyleNotes: {
      toneDescription: 'Professional yet friendly. Focus on convenience, quality, and results.',
      avoidPhrases: ['cheap', 'discount', 'basic wash'],
      preferredTerms: ['premium detail', 'mobile service', 'professional results', 'showroom finish'],
    },
  },

  // Lawn Care
  {
    id: 'lawn_care',
    name: 'Lawn Care',
    shortLabel: 'Lawn Care',
    description: 'Lawn mowing, landscaping, and yard maintenance',
    icon: '🌱',
    recommendedPlanTier: 'starter',
    services: [
      {
        id: 'weekly_mowing',
        name: 'Weekly Mowing',
        category: 'Maintenance',
        priceRange: '$35-$75',
        defaultPrice: 5000,
        defaultDurationMinutes: 45,
        minDurationHours: 0.5,
        maxDurationHours: 1.5,
        overview: 'Regular lawn mowing and trimming',
        detailedDescription: 'Weekly mowing, edging, and blowing. Includes trimming around obstacles and cleanup. Keep your lawn looking great all season.',
      },
      {
        id: 'spring_cleanup',
        name: 'Spring Cleanup',
        category: 'Seasonal',
        priceRange: '$150-$300',
        defaultPrice: 20000,
        defaultDurationMinutes: 240,
        minDurationHours: 3,
        maxDurationHours: 5,
        overview: 'Complete spring yard preparation',
        detailedDescription: 'Rake and remove winter debris, edge beds, mulch application, first mow of the season, and fertilizer treatment.',
      },
      {
        id: 'aeration_overseeding',
        name: 'Aeration & Overseeding',
        category: 'Treatment',
        priceRange: '$200-$400',
        defaultPrice: 28000,
        defaultDurationMinutes: 180,
        minDurationHours: 2,
        maxDurationHours: 3,
        overview: 'Improve lawn health and thickness',
        detailedDescription: 'Core aeration to reduce soil compaction, premium seed application, and starter fertilizer. Best done in fall for cool-season grasses.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'What does weekly mowing include?',
        answer: 'Our weekly mowing service includes cutting grass to optimal height, edging along walkways and beds, trimming around obstacles, and blowing off hard surfaces.',
        keywords: ['mowing', 'weekly', 'what included', 'service'],
      },
      {
        category: 'pricing',
        question: 'How do you price lawn services?',
        answer: 'Pricing is based on lawn size, condition, and specific services requested. We offer free estimates and can provide a custom quote after viewing your property.',
        keywords: ['price', 'cost', 'estimate', 'quote'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Professional Lawn Care Services',
      heroSubheadline: 'Beautiful lawns. Reliable service. Fair pricing.',
      primaryCtaLabel: 'Get Free Estimate',
      secondaryCtaLabel: 'Our Services',
      aboutBlurb: 'We provide professional lawn care and maintenance to keep your yard looking its best year-round. From weekly mowing to seasonal treatments, we have you covered.',
    },
    aiStyleNotes: {
      toneDescription: 'Reliable, straightforward, and neighborly.',
      preferredTerms: ['professional', 'reliable', 'quality service'],
    },
  },

  // House Cleaning
  {
    id: 'house_cleaning',
    name: 'House Cleaning',
    shortLabel: 'House Cleaning',
    description: 'Residential cleaning and maid services',
    icon: '🧹',
    recommendedPlanTier: 'pro',
    services: [
      {
        id: 'standard_clean',
        name: 'Standard Clean',
        category: 'Regular',
        priceRange: '$120-$200',
        defaultPrice: 15000,
        defaultDurationMinutes: 150,
        minDurationHours: 2,
        maxDurationHours: 3,
        overview: 'Regular home cleaning service',
        detailedDescription: 'Dusting, vacuuming, mopping, kitchen and bathroom cleaning, making beds. Perfect for weekly or bi-weekly maintenance.',
      },
      {
        id: 'deep_clean',
        name: 'Deep Clean',
        category: 'Premium',
        priceRange: '$250-$400',
        defaultPrice: 32000,
        defaultDurationMinutes: 300,
        minDurationHours: 4,
        maxDurationHours: 6,
        overview: 'Thorough top-to-bottom cleaning',
        detailedDescription: 'Everything in standard clean PLUS baseboards, inside cabinets, inside fridge, oven cleaning, window washing, and detailed scrubbing. Great for move-ins or spring cleaning.',
      },
      {
        id: 'move_out_clean',
        name: 'Move-Out Clean',
        category: 'Specialty',
        priceRange: '$300-$500',
        defaultPrice: 38000,
        defaultDurationMinutes: 360,
        minDurationHours: 5,
        maxDurationHours: 7,
        overview: 'Comprehensive cleaning for vacant homes',
        detailedDescription: 'Deep clean of entire home including inside all cabinets, appliances, baseboards, walls, windows, and closets. Designed to pass move-out inspections.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'What is the difference between standard and deep clean?',
        answer: 'Standard cleaning covers regular maintenance like dusting, vacuuming, and bathroom/kitchen cleaning. Deep cleaning includes everything in standard PLUS detailed tasks like baseboard washing, inside cabinets, oven cleaning, and window washing.',
        keywords: ['difference', 'standard', 'deep', 'deep clean'],
      },
      {
        category: 'policies',
        question: 'Do I need to provide cleaning supplies?',
        answer: 'No, we bring all necessary cleaning supplies and equipment. If you prefer us to use specific products or have allergies, just let us know and we can accommodate.',
        keywords: ['supplies', 'products', 'equipment', 'bring'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Trusted House Cleaning Services',
      heroSubheadline: 'Come home to a spotless house. Every time.',
      primaryCtaLabel: 'Book a Cleaning',
      secondaryCtaLabel: 'See Pricing',
      aboutBlurb: 'We provide professional house cleaning services you can trust. Our experienced team treats your home with care and delivers consistent, thorough results.',
    },
    aiStyleNotes: {
      toneDescription: 'Trustworthy, warm, and detail-oriented.',
      preferredTerms: ['spotless', 'trusted', 'professional team', 'attention to detail'],
    },
  },

  // Mobile Pet Grooming
  {
    id: 'mobile_pet_grooming',
    name: 'Mobile Pet Grooming',
    shortLabel: 'Pet Grooming',
    description: 'Mobile pet grooming and spa services',
    icon: '🐕',
    recommendedPlanTier: 'starter',
    services: [
      {
        id: 'full_groom_small',
        name: 'Full Groom (Small Dog)',
        category: 'Grooming',
        priceRange: '$60-$85',
        defaultPrice: 7000,
        defaultDurationMinutes: 90,
        minDurationHours: 1,
        maxDurationHours: 1.5,
        overview: 'Complete grooming for small breeds',
        detailedDescription: 'Bath, haircut, nail trim, ear cleaning, and anal gland expression. For dogs under 25 lbs.',
      },
      {
        id: 'full_groom_large',
        name: 'Full Groom (Large Dog)',
        category: 'Grooming',
        priceRange: '$90-$130',
        defaultPrice: 11000,
        defaultDurationMinutes: 120,
        minDurationHours: 1.5,
        maxDurationHours: 2.5,
        overview: 'Complete grooming for large breeds',
        detailedDescription: 'Bath, haircut, nail trim, ear cleaning, and anal gland expression. For dogs over 50 lbs.',
      },
      {
        id: 'bath_brush',
        name: 'Bath & Brush',
        category: 'Basic',
        priceRange: '$45-$75',
        defaultPrice: 6000,
        defaultDurationMinutes: 60,
        minDurationHours: 0.75,
        maxDurationHours: 1.25,
        overview: 'Refreshing bath and brush-out',
        detailedDescription: 'Gentle bath with premium shampoo, thorough brushing, blow-dry, nail trim, and cologne spritz. No haircut.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'Do you groom cats?',
        answer: 'Yes! We groom both dogs and cats. Cat grooming includes bath, nail trim, ear cleaning, and sanitary trim if needed.',
        keywords: ['cats', 'cat grooming', 'feline'],
      },
      {
        category: 'location',
        question: 'How does mobile grooming work?',
        answer: 'We come to your home in our fully-equipped mobile grooming van. Your pet gets one-on-one attention in a clean, professional environment right in your driveway.',
        keywords: ['mobile', 'how does it work', 'van', 'location'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Mobile Pet Grooming at Your Door',
      heroSubheadline: 'Stress-free grooming. Happy pets. Convenient service.',
      primaryCtaLabel: 'Book Grooming',
      secondaryCtaLabel: 'View Services',
      aboutBlurb: 'We bring professional pet grooming directly to you. No stressful car rides, no kennels – just personalized, gentle care in our mobile salon.',
    },
    aiStyleNotes: {
      toneDescription: 'Caring, gentle, and pet-focused.',
      preferredTerms: ['gentle', 'stress-free', 'professional care', 'mobile salon'],
    },
  },

  // Photography
  {
    id: 'photography',
    name: 'Photography',
    shortLabel: 'Photography',
    description: 'Professional photography services',
    icon: '📸',
    recommendedPlanTier: 'pro',
    services: [
      {
        id: 'portrait_session',
        name: 'Portrait Session',
        category: 'Portraits',
        priceRange: '$250-$500',
        defaultPrice: 35000,
        defaultDurationMinutes: 120,
        minDurationHours: 1.5,
        maxDurationHours: 2.5,
        overview: 'Professional portrait photography',
        detailedDescription: '1-2 hour session, multiple outfit changes, 50+ edited photos delivered digitally. Perfect for families, seniors, or headshots.',
      },
      {
        id: 'wedding_coverage',
        name: 'Wedding Full Day',
        category: 'Weddings',
        priceRange: '$2,000-$4,000',
        defaultPrice: 300000,
        defaultDurationMinutes: 600,
        minDurationHours: 8,
        maxDurationHours: 10,
        overview: 'Complete wedding day photography',
        detailedDescription: 'Full day coverage from getting ready through reception. 500+ edited photos, online gallery, and print release.',
      },
      {
        id: 'real_estate',
        name: 'Real Estate Photos',
        category: 'Commercial',
        priceRange: '$150-$300',
        defaultPrice: 20000,
        defaultDurationMinutes: 90,
        minDurationHours: 1,
        maxDurationHours: 2,
        overview: 'Professional property photography',
        detailedDescription: '20-30 HDR photos of interior and exterior. Fast 24-hour turnaround. MLS-ready.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'What is included in a portrait session?',
        answer: 'Portrait sessions include 1-2 hours of shooting time, professional editing of all photos, and digital delivery of 50+ images. You can purchase prints and additional products separately.',
        keywords: ['portrait', 'session', 'included', 'what included'],
      },
      {
        category: 'policies',
        question: 'What is your booking and payment policy?',
        answer: 'A 30% deposit is required to book your date. The remaining balance is due 7 days before your session. We accept credit cards, Venmo, and Zelle.',
        keywords: ['payment', 'deposit', 'booking', 'policy'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Capturing Your Most Important Moments',
      heroSubheadline: 'Professional photography with a personal touch.',
      primaryCtaLabel: 'Book a Session',
      secondaryCtaLabel: 'View Portfolio',
      aboutBlurb: 'We specialize in capturing authentic moments that you\'ll treasure forever. From weddings to family portraits, we bring creativity and professionalism to every shoot.',
    },
    aiStyleNotes: {
      toneDescription: 'Creative, warm, and professional.',
      preferredTerms: ['authentic moments', 'creative vision', 'timeless photos'],
    },
  },

  // Pressure Washing
  {
    id: 'pressure_washing',
    name: 'Pressure Washing',
    shortLabel: 'Pressure Washing',
    description: 'Power washing and exterior cleaning',
    icon: '💦',
    recommendedPlanTier: 'starter',
    services: [
      {
        id: 'house_wash',
        name: 'House Washing',
        category: 'Exterior',
        priceRange: '$200-$500',
        defaultPrice: 32000,
        defaultDurationMinutes: 180,
        minDurationHours: 2,
        maxDurationHours: 4,
        overview: 'Soft wash house exterior cleaning',
        detailedDescription: 'Safe soft-wash cleaning of siding, soffits, fascia, and foundation. Removes mold, mildew, and dirt without damage.',
      },
      {
        id: 'driveway_cleaning',
        name: 'Driveway/Sidewalk Cleaning',
        category: 'Concrete',
        priceRange: '$150-$350',
        defaultPrice: 22000,
        defaultDurationMinutes: 120,
        minDurationHours: 1.5,
        maxDurationHours: 3,
        overview: 'High-pressure concrete cleaning',
        detailedDescription: 'Remove oil stains, dirt, and grime from driveways, sidewalks, and patios. Restore like-new appearance.',
      },
      {
        id: 'deck_fence_cleaning',
        name: 'Deck & Fence Cleaning',
        category: 'Wood',
        priceRange: '$175-$400',
        defaultPrice: 26000,
        defaultDurationMinutes: 150,
        minDurationHours: 2,
        maxDurationHours: 3.5,
        overview: 'Safe cleaning for wood surfaces',
        detailedDescription: 'Gentle cleaning and brightening of wood decks and fences. Can be followed by staining/sealing services.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'Will pressure washing damage my siding?',
        answer: 'No! We use soft washing techniques for delicate surfaces like siding and roofs. High pressure is only used on durable surfaces like concrete.',
        keywords: ['damage', 'siding', 'safe', 'soft wash'],
      },
      {
        category: 'pricing',
        question: 'How do you calculate pricing?',
        answer: 'Pricing is based on square footage and surface type. We offer free estimates and can provide an exact quote after a quick phone call or photos.',
        keywords: ['pricing', 'cost', 'estimate', 'how much'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Professional Pressure Washing Services',
      heroSubheadline: 'Restore your property\'s curb appeal.',
      primaryCtaLabel: 'Get Free Quote',
      secondaryCtaLabel: 'Our Services',
      aboutBlurb: 'We provide expert pressure washing and soft washing to make your home\'s exterior look brand new. Safe, effective, and affordable.',
    },
    aiStyleNotes: {
      toneDescription: 'Professional, reliable, results-focused.',
      preferredTerms: ['restore', 'curb appeal', 'like-new', 'professional results'],
    },
  },

  // Generic Home Services
  {
    id: 'generic_home_services',
    name: 'Home Services',
    shortLabel: 'Home Services',
    description: 'General home repair and maintenance',
    icon: '🔧',
    recommendedPlanTier: 'starter',
    services: [
      {
        id: 'handyman_hourly',
        name: 'Handyman Services (Hourly)',
        category: 'General',
        priceRange: '$75-$125/hr',
        defaultPrice: 9500,
        defaultDurationMinutes: 60,
        minDurationHours: 1,
        maxDurationHours: 4,
        overview: 'General home repairs and installations',
        detailedDescription: 'From hanging pictures to minor repairs, we handle all those small jobs around your home. 2-hour minimum.',
      },
      {
        id: 'furniture_assembly',
        name: 'Furniture Assembly',
        category: 'Assembly',
        priceRange: '$80-$200',
        defaultPrice: 12000,
        defaultDurationMinutes: 90,
        minDurationHours: 1,
        maxDurationHours: 3,
        overview: 'Professional furniture assembly',
        detailedDescription: 'We assemble all types of furniture including beds, desks, shelving units, and more. Pricing based on complexity.',
      },
      {
        id: 'tv_mounting',
        name: 'TV Mounting',
        category: 'Installation',
        priceRange: '$120-$250',
        defaultPrice: 17500,
        defaultDurationMinutes: 90,
        minDurationHours: 1,
        maxDurationHours: 2,
        overview: 'Professional TV wall mounting',
        detailedDescription: 'Secure wall mounting with cable concealment options. Includes all hardware and stud finding.',
      },
    ],
    faqs: [
      {
        category: 'services',
        question: 'What types of jobs do you handle?',
        answer: 'We handle a wide variety of home repairs and installations including drywall repair, door adjustments, fixture installation, furniture assembly, and more. If you\'re not sure, just ask!',
        keywords: ['services', 'what do you do', 'types of jobs'],
      },
      {
        category: 'pricing',
        question: 'Do you charge a service call fee?',
        answer: 'We have a 2-hour minimum for most jobs, which covers travel and setup time. This ensures we can complete your project efficiently.',
        keywords: ['service call', 'minimum', 'fee', 'travel'],
      },
    ],
    websiteSeed: {
      heroHeadline: 'Your Trusted Home Services Partner',
      heroSubheadline: 'Quality repairs and installations. Fair pricing.',
      primaryCtaLabel: 'Request Service',
      secondaryCtaLabel: 'See Services',
      aboutBlurb: 'We provide reliable home repair and maintenance services. From small fixes to larger projects, we get the job done right.',
    },
    aiStyleNotes: {
      toneDescription: 'Helpful, reliable, and straightforward.',
      preferredTerms: ['trusted', 'reliable', 'quality work', 'get it done right'],
    },
  },
];

// Create lookup map by ID for fast access
export const INDUSTRY_PACK_BY_ID: Record<IndustryPackId, IndustryPack> = 
  INDUSTRY_PACKS.reduce((acc, pack) => {
    acc[pack.id] = pack;
    return acc;
  }, {} as Record<IndustryPackId, IndustryPack>);

// Helper to get pack by ID with fallback
export function getIndustryPack(id: string | null | undefined): IndustryPack | null {
  if (!id) return null;
  return INDUSTRY_PACK_BY_ID[id as IndustryPackId] || null;
}

// Helper to get all pack options for dropdowns
export function getIndustryPackOptions() {
  return INDUSTRY_PACKS.map(pack => ({
    value: pack.id,
    label: pack.shortLabel,
    description: pack.description,
    icon: pack.icon,
  }));
}
