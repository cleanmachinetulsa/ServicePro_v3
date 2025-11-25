import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

export const TWILIO_TEST_SMS_NUMBER = process.env.TWILIO_TEST_SMS_NUMBER;

let twilioClientInstance: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!accountSid || !authToken) {
    console.warn('[TWILIO CLIENT] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
    return null;
  }
  
  if (!twilioClientInstance) {
    twilioClientInstance = twilio(accountSid, authToken);
  }
  
  return twilioClientInstance;
}

export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken);
}
