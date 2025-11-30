import { sendSMS } from './server/notifications.js';

async function testTwilioSMS() {
  const businessPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE || '+19188565304';
  
  console.log(`📱 Testing Twilio SMS to: ${businessPhone}`);
  console.log(`📞 From Twilio number: ${process.env.MAIN_PHONE_NUMBER}`);
  console.log(`🔑 Using Account SID: ${process.env.TWILIO_ACCOUNT_SID?.substring(0, 10)}...`);
  
  const testMessage = `🎉 Clean Machine SMS Test! Your 918 A2P 10DLC campaign is LIVE and working! Message sent at ${new Date().toLocaleString()}`;
  
  const result = await sendSMS(businessPhone, testMessage);
  
  if (result.success) {
    console.log('✅ SMS sent successfully!');
    console.log(`📬 Message SID: ${result.messageSid}`);
  } else {
    console.error('❌ SMS failed:', result.error);
    process.exit(1);
  }
}

testTwilioSMS().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
