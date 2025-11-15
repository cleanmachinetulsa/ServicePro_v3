import { google } from 'googleapis';

const SPREADSHEET_ID = '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g';
const ADDON_TAB_NAME = 'Add-Ons';

async function getGoogleSheetsWriteClient() {
  const credentials = JSON.parse(process.env.GOOGLE_API_CREDENTIALS!);
  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

// Detailed descriptions for each add-on
const addonData: Record<string, { overview: string; detailed: string }> = {
  'Leather or Fabric Protector': {
    overview: 'Nano-coating repels liquids & stains for easy cleaning.',
    detailed: 'Professional-grade nano-coating technology that creates an invisible barrier on your interior surfaces. This advanced protectant repels liquids, prevents staining from spills, and makes cleanup effortless. Works on leather, cloth, vinyl, and carpet surfaces. The treatment is completely safe and won\'t alter the look or feel of your upholstery while providing months of protection. Perfect for families, pet owners, or anyone who wants to keep their interior looking pristine.'
  },
  'Light Polish': {
    overview: 'Restores shine, removes oxidation and light swirls.',
    detailed: 'Single-stage machine polishing that removes light oxidation, minor swirls, and water spots to restore your paint\'s natural shine and depth. We use premium Rupes Uno Protect polish which not only enhances gloss but also leaves behind a layer of protection. This service is ideal for vehicles that are regularly maintained but need a refresh to remove light imperfections accumulated over time. Brings back that "just detailed" appearance without the time commitment of a full paint correction.'
  },
  'Headlight Restoration': {
    overview: 'Restores faded or foggy lenses to clarity. Most customers need both headlight lenses restored.',
    detailed: 'Complete restoration process that removes oxidation, yellowing, and cloudiness from faded headlight lenses. We use a multi-stage wet-sanding and polishing system to restore optical clarity, followed by UV-protective sealant to prevent future oxidation. This service dramatically improves nighttime visibility and safety while enhancing your vehicle\'s appearance. Most vehicles require restoration of both headlights (sold per lens). Results typically last 1-2 years with proper care.'
  },
  '12-Month Ceramic Coating': {
    overview: 'Durable SiO2 coating with high gloss and protection.',
    detailed: 'True SiO2 ceramic coating application providing 12 months of superior paint protection. This coating creates a permanent bond with your paint, offering exceptional resistance to UV damage, bird droppings, tree sap, road salt, and minor scratches. The hydrophobic properties create incredible water beading and make washing easier. Includes complete paint decontamination and single-stage polish before application. Perfect for customers wanting ceramic protection without the full paint correction process.'
  },
  'Plastic Trim Restoration': {
    overview: 'Revives faded black trim with long-lasting shine.',
    detailed: 'Specialized treatment that revives faded, gray, or chalky black plastic trim and brings it back to its original deep black appearance. We use professional-grade restoration products that penetrate the plastic to restore color from within, not just coat the surface. Results last significantly longer than traditional trim dressings. Works on door handles, mirror housings, bumper trim, window moldings, and all exterior plastic components. Dramatically improves your vehicle\'s overall appearance.'
  },
  'Engine Bay Cleaning': {
    overview: 'Cosmetic cleaning and dressing under the hood.',
    detailed: 'Thorough cosmetic cleaning and detailing of your engine compartment. We safely degrease all surfaces, remove dirt and grime buildup, then apply professional dressing to plastic and rubber components for a like-new appearance. While this is a cosmetic service (not a mechanical deep clean), it makes your engine bay look showroom-ready and helps with resale value. We use safe, engine-friendly products and proper techniques to protect sensitive components.'
  },
  'Glass/Windshield Protector': {
    overview: '1+ year hydrophobic glass treatment.',
    detailed: 'Advanced hydrophobic glass treatment that creates an ultra-slick, water-repelling surface on all your windows. Rain beads up and sheets off at speeds as low as 35 mph, dramatically improving visibility in wet conditions. The coating also makes ice and snow removal easier in winter, reduces bug and dirt adhesion, and makes routine glass cleaning effortless. Treatment lasts 12+ months on windshields and even longer on side windows. Significantly improves driving safety in inclement weather.'
  },
  'Premium Wash': {
    overview: 'Thorough hand wash with ceramic wax protection.',
    detailed: 'Comprehensive hand wash service that goes well beyond a basic car wash. Includes thorough hand washing of all exterior surfaces, wheel and tire cleaning with dedicated brushes, hand drying with premium microfiber towels, tire dressing for a like-new appearance, and application of ceramic spray wax for protection and enhanced gloss. Perfect for regular maintenance between full details or as a standalone service when you want your vehicle looking its best. Takes approximately 45-60 minutes.'
  },
  'Ozone Odor Removal': {
    overview: 'Removes stubborn, unwanted odors that traditional cleaning techniques can\'t.',
    detailed: 'Professional ozone treatment that eliminates stubborn odors at the molecular level - not just masks them. This powerful process neutralizes smoke odors, pet smells, mildew/mold odors, and other persistent scents that traditional cleaning can\'t remove. We seal the vehicle and run an ozone generator that breaks down odor-causing molecules throughout the entire interior, including in air vents, upholstery, and carpet. The treatment is completely safe and leaves no chemical residue. Typically requires 1-2 hours of ozone exposure time plus airing out.'
  }
};

async function restructureAddonSheet() {
  try {
    console.log('🔄 Restructuring Add-Ons sheet with Overview and Detailed Description columns...\n');
    
    const sheets = await getGoogleSheetsWriteClient();
    
    // Read current data
    console.log('📖 Reading current Add-Ons data...');
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ADDON_TAB_NAME}!A1:Z100`
    });
    
    const data = readResponse.data.values || [];
    console.log(`📋 Found ${data.length} rows`);
    console.log(`📋 Current headers: ${data[0]?.join(', ')}\n`);
    
    // Prepare new data with Overview and Detailed Description columns
    const newData: string[][] = [];
    
    // New header row
    newData.push(['Add-On Service', 'Price', 'Overview', 'Detailed Description']);
    
    // Process each existing row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const serviceName = row[0]?.toString().trim();
      const price = row[1]?.toString().trim() || '';
      
      if (!serviceName) continue;
      
      const serviceData = addonData[serviceName];
      
      if (serviceData) {
        newData.push([
          serviceName,
          price,
          serviceData.overview,
          serviceData.detailed
        ]);
        console.log(`✏️  Updated: ${serviceName}`);
      } else {
        // Keep existing data if we don't have a match
        newData.push([
          serviceName,
          price,
          row[2] || '', // Keep existing description as overview
          '' // Empty detailed description
        ]);
        console.log(`⚠️  No data for: ${serviceName} (kept existing)`);
      }
    }
    
    // Clear and update the entire sheet
    console.log(`\n📝 Writing ${newData.length} rows to sheet...`);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ADDON_TAB_NAME}!A1:D${newData.length}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: newData
      }
    });
    
    console.log('\n✅ Successfully restructured Add-Ons sheet!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${newData.length - 1} add-ons updated`);
    console.log(`   - New columns: Add-On Service, Price, Overview, Detailed Description`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  restructureAddonSheet()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed:', error);
      process.exit(1);
    });
}

export { restructureAddonSheet };
