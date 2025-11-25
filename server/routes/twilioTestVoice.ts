import { Router } from "express";
import twilio from "twilio";
import { getTwilioClient, TWILIO_TEST_SMS_NUMBER } from "../twilioClient";

export const twilioTestVoiceRouter = Router();

const VoiceResponse = twilio.twiml.VoiceResponse;
const twilioClient = getTwilioClient();

twilioTestVoiceRouter.post("/inbound", (req, res) => {
  const vr = new VoiceResponse();

  try {
    console.log("[TWILIO TEST VOICE INBOUND] Raw body:", req.body);
    console.log("[TWILIO TEST VOICE INBOUND] Parsed fields:", {
      From: (req.body as any)?.From,
      To: (req.body as any)?.To,
      CallSid: (req.body as any)?.CallSid,
      Digits: (req.body as any)?.Digits,
    });
    
    const { From, To } = req.body || {};

    const gather = vr.gather({
      input: ["dtmf"],
      numDigits: 1,
      action: "/api/twilio/voice/handle-key",
      method: "POST",
      timeout: 6,
    });

    gather.say(
      {
        voice: "alice",
        language: "en-US",
      },
      "Thanks for calling Clean Machine Auto Detail, powered by Service Pro. " +
        "Press 1 for basic business information. " +
        "Press 2 to receive a text message link to our online booking. " +
        "Press 3 to leave a voicemail for our team."
    );

    vr.redirect("/api/twilio/voice/inbound");

    const twiml = vr.toString();
    console.log("[TWILIO TEST VOICE INBOUND] Responding with TwiML:", twiml);
    res.type("text/xml").status(200).send(twiml);
  } catch (err) {
    console.error("[TWILIO TEST VOICE ERROR - INBOUND]", err);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say(
      { voice: "alice", language: "en-US" },
      "Sorry, something went wrong on our end. Please try again later."
    );
    res.type("text/xml").send(errorTwiml.toString());
  }
});

twilioTestVoiceRouter.post("/handle-key", async (req, res) => {
  console.log("[TWILIO TEST VOICE HANDLE-KEY] Body:", req.body);
  
  const { Digits, From } = req.body || {};
  const vr = new VoiceResponse();

  console.log("[TWILIO TEST VOICE HANDLE KEY] Parsed:", { Digits, From });

  try {
    switch (Digits) {
      case "1":
        vr.say(
          { voice: "alice", language: "en-US" },
          "Clean Machine Auto Detail is Tulsa's highest rated mobile detailing company. " +
            "You can book online 24 7 or text this number at any time for instant scheduling."
        );
        vr.hangup();
        break;

      case "2":
        if (twilioClient && TWILIO_TEST_SMS_NUMBER && From) {
          try {
            await twilioClient.messages.create({
              from: TWILIO_TEST_SMS_NUMBER,
              to: From,
              body:
                "Here's your Clean Machine booking link: https://cleanmachinetulsa.com. " +
                "You can text this number any time to ask questions or book.",
            });
            console.log("[TWILIO TEST VOICE] Sent follow-up SMS to", From);
          } catch (smsErr) {
            console.error("[TWILIO TEST VOICE] Error sending SMS", smsErr);
          }
        }

        vr.say(
          { voice: "alice", language: "en-US" },
          "Perfect. We've sent a text message to your phone with a booking link. Goodbye."
        );
        vr.hangup();
        break;

      case "3":
        vr.say(
          { voice: "alice", language: "en-US" },
          "Please leave your name, number, and a brief description of your vehicle and what you need. " +
            "Press any key when you are finished."
        );
        vr.record({
          playBeep: true,
          maxLength: 120,
          action: "/api/twilio/voice/voicemail-complete",
          method: "POST",
          finishOnKey: "1",
        });
        break;

      default:
        vr.say(
          { voice: "alice", language: "en-US" },
          "Sorry, I didn't understand that choice."
        );
        vr.redirect("/api/twilio/voice/inbound");
        break;
    }
  } catch (err) {
    console.error("[TWILIO TEST VOICE ERROR - HANDLE KEY]", err);
    vr.say(
      { voice: "alice", language: "en-US" },
      "Sorry, something went wrong while handling your choice. Goodbye."
    );
    vr.hangup();
  }

  const twiml = vr.toString();
  console.log("[TWILIO TEST VOICE HANDLE-KEY] Responding with TwiML:", twiml);
  res.type("text/xml").status(200).send(twiml);
});

twilioTestVoiceRouter.post("/voicemail-complete", (req, res) => {
  try {
    const { RecordingUrl, RecordingDuration, From } = req.body || {};

    console.log("[TWILIO TEST VOICEMAIL COMPLETE]", {
      From,
      RecordingUrl,
      RecordingDuration,
    });

    const vr = new VoiceResponse();
    vr.say(
      { voice: "alice", language: "en-US" },
      "Thank you. Your message has been received. We will review it and get back to you as soon as possible. Goodbye."
    );
    vr.hangup();

    const twiml = vr.toString();
    console.log("[TWILIO TEST VOICE VOICEMAIL-COMPLETE] Responding with TwiML:", twiml);
    res.type("text/xml").status(200).send(twiml);
  } catch (err) {
    console.error("[TWILIO TEST VOICE ERROR - VOICEMAIL COMPLETE]", err);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say(
      { voice: "alice", language: "en-US" },
      "Sorry, something went wrong. Goodbye."
    );
    errorTwiml.hangup();
    res.type("text/xml").send(errorTwiml.toString());
  }
});

console.log("[TWILIO TEST] Inbound Voice handlers READY at /api/twilio/voice/inbound, /handle-key, /voicemail-complete");

export default twilioTestVoiceRouter;
