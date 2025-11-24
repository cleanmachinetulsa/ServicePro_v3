import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, X, Sparkles, Zap, Crown, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  priceSuffix?: string;
  recommended?: boolean;
  highlight?: boolean;
  bulletPoints: string[];
  maxUsers?: number | null;
  usageNotes?: string | null;
}

interface PricingFeature {
  key: string;
  label: string;
  description?: string;
  category?: string;
  planAccess: Record<string, boolean>;
}

interface PricingResponse {
  success: boolean;
  plans: PricingPlan[];
  features: PricingFeature[];
  marketing: {
    headline: string;
    subheadline: string;
    finePrint?: string;
  };
}

export default function PricingPage() {
  const { data, isLoading, error } = useQuery<PricingResponse>({
    queryKey: ['/api/public/pricing'],
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-2xl font-bold text-white mb-2">Unable to load pricing</h2>
          <p className="text-gray-300">Please try again later</p>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-16 w-3/4 mx-auto mb-4 bg-white/10" />
          <Skeleton className="h-8 w-1/2 mx-auto mb-12 bg-white/10" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[600px] bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { plans, features, marketing } = data;

  // Icon mapping for tiers
  const tierIcons: Record<string, typeof Gift> = {
    free: Gift,
    starter: Sparkles,
    pro: Zap,
    elite: Crown,
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 100 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Hero section */}
      <div className="relative z-10 pt-20 pb-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-white">
            {marketing.headline}
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4">
            {marketing.subheadline}
          </p>
          {marketing.finePrint && (
            <p className="text-sm text-gray-400 max-w-2xl mx-auto">
              {marketing.finePrint}
            </p>
          )}
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
        >
          {plans.map((plan) => {
            const Icon = tierIcons[plan.id] || Sparkles;
            const isRecommended = plan.recommended || plan.highlight;

            return (
              <motion.div
                key={plan.id}
                variants={cardVariants}
                whileHover={{ scale: 1.05, y: -10 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="relative"
                data-testid={`pricing-card-${plan.id}`}
              >
                {/* Recommended badge */}
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                <Card
                  className={`
                    h-full relative overflow-hidden backdrop-blur-lg border-2 transition-all duration-300
                    ${isRecommended 
                      ? 'bg-white/20 border-purple-400/50 shadow-2xl shadow-purple-500/50' 
                      : 'bg-white/10 border-white/20 shadow-xl'}
                  `}
                >
                  {/* Glass effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                  <div className="relative p-8">
                    {/* Icon */}
                    <div className={`
                      w-16 h-16 rounded-2xl flex items-center justify-center mb-6
                      ${isRecommended 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                        : 'bg-gradient-to-br from-gray-700 to-gray-800'}
                    `}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    {/* Plan name and tagline */}
                    <h3 className="text-3xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-300 text-sm mb-6 h-12">{plan.tagline}</p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold text-white">
                          ${plan.monthlyPrice}
                        </span>
                        {plan.priceSuffix && (
                          <span className="text-gray-400 text-lg">{plan.priceSuffix}</span>
                        )}
                      </div>
                      {plan.maxUsers && (
                        <p className="text-sm text-gray-400 mt-2">
                          Up to {plan.maxUsers} {plan.maxUsers === 1 ? 'user' : 'users'}
                        </p>
                      )}
                      {plan.maxUsers === null && (
                        <p className="text-sm text-gray-400 mt-2">Unlimited users</p>
                      )}
                    </div>

                    {/* CTA Button */}
                    <Button
                      className={`
                        w-full mb-8 font-semibold text-lg py-6
                        ${isRecommended
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                          : 'bg-white/20 hover:bg-white/30 text-white border-2 border-white/30'}
                      `}
                      data-testid={`button-cta-${plan.id}`}
                    >
                      {plan.id === 'free' ? 'Start Free' : plan.id === 'elite' ? 'Contact Us' : 'Start Trial'}
                    </Button>

                    {/* Features */}
                    <div className="space-y-3 mb-6">
                      {plan.bulletPoints.map((point, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-200 text-sm">{point}</span>
                        </div>
                      ))}
                    </div>

                    {/* Usage notes */}
                    {plan.usageNotes && (
                      <p className="text-xs text-gray-400 italic border-t border-white/10 pt-4">
                        {plan.usageNotes}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Feature comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-7xl mx-auto"
        >
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Compare Plans
          </h2>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border-2 border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-6 text-white font-semibold min-w-[300px]">
                      Feature
                    </th>
                    {plans.map(plan => (
                      <th
                        key={plan.id}
                        className={`
                          p-6 text-center font-semibold min-w-[120px]
                          ${plan.recommended ? 'bg-purple-500/20 text-purple-200' : 'text-gray-300'}
                        `}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, idx) => (
                    <tr
                      key={feature.key}
                      className={`
                        border-b border-white/10 transition-colors hover:bg-white/5
                        ${idx % 2 === 0 ? 'bg-white/5' : ''}
                      `}
                      data-testid={`feature-row-${feature.key}`}
                    >
                      <td className="p-6">
                        <div className="text-white font-medium">{feature.label}</div>
                        {feature.description && (
                          <div className="text-sm text-gray-400 mt-1">{feature.description}</div>
                        )}
                      </td>
                      {plans.map(plan => {
                        const hasFeature = feature.planAccess[plan.id];
                        return (
                          <td
                            key={plan.id}
                            className={`
                              p-6 text-center
                              ${plan.recommended ? 'bg-purple-500/10' : ''}
                            `}
                          >
                            {hasFeature ? (
                              <Check className="w-6 h-6 text-green-400 mx-auto" data-testid={`check-${feature.key}-${plan.id}`} />
                            ) : (
                              <X className="w-6 h-6 text-gray-600 mx-auto" data-testid={`cross-${feature.key}-${plan.id}`} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-center mt-16 mb-8"
        >
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Not sure which plan is right for you? Start with the free tier and upgrade anytime as your business grows.
          </p>
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-lg px-8 py-6"
            data-testid="button-start-free"
          >
            Get Started Free
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
