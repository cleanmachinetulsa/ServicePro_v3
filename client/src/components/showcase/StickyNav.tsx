import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useShowcase } from '@/contexts/ShowcaseContext';

const navItems = [
  { id: 'hero', label: 'Home' },
  { id: 'feature-map', label: 'Features' },
  { id: 'flows', label: 'Flows' },
  { id: 'automation-logic', label: 'Logic' },
  { id: 'whitelabel', label: 'White Label' },
  { id: 'faq', label: 'FAQ' },
  { id: 'sandbox', label: 'Demo' }
];

export function StickyNav() {
  const [, setLocation] = useLocation();
  const { openTrialModal } = useShowcase();
  const [activeSection, setActiveSection] = useState('hero');
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show nav after scrolling 100px
      setIsVisible(window.scrollY > 100);

      // Update active section based on scroll position
      const sections = navItems.map(item => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(navItems[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Close mobile menu on escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    // Prevent body scroll when mobile menu is open
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-2xl"
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between py-4">
              {/* Back button */}
              <Button
                onClick={() => setLocation('/')}
                variant="ghost"
                size="sm"
                className="text-blue-200 hover:text-white hover:bg-white/10"
                data-testid="button-back-home"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>

              {/* Navigation items */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                      activeSection === item.id
                        ? 'text-white'
                        : 'text-blue-200 hover:text-white hover:bg-white/5'
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    {activeSection === item.id && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Mobile hamburger menu */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                data-testid="button-mobile-menu"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {/* CTA */}
              <Button
                size="sm"
                onClick={openTrialModal}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white hidden lg:block transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
                data-testid="button-nav-cta"
              >
                Start Free Trial
              </Button>
            </div>
          </div>
        </motion.nav>
      )}
      
      {/* Mobile slide-out menu */}
      <AnimatePresence>
        {isVisible && mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              data-testid="mobile-menu-backdrop"
            />
            
            {/* Slide-out drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-xl border-l border-white/20 z-50 md:hidden overflow-y-auto"
              data-testid="mobile-menu-drawer"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-white">Navigation</h3>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Menu items */}
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                        activeSection === item.id
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'text-blue-200 hover:text-white hover:bg-white/10'
                      }`}
                      data-testid={`mobile-nav-${item.id}`}
                    >
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </nav>
                
                {/* CTA in mobile menu */}
                <div className="mt-8 pt-8 border-white/10">
                  <Button
                    onClick={openTrialModal}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    data-testid="button-mobile-cta"
                  >
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
