import { Router, Request, Response } from "express";
import twilio from "twilio";
import { getTwilioClient, TWILIO_TEST_SMS_NUMBER } from "../twilioClient";
import { generateVoicemailFollowupSms, generateVoicemailSummary } from "../openai";
import { syncVoicemailIntoConversation } from "../services/voicemailConversationService";
import { db } from "../db";
import { wrapTenantDb } from "../tenantDb";
import { phoneLines } from "@shared/schema";
import { eq } from "drizzle-orm";

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
            "Press the pound key when you are finished."
        );
        vr.record({
          playBeep: true,
          maxLength: 120,
          action: "/api/twilio/voice/voicemail-complete",
          method: "POST",
          finishOnKey: "#",
          transcribe: true,
          transcribeCallback: "/api/twilio/voice/voicemail-transcription",
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

/**
 * POST /api/twilio/voice/voicemail-transcription
 * Twilio calls this AFTER transcribing the voicemail (async, separate from the call flow).
 * We:
 * - Read TranscriptionText, From, To, RecordingUrl
 * - Generate an AI-powered SMS reply
 * - Send that SMS to the caller
 * - Return 200 OK (no TwiML needed)
 */
twilioTestVoiceRouter.post(
  "/voicemail-transcription",
  async (req: Request, res: Response) => {
    const body = req.body as any;

    const from = body.From as string | undefined;
    const to = body.To as string | undefined;
    const transcriptionText = body.TranscriptionText as string | undefined;
    const recordingUrl = body.RecordingUrl as string | undefined;

    console.log("[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Incoming:", {
      from,
      to,
      hasTranscription: !!transcriptionText,
      transcriptionPreview: transcriptionText
        ? transcriptionText.slice(0, 120)
        : null,
      recordingUrl,
    });

    try {
      if (!from || !to) {
        console.error(
          "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Missing From/To fields",
          { from, to }
        );
        res.status(200).send("OK");
        return;
      }

      if (!transcriptionText || !transcriptionText.trim()) {
        console.warn(
          "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] No transcription text provided"
        );
        if (twilioClient && TWILIO_TEST_SMS_NUMBER) {
          await twilioClient.messages.create({
            from: TWILIO_TEST_SMS_NUMBER as string,
            to: from,
            body:
              "Thanks for your voicemail! We received your message and will review it shortly.",
          });
        }
        res.status(200).send("OK");
        return;
      }

      let aiReply: string;
      let voicemailSummary: string | null = null;
      
      try {
        aiReply = await generateVoicemailFollowupSms(transcriptionText);
      } catch (err: any) {
        console.error(
          "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Error generating AI reply:",
          err
        );
        aiReply =
          "Thanks for your voicemail! We received your message and will follow up with more details soon.";
      }

      try {
        voicemailSummary = await generateVoicemailSummary({
          transcriptionText,
          fromPhone: from,
          toPhone: to,
          recordingUrl,
          tenantName: "Clean Machine Auto Detail",
        });
        console.log("[voicemail-summary] Generated summary:", {
          from,
          to,
          hasSummary: !!voicemailSummary,
        });
      } catch (summaryErr: any) {
        console.warn(
          "[voicemail-summary] Error generating summary (continuing without):",
          summaryErr
        );
      }

      console.log(
        "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] AI reply about to send:",
        aiReply
      );

      if (!twilioClient || !TWILIO_TEST_SMS_NUMBER) {
        console.error(
          "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Cannot send SMS; Twilio client or from number missing.",
          { hasClient: !!twilioClient, fromNumber: TWILIO_TEST_SMS_NUMBER }
        );
      } else {
        const msg = await twilioClient.messages.create({
          from: TWILIO_TEST_SMS_NUMBER as string,
          to: from,
          body: aiReply,
        });
        console.log(
          "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] SMS sent to caller:",
          { sid: msg.sid, status: msg.status }
        );
      }

      try {
        if (transcriptionText && transcriptionText.trim().length > 0) {
          const tenantDb = wrapTenantDb(db, "root");
          
          let phoneLineId: number | undefined;
          if (to) {
            const [phoneLine] = await tenantDb
              .select()
              .from(phoneLines)
              .where(tenantDb.withTenantFilter(phoneLines, eq(phoneLines.phoneNumber, to)))
              .limit(1);
            
            if (phoneLine) {
              phoneLineId = phoneLine.id;
              console.log("[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Resolved phone line:", phoneLine.label);
            }
          }

          await syncVoicemailIntoConversation(tenantDb, {
            fromPhone: from,
            toPhone: to,
            transcriptionText,
            recordingUrl,
            aiReplyText: aiReply,
            voicemailSummary,
            phoneLineId,
          });
          console.log(
            "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Voicemail synced into conversation DB"
          );
        } else {
          console.warn(
            "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Skipping conversation sync - no transcription text"
          );
        }
      } catch (syncErr: any) {
        console.error(
          "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Error syncing voicemail into conversation DB:",
          syncErr
        );
      }

      res.status(200).send("OK");
    } catch (err: any) {
      console.error(
        "[TWILIO TEST VOICE VOICEMAIL TRANSCRIPTION] Unhandled error:",
        err
      );
      res.status(200).send("OK");
    }
  }
);

console.log("[TWILIO TEST] Inbound Voice handlers READY at /api/twilio/voice/inbound, /handle-key, /voicemail-complete, /voicemail-transcription");

export default twilioTestVoiceRouter;
