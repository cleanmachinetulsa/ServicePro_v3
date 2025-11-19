import { useEffect } from 'react';
import { ShowcaseLayout } from '@/components/showcase/ShowcaseLayout';
import { StickyNav } from '@/components/showcase/StickyNav';
import { HeroSection } from '@/components/showcase/sections/HeroSection';
import { FeatureMapSection } from '@/components/showcase/sections/FeatureMapSection';
import { FlowsSection } from '@/components/showcase/sections/FlowsSection';
import { AutomationLogicSection } from '@/components/showcase/sections/AutomationLogicSection';
import { ExperienceSection } from '@/components/showcase/sections/ExperienceSection';
import { MetricsSection } from '@/components/showcase/sections/MetricsSection';
import { WhiteLabelSection } from '@/components/showcase/sections/WhiteLabelSection';
import { FaqSection } from '@/components/showcase/sections/FaqSection';
import { SandboxSection } from '@/components/showcase/sandbox/SandboxSection';
import { ShowcaseProvider } from '@/contexts/ShowcaseContext';

export default function Showcase() {
  useEffect(() => {
    // Set page title
    document.title = 'Clean Machine Showcase - The Brain of Your Detailing Business';
    
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <ShowcaseProvider>
      <ShowcaseLayout>
      <StickyNav />
      
      <HeroSection />
      
      <FeatureMapSection />
      
      <FlowsSection />
      
      <AutomationLogicSection />
      
      <ExperienceSection />
      
      <MetricsSection />
      
      <WhiteLabelSection />
      
      <FaqSection />
      
      <SandboxSection />
      
      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-blue-200/70 text-sm">
            © {new Date().getFullYear()} Clean Machine. Built for service excellence.
          </p>
        </div>
      </footer>
    </ShowcaseLayout>
    </ShowcaseProvider>
  );
}
