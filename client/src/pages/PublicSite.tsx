import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Mail, 
  MapPin, 
  Phone, 
  Sparkles,
  Star,
  Gift,
  Trophy
} from 'lucide-react';

interface PublicSiteData {
  tenant: {
    id: string;
    subdomain: string;
    businessName: string;
    city?: string | null;
    planTier: string;
    status: string;
    industry?: string | null;
    industryPackId?: string | null;
  };
  branding: {
    primaryColor?: string | null;
    accentColor?: string | null;
    logoUrl?: string | null;
  };
  websiteContent: {
    heroHeadline: string;
    heroSubheadline: string;
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
    aboutBlurb: string;
  };
  services: Array<{
    id: number;
    name: string;
    description?: string | null;
    category?: string | null;
    startingPrice?: number | null;
    durationMinutes?: number | null;
    isAddon?: boolean | null;
    highlight?: boolean | null;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  featureFlags: {
    showWatermark: boolean;
    canShowBookingForm: boolean;
    canShowAdvancedSections: boolean;
  };
}

export default function PublicSite() {
  const [match, params] = useRoute('/site/:subdomain');
  const subdomain = params?.subdomain;

  // Fetch public site data
  const { data, isLoading, error } = useQuery<{ success: boolean; data: PublicSiteData }>({
    queryKey: ['/api/public/site', subdomain],
    enabled: !!subdomain,
  });

  const [contactFormData, setContactFormData] = useState({
    name: '',
    phone: '',
    message: '',
  });

  const siteData = data?.data;

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get branding colors or use defaults
  const primaryColor = siteData?.branding?.primaryColor || '#6366f1';
  const accentColor = siteData?.branding?.accentColor || '#a855f7';

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-cyan-50/30 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Loading...</p>
        </motion.div>
      </div>
    );
  }

  // Error state - 404 or failure
  if (error || !siteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/20 to-orange-50/30 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-4xl">🔍</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Site Not Found</h1>
          <p className="text-slate-600 mb-6">
            The website you're looking for doesn't exist or is no longer available.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
        </motion.div>
      </div>
    );
  }

  const { tenant, websiteContent, services, faqs, featureFlags } = siteData;

  // Get initials for avatar fallback
  const initials = tenant.businessName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-cyan-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {siteData.branding.logoUrl ? (
              <img src={siteData.branding.logoUrl} alt={tenant.businessName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div 
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
              >
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-900">{tenant.businessName}</h1>
              {tenant.city && (
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {tenant.city}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            style={{ backgroundColor: primaryColor }}
            className="text-white hover:opacity-90"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            data-testid="header-cta-button"
          >
            {websiteContent.primaryCtaLabel}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="relative overflow-hidden py-20 sm:py-32"
        data-testid="hero-section"
      >
        {/* Background gradient blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: primaryColor }}
          />
          <div
            className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: accentColor }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            variants={fadeIn}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 shadow-sm mb-8"
          >
            <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-slate-700">
              {tenant.industry || 'Professional Service'}
            </span>
          </motion.div>

          <motion.h2
            variants={fadeIn}
            transition={{ delay: 0.3 }}
            className="text-4xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight"
            data-testid="hero-headline"
          >
            {websiteContent.heroHeadline}
          </motion.h2>

          <motion.p
            variants={fadeIn}
            transition={{ delay: 0.4 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            data-testid="hero-subheadline"
          >
            {websiteContent.heroSubheadline}
          </motion.p>

          <motion.div
            variants={fadeIn}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              style={{ backgroundColor: primaryColor }}
              className="text-white hover:opacity-90 shadow-lg"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="hero-primary-cta"
            >
              <Calendar className="w-5 h-5 mr-2" />
              {websiteContent.primaryCtaLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="hero-secondary-cta"
            >
              {websiteContent.secondaryCtaLabel}
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Services Section */}
      {services && services.length > 0 && (
        <section id="services" className="py-20 px-4 sm:px-6 lg:px-8" data-testid="services-section">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
              className="text-center mb-12"
            >
              <h3 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Our Services</h3>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Professional {tenant.industry || 'services'} tailored to your needs
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {services.slice(0, 6).map((service, index) => (
                <motion.div key={service.id} variants={fadeIn} data-testid={`service-card-${service.id}`}>
                  <Card className="h-full backdrop-blur-sm bg-white/70 border-white/40 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${accentColor}20)` }}
                        >
                          <CheckCircle2 className="w-6 h-6" style={{ color: primaryColor }} />
                        </div>
                        {service.highlight && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            <Star className="w-3 h-3 fill-current" />
                            Popular
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-xl" data-testid={`service-name-${service.id}`}>{service.name}</CardTitle>
                      {service.category && (
                        <CardDescription className="text-sm">{service.category}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {service.description && (
                        <p className="text-slate-600 text-sm mb-4 line-clamp-3" data-testid={`service-description-${service.id}`}>
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        {service.startingPrice && (
                          <span className="font-semibold text-slate-900" data-testid={`service-price-${service.id}`}>
                            From ${(service.startingPrice / 100).toFixed(0)}
                          </span>
                        )}
                        {service.durationMinutes && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Clock className="w-4 h-4" />
                            ~{Math.round(service.durationMinutes / 60)}h
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" data-testid="about-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
          className="max-w-4xl mx-auto"
        >
          <Card className="backdrop-blur-md bg-gradient-to-br from-white/80 to-white/60 border-white/40 shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-center">About Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 text-lg leading-relaxed text-center" data-testid="about-blurb">
                {websiteContent.aboutBlurb}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Rewards Program Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50/50 to-pink-50/50" data-testid="rewards-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
          className="max-w-4xl mx-auto"
        >
          <Card className="backdrop-blur-md bg-gradient-to-br from-white/90 to-purple-50/60 border-purple-200/40 shadow-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 pointer-events-none" />
            <CardHeader className="text-center relative">
              <div className="flex justify-center mb-4">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                >
                  <Gift className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-3xl mb-2">Rewards Program</CardTitle>
              <CardDescription className="text-base max-w-lg mx-auto">
                Earn points on every service and unlock exclusive rewards! Check your balance and see available offers.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pb-8">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4" style={{ color: primaryColor }} />
                    <span>Earn points</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" style={{ color: accentColor }} />
                    <span>Unlock rewards</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1">
                    <Gift className="w-4 h-4" style={{ color: primaryColor }} />
                    <span>Redeem perks</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <Button
                  size="lg"
                  className="text-white hover:opacity-90 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                  onClick={() => window.location.href = '/rewards'}
                  data-testid="rewards-cta-button"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  Check My Rewards
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* FAQ Section */}
      {faqs && faqs.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/30" data-testid="faq-section">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
              className="text-center mb-12"
            >
              <h3 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Frequently Asked Questions
              </h3>
              <p className="text-slate-600">Get answers to common questions</p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
            >
              <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((faq, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`faq-${index}`}
                    className="backdrop-blur-sm bg-white/70 border border-white/40 rounded-xl px-6 shadow-sm"
                    data-testid={`faq-item-${index}`}
                  >
                    <AccordionTrigger className="text-left font-semibold text-slate-900 hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-2">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>
      )}

      {/* Contact / CTA Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8" data-testid="contact-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
          className="max-w-2xl mx-auto"
        >
          <Card className="backdrop-blur-md bg-gradient-to-br from-white/90 to-white/70 border-white/40 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-2">
                {featureFlags.canShowBookingForm ? 'Ready to Book?' : 'Get in Touch'}
              </CardTitle>
              <CardDescription className="text-base">
                {featureFlags.canShowBookingForm
                  ? 'Tell us about your project and we\'ll get back to you right away'
                  : 'Request a quote and we\'ll contact you soon'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" data-testid="contact-form">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={contactFormData.name}
                    onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-offset-2 outline-none"
                    style={{ focusRing: primaryColor }}
                    placeholder="Your name"
                    data-testid="input-contact-name"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-offset-2 outline-none"
                    style={{ focusRing: primaryColor }}
                    placeholder="(555) 123-4567"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    value={contactFormData.message}
                    onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-offset-2 outline-none resize-none"
                    style={{ focusRing: primaryColor }}
                    placeholder="Tell us about your project..."
                    data-testid="input-contact-message"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                  data-testid="button-submit-contact"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center gap-3">
              {siteData.branding.logoUrl ? (
                <img src={siteData.branding.logoUrl} alt={tenant.businessName} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                >
                  {initials}
                </div>
              )}
              <h4 className="text-lg font-semibold">{tenant.businessName}</h4>
            </div>

            {tenant.city && (
              <p className="text-slate-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Serving {tenant.city} and surrounding areas
              </p>
            )}

            <div className="pt-6 border-t border-slate-800 w-full text-center">
              <p className="text-slate-500 text-sm">
                © {new Date().getFullYear()} {tenant.businessName}. All rights reserved.
              </p>
            </div>

            {/* Free Tier Watermark */}
            {featureFlags.showWatermark && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="pt-4"
                data-testid="watermark-free-tier"
              >
                <a
                  href="https://servicepro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-sm text-slate-400 hover:text-slate-300"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Powered by ServicePro</span>
                  <span className="text-xs opacity-60">• Upgrade to remove this</span>
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
