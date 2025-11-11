import { Button } from "@/components/ui/button";
import { 
  Image,
  GiftIcon, 
  Star,
  Award
} from 'lucide-react';
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function FeatureActionButtons() {
  const handleGiftCardsClick = () => {
    window.open('https://squareup.com/gift/EDQKXPXWCXQWM/order', '_blank');
  };

  return (
    <motion.div 
      className="flex justify-center mt-5 mb-8 w-full max-w-xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
        <Button
          variant="ghost"
          asChild
          className="py-2 px-3 bg-blue-600/10 hover:bg-blue-600/30 text-white border-none rounded-md shadow-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md hover:shadow-blue-800/20"
          data-testid="button-gallery"
        >
          <Link href="/gallery">
            <Image className="h-4 w-4 mr-1 group-hover:animate-pulse" />
            Gallery
          </Link>
        </Button>

        <Button
          variant="ghost"
          onClick={handleGiftCardsClick}
          className="py-2 px-3 bg-blue-600/10 hover:bg-blue-600/30 text-white border-none rounded-md shadow-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md hover:shadow-blue-800/20"
          data-testid="button-gift-cards"
        >
          <GiftIcon className="h-4 w-4 mr-1 group-hover:animate-pulse" />
          Gift Cards
        </Button>

        <Button
          variant="ghost"
          asChild
          className="py-2 px-3 bg-blue-600/10 hover:bg-blue-600/30 text-white border-none rounded-md shadow-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md hover:shadow-blue-800/20"
          data-testid="button-reviews"
        >
          <Link href="/reviews">
            <Star className="h-4 w-4 mr-1 group-hover:animate-pulse" />
            Reviews
          </Link>
        </Button>
        
        <Button
          variant="ghost"
          asChild
          className="py-2 px-3 bg-blue-600/10 hover:bg-blue-600/30 text-white border-none rounded-md shadow-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md hover:shadow-blue-800/20"
          data-testid="button-rewards"
        >
          <Link href="/rewards">
            <Award className="h-4 w-4 mr-1 group-hover:animate-pulse" />
            My Loyalty Points
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}