import { db } from "./db";
import { smsTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { wrapTenantDb } from "./tenantDb";

/**
 * Default SMS Templates
 * Each template includes variable metadata for validation and UI guidance
 */
const DEFAULT_TEMPLATES = [
  {
    templateKey: "on_site_arrival",
    category: "technician",
    name: "Technician On-Site Arrival",
    description: "Sent when technician marks themselves as on-site",
    body: "Hey {firstName}! 👋 Your Clean Machine technician has arrived and will be with you shortly. Get ready for that showroom shine! ✨",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "John", required: true },
    ],
    defaultPayload: { firstName: "John" },
    enabled: true,
  },
  {
    templateKey: "booking_confirmation",
    category: "booking",
    name: "Booking Confirmation",
    description: "Sent when customer successfully books an appointment",
    body: "Thanks {firstName}! Your {serviceName} appointment is confirmed for {date} at {time}. We'll send you a reminder 24 hours before.\n\nView your services: https://cleanmachinetulsa.replit.app/my-services\n\nReply STOP to opt out.",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Alex", required: true },
      { name: "serviceName", description: "Service booked", sample: "Full Detail", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 15", required: true },
      { name: "time", description: "Appointment time", sample: "2:00 PM", required: true },
    ],
    defaultPayload: { firstName: "Alex", serviceName: "Full Detail", date: "Dec 15", time: "2:00 PM" },
    enabled: true,
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
      { name: "time", description: "Appointment time", sample: "10:00 AM", required: true },
    ],
    defaultPayload: { firstName: "Mike", serviceName: "Interior Detail", time: "10:00 AM" },
    enabled: true,
  },
  {
    templateKey: "appointment_reminder_1h",
    category: "booking",
    name: "1-Hour Appointment Reminder",
    description: "Sent 1 hour before scheduled appointment",
    body: "Hey {firstName}! Your {serviceName} appointment is in 1 hour. Our technician {technicianName} will arrive at {time}. See you soon! 🚗",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Lisa", required: true },
      { name: "serviceName", description: "Service booked", sample: "Full Detail", required: true },
      { name: "technicianName", description: "Assigned technician", sample: "James", required: false },
      { name: "time", description: "Appointment time", sample: "3:00 PM", required: true },
    ],
    defaultPayload: { firstName: "Lisa", serviceName: "Full Detail", technicianName: "James", time: "3:00 PM" },
    enabled: true,
  },
  {
    templateKey: "damage_assessment_request",
    category: "technician",
    name: "Damage Assessment Photo Request",
    description: "Sent when customer mentions vehicle damage",
    body: "Hi {firstName}! To give you an accurate quote for the damage you mentioned, could you text us a few photos? This helps us prepare the right materials. Thanks!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "David", required: true },
    ],
    defaultPayload: { firstName: "David" },
    enabled: true,
  },
  {
    templateKey: "specialty_quote_received",
    category: "booking",
    name: "Specialty Quote Request Received",
    description: "Sent when customer requests specialty service quote",
    body: "Thanks {firstName}! We've received your specialty service request. We'll review it and get back to you within 2-4 hours with a custom quote. Talk soon!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Jessica", required: true },
    ],
    defaultPayload: { firstName: "Jessica" },
    enabled: true,
  },
  {
    templateKey: "missed_call_auto_response",
    category: "technician",
    name: "Missed Call Auto-Response",
    description: "Sent when business misses a customer call",
    body: "Hi! Sorry we missed your call. Book online at cleanmachinetulsa.com or reply with your service needs and we'll get back to you ASAP! 🚗✨",
    variables: [],
    defaultPayload: {},
    enabled: true,
  },
  {
    templateKey: "payment_received",
    category: "payment",
    name: "Payment Received Confirmation",
    description: "Sent when customer payment is processed",
    body: "Payment received, {firstName}! Thanks for choosing Clean Machine. Your {serviceName} is all set for {date}. We can't wait to make your ride shine! 🎉",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Tom", required: true },
      { name: "serviceName", description: "Service booked", sample: "Ceramic Coating", required: true },
      { name: "date", description: "Appointment date", sample: "Dec 20", required: true },
    ],
    defaultPayload: { firstName: "Tom", serviceName: "Ceramic Coating", date: "Dec 20" },
    enabled: true,
  },
  {
    templateKey: "service_complete",
    category: "technician",
    name: "Service Completion Thank You",
    description: "Sent after service is marked as complete",
    body: "Thanks for choosing Clean Machine, {firstName}! Your {serviceName} is complete. Love the results? Leave us a review! Questions? Reply anytime. 🌟",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Emma", required: true },
      { name: "serviceName", description: "Service completed", sample: "Full Detail", required: true },
    ],
    defaultPayload: { firstName: "Emma", serviceName: "Full Detail" },
    enabled: true,
  },
  {
    templateKey: "referral_reward_earned",
    category: "referrals",
    name: "Referral Reward Earned",
    description: "Sent when customer earns referral points",
    body: "Great news {firstName}! Your friend just completed their first service. You've earned {referrerReward}! 🎉 Keep referring and rack up those rewards!",
    variables: [
      { name: "firstName", description: "Customer's first name", sample: "Chris", required: true },
      { name: "referrerReward", description: "Reward earned by referrer", sample: "500 loyalty points", required: true },
    ],
    defaultPayload: { firstName: "Chris", referrerReward: "500 loyalty points" },
    enabled: true,
  },
  {
    templateKey: "referral_invite",
    category: "referrals",
    name: "Referral Invite",
    description: "Sent when customer sends referral invite to a friend via SMS",
    body: "Hey! {referrerName} thinks you'd love Clean Machine Auto Detail! 🚗✨\n\nUse code {referralCode} to get {refereeReward} your first detail, and we'll both get {referrerReward}!\n\nBook now: {bookingUrl}",
    variables: [
      { name: "referrerName", description: "Referrer's first name", sample: "Jordan", required: true },
      { name: "referralCode", description: "Unique referral code", sample: "JORDAN-AB3C5", required: true },
      { name: "bookingUrl", description: "Booking URL with referral code", sample: "https://cleanmachinetulsa.com/book?ref=JORDAN-AB3C5", required: true },
      { name: "referrerReward", description: "Reward for referrer (from config)", sample: "500 loyalty points", required: true },
      { name: "refereeReward", description: "Reward for referee (from config)", sample: "$25 off", required: true },
    ],
    defaultPayload: {
      referrerName: "Jordan",
      referralCode: "JORDAN-AB3C5",
      bookingUrl: "https://cleanmachinetulsa.com/book?ref=JORDAN-AB3C5",
      referrerReward: "500 loyalty points",
      refereeReward: "$25 off"
    },
    enabled: true,
  },
];

/**
 * Initialize SMS templates (idempotent - safe to run multiple times)
 * Uses upsert pattern: updates if exists, inserts if new
 */
export async function initializeSmsTemplates() {
  const tenantDb = wrapTenantDb(db, 'root');
  try {
    console.log('[SMS TEMPLATES INIT] Starting template initialization...');

    let created = 0;
    let updated = 0;

    for (const template of DEFAULT_TEMPLATES) {
      // Check if template already exists
      const [existing] = await tenantDb
        .select()
        .from(smsTemplates)
        .where(
          and(
            eq(smsTemplates.templateKey, template.templateKey),
            eq(smsTemplates.language, "en")
          )
        )
        .limit(1);

      if (existing) {
        // Update existing template (preserves custom edits to name/description/enabled status)
        // Only updates body/variables if they haven't been customized
        if (existing.version === 1) {
          await tenantDb
            .update(smsTemplates)
            .set({
              body: template.body,
              variables: template.variables,
              defaultPayload: template.defaultPayload,
              updatedAt: new Date(),
            })
            .where(eq(smsTemplates.id, existing.id));
          updated++;
        }
      } else {
        // Insert new template
        await tenantDb.insert(smsTemplates).values({
          ...template,
          channel: "sms",
          language: "en",
          version: 1,
        });
        created++;
      }
    }

    console.log(`[SMS TEMPLATES INIT] Initialization complete: ${created} created, ${updated} updated`);
    return { success: true, created, updated };
  } catch (error) {
    console.error('[SMS TEMPLATES INIT] Error initializing templates:', error);
    return { success: false, error };
  }
}
