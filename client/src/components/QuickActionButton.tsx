import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from 'wouter';
import { 
  Image,
  GiftIcon, 
  Star, 
  DollarSign,
  X,
  Plus 
} from 'lucide-react';

export function QuickActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();
  const [showButton, setShowButton] = useState(true);
  
  // Only show the quick action button on customer-facing pages
  useEffect(() => {
    // Don't show on dashboard, business settings, etc.
    const adminPages = [
      '/dashboard', 
      '/live-conversations', 
      '/conversation-insights',
      '/customer-database',
      '/business-settings'
    ];
    
    const isAdminPage = adminPages.some(page => location.startsWith(page));
    setShowButton(!isAdminPage);
  }, [location]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleGalleryClick = () => {
    window.open('/gallery', '_blank');
    setIsOpen(false);
    toast({
      title: "Gallery",
      description: "Viewing our work gallery...",
    });
  };
  
  const handleGiftCardsClick = () => {
    window.open('/gift-cards', '_blank');
    setIsOpen(false);
    toast({
      title: "Gift Cards",
      description: "Exploring our gift card options...",
    });
  };
  
  const handleReviewsClick = () => {
    window.open('https://g.page/r/CQo53O2yXrN8EBM/review', '_blank');
    setIsOpen(false);
    toast({
      title: "Reviews",
      description: "Thank you for considering leaving a review!",
    });
  };
  
  // Don't render if we're on an admin page
  if (!showButton) return null;

  return (
    <div className="fixed bottom-6 right-1 z-10">
      {/* Quick action menu */}
      {isOpen && (
        <div className="flex flex-col gap-2 mb-3 items-end">
          <div className="flex items-center gap-2">
            <span className="bg-white text-black px-2 py-1 rounded-lg shadow-md text-xs">
              Gallery
            </span>
            <Button 
              size="sm" 
              className="h-9 w-9 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg p-0"
              onClick={handleGalleryClick}
            >
              <Image className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-white text-black px-2 py-1 rounded-lg shadow-md text-xs">
              Gift Cards
            </span>
            <Button 
              size="sm" 
              className="h-9 w-9 rounded-full bg-green-500 hover:bg-green-600 shadow-lg p-0"
              onClick={handleGiftCardsClick}
            >
              <GiftIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-white text-black px-2 py-1 rounded-lg shadow-md text-xs">
              Reviews
            </span>
            <Button 
              size="sm" 
              className="h-9 w-9 rounded-full bg-amber-500 hover:bg-amber-600 shadow-lg p-0"
              onClick={handleReviewsClick}
            >
              <Star className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main floating button - smaller size */}
      <Button 
        size="sm" 
        className={`h-10 w-10 rounded-full shadow-md opacity-70 hover:opacity-100 ${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
        onClick={toggleMenu}
      >
        {isOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}