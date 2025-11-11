import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

// The failed/unused messaging service
const FAILED_SERVICE_SID = 'MG75eb195e4e49322558391cffee1e7ea3';

async function cleanupFailedCampaigns() {
  console.log('🗑️  Cleaning up failed/unused campaigns to stop monthly charges...\n');

  try {
    // Delete the messaging service with failed campaign
    console.log(`Deleting messaging service: ${FAILED_SERVICE_SID}`);
    
    await client.messaging.v1.services(FAILED_SERVICE_SID).remove();
    
    console.log('✅ Deleted "Low Volume Mixed A2P Messaging Service"');
    console.log('💰 This will stop the $2-10/month recurring charge!');
    console.log('\n✅ CLEANUP COMPLETE');

  } catch (error: any) {
    console.error('Error during cleanup:', error.message);
    console.log('\nYou may need to delete this manually in Twilio Console:');
    console.log('Console → Messaging → Services → Delete the failed service');
  }
}

cleanupFailedCampaigns();
