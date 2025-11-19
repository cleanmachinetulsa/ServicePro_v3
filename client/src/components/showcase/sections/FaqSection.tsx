import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { ChevronDown, Phone, Wrench, Rocket, HelpCircle, DollarSign, ArrowRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShowcase } from '@/contexts/ShowcaseContext';

const faqs = [
  {
    icon: Phone,
    question: 'Can it work with my existing phone number?',
    answer: 'Yes! Clean Machine integrates with Twilio, which means you can either port your existing number or get a new local number. All SMS and calls route through the platform, and you keep full control.'
  },
  {
    icon: Wrench,
    question: 'Is it only for car detailing?',
    answer: 'Not at all. While we built it for mobile detailing, the platform works for any service business: lawn care, house cleaning, HVAC, plumbing, dog grooming, mobile mechanics - anything with appointments and customer communication.'
  },
  {
    icon: Rocket,
    question: 'How hard is it to get started?',
    answer: 'We handle the heavy lifting. You provide your business info, phone number, and service menu. We configure the AI, set up your messaging, and train you on the system. Most businesses are live within 3-5 days.'
  },
  {
    icon: HelpCircle,
    question: 'What if I\'m not techy?',
    answer: 'Perfect - you don\'t need to be! The interface is designed for mobile use (think: simple as texting). We provide training videos, live onboarding, and ongoing support. If you can use a smartphone, you can use Clean Machine.'
  },
  {
    icon: DollarSign,
    question: 'How does pricing work?',
    answer: 'Simple monthly subscription based on your message volume and features. Starts at $99/month for solopreneurs, scales with your team size. 14-day free trial, no contracts, cancel anytime. We also handle Twilio costs (SMS/calls) for you.'
  },
  {
    icon: MessageSquare,
    question: 'Will my customers know it\'s automated?',
    answer: 'They won\'t notice - and that\'s the point. The AI sounds natural and helpful. For complex questions or sensitive situations, it notifies you to take over manually. You can also disable AI anytime and handle everything yourself.'
  }
];

export function FaqSection() {
  const { openTrialModal } = useShowcase();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 relative">
      <div className="container mx-auto px-4 max-w-4xl">
        <SectionHeader
          badge="Questions Answered"
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about Clean Machine"
        />

        <div className="space-y-4 mb-12">
          {faqs.map((faq, i) => {
            const Icon = faq.icon;
            const isOpen = openIndex === i;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden hover:border-white/40 transition-all duration-300"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full p-6 flex items-start gap-4 text-left hover:bg-white/5 transition-colors"
                  data-testid={`faq-button-${i}`}
                >
                  <div className="p-2 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-lg flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1 pr-8">
                      {faq.question}
                    </h3>
                  </div>

                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-blue-400" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pl-20">
                        <p className="text-blue-100 leading-relaxed">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Final CTA Strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 backdrop-blur-xl border border-white/30 rounded-2xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to See Clean Machine in Action?
          </h3>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Try the interactive sandbox below or start your free trial today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-full"
              data-testid="button-sandbox"
              onClick={() => document.getElementById('sandbox')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Try the Sandbox
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={openTrialModal}
              className="border-2 border-blue-400/50 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white px-8 py-6 text-lg rounded-full"
              data-testid="button-start-trial"
            >
              Start Free Trial
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
