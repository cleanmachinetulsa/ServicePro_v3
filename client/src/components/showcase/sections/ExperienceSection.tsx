import { motion } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { GlassCard } from '../shared/GlassCard';
import { Smartphone, Users2, MessageCircle, Calendar, MapPin, Star } from 'lucide-react';

export function ExperienceSection() {
  return (
    <section id="experience" className="py-24 relative">
      <div className="container mx-auto px-4">
        <SectionHeader
          badge="Built for Everyone"
          title="Experience Highlights"
          subtitle="Delightful for customers, powerful for your team"
        />

        <div className="grid md:grid-cols-2 gap-12">
          {/* For Customers */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-xl border border-green-500/30">
                <Smartphone className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-3xl font-bold text-white">For Customers</h3>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: MessageCircle,
                  title: 'Smooth Booking',
                  desc: 'Text to book, no phone calls or forms needed',
                  color: 'from-blue-500/10 to-cyan-500/10'
                },
                {
                  icon: Calendar,
                  title: 'Smart Confirmations',
                  desc: 'Automatic reminders with weather updates',
                  color: 'from-purple-500/10 to-pink-500/10'
                },
                {
                  icon: MapPin,
                  title: 'Live ETAs',
                  desc: '"15 minutes away!" notifications',
                  color: 'from-green-500/10 to-emerald-500/10'
                },
                {
                  icon: Star,
                  title: 'Friendly Language',
                  desc: 'Professional but warm, never robotic',
                  color: 'from-yellow-500/10 to-orange-500/10'
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ x: 10, scale: 1.02 }}
                  className={`bg-gradient-to-br ${item.color} backdrop-blur-sm border border-white/10 rounded-xl p-5 cursor-pointer group`}
                >
                  <div className="flex items-start gap-4">
                    <item.icon className="w-6 h-6 text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-blue-200">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Sample customer message mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mt-8 bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6"
            >
              <div className="space-y-3">
                <div className="bg-white/10 rounded-2xl rounded-tl-none p-4 max-w-xs">
                  <p className="text-sm text-blue-100">"Hey, can I get a detail this week?"</p>
                </div>
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl rounded-tr-none p-4 max-w-xs ml-auto">
                  <p className="text-sm text-white">"Absolutely! I've got Thursday at 2pm or Friday at 10am. Which works better for you?"</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* For Team */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-xl border border-blue-500/30">
                <Users2 className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-3xl font-bold text-white">For Your Team</h3>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: Calendar,
                  title: "Today's Schedule",
                  desc: 'All jobs with one-tap navigation to each location',
                  color: 'from-indigo-500/10 to-blue-500/10'
                },
                {
                  icon: Users2,
                  title: 'Customer History',
                  desc: 'Every past service, vehicle, and preference at a glance',
                  color: 'from-purple-500/10 to-indigo-500/10'
                },
                {
                  icon: MessageCircle,
                  title: 'One-Tap Templates',
                  desc: '"Running late", "On the way", "All done" in one click',
                  color: 'from-cyan-500/10 to-blue-500/10'
                },
                {
                  icon: MapPin,
                  title: 'Weather Helpers',
                  desc: 'Automatic rain alerts with reschedule options',
                  color: 'from-orange-500/10 to-red-500/10'
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ x: -10, scale: 1.02 }}
                  className={`bg-gradient-to-br ${item.color} backdrop-blur-sm border border-white/10 rounded-xl p-5 cursor-pointer group`}
                >
                  <div className="flex items-start gap-4">
                    <item.icon className="w-6 h-6 text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-blue-200">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Sample tech interface mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mt-8 bg-gradient-to-br from-indigo-900/40 to-blue-900/40 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">Today's Jobs</span>
                  <span className="text-blue-300 text-sm">5 appointments</span>
                </div>
                <div className="space-y-2">
                  {['10:00 AM - John Smith', '12:30 PM - Sarah Johnson', '3:00 PM - Mike Davis'].map((job, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-blue-100">{job}</span>
                      <button className="px-3 py-1 bg-blue-600 rounded-lg text-xs text-white">Navigate</button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
