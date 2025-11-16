import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';

export function WhiteLabelSection() {
  const benefits = [
    'Fully white-labeled with your branding and colors',
    'Handles SMS, email, and scheduling automatically',
    'Works for detailing, lawn care, home cleaning, and more',
    'No long-term contracts - cancel anytime',
    '14-day free trial to test it with your business'
  ];

  return (
    <section id="whitelabel" className="py-24 relative">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 rounded-3xl blur-3xl" />
          
          {/* Card content */}
          <div className="relative bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-2xl border-2 border-white/30 rounded-3xl p-12">
            <div className="text-center mb-8">
              {/* Logo placeholder */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-block mb-6"
              >
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-white/20 to-white/10 border-2 border-dashed border-white/30 rounded-2xl flex items-center justify-center">
                  <span className="text-white/50 text-sm font-medium">Your Logo</span>
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-bold text-white mb-4"
              >
                Want Clean Machine for
                <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-2">
                  Your Service Business?
                </span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-xl text-blue-100 mb-8"
              >
                This platform powers service businesses of all types
              </motion.p>
            </div>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="space-y-3 mb-8"
            >
              {benefits.map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="p-1 bg-gradient-to-br from-green-600/30 to-emerald-600/30 rounded-full">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-blue-100 text-lg">{benefit}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.9 }}
              className="text-center"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 text-lg rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                data-testid="button-free-trial"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start a 14-Day Free Trial
              </Button>
              <p className="text-sm text-blue-200 mt-4">No credit card required • Cancel anytime</p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
