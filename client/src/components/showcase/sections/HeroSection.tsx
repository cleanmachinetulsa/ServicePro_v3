import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Sparkles, Rocket, CheckCircle, AlertTriangle, MessageSquare, Calendar, DollarSign, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export function HeroSection() {
  const [mockStep, setMockStep] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    const timer = setInterval(() => {
      setMockStep((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const mockSteps = [
    { text: 'Incoming SMS from (555) 123-4567', type: 'incoming' },
    { text: 'Auto-reply: "Thanks for reaching out! What are we working on today?"', type: 'outgoing' },
    { text: 'Appointment scheduled for Tuesday 2-4PM', type: 'success' }
  ];

  const handleLaunchDemo = async () => {
    setIsLaunching(true);
    
    try {
      // Check if demo mode is enabled
      const settingsRes = await fetch('/api/admin/demo-settings', {
        credentials: 'include'
      });
      
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        
        if (!settingsData.demoModeEnabled) {
          toast({
            title: "Demo Unavailable",
            description: "The demo mode is currently disabled. Please contact the administrator.",
            variant: "destructive",
          });
          setIsLaunching(false);
          return;
        }
      }
      
      // Start demo session
      const startRes = await fetch('/api/demo/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!startRes.ok) {
        const errorData = await startRes.json();
        throw new Error(errorData.message || 'Failed to start demo');
      }
      
      const data = await startRes.json();
      
      if (data.success) {
        toast({
          title: "Demo Launched!",
          description: "Redirecting to demo environment...",
        });
        
        // Redirect to demo page after a brief delay
        setTimeout(() => {
          setLocation('/demo');
        }, 500);
      } else {
        throw new Error('Failed to initialize demo session');
      }
    } catch (error: any) {
      console.error('Demo launch error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to launch demo. Please try again.",
        variant: "destructive",
      });
      setIsLaunching(false);
    }
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(30,64,175,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(76,29,149,0.15),transparent_50%)]" />
      
      {/* Faint car outline */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" viewBox="0 0 800 600" fill="none">
          <path d="M150 300 L200 250 L350 230 L500 240 L600 270 L650 320 L600 370 L150 370 Z" stroke="currentColor" strokeWidth="2" className="text-blue-300" />
        </svg>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-20 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block mb-6"
        >
          <span className="px-6 py-2 bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-400/40 rounded-full text-blue-200 text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Investor-Ready Marketing Platform
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
        >
          Clean Machine: The Brain of Your
          <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mt-2">
            Detailing Business
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl md:text-2xl text-blue-100 max-w-4xl mx-auto mb-12 leading-relaxed"
        >
          Intelligent scheduling. Automatic SMS & email. Complete customer history. 
          Built for mobile detailers, perfected for service excellence.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Button 
              size="lg"
              onClick={() => setShowDemoModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 relative overflow-hidden group"
              data-testid="button-launch-demo"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              <Rocket className="w-5 h-5 mr-2 relative z-10" />
              <span className="relative z-10">Try Interactive Demo</span>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => document.getElementById('whitelabel')?.scrollIntoView({ behavior: 'smooth' })}
              className="border-2 border-blue-400/50 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white px-8 py-6 text-lg rounded-full transition-all duration-300"
              data-testid="button-see-for-business"
            >
              White-Label Your Brand
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Demo Launch Modal */}
        <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
          <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-slate-900/95 via-blue-950/95 to-indigo-950/95 backdrop-blur-xl border-2 border-blue-400/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <Rocket className="w-6 h-6 text-blue-400" />
                Experience Acme Detailing Demo
              </DialogTitle>
              <DialogDescription className="text-blue-100/80 text-base mt-3">
                Explore a fully functional demo of our white-label auto detailing business management system. 
                This demo uses mock data and showcases all features without affecting real operations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 my-6">
              {/* Features List */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-blue-400/20">
                <h4 className="text-sm font-semibold text-blue-300 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Featured Capabilities
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-100">Multi-channel messaging</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-100">AI chatbot assistant</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-100">Smart scheduling</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-100">Payment processing</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-100">Analytics dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-100">Customer management</span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-200">Demo Mode Active</p>
                  <p className="text-xs text-amber-100/70 mt-1">
                    All changes are simulated and will not be saved. No real messages will be sent.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDemoModal(false)}
                disabled={isLaunching}
                className="border-blue-400/30 bg-white/5 hover:bg-white/10 text-white"
                data-testid="button-cancel-demo"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLaunchDemo}
                disabled={isLaunching}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                data-testid="button-confirm-launch-demo"
              >
                {isLaunching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Launch Demo
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Animated Device Mock */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative">
            {/* Phone frame */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl border border-white/10">
              <div className="bg-slate-950 rounded-2xl p-6 min-h-[300px] flex flex-col justify-center">
                <motion.div
                  key={mockStep}
                  initial={{ opacity: 0, x: mockStep === 0 ? -20 : mockStep === 1 ? 20 : 0, y: mockStep === 2 ? -20 : 0 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className={`p-4 rounded-2xl ${
                    mockStep === 0 ? 'bg-blue-600/20 border border-blue-500/40' :
                    mockStep === 1 ? 'bg-purple-600/20 border border-purple-500/40' :
                    'bg-green-600/20 border border-green-500/40'
                  }`}>
                    <p className={`text-sm md:text-base ${
                      mockStep === 0 ? 'text-blue-200' :
                      mockStep === 1 ? 'text-purple-200' :
                      'text-green-200'
                    }`}>
                      {mockSteps[mockStep].text}
                    </p>
                  </div>
                  
                  {/* Progress indicators */}
                  <div className="flex gap-2 justify-center pt-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          i === mockStep ? 'w-8 bg-blue-500' : 'w-2 bg-blue-500/30'
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
            
            {/* Floating animation effect */}
            <motion.div
              className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator with fade out */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: scrollY < 100 ? 1 : 0,
          y: scrollY < 100 ? 0 : 20 
        }}
        transition={{ delay: 1, duration: 0.3 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-blue-400/50 rounded-full flex items-start justify-center p-2"
        >
          <motion.div className="w-1 h-2 bg-blue-400 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
