import { useQuery } from "@tanstack/react-query";
import type { HomepageContent } from "@shared/schema";
import { getTemplate } from "@/lib/homeTemplates";
import { motion, AnimatePresence } from "framer-motion";
import SophisticatedAnimatedLogo from "@/components/SophisticatedAnimatedLogo";

import CurrentTemplate from "@/pages/templates/CurrentTemplate";
import LuminousConcierge from "@/pages/templates/LuminousConcierge";
import DynamicSpotlight from "@/pages/templates/DynamicSpotlight";
import PrestigeGrid from "@/pages/templates/PrestigeGrid";
import NightDriveNeon from "@/pages/templates/NightDriveNeon";
import ExecutiveMinimal from "@/pages/templates/ExecutiveMinimal";
import QuantumConcierge from "@/pages/templates/QuantumConcierge";

const TEMPLATE_COMPONENTS: Record<string, React.ComponentType> = {
  current: CurrentTemplate,
  luminous_concierge: LuminousConcierge,
  dynamic_spotlight: DynamicSpotlight,
  prestige_grid: PrestigeGrid,
  night_drive_neon: NightDriveNeon,
  executive_minimal: ExecutiveMinimal,
  quantum_concierge: QuantumConcierge,
};

function PremiumLoadingSkeleton() {
  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white overflow-hidden relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/30 to-indigo-950/20 animate-gradient-slow"></div>
      </div>
      
      {/* Premium background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[10%] right-[20%] w-64 h-64 bg-blue-600/5 rounded-full filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
        {/* Animated Logo */}
        <div className="mb-2 pt-16">
          <SophisticatedAnimatedLogo />
        </div>

        {/* Content skeleton with subtle animations */}
        <div className="py-6 text-center space-y-8">
          {/* Text skeleton */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-3/4 max-w-3xl bg-blue-100/10 rounded-lg animate-pulse"></div>
            <div className="h-6 w-2/3 max-w-2xl bg-blue-100/10 rounded-lg animate-pulse" style={{ animationDelay: '0.1s' }}></div>
          </div>

          {/* Button skeletons */}
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="h-14 w-64 bg-blue-600/20 rounded-lg animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="h-12 w-48 bg-green-600/20 rounded-lg animate-pulse" style={{ animationDelay: '0.3s' }}></div>
          </div>

          {/* Feature buttons grid */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto pt-4">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className="h-12 bg-blue-600/10 rounded-md animate-pulse"
                style={{ animationDelay: `${0.4 + i * 0.1}s` }}
              ></div>
            ))}
          </div>
        </div>

        {/* Loading indicator */}
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-blue-200/60 text-sm font-light">Preparing your experience...</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const { data, isLoading } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
    staleTime: 60000, // Cache for 1 minute to prevent flashing on navigation
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
  });

  const templateId = data?.content?.templateId || 'current';
  const TemplateComponent = TEMPLATE_COMPONENTS[templateId] || CurrentTemplate;

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <PremiumLoadingSkeleton key="loading" />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <TemplateComponent content={data?.content} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
