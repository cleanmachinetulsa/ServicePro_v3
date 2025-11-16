import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { PillTabs } from '../shared/PillTabs';
import { CodeBlock } from '../shared/CodeBlock';

const automationTypes = [
  {
    id: 'sms',
    label: 'SMS Flows',
    title: 'Smart SMS Automation',
    description: 'Intelligent text message sequences that feel human',
    rules: [
      'New inquiry receives instant response with service area check',
      'Appointment confirmations sent 24 hours before with weather check',
      'ETA updates when technician is 15 minutes away',
      'Thank you message immediately after service completion',
      'Review request sent 2 hours post-service for best response rate'
    ],
    code: `WHEN new_inquiry VIA sms:
  IF in_service_area AND slots_available:
    SEND "Thanks for reaching out! What are we working on today?"
    WAIT for response
    COLLECT vehicle_info, service_type
    PROPOSE optimized_time_slots(location, duration)
  ELSE IF outside_service_area:
    SEND "We're a bit far, but happy to help! Min $X for the trip."
  ALWAYS tag with: [status, vehicle_type, location]
  
WHEN appointment.time - 24h:
  CHECK weather_forecast
  IF rain_probability > 70%:
    SEND "Weather looks rough tomorrow. Want to reschedule or move indoors?"
  ELSE:
    SEND "Excited for tomorrow! We'll text when we're 15 min away."
    
WHEN job.status == "complete":
  SEND "Hope you love the results! 🚗✨"
  SCHEDULE review_request(+2 hours)
  ADD to maintenance_sequence(+90 days)`
  },
  {
    id: 'email',
    label: 'Email Sequences',
    description: 'Professional email campaigns that nurture and retain',
    title: 'Email Automation',
    rules: [
      'Welcome series for new customers (3 emails over 7 days)',
      'Appointment reminders with add-on suggestions',
      'Post-service follow-up with care tips and next service discount',
      'Review request with direct link to preferred platform',
      'Seasonal campaigns (spring detail, winter protection, summer prep)'
    ],
    code: `SEQUENCE new_customer_welcome:
  EMAIL 1 (immediate):
    SUBJECT: "Welcome to Clean Machine! 🎉"
    CONTENT: Intro, what to expect, service menu
    CTA: "Book Your First Detail"
    
  EMAIL 2 (+3 days):
    SUBJECT: "How We're Different (Spoiler: We Care)"
    CONTENT: Process, quality standards, team intro
    CTA: "Meet the Team"
    
  EMAIL 3 (+7 days):
    SUBJECT: "Special Offer Just for You"
    CONTENT: New customer discount, referral program
    CTA: "Claim Your 15% Off"

SEQUENCE post_service_nurture:
  EMAIL 1 (+1 day):
    SUBJECT: "Thanks for trusting us with your [vehicle]!"
    CONTENT: Care tips, before/after photos
    
  EMAIL 2 (+7 days):
    IF no_review_left:
      SUBJECT: "Quick favor?"
      CONTENT: Review request, link to Google
      
  EMAIL 3 (+90 days):
    SUBJECT: "Time for a refresh?"
    CONTENT: Maintenance reminder, current specials
    OFFER: 10% returning customer discount`
  },
  {
    id: 'scheduling',
    label: 'Scheduling Rules',
    title: 'Intelligent Scheduling Logic',
    description: 'Location-aware booking that maximizes efficiency',
    rules: [
      'Service area radius enforced (default 25 miles, configurable)',
      'Minimum job value for outside-area trips',
      'Time slot optimization based on existing route',
      'Buffer time between jobs (travel + prep)',
      'No double-booking with conflict detection',
      'Weather-aware time slot filtering'
    ],
    code: `WHEN booking_request RECEIVED:
  CHECK service_area:
    IF distance_from_base > config.max_radius:
      IF job_value >= config.min_outside_area_value:
        APPLY surcharge(distance)
        SHOW available_slots
      ELSE:
        SUGGEST minimum_package OR different_day
        
  CALCULATE available_slots:
    FOR each day IN next_14_days:
      GET existing_appointments(day)
      CALCULATE drive_time(last_job.location -> new_location)
      ADD buffer_time(X min)
      
      IF total_duration fits IN calendar_gap:
        CHECK weather_forecast(day)
        IF outdoor_service AND rain_probability > 60%:
          SKIP this slot
        ELSE:
          ADD to available_slots
          
    SORT available_slots BY (
      route_optimization_score DESC,
      customer_preference ASC
    )
    RETURN top_3_slots`
  },
  {
    id: 'weather',
    label: 'Weather Policies',
    title: 'Weather-Aware Operations',
    description: 'Automatic rescheduling based on forecast conditions',
    rules: [
      'Check forecast 24 hours before outdoor appointments',
      'Offer indoor alternatives (garage, covered area)',
      'Automatic reschedule with customer consent',
      'No-penalty cancellation for heavy rain/snow',
      'Priority rebooking for weather cancellations'
    ],
    code: `SCHEDULE daily_weather_check AT 8am:
  FOR each appointment IN next_48_hours:
    IF appointment.location_type == "outdoor":
      forecast = GET weather_forecast(appointment.location, appointment.time)
      
      IF forecast.rain_probability > 70%:
        SEND_SMS(customer):
          "Weather looks rough for [date]. Three options:
           1. Move indoors (garage/carport)
           2. Reschedule (no penalty)
           3. Brave it together 💪"
          
        AWAIT customer_response(timeout: 6h)
        
        MATCH customer_choice:
          "indoor":
            UPDATE appointment.notes = "Indoor location"
            SEND "Perfect! See you then."
          "reschedule":
            PROPOSE alternative_slots(priority: high)
            WAIVE any_change_fees
          "continue":
            ADD note: "Customer confirmed despite weather"
            
      ELSE IF forecast.rain_probability > 40%:
        SEND "Small chance of rain [date]. We'll monitor and update you!"`
  },
  {
    id: 'upsell',
    label: 'Upsell Logic',
    title: 'Intelligent Upsell Engine',
    description: 'Context-aware recommendations that add value',
    rules: [
      'Package upgrades based on vehicle type and condition',
      'Ceramic coating for luxury vehicles and new cars',
      'Maintenance plans for repeat customers',
      'Seasonal add-ons (winter protection, summer prep)',
      'Post-service follow-up offers based on service history'
    ],
    code: `WHEN booking.service SELECTED:
  ANALYZE context:
    vehicle_age = booking.vehicle.year - current_year
    vehicle_value = LOOKUP(booking.vehicle.make, booking.vehicle.model)
    customer_ltv = CALCULATE(customer.total_spent, customer.frequency)
    
  IF vehicle_value > 40000 OR vehicle_age < 2:
    RECOMMEND ceramic_coating:
      PITCH: "Your [vehicle] deserves the best protection!"
      SHOW: 5-year warranty, before/after results
      DISCOUNT: 15% if_added_today
      
  IF customer.service_count > 3:
    RECOMMEND maintenance_plan:
      PITCH: "Save 20% with quarterly detailing membership"
      SHOW: cost_comparison, priority_scheduling
      
  IF season == "winter" AND location.climate == "cold":
    RECOMMEND undercarriage_protection:
      PITCH: "Salt & snow protection special"
      BUNDLE: "Add for $49 (save $30)"
      
AFTER service.complete:
  WAIT 3_days
  SEND personalized_offer:
    IF interior_only:
      "Complete the transformation? 20% off exterior next visit"
    IF exterior_only:
      "Interior looking tired? Special offer inside..."
    IF full_detail:
      "Maintenance plan = keep this shine year-round"`
  }
];

export function AutomationLogicSection() {
  const [activeType, setActiveType] = useState('sms');
  const active = automationTypes.find(t => t.id === activeType) || automationTypes[0];

  return (
    <section id="automation-logic" className="py-24 relative bg-gradient-to-b from-transparent via-blue-950/20 to-transparent">
      <div className="container mx-auto px-4">
        <SectionHeader
          badge="Under the Hood"
          title="Automation Logic"
          subtitle="See exactly how Clean Machine makes smart decisions for your business"
        />

        <PillTabs
          tabs={automationTypes.map(t => ({ id: t.id, label: t.label }))}
          activeTab={activeType}
          onChange={setActiveType}
          className="mb-16"
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 gap-8 items-start"
          >
            {/* Left: Human-readable rules */}
            <div className="space-y-6">
              <div>
                <h3 className="text-3xl font-bold text-white mb-3">{active.title}</h3>
                <p className="text-lg text-blue-200">{active.description}</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xl font-semibold text-white">How It Works:</h4>
                {active.rules.map((rule, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                      {i + 1}
                    </div>
                    <p className="text-blue-100">{rule}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: Pseudo-code */}
            <div className="sticky top-8">
              <CodeBlock
                code={active.code}
                language="pseudo"
                title="Logic Flow (Simplified)"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
