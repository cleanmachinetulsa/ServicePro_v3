/**
 * Support Knowledge Base Service
 * 
 * Manages KB articles for product & integration documentation.
 * KB is global (not per-tenant) - accessible by all authenticated users.
 */

import { db } from "../db";
import { supportKbArticles, type SupportKbArticle, type InsertSupportKbArticle } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface ListArticlesOptions {
  scope?: "product" | "integration";
  category?: string;
  limit?: number;
  publicOnly?: boolean;
}

interface ArticleSummary {
  slug: string;
  title: string;
  scope: string;
  category: string;
  summary: string;
  lastVerifiedAt: Date | null;
}

export class SupportKbService {
  /**
   * List KB articles with optional filters
   */
  async listArticles(options: ListArticlesOptions = {}): Promise<ArticleSummary[]> {
    const { scope, category, limit = 50, publicOnly = true } = options;

    let query = db.select({
      slug: supportKbArticles.slug,
      title: supportKbArticles.title,
      scope: supportKbArticles.scope,
      category: supportKbArticles.category,
      contentMarkdown: supportKbArticles.contentMarkdown,
      lastVerifiedAt: supportKbArticles.lastVerifiedAt,
    }).from(supportKbArticles);

    const conditions = [];
    
    if (publicOnly) {
      conditions.push(eq(supportKbArticles.isPublic, true));
    }
    
    if (scope) {
      conditions.push(eq(supportKbArticles.scope, scope));
    }
    
    if (category) {
      conditions.push(eq(supportKbArticles.category, category));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query
      .orderBy(desc(supportKbArticles.createdAt))
      .limit(limit);

    return results.map(article => ({
      slug: article.slug,
      title: article.title,
      scope: article.scope,
      category: article.category,
      summary: this.extractSummary(article.contentMarkdown),
      lastVerifiedAt: article.lastVerifiedAt,
    }));
  }

  /**
   * Get a single article by slug
   */
  async getArticleBySlug(slug: string): Promise<SupportKbArticle | null> {
    const [article] = await db
      .select()
      .from(supportKbArticles)
      .where(eq(supportKbArticles.slug, slug))
      .limit(1);

    return article || null;
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: number): Promise<SupportKbArticle | null> {
    const [article] = await db
      .select()
      .from(supportKbArticles)
      .where(eq(supportKbArticles.id, id))
      .limit(1);

    return article || null;
  }

  /**
   * Create or update a KB article (root admin only)
   */
  async createOrUpdateArticle(data: InsertSupportKbArticle): Promise<SupportKbArticle> {
    const existing = await this.getArticleBySlug(data.slug);

    if (existing) {
      const [updated] = await db
        .update(supportKbArticles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(supportKbArticles.slug, data.slug))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(supportKbArticles)
      .values(data)
      .returning();

    return created;
  }

  /**
   * Delete a KB article (root admin only)
   */
  async deleteArticle(slug: string): Promise<boolean> {
    const result = await db
      .delete(supportKbArticles)
      .where(eq(supportKbArticles.slug, slug));

    return true;
  }

  /**
   * Mark article as verified (root admin only)
   */
  async markAsVerified(slug: string): Promise<SupportKbArticle | null> {
    const [updated] = await db
      .update(supportKbArticles)
      .set({
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supportKbArticles.slug, slug))
      .returning();

    return updated || null;
  }

  /**
   * Get all categories for a scope
   */
  async getCategories(scope?: "product" | "integration"): Promise<string[]> {
    let query = db
      .selectDistinct({ category: supportKbArticles.category })
      .from(supportKbArticles);

    if (scope) {
      query = query.where(eq(supportKbArticles.scope, scope)) as typeof query;
    }

    const results = await query;
    return results.map(r => r.category);
  }

  /**
   * Extract a summary from markdown content (first paragraph or 200 chars)
   */
  private extractSummary(markdown: string, maxLength = 200): string {
    const withoutHeaders = markdown.replace(/^#.*$/gm, '').trim();
    const firstParagraph = withoutHeaders.split('\n\n')[0] || '';
    const cleanText = firstParagraph.replace(/[*_`#\[\]]/g, '').trim();
    
    if (cleanText.length <= maxLength) {
      return cleanText;
    }
    
    return cleanText.substring(0, maxLength - 3) + '...';
  }
}

export const supportKbService = new SupportKbService();
