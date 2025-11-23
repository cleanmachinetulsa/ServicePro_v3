/**
 * Default AI behavior rules, SMS templates, and FAQ entries for each industry.
 * This file is used by the industry bootstrap service to populate new tenants.
 */

import type { AIBehaviorRuleTemplate, SmsTemplateConfig, FaqEntryTemplate } from './industryPacks';

export const AUTO_DETAILING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a mobile auto detailing business. Answer with a friendly, professional, and knowledgeable tone. Always use proper grammar and complete sentences. Focus on auto detailing topics, services, and scheduling. For off-topic inquiries, politely redirect back to auto detailing services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on auto detailing",
    content: "If customer asks about topics unrelated to auto detailing (politics, medical advice, etc.), politely acknowledge and redirect: 'I'm here to help with auto detailing services. How can I assist you with your vehicle today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "When appropriate, suggest relevant add-ons: pet hair removal for customers mentioning pets, ceramic coating for those asking about protection, odor treatment for smoke/pet odors. Frame as helpful recommendations, not pushy sales.",
    priority: 20,
    enabled: true
  }
];

export const AUTO_DETAILING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer books appointment",
    body: "Thanks {firstName}! Your {serviceName} appointment is confirmed for {date} at {time}. We'll send you a reminder 24 hours before.\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "John", required: true },
      { name: "serviceName", description: "Service booked", sample: "Full Detail", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 15", required: true },
      { name: "time", description: "Appointment time", sample: "2:00 PM", required: true }
    ],
    defaultPayload: { firstName: "John", serviceName: "Full Detail", date: "Dec 15", time: "2:00 PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Technician On-Site",
    description: "Sent when technician arrives",
    body: "Hey {firstName}! 👋 Your technician has arrived and will be with you shortly. Get ready for that showroom shine! ✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Sarah", required: true }
    ],
    defaultPayload: { firstName: "Sarah" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Appointment Reminder",
    description: "Sent 24 hours before scheduled appointment",
    body: "Hi {firstName}! This is a reminder that your {serviceName} appointment is tomorrow at {time}. Looking forward to making your vehicle shine! ✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Mike", required: true },
      { name: "serviceName", description: "Service booked", sample: "Interior Detail", required: true },
      { name: "time", description: "Appointment time", sample: "10:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Mike", serviceName: "Interior Detail", time: "10:00 AM" },
    enabled: true
  }
];

export const AUTO_DETAILING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What's included in a full detail?",
    answer: "A full detail includes complete interior vacuuming and cleaning, exterior hand wash and wax, tire shine, window cleaning inside and out, and dashboard treatment. Takes approximately 3-4 hours.",
    keywords: ["full detail", "services", "what's included", "package"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does a basic detail cost?",
    answer: "Our basic detail packages start at $150-$250 depending on vehicle size and condition. Final pricing is determined after inspecting your vehicle. We offer free quotes!",
    keywords: ["price", "cost", "how much", "pricing"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "What's your cancellation policy?",
    answer: "We require 24 hours notice for cancellations. Cancellations with less than 24 hours notice may be subject to a fee. Same-day cancellations are charged 50% of service cost.",
    keywords: ["cancel", "cancellation", "reschedule", "policy"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you come to my location?",
    answer: "Yes! We're a mobile auto detailing service. We come to your home, office, or any location within our service area. All we need is access to water and electricity.",
    keywords: ["mobile", "location", "come to me", "where"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// HOUSE CLEANING
// ===================================
export const HOUSE_CLEANING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a professional house cleaning service. Be warm, friendly, and professional. Focus on helping customers understand cleaning packages, scheduling appointments, and answering questions about what's included. Always emphasize quality, trustworthiness, and attention to detail.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on cleaning services",
    content: "If customer asks about topics unrelated to house cleaning (politics, health advice, etc.), politely acknowledge and redirect: 'I'm here to help with your cleaning needs. What type of cleaning service are you interested in?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "Suggest deep cleaning for first-time customers or homes that haven't been cleaned in a while. Recommend move-in/move-out cleaning for relocations. Offer add-ons like inside fridge, oven cleaning, or window washing when appropriate. Always frame as helpful suggestions.",
    priority: 20,
    enabled: true
  }
];

export const HOUSE_CLEANING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer books appointment",
    body: "Hi {firstName}! Your {serviceName} is confirmed for {date} at {time}. Our team will arrive with all supplies needed. Looking forward to making your home sparkle! ✨\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Sarah", required: true },
      { name: "serviceName", description: "Service booked", sample: "Standard Cleaning", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 15", required: true },
      { name: "time", description: "Appointment time", sample: "9:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Sarah", serviceName: "Standard Cleaning", date: "Dec 15", time: "9:00 AM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Team On-Site",
    description: "Sent when cleaning team arrives",
    body: "Hi {firstName}! Our cleaning team has arrived and is getting started. We'll have your home looking fresh and clean soon! 🏡✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Jessica", required: true }
    ],
    defaultPayload: { firstName: "Jessica" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Appointment Reminder",
    description: "Sent 24 hours before scheduled appointment",
    body: "Hi {firstName}! Reminder that your {serviceName} is tomorrow at {time}. Please ensure we have access to your home and any specific areas you'd like us to focus on. See you tomorrow!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Michael", required: true },
      { name: "serviceName", description: "Service booked", sample: "Deep Cleaning", required: true },
      { name: "time", description: "Appointment time", sample: "10:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Michael", serviceName: "Deep Cleaning", time: "10:00 AM" },
    enabled: true
  }
];

export const HOUSE_CLEANING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What's included in a standard cleaning?",
    answer: "Our standard cleaning includes dusting all surfaces, vacuuming and mopping floors, cleaning bathrooms (toilets, sinks, showers), kitchen cleaning (counters, sinks, outside of appliances), and making beds. Takes approximately 2-3 hours depending on home size.",
    keywords: ["standard", "included", "what's covered", "basic cleaning"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "services",
    question: "Do you bring your own supplies?",
    answer: "Yes! We bring all cleaning supplies and equipment. If you have specific products you'd like us to use (eco-friendly, hypoallergenic, etc.), just let us know and we're happy to use yours.",
    keywords: ["supplies", "products", "equipment", "bring"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do I need to be home during the cleaning?",
    answer: "No, you don't need to be home. Many customers provide us with a key, garage code, or lockbox access. We're fully insured and background-checked for your peace of mind.",
    keywords: ["home", "present", "key", "access"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does a deep cleaning cost?",
    answer: "Deep cleaning typically costs $250-$450 depending on home size and condition. This includes all standard cleaning plus baseboards, inside cabinets, inside fridge/oven, and detailed work in all areas. We offer free quotes!",
    keywords: ["price", "cost", "deep cleaning", "how much"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// LAWN CARE & LANDSCAPING
// ===================================
export const LAWN_CARE_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a professional lawn care and landscaping service. Be helpful, knowledgeable about grass types, seasonal care, and maintenance schedules. Focus on helping customers understand service options, scheduling recurring visits, and maintaining healthy, beautiful lawns.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on lawn care",
    content: "If customer asks about topics unrelated to lawn care and landscaping, politely acknowledge and redirect: 'I'm here to help with your lawn care needs. How can I assist you with your yard today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "Suggest fertilization programs for customers wanting greener grass, weed control for problem areas, and aeration in spring/fall. Recommend edging and trimming for a polished look. Frame seasonal services (like leaf removal or spring cleanup) when appropriate.",
    priority: 20,
    enabled: true
  }
];

export const LAWN_CARE_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer books service",
    body: "Thanks {firstName}! Your {serviceName} is scheduled for {date}. We'll arrive between {time} and take care of everything. Get ready for a beautiful lawn! 🌱\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Tom", required: true },
      { name: "serviceName", description: "Service booked", sample: "Weekly Mowing", required: true },
      { name: "date", description: "Service date", sample: "Thursday", required: true },
      { name: "time", description: "Arrival window", sample: "9AM-12PM", required: true }
    ],
    defaultPayload: { firstName: "Tom", serviceName: "Weekly Mowing", date: "Thursday", time: "9AM-12PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Crew On-Site",
    description: "Sent when crew arrives",
    body: "Hey {firstName}! Our crew has arrived and is getting started on your lawn. We'll have it looking great soon! 🌿",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "David", required: true }
    ],
    defaultPayload: { firstName: "David" },
    enabled: true
  },
  {
    templateKey: "weather_reschedule",
    category: "booking",
    name: "Weather Reschedule Notice",
    description: "Sent when weather forces reschedule",
    body: "Hi {firstName}, due to rain/wet conditions, we're rescheduling your {serviceName} to {newDate}. This ensures we don't damage your lawn. Thanks for your understanding! 🌧️",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Lisa", required: true },
      { name: "serviceName", description: "Service type", sample: "mowing", required: true },
      { name: "newDate", description: "Rescheduled date", sample: "Friday", required: true }
    ],
    defaultPayload: { firstName: "Lisa", serviceName: "mowing", newDate: "Friday" },
    enabled: true
  }
];

export const LAWN_CARE_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "How often should I mow my lawn?",
    answer: "Most lawns benefit from weekly mowing during the growing season (spring/summer). In slower growth periods, bi-weekly may be sufficient. We offer flexible schedules based on your lawn's needs.",
    keywords: ["mowing", "frequency", "how often", "schedule"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "services",
    question: "Do you haul away clippings?",
    answer: "We typically mulch clippings back into your lawn (great for lawn health!). If you prefer clippings bagged and removed, we can do that for an additional fee. Just let us know your preference.",
    keywords: ["clippings", "haul away", "bag", "grass"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "pricing",
    question: "What does weekly lawn service cost?",
    answer: "Weekly mowing typically costs $30-$60 per visit depending on lawn size. We offer discounts for recurring service contracts. Contact us for a free quote based on your property!",
    keywords: ["price", "cost", "weekly", "how much"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you offer fertilization programs?",
    answer: "Yes! We offer seasonal fertilization programs (typically 4-6 applications per year) customized to your grass type and climate. Includes weed control and pest prevention.",
    keywords: ["fertilization", "fertilizer", "weed control", "program"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// PHOTOGRAPHY
// ===================================
export const PHOTOGRAPHY_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a professional photography service. Be creative, enthusiastic, and helpful. Focus on understanding the type of shoot needed, explaining packages, discussing editing timelines, and scheduling sessions. Emphasize capturing special moments and delivering beautiful, high-quality photos.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on photography",
    content: "If customer asks about topics unrelated to photography services, politely acknowledge and redirect: 'I'm here to help with your photography needs. What type of photo session are you interested in?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "Suggest engagement sessions before weddings, family photos during holidays, or professional headshots for career updates. Mention albums, prints, or additional edited photos when customers show interest. Always frame as ways to preserve and share their memories.",
    priority: 20,
    enabled: true
  }
];

export const PHOTOGRAPHY_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Session Confirmation",
    description: "Sent when photo session is booked",
    body: "Excited to work with you, {firstName}! Your {serviceName} is confirmed for {date} at {time} at {location}. Can't wait to capture some amazing photos! 📸✨\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Emma", required: true },
      { name: "serviceName", description: "Session type", sample: "Family Portrait Session", required: true },
      { name: "date", description: "Session date", sample: "Dec 20", required: true },
      { name: "time", description: "Session time", sample: "4:00 PM", required: true },
      { name: "location", description: "Shoot location", sample: "Central Park", required: true }
    ],
    defaultPayload: { firstName: "Emma", serviceName: "Family Portrait Session", date: "Dec 20", time: "4:00 PM", location: "Central Park" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "Session Reminder",
    description: "Sent 24 hours before session",
    body: "Hi {firstName}! Reminder: your photo session is tomorrow at {time}. Wear comfortable clothes in coordinating colors. Check the weather and bring layers if needed. See you soon! 📷",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Rachel", required: true },
      { name: "time", description: "Session time", sample: "5:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Rachel", time: "5:00 PM" },
    enabled: true
  },
  {
    templateKey: "photos_ready",
    category: "delivery",
    name: "Photos Ready Notification",
    description: "Sent when edited photos are ready",
    body: "Great news, {firstName}! Your photos are ready to view and download. Check your email for the gallery link. Can't wait for you to see them! 🎉📸",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Ashley", required: true }
    ],
    defaultPayload: { firstName: "Ashley" },
    enabled: true
  }
];

export const PHOTOGRAPHY_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "How many edited photos do I get?",
    answer: "Package details vary, but typically you'll receive 30-50 fully edited photos from a 1-hour portrait session, 75-100 photos from a 2-hour family session, and 400-600 photos from a full wedding day. All packages include high-resolution digital downloads.",
    keywords: ["photos", "how many", "edited", "receive"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "Do you require a deposit?",
    answer: "Yes, we require a 25-50% non-refundable deposit to secure your session date. The remaining balance is due on the day of the shoot or before photo delivery. We accept all major payment methods.",
    keywords: ["deposit", "payment", "retainer", "booking fee"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "services",
    question: "How long until I receive my photos?",
    answer: "You'll receive a sneak peek within 48 hours! Full gallery delivery is typically 2-3 weeks for portrait sessions and 4-6 weeks for weddings. Rush editing is available for an additional fee.",
    keywords: ["timeline", "delivery", "how long", "when"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "policies",
    question: "What if it rains on my outdoor session day?",
    answer: "We monitor weather closely and will reschedule if conditions aren't ideal. We want your photos to be beautiful! There's no fee to reschedule due to weather. We can also discuss backup indoor locations.",
    keywords: ["rain", "weather", "reschedule", "outdoor"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// HAIR STYLIST / BARBER
// ===================================
export const HAIR_STYLIST_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a professional hair salon/barbershop. Be friendly, stylish, and helpful. Focus on understanding what service customers need (cut, color, styling), scheduling appointments, and explaining pricing. Emphasize the expertise of stylists and creating a great experience.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on hair services",
    content: "If customer asks about topics unrelated to hair services, politely acknowledge and redirect: 'I'm here to help with your hair care needs. What type of service are you interested in booking?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "Suggest deep conditioning treatments for damaged hair, toner for blonde clients, or styling services for special events. Mention retail products that help maintain their look at home. Always be helpful, not pushy.",
    priority: 20,
    enabled: true
  }
];

export const HAIR_STYLIST_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Appointment Confirmation",
    description: "Sent when appointment is booked",
    body: "Hey {firstName}! Your {serviceName} with {stylistName} is confirmed for {date} at {time}. See you soon! 💇✨\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Taylor", required: true },
      { name: "serviceName", description: "Service booked", sample: "Cut & Color", required: true },
      { name: "stylistName", description: "Stylist name", sample: "Jordan", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 18", required: true },
      { name: "time", description: "Appointment time", sample: "2:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Taylor", serviceName: "Cut & Color", stylistName: "Jordan", date: "Dec 18", time: "2:00 PM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Hi {firstName}! Reminder: you have an appointment with {stylistName} tomorrow at {time}. Please arrive with clean, dry hair. Can't wait to see you! 💇",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Jordan", required: true },
      { name: "stylistName", description: "Stylist name", sample: "Alex", required: true },
      { name: "time", description: "Appointment time", sample: "1:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Jordan", stylistName: "Alex", time: "1:00 PM" },
    enabled: true
  },
  {
    templateKey: "cancellation_policy",
    category: "policies",
    name: "Cancellation Policy Reminder",
    description: "Sent with confirmation for new clients",
    body: "Quick reminder: We require 24-hour notice for cancellations or reschedules. Late cancellations may be subject to a fee. Thanks for understanding! 💙",
    variables: [],
    defaultPayload: {},
    enabled: true
  }
];

export const HAIR_STYLIST_FAQ: FaqEntryTemplate[] = [
  {
    category: "policies",
    question: "Do you take walk-ins?",
    answer: "We accept walk-ins when available, but we highly recommend booking an appointment to guarantee your preferred time and stylist. You can book online or call us directly.",
    keywords: ["walk-in", "appointment", "booking", "schedule"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "policies",
    question: "What is your cancellation policy?",
    answer: "We require 24 hours notice for cancellations or rescheduling. Cancellations with less than 24 hours notice may be charged 50% of the service cost. We understand emergencies happen - just give us a call.",
    keywords: ["cancel", "cancellation", "reschedule", "policy"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "services",
    question: "How long is a typical appointment?",
    answer: "Haircuts typically take 30-45 minutes. Color services range from 2-4 hours depending on the complexity. When booking, we'll give you an estimated time based on your service.",
    keywords: ["duration", "how long", "time", "appointment length"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does a haircut cost?",
    answer: "Our haircuts range from $35-$65 depending on stylist level and hair length. Color services start at $85. We offer complimentary consultations to discuss your needs and provide accurate pricing.",
    keywords: ["price", "cost", "haircut", "how much"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// BOOTSTRAP MAP
// ===================================
export const INDUSTRY_BOOTSTRAP_MAP: Record<string, {
  aiRules: AIBehaviorRuleTemplate[];
  smsTemplates: SmsTemplateConfig[];
  faqEntries: FaqEntryTemplate[];
}> = {
  "auto_detailing_mobile": {
    aiRules: AUTO_DETAILING_AI_RULES,
    smsTemplates: AUTO_DETAILING_SMS_TEMPLATES,
    faqEntries: AUTO_DETAILING_FAQ
  },
  "house_cleaning": {
    aiRules: HOUSE_CLEANING_AI_RULES,
    smsTemplates: HOUSE_CLEANING_SMS_TEMPLATES,
    faqEntries: HOUSE_CLEANING_FAQ
  },
  "lawn_care_landscaping": {
    aiRules: LAWN_CARE_AI_RULES,
    smsTemplates: LAWN_CARE_SMS_TEMPLATES,
    faqEntries: LAWN_CARE_FAQ
  },
  "photography": {
    aiRules: PHOTOGRAPHY_AI_RULES,
    smsTemplates: PHOTOGRAPHY_SMS_TEMPLATES,
    faqEntries: PHOTOGRAPHY_FAQ
  },
  "hair_stylist_barber": {
    aiRules: HAIR_STYLIST_AI_RULES,
    smsTemplates: HAIR_STYLIST_SMS_TEMPLATES,
    faqEntries: HAIR_STYLIST_FAQ
  }
};
