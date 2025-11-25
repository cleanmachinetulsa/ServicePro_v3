import { Router } from "express";

const debugEnvRouter = Router();

debugEnvRouter.get("/twilio", (req, res) => {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_TEST_SMS_NUMBER,
  } = process.env;

  res.json({
    ok: true,
    TWILIO_ACCOUNT_SID_present: !!TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN_present: !!TWILIO_AUTH_TOKEN,
    TWILIO_TEST_SMS_NUMBER_value: TWILIO_TEST_SMS_NUMBER || null,
  });
});

export { debugEnvRouter };
