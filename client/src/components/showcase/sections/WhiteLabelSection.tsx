import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useShowcase } from '@/contexts/ShowcaseContext';

export function WhiteLabelSection() {
  const { trialModalOpen, openTrialModal, closeTrialModal } = useShowcase();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const benefits = [
    'Fully white-labeled with your branding and colors',
    'Handles SMS, email, and scheduling automatically',
    'Works for detailing, lawn care, home cleaning, and more',
    'No long-term contracts - cancel anytime',
    '14-day free trial to test it with your business'
  ];

  const industries = [
    'Auto Detailing',
    'Lawn Care',
    'House Cleaning',
    'Pool Service',
    'Pet Grooming',
    'Plumbing',
    'HVAC',
    'Landscaping',
    'Other'
  ];

  const handleSubmit = async () => {
    if (!email || !industry) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both email and industry',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/leads/trial-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, industry })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubmitted(true);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to submit request',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
                className="text-xl text-blue-100 mb-4"
              >
                This platform powers service businesses of all types
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-white/20 rounded-full mb-8"
              >
                <Sparkles className="h-4 w-4 text-purple-300" />
                <span className="text-sm text-purple-100 font-medium">
                  ServicePro Multi-Tenant Transformation Ready
                </span>
              </motion.div>
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
                onClick={openTrialModal}
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

      {/* Lead Capture Modal */}
      <Dialog open={trialModalOpen} onOpenChange={(open) => {
        if (open) {
          openTrialModal();
        } else {
          closeTrialModal();
          setTimeout(() => {
            setSubmitted(false);
            setEmail('');
            setIndustry('');
          }, 300);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          {!submitted ? (
            <>
              <DialogHeader>
                <DialogTitle>Start Your Free Trial</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we'll reach out to get you set up right away!
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-trial-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="industry">What industry do you work in? *</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger id="industry" data-testid="select-trial-industry">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full"
                  data-testid="button-submit-trial"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Thank You!</h3>
                <p className="text-muted-foreground">
                  We'll reach out with onboarding info shortly!
                </p>
              </div>
              <Button onClick={closeTrialModal} className="mt-4">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
