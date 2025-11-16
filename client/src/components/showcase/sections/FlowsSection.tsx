import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { MessageSquare, Calendar, MapPin, CheckCircle, Bell, Code2 } from 'lucide-react';
import { useState } from 'react';

const flowSteps = [
  {
    number: 1,
    title: 'Customer Contacts',
    description: 'SMS or call comes in from new or existing customer',
    logic: 'Service area validation',
    icon: MessageSquare,
    color: 'from-blue-500 to-cyan-500',
    codeSnippet: `IF customer.location IN service_area:
  SEND welcome_message
ELSE:
  OFFER alternate_options`
  },
  {
    number: 2,
    title: 'Details Collected',
    description: 'Vehicle type, service needs, and location captured',
    logic: 'Calendar + location matching',
    icon: Calendar,
    color: 'from-purple-500 to-pink-500',
    codeSnippet: `GET available_slots(location, service_duration)
OPTIMIZE for drive_time
PROPOSE top_3_slots`
  },
  {
    number: 3,
    title: 'Appointment Confirmed',
    description: 'Time slot selected, booking created, tech assigned',
    logic: 'Route optimization',
    icon: MapPin,
    color: 'from-green-500 to-emerald-500',
    codeSnippet: `CREATE appointment
ASSIGN tech_by_location
CALCULATE optimal_route
SEND confirmation_sms`
  },
  {
    number: 4,
    title: 'Job Completed',
    description: 'Service finished, photos uploaded, payment collected',
    logic: 'Review request trigger',
    icon: CheckCircle,
    color: 'from-yellow-500 to-orange-500',
    codeSnippet: `MARK job_complete
SEND thank_you_message
SCHEDULE review_request(+2 hours)
UPDATE customer_history`
  },
  {
    number: 5,
    title: 'Follow-Up Cadence',
    description: 'Seasonal reminders, maintenance alerts, special offers',
    logic: 'Upsell intelligence',
    icon: Bell,
    color: 'from-indigo-500 to-purple-500',
    codeSnippet: `IF days_since_service > 90:
  SEND maintenance_reminder
IF vehicle_type == "luxury":
  OFFER ceramic_coating`
  }
];

export function FlowsSection() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  return (
    <section id="flows" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <SectionHeader
          badge="Customer Journey"
          title="Real-World Flow"
          subtitle="From first contact to loyal customer - automated every step of the way"
        />

        {/* Desktop: Horizontal scroll */}
        <div className="hidden md:flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide">
          {flowSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onHoverStart={() => setHoveredStep(i)}
                onHoverEnd={() => setHoveredStep(null)}
                className="snap-start flex-shrink-0 w-80 relative"
              >
                <div className={`bg-gradient-to-br ${step.color} opacity-20 absolute inset-0 rounded-2xl blur-2xl ${hoveredStep === i ? 'opacity-40' : ''} transition-opacity`} />
                
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-6 h-full hover:border-white/40 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-xl`}>
                      {step.number}
                    </div>
                    <Icon className="w-8 h-8 text-blue-400" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-blue-200 mb-4">{step.description}</p>
                  
                  <div className="inline-block px-3 py-1 bg-white/10 rounded-full border border-white/20 mb-4">
                    <span className="text-xs text-blue-300 flex items-center gap-1">
                      <Code2 className="w-3 h-3" />
                      {step.logic}
                    </span>
                  </div>

                  {/* Code snippet on hover */}
                  <AnimatePresence>
                    {hoveredStep === i && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 bg-slate-900/80 rounded-lg p-3 border border-blue-500/20 overflow-hidden"
                      >
                        <pre className="text-xs text-blue-200 font-mono overflow-x-auto">
                          {step.codeSnippet}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Connector arrow */}
                {i < flowSteps.length - 1 && (
                  <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Mobile: Vertical stack */}
        <div className="md:hidden space-y-6">
          {flowSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className={`bg-gradient-to-br ${step.color} opacity-20 absolute inset-0 rounded-2xl blur-2xl`} />
                
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0`}>
                      {step.number}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white">{step.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Icon className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-blue-300">{step.logic}</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-blue-200 mb-3">{step.description}</p>
                  
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-blue-500/20">
                    <pre className="text-xs text-blue-200 font-mono overflow-x-auto">
                      {step.codeSnippet}
                    </pre>
                  </div>
                </div>

                {/* Connector */}
                {i < flowSteps.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500/50 to-transparent" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
