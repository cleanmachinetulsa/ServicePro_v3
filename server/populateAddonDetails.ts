import { google } from 'googleapis';

// Google Sheet ID
const SPREADSHEET_ID = '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';
const ADDON_TAB_NAME = 'Add-Ons';

// Get Google Sheets client with WRITE permissions
async function getGoogleSheetsWriteClient() {
  try {
    if (!process.env.GOOGLE_API_CREDENTIALS) {
      throw new Error('GOOGLE_API_CREDENTIALS environment variable not set');
    }
    
    const credentials = JSON.parse(process.env.GOOGLE_API_CREDENTIALS);
    
    // Use spreadsheets scope (not readonly) to allow writing
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets'] // WRITE scope
    );
    
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error initializing Google Sheets client:', error);
    throw error;
  }
}

// Comprehensive detailed descriptions for each add-on service
const addonDetailedDescriptions: Record<string, string> = {
  'Leather or Fabric Protector': `Professional-grade nano-coating technology that creates an invisible barrier on your interior surfaces. This advanced protectant repels liquids, prevents staining from spills, and makes cleanup effortless. Works on leather, cloth, vinyl, and carpet surfaces. The treatment is completely safe and won't alter the look or feel of your upholstery while providing months of protection. Perfect for families, pet owners, or anyone who wants to keep their interior looking pristine.`,
  
  'Light Polish': `Single-stage machine polishing that removes light oxidation, minor swirls, and water spots to restore your paint's natural shine and depth. We use premium Rupes Uno Protect polish which not only enhances gloss but also leaves behind a layer of protection. This service is ideal for vehicles that are regularly maintained but need a refresh to remove light imperfections accumulated over time. Brings back that "just detailed" appearance without the time commitment of a full paint correction.`,
  
  'Headlight Restoration': `Complete restoration process that removes oxidation, yellowing, and cloudiness from faded headlight lenses. We use a multi-stage wet-sanding and polishing system to restore optical clarity, followed by UV-protective sealant to prevent future oxidation. This service dramatically improves nighttime visibility and safety while enhancing your vehicle's appearance. Most vehicles require restoration of both headlights (sold per lens). Results typically last 1-2 years with proper care.`,
  
  '12-Month Ceramic Coating': `True SiO2 ceramic coating application providing 12 months of superior paint protection. This coating creates a permanent bond with your paint, offering exceptional resistance to UV damage, bird droppings, tree sap, road salt, and minor scratches. The hydrophobic properties create incredible water beading and make washing easier. Includes complete paint decontamination and single-stage polish before application. Perfect for customers wanting ceramic protection without the full paint correction process.`,
  
  'Plastic Trim Restoration': `Specialized treatment that revives faded, gray, or chalky black plastic trim and brings it back to its original deep black appearance. We use professional-grade restoration products that penetrate the plastic to restore color from within, not just coat the surface. Results last significantly longer than traditional trim dressings. Works on door handles, mirror housings, bumper trim, window moldings, and all exterior plastic components. Dramatically improves your vehicle's overall appearance.`,
  
  'Engine Bay Cleaning': `Thorough cosmetic cleaning and detailing of your engine compartment. We safely degrease all surfaces, remove dirt and grime buildup, then apply professional dressing to plastic and rubber components for a like-new appearance. While this is a cosmetic service (not a mechanical deep clean), it makes your engine bay look showroom-ready and helps with resale value. We use safe, engine-friendly products and proper techniques to protect sensitive components.`,
  
  'Glass/Windshield Protector': `Advanced hydrophobic glass treatment that creates an ultra-slick, water-repelling surface on all your windows. Rain beads up and sheets off at speeds as low as 35 mph, dramatically improving visibility in wet conditions. The coating also makes ice and snow removal easier in winter, reduces bug and dirt adhesion, and makes routine glass cleaning effortless. Treatment lasts 12+ months on windshields and even longer on side windows. Significantly improves driving safety in inclement weather.`,
  
  'Premium Wash': `Comprehensive hand wash service that goes well beyond a basic car wash. Includes thorough hand washing of all exterior surfaces, wheel and tire cleaning with dedicated brushes, hand drying with premium microfiber towels, tire dressing for a like-new appearance, and application of ceramic spray wax for protection and enhanced gloss. Perfect for regular maintenance between full details or as a standalone service when you want your vehicle looking its best. Takes approximately 45-60 minutes.`,
  
  'Ozone Odor Removal': `Professional ozone treatment that eliminates stubborn odors at the molecular level - not just masks them. This powerful process neutralizes smoke odors, pet smells, mildew/mold odors, and other persistent scents that traditional cleaning can't remove. We seal the vehicle and run an ozone generator that breaks down odor-causing molecules throughout the entire interior, including in air vents, upholstery, and carpet. The treatment is completely safe and leaves no chemical residue. Typically requires 1-2 hours of ozone exposure time plus airing out.`
};

async function populateAddonDetailedDescriptions() {
  try {
    console.log('🔄 Starting to populate add-on detailed descriptions...\n');
    
    const sheets = await getGoogleSheetsWriteClient();
    
    // First, read the current data to find column positions and row numbers
    console.log('📖 Reading current Add-Ons sheet structure...');
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ADDON_TAB_NAME}!A1:Z100`
    });
    
    const data = readResponse.data.values || [];
    if (data.length === 0) {
      throw new Error('No data found in Add-Ons sheet');
    }
    
    // Get headers from first row
    const headers = data[0];
    console.log('📋 Found headers:', headers);
    
    // Find column indices
    const nameColIndex = headers.findIndex((h: string) => 
      h && (h.toLowerCase().includes('service') || h.toLowerCase().includes('add-on'))
    );
    const detailedDescColIndex = headers.findIndex((h: string) => 
      h && h.toLowerCase().includes('detailed')
    );
    
    if (nameColIndex === -1) {
      throw new Error('Could not find service name column');
    }
    if (detailedDescColIndex === -1) {
      throw new Error('Could not find detailed description column');
    }
    
    console.log(`✅ Name column: ${String.fromCharCode(65 + nameColIndex)} (index ${nameColIndex})`);
    console.log(`✅ Detailed Description column: ${String.fromCharCode(65 + detailedDescColIndex)} (index ${detailedDescColIndex})\n`);
    
    // Prepare updates for each add-on service
    const updates: Array<{ range: string; values: string[][] }> = [];
    
    // Process each row (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const serviceName = row[nameColIndex]?.toString().trim();
      
      if (!serviceName) {
        console.log(`⚠️  Row ${i + 1}: Empty service name, skipping`);
        continue;
      }
      
      // Find matching detailed description
      const detailedDesc = addonDetailedDescriptions[serviceName];
      
      if (detailedDesc) {
        const colLetter = String.fromCharCode(65 + detailedDescColIndex);
        const rowNumber = i + 1; // Google Sheets is 1-indexed
        const cellRange = `${ADDON_TAB_NAME}!${colLetter}${rowNumber}`;
        
        updates.push({
          range: cellRange,
          values: [[detailedDesc]]
        });
        
        console.log(`✏️  Row ${rowNumber}: Will update "${serviceName}"`);
      } else {
        console.log(`⚠️  Row ${i + 1}: No description found for "${serviceName}"`);
      }
    }
    
    if (updates.length === 0) {
      console.log('\n⚠️  No updates to perform');
      return;
    }
    
    // Perform batch update
    console.log(`\n📝 Updating ${updates.length} detailed descriptions...`);
    
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });
    
    console.log('\n✅ Successfully updated all add-on detailed descriptions!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${updates.length} add-ons updated`);
    console.log(`   - Sheet: ${ADDON_TAB_NAME}`);
    console.log(`   - Spreadsheet ID: ${SPREADSHEET_ID}`);
    
  } catch (error) {
    console.error('\n❌ Error populating add-on descriptions:', error);
    throw error;
  }
}

// Run the script
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  populateAddonDetailedDescriptions()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { populateAddonDetailedDescriptions };
