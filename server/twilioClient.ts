import Twilio from "twilio";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_TEST_SMS_NUMBER: TWILIO_TEST_SMS_NUMBER_ENV,
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.warn(
    "[TWILIO CLIENT] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing. Twilio client will be null."
  );
}

if (!TWILIO_TEST_SMS_NUMBER_ENV) {
  console.warn(
    "[TWILIO CLIENT] TWILIO_TEST_SMS_NUMBER is NOT set. Outbound test SMS will fail until this is configured."
  );
}

export const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

export const TWILIO_TEST_SMS_NUMBER = TWILIO_TEST_SMS_NUMBER_ENV
  ? TWILIO_TEST_SMS_NUMBER_ENV.trim()
  : null;

export function assertTwilioReady() {
  if (!twilioClient) {
    throw new Error(
      "[TWILIO CLIENT] Twilio client not initialized – check TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN."
    );
  }
  if (!TWILIO_TEST_SMS_NUMBER) {
    throw new Error(
      "[TWILIO CLIENT] TWILIO_TEST_SMS_NUMBER is not set. Configure it in Replit secrets as your test number in E.164 format, e.g. +1918..."
    );
  }
}

export function getTwilioClient() {
  return twilioClient;
}

export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}
