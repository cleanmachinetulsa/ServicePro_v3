/**
 * CRUD API routes for availability message templates
 * Returns hardcoded templates (no database - using MemStorage)
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';

const router = Router();

/**
 * Hardcoded templates (no database - using MemStorage)
 * These are kept in memory since the app uses MemStorage, not PostgreSQL
 */
const HARDCODED_TEMPLATES = [
  {
    id: 1,
    name: "Professional",
    introText: "Hello{{#if contact.firstName}} {{contact.firstName}}{{/if}}! Here's our availability for the next two weeks:",
    ctaText: "Would you like me to schedule an appointment for you? Just let me know which date and time works best!",
    isDefault: true,
    channelType: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: "Quick & Friendly",
    introText: "Hey{{#if contact.firstName}} {{contact.firstName}}{{/if}}! 👋 Here's when we're free:",
    ctaText: "Want to book? Pick a time and I'll get you scheduled! 🚗✨",
    isDefault: false,
    channelType: "sms",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: "Detailed",
    introText: "Hi{{#if contact.firstName}} {{contact.firstName}}{{/if}}, thanks for your interest in Clean Machine Auto Detail! Below are our available appointment times for the next two weeks:",
    ctaText: "Please reply with your preferred date and time, and I'll be happy to get you scheduled. Looking forward to detailing your vehicle!",
    isDefault: false,
    channelType: "email",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 4,
    name: "Casual",
    introText: "Hi{{#if contact.firstName}} {{contact.firstName}}{{/if}}! 🚗 Check out when we're available:",
    ctaText: "Let me know what works for you!",
    isDefault: false,
    channelType: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * GET /api/availability-templates
 * List all active templates (from hardcoded memory)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Return only active templates, sorted by default first
    const activeTemplates = HARDCODED_TEMPLATES
      .filter(t => t.isActive)
      .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

    res.json({ success: true, data: activeTemplates });
  } catch (error: any) {
    console.error('[AVAILABILITY TEMPLATES API] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
});

/**
 * GET /api/availability-templates/:id
 * Get a specific template by ID (from hardcoded memory)
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID',
      });
    }

    const template = HARDCODED_TEMPLATES.find(t => t.id === id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({ success: true, data: template });
  } catch (error: any) {
    console.error('[AVAILABILITY TEMPLATES API] Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
    });
  }
});

/**
 * Note: POST, PATCH, and DELETE endpoints removed since templates are hardcoded.
 * Templates cannot be modified at runtime when using MemStorage.
 * To add/edit templates, modify the HARDCODED_TEMPLATES array above.
 */

export default router;
