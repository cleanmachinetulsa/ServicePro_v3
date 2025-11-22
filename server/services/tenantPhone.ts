/**
 * Tenant Phone Configuration Service
 * 
 * Phase 2.2: Loader functions for multi-tenant phone configuration
 * Enables dynamic tenant routing based on Twilio phone numbers
 */

import { eq } from "drizzle-orm";
import { tenantPhoneConfig } from "../../shared/schema";
import type { DB } from "../db";

/**
 * Get phone configuration for a specific tenant
 * 
 * @param db - Database instance
 * @param tenantId - Tenant ID to lookup
 * @returns Phone configuration or undefined if not found
 */
export async function getTenantPhoneConfig(db: DB, tenantId: string) {
  return await db.query.tenantPhoneConfig.findFirst({
    where: eq(tenantPhoneConfig.tenantId, tenantId),
  });
}

/**
 * Get tenant by phone number (reverse lookup)
 * 
 * This is the key function for dynamic tenant routing in Phase 2.2.
 * When Twilio calls /twilio/voice/incoming with req.body.To,
 * we look up which tenant owns that phone number.
 * 
 * @param db - Database instance
 * @param phoneNumber - E.164 format phone number (e.g., +19188565304)
 * @returns Tenant phone configuration or undefined if not found
 */
export async function getTenantByPhoneNumber(db: DB, phoneNumber: string) {
  return await db.query.tenantPhoneConfig.findFirst({
    where: eq(tenantPhoneConfig.phoneNumber, phoneNumber),
  });
}

/**
 * Get all phone configurations (for admin dashboard)
 * 
 * @param db - Database instance
 * @returns Array of all tenant phone configurations
 */
export async function getAllTenantPhoneConfigs(db: DB) {
  return await db.query.tenantPhoneConfig.findMany();
}
