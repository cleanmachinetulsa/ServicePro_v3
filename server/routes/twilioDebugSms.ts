import { Router } from "express";
import { twilioClient, TWILIO_TEST_SMS_NUMBER, assertTwilioReady } from "../twilioClient";

const twilioDebugSmsRouter = Router();

/**
 * GET /api/twilio/sms/debug-send?to=+1XXXXXXXXXX
 * Sends a simple test SMS using TWILIO_TEST_SMS_NUMBER as the from number.
 */
twilioDebugSmsRouter.get("/debug-send", async (req, res) => {
  try {
    console.log("[TWILIO DEBUG SMS] Incoming debug-send request", {
      query: req.query,
    });

    const to = req.query.to as string | undefined;

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Missing 'to' query param, e.g. /debug-send?to=+1918XXXXXXX",
      });
    }

    assertTwilioReady();

    if (!twilioClient) {
      throw new Error("[TWILIO DEBUG SMS] twilioClient is null after assert – unexpected.");
    }

    console.log("[TWILIO DEBUG SMS] Sending test SMS", {
      from: TWILIO_TEST_SMS_NUMBER,
      to,
    });

    const result = await twilioClient.messages.create({
      from: TWILIO_TEST_SMS_NUMBER as string,
      to,
      body: "ServicePro Twilio test: outbound SMS is working. 🎉",
    });

    console.log("[TWILIO DEBUG SMS] Twilio response", {
      sid: result.sid,
      status: result.status,
    });

    res.json({
      ok: true,
      sid: result.sid,
      status: result.status,
    });
  } catch (err: any) {
    console.error("[TWILIO DEBUG SMS] Error sending test SMS:", err);
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});

export { twilioDebugSmsRouter };
