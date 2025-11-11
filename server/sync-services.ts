import { db } from './db.js';
import { services } from '../shared/schema.js';
import { getServiceData } from './pricing.js';
import { eq } from 'drizzle-orm';

(async () => {
  try {
    console.log('Fetching services from Google Sheets...');
    const sheetServices = await getServiceData();
    
    console.log(`Found ${sheetServices.length} services in Google Sheets`);
    
    for (const service of sheetServices) {
      // Check if service already exists by name
      const existing = await db.select().from(services).where(eq(services.name, service.name));
      
      if (existing.length > 0) {
        // Update existing service
        await db.update(services)
          .set({
            priceRange: service.priceRange,
            overview: service.description.substring(0, 500), // Truncate for overview
            detailedDescription: service.description,
            duration: service.duration,
            durationHours: service.durationHours.toString(),
          })
          .where(eq(services.id, existing[0].id));
        console.log(`Updated: ${service.name} (ID: ${existing[0].id})`);
      } else {
        // Insert new service
        const result = await db.insert(services).values({
          name: service.name,
          priceRange: service.priceRange,
          overview: service.description.substring(0, 500),
          detailedDescription: service.description,
          duration: service.duration,
          durationHours: service.durationHours.toString(),
        }).returning();
        console.log(`Inserted: ${service.name} (ID: ${result[0].id})`);
      }
    }
    
    console.log('\n✅ Services synced successfully!');
    
    // Display all services
    const allServices = await db.select().from(services);
    console.log('\nAll services in database:');
    allServices.forEach(s => console.log(`  ${s.id}: ${s.name} - ${s.priceRange}`));
    
  } catch (error) {
    console.error('Error syncing services:', error);
  }
})();
