import type { Request, Response } from "express";
import { twiml as Twiml } from "twilio";

const LEGACY_NUMBER = process.env.LEGACY_CLEAN_MACHINE_NUMBER_E164 || "";
const LEGACY_WEBHOOK_URL = process.env.LEGACY_CLEAN_MACHINE_SMS_WEBHOOK_URL || "";

function normalizeNumber(raw: any): string | null {
  if (typeof raw !== "string") return null;
  return raw.replace(/[^\d+]/g, "");
}

export async function forwardToLegacyCleanMachine(
  req: Request,
  res: Response
): Promise<void> {
  if (!LEGACY_WEBHOOK_URL || !LEGACY_NUMBER) {
    console.error("[SMS ROUTER] Legacy forwarding requested but env vars are missing.", {
      LEGACY_NUMBER_present: !!LEGACY_NUMBER,
      LEGACY_WEBHOOK_URL_present: !!LEGACY_WEBHOOK_URL,
    });
    const twiml = new Twiml.MessagingResponse();
    twiml.message(
      "We're experiencing a temporary routing issue. Please try again in a few minutes."
    );
    res.type("text/xml").status(200).send(twiml.toString());
    return;
  }

  try {
    console.log("[SMS ROUTER] Forwarding inbound SMS to legacy Clean Machine webhook", {
      LEGACY_WEBHOOK_URL,
    });

    const body = req.body as Record<string, any>;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        params.append(key, value);
      }
    }

    const upstreamResponse = await fetch(LEGACY_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const text = await upstreamResponse.text();

    console.log("[SMS ROUTER] Legacy webhook responded", {
      status: upstreamResponse.status,
      ok: upstreamResponse.ok,
      length: text.length,
    });

    res.status(200).type("text/xml").send(text);
  } catch (err: any) {
    console.error("[SMS ROUTER] Error forwarding to legacy Clean Machine webhook:", err);
    const twiml = new Twiml.MessagingResponse();
    twiml.message(
      "We hit an error routing your message. Please call or text again shortly."
    );
    res.type("text/xml").status(200).send(twiml.toString());
  }
}

export function shouldRouteToLegacyCleanMachine(req: Request): boolean {
  const body = req.body as Record<string, any>;
  const toRaw = body.To;
  const toNorm = normalizeNumber(toRaw);
  const legacyNorm = normalizeNumber(LEGACY_NUMBER);

  console.log("[SMS ROUTER] Routing decision", {
    rawTo: toRaw,
    normalizedTo: toNorm,
    legacyNumberNormalized: legacyNorm,
    LEGACY_WEBHOOK_URL_present: !!LEGACY_WEBHOOK_URL,
  });

  if (!toNorm || !legacyNorm) return false;
  return toNorm === legacyNorm;
}
