import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import ExpandableServiceDetails from "./ExpandableServiceDetails";
import { FaCarSide, FaSprayCan, FaShieldAlt, FaClock } from "react-icons/fa";

interface ServiceInfo {
  name: string;
  priceRange: string;
  overview: string;
  detailedDescription: string;
  duration?: string;
  imageUrl?: string;
}

interface AddOnService {
  name: string;
  priceRange: string;
  overview: string;
  detailedDescription: string;
  imageUrl?: string;
}

const ServicesCarousel = () => {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [addOns, setAddOns] = useState<AddOnService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'addon'>('main');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        
        // Fetch main services
        const servicesResponse = await fetch('/api/services');
        const servicesData = await servicesResponse.json();
        
        if (!servicesData.success) {
          throw new Error('Failed to load services');
        }
        
        // Fetch add-on services
        const addOnsResponse = await fetch('/api/addon-services');
        const addOnsData = await addOnsResponse.json();
        
        if (!addOnsData.success) {
          throw new Error('Failed to load add-on services');
        }
        
        setServices(servicesData.services);
        setAddOns(addOnsData.addOns);
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('Unable to load services. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchServices();
  }, []);

  // Get displayed items based on active tab
  const displayedItems = activeTab === 'main' ? services : addOns;

  if (loading) {
    return (
      <div className="w-full py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="opacity-50 animate-pulse">
              <CardHeader>
                <div className="h-7 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-5 bg-gray-700 rounded w-1/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-4/5"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-12 text-center">
        <p className="text-red-400">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full px-2">
      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
        <Button 
          variant={activeTab === 'main' ? "default" : "outline"}
          onClick={() => setActiveTab('main')}
          className={`min-w-[150px] font-medium shadow-md transition-all duration-300 ${
            activeTab === 'main' 
              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/20 shadow-blue-600/10'
              : 'bg-gray-800/80 text-white border-gray-700 hover:border-blue-400 hover:text-blue-400'
          }`}
        >
          Main Packages
        </Button>
        <Button 
          variant={activeTab === 'addon' ? "default" : "outline"}
          onClick={() => setActiveTab('addon')}
          className={`min-w-[150px] font-medium shadow-md transition-all duration-300 ${
            activeTab === 'addon' 
              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/20 shadow-blue-600/10'
              : 'bg-gray-800/80 text-white border-gray-700 hover:border-blue-400 hover:text-blue-400'
          }`}
        >
          Add-on Services
        </Button>
      </div>
      
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayedItems.map((item, index) => (
            <motion.div
              key={`${activeTab}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="flex h-full"
            >
              <Card className="bg-gray-900 border-gray-700 hover:border-blue-500 transition-all duration-300 flex flex-col w-full shadow-lg shadow-black/20 hover:shadow-blue-900/20 overflow-hidden">
                {(item as ServiceInfo).imageUrl && (
                  <div className="w-full h-48 overflow-hidden">
                    <img 
                      src={(item as ServiceInfo).imageUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <Badge variant="outline" className="border-blue-500/50 text-blue-300 mb-2">
                    {activeTab === 'main' ? 'Package' : 'Add-on'}
                  </Badge>
                  <CardTitle className="text-xl text-white transition-colors">{item.name}</CardTitle>
                  <p className="text-blue-300 font-semibold">{item.priceRange}</p>
                </CardHeader>
                <CardContent className="text-gray-300 flex-grow">
                  <p className="text-sm mb-2">{item.overview}</p>
                  {activeTab === 'main' && (item as ServiceInfo).duration && (
                    <div className="flex items-center mt-3 text-sm text-gray-400 border-t border-gray-800 pt-3">
                      <svg className="w-4 h-4 mr-2 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Duration: {(item as ServiceInfo).duration}
                    </div>
                  )}
                  
                  {/* Service details with bullet points */}
                  <div>
                    <ExpandableServiceDetails 
                      name={item.name} 
                      priceRange={item.priceRange}
                      detailedDescription={item.detailedDescription}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    asChild 
                    className="w-full bg-blue-600/80 hover:bg-blue-600 text-white border-none shadow-md hover:shadow-lg transform hover:translate-y-[-2px] transition-all duration-300 group"
                  >
                    <Link 
                      href={`/chat?service=${encodeURIComponent(item.name)}&action=schedule`} 
                      className="flex items-center justify-center"
                    >
                      <span>Book This Service</span>
                      <span className="ml-2 transform translate-x-0 group-hover:translate-x-1 transition-transform duration-300">→</span>
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicesCarousel;