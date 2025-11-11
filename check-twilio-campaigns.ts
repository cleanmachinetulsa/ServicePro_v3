import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function checkCampaignStatus() {
  console.log('='.repeat(80));
  console.log('TWILIO A2P 10DLC CAMPAIGN STATUS CHECK');
  console.log('='.repeat(80));
  console.log();

  // 1. Check all phone numbers
  console.log('📞 YOUR PHONE NUMBERS:');
  console.log('-'.repeat(80));
  try {
    const phoneNumbers = await client.incomingPhoneNumbers.list();
    
    if (phoneNumbers.length === 0) {
      console.log('❌ No phone numbers found');
    } else {
      for (const number of phoneNumbers) {
        console.log(`\n  Number: ${number.phoneNumber}`);
        console.log(`  Friendly Name: ${number.friendlyName || 'N/A'}`);
        console.log(`  SMS Capable: ${number.capabilities.sms ? 'Yes' : 'No'}`);
        console.log(`  Voice Capable: ${number.capabilities.voice ? 'Yes' : 'No'}`);
        console.log(`  Messaging Service SID: ${number.messagingServiceSid || '❌ NOT ASSOCIATED'}`);
        console.log(`  Status: ${number.status}`);
      }
    }
  } catch (error: any) {
    console.error('Error fetching phone numbers:', error.message);
  }

  console.log('\n' + '='.repeat(80));

  // 2. Check all Messaging Services
  console.log('\n💬 MESSAGING SERVICES:');
  console.log('-'.repeat(80));
  try {
    const messagingServices = await client.messaging.v1.services.list();
    
    if (messagingServices.length === 0) {
      console.log('❌ No messaging services found');
    } else {
      for (const service of messagingServices) {
        console.log(`\n  Service Name: ${service.friendlyName}`);
        console.log(`  SID: ${service.sid}`);
        
        // Get phone numbers in this service
        const phoneNumbersInService = await client.messaging.v1
          .services(service.sid)
          .phoneNumbers
          .list();
        
        console.log(`  Phone Numbers: ${phoneNumbersInService.length > 0 ? phoneNumbersInService.map(p => p.phoneNumber).join(', ') : '❌ None'}`);
      }
    }
  } catch (error: any) {
    console.error('Error fetching messaging services:', error.message);
  }

  console.log('\n' + '='.repeat(80));

  // 3. Check A2P Brands
  console.log('\n🏢 A2P BRANDS (Your Business Registration):');
  console.log('-'.repeat(80));
  try {
    const brands = await client.messaging.v1.a2p.brands.list();
    
    if (brands.length === 0) {
      console.log('❌ No A2P brands found - YOU NEED TO REGISTER YOUR BUSINESS FIRST!');
    } else {
      for (const brand of brands) {
        console.log(`\n  Brand Name: ${brand.friendlyName || brand.sid}`);
        console.log(`  Brand SID: ${brand.sid}`);
        console.log(`  Status: ${brand.status}`);
        console.log(`  Brand Type: ${brand.brandType}`);
        console.log(`  Identity Status: ${brand.identityStatus}`);
      }
    }
  } catch (error: any) {
    console.error('Error fetching A2P brands:', error.message);
  }

  console.log('\n' + '='.repeat(80));

  // 4. Check A2P Campaigns
  console.log('\n📋 A2P CAMPAIGNS (Your Use Case Registration):');
  console.log('-'.repeat(80));
  try {
    const brands = await client.messaging.v1.a2p.brands.list();
    
    if (brands.length === 0) {
      console.log('❌ No brands = No campaigns possible');
    } else {
      let foundCampaigns = false;
      
      for (const brand of brands) {
        console.log(`\n  Checking campaigns for brand: ${brand.friendlyName || brand.sid}`);
        
        try {
          const campaigns = await client.messaging.v1.a2p
            .brands(brand.sid)
            .brandRegistrations
            .list();
          
          if (campaigns.length === 0) {
            console.log(`  ❌ No campaigns for this brand`);
          } else {
            foundCampaigns = true;
            for (const campaign of campaigns) {
              console.log(`\n    Campaign Description: ${campaign.description || 'N/A'}`);
              console.log(`    Campaign SID: ${campaign.sid}`);
              console.log(`    Status: ${campaign.status}`);
              console.log(`    Use Case: ${campaign.usecase || 'N/A'}`);
            }
          }
        } catch (err: any) {
          console.log(`  Error checking campaigns: ${err.message}`);
        }
      }
      
      if (!foundCampaigns) {
        console.log('\n  ❌ NO CAMPAIGNS FOUND - YOU NEED TO CREATE A CAMPAIGN!');
      }
    }
  } catch (error: any) {
    console.error('Error fetching A2P campaigns:', error.message);
  }

  console.log('\n' + '='.repeat(80));

  // 5. Try to check messaging service A2P associations
  console.log('\n🔗 A2P CAMPAIGN → MESSAGING SERVICE ASSOCIATIONS:');
  console.log('-'.repeat(80));
  try {
    const messagingServices = await client.messaging.v1.services.list();
    
    if (messagingServices.length === 0) {
      console.log('❌ No messaging services to check');
    } else {
      for (const service of messagingServices) {
        console.log(`\n  Messaging Service: ${service.friendlyName}`);
        
        try {
          // Try to get US A2P associations
          const usA2pAssociations = await client.messaging.v1
            .services(service.sid)
            .usAppToPerson
            .list();
          
          if (usA2pAssociations.length === 0) {
            console.log(`  ❌ NOT ASSOCIATED WITH ANY A2P CAMPAIGN`);
          } else {
            for (const assoc of usA2pAssociations) {
              console.log(`  ✅ Campaign SID: ${assoc.campaignSid}`);
              console.log(`  ✅ Status: ${assoc.campaignStatus}`);
            }
          }
        } catch (err: any) {
          console.log(`  Error checking associations: ${err.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error checking associations:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS:');
  console.log('='.repeat(80));
  console.log(`
For Error 30034 (Unregistered Number) to be fixed, you need:

1. ✅ A2P Brand registered (business info)
2. ✅ A2P Campaign registered (use case)
3. ✅ Messaging Service created
4. ✅ Campaign associated with Messaging Service
5. ✅ Phone number added to Messaging Service's sender pool

The output above will show which of these steps are missing!
  `);
}

checkCampaignStatus().catch(console.error);
