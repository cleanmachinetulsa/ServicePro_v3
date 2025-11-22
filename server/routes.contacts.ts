/**
 * API Routes - Contacts & Third-Party Billing
 * 
 * Handles contact management, deduplication, and role assignment
 */

import type { Express, Request, Response } from "express";
import { contacts, appointments, authorizations, paymentLinks, giftCards } from "@shared/schema";
import { eq, or, sql, desc, and } from "drizzle-orm";
import {
  upsertContact,
  findPotentialDuplicates,
  searchContacts,
  mergeContacts,
  normalizePhoneE164,
  canonicalizeEmail,
} from "./contactUtils";
import { requireAuth } from "./authMiddleware";
import { z } from "zod";

// Validation schemas
const upsertContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email().optional().nullable(),
  company: z.string().optional().nullable(),
  roleTags: z.array(z.string()).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zip: z.string().max(10).optional().nullable(),
  notificationPrefs: z.object({
    sms: z.boolean(),
    email: z.boolean(),
  }).optional(),
  notes: z.string().optional().nullable(),
});

const searchContactsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

const mergeContactsSchema = z.object({
  primaryContactId: z.number().int().positive(),
  duplicateContactId: z.number().int().positive(),
});

const assignRolesSchema = z.object({
  appointmentId: z.number().int().positive(),
  requesterContactId: z.number().int().positive().optional().nullable(),
  serviceContactId: z.number().int().positive().optional().nullable(),
  vehicleOwnerContactId: z.number().int().positive().optional().nullable(),
  billingContactId: z.number().int().positive().optional().nullable(),
  billingType: z.enum(['self', 'third_party', 'gift', 'company_po']).optional(),
  sharePriceWithRequester: z.boolean().optional(),
  shareLocationWithPayer: z.boolean().optional(),
  isGift: z.boolean().optional(),
  giftMessage: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
});

export function registerContactsRoutes(app: Express) {
  /**
   * POST /api/contacts/upsert
   * Create or update contact with automatic deduplication
   */
  app.post("/api/contacts/upsert", requireAuth, async (req: Request, res: Response) => {
    try {
      const validated = upsertContactSchema.parse(req.body);

      const result = await upsertContact({
        ...validated,
        createdBy: req.user!.id,
      });

      return res.json({
        success: true,
        contact: result.contact,
        isNew: result.isNew,
        potentialDuplicates: result.potentialDuplicates,
      });
    } catch (error: any) {
      console.error("Error upserting contact:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Failed to create/update contact",
      });
    }
  });

  /**
   * GET /api/contacts/search
   * Search contacts by phone, email, or name
   */
  app.get("/api/contacts/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const { query, limit } = searchContactsSchema.parse({
        query: req.query.query as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      });

      const results = await searchContacts(query, limit);

      return res.json({
        success: true,
        contacts: results,
      });
    } catch (error: any) {
      console.error("Error searching contacts:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Failed to search contacts",
      });
    }
  });

  /**
   * POST /api/contacts/find-duplicates
   * Find potential duplicate contacts using fuzzy matching
   */
  app.post("/api/contacts/find-duplicates", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, phone, email } = req.body;

      const phoneE164 = phone ? normalizePhoneE164(phone) : undefined;
      const canonicalEmail = email ? canonicalizeEmail(email) : undefined;

      const duplicates = await findPotentialDuplicates({
        name,
        phoneE164: phoneE164 || undefined,
        email: canonicalEmail || undefined,
      });

      return res.json({
        success: true,
        duplicates,
      });
    } catch (error: any) {
      console.error("Error finding duplicates:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Failed to find duplicates",
      });
    }
  });

  /**
   * POST /api/contacts/merge
   * Merge two duplicate contacts
   */
  app.post("/api/contacts/merge", requireAuth, async (req: Request, res: Response) => {
    try {
      const { primaryContactId, duplicateContactId } = mergeContactsSchema.parse(req.body);

      if (primaryContactId === duplicateContactId) {
        return res.status(400).json({
          success: false,
          error: "Cannot merge contact with itself",
        });
      }

      const merged = await mergeContacts(primaryContactId, duplicateContactId);

      return res.json({
        success: true,
        contact: merged,
      });
    } catch (error: any) {
      console.error("Error merging contacts:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Failed to merge contacts",
      });
    }
  });

  /**
   * GET /api/contacts/:id
   * Get contact by ID with related appointments
   */
  app.get("/api/contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.id);

      const contact = await req.tenantDb!
        .select()
        .from(contacts)
        .where(req.tenantDb!.withTenantFilter(contacts, eq(contacts.id, contactId)))
        .execute();

      if (!contact[0]) {
        return res.status(404).json({
          success: false,
          error: "Contact not found",
        });
      }

      // Get related appointments
      const relatedAppointments = await req.tenantDb!
        .select()
        .from(appointments)
        .where(
          req.tenantDb!.withTenantFilter(
            appointments,
            or(
              eq(appointments.requesterContactId, contactId),
              eq(appointments.serviceContactId, contactId),
              eq(appointments.vehicleOwnerContactId, contactId),
              eq(appointments.billingContactId, contactId)
            )
          )
        )
        .orderBy(desc(appointments.scheduledTime))
        .limit(10)
        .execute();

      return res.json({
        success: true,
        contact: contact[0],
        relatedAppointments,
      });
    } catch (error: any) {
      console.error("Error fetching contact:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch contact",
      });
    }
  });

  /**
   * PUT /api/contacts/:id
   * Update contact
   */
  app.put("/api/contacts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.id);
      const updates = req.body;

      const updated = await req.tenantDb!
        .update(contacts)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contactId))
        .returning()
        .execute();

      if (!updated[0]) {
        return res.status(404).json({
          success: false,
          error: "Contact not found",
        });
      }

      return res.json({
        success: true,
        contact: updated[0],
      });
    } catch (error: any) {
      console.error("Error updating contact:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Failed to update contact",
      });
    }
  });

  /**
   * POST /api/appointments/:id/assign-roles
   * Assign role-based contacts to appointment
   */
  app.post("/api/appointments/:id/assign-roles", requireAuth, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const validated = assignRolesSchema.parse({ ...req.body, appointmentId });

      // Update appointment with role assignments
      const updated = await req.tenantDb!
        .update(appointments)
        .set({
          requesterContactId: validated.requesterContactId,
          serviceContactId: validated.serviceContactId,
          vehicleOwnerContactId: validated.vehicleOwnerContactId,
          billingContactId: validated.billingContactId,
          billingType: validated.billingType || 'self',
          sharePriceWithRequester: validated.sharePriceWithRequester ?? true,
          shareLocationWithPayer: validated.shareLocationWithPayer ?? false,
          isGift: validated.isGift ?? false,
          giftMessage: validated.giftMessage,
          poNumber: validated.poNumber,
        })
        .where(eq(appointments.id, appointmentId))
        .returning()
        .execute();

      if (!updated[0]) {
        return res.status(404).json({
          success: false,
          error: "Appointment not found",
        });
      }

      return res.json({
        success: true,
        appointment: updated[0],
      });
    } catch (error: any) {
      console.error("Error assigning roles:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Failed to assign roles",
      });
    }
  });

  /**
   * GET /api/appointments/:id/roles
   * Get all role contacts for an appointment
   */
  app.get("/api/appointments/:id/roles", requireAuth, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id);

      const appointment = await req.tenantDb!
        .select()
        .from(appointments)
        .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)))
        .execute();

      if (!appointment[0]) {
        return res.status(404).json({
          success: false,
          error: "Appointment not found",
        });
      }

      const appt = appointment[0];

      // Fetch all related contacts
      const contactIds = [
        appt.requesterContactId,
        appt.serviceContactId,
        appt.vehicleOwnerContactId,
        appt.billingContactId,
      ].filter((id): id is number => id !== null && id !== undefined);

      let roleContacts: any = {};

      if (contactIds.length > 0) {
        const fetchedContacts = await req.tenantDb!
          .select()
          .from(contacts)
          .where(req.tenantDb!.withTenantFilter(contacts, sql`${contacts.id} IN ${contactIds}`))
          .execute();

        // Map contacts to roles
        roleContacts = {
          requester: fetchedContacts.find(c => c.id === appt.requesterContactId) || null,
          serviceContact: fetchedContacts.find(c => c.id === appt.serviceContactId) || null,
          vehicleOwner: fetchedContacts.find(c => c.id === appt.vehicleOwnerContactId) || null,
          billing: fetchedContacts.find(c => c.id === appt.billingContactId) || null,
        };
      }

      return res.json({
        success: true,
        appointment: appt,
        roles: roleContacts,
      });
    } catch (error: any) {
      console.error("Error fetching appointment roles:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch appointment roles",
      });
    }
  });
}
