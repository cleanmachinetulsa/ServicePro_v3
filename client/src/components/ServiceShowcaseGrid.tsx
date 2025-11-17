import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { 
  PublicSheetService, 
  PublicSheetAddon, 
  PublicSheetServicesResponse, 
  PublicSheetAddonsResponse 
} from "@shared/schema";

type ServiceItem = PublicSheetService | PublicSheetAddon;

const ServiceShowcaseGrid = () => {
  const [activeTab, setActiveTab] = useState<'main' | 'addon'>('main');

  // Fetch both services and add-ons concurrently using canonical types
  const servicesQuery = useQuery<PublicSheetServicesResponse>({
    queryKey: ['/api/services'],
  });

  const addOnsQuery = useQuery<PublicSheetAddonsResponse>({
    queryKey: ['/api/addon-services'],
  });

  // Wait for both to complete before rendering
  const loading = servicesQuery.isLoading || addOnsQuery.isLoading;
  const error = servicesQuery.error || addOnsQuery.error;
  
  const services = servicesQuery.data?.services || [];
  const addOns = addOnsQuery.data?.addOns || [];

  const displayedItems = activeTab === 'main' ? services : addOns;

  if (loading) {
    return (
      <div className="w-full py-8">
        {/* Tab buttons skeleton */}
        <div className="flex gap-3 mb-8 justify-center">
          <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse" />
        </div>
        
        {/* Grid skeleton - 2 cols on mobile, 3 on larger screens */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white/5 rounded-xl h-64 animate-pulse backdrop-blur-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-12 text-center">
        <p className="text-red-400 mb-4">Unable to load services. Please try again.</p>
        <Button 
          variant="outline" 
          onClick={() => {
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: ['/api/services'] });
            queryClient.invalidateQueries({ queryKey: ['/api/addon-services'] });
          }}
          data-testid="button-retry-services"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tab Buttons - Modern pill design */}
      <div className="flex gap-3 mb-8 justify-center flex-wrap px-4">
        <Button 
          variant={activeTab === 'main' ? "default" : "ghost"}
          onClick={() => setActiveTab('main')}
          data-testid="button-tab-main-services"
          className={`
            px-6 py-2 rounded-full font-medium transition-all duration-300
            ${activeTab === 'main' 
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 scale-105'
              : 'text-blue-200 hover:text-white hover:bg-white/10'
            }
          `}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Main Services
        </Button>
        <Button 
          variant={activeTab === 'addon' ? "default" : "ghost"}
          onClick={() => setActiveTab('addon')}
          data-testid="button-tab-addon-services"
          className={`
            px-6 py-2 rounded-full font-medium transition-all duration-300
            ${activeTab === 'addon' 
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 scale-105'
              : 'text-blue-200 hover:text-white hover:bg-white/10'
            }
          `}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Add-ons
        </Button>
      </div>
      
      {/* Service Grid - 2 columns on mobile, 3 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 px-2 sm:px-0 auto-rows-fr">
        {displayedItems.map((item, index) => {
          const serviceId = item.name.toLowerCase().replace(/\s+/g, '-');
          
          return (
            <motion.div
              key={`${activeTab}-${serviceId}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ 
                duration: 0.3, 
                delay: index * 0.05,
                ease: [0.22, 1, 0.36, 1] // Custom easing for smooth feel
              }}
              whileHover={{ 
                y: -8,
                transition: { duration: 0.2, ease: "easeOut" }
              }}
              className="group min-w-0"
              data-testid={`service-card-${serviceId}`}
            >
              <Card className="
                h-full flex flex-col
                bg-gradient-to-br from-white/[0.07] to-white/[0.03]
                border border-white/10
                backdrop-blur-xl
                hover:border-blue-400/50
                hover:shadow-2xl hover:shadow-blue-500/20
                transition-all duration-300
                overflow-hidden
                relative
              ">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-600/0 group-hover:from-blue-500/5 group-hover:to-purple-600/5 transition-all duration-500 pointer-events-none" />
                
                {/* Content */}
                <div className="relative z-10 flex flex-col h-full">
                  <CardHeader className="pb-3 space-y-2">
                    <Badge 
                      variant="outline" 
                      className="w-fit border-blue-400/30 text-blue-300 text-[10px] sm:text-xs px-2 py-0.5"
                    >
                      {activeTab === 'main' ? 'Package' : 'Add-on'}
                    </Badge>
                    
                    <CardTitle className="text-sm sm:text-base md:text-lg text-white font-bold leading-tight line-clamp-2 group-hover:text-blue-300 transition-colors">
                      {item.name}
                    </CardTitle>
                    
                    <p className="text-xs sm:text-sm md:text-base font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      {item.priceRange}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="flex-grow pb-3 space-y-2">
                    <p className="text-xs sm:text-sm text-gray-300 line-clamp-3 leading-relaxed">
                      {item.overview}
                    </p>
                    
                    {activeTab === 'main' && 'duration' in item && item.duration && (
                      <div className="flex items-center gap-2 text-xs text-blue-300/80 pt-2 border-t border-white/5">
                        <Clock className="w-3 h-3" />
                        <span>{item.duration}</span>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <Button 
                      asChild 
                      size="sm"
                      className="
                        w-full 
                        bg-gradient-to-r from-blue-500 to-purple-600 
                        hover:from-blue-600 hover:to-purple-700
                        text-white text-xs sm:text-sm
                        shadow-lg shadow-blue-500/20
                        border-0
                        group/btn
                        transition-all duration-300
                      "
                      data-testid={`button-book-${serviceId}`}
                    >
                      <Link 
                        href={`/chat?service=${encodeURIComponent(item.name)}&action=schedule`}
                        className="flex items-center justify-center gap-2"
                      >
                        <span>Book Now</span>
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                  </CardFooter>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      {/* Empty state */}
      {displayedItems.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>No {activeTab === 'main' ? 'services' : 'add-ons'} available at this time.</p>
        </div>
      )}
    </div>
  );
};

export default ServiceShowcaseGrid;
