import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

// The verified messaging service with A2P campaign
const MESSAGING_SERVICE_SID = 'MG3c825f1ef8b2f6ad805524645fd9008b';

async function associatePhoneNumbers() {
  console.log('🔧 Associating phone numbers with verified messaging service...\n');

  try {
    // Get all phone numbers
    const phoneNumbers = await client.incomingPhoneNumbers.list();

    for (const number of phoneNumbers) {
      console.log(`\n📞 Processing: ${number.phoneNumber}`);
      
      if (number.messagingServiceSid === MESSAGING_SERVICE_SID) {
        console.log('  ✅ Already associated with messaging service');
        continue;
      }

      try {
        // Update the phone number to use the messaging service
        await client.incomingPhoneNumbers(number.sid).update({
          messagingServiceSid: MESSAGING_SERVICE_SID
        });
        
        console.log('  ✅ SUCCESS! Associated with messaging service');
        console.log(`  📋 Messaging Service: ${MESSAGING_SERVICE_SID}`);
      } catch (error: any) {
        console.log(`  ❌ ERROR: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ DONE! All phone numbers are now configured.');
    console.log('\nNOTE: The porting number (918-856-5304) will be fully active');
    console.log('once the port completes. Voice and SMS will work then.');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

associatePhoneNumbers();
