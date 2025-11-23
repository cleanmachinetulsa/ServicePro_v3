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
// PRESSURE WASHING
// ===================================
export const PRESSURE_WASHING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a pressure washing and soft wash service. Answer with a straightforward, educational tone. Focus on explaining the difference between pressure washing and soft washing, surface safety, and proper cleaning methods. For off-topic inquiries, politely redirect to pressure washing services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on pressure washing",
    content: "If customer asks about topics unrelated to pressure washing or exterior cleaning, politely acknowledge and redirect: 'I'm here to help with pressure washing and exterior cleaning services. How can I assist with your property today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "When customers inquire about driveway cleaning, mention house washing and gutter cleaning. For house wash requests, suggest roof soft wash or deck restoration. For commercial properties, mention ongoing maintenance contracts. Always explain the benefits of bundling services.",
    priority: 20,
    enabled: true
  }
];

export const PRESSURE_WASHING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer books appointment",
    body: "Thanks {firstName}! Your {serviceName} is confirmed for {date} at {time}. We'll bring all equipment and handle water. Weather permitting!\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Tom", required: true },
      { name: "serviceName", description: "Service booked", sample: "Driveway Cleaning", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 20", required: true },
      { name: "time", description: "Appointment time", sample: "9:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Tom", serviceName: "Driveway Cleaning", date: "Dec 20", time: "9:00 AM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Hi {firstName}! Reminder: We'll be at your property tomorrow at {time} for {serviceName}. Please ensure water access is available. See you soon!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Lisa", required: true },
      { name: "serviceName", description: "Service name", sample: "House Wash", required: true },
      { name: "time", description: "Appointment time", sample: "8:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Lisa", serviceName: "House Wash", time: "8:00 AM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Technician On-Site",
    description: "Sent when crew arrives",
    body: "Hi {firstName}! Our crew has arrived and is setting up. Your property will look amazing when we're done! 💧✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Mark", required: true }
    ],
    defaultPayload: { firstName: "Mark" },
    enabled: true
  }
];

export const PRESSURE_WASHING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What's the difference between pressure washing and soft washing?",
    answer: "Pressure washing uses high-pressure water for hard surfaces like concrete driveways. Soft washing uses low pressure with specialized cleaning solutions for delicate surfaces like roofs, siding, and painted surfaces to prevent damage.",
    keywords: ["pressure", "soft wash", "difference", "methods"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does driveway cleaning cost?",
    answer: "Driveway cleaning typically ranges from $175-$400 depending on size, condition, and surface type. We provide free estimates after assessing your property.",
    keywords: ["price", "cost", "driveway", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do you provide the water?",
    answer: "We bring all equipment, but we'll need access to your outdoor water source (hose spigot). We use approximately 200-500 gallons depending on the job size.",
    keywords: ["water", "equipment", "supplies", "provide"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Can you damage my siding or roof?",
    answer: "Not when done correctly! We use soft washing for delicate surfaces, which is safe for vinyl siding, roofs, and painted surfaces. We're fully insured and trained in proper surface-specific techniques.",
    keywords: ["damage", "safe", "siding", "roof", "warranty"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// WINDOW CLEANING
// ===================================
export const WINDOW_CLEANING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a professional window cleaning service. Answer with a friendly, efficient tone. Focus on window cleaning, screen cleaning, and related services. For off-topic inquiries, politely redirect to window cleaning services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on window cleaning",
    content: "If customer asks about topics unrelated to window cleaning, politely acknowledge and redirect: 'I'm here to help with window cleaning services. How can I make your windows sparkle today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "When customers book exterior-only cleaning, suggest adding interior for a complete service. Mention screen cleaning and track detailing for maintenance customers. For commercial clients, offer recurring route-based service at discounted rates.",
    priority: 20,
    enabled: true
  }
];

export const WINDOW_CLEANING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer books appointment",
    body: "Hi {firstName}! Your window cleaning appointment is confirmed for {date} at {time}. Get ready for crystal-clear views! ✨\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Emily", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 22", required: true },
      { name: "time", description: "Appointment time", sample: "10:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Emily", date: "Dec 22", time: "10:00 AM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Hey {firstName}! Reminder: We'll be cleaning your windows tomorrow at {time}. Please move any plants or decorations away from windows if possible. Thanks!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Rachel", required: true },
      { name: "time", description: "Appointment time", sample: "11:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Rachel", time: "11:00 AM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Technician On-Site",
    description: "Sent when technician arrives",
    body: "Hi {firstName}! We've arrived and are ready to make your windows shine! We'll knock when finished. ✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "David", required: true }
    ],
    defaultPayload: { firstName: "David" },
    enabled: true
  }
];

export const WINDOW_CLEANING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "Do you clean inside and outside?",
    answer: "Yes! We offer interior-only, exterior-only, or full inside-and-out window cleaning. Most customers prefer the complete service for the best results and value.",
    keywords: ["inside", "outside", "interior", "exterior", "both"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does window cleaning cost?",
    answer: "Residential window cleaning typically ranges from $150-$400 depending on the number of windows, floors, and accessibility. We provide free quotes based on your specific property.",
    keywords: ["price", "cost", "how much", "pricing"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do I need to be home?",
    answer: "Not for exterior-only cleaning! For interior cleaning, someone 18+ needs to be home to provide access. We're fully insured and background-checked.",
    keywords: ["home", "access", "present", "there"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you clean screens and tracks?",
    answer: "Yes! Screen and track cleaning is available as an add-on service. It makes a huge difference in how smoothly your windows operate and keeps them cleaner longer.",
    keywords: ["screens", "tracks", "additional", "extras"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// MOBILE PET GROOMING
// ===================================
export const MOBILE_PET_GROOMING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a mobile pet grooming service. Answer with a warm, caring, pet-loving tone. Focus on grooming services, pet comfort, and health. For off-topic inquiries, politely redirect to pet grooming services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on pet grooming",
    content: "If customer asks about topics unrelated to pet grooming (veterinary advice, training, etc.), politely redirect: 'I'm here to help with grooming services! For health concerns, please consult your vet. How can I help make your pet look and feel great?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For heavy shedders, suggest deshedding treatments. For anxious pets, mention our calm, one-on-one mobile environment. For multi-pet households, offer bundled discounts. Recommend teeth cleaning or nail grinding for senior pets.",
    priority: 20,
    enabled: true
  }
];

export const MOBILE_PET_GROOMING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer books appointment",
    body: "Thanks {firstName}! {petName}'s grooming is confirmed for {date} at {time}. We'll come to you - no stressful car rides! 🐾\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Sarah", required: true },
      { name: "petName", description: "Pet's name", sample: "Max", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 23", required: true },
      { name: "time", description: "Appointment time", sample: "2:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Sarah", petName: "Max", date: "Dec 23", time: "2:00 PM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Hi {firstName}! {petName}'s spa day is tomorrow at {time}! Please have them available and let us know if there's anything special we should know about their temperament or health. 🐕💙",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Mike", required: true },
      { name: "petName", description: "Pet's name", sample: "Bella", required: true },
      { name: "time", description: "Appointment time", sample: "1:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Mike", petName: "Bella", time: "1:00 PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Groomer On-Site",
    description: "Sent when groomer arrives",
    body: "Hi {firstName}! We're here for {petName}'s appointment! We'll take great care of your furry friend. 🐾✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Jennifer", required: true },
      { name: "petName", description: "Pet's name", sample: "Charlie", required: true }
    ],
    defaultPayload: { firstName: "Jennifer", petName: "Charlie" },
    enabled: true
  }
];

export const MOBILE_PET_GROOMING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What's included in a full groom?",
    answer: "A full groom includes bath, haircut/trim to your specifications, nail trimming, ear cleaning, and blow dry. We'll make your pet look and feel their best!",
    keywords: ["full groom", "included", "services", "what do you do"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does grooming cost?",
    answer: "Pricing varies by breed, size, coat condition, and services needed. Full grooms typically range from $75-$150+. We'll provide an exact quote after learning about your pet!",
    keywords: ["price", "cost", "how much", "pricing"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "What if my pet is anxious or aggressive?",
    answer: "Our mobile one-on-one service is perfect for anxious pets! No kennel stress, no other animals around. We work patiently and use gentle techniques. For safety, aggressive pets may require muzzling or vet sedation.",
    keywords: ["anxious", "aggressive", "nervous", "behavior", "temperament"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you groom cats?",
    answer: "Yes! We groom cats and specialize in low-stress handling. Cat grooming includes bath, trim/shave, nail trim, and ear cleaning. Perfect for long-haired breeds or cats with matting.",
    keywords: ["cats", "feline", "cat grooming"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// HVAC SERVICE
// ===================================
export const HVAC_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for an HVAC service company. Answer with a calm, knowledgeable, tech-forward tone. Focus on heating, cooling, diagnostics, and preventative maintenance. Explain systems clearly without jargon or scare tactics. For off-topic inquiries, politely redirect to HVAC services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on HVAC",
    content: "If customer asks about topics unrelated to HVAC (plumbing, electrical beyond thermostats, etc.), politely redirect: 'I'm here to help with heating and cooling issues. For that concern, you may need a different specialist. How can I help with your HVAC system today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For repair calls, mention preventative maintenance plans to avoid future issues. For older systems (10+ years), educate about efficiency and suggest evaluation for replacement. Mention air quality products (UV lights, better filters) for allergy sufferers. Always present options, not pressure.",
    priority: 20,
    enabled: true
  }
];

export const HVAC_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Service Call Confirmation",
    description: "Sent when customer books service",
    body: "Hi {firstName}! Your HVAC service call is scheduled for {date} at {time}. Our technician will diagnose the issue and provide options. Service call fee applies.\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Robert", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 26", required: true },
      { name: "time", description: "Appointment time window", sample: "1:00-3:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Robert", date: "Dec 26", time: "1:00-3:00 PM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Reminder {firstName}: HVAC technician arriving tomorrow between {time}. Please ensure access to your unit (inside and outside). We'll call 30 min before arrival.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Linda", required: true },
      { name: "time", description: "Time window", sample: "8:00 AM-12:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Linda", time: "8:00 AM-12:00 PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Technician On Route",
    description: "Sent when technician is 30 minutes away",
    body: "Hi {firstName}! Your HVAC technician {techName} is on the way and will arrive in about 30 minutes. Thanks for your patience!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "James", required: true },
      { name: "techName", description: "Technician name", sample: "Mike", required: true }
    ],
    defaultPayload: { firstName: "James", techName: "Mike" },
    enabled: true
  }
];

export const HVAC_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What does a tune-up include?",
    answer: "A seasonal tune-up includes system inspection, filter replacement, coil cleaning, refrigerant check, thermostat calibration, and safety testing. It helps prevent breakdowns and maintains efficiency.",
    keywords: ["tune-up", "maintenance", "included", "service"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much is a diagnostic service call?",
    answer: "Our diagnostic service call fee ranges from $89-$149 depending on your area and time of day. This fee is often waived or credited if you proceed with recommended repairs.",
    keywords: ["price", "cost", "diagnostic", "service call", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do you offer emergency service?",
    answer: "Yes! We offer 24/7 emergency service for urgent heating or cooling failures. Emergency rates apply for after-hours, weekend, and holiday calls.",
    keywords: ["emergency", "24/7", "after hours", "urgent"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "When should I replace vs repair my system?",
    answer: "Generally, if your system is over 10-15 years old and repair costs exceed 50% of replacement value, replacement makes more financial sense. We'll always provide honest recommendations with pricing for both options.",
    keywords: ["replace", "repair", "new system", "upgrade"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// PLUMBING
// ===================================
export const PLUMBING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a plumbing service company. Answer with a calm, reassuring, no-drama tone. Focus on plumbing repairs, installations, and emergency services. Help customers stay calm during stressful situations like leaks or floods. For off-topic inquiries, politely redirect to plumbing services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on plumbing",
    content: "If customer asks about topics unrelated to plumbing (HVAC, electrical beyond water heaters, etc.), politely redirect: 'I'm here to help with plumbing issues. For that concern, you may need a different specialist. What plumbing problem can I help you solve today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For older homes, suggest whole-home plumbing inspections to prevent future issues. For water quality concerns, mention filtration systems or water softeners. For frequent drain clogs, recommend camera inspections to identify root causes. Always be helpful, not pushy.",
    priority: 20,
    enabled: true
  }
];

export const PLUMBING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Service Call Confirmation",
    description: "Sent when customer books service",
    body: "Hi {firstName}! Your plumbing service call is scheduled for {date} between {time}. Our plumber will call before arriving. Service call fee applies.\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Karen", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 27", required: true },
      { name: "time", description: "Time window", sample: "9:00 AM-12:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Karen", date: "Dec 27", time: "9:00 AM-12:00 PM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Reminder {firstName}: Plumber arriving tomorrow between {time}. Please ensure access to affected areas and shutoff valves. For emergencies before then, call us directly.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Brian", required: true },
      { name: "time", description: "Time window", sample: "1:00-4:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Brian", time: "1:00-4:00 PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Plumber On Route",
    description: "Sent when plumber is 30 minutes away",
    body: "Hi {firstName}! Your plumber {techName} is on the way and will arrive in about 30 minutes. Thanks for your patience!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Steve", required: true },
      { name: "techName", description: "Plumber name", sample: "Tony", required: true }
    ],
    defaultPayload: { firstName: "Steve", techName: "Tony" },
    enabled: true
  }
];

export const PLUMBING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "Do you handle emergency plumbing?",
    answer: "Yes! We offer 24/7 emergency plumbing service for urgent issues like burst pipes, major leaks, and sewer backups. Emergency rates apply for after-hours calls.",
    keywords: ["emergency", "urgent", "24/7", "after hours", "leak"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does a service call cost?",
    answer: "Our service call fee ranges from $120-$300 depending on the type of service and time of day. This covers diagnosis and typically the first hour of labor. We'll provide a complete estimate before starting work.",
    keywords: ["price", "cost", "service call", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Where is my main water shutoff?",
    answer: "It's usually near where the water line enters your home - check your basement, crawl space, or garage. It can also be outside near your water meter. If you can't find it and have an active leak, call us immediately for emergency service.",
    keywords: ["shutoff", "water valve", "emergency", "leak"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Can you fix my water heater?",
    answer: "Yes! We service and repair both tank and tankless water heaters. We can also help you decide if repair or replacement makes more sense based on the age and condition of your unit.",
    keywords: ["water heater", "hot water", "repair", "replace"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// ELECTRICAL
// ===================================
export const ELECTRICAL_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for an electrical contracting company. Answer with a safety-focused, knowledgeable tone. Explain electrical concepts in plain language without jargon. Always prioritize safety and code compliance. For off-topic inquiries, politely redirect to electrical services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on electrical",
    content: "If customer asks about topics unrelated to electrical work, politely redirect: 'I'm here to help with electrical services and safety. For that concern, you may need a different specialist. How can I help with your electrical needs today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For older homes, suggest electrical panel inspections or upgrades. When customers mention tripping breakers, explain panel capacity and modern demands. For outdoor projects, mention landscape lighting or EV charger installations. Focus on safety and convenience, not just sales.",
    priority: 20,
    enabled: true
  }
];

export const ELECTRICAL_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Service Call Confirmation",
    description: "Sent when customer books service",
    body: "Hi {firstName}! Your electrical service call is scheduled for {date} between {time}. Our licensed electrician will assess your issue and provide options.\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Patricia", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 28", required: true },
      { name: "time", description: "Time window", sample: "8:00 AM-12:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Patricia", date: "Dec 28", time: "8:00 AM-12:00 PM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Reminder {firstName}: Licensed electrician arriving tomorrow between {time}. Please ensure access to your electrical panel. For electrical emergencies before then, call us right away.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Kevin", required: true },
      { name: "time", description: "Time window", sample: "1:00-5:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Kevin", time: "1:00-5:00 PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Electrician On Route",
    description: "Sent when electrician is 30 minutes away",
    body: "Hi {firstName}! Your electrician {techName} is on the way and will arrive in about 30 minutes. Thanks!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Daniel", required: true },
      { name: "techName", description: "Electrician name", sample: "Chris", required: true }
    ],
    defaultPayload: { firstName: "Daniel", techName: "Chris" },
    enabled: true
  }
];

export const ELECTRICAL_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "When should I upgrade my electrical panel?",
    answer: "Consider an upgrade if you have frequent tripping breakers, a panel over 25 years old, adding major appliances (EV charger, hot tub), or planning a home addition. We offer free panel inspections and upgrade quotes.",
    keywords: ["panel", "upgrade", "breaker", "replace"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does an electrical service call cost?",
    answer: "Service calls typically range from $150-$350 for diagnosis and basic repairs. Complex work or panel upgrades are quoted separately. We provide upfront pricing before starting any work.",
    keywords: ["price", "cost", "service call", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Are your electricians licensed and insured?",
    answer: "Yes! All our electricians are fully licensed, bonded, and insured. We carry comprehensive liability insurance and all work is code-compliant with proper permits.",
    keywords: ["licensed", "insured", "certified", "qualified"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Can you install an EV charger?",
    answer: "Absolutely! We're experienced with Level 2 EV charger installations for all major brands. We'll assess your panel capacity, pull permits, and ensure a safe, code-compliant installation.",
    keywords: ["EV charger", "electric vehicle", "tesla", "charging station"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// ROOFING
// ===================================
export const ROOFING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a roofing contractor. Answer with a straightforward, educational, no-pressure tone. Focus on roof repairs, replacements, inspections, and storm damage. Explain options clearly and help customers understand what they need. For off-topic inquiries, politely redirect to roofing services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on roofing",
    content: "If customer asks about topics unrelated to roofing (siding, gutters beyond roof-related, etc.), politely redirect: 'I'm here to help with roofing needs. For that concern, you may want a different specialist. How can I help with your roof today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For older roofs (15+ years), mention the benefits of replacement vs ongoing repairs. For storm damage calls, explain insurance claim assistance. When discussing replacements, present multiple material options (asphalt, metal, etc.) with honest pros and cons.",
    priority: 20,
    enabled: true
  }
];

export const ROOFING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Inspection Confirmation",
    description: "Sent when customer books roof inspection",
    body: "Hi {firstName}! Your roof inspection is scheduled for {date} at {time}. We'll provide a detailed assessment and photos. Weather permitting!\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Margaret", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 29", required: true },
      { name: "time", description: "Appointment time", sample: "10:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Margaret", date: "Dec 29", time: "10:00 AM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Reminder {firstName}: Roof inspection tomorrow at {time}. Our crew will inspect from the roof and provide a full report with photos. See you soon!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "William", required: true },
      { name: "time", description: "Appointment time", sample: "9:00 AM", required: true }
    ],
    defaultPayload: { firstName: "William", time: "9:00 AM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Crew On-Site",
    description: "Sent when crew arrives",
    body: "Hi {firstName}! Our roofing crew has arrived. We'll complete your inspection and provide a detailed assessment when finished.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Susan", required: true }
    ],
    defaultPayload: { firstName: "Susan" },
    enabled: true
  }
];

export const ROOFING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "How do I know if I need a new roof?",
    answer: "Common signs include shingles that are curling, cracked, or missing, water stains on ceilings, roof age over 20 years, or visible sagging. We offer free inspections to assess your roof's condition.",
    keywords: ["new roof", "replacement", "need", "signs"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does a roof replacement cost?",
    answer: "Roof replacement typically ranges from $8,000-$25,000+ depending on size, pitch, materials, and complexity. We provide detailed written estimates after a free inspection.",
    keywords: ["price", "cost", "replacement", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do you work with insurance companies?",
    answer: "Yes! We're experienced with insurance claims for storm damage. We can meet with your adjuster, provide documentation, and help navigate the claims process.",
    keywords: ["insurance", "claim", "storm damage", "adjuster"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "How long does a roof last?",
    answer: "Asphalt shingles typically last 20-30 years, metal roofs 40-70 years, and tile roofs 50+ years. Lifespan depends on material quality, installation, climate, and maintenance.",
    keywords: ["lifespan", "how long", "duration", "warranty"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// TREE SERVICE
// ===================================
export const TREE_SERVICE_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a tree service company. Answer with a safety-focused, knowledgeable tone about tree care, removal, trimming, and storm damage. Explain risks and processes clearly. For off-topic inquiries, politely redirect to tree services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on tree services",
    content: "If customer asks about topics unrelated to trees (general landscaping, lawn care, etc.), politely redirect: 'I'm here to help with tree care and removal. For that service, you may want a landscaping specialist. What tree-related needs can I help with today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For tree removal requests, mention stump grinding services. For trimming jobs, suggest ongoing maintenance plans. After storm damage, recommend full property assessments. For diseased trees, explain treatment options vs removal.",
    priority: 20,
    enabled: true
  }
];

export const TREE_SERVICE_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Service Confirmation",
    description: "Sent when customer books tree service",
    body: "Hi {firstName}! Your {serviceName} is scheduled for {date} at {time}. Our certified arborists will take great care of your property.\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Christopher", required: true },
      { name: "serviceName", description: "Service booked", sample: "Tree Trimming", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 30", required: true },
      { name: "time", description: "Appointment time", sample: "8:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Christopher", serviceName: "Tree Trimming", date: "Dec 30", time: "8:00 AM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Reminder {firstName}: Tree service crew arriving tomorrow at {time}. Please ensure access to work area and move any vehicles. We'll handle all cleanup!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Jessica", required: true },
      { name: "time", description: "Appointment time", sample: "7:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Jessica", time: "7:00 AM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Crew On-Site",
    description: "Sent when crew arrives",
    body: "Hi {firstName}! Our tree service crew has arrived and is setting up. We'll keep your property safe and clean throughout the job. 🌳",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Andrew", required: true }
    ],
    defaultPayload: { firstName: "Andrew" },
    enabled: true
  }
];

export const TREE_SERVICE_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "When is the best time to trim trees?",
    answer: "Late winter/early spring (dormant season) is ideal for most trees. However, dead or hazardous branches should be removed immediately regardless of season. We can assess your specific trees and recommend the best timing.",
    keywords: ["trimming", "pruning", "when", "season", "timing"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does tree removal cost?",
    answer: "Tree removal typically ranges from $400-$2,500+ depending on size, location, difficulty, and access. We provide free estimates after assessing the tree and property.",
    keywords: ["price", "cost", "removal", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do you remove the stump?",
    answer: "Stump grinding is typically a separate service from tree removal. We can grind stumps 6-12 inches below grade, allowing you to replant grass or landscape over the area.",
    keywords: ["stump", "grinding", "removal", "included"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Are you insured for tree work?",
    answer: "Yes! We carry full liability insurance and workers' compensation. Tree work can be dangerous - always verify insurance before hiring any tree service company.",
    keywords: ["insurance", "licensed", "certified", "arborist"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// PERSONAL TRAINING
// ===================================
export const PERSONAL_TRAINING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a personal training service. Answer with a motivating, supportive, health-focused tone. Focus on fitness goals, training programs, and wellness. Encourage without being pushy. For medical questions, always recommend consulting a doctor. For off-topic inquiries, politely redirect to training services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on training",
    content: "If customer asks medical or nutrition questions beyond general fitness, redirect: 'For specific medical or dietary advice, please consult a doctor or registered dietitian. I'm here to help with training programs and fitness goals. How can I help you reach your fitness goals?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For trial session inquiries, mention package discounts and commitment benefits. For individual training, suggest small group options for accountability. For specific goals (weight loss, strength), recommend specialized programs or extended timelines for results.",
    priority: 20,
    enabled: true
  }
];

export const PERSONAL_TRAINING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Session Confirmation",
    description: "Sent when customer books training session",
    body: "Hey {firstName}! Your training session with {trainerName} is confirmed for {date} at {time}. Bring water, a towel, and your energy! 💪\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Amanda", required: true },
      { name: "trainerName", description: "Trainer name", sample: "Coach Mike", required: true },
      { name: "date", description: "Session date", sample: "Jan 2", required: true },
      { name: "time", description: "Session time", sample: "6:00 AM", required: true }
    ],
    defaultPayload: { firstName: "Amanda", trainerName: "Coach Mike", date: "Jan 2", time: "6:00 AM" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before session",
    body: "Hi {firstName}! Training session tomorrow at {time} with {trainerName}. Remember to hydrate today and get good sleep. You've got this! 💪",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Marcus", required: true },
      { name: "trainerName", description: "Trainer name", sample: "Coach Sarah", required: true },
      { name: "time", description: "Session time", sample: "5:30 PM", required: true }
    ],
    defaultPayload: { firstName: "Marcus", trainerName: "Coach Sarah", time: "5:30 PM" },
    enabled: true
  },
  {
    templateKey: "motivation_checkin",
    category: "engagement",
    name: "Mid-Week Motivation",
    description: "Sent mid-week to encourage clients",
    body: "Hey {firstName}! You're crushing it this week! 🔥 Keep up the great work. See you at your next session {date} at {time}!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Tyler", required: true },
      { name: "date", description: "Next session date", sample: "Friday", required: true },
      { name: "time", description: "Session time", sample: "6:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Tyler", date: "Friday", time: "6:00 PM" },
    enabled: true
  }
];

export const PERSONAL_TRAINING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "Do I need to be in shape to start?",
    answer: "Not at all! We work with clients of all fitness levels, from complete beginners to advanced athletes. Your program is customized to your current fitness level and goals.",
    keywords: ["beginner", "fitness level", "out of shape", "start"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does personal training cost?",
    answer: "Individual sessions range from $60-$150 depending on package size and trainer experience. We offer multi-session packages with significant discounts. First consultation is often complimentary!",
    keywords: ["price", "cost", "sessions", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "How often should I train?",
    answer: "We typically recommend 2-3 sessions per week for best results, but it depends on your goals, schedule, and budget. We can create a plan that fits your life.",
    keywords: ["frequency", "how often", "times per week", "schedule"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you offer online training?",
    answer: "Yes! We offer both in-person and virtual training sessions via video call. Online training is perfect for busy schedules, travel, or working out at home.",
    keywords: ["online", "virtual", "remote", "video"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// MOBILE MECHANIC
// ===================================
export const MOBILE_MECHANIC_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a mobile mechanic service. Answer with a friendly, straightforward, tech-savvy tone. Focus on vehicle repairs, maintenance, and diagnostics. Explain automotive issues in plain language. For off-topic inquiries, politely redirect to mechanic services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on auto repair",
    content: "If customer asks about topics unrelated to vehicle repair or maintenance, politely redirect: 'I'm here to help with vehicle repairs and maintenance. How can I help get your car running right?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For oil change requests, mention multi-point inspections. For brake work, suggest rotor replacement if needed. For check engine lights, explain the value of full diagnostics. For fleet owners, offer maintenance packages at reduced rates.",
    priority: 20,
    enabled: true
  }
];

export const MOBILE_MECHANIC_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Service Confirmation",
    description: "Sent when customer books service",
    body: "Hi {firstName}! Your mobile mechanic appointment for {serviceName} is confirmed for {date} at {time}. We'll come to you - {location}.\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Derek", required: true },
      { name: "serviceName", description: "Service requested", sample: "Oil Change", required: true },
      { name: "date", description: "Appointment date", sample: "Jan 3", required: true },
      { name: "time", description: "Appointment time", sample: "2:00 PM", required: true },
      { name: "location", description: "Service location", sample: "your home", required: false }
    ],
    defaultPayload: { firstName: "Derek", serviceName: "Oil Change", date: "Jan 3", time: "2:00 PM", location: "your location" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before appointment",
    body: "Reminder {firstName}: Mobile mechanic arriving tomorrow at {time} for {serviceName}. Please have your vehicle accessible and ready. See you then!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Nicole", required: true },
      { name: "serviceName", description: "Service name", sample: "Brake Inspection", required: true },
      { name: "time", description: "Appointment time", sample: "1:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Nicole", serviceName: "Brake Inspection", time: "1:00 PM" },
    enabled: true
  },
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Mechanic On Route",
    description: "Sent when mechanic is 30 minutes away",
    body: "Hi {firstName}! Your mechanic {techName} is on the way and will arrive in about 30 minutes for your {serviceName}. Thanks!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Brandon", required: true },
      { name: "techName", description: "Mechanic name", sample: "Jake", required: true },
      { name: "serviceName", description: "Service name", sample: "diagnostic", required: true }
    ],
    defaultPayload: { firstName: "Brandon", techName: "Jake", serviceName: "diagnostic" },
    enabled: true
  }
];

export const MOBILE_MECHANIC_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What services can you do on-site?",
    answer: "We handle most repairs and maintenance on-site: oil changes, brakes, batteries, starters, alternators, diagnostics, and more. Major engine or transmission work may require a shop. We'll let you know upfront!",
    keywords: ["services", "what can you do", "on-site", "mobile"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "Is mobile service more expensive?",
    answer: "Our pricing is competitive with shop rates. You save time and hassle by not having to drop off and pick up your vehicle. We provide upfront quotes before starting work.",
    keywords: ["price", "cost", "expensive", "rates"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do I need to be present?",
    answer: "Yes, someone 18+ should be present during the service. We'll need access to your vehicle and may have questions during the repair.",
    keywords: ["present", "be there", "home", "available"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you work on all vehicle makes?",
    answer: "We service most domestic and import vehicles - cars, trucks, and SUVs. For specialty or exotic vehicles, we'll let you know if we can help during booking.",
    keywords: ["vehicles", "makes", "brands", "what cars"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// TUTORING & COACHING
// ===================================
export const TUTORING_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a tutoring and academic coaching service. Answer with a supportive, encouraging, structured tone. Focus on academic help, test prep, and learning strategies. For off-topic inquiries, politely redirect to tutoring services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on tutoring",
    content: "If customer asks about topics unrelated to tutoring or academic coaching, politely redirect: 'I'm here to help with tutoring and academic support. How can I help with learning goals today?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For single session inquiries, mention multi-session package discounts. For test prep (SAT/ACT), suggest comprehensive programs over single sessions. For struggling students, recommend consistent weekly sessions for best results.",
    priority: 20,
    enabled: true
  }
];

export const TUTORING_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Session Confirmation",
    description: "Sent when customer books tutoring session",
    body: "Hi {firstName}! Your {subject} tutoring session with {tutorName} is confirmed for {date} at {time}. {location} Looking forward to it! 📚\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Student's first name", sample: "Sophia", required: true },
      { name: "subject", description: "Subject area", sample: "Math", required: true },
      { name: "tutorName", description: "Tutor name", sample: "Ms. Johnson", required: true },
      { name: "date", description: "Session date", sample: "Jan 5", required: true },
      { name: "time", description: "Session time", sample: "4:00 PM", required: true },
      { name: "location", description: "Location or online", sample: "Online via Zoom", required: false }
    ],
    defaultPayload: { firstName: "Sophia", subject: "Math", tutorName: "Ms. Johnson", date: "Jan 5", time: "4:00 PM", location: "Online via Zoom" },
    enabled: true
  },
  {
    templateKey: "appointment_reminder_24h",
    category: "booking",
    name: "24-Hour Reminder",
    description: "Sent 24 hours before session",
    body: "Reminder {firstName}: {subject} tutoring tomorrow at {time} with {tutorName}. Please have your materials ready. You're doing great! 📖",
    variables: [
      { name: "firstName", description: "Student's first name", sample: "Ethan", required: true },
      { name: "subject", description: "Subject area", sample: "Chemistry", required: true },
      { name: "tutorName", description: "Tutor name", sample: "Mr. Davis", required: true },
      { name: "time", description: "Session time", sample: "6:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Ethan", subject: "Chemistry", tutorName: "Mr. Davis", time: "6:00 PM" },
    enabled: true
  },
  {
    templateKey: "progress_update",
    category: "engagement",
    name: "Progress Check-In",
    description: "Sent after several sessions",
    body: "Hi {firstName}! Great progress in {subject} - {tutorName} is really proud of your improvement! Keep up the excellent work! 🌟",
    variables: [
      { name: "firstName", description: "Student's first name", sample: "Olivia", required: true },
      { name: "subject", description: "Subject area", sample: "English", required: true },
      { name: "tutorName", description: "Tutor name", sample: "Ms. Lee", required: true }
    ],
    defaultPayload: { firstName: "Olivia", subject: "English", tutorName: "Ms. Lee" },
    enabled: true
  }
];

export const TUTORING_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What subjects do you tutor?",
    answer: "We tutor most K-12 subjects including math, science, English, history, and foreign languages. We also offer test prep for SAT, ACT, GRE, and other standardized tests.",
    keywords: ["subjects", "what do you teach", "areas", "topics"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does tutoring cost?",
    answer: "Individual tutoring ranges from $60-$150 per hour depending on subject, grade level, and tutor experience. We offer package discounts for multiple sessions booked upfront.",
    keywords: ["price", "cost", "rates", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "Do you offer online tutoring?",
    answer: "Yes! We offer both in-person and online tutoring via video conferencing. Online sessions are just as effective and offer more scheduling flexibility.",
    keywords: ["online", "virtual", "remote", "video"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "How often should my child meet with a tutor?",
    answer: "We typically recommend 1-2 sessions per week for ongoing support, or daily sessions for intensive test prep. We'll create a schedule that matches your student's needs and goals.",
    keywords: ["frequency", "how often", "schedule", "weekly"],
    displayOrder: 4,
    enabled: true
  }
];

// ===================================
// STR TURNOVERS (Short-Term Rentals)
// ===================================
export const STR_TURNOVERS_AI_RULES: AIBehaviorRuleTemplate[] = [
  {
    ruleKey: "system_prompt",
    category: "personality",
    name: "Core System Prompt",
    description: "Main AI personality and business context",
    content: "You are an AI assistant for a short-term rental turnover service (Airbnb/VRBO). Answer with an operational, results-focused, host-friendly tone. Focus on turnover speed, cleanliness standards, and property management. For off-topic inquiries, politely redirect to STR services.",
    priority: 1,
    enabled: true
  },
  {
    ruleKey: "topic_boundaries",
    category: "boundaries",
    name: "Conversation Boundaries",
    description: "Keep conversations focused on STR services",
    content: "If customer asks about topics unrelated to short-term rental turnovers or property management, politely redirect: 'I'm here to help with Airbnb/VRBO turnovers and property care. How can I help keep your rental guest-ready?'",
    priority: 10,
    enabled: true
  },
  {
    ruleKey: "upsell_guidelines",
    category: "upsell",
    name: "Natural Upselling",
    description: "Context-aware service recommendations",
    content: "For single property owners, suggest monthly deep cleaning schedules. For standard turnovers, mention restocking services or maintenance checks. For multi-property hosts, offer package pricing and dedicated support.",
    priority: 20,
    enabled: true
  }
];

export const STR_TURNOVERS_SMS_TEMPLATES: SmsTemplateConfig[] = [
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Turnover Confirmation",
    description: "Sent when host books turnover",
    body: "Hi {firstName}! Turnover confirmed for {propertyName} on {date} by {time}. Check-out: {checkoutTime}, Check-in: {checkinTime}. We'll have it guest-ready! ✨\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Host's first name", sample: "Rachel", required: true },
      { name: "propertyName", description: "Property name/address", sample: "Downtown Loft", required: true },
      { name: "date", description: "Turnover date", sample: "Jan 8", required: true },
      { name: "time", description: "Completion time", sample: "3:00 PM", required: true },
      { name: "checkoutTime", description: "Guest checkout time", sample: "11:00 AM", required: false },
      { name: "checkinTime", description: "Next guest checkin", sample: "4:00 PM", required: false }
    ],
    defaultPayload: { firstName: "Rachel", propertyName: "Downtown Loft", date: "Jan 8", time: "3:00 PM", checkoutTime: "11:00 AM", checkinTime: "4:00 PM" },
    enabled: true
  },
  {
    templateKey: "turnover_complete",
    category: "technician",
    name: "Turnover Complete",
    description: "Sent when turnover is finished",
    body: "{firstName}, {propertyName} is guest-ready! ✅ All cleaned, restocked, and inspected. Photos sent to your email. Next guest check-in: {checkinTime}.",
    variables: [
      { name: "firstName", description: "Host's first name", sample: "Daniel", required: true },
      { name: "propertyName", description: "Property name", sample: "Beach House", required: true },
      { name: "checkinTime", description: "Next checkin time", sample: "4:00 PM", required: true }
    ],
    defaultPayload: { firstName: "Daniel", propertyName: "Beach House", checkinTime: "4:00 PM" },
    enabled: true
  },
  {
    templateKey: "maintenance_alert",
    category: "alerts",
    name: "Maintenance Issue Alert",
    description: "Sent when issues are found during turnover",
    body: "Hi {firstName}, found a maintenance issue at {propertyName}: {issue}. Photos sent. Need us to handle it or coordinate with your vendor? Reply with instructions.",
    variables: [
      { name: "firstName", description: "Host's first name", sample: "Melissa", required: true },
      { name: "propertyName", description: "Property name", sample: "Cabin Retreat", required: true },
      { name: "issue", description: "Issue description", sample: "Broken dishwasher", required: true }
    ],
    defaultPayload: { firstName: "Melissa", propertyName: "Cabin Retreat", issue: "maintenance needed" },
    enabled: true
  }
];

export const STR_TURNOVERS_FAQ: FaqEntryTemplate[] = [
  {
    category: "services",
    question: "What's included in a standard turnover?",
    answer: "Standard turnover includes full cleaning, linen change, restocking essentials (toilet paper, paper towels, soap), trash removal, and property inspection with photos. Deep cleaning and maintenance are additional.",
    keywords: ["included", "standard", "what do you do", "services"],
    displayOrder: 1,
    enabled: true
  },
  {
    category: "pricing",
    question: "How much does turnover service cost?",
    answer: "Turnover pricing typically ranges from $80-$250+ depending on property size, location, and turnaround time. We offer discounted rates for regular clients with multiple properties.",
    keywords: ["price", "cost", "rates", "how much"],
    displayOrder: 2,
    enabled: true
  },
  {
    category: "policies",
    question: "How do you handle same-day turnovers?",
    answer: "We specialize in same-day turnovers! Just provide checkout and check-in times when booking. We recommend at least a 4-hour window between guests for standard cleaning.",
    keywords: ["same day", "quick", "fast", "urgent"],
    displayOrder: 3,
    enabled: true
  },
  {
    category: "services",
    question: "Do you handle multiple properties?",
    answer: "Absolutely! Many of our clients have 3-10+ properties. We can manage your entire portfolio, provide dedicated support, and offer volume discounts.",
    keywords: ["multiple", "portfolio", "several", "many properties"],
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
  },
  "pressure_washing": {
    aiRules: PRESSURE_WASHING_AI_RULES,
    smsTemplates: PRESSURE_WASHING_SMS_TEMPLATES,
    faqEntries: PRESSURE_WASHING_FAQ
  },
  "window_cleaning": {
    aiRules: WINDOW_CLEANING_AI_RULES,
    smsTemplates: WINDOW_CLEANING_SMS_TEMPLATES,
    faqEntries: WINDOW_CLEANING_FAQ
  },
  "mobile_pet_grooming": {
    aiRules: MOBILE_PET_GROOMING_AI_RULES,
    smsTemplates: MOBILE_PET_GROOMING_SMS_TEMPLATES,
    faqEntries: MOBILE_PET_GROOMING_FAQ
  },
  "hvac": {
    aiRules: HVAC_AI_RULES,
    smsTemplates: HVAC_SMS_TEMPLATES,
    faqEntries: HVAC_FAQ
  },
  "plumbing": {
    aiRules: PLUMBING_AI_RULES,
    smsTemplates: PLUMBING_SMS_TEMPLATES,
    faqEntries: PLUMBING_FAQ
  },
  "electrical": {
    aiRules: ELECTRICAL_AI_RULES,
    smsTemplates: ELECTRICAL_SMS_TEMPLATES,
    faqEntries: ELECTRICAL_FAQ
  },
  "roofing": {
    aiRules: ROOFING_AI_RULES,
    smsTemplates: ROOFING_SMS_TEMPLATES,
    faqEntries: ROOFING_FAQ
  },
  "tree_service": {
    aiRules: TREE_SERVICE_AI_RULES,
    smsTemplates: TREE_SERVICE_SMS_TEMPLATES,
    faqEntries: TREE_SERVICE_FAQ
  },
  "personal_training": {
    aiRules: PERSONAL_TRAINING_AI_RULES,
    smsTemplates: PERSONAL_TRAINING_SMS_TEMPLATES,
    faqEntries: PERSONAL_TRAINING_FAQ
  },
  "mobile_mechanic": {
    aiRules: MOBILE_MECHANIC_AI_RULES,
    smsTemplates: MOBILE_MECHANIC_SMS_TEMPLATES,
    faqEntries: MOBILE_MECHANIC_FAQ
  },
  "tutoring_coaching": {
    aiRules: TUTORING_AI_RULES,
    smsTemplates: TUTORING_SMS_TEMPLATES,
    faqEntries: TUTORING_FAQ
  },
  "str_turnovers": {
    aiRules: STR_TURNOVERS_AI_RULES,
    smsTemplates: STR_TURNOVERS_SMS_TEMPLATES,
    faqEntries: STR_TURNOVERS_FAQ
  },
  // Aliases for industries with different IDs in industryPacks.ts
  "beauty_salon_barber": {
    aiRules: HAIR_STYLIST_AI_RULES,
    smsTemplates: HAIR_STYLIST_SMS_TEMPLATES,
    faqEntries: HAIR_STYLIST_FAQ
  },
  "house_cleaning_maids": {
    aiRules: HOUSE_CLEANING_AI_RULES,
    smsTemplates: HOUSE_CLEANING_SMS_TEMPLATES,
    faqEntries: HOUSE_CLEANING_FAQ
  },
  "photography_full": {
    aiRules: PHOTOGRAPHY_AI_RULES,
    smsTemplates: PHOTOGRAPHY_SMS_TEMPLATES,
    faqEntries: PHOTOGRAPHY_FAQ
  }
};
