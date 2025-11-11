import type { Express, Request, Response } from "express";
import { db } from "./db";
import { customers } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerSMSConsentRoutes(app: Express) {
  // Record SMS consent from public form
  app.post("/api/sms-consent", async (req: Request, res: Response) => {
    try {
      const { phone, name, consent } = req.body;

      if (!phone || !name || consent !== true) {
        return res.status(400).json({
          success: false,
          message: "Phone number, name, and consent are required",
        });
      }

      // Get IP address for audit trail
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

      // Check if customer exists
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.phone, phone),
      });

      if (existingCustomer) {
        // Update existing customer with consent
        await db.update(customers)
          .set({
            smsConsent: true,
            smsConsentTimestamp: new Date(),
            smsConsentIpAddress: ipAddress,
            name, // Update name in case it changed
          })
          .where(eq(customers.id, existingCustomer.id));

        console.log(`[SMS CONSENT] Updated existing customer ${existingCustomer.id} - ${name} (${phone}) from IP ${ipAddress}`);
      } else {
        // Create new customer record with consent
        await db.insert(customers).values({
          phone,
          name,
          smsConsent: true,
          smsConsentTimestamp: new Date(),
          smsConsentIpAddress: ipAddress,
        });

        console.log(`[SMS CONSENT] Created new customer - ${name} (${phone}) from IP ${ipAddress}`);
      }

      return res.json({
        success: true,
        message: "Consent recorded successfully",
      });
    } catch (error) {
      console.error("[SMS CONSENT] Error recording consent:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to record consent",
      });
    }
  });

  console.log("[SMS CONSENT] Routes registered");
}
