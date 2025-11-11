import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExpandableServiceDetailsProps {
  name: string;
  priceRange: string;
  detailedDescription?: string;
}

export const ExpandableServiceDetails: React.FC<ExpandableServiceDetailsProps> = ({ 
  name, 
  priceRange, 
  detailedDescription 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Debug log to see what we're receiving
  console.log(`ExpandableServiceDetails for ${name}:`, {
    hasDetailedDescription: !!detailedDescription,
    detailedDescriptionLength: detailedDescription?.length || 0,
    detailedDescription: detailedDescription
  });

  // Only display if we have a detailed description from the API
  if (!detailedDescription || detailedDescription.trim() === '') {
    console.log(`No detailed description for ${name}, hiding dropdown`);
    return null;
  }

  // Split by bullet points or newlines for better formatting
  const formatDetailedDescription = (text: string) => {
    // Split by newlines and filter out empty lines
    const lines = text.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      // Check if line starts with bullet point
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        return (
          <li key={index} className="flex items-start ml-4">
            <span className="text-blue-400 mr-2 mt-1">•</span>
            <span className="flex-1">{trimmedLine.replace(/^[•-]\s*/, '')}</span>
          </li>
        );
      }
      // Regular paragraph
      return (
        <p key={index} className="mb-2 font-medium text-gray-100">
          {trimmedLine}
        </p>
      );
    });
  };

  return (
    <div className="w-full mt-3 border-t border-gray-800 pt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-0 h-auto text-blue-400 hover:text-blue-300 bg-transparent hover:bg-transparent focus:bg-transparent"
      >
        <span className="font-medium text-sm">View Service Details</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden text-left bg-gradient-to-br from-gray-900 to-gray-950 p-5 mt-2 rounded-lg border border-gray-800"
          >
            <div className="space-y-2 text-sm text-gray-200 leading-relaxed">
              {formatDetailedDescription(detailedDescription)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpandableServiceDetails;