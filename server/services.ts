import { sheetsData } from './knowledge';
import { db } from './db';
import { services as servicesTable } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface ServiceInfo {
  name: string;
  priceRange: string;
  overview: string;
  detailedDescription: string;
  duration: string;
  durationHours: number;
  imageUrl?: string;
}

// Helper function to extract duration hours from string
function extractDurationHours(durationStr: string): number {
  if (!durationStr) return 2; // Default

  const hourMatch = durationStr.match(/(\d+)(?:\s*-\s*\d+)?\s*hours?/i);
  if (hourMatch && hourMatch[1]) {
    return parseInt(hourMatch[1], 10);
  }

  const minuteMatch = durationStr.match(/(\d+)(?:\s*-\s*\d+)?\s*min/i);
  if (minuteMatch && minuteMatch[1]) {
    return Math.max(0.5, Math.round((parseInt(minuteMatch[1], 10) / 60) * 2) / 2);
  }

  return 2;
}

// Get all services from the knowledge base merged with database images
export async function getAllServices(): Promise<ServiceInfo[]> {
  try {
    if (!sheetsData['services'] || !Array.isArray(sheetsData['services'])) {
      console.log('No services found in sheets data, using fallback');
      return getDefaultServices();
    }

    console.log(`Successfully loaded ${sheetsData['services'].length} services from Google Sheet`);

    const services = sheetsData['services']
      .filter(service => service && service['Service Name'])
      .map(service => {
        const name = service['Service Name'] || '';
        const priceRange = service['Price Range'] || 'Contact for pricing';
        const overview = service['Overview'] || '';
        const detailedDescription = service['Detailed Description'] || '';
        const duration = service['Time Estimate'] || '';
        const durationHours = extractDurationHours(duration);

        return {
          name,
          priceRange,
          overview,
          detailedDescription,
          duration,
          durationHours
        };
      });

    // Fetch service images from database and merge
    try {
      const dbServices = await db.select().from(servicesTable);
      const serviceImageMap = new Map<string, string | null>(
        dbServices.map(s => [s.name, s.imageUrl])
      );
      
      // Merge images with services
      return services.map(service => ({
        ...service,
        imageUrl: serviceImageMap.get(service.name) || undefined
      }));
    } catch (dbError) {
      console.error('Error fetching service images from database:', dbError);
      return services.length > 0 ? services : getDefaultServices();
    }
  } catch (error) {
    console.error('Error getting services:', error);
    return getDefaultServices();
  }
}

// Save or update service image URL in database
export async function saveServiceImage(serviceName: string, imageUrl: string): Promise<boolean> {
  try {
    // Normalize service name (trim whitespace) to match Google Sheets data
    const normalizedName = serviceName.trim();
    
    // First, check if service exists with this name
    const existingService = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.name, normalizedName))
      .limit(1);
    
    if (existingService.length > 0) {
      // Update existing service's image URL
      await db.update(servicesTable)
        .set({ imageUrl: imageUrl })
        .where(eq(servicesTable.name, normalizedName));
    } else {
      // Insert new service with image URL
      await db.insert(servicesTable).values({
        name: normalizedName,
        priceRange: 'See Google Sheets',
        overview: 'See Google Sheets',
        detailedDescription: 'See Google Sheets',
        duration: '2 hours',
        durationHours: 2,
        imageUrl: imageUrl
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving service image:', error);
    return false;
  }
}

// Default services when Google Sheets fails
function getDefaultServices(): ServiceInfo[] {
  return [
    {
      name: "Full Detail",
      priceRange: "$225-300",
      overview: "Complete interior and exterior detailing that restores your vehicle to showroom condition.",
      detailedDescription: "Our most comprehensive service includes:\n\n• Complete interior deep cleaning with steam and shampoo\n• Leather conditioning and protection\n• Full exterior wash, clay bar, and wax\n• Wheel and tire detailing\n• All trim and plastics cleaned and protected",
      duration: "4-5 hours",
      durationHours: 4.5
    },
    {
      name: "Interior Only",
      priceRange: "$179",
      overview: "Deep interior cleansing with steam cleaning, thorough vacuuming, and conditioning.",
      detailedDescription: "Complete interior transformation:\n\n• Steam cleaning and shampooing of all carpets and upholstery\n• Thorough vacuuming of all areas\n• Stain removal treatment\n• Leather cleaning and conditioning\n• All interior surfaces cleaned and protected with UV protection",
      duration: "2-3 hours",
      durationHours: 2.5
    },
    {
      name: "Exterior Only",
      priceRange: "$169",
      overview: "Premium exterior wash, decontamination, polish, and protection with high-grade carnauba wax. Includes wheels, tires, and all exterior trim.",
      detailedDescription: "Premium exterior wash, decontamination, polish, and protection with high-grade carnauba wax. Includes wheels, tires, and all exterior trim.",
      duration: "1.5-2 hours",
      durationHours: 1.75
    },
    {
      name: "Express Wash",
      priceRange: "$59",
      overview: "Quick but thorough exterior wash with hand drying, tire shine, and quick exterior protection. Perfect for regular maintenance.",
      detailedDescription: "Quick but thorough exterior wash with hand drying, tire shine, and quick exterior protection. Perfect for regular maintenance.",
      duration: "45 minutes",
      durationHours: 0.75
    },
    {
      name: "Ceramic Coating",
      priceRange: "$899",
      overview: "Professional-grade ceramic coating application for superior paint protection that lasts 2+ years. Includes complete paint correction before application.",
      detailedDescription: "Professional-grade ceramic coating application for superior paint protection that lasts 2+ years. Includes complete paint correction before application.",
      duration: "8-10 hours",
      durationHours: 9
    },
    {
      name: "Maintenance Detail",
      priceRange: "$129",
      overview: "Perfect for maintaining your vehicle between full details. Includes quick interior cleaning and exterior wash with protection refresh.",
      detailedDescription: "Perfect for maintaining your vehicle between full details. Includes quick interior cleaning and exterior wash with protection refresh.",
      duration: "1.5 hours",
      durationHours: 1.5
    },
    {
      name: "Paint Correction",
      priceRange: "$499",
      overview: "Professional multi-stage paint correction to remove swirls, scratches, and defects from your vehicle's paint. Includes final protection layer.",
      detailedDescription: "Professional multi-stage paint correction to remove swirls, scratches, and defects from your vehicle's paint. Includes final protection layer.",
      duration: "6-8 hours",
      durationHours: 7
    },
    {
      name: "Headlight Restoration",
      priceRange: "$89",
      overview: "Complete restoration of foggy or yellowed headlights to like-new clarity. Includes UV protection to prevent future oxidation.",
      detailedDescription: "Complete restoration of foggy or yellowed headlights to like-new clarity. Includes UV protection to prevent future oxidation.",
      duration: "1 hour",
      durationHours: 1
    }
  ];
}

// Get all add-on services
export async function getAddonServices(): Promise<ServiceInfo[]> {
  try {
    if (!sheetsData['addons'] || !Array.isArray(sheetsData['addons'])) {
      console.log('No add-on services found in sheets data, using fallback');
      return getDefaultAddonServices();
    }

    console.log(`Successfully loaded ${sheetsData['addons'].length} add-on services from Google Sheet`);

    const addons = sheetsData['addons']
      .filter(addon => addon && addon['Add-On Service'])
      .map(addon => {
        const name = addon['Add-On Service'] || '';
        let priceRange = addon['Price'] || 'Contact for pricing';
        let overview = addon['Overview'] || '';
        let detailedDescription = addon['Detailed Description'] || '';
        
        // Special handling for headlight services
        if (name.toLowerCase().includes('headlight')) {
          // If price is $25 or similar, format as "per lens"
          if (priceRange.includes('25') || priceRange.includes('$25')) {
            priceRange = '$25 per lens (×2 typical)';
            if (overview) overview = overview + ' Most customers need both headlight lenses restored.';
          }
        }
        
        return {
          name,
          priceRange,
          overview,
          detailedDescription,
          duration: addon['Time Estimate'] || '',
          durationHours: extractDurationHours(addon['Time Estimate'])
        };
      });

    // Fetch service images from database and merge (same as getAllServices)
    try {
      const dbServices = await db.select().from(servicesTable);
      const serviceImageMap = new Map<string, string | null>(
        dbServices.map(s => [s.name, s.imageUrl])
      );
      
      console.log(`[getAddonServices] Merging ${dbServices.length} database images with ${addons.length} add-on services`);
      
      // Merge images with add-on services
      return addons.map(addon => ({
        ...addon,
        imageUrl: serviceImageMap.get(addon.name) || undefined
      }));
    } catch (dbError) {
      console.error('Error fetching add-on service images from database:', dbError);
      return addons.length > 0 ? addons : getDefaultAddonServices();
    }
  } catch (error) {
    console.error('Error getting add-ons:', error);
    return getDefaultAddonServices();
  }
}

function getDefaultAddonServices(): ServiceInfo[] {
  return [
    {
      name: "Paint Protection",
      priceRange: "$199",
      overview: "Premium ceramic-based paint protection",
      detailedDescription: "Long-lasting protection for your vehicle's paint:\n\n• Professional-grade ceramic coating application\n• Hydrophobic protection that repels water and dirt\n• UV protection to prevent fading\n• Enhanced gloss and shine\n• Lasts 6-12 months with proper care",
      duration: "1-2 hours",
      durationHours: 1.5
    },
    {
      name: "Headlight Restoration",
      priceRange: "$25 per lens (×2 typical)",
      overview: "Complete restoration of foggy or yellowed headlights to like-new clarity with UV protection to prevent future oxidation. Most customers need both headlight lenses restored. Price shown is per lens.",
      detailedDescription: "Complete restoration of foggy or yellowed headlights to like-new clarity with UV protection to prevent future oxidation. Most customers need both headlight lenses restored. Price shown is per lens.",
      duration: "1 hour",
      durationHours: 1
    },
    {
      name: "Engine Bay Cleaning",
      priceRange: "$75",
      overview: "Thorough cleaning and degreasing of your engine bay, followed by dressing of all plastic and rubber components for a showroom finish.",
      detailedDescription: "Thorough cleaning and degreasing of your engine bay, followed by dressing of all plastic and rubber components for a showroom finish.",
      duration: "1 hour",
      durationHours: 1
    },
    {
      name: "Leather/Upholstery Protection",
      priceRange: "$99",
      overview: "Premium fabric or leather protectant that repels liquids, prevents staining, and extends the life of your interior surfaces.",
      detailedDescription: "Premium fabric or leather protectant that repels liquids, prevents staining, and extends the life of your interior surfaces.",
      duration: "45 minutes",
      durationHours: 0.75
    },
    {
      name: "Odor Elimination",
      priceRange: "$79",
      overview: "Professional-grade odor removal using ozone treatment and steam cleaning to eliminate even the toughest smells from your vehicle.",
      detailedDescription: "Professional-grade odor removal using ozone treatment and steam cleaning to eliminate even the toughest smells from your vehicle.",
      duration: "1-2 hours",
      durationHours: 1.5
    },
    {
      name: "Pet Hair Removal",
      priceRange: "$45",
      overview: "Specialized treatment to remove embedded pet hair from carpet and upholstery using professional-grade tools and techniques.",
      detailedDescription: "Specialized treatment to remove embedded pet hair from carpet and upholstery using professional-grade tools and techniques.",
      duration: "30-45 minutes",
      durationHours: 0.5
    },
    {
      name: "Clay Bar Treatment",
      priceRange: "$65",
      overview: "Deep cleaning of your paint surface to remove embedded contaminants that regular washing cannot remove, leaving a glass-smooth finish.",
      detailedDescription: "Deep cleaning of your paint surface to remove embedded contaminants that regular washing cannot remove, leaving a glass-smooth finish.",
      duration: "1 hour",
      durationHours: 1
    },
    {
      name: "Wheel & Caliper Detailing",
      priceRange: "$85",
      overview: "Comprehensive cleaning and protection of wheels, wheel wells, and brake calipers with specialized products for maximum shine and protection.",
      detailedDescription: "Comprehensive cleaning and protection of wheels, wheel wells, and brake calipers with specialized products for maximum shine and protection.",
      duration: "1 hour",
      durationHours: 1
    }
  ];
}

export async function searchServices(query: string): Promise<ServiceInfo[]> {
  const services = await getAllServices();
  if (!query) return services;

  const normalizedQuery = query.toLowerCase();
  return services.filter(service => 
    service.name.toLowerCase().includes(normalizedQuery) ||
    service.overview.toLowerCase().includes(normalizedQuery) ||
    service.detailedDescription.toLowerCase().includes(normalizedQuery)
  );
}