import React from 'react';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ServiceDetailsProps {
  name: string;
  priceRange: string;
  description?: string;
}

interface ServiceDetailData {
  name: string;
  interior?: string[];
  exterior?: string[];
  duration?: string;
  additionalInfo?: string;
}

// This maps service names to their detailed information
const serviceDetailsMap: Record<string, ServiceDetailData> = {
  "Full Detail": {
    name: "Full Detail",
    interior: [
      "Carpet & upholstery steamed & shampooed",
      "Leather cleaned & conditioned",
      "Thorough vacuuming",
      "Spot treat headliner",
      "Interior windows and glass cleaned",
      "Trim, dash, plastics cleaned & dressed with UV protection"
    ],
    exterior: [
      "Gentle hand Wash",
      "Durable ceramic spray wax on paint & glass",
      "Clay paint- removes imbedded contaminates",
      "Clean wheels | Tires | Dress Tires"
    ],
    duration: "Usually takes 2-4 hours",
    additionalInfo: "Excessive pet hair, stains, or debris that add significant time may result in an additional fee ($25+). We'll always let you know first"
  },
  "Interior Detail": {
    name: "Interior Detail",
    interior: [
      "Thorough vacuuming",
      "Carpet & upholstery steamed & shampooed",
      "Leather cleaned & conditioned",
      "Spot treat headliner",
      "Interior windows and glass cleaned",
      "Trim, dash, plastics cleaned & dressed with UV protection"
    ],
    duration: "Usually takes 1-4 hours",
    additionalInfo: "*Add leather/upholstery protectant!"
  },
  "Maintenance Detail Program": {
    name: "Maintenance Detail Program",
    interior: [
      "Wipedown Dash | Console | Panels",
      "Spot treat small stains",
      "Vacuum Interior",
      "Glass Cleaned inside & out"
    ],
    exterior: [
      "Thorough hand Wash",
      "Hydrophobic ceramic spray wax on paint & glass",
      "Clean wheels | Tires | Dress Tires"
    ],
    duration: "Takes 1-2 hours"
  },
  "Paint Enhancement / Light Polish": {
    name: "Paint Enhancement / Light Polish",
    exterior: [
      "Hand wash, wheels | tires | tire dressing",
      "Bug and tar removal",
      "Paint decontamination - Iron removal & clay",
      "Machine Polish & Wax w/ Rupes Uno Protect",
      "Ceramic sealant on windows & wheels",
      "Clean interior windows",
      "Black trim treatment",
      "Polish exhaust tips"
    ],
    duration: "Takes 1-3 hours"
  },
  "Ceramic Coating - 1 Year": {
    name: "Ceramic Coating - 1 Year",
    exterior: [
      "Hand wash, wheels | tires | tire dressing",
      "Paint decontamination - Iron removal & clay",
      "1-stage compound & polish 60-90% correction",
      "Window Sealant",
      "Black trim conditioner",
      "Polish exhaust tips",
      "1 year Nasial SiO2 coating hand applied to exterior paint and wheel faces"
    ],
    additionalInfo: "*Guaranteed by Clean Machine!"
  },
  "Ceramic Coating - 3 Year": {
    name: "Ceramic Coating - 3 Year",
    exterior: [
      "Hand wash, wheels | tires | tire dressing",
      "Paint decontamination - Iron removal & clay",
      "2-stage compound & polish 60-90% correction",
      "Window Sealant",
      "Black trim conditioner",
      "Polish exhaust tips",
      "3 year Nasial SiO2 coating hand applied to exterior paint and wheel faces"
    ],
    additionalInfo: "*Guaranteed by Clean Machine!"
  },
  "Motorcycle Detail": {
    name: "Motorcycle Detail",
    exterior: [
      "Machine polish remove light swirls and renew the shine & luster of your paint",
      "Thorough hand wash",
      "Wax paint and windscreen",
      "Condition leather, vinyl, rubber or plastic seats/trim"
    ]
  },
  "Premium Wash": {
    name: "Premium Wash",
    exterior: [
      "Hand wash paint",
      "Clay paint- removes imbedded contaminates",
      "Hand wash wheels, tires & wheel wells",
      "Clean and seal exterior glass and windows",
      "Durable ceramic spray wax for 3-months of protection"
    ]
  },
  "Shampoo seats & or Carpets": {
    name: "Shampoo seats & or Carpets",
    interior: [
      "Deep cleaning of seats and carpets",
      "Stain treatment",
      "Steam extraction",
      "Deodorizing"
    ]
  },
  // Add-on services
  "Leather Conditioning": {
    name: "Leather Conditioning",
    interior: [
      "Deep conditioning for all leather surfaces",
      "Protect from cracking and fading",
      "Restore suppleness and natural sheen"
    ]
  },
  "Excessive Pet Hair Removal": {
    name: "Excessive Pet Hair Removal",
    interior: [
      "Specialized tools for embedded excessive pet hair",
      "Complete removal from all surfaces",
      "Deodorizing treatment"
    ]
  },
  "Headlight Restoration": {
    name: "Headlight Restoration",
    exterior: [
      "Remove yellowing and cloudiness",
      "Multi-stage sanding and polishing",
      "UV protective coating application",
      "Improved visibility and appearance"
    ],
    additionalInfo: "$25 per lens"
  },
  "Odor Elimination": {
    name: "Odor Elimination",
    interior: [
      "Professional ozone treatment",
      "Penetrates all interior surfaces",
      "Eliminates smoke, pet, and food odors",
      "Complete air vent cleaning"
    ]
  },
  "Fabric Protection": {
    name: "Fabric Protection",
    interior: [
      "Premium fabric guard application",
      "Stain resistance treatment",
      "Extended protection for upholstery",
      "Easier cleaning and maintenance"
    ]
  }
};

export const ServiceDetails: React.FC<ServiceDetailsProps> = ({ name }) => {
  // Find the detailed information for this service
  const details = serviceDetailsMap[name] || {
    name,
    interior: ["Professional cleaning and care"],
    exterior: name.toLowerCase().includes("interior") ? undefined : ["Professional cleaning and care"]
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="details" className="border-t-0 border-b-0">
        <AccordionTrigger className="py-2 text-blue-400 hover:text-blue-300 text-sm font-medium">
          View Service Details
        </AccordionTrigger>
        <AccordionContent className="text-left pb-4">
          <div className="space-y-4 text-gray-300">
            {details.interior && (
              <div>
                <h4 className="text-white font-medium mb-2 text-center">INTERIOR</h4>
                <ul className="space-y-1">
                  {details.interior.map((item, index) => (
                    <li key={`interior-${index}`} className="flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {details.exterior && (
              <div className="mt-4">
                <h4 className="text-white font-medium mb-2 text-center">EXTERIOR</h4>
                <ul className="space-y-1">
                  {details.exterior.map((item, index) => (
                    <li key={`exterior-${index}`} className="flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {details.duration && (
              <div className="mt-4 text-center text-gray-400 italic">
                {details.duration}
              </div>
            )}
            
            {details.additionalInfo && (
              <div className="mt-3 text-center text-gray-400 text-sm">
                {details.additionalInfo}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ServiceDetails;