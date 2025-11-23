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

// Map industry IDs to bootstrap data
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
  // For other industries, we can use the auto detailing as a base and customize later
  "lawn_care_landscaping": {
    aiRules: AUTO_DETAILING_AI_RULES.map(rule => ({
      ...rule,
      content: rule.content.replace(/auto detailing/gi, "lawn care").replace(/vehicle/gi, "yard").replace(/detail/gi, "lawn service")
    })),
    smsTemplates: AUTO_DETAILING_SMS_TEMPLATES.map(template => ({
      ...template,
      body: template.body.replace(/showroom shine/gi, "lush green lawn")
    })),
    faqEntries: AUTO_DETAILING_FAQ
  }
};
