/**
 * IVR Configuration Service
 * 
 * Manages per-tenant IVR menu configurations with:
 * - Loading active menus from database
 * - Lazy-seeding default menus per tenant
 * - Clean Machine's current IVR as default for root tenant
 * - Generic fallback menus for other tenants
 * - Safe fallbacks when config is missing/broken
 * 
 * MULTI-TENANT SAFETY:
 * - All functions require explicit tenantId parameter
 * - Queries always filter by tenantId to prevent cross-tenant access
 * - No cross-tenant leaking or fallback to Clean Machine for other tenants
 * - Safe generic IVR when tenant's config is broken
 */

import { db } from '../db';
import { 
  ivrMenus, 
  ivrMenuItems, 
  tenantConfig, 
  tenantPhoneConfig,
  type IvrMenu,
  type IvrMenuItem,
  type IvrMenuWithItems,
  type IvrActionType,
} from '../../shared/schema';
import { eq, and, asc } from 'drizzle-orm';

/**
 * Default Clean Machine IVR configuration
 * This matches the existing hard-coded IVR behavior exactly
 * ONLY used for 'root' tenant
 */
const CLEAN_MACHINE_DEFAULTS = {
  name: 'Main IVR Menu',
  greetingText: 'Thanks for calling Clean Machine Auto Detail. Press 1 for pricing and information by text message. Press 2 to speak with someone. Press 3 to leave a voicemail.',
  noInputMessage: "We didn't receive any input. Let me repeat the menu.",
  invalidInputMessage: "Sorry, that's not a valid option.",
  maxAttempts: 3,
  voiceName: 'alice',
  items: [
    {
      digit: '1',
      label: 'Pricing by SMS',
      actionType: 'SMS_INFO' as IvrActionType,
      actionPayload: {
        smsText: "Thanks for calling Clean Machine Auto Detail! Here's our info & booking link: https://cleanmachinetulsa.com/book",
      },
      isHidden: false,
      orderIndex: 0,
    },
    {
      digit: '2',
      label: 'Speak to someone',
      actionType: 'FORWARD_SIP' as IvrActionType,
      actionPayload: {
        sipUri: 'jody@cleanmachinetulsa.sip.twilio.com',
      },
      isHidden: false,
      orderIndex: 1,
    },
    {
      digit: '3',
      label: 'Leave voicemail',
      actionType: 'VOICEMAIL' as IvrActionType,
      actionPayload: {},
      isHidden: false,
      orderIndex: 2,
    },
    {
      digit: '7',
      label: 'Easter egg',
      actionType: 'EASTER_EGG' as IvrActionType,
      actionPayload: {
        message: "Here's a fun fact: The world record for fastest car detailing is 3 minutes and 47 seconds! We take a bit longer to make sure your car gets the royal treatment it deserves.",
        hangupAfter: true,
      },
      isHidden: true,
      orderIndex: 3,
    },
  ],
};

/**
 * Generate default IVR configuration for non-root tenants
 * Uses tenant's business name and configured phone settings
 * NEVER includes Clean Machine branding or SIP endpoints
 */
function generateGenericDefaults(businessName: string, phoneConfig?: { sipDomain?: string; sipUsername?: string; phoneNumber?: string }) {
  const greeting = `Thanks for calling ${businessName}. Press 1 to speak with someone. Press 2 to leave a voicemail.`;
  
  // Determine forwarding method: SIP if configured, phone if available, otherwise just voicemail
  let forwardItem: typeof CLEAN_MACHINE_DEFAULTS.items[0];
  
  if (phoneConfig?.sipDomain && phoneConfig?.sipUsername) {
    forwardItem = {
      digit: '1',
      label: 'Speak to someone',
      actionType: 'FORWARD_SIP' as IvrActionType,
      actionPayload: { sipUri: `${phoneConfig.sipUsername}@${phoneConfig.sipDomain}` },
      isHidden: false,
      orderIndex: 0,
    };
  } else if (phoneConfig?.phoneNumber) {
    forwardItem = {
      digit: '1',
      label: 'Speak to someone',
      actionType: 'FORWARD_PHONE' as IvrActionType,
      actionPayload: { phoneNumber: phoneConfig.phoneNumber },
      isHidden: false,
      orderIndex: 0,
    };
  } else {
    // No forwarding configured - skip forward option, just voicemail
    return {
      name: 'Main IVR Menu',
      greetingText: `Thanks for calling ${businessName}. Press 1 to leave a voicemail.`,
      noInputMessage: "We didn't receive any input. Let me repeat the options.",
      invalidInputMessage: "Sorry, that's not a valid option.",
      maxAttempts: 3,
      voiceName: 'alice',
      items: [
        {
          digit: '1',
          label: 'Leave voicemail',
          actionType: 'VOICEMAIL' as IvrActionType,
          actionPayload: {},
          isHidden: false,
          orderIndex: 0,
        },
      ],
    };
  }

  return {
    name: 'Main IVR Menu',
    greetingText: greeting,
    noInputMessage: "We didn't receive any input. Let me repeat the options.",
    invalidInputMessage: "Sorry, that's not a valid option.",
    maxAttempts: 3,
    voiceName: 'alice',
    items: [
      forwardItem,
      {
        digit: '2',
        label: 'Leave voicemail',
        actionType: 'VOICEMAIL' as IvrActionType,
        actionPayload: {},
        isHidden: false,
        orderIndex: 1,
      },
    ],
  };
}

/**
 * Get the active IVR menu for a tenant
 * Returns null if no menu configured
 * 
 * MULTI-TENANT: Always filters by tenantId to prevent cross-tenant access
 */
export async function getActiveMenuForTenant(tenantId: string, menuKey: string = 'main'): Promise<IvrMenuWithItems | null> {
  try {
    // CRITICAL: Always filter by tenantId for tenant isolation
    const [menu] = await db
      .select()
      .from(ivrMenus)
      .where(and(
        eq(ivrMenus.tenantId, tenantId),
        eq(ivrMenus.key, menuKey),
        eq(ivrMenus.isActive, true)
      ))
      .limit(1);
    
    if (!menu) {
      return null;
    }

    // Double-check tenant ownership (defense in depth)
    if (menu.tenantId !== tenantId) {
      console.error(`[IVR CONFIG] SECURITY: Menu ${menu.id} tenantId mismatch - expected ${tenantId}, got ${menu.tenantId}`);
      return null;
    }

    const items = await db
      .select()
      .from(ivrMenuItems)
      .where(eq(ivrMenuItems.menuId, menu.id))
      .orderBy(asc(ivrMenuItems.orderIndex));

    return { ...menu, items };
  } catch (error) {
    console.error(`[IVR CONFIG] Error loading menu for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Get or create the default IVR menu for a tenant
 * 
 * - For root tenant: Seeds Clean Machine's exact current IVR
 * - For other tenants: Seeds a generic menu using their business name
 * 
 * MULTI-TENANT SAFETY:
 * - Never returns Clean Machine config for non-root tenants
 * - Safe generic fallback when errors occur
 */
export async function getOrCreateDefaultMenuForTenant(tenantId: string): Promise<IvrMenuWithItems> {
  // First try to load existing menu
  const existingMenu = await getActiveMenuForTenant(tenantId, 'main');
  if (existingMenu) {
    return existingMenu;
  }

  // No menu exists - seed the default
  console.log(`[IVR CONFIG] No menu found for tenant ${tenantId}, seeding default...`);

  try {
    // CRITICAL: Only seed Clean Machine defaults for 'root' tenant
    if (tenantId === 'root') {
      return await seedCleanMachineDefaults();
    } else {
      return await seedGenericDefaults(tenantId);
    }
  } catch (error) {
    console.error(`[IVR CONFIG] Error seeding default menu for tenant ${tenantId}:`, error);
    // Return a safe in-memory fallback (not persisted)
    // IMPORTANT: Never use Clean Machine branding for other tenants
    return getSafeFallbackMenu(tenantId);
  }
}

/**
 * Seed Clean Machine's default IVR menu
 * ONLY for root tenant - reads SIP config from tenant_phone_config
 */
async function seedCleanMachineDefaults(): Promise<IvrMenuWithItems> {
  const tenantId = 'root';

  // Check if already seeded (prevent duplicates)
  const existing = await getActiveMenuForTenant(tenantId, 'main');
  if (existing) {
    return existing;
  }

  // Get SIP config from phone config
  const [phoneConfig] = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  // Build items with dynamic SIP URI
  const sipUri = phoneConfig?.sipDomain && phoneConfig?.sipUsername
    ? `${phoneConfig.sipUsername}@${phoneConfig.sipDomain}`
    : 'jody@cleanmachinetulsa.sip.twilio.com'; // Fallback only for root

  const items = CLEAN_MACHINE_DEFAULTS.items.map(item => {
    if (item.actionType === 'FORWARD_SIP') {
      return { ...item, actionPayload: { sipUri } };
    }
    return item;
  });

  // Insert menu with explicit tenantId
  const [menu] = await db
    .insert(ivrMenus)
    .values({
      tenantId, // CRITICAL: Always set tenantId
      key: 'main',
      name: CLEAN_MACHINE_DEFAULTS.name,
      greetingText: CLEAN_MACHINE_DEFAULTS.greetingText,
      noInputMessage: CLEAN_MACHINE_DEFAULTS.noInputMessage,
      invalidInputMessage: CLEAN_MACHINE_DEFAULTS.invalidInputMessage,
      maxAttempts: CLEAN_MACHINE_DEFAULTS.maxAttempts,
      voiceName: CLEAN_MACHINE_DEFAULTS.voiceName,
      isActive: true,
    })
    .returning();

  // Insert items
  const insertedItems: IvrMenuItem[] = [];
  for (const item of items) {
    const [inserted] = await db
      .insert(ivrMenuItems)
      .values({
        menuId: menu.id,
        digit: item.digit,
        label: item.label,
        actionType: item.actionType,
        actionPayload: item.actionPayload,
        isHidden: item.isHidden,
        orderIndex: item.orderIndex,
      })
      .returning();
    insertedItems.push(inserted);
  }

  console.log(`[IVR CONFIG] Seeded Clean Machine default menu with ${insertedItems.length} items`);
  return { ...menu, items: insertedItems };
}

/**
 * Seed generic default IVR menu for non-root tenants
 * 
 * MULTI-TENANT: Uses tenant's own business name and phone config
 * NEVER includes Clean Machine branding
 */
async function seedGenericDefaults(tenantId: string): Promise<IvrMenuWithItems> {
  // Prevent accidental Clean Machine seeding
  if (tenantId === 'root') {
    throw new Error('seedGenericDefaults should not be called for root tenant');
  }

  // Check if already seeded (prevent duplicates)
  const existing = await getActiveMenuForTenant(tenantId, 'main');
  if (existing) {
    return existing;
  }

  // Get tenant business name - filter by exact tenantId
  const [config] = await db
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  const businessName = config?.businessName || 'our business';

  // Get phone config for forwarding - filter by exact tenantId
  const [phoneConfig] = await db
    .select()
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  const defaults = generateGenericDefaults(businessName, phoneConfig || undefined);

  // Insert menu with explicit tenantId
  const [menu] = await db
    .insert(ivrMenus)
    .values({
      tenantId, // CRITICAL: Always set tenantId
      key: 'main',
      name: defaults.name,
      greetingText: defaults.greetingText,
      noInputMessage: defaults.noInputMessage,
      invalidInputMessage: defaults.invalidInputMessage,
      maxAttempts: defaults.maxAttempts,
      voiceName: defaults.voiceName,
      isActive: true,
    })
    .returning();

  // Insert items
  const insertedItems: IvrMenuItem[] = [];
  for (const item of defaults.items) {
    const [inserted] = await db
      .insert(ivrMenuItems)
      .values({
        menuId: menu.id,
        digit: item.digit,
        label: item.label,
        actionType: item.actionType,
        actionPayload: item.actionPayload,
        isHidden: item.isHidden,
        orderIndex: item.orderIndex,
      })
      .returning();
    insertedItems.push(inserted);
  }

  console.log(`[IVR CONFIG] Seeded generic menu for tenant ${tenantId} (${businessName}) with ${insertedItems.length} items`);
  return { ...menu, items: insertedItems };
}

/**
 * Safe fallback menu when database operations fail
 * Returns a minimal in-memory menu that provides basic functionality
 * 
 * MULTI-TENANT: Never uses Clean Machine branding for any tenant
 * Uses generic "Thank you for calling" greeting
 */
function getSafeFallbackMenu(tenantId: string): IvrMenuWithItems {
  console.warn(`[IVR CONFIG] Using safe fallback menu for tenant ${tenantId}`);
  
  // Generic greeting - no business-specific branding
  const greeting = "Thank you for calling. Press 1 to leave a voicemail.";
  
  return {
    id: -1, // Indicates this is a fallback
    tenantId,
    key: 'main',
    name: 'Fallback Menu',
    greetingText: greeting,
    noInputMessage: "We didn't receive any input.",
    invalidInputMessage: "That's not a valid option.",
    maxAttempts: 2,
    voiceName: 'alice',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: -1,
        menuId: -1,
        digit: '1',
        label: 'Leave voicemail',
        actionType: 'VOICEMAIL',
        actionPayload: {},
        isHidden: false,
        orderIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
}

/**
 * Update IVR menu for a tenant
 * 
 * MULTI-TENANT: Validates tenantId ownership before update
 * Performs a transactional update:
 * 1. Validates ownership
 * 2. Updates menu properties
 * 3. Deletes old items
 * 4. Inserts new items
 */
export async function updateMenuForTenant(
  tenantId: string,
  menuUpdate: {
    greetingText?: string;
    noInputMessage?: string;
    invalidInputMessage?: string;
    maxAttempts?: number;
    voiceName?: string;
    items?: Array<{
      id?: number;
      digit: string;
      label: string;
      actionType: IvrActionType;
      actionPayload?: Record<string, any>;
      isHidden?: boolean;
      orderIndex?: number;
    }>;
  }
): Promise<IvrMenuWithItems> {
  // Get existing menu (or create if doesn't exist)
  let menu = await getActiveMenuForTenant(tenantId, 'main');
  
  if (!menu) {
    // Create new menu first
    menu = await getOrCreateDefaultMenuForTenant(tenantId);
  }

  // CRITICAL: Verify ownership before update
  if (menu.tenantId !== tenantId) {
    throw new Error(`Tenant ${tenantId} cannot modify menu owned by ${menu.tenantId}`);
  }

  // Update menu properties
  const menuValues: Partial<IvrMenu> = {};
  if (menuUpdate.greetingText !== undefined) menuValues.greetingText = menuUpdate.greetingText;
  if (menuUpdate.noInputMessage !== undefined) menuValues.noInputMessage = menuUpdate.noInputMessage;
  if (menuUpdate.invalidInputMessage !== undefined) menuValues.invalidInputMessage = menuUpdate.invalidInputMessage;
  if (menuUpdate.maxAttempts !== undefined) menuValues.maxAttempts = menuUpdate.maxAttempts;
  if (menuUpdate.voiceName !== undefined) menuValues.voiceName = menuUpdate.voiceName;
  menuValues.updatedAt = new Date();

  if (Object.keys(menuValues).length > 0) {
    // CRITICAL: Filter by both id AND tenantId for defense in depth
    await db
      .update(ivrMenus)
      .set(menuValues)
      .where(and(
        eq(ivrMenus.id, menu.id),
        eq(ivrMenus.tenantId, tenantId)
      ));
  }

  // Update items if provided
  if (menuUpdate.items) {
    // Delete existing items
    await db
      .delete(ivrMenuItems)
      .where(eq(ivrMenuItems.menuId, menu.id));

    // Insert new items
    for (const item of menuUpdate.items) {
      await db
        .insert(ivrMenuItems)
        .values({
          menuId: menu.id,
          digit: item.digit,
          label: item.label,
          actionType: item.actionType,
          actionPayload: item.actionPayload || {},
          isHidden: item.isHidden || false,
          orderIndex: item.orderIndex || 0,
        });
    }
  }

  // Return updated menu
  const updated = await getActiveMenuForTenant(tenantId, 'main');
  if (!updated) {
    throw new Error('Failed to retrieve updated menu');
  }

  console.log(`[IVR CONFIG] Updated menu for tenant ${tenantId}`);
  return updated;
}

/**
 * Reset IVR menu to defaults for a tenant
 * 
 * Deletes existing menu and re-seeds with defaults
 */
export async function resetMenuToDefaults(tenantId: string): Promise<IvrMenuWithItems> {
  console.log(`[IVR CONFIG] Resetting menu to defaults for tenant ${tenantId}`);
  
  // Get existing menu
  const existing = await getActiveMenuForTenant(tenantId, 'main');
  
  if (existing) {
    // Delete items first (foreign key constraint)
    await db
      .delete(ivrMenuItems)
      .where(eq(ivrMenuItems.menuId, existing.id));
    
    // Delete menu
    await db
      .delete(ivrMenus)
      .where(and(
        eq(ivrMenus.id, existing.id),
        eq(ivrMenus.tenantId, tenantId) // Defense in depth
      ));
  }
  
  // Re-seed defaults
  if (tenantId === 'root') {
    return await seedCleanMachineDefaults();
  } else {
    return await seedGenericDefaults(tenantId);
  }
}

/**
 * Validate IVR menu configuration
 * Returns list of validation errors (empty if valid)
 */
export function validateIvrMenu(menu: {
  greetingText?: string;
  noInputMessage?: string;
  invalidInputMessage?: string;
  maxAttempts?: number;
  items?: Array<{
    digit: string;
    label: string;
    actionType: string;
    actionPayload?: Record<string, any>;
  }>;
}): string[] {
  const errors: string[] = [];

  // Validate greeting
  if (menu.greetingText !== undefined && menu.greetingText.trim().length < 10) {
    errors.push('Greeting text must be at least 10 characters');
  }

  // Validate max attempts
  if (menu.maxAttempts !== undefined && (menu.maxAttempts < 1 || menu.maxAttempts > 5)) {
    errors.push('Max attempts must be between 1 and 5');
  }

  // Validate items
  if (menu.items) {
    const validDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];
    const validActionTypes = ['PLAY_MESSAGE', 'SMS_INFO', 'FORWARD_SIP', 'FORWARD_PHONE', 'VOICEMAIL', 'SUBMENU', 'REPLAY_MENU', 'EASTER_EGG'];
    const usedDigits = new Set<string>();

    for (const item of menu.items) {
      // Validate digit
      if (!validDigits.includes(item.digit)) {
        errors.push(`Invalid digit "${item.digit}". Must be 0-9, *, or #`);
      }

      // Check for duplicate digits
      if (usedDigits.has(item.digit)) {
        errors.push(`Duplicate digit "${item.digit}". Each digit can only be used once`);
      }
      usedDigits.add(item.digit);

      // Validate action type
      if (!validActionTypes.includes(item.actionType)) {
        errors.push(`Invalid action type "${item.actionType}"`);
      }

      // Validate action payload based on type
      if (item.actionType === 'FORWARD_SIP' && !item.actionPayload?.sipUri) {
        errors.push(`SIP URI is required for FORWARD_SIP action on digit ${item.digit}`);
      }
      if (item.actionType === 'FORWARD_PHONE' && !item.actionPayload?.phoneNumber) {
        errors.push(`Phone number is required for FORWARD_PHONE action on digit ${item.digit}`);
      }
      if (item.actionType === 'SMS_INFO' && !item.actionPayload?.smsText) {
        errors.push(`SMS text is required for SMS_INFO action on digit ${item.digit}`);
      }
      if ((item.actionType === 'PLAY_MESSAGE' || item.actionType === 'EASTER_EGG') && !item.actionPayload?.message) {
        errors.push(`Message is required for ${item.actionType} action on digit ${item.digit}`);
      }
    }
  }

  return errors;
}

/**
 * Check if IVR is configured for a tenant
 */
export async function hasIvrConfigured(tenantId: string): Promise<boolean> {
  const [menu] = await db
    .select({ id: ivrMenus.id })
    .from(ivrMenus)
    .where(and(
      eq(ivrMenus.tenantId, tenantId),
      eq(ivrMenus.isActive, true)
    ))
    .limit(1);

  return !!menu;
}
