import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { services } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Mapping of service names to stock image filenames
const serviceImageMapping: Record<string, string> = {
  // Main Services
  'Paint Enhancement / Light Polish': 'professional_car_pai_e49240d7.jpg',
  'Ceramic Coating - 1 Year': 'glossy_car_ceramic_c_d900e9a1.jpg',
  'Ceramic Coating - 3 Year': 'glossy_car_ceramic_c_d900e9a1.jpg',
  'Motorcycle Detail': 'shiny_clean_detailed_40ae8ebb.jpg',
  'Premium Wash': 'hand_washing_car_wit_cfdfd508.jpg',
  'Shampoo seats and or Carpets': 'car_interior_seat_cl_654f4b97.jpg',
  
  // Add-On Services
  'Leather or Fabric Protector': 'leather_car_seat_con_f6ecde28.jpg',
  'Light Polish': 'professional_car_pai_e49240d7.jpg',
  'Headlight Restoration': 'headlight_restoratio_cc4535bf.jpg',
  '12-Month Ceramic Coating': 'glossy_car_ceramic_c_d900e9a1.jpg',
  'Plastic Trim Restoration': 'black_plastic_car_tr_7690b95f.jpg',
  'Engine Bay Cleaning': 'clean_car_engine_bay_0df62c92.jpg',
  'Glass/Windshield Protector': 'car_windshield_water_85185c03.jpg',
  'Ozone Odor Removal': 'fresh_clean_car_inte_8aff039e.jpg',
};

async function updateServiceImages() {
  console.log('Starting service image update...');
  
  const stockImagesDir = path.join(process.cwd(), 'attached_assets', 'stock_images');
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'services');
  
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
  }
  
  let updateCount = 0;
  
  for (const [serviceName, stockImageFile] of Object.entries(serviceImageMapping)) {
    try {
      const sourcePath = path.join(stockImagesDir, stockImageFile);
      
      if (!fs.existsSync(sourcePath)) {
        console.warn(`⚠️  Stock image not found: ${stockImageFile} for ${serviceName}`);
        continue;
      }
      
      // Create a unique filename with timestamp
      const ext = path.extname(stockImageFile);
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const destFilename = `service-${timestamp}-${random}${ext}`;
      const destPath = path.join(uploadsDir, destFilename);
      
      // Copy the file
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✓ Copied ${stockImageFile} → ${destFilename}`);
      
      // Update database
      const imageUrl = `/uploads/services/${destFilename}`;
      
      const result = await db
        .update(services)
        .set({ imageUrl })
        .where(eq(services.name, serviceName))
        .returning();
      
      if (result.length > 0) {
        console.log(`✓ Updated database for: ${serviceName}`);
        updateCount++;
      } else {
        console.log(`ℹ️  No database record found for: ${serviceName} (may be add-on from Google Sheets)`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${serviceName}:`, error);
    }
  }
  
  console.log(`\n✅ Complete! Updated ${updateCount} service images in database.`);
  console.log('Note: Add-on services from Google Sheets need to be added to database first.');
  
  process.exit(0);
}

updateServiceImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
