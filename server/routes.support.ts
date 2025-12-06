/**
 * Support System Routes
 * 
 * Phase 26 - Support Tickets & Knowledge Base API
 * 
 * Routes:
 * - /api/support/tickets - Tenant support ticket management
 * - /api/admin/support/tickets - Root admin cross-tenant ticket management
 * - /api/support/ai/* - AI context endpoints for future Support AI
 */

import { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { supportTicketService } from "./services/supportTicketService";
import { supportKbService } from "./services/supportKbService";
import { getSupportAssistantReply } from "./services/supportAssistantService";
import { getSupportContextForTenantUser } from "./services/supportContextService";
import { db } from "./db";
import { tenants, tenantConfig, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

interface AuthenticatedRequest extends Request {
  session: Request["session"] & {
    userId?: number;
    tenantId?: string;
    user?: {
      id: number;
      username: string;
      role: string;
    };
  };
}

const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(1, "Message is required").max(10000),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  metadata: z.object({
    relatedFeature: z.string().optional(),
    browser: z.string().optional(),
    userAgent: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

const updateTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  internalNotes: z.string().optional(),
});

const assistantChatSchema = z.object({
  message: z.string().min(1, "Message is required").max(4000, "Message too long (max 4000 characters)"),
  currentRoute: z.string().optional(),
  topicHint: z.string().optional(),
});

// Rate limiter for AI assistant (30 requests per hour per user)
const assistantRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: "Too many requests. Please try again later." },
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    // Use userId for rate limiting (authenticated users only)
    if (authReq.session?.userId) {
      return `user:${authReq.session.userId}`;
    }
    // Fallback to a constant for unauthenticated (will be rejected by auth check anyway)
    return "unauthenticated";
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Disable IP validation since we use userId
});

export function registerSupportRoutes(app: Express) {
  // ============================================================
  // TENANT SUPPORT TICKET ROUTES
  // ============================================================

  /**
   * POST /api/support/tickets
   * Create a new support ticket (authenticated users)
   */
  app.post("/api/support/tickets", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenantId = req.session.tenantId || "root";

      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { subject, message, priority, metadata } = parsed.data;

      const ticket = await supportTicketService.createTicket({
        tenantId,
        userId: req.session.userId,
        subject,
        message,
        priority: priority || "normal",
        source: "manual",
        metadata: {
          ...metadata,
          userAgent: req.headers["user-agent"],
        },
      });

      console.log(`[SUPPORT] Ticket #${ticket.id} created by user ${req.session.userId} for tenant ${tenantId}`);

      return res.status(201).json({ success: true, ticket });
    } catch (error) {
      console.error("[SUPPORT] Error creating ticket:", error);
      return res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  /**
   * GET /api/support/tickets
   * List tickets for the current tenant
   */
  app.get("/api/support/tickets", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenantId = req.session.tenantId || "root";
      const status = req.query.status as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const tickets = await supportTicketService.listTicketsForTenant(tenantId, {
        status: status as any,
        limit,
        offset,
      });

      return res.json({ success: true, tickets });
    } catch (error) {
      console.error("[SUPPORT] Error listing tickets:", error);
      return res.status(500).json({ error: "Failed to list tickets" });
    }
  });

  /**
   * GET /api/support/tickets/:id
   * Get a specific ticket (tenant-scoped)
   */
  app.get("/api/support/tickets/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenantId = req.session.tenantId || "root";
      const ticketId = parseInt(req.params.id);

      if (isNaN(ticketId)) {
        return res.status(400).json({ error: "Invalid ticket ID" });
      }

      const ticket = await supportTicketService.getTicketForTenant(ticketId, tenantId);

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      return res.json({ success: true, ticket });
    } catch (error) {
      console.error("[SUPPORT] Error getting ticket:", error);
      return res.status(500).json({ error: "Failed to get ticket" });
    }
  });

  /**
   * PATCH /api/support/tickets/:id/status
   * Update ticket status (tenant can close their own tickets)
   */
  app.patch("/api/support/tickets/:id/status", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenantId = req.session.tenantId || "root";
      const ticketId = parseInt(req.params.id);

      if (isNaN(ticketId)) {
        return res.status(400).json({ error: "Invalid ticket ID" });
      }

      const parsed = updateTicketStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { status } = parsed.data;

      const ticket = await supportTicketService.updateTicketStatus(
        ticketId,
        tenantId,
        status,
        req.session.userId
      );

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      console.log(`[SUPPORT] Ticket #${ticketId} status updated to ${status} by user ${req.session.userId}`);

      return res.json({ success: true, ticket });
    } catch (error) {
      console.error("[SUPPORT] Error updating ticket status:", error);
      return res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // ============================================================
  // ROOT ADMIN SUPPORT ROUTES
  // ============================================================

  /**
   * GET /api/admin/support/tickets
   * List all tickets across tenants (root admin only)
   */
  app.get("/api/admin/support/tickets", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is root admin
      const currentTenantId = req.session.tenantId || "root";
      if (currentTenantId !== "root") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const role = (req.session as any)?.role;
      if (role !== "owner" && role !== "admin") {
        return res.status(403).json({ error: "Admin role required" });
      }

      const tenantId = req.query.tenantId as string | undefined;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const tickets = await supportTicketService.listTicketsForRootAdmin({
        tenantId,
        status: status as any,
        priority: priority as any,
        limit,
        offset,
      });

      return res.json({ success: true, tickets });
    } catch (error) {
      console.error("[SUPPORT ADMIN] Error listing tickets:", error);
      return res.status(500).json({ error: "Failed to list tickets" });
    }
  });

  /**
   * PATCH /api/admin/support/tickets/:id/status
   * Update ticket status (root admin - can update any ticket)
   */
  app.patch("/api/admin/support/tickets/:id/status", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is root admin
      const currentTenantId = req.session.tenantId || "root";
      if (currentTenantId !== "root") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const role = (req.session as any)?.role;
      if (role !== "owner" && role !== "admin") {
        return res.status(403).json({ error: "Admin role required" });
      }

      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({ error: "Invalid ticket ID" });
      }

      const parsed = updateTicketStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { status, priority, internalNotes } = parsed.data;

      const ticket = await supportTicketService.updateTicketStatusAdmin(
        ticketId,
        status,
        priority,
        req.session.userId,
        internalNotes
      );

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      console.log(`[SUPPORT ADMIN] Ticket #${ticketId} updated by admin ${req.session.userId}: status=${status}, priority=${priority}`);

      return res.json({ success: true, ticket });
    } catch (error) {
      console.error("[SUPPORT ADMIN] Error updating ticket:", error);
      return res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // ============================================================
  // AI CONTEXT / BOOTSTRAP ENDPOINTS
  // ============================================================

  /**
   * GET /api/support/ai/context/bootstrap
   * Returns compact context object for the current tenant/user
   * Used by AI assistant to understand the user's situation
   */
  app.get("/api/support/ai/context/bootstrap", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenantId = req.session.tenantId || "root";
      const userId = req.session.userId;

      // Use shared context service
      const context = await getSupportContextForTenantUser(tenantId, userId);

      return res.json({ success: true, context });
    } catch (error) {
      console.error("[SUPPORT AI] Error getting bootstrap context:", error);
      return res.status(500).json({ error: "Failed to get context" });
    }
  });

  /**
   * GET /api/support/ai/kb/articles
   * List KB articles for AI consumption
   */
  app.get("/api/support/ai/kb/articles", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const scope = req.query.scope as "product" | "integration" | undefined;
      const category = req.query.category as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const articles = await supportKbService.listArticles({
        scope,
        category,
        limit,
        publicOnly: true,
      });

      return res.json({ success: true, articles });
    } catch (error) {
      console.error("[SUPPORT AI] Error listing KB articles:", error);
      return res.status(500).json({ error: "Failed to list articles" });
    }
  });

  /**
   * GET /api/support/ai/kb/articles/:slug
   * Get full KB article content
   */
  app.get("/api/support/ai/kb/articles/:slug", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { slug } = req.params;

      const article = await supportKbService.getArticleBySlug(slug);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Only return public articles to non-root users
      const tenantId = req.session.tenantId || "root";
      if (!article.isPublic && tenantId !== "root") {
        return res.status(404).json({ error: "Article not found" });
      }

      return res.json({ success: true, article });
    } catch (error) {
      console.error("[SUPPORT AI] Error getting KB article:", error);
      return res.status(500).json({ error: "Failed to get article" });
    }
  });

  // ============================================================
  // PUBLIC KB ROUTES (for Support Center UI)
  // ============================================================

  /**
   * GET /api/support/kb/articles
   * List KB articles (authenticated users)
   */
  app.get("/api/support/kb/articles", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const scope = req.query.scope as "product" | "integration" | undefined;
      const category = req.query.category as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const articles = await supportKbService.listArticles({
        scope,
        category,
        limit,
        publicOnly: true,
      });

      return res.json({ success: true, articles });
    } catch (error) {
      console.error("[SUPPORT KB] Error listing articles:", error);
      return res.status(500).json({ error: "Failed to list articles" });
    }
  });

  /**
   * GET /api/support/kb/articles/:slug
   * Get a specific KB article
   */
  app.get("/api/support/kb/articles/:slug", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { slug } = req.params;

      const article = await supportKbService.getArticleBySlug(slug);

      if (!article || !article.isPublic) {
        return res.status(404).json({ error: "Article not found" });
      }

      return res.json({ success: true, article });
    } catch (error) {
      console.error("[SUPPORT KB] Error getting article:", error);
      return res.status(500).json({ error: "Failed to get article" });
    }
  });

  /**
   * GET /api/support/kb/categories
   * List all KB categories
   */
  app.get("/api/support/kb/categories", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const scope = req.query.scope as "product" | "integration" | undefined;
      const categories = await supportKbService.getCategories(scope);

      return res.json({ success: true, categories });
    } catch (error) {
      console.error("[SUPPORT KB] Error listing categories:", error);
      return res.status(500).json({ error: "Failed to list categories" });
    }
  });

  // ============================================================
  // SUPPORT ASSISTANT AI ROUTES
  // ============================================================

  /**
   * POST /api/support/assistant/chat
   * AI-powered support assistant chat endpoint
   * Rate limited to 30 requests per hour per user
   */
  app.post("/api/support/assistant/chat", assistantRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const parsed = assistantChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.errors,
        });
      }

      const { message, currentRoute, topicHint } = parsed.data;
      const tenantId = req.session.tenantId || "root";
      const userId = req.session.userId;

      // Log request (truncated for privacy)
      console.log("[SUPPORT ASSISTANT] Chat request:", {
        tenantId,
        userId,
        messagePreview: message.substring(0, 200),
        currentRoute,
        topicHint,
      });

      const reply = await getSupportAssistantReply({
        tenantId,
        userId,
        userMessage: message,
        currentRoute,
        topicHint,
      });

      return res.json({
        success: true,
        reply,
      });
    } catch (error) {
      console.error("[SUPPORT ASSISTANT] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Support assistant is currently unavailable. Please try again later or open a support ticket.",
      });
    }
  });

  console.log("[SUPPORT] Routes registered: /api/support/*, /api/admin/support/*, /api/support/ai/*, /api/support/assistant/*");
}
