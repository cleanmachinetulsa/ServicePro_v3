// src/config/industryPacks.ts

/**
 * This file defines all industry packs for ServicePro.
 *
 * You can:
 *  - Add/remove industries by editing INDUSTRY_PACKS.
 *  - Turn entire feature groups on/off with featureToggles.
 *
 * Later, your onboarding wizard can:
 *  1. Let the user choose an industry.
 *  2. Let them toggle features.
 *  3. Auto-populate services, upsells, and AI persona defaults.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * HOW TO CHANGE INDUSTRY HERO IMAGES:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Each industry has two image fields:
 *   - imageUrl: The URL of the hero image (HTTPS required)
 *   - imageAlt: Alt text for accessibility (optional but recommended)
 * 
 * ═══ METHOD 1: UPLOAD VIA ADMIN UI (RECOMMENDED) ═══
 * 
 *   1. Go to: /admin/industry-images (login required)
 *   2. Select an image file for the industry you want to update
 *   3. Click "Upload" - the image will be saved to /uploads/industry/
 *   4. Copy the URL from the success message
 *   5. Paste it into the imageUrl field below (and update imageAlt)
 * 
 * ═══ METHOD 2: EDIT CONFIG FILE DIRECTLY ═══
 * 
 *   1. Find the industry object you want to update (e.g., "auto_detailing_mobile")
 *   2. Replace the imageUrl with your new image URL
 *   3. Update the imageAlt to describe the new image
 * 
 * Image recommendations:
 *   - Use HTTPS URLs only
 *   - Landscape format works best (16:9 aspect ratio ideal)
 *   - Use high-quality images from Unsplash, Pexels, or your own CDN
 *   - Image will display at h-32 (128px) on mobile, h-40 (160px) on desktop
 * 
 * Example image sources:
 *   - Upload UI: /admin/industry-images (saves to /uploads/industry/)
 *   - Unsplash: https://images.unsplash.com/photo-ID?w=800&h=450&fit=crop
 *   - Pexels: https://images.pexels.com/photos/ID/pexels-photo-ID.jpeg
 *   - Your own: Any HTTPS CDN
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

export type ServiceTemplate = {
  id: string;
  label: string;
  description: string;
  basePriceHint?: string; // e.g. "$150–$250"
  defaultDurationMinutes?: number;
  isPremium?: boolean;
};

export type FeatureToggle = {
  id: string;
  label: string;
  description: string;
  enabledByDefault: boolean;
};

export type AIPersona = {
  internalName: string;
  voiceStyle: "premium_concierge" | "down_to_earth" | "friendly_local" | "tech_forward";
  shortTagline: string;
  smsTone: string;   // short description, not actual prompt
  emailTone: string; // short description, not actual prompt
};

export type AIBehaviorRuleTemplate = {
  ruleKey: string;        // e.g., 'system_prompt', 'topic_boundaries'
  category: string;       // 'personality', 'boundaries', 'upsell', etc.
  name: string;
  description?: string;
  content: string;        // The actual rule text/prompt
  priority?: number;      // For ordering rules (lower = higher priority)
  enabled?: boolean;
};

export type SmsTemplateConfig = {
  templateKey: string;    // e.g., 'booking_confirmation'
  category: string;       // 'booking', 'technician', 'referrals', etc.
  name: string;
  description?: string;
  body: string;           // Template text with {variables}
  variables: Array<{
    name: string;
    description: string;
    sample: string;
    required: boolean;
  }>;
  defaultPayload?: Record<string, any>;
  enabled?: boolean;
};

export type FaqEntryTemplate = {
  category: string;       // 'pricing', 'services', 'policies', etc.
  question: string;
  answer: string;
  keywords?: string[];
  displayOrder?: number;
  enabled?: boolean;
};

export type IndustryPack = {
  id: string;           // stable key, e.g. "photography_full"
  slug: string;         // for URLs if you want, e.g. "photography"
  label: string;        // what shows in UI, e.g. "Photography & Media"
  category: string;     // e.g. "Home Services", "Creative"
  description: string;
  exampleBusinessName: string;
  imageUrl: string;     // Hero image URL (HTTPS, landscape, high-quality)
  imageAlt?: string;    // Alt text for accessibility
  defaultPrimaryServices: ServiceTemplate[];
  defaultUpsellServices: ServiceTemplate[];
  featureToggles: FeatureToggle[];
  aiPersona: AIPersona;
  aiBehaviorRules?: AIBehaviorRuleTemplate[];
  smsTemplates?: SmsTemplateConfig[];
  faqEntries?: FaqEntryTemplate[];
};

// ---------------
// ALL INDUSTRIES
// ---------------

export const INDUSTRY_PACKS: IndustryPack[] = [
  // 1) AUTO DETAILING / YOUR HOME BASE
  {
    id: "auto_detailing_mobile",
    slug: "auto-detailing",
    label: "Mobile Auto Detailing",
    category: "Automotive",
    description:
      "Full-service mobile auto detailing: interiors, exteriors, coatings, and maintenance plans.",
    exampleBusinessName: "Clean Machine Auto Detail",
    imageUrl: "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=800&h=450&fit=crop",
    imageAlt: "Professional detailer polishing luxury car",
    defaultPrimaryServices: [
      {
        id: "detail_basic",
        label: "Basic Interior & Exterior Detail",
        description: "Full wash, vacuum, wipe-down, windows, and tire shine.",
        basePriceHint: "$150–$250",
        defaultDurationMinutes: 150
      },
      {
        id: "detail_premium",
        label: "Premium Full Detail",
        description:
          "Deep interior clean, steam or extractor on stains, exterior decon, and paint sealant.",
        basePriceHint: "$250–$400",
        defaultDurationMinutes: 240,
        isPremium: true
      },
      {
        id: "detail_maintenance",
        label: "Maintenance Detail",
        description:
          "For returning clients: quick clean keeping a coated or recently-detailed vehicle fresh.",
        basePriceHint: "$120–$180",
        defaultDurationMinutes: 120
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_pet_hair",
        label: "Heavy Pet Hair Removal",
        description: "Add-on for vehicles with significant pet hair.",
        basePriceHint: "+$40–$100"
      },
      {
        id: "upsell_ceramic",
        label: "Ceramic Coating",
        description: "Multi-year protection with advanced ceramic coating packages.",
        basePriceHint: "Starts at $600+",
        isPremium: true
      },
      {
        id: "upsell_odor",
        label: "Odor/Ozone Treatment",
        description: "Treat lingering odors with ozone or similar odor-elimination process.",
        basePriceHint: "+$75–$150"
      }
    ],
    featureToggles: [
      {
        id: "fleet_accounts",
        label: "Fleet & Commercial Accounts",
        description: "Enable pricing logic and messaging for fleets and dealer accounts.",
        enabledByDefault: true
      },
      {
        id: "ceramic_only_mode",
        label: "Ceramic & High-Ticket Focus",
        description: "Shift copy and funnels toward coating and premium packages.",
        enabledByDefault: false
      }
    ],
    aiPersona: {
      internalName: "auto_detailing_premium_local",
      voiceStyle: "friendly_local",
      shortTagline: "Friendly local detailer who talks like they’ve spent years in the bay.",
      smsTone:
        "Down-to-earth, efficient, a bit conversational, uses simple explanations about packages and weather.",
      emailTone:
        "Professional but relaxed, focuses on clarity, maintenance education, and value over hype."
    }
  },

  // 2) LAWN CARE & LANDSCAPING
  {
    id: "lawn_care_landscaping",
    slug: "lawn-care",
    label: "Lawn Care & Landscaping",
    category: "Home Services",
    description:
      "Recurring lawn care, landscaping projects, cleanups, and seasonal services.",
    exampleBusinessName: "GreenLine Lawn & Landscape",
    imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&h=450&fit=crop",
    imageAlt: "Professional lawn care service with pristine green lawn",
    defaultPrimaryServices: [
      {
        id: "mow_basic",
        label: "Standard Mow & Trim",
        description: "Weekly or bi-weekly mowing, edging, and blow-off.",
        basePriceHint: "$45–$90",
        defaultDurationMinutes: 45
      },
      {
        id: "cleanup",
        label: "Yard Clean-Up",
        description: "Leaf removal, debris cleanup, and basic trimming.",
        basePriceHint: "$200–$500",
        defaultDurationMinutes: 180
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_fertilizer",
        label: "Fertilization & Weed Control",
        description: "Scheduled treatments tailored to the region and grass type.",
        basePriceHint: "Varies / seasonal packages"
      },
      {
        id: "upsell_mulch",
        label: "Mulch & Bed Refresh",
        description: "Refresh flower beds with new mulch or rock and trimming.",
        basePriceHint: "$200–$600"
      }
    ],
    featureToggles: [
      {
        id: "recurring_contracts",
        label: "Recurring Contracts",
        description: "Emphasize weekly/bi-weekly service and automate renewals.",
        enabledByDefault: true
      },
      {
        id: "project_work",
        label: "One-Off Landscape Projects",
        description: "Highlight installs, redesign, and project-based quotes.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "lawn_care_local_pro",
      voiceStyle: "friendly_local",
      shortTagline: "Friendly yard pro who talks seasons, rain, and grass health.",
      smsTone:
        "Casual and approachable, uses simple lawn lingo, confirms gates, pets, and day-of details.",
      emailTone:
        "Helpful and educational, explains seasonal plans clearly and sets expectations for recurring visits."
    }
  },

  // 3) HOUSE CLEANING / MAID SERVICE
  {
    id: "house_cleaning_maids",
    slug: "house-cleaning",
    label: "House Cleaning & Maid Service",
    category: "Home Services",
    description: "Standard, deep, and move-out cleans for residential homes.",
    exampleBusinessName: "Spark & Shine Home Cleaning",
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=450&fit=crop",
    imageAlt: "Professional cleaner in modern clean living room",
    defaultPrimaryServices: [
      {
        id: "recurring_clean",
        label: "Recurring Standard Clean",
        description: "Weekly, bi-weekly, or monthly general clean.",
        basePriceHint: "$120–$200+",
        defaultDurationMinutes: 150
      },
      {
        id: "deep_clean",
        label: "Deep Clean",
        description: "Top-to-bottom detail including baseboards, blinds, and appliances.",
        basePriceHint: "$250–$450",
        defaultDurationMinutes: 240,
        isPremium: true
      },
      {
        id: "move_out",
        label: "Move-In / Move-Out Clean",
        description: "Vacant home cleaning focused on cabinets, appliances, and bathrooms.",
        basePriceHint: "$300–$600",
        defaultDurationMinutes: 300
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_inside_fridge",
        label: "Inside Fridge / Oven",
        description: "Deep clean of appliances inside.",
        basePriceHint: "+$40–$80"
      },
      {
        id: "upsell_windows",
        label: "Interior Glass & Windows",
        description: "Interior window cleaning for main living areas.",
        basePriceHint: "+$60–$120"
      }
    ],
    featureToggles: [
      {
        id: "airbnb_turnovers",
        label: "Short-Term Rental Turnovers",
        description: "Enable Airbnb/VRBO turnover logic, linens, restocking, and guest-ready checks.",
        enabledByDefault: true
      },
      {
        id: "supplies_included",
        label: "Supplies Included Pricing",
        description: "Assume cleaner brings all supplies and adjust quotes accordingly.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "house_cleaning_concierge",
      voiceStyle: "premium_concierge",
      shortTagline: "White-glove but warm, focussed on trust, safety, and consistency.",
      smsTone:
        "Polite and reassuring, confirms access instructions, pets, alarms, and expectations.",
      emailTone:
        "Professional and detailed, clearly lists what’s included, what’s add-on, and what to prep before arrival."
    }
  },

  // 4) PRESSURE WASHING
  {
    id: "pressure_washing",
    slug: "pressure-washing",
    label: "Pressure Washing & Soft Wash",
    category: "Home Services",
    description:
      "Driveways, siding, roofs, and commercial flatwork with soft wash and high-pressure options.",
    exampleBusinessName: "Prime Wash Exterior Cleaning",
    imageUrl: "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&h=450&fit=crop",
    imageAlt: "Pressure washing driveway with professional equipment",
    defaultPrimaryServices: [
      {
        id: "driveway_clean",
        label: "Driveway & Walkway Cleaning",
        description: "Pressure wash concrete and flat surfaces around the home.",
        basePriceHint: "$175–$400",
        defaultDurationMinutes: 120
      },
      {
        id: "house_wash",
        label: "House Wash (Soft Wash)",
        description: "Soft wash siding, eaves, and fascia; includes gutters exterior rinse.",
        basePriceHint: "$300–$600",
        defaultDurationMinutes: 180
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_roof_softwash",
        label: "Roof Soft Wash",
        description: "Roof algae, moss, and stain removal with proper chemistry.",
        basePriceHint: "$600–$1,500",
        isPremium: true
      },
      {
        id: "upsell_sealing",
        label: "Concrete Sealing",
        description: "Protect and enhance concrete surfaces after cleaning.",
        basePriceHint: "$300–$800"
      }
    ],
    featureToggles: [
      {
        id: "commercial_flatwork",
        label: "Commercial Flatwork & Lots",
        description: "Enable large-lot scheduling and off-hours appointment logic.",
        enabledByDefault: false
      }
    ],
    aiPersona: {
      internalName: "pressure_wash_pro",
      voiceStyle: "tech_forward",
      shortTagline: "Explains chemistry and methods in plain English, not jargon.",
      smsTone:
        "Straightforward and quick, confirms water access and parking, checks weather and drying time.",
      emailTone:
        "Detailed, educational, good before/after explanations; focuses on protecting surfaces and preventing damage."
    }
  },

  // 5) WINDOW CLEANING
  {
    id: "window_cleaning",
    slug: "window-cleaning",
    label: "Window Cleaning",
    category: "Home Services",
    description: "Interior and exterior window cleaning for homes and light commercial.",
    exampleBusinessName: "CrystalView Window Cleaning",
    imageUrl: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&h=450&fit=crop",
    imageAlt: "Professional window cleaner working on glass windows",
    defaultPrimaryServices: [
      {
        id: "residential_windows",
        label: "Residential Windows (In & Out)",
        description: "Exterior and interior glass cleaning for the main home.",
        basePriceHint: "$150–$400",
        defaultDurationMinutes: 150
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_screens_tracks",
        label: "Screens & Tracks Detailing",
        description: "Clean window screens and tracks for smoother operation.",
        basePriceHint: "+$60–$150"
      }
    ],
    featureToggles: [
      {
        id: "commercial_storefront",
        label: "Commercial Storefront Routes",
        description: "Enable recurring storefront route logic and recurring invoicing.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "window_cleaning_route_pro",
      voiceStyle: "friendly_local",
      shortTagline: "Route-based pro who talks about sparkle, schedule, and views.",
      smsTone:
        "Short, efficient, confirms floor count, access, and interior vs exterior needs.",
      emailTone:
        "Clear and visual, uses simple language to explain what’s included and how often to schedule."
    }
  },

  // 6) MOBILE PET GROOMING
  {
    id: "mobile_pet_grooming",
    slug: "mobile-pet-grooming",
    label: "Mobile Pet Grooming",
    category: "Pets",
    description: "In-van grooming with baths, haircuts, deshedding, and spa add-ons.",
    exampleBusinessName: "Paws & Wheels Mobile Grooming",
    imageUrl: "https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=800&h=450&fit=crop",
    imageAlt: "Dog being groomed at professional grooming station",
    defaultPrimaryServices: [
      {
        id: "full_groom",
        label: "Full Groom",
        description: "Bath, haircut, nails, ears, and basic tidy.",
        basePriceHint: "$75–$150+",
        defaultDurationMinutes: 90
      },
      {
        id: "bath_only",
        label: "Bath & Tidy",
        description: "Bath, blow-dry, nails, brush, and light trim.",
        basePriceHint: "$60–$120",
        defaultDurationMinutes: 60
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_deshed",
        label: "Deshedding Treatment",
        description: "Extra brushing and tools for heavy shedders.",
        basePriceHint: "+$30–$60"
      },
      {
        id: "upsell_teeth",
        label: "Teeth & Breath Care",
        description: "Add-on dental hygiene treatment.",
        basePriceHint: "+$15–$35"
      }
    ],
    featureToggles: [
      {
        id: "multi_pet",
        label: "Multi-Pet Households",
        description: "Optimize routes and pricing for multiple pets at one stop.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "pet_grooming_soft",
      voiceStyle: "friendly_local",
      shortTagline: "Soft, pet-loving voice that reassures anxious pet parents.",
      smsTone:
        "Warm and kind, double-checks breed, coat condition, temperament, and any health notes.",
      emailTone:
        "Gentle, detailed overview of process, what to expect, and how often to groom."
    }
  },

  // 7) HVAC
  {
    id: "hvac",
    slug: "hvac",
    label: "HVAC Service & Install",
    category: "Trades",
    description:
      "Heating and cooling diagnostics, repairs, installs, and seasonal tune-ups.",
    exampleBusinessName: "ComfortZone Heating & Air",
    imageUrl: "https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=800&h=450&fit=crop",
    imageAlt: "HVAC technician servicing air conditioning unit",
    defaultPrimaryServices: [
      {
        id: "diagnostic",
        label: "Diagnostic Service Call",
        description: "Inspect and diagnose heating or cooling issues.",
        basePriceHint: "$89–$149",
        defaultDurationMinutes: 60
      },
      {
        id: "tune_up",
        label: "Seasonal Tune-Up",
        description: "Preventative maintenance tune-up for AC or furnace.",
        basePriceHint: "$89–$189",
        defaultDurationMinutes: 90
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_membership",
        label: "Membership / Maintenance Plan",
        description: "Priority scheduling and discounted tune-ups.",
        basePriceHint: "$15–$35/month"
      }
    ],
    featureToggles: [
      {
        id: "24_7_emergency",
        label: "24/7 Emergency Service",
        description: "Special routing and messaging for urgent after-hours calls.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "hvac_tech_forward",
      voiceStyle: "tech_forward",
      shortTagline: "Explains systems and options clearly without scare tactics.",
      smsTone:
        "Prompt, calm, asks key questions about symptoms, age of system, and filters.",
      emailTone:
        "Clear, option-based quotes that explain pros/cons of repair vs replace."
    }
  },

  // 8) PLUMBING
  {
    id: "plumbing",
    slug: "plumbing",
    label: "Plumbing Service",
    category: "Trades",
    description: "Residential and light commercial plumbing service and repairs.",
    exampleBusinessName: "FlowRight Plumbing Co.",
    imageUrl: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&h=450&fit=crop",
    imageAlt: "Professional plumber working on pipes",
    defaultPrimaryServices: [
      {
        id: "service_call",
        label: "Service Call / Repair",
        description: "General plumbing diagnostic and repair appointment.",
        basePriceHint: "$120–$300+",
        defaultDurationMinutes: 90
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_maintenance",
        label: "Whole-Home Plumbing Checkup",
        description: "Inspection of main fixtures, shutoffs, and accessible lines.",
        basePriceHint: "$250–$450"
      }
    ],
    featureToggles: [
      {
        id: "emergency_flood",
        label: "Emergency Leak & Flood Response",
        description: "High-priority routing and messaging for burst pipes and leaks.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "plumbing_steady",
      voiceStyle: "friendly_local",
      shortTagline: "Steady, no-drama voice that calms people in stressful situations.",
      smsTone:
        "Direct, checks for active leaks, shutoff knowledge, and urgency level.",
      emailTone:
        "Simple and reassuring, explains scope and what to expect on arrival."
    }
  },

  // 9) ELECTRICAL
  {
    id: "electrical",
    slug: "electrical",
    label: "Electrical Contractor",
    category: "Trades",
    description: "Residential and small commercial electrical service and installs.",
    exampleBusinessName: "BrightSpark Electric",
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=450&fit=crop",
    imageAlt: "Electrician working on electrical panel",
    defaultPrimaryServices: [
      {
        id: "service_call",
        label: "Electrical Service Call",
        description: "Troubleshoot outlets, switches, breakers, or lighting.",
        basePriceHint: "$150–$350",
        defaultDurationMinutes: 90
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_panel",
        label: "Panel Upgrade / Replacement",
        description: "Upgrade old panels to modern capacity and safety.",
        basePriceHint: "$1,800–$3,500",
        isPremium: true
      }
    ],
    featureToggles: [
      {
        id: "ev_chargers",
        label: "EV Charger Installs",
        description: "Focus on EV charger installs and education.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "electrical_safety_first",
      voiceStyle: "tech_forward",
      shortTagline: "Safety-first electrician, explains code and safety in normal language.",
      smsTone:
        "Careful and direct, avoids asking for unsafe DIY steps, focuses on simple triage questions.",
      emailTone:
        "Clear, safety-focused, puts code compliance and long-term reliability first."
    }
  },

  // 10) ROOFING & GUTTERS
  {
    id: "roofing_gutters",
    slug: "roofing",
    label: "Roofing & Gutters",
    category: "Trades",
    description:
      "Roof inspections, replacements, repairs, and gutter cleaning/installs.",
    exampleBusinessName: "HighPeak Roofing & Gutters",
    imageUrl: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&h=450&fit=crop",
    imageAlt: "Roofer installing shingles on residential roof",
    defaultPrimaryServices: [
      {
        id: "inspection",
        label: "Roof Inspection",
        description: "Photo-heavy inspection with basic report.",
        basePriceHint: "Often free / or $99–$199",
        defaultDurationMinutes: 60
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_gutter_guard",
        label: "Gutter Guard Install",
        description: "Install guards to reduce clogs and maintenance.",
        basePriceHint: "$800–$2,500"
      }
    ],
    featureToggles: [
      {
        id: "insurance_work",
        label: "Insurance Claims & Storm Work",
        description: "Enable language for hail/storm claims and adjuster coordination.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "roofing_storm_pro",
      voiceStyle: "premium_concierge",
      shortTagline: "Reassuring expert during stressful roof or storm situations.",
      smsTone:
        "Kind and clear, checks for active leaks, tarps, and urgency; coordinates inspection times.",
      emailTone:
        "Detailed but simple, explains options and next steps with photos and timelines."
    }
  },

  // 11) HANDYMAN
  {
    id: "handyman",
    slug: "handyman",
    label: "Handyman & Small Projects",
    category: "Home Services",
    description:
      "Punch lists, minor repairs, mounting, small carpentry, and honey-do lists.",
    exampleBusinessName: "TaskSmith Home Repair",
    imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=450&fit=crop",
    imageAlt: "Handyman with tools working on home repairs",
    defaultPrimaryServices: [
      {
        id: "punch_list",
        label: "Punch List Visit",
        description: "Book a block of time for multiple small tasks.",
        basePriceHint: "$150–$400",
        defaultDurationMinutes: 120
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_membership",
        label: "Home Maintenance Membership",
        description: "Quarterly visits to knock out small tasks and maintenance.",
        basePriceHint: "$49–$99/month"
      }
    ],
    featureToggles: [
      {
        id: "materials_sourcing",
        label: "Materials Sourcing Included",
        description: "Enable workflows where tech buys materials and passes through cost.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "handyman_friendly",
      voiceStyle: "friendly_local",
      shortTagline: "Friendly fixer who makes punch lists feel easy, not overwhelming.",
      smsTone:
        "Conversational, asks for photos or videos, groups tasks to estimate time and cost.",
      emailTone:
        "List-based and clear, lays out what will be done and what’s out of scope."
    }
  },

  // 12) POOL & SPA
  {
    id: "pool_spa_service",
    slug: "pool-service",
    label: "Pool & Spa Service",
    category: "Home Services",
    description:
      "Weekly pool service, cleanings, openings/closings, and minor repairs.",
    exampleBusinessName: "BlueWave Pool Service",
    imageUrl: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&h=450&fit=crop",
    imageAlt: "Clean swimming pool with maintenance equipment",
    defaultPrimaryServices: [
      {
        id: "weekly_service",
        label: "Weekly Pool Service",
        description: "Chemicals, brushing, skimming, equipment check.",
        basePriceHint: "$120–$250/month",
        defaultDurationMinutes: 45
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_open_close",
        label: "Pool Opening / Closing",
        description: "Seasonal open and winterize packages.",
        basePriceHint: "$250–$600"
      }
    ],
    featureToggles: [
      {
        id: "chem_delivery",
        label: "Chemical Delivery & Drop-Off",
        description: "Offer chemical-only deliveries and simple instructions.",
        enabledByDefault: false
      }
    ],
    aiPersona: {
      internalName: "pool_chem_guru",
      voiceStyle: "tech_forward",
      shortTagline: "Chill but nerdy about water chemistry, in simple language.",
      smsTone:
        "Short and relaxed, confirms pool type, equipment, and any known issues.",
      emailTone:
        "Educational and visual, uses simple charts/phrasing around clarity, safety, and maintenance."
    }
  },

  // 13) PEST CONTROL
  {
    id: "pest_control",
    slug: "pest-control",
    label: "Pest Control",
    category: "Home Services",
    description:
      "General pest, termite, rodent, and specialty treatments with recurring plans.",
    exampleBusinessName: "ShieldGuard Pest Solutions",
    imageUrl: "https://images.unsplash.com/photo-1563207153-f403bf289096?w=800&h=450&fit=crop",
    imageAlt: "Pest control technician treating home exterior",
    defaultPrimaryServices: [
      {
        id: "initial_treatment",
        label: "Initial Pest Treatment",
        description: "First-time treatment inside and outside.",
        basePriceHint: "$150–$300",
        defaultDurationMinutes: 120
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_recurring",
        label: "Quarterly Pest Plan",
        description: "Quarterly or bi-monthly maintenance visits.",
        basePriceHint: "$40–$80/visit"
      }
    ],
    featureToggles: [
      {
        id: "wildlife",
        label: "Wildlife & Rodent",
        description: "Enable trapping and exclusion style services.",
        enabledByDefault: false
      }
    ],
    aiPersona: {
      internalName: "pest_control_steady",
      voiceStyle: "premium_concierge",
      shortTagline: "Reassuring and calm, especially when people are grossed out or scared.",
      smsTone:
        "Empathetic, asks just enough questions to route to the right treatment without being graphic.",
      emailTone:
        "Clean, non-alarming explanations of process, safety, and what to expect."
    }
  },

  // 14) CARPET & UPHOLSTERY CLEANING
  {
    id: "carpet_cleaning",
    slug: "carpet-cleaning",
    label: "Carpet & Upholstery Cleaning",
    category: "Home Services",
    description:
      "Steam cleaning, stain removal, upholstery, and odor treatment for homes and offices.",
    exampleBusinessName: "FreshStep Carpet & Upholstery",
    imageUrl: "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&h=450&fit=crop",
    imageAlt: "Professional carpet cleaning in progress",
    defaultPrimaryServices: [
      {
        id: "whole_home",
        label: "Whole-Home Carpet Cleaning",
        description: "Standard clean for main traffic areas and bedrooms.",
        basePriceHint: "$200–$450",
        defaultDurationMinutes: 180
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_protectant",
        label: "Carpet Protector",
        description: "Protectant applied after cleaning to resist stains.",
        basePriceHint: "+$75–$200"
      },
      {
        id: "upsell_pet_odor",
        label: "Pet Odor/Enzyme Treatment",
        description: "Specialty treatment for pet accidents and odor.",
        basePriceHint: "+$60–$200"
      }
    ],
    featureToggles: [
      {
        id: "commercial_office",
        label: "Commercial Office Accounts",
        description: "Enable after-hours booking and recurring floor maintenance.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "carpet_cleaning_local",
      voiceStyle: "friendly_local",
      shortTagline: "Relatable pro who explains drying times and furniture moves clearly.",
      smsTone:
        "Casual, confirms square footage or room count, stairs, and pet issues.",
      emailTone:
        "Straightforward, uses bullet lists for what’s included and what to prep."
    }
  },

  // 15) JUNK REMOVAL
  {
    id: "junk_removal",
    slug: "junk-removal",
    label: "Junk Removal & Hauling",
    category: "Home Services",
    description:
      "Single-item pick-ups, full load hauls, cleanouts, and light demo.",
    exampleBusinessName: "LoadOut Junk Removal",
    imageUrl: "https://images.unsplash.com/photo-1580121441575-41bcb5c6b47c?w=800&h=450&fit=crop",
    imageAlt: "Junk removal truck loading furniture and debris",
    defaultPrimaryServices: [
      {
        id: "single_item",
        label: "Single Item Pickup",
        description: "Sofa, mattress, or appliance pickup.",
        basePriceHint: "$75–$175",
        defaultDurationMinutes: 45
      },
      {
        id: "full_load",
        label: "Full Load Haul",
        description: "Truck or trailer load of mixed junk.",
        basePriceHint: "$250–$600",
        defaultDurationMinutes: 120
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_cleanout",
        label: "Garage / Estate Cleanout",
        description: "Larger cleanouts with multiple loads and sorting.",
        basePriceHint: "$500–$2,000+"
      }
    ],
    featureToggles: [
      {
        id: "donation_focus",
        label: "Donation & Recycling Focus",
        description: "Emphasize donation drop-offs and recycling in copy.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "junk_removal_no_judgment",
      voiceStyle: "friendly_local",
      shortTagline: "Zero-judgment, just-helpful voice for clutter and hoarding situations.",
      smsTone:
        "Warm and practical, suggests sending photos, clarifies access and heavy items.",
      emailTone:
        "Empathetic and simple, uses ranges and explains factors that affect pricing."
    }
  },

  // 16) MOBILE MECHANIC
  {
    id: "mobile_mechanic",
    slug: "mobile-mechanic",
    label: "Mobile Mechanic",
    category: "Automotive",
    description:
      "On-site diagnostics, repairs, maintenance, and inspections for vehicles.",
    exampleBusinessName: "Driveway Mobile Auto Repair",
    imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=450&fit=crop",
    imageAlt: "Mobile mechanic working on car engine",
    defaultPrimaryServices: [
      {
        id: "diag",
        label: "Diagnostic Visit",
        description: "On-site diagnostic with basic code scan and inspection.",
        basePriceHint: "$120–$250",
        defaultDurationMinutes: 90
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_maintenance",
        label: "Mobile Maintenance Package",
        description: "Oil change, filters, and inspection in one visit.",
        basePriceHint: "$200–$350"
      }
    ],
    featureToggles: [
      {
        id: "fleet_service",
        label: "Fleet & Commercial Vehicles",
        description: "Enable routing and billing for multiple vehicles and fleets.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "mobile_mechanic_route",
      voiceStyle: "friendly_local",
      shortTagline: "Mechanic who speaks like a real tech, but explains clearly.",
      smsTone:
        "Direct and friendly, asks for year/make/model, symptoms, and location.",
      emailTone:
        "Simple, clear breakdowns of recommended work with priority levels."
    }
  },

  // 17) TUTORING & COACHING
  {
    id: "tutoring_coaching",
    slug: "tutoring",
    label: "Tutoring & Coaching",
    category: "Professional Services",
    description:
      "Academic tutoring, test prep, and skills coaching (online or in-person).",
    exampleBusinessName: "BrightPath Tutoring & Coaching",
    imageUrl: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&h=450&fit=crop",
    imageAlt: "Tutor teaching student at desk with books",
    defaultPrimaryServices: [
      {
        id: "session_standard",
        label: "Standard Session",
        description: "One-on-one tutoring or coaching session.",
        basePriceHint: "$60–$150/hr",
        defaultDurationMinutes: 60
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_package",
        label: "Multi-Session Package",
        description: "Pack of sessions with a small discount.",
        basePriceHint: "4–10 sessions, discounted"
      }
    ],
    featureToggles: [
      {
        id: "online_only",
        label: "Online-Only Mode",
        description: "Shift the flow to assume video calls and no travel.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "tutor_supportive",
      voiceStyle: "premium_concierge",
      shortTagline: "Supportive, structured, and very clear about expectations and progress.",
      smsTone:
        "Encouraging, confirms subject, level, goals, and time zone.",
      emailTone:
        "Organized and reassuring, outlines plan, schedule, and progress updates."
    }
  },

  // 18) BEAUTY / BARBER / SALON
  {
    id: "beauty_salon_barber",
    slug: "beauty-salon",
    label: "Beauty, Salon & Barber",
    category: "Personal Care",
    description:
      "Hair, barbering, brows, lashes, and simple esthetician-style services.",
    exampleBusinessName: "Studio 47 Salon & Grooming",
    imageUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=450&fit=crop",
    imageAlt: "Barber cutting hair in modern barbershop",
    defaultPrimaryServices: [
      {
        id: "haircut_basic",
        label: "Haircut / Style",
        description: "Standard cut or trim with style.",
        basePriceHint: "$35–$120",
        defaultDurationMinutes: 60
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_color",
        label: "Color / Highlights",
        description: "Color, balayage, or highlight add-ons.",
        basePriceHint: "$120–$300+",
        isPremium: true
      }
    ],
    featureToggles: [
      {
        id: "membership_bundles",
        label: "Memberships & Bundles",
        description: "Enable bundles like monthly cuts, blowout memberships, etc.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "beauty_salon_vibe",
      voiceStyle: "friendly_local",
      shortTagline: "Warm, stylish voice that feels like texting with your stylist.",
      smsTone:
        "Friendly and personable, confirms hair type, goals, and inspiration photos.",
      emailTone:
        "On-brand and aesthetic, explains booking policies and prep instructions."
    }
  },

  // 19) SHORT-TERM RENTAL TURNOVERS
  {
    id: "str_turnovers",
    slug: "airbnb-turnovers",
    label: "Short-Term Rental Turnovers",
    category: "Hospitality",
    description:
      "Airbnb/VRBO turnovers, restocking, laundry, and light staging.",
    exampleBusinessName: "TurnKey STR Services",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=450&fit=crop",
    imageAlt: "Clean modern Airbnb apartment ready for guests",
    defaultPrimaryServices: [
      {
        id: "standard_turnover",
        label: "Standard Turnover",
        description: "Clean, reset, restock essentials, and quick inspection.",
        basePriceHint: "$80–$250+",
        defaultDurationMinutes: 120
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_deep_reset",
        label: "Deep Reset",
        description: "Occasional deep clean plus linen refresh and minor touch-ups.",
        basePriceHint: "$250–$500"
      }
    ],
    featureToggles: [
      {
        id: "multi_property",
        label: "Multi-Property Owners & Hosts",
        description: "Enable dashboards and messaging for multiple properties per client.",
        enabledByDefault: true
      }
    ],
    aiPersona: {
      internalName: "str_host_helper",
      voiceStyle: "tech_forward",
      shortTagline: "Host-side assistant that speaks in results, not fluff.",
      smsTone:
        "Fast, concise, understands calendars and check-in/check-out times.",
      emailTone:
        "Operational and structured, uses bullet lists and emphasizes reliability."
    }
  },

  // 20) PHOTOGRAPHY MEGA PACK (PORTRAITS + EVENTS + WEDDINGS + REAL ESTATE)
  {
    id: "photography_full",
    slug: "photography",
    label: "Photography & Media Studio",
    category: "Creative",
    description:
      "Portraits, events, weddings, branding, and real estate photography under one roof. Everything is togglable so a single studio can turn niches on/off instead of needing separate sites.",
    exampleBusinessName: "Lightcraft Photo & Media",
    imageUrl: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&h=450&fit=crop",
    imageAlt: "Photographer capturing wedding moment with professional camera",
    defaultPrimaryServices: [
      {
        id: "portraits_standard",
        label: "Portrait Session",
        description:
          "Standard portrait session for individuals, couples, or small families, on location or in-studio.",
        basePriceHint: "$250–$600",
        defaultDurationMinutes: 60
      },
      {
        id: "event_coverage",
        label: "Event Coverage",
        description:
          "Hourly event coverage for parties, corporate events, and small gatherings.",
        basePriceHint: "$250–$450/hr",
        defaultDurationMinutes: 120
      },
      {
        id: "wedding_collection",
        label: "Wedding Collection",
        description:
          "Curated wedding package with pre-wedding consult, ceremony + reception coverage, and edited gallery.",
        basePriceHint: "$2,000–$5,500",
        defaultDurationMinutes: 480,
        isPremium: true
      },
      {
        id: "real_estate_package",
        label: "Real Estate Photo Package",
        description:
          "Listing photos for residential real estate; includes interior, exterior, and detail shots.",
        basePriceHint: "$200–$450",
        defaultDurationMinutes: 90
      }
    ],
    defaultUpsellServices: [
      {
        id: "upsell_albums",
        label: "Albums & Prints",
        description:
          "Designed albums, framed prints, and wall art options.",
        basePriceHint: "Varies by product; offer starting ranges."
      },
      {
        id: "upsell_video",
        label: "Highlight Video / Reels",
        description:
          "Short highlight film or social-media-ready vertical clips.",
        basePriceHint: "$600–$2,000+"
      },
      {
        id: "upsell_branding",
        label: "Branding & Headshot Day",
        description:
          "Half-day or full-day branding session for individuals or teams.",
        basePriceHint: "$800–$2,500"
      },
      {
        id: "upsell_re_3d_drone",
        label: "Real Estate Drone / 3D Tour",
        description:
          "Aerial exterior shots and/or 3D walkthrough for listings.",
        basePriceHint: "+$150–$500"
      }
    ],
    featureToggles: [
      {
        id: "ft_portraits",
        label: "Portraits & Families",
        description:
          "Toggle to emphasize portraits, couples, seniors, and family sessions in the flows and templates.",
        enabledByDefault: true
      },
      {
        id: "ft_weddings",
        label: "Weddings & Elopements",
        description:
          "Turns on wedding-specific funnels, questionnaires, and longer timelines.",
        enabledByDefault: true
      },
      {
        id: "ft_events",
        label: "Events & Corporate",
        description:
          "Enables corporate events, conferences, and party coverage flows.",
        enabledByDefault: true
      },
      {
        id: "ft_real_estate",
        label: "Real Estate Photo & Media",
        description:
          "Turns on real-estate-style quoting (square footage, MLS timelines, add-on media).",
        enabledByDefault: true
      },
      {
        id: "ft_branding",
        label: "Branding, Headshots & Content Days",
        description:
          "Focuses on business/branding clients, content days, and retainer-style work.",
        enabledByDefault: true
      },
      {
        id: "ft_mini_sessions",
        label: "Mini Sessions",
        description:
          "Enables mini-session signup pages, stacked time slots, and batch scheduling.",
        enabledByDefault: false
      },
      {
        id: "ft_retainers",
        label: "Retainer / Subscription Clients",
        description:
          "Turns on recurring content plans with monthly or quarterly shoots.",
        enabledByDefault: false
      }
    ],
    aiPersona: {
      internalName: "photography_ultra_premium",
      voiceStyle: "premium_concierge",
      shortTagline:
        "Ultra-premium but human studio voice – clear, kind, and confident, not cheesy or salesy.",
      smsTone:
        "Warm, efficient, and on-brand. Asks smart discovery questions (date, location, vibe, guest count, usage) without overwhelming people.",
      emailTone:
        "High-end, cinematic but grounded. Uses clear packages, timelines, and expectations. Speaks to value, experience, and story, not just ‘cheap photos’."
    }
  }
];
