/**
 * Support Ticket Service
 * 
 * Manages support tickets for tenants to contact ServicePro HQ.
 * Enforces tenant isolation - non-root tenants can only see their own tickets.
 */

import { db } from "../db";
import { 
  supportTickets, 
  tenants,
  users,
  type SupportTicket, 
  type InsertSupportTicket 
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

interface CreateTicketInput {
  tenantId: string;
  userId?: number;
  customerId?: number;
  subject: string;
  message: string;
  priority?: "low" | "normal" | "high" | "urgent";
  source?: "manual" | "ai_escalation" | "system";
  metadata?: {
    relatedFeature?: string;
    browser?: string;
    userAgent?: string;
    tags?: string[];
  };
}

interface ListTicketsOptions {
  status?: "open" | "in_progress" | "resolved" | "closed";
  priority?: "low" | "normal" | "high" | "urgent";
  limit?: number;
  offset?: number;
}

interface TicketWithDetails extends SupportTicket {
  tenantName?: string;
  createdByUsername?: string;
}

export class SupportTicketService {
  /**
   * Create a new support ticket
   */
  async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        tenantId: input.tenantId,
        createdByUserId: input.userId,
        customerId: input.customerId,
        subject: input.subject,
        message: input.message,
        priority: input.priority || "normal",
        source: input.source || "manual",
        status: "open",
        metadata: input.metadata,
      })
      .returning();

    return ticket;
  }

  /**
   * List tickets for a specific tenant
   * Non-root tenants can only see their own tickets
   */
  async listTicketsForTenant(
    tenantId: string, 
    options: ListTicketsOptions = {}
  ): Promise<SupportTicket[]> {
    const { status, priority, limit = 50, offset = 0 } = options;

    const conditions = [eq(supportTickets.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(supportTickets.status, status));
    }

    if (priority) {
      conditions.push(eq(supportTickets.priority, priority));
    }

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(and(...conditions))
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);

    return tickets;
  }

  /**
   * List all tickets across tenants (root admin only)
   */
  async listTicketsForRootAdmin(
    options: ListTicketsOptions & { tenantId?: string } = {}
  ): Promise<TicketWithDetails[]> {
    const { status, priority, tenantId, limit = 100, offset = 0 } = options;

    const conditions = [];

    if (tenantId) {
      conditions.push(eq(supportTickets.tenantId, tenantId));
    }

    if (status) {
      conditions.push(eq(supportTickets.status, status));
    }

    if (priority) {
      conditions.push(eq(supportTickets.priority, priority));
    }

    let query = db
      .select({
        ticket: supportTickets,
        tenantName: tenants.name,
        createdByUsername: users.username,
      })
      .from(supportTickets)
      .leftJoin(tenants, eq(supportTickets.tenantId, tenants.id))
      .leftJoin(users, eq(supportTickets.createdByUserId, users.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map(r => ({
      ...r.ticket,
      tenantName: r.tenantName || undefined,
      createdByUsername: r.createdByUsername || undefined,
    }));
  }

  /**
   * Get a single ticket by ID
   */
  async getTicketById(id: number): Promise<SupportTicket | null> {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1);

    return ticket || null;
  }

  /**
   * Get a ticket with tenant validation
   */
  async getTicketForTenant(
    ticketId: number, 
    tenantId: string
  ): Promise<SupportTicket | null> {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(and(
        eq(supportTickets.id, ticketId),
        eq(supportTickets.tenantId, tenantId)
      ))
      .limit(1);

    return ticket || null;
  }

  /**
   * Update ticket status (tenant-scoped)
   */
  async updateTicketStatus(
    ticketId: number,
    tenantId: string,
    status: "open" | "in_progress" | "resolved" | "closed",
    userId?: number
  ): Promise<SupportTicket | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = new Date();
      if (userId) {
        updateData.resolvedByUserId = userId;
      }
    }

    const [updated] = await db
      .update(supportTickets)
      .set(updateData)
      .where(and(
        eq(supportTickets.id, ticketId),
        eq(supportTickets.tenantId, tenantId)
      ))
      .returning();

    return updated || null;
  }

  /**
   * Update ticket status (root admin - no tenant constraint)
   */
  async updateTicketStatusAdmin(
    ticketId: number,
    status: "open" | "in_progress" | "resolved" | "closed",
    priority?: "low" | "normal" | "high" | "urgent",
    userId?: number,
    internalNotes?: string
  ): Promise<SupportTicket | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (priority) {
      updateData.priority = priority;
    }

    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = new Date();
      if (userId) {
        updateData.resolvedByUserId = userId;
      }
    }

    const [updated] = await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (updated && internalNotes) {
      const currentMetadata = updated.metadata || {};
      await db
        .update(supportTickets)
        .set({
          metadata: {
            ...currentMetadata,
            internalNotes: internalNotes,
          },
        })
        .where(eq(supportTickets.id, ticketId));
    }

    return updated || null;
  }

  /**
   * Assign a ticket to a user (root admin only)
   */
  async assignTicket(ticketId: number, assigneeUserId: number): Promise<SupportTicket | null> {
    const [updated] = await db
      .update(supportTickets)
      .set({
        assignedTo: assigneeUserId,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    return updated || null;
  }

  /**
   * Get open ticket count for a tenant
   */
  async getOpenTicketCount(tenantId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(and(
        eq(supportTickets.tenantId, tenantId),
        inArray(supportTickets.status, ["open", "in_progress"])
      ));

    return Number(result[0]?.count || 0);
  }

  /**
   * Get open tickets for a tenant (for AI context)
   */
  async getOpenTicketsForAI(tenantId: string): Promise<Pick<SupportTicket, 'id' | 'subject' | 'status' | 'priority'>[]> {
    const tickets = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
      })
      .from(supportTickets)
      .where(and(
        eq(supportTickets.tenantId, tenantId),
        inArray(supportTickets.status, ["open", "in_progress"])
      ))
      .orderBy(desc(supportTickets.createdAt))
      .limit(10);

    return tickets;
  }
}

export const supportTicketService = new SupportTicketService();
