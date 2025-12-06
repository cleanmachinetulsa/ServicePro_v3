/**
 * Support Context Service
 * 
 * Provides tenant/user context data for the Support AI Assistant.
 * Reusable by both the bootstrap endpoint and the assistant service.
 */

import { db } from "../db";
import { tenants, tenantConfig, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { supportTicketService } from "./supportTicketService";

export interface SupportContext {
  tenant: {
    id: string;
    name: string;
    slug?: string;
    plan?: string;
    features?: Record<string, boolean>;
    telephonyStatus?: {
      status: string;
      hasNumber: boolean;
      number?: string;
    };
    emailStatus?: {
      status: string;
      provider: string;
    };
  };
  user: {
    id: number;
    name?: string;
    role: string;
  };
  openTickets: Array<{
    id: number;
    subject: string;
    status: string;
    priority: string;
  }>;
}

/**
 * Get complete context for a tenant/user pair
 * Used by AI assistant to understand the user's situation
 */
export async function getSupportContextForTenantUser(
  tenantId: string,
  userId: number
): Promise<SupportContext> {
  // Get tenant info
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // Get tenant config for features
  const [config] = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  // Get user info
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Get open tickets
  const openTickets = await supportTicketService.getOpenTicketsForAI(tenantId);

  return {
    tenant: {
      id: tenantId,
      name: tenant?.name || "Unknown",
      slug: tenant?.subdomain || undefined,
      plan: config?.planTier || "free",
      features: {
        aiSmsAgent: config?.featureAiSmsAgent || false,
        aiVoiceAgent: config?.featureAiVoiceAgent || false,
        campaigns: config?.featureCampaigns || false,
        dedicatedNumber: config?.featureDedicatedNumber || false,
        customDomain: config?.featureCustomDomain || false,
        crm: config?.featureCrm || false,
        loyalty: config?.featureLoyalty || false,
        multiUser: config?.featureMultiUser || false,
        advancedAnalytics: config?.featureAdvancedAnalytics || false,
        websiteGenerator: config?.featureWebsiteGenerator || false,
        dataExport: config?.featureDataExport || false,
        prioritySupport: config?.featurePrioritySupport || false,
      },
      telephonyStatus: {
        status: config?.a2pStatus || "unknown",
        hasNumber: !!config?.twilioPhoneNumber,
        number: config?.twilioPhoneNumber || undefined,
      },
      emailStatus: {
        status: "active",
        provider: "sendgrid",
      },
    },
    user: {
      id: user?.id || userId,
      name: user?.fullName || user?.username || "Unknown",
      role: user?.role || "staff",
    },
    openTickets: openTickets.map(t => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
    })),
  };
}

/**
 * Format context for embedding in an OpenAI prompt
 */
export function formatContextForPrompt(context: SupportContext): string {
  const features = context.tenant.features || {};
  const enabledFeatures = Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);

  const ticketList = context.openTickets.length > 0
    ? context.openTickets.map(t => `- #${t.id}: ${t.subject} [${t.status}/${t.priority}]`).join("\n")
    : "- (No open tickets)";

  return `[CONTEXT]
Tenant:
- Name: ${context.tenant.name}
- Plan: ${context.tenant.plan || "free"}
- Enabled Features: ${enabledFeatures.length > 0 ? enabledFeatures.join(", ") : "None"}
- TelephonyStatus: ${JSON.stringify(context.tenant.telephonyStatus)}
- EmailStatus: ${JSON.stringify(context.tenant.emailStatus)}

User:
- Name: ${context.user.name}
- Role: ${context.user.role}

Open Support Tickets:
${ticketList}`;
}
