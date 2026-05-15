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
      actionPayload: { sipUri: `${phoneConfig.sipUsername}@${phoneConfig.sipDomain}`.replace(/^sip:/, '') },
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
      {
        digit: '1',
        label: 'Pricing by SMS',
        actionType: 'SMS_INFO' as IvrActionType,
        actionPayload: {
          smsText: `Thanks for calling ${businessName}! We'll text you our info and booking link.`,
        },
        isHidden: false,
        orderIndex: 0,
      },
      forwardItem,
      {
        digit: '2',
        label: 'Leave voicemail',
        actionType: 'VOICEMAIL' as IvrActionType,
        actionPayload: {},
        isHidden: false,
        orderIndex: 2,
      },
    ],
  };
}

/**
 * Get the active IVR menu for a tenant
 * Returns null if no active menu exists
 */
export async function getActiveMenuForTenant(tenantId: string, key: string = 'main'): Promise<IvrMenuWithItems | null> {
  const menu = await db.query.ivrMenus.findFirst({
    where: and(
      eq(ivrMenus.tenantId, tenantId),
      eq(ivrMenus.key, key),
      eq(ivrMenus.isActive, true)
    ),
    with: {
      items: {
        orderBy: asc(ivrMenuItems.orderIndex),
      },
    },
  });

  return menu || null;
}

/**
 * Get or create the default IVR menu for a tenant
 * Safe, tenant-scoped, and idempotent
 */
export async function getOrCreateDefaultMenuForTenant(tenantId: string): Promise<IvrMenuWithItems> {
  const existing = await getActiveMenuForTenant(tenantId, 'main');
  if (existing) {
    return existing;
  }

  const [tenant] = await db
    .select({ businessName: tenantConfig.businessName })
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  const [phoneConfig] = await db
    .select({ sipDomain: tenantPhoneConfig.sipDomain, sipUsername: tenantPhoneConfig.sipUsername, phoneNumber: tenantPhoneConfig.phoneNumber })
    .from(tenantPhoneConfig)
    .where(eq(tenantPhoneConfig.tenantId, tenantId))
    .limit(1);

  const defaults = tenantId === 'root'
    ? CLEAN_MACHINE_DEFAULTS
    : generateGenericDefaults(tenant?.businessName || 'Our Business', phoneConfig || undefined);

  const [menu] = await db
    .insert(ivrMenus)
    .values({
      tenantId,
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

  const items = defaults.items.map((item) => ({
    menuId: menu.id,
    tenantId,
    digit: item.digit,
    label: item.label,
    actionType: item.actionType,
    actionPayload: item.actionPayload,
    orderIndex: item.orderIndex,
    isHidden: item.isHidden,
  }));

  await db.insert(ivrMenuItems).values(items);

  return getActiveMenuForTenant(tenantId, 'main') as Promise<IvrMenuWithItems>;
}

/**
 * Update menu for tenant
 */
export async function updateMenuForTenant(tenantId: string, menuData: {
  name?: string;
  greetingText: string;
  noInputMessage?: string;
  invalidInputMessage?: string;
  voiceName?: string;
  maxAttempts?: number;
  items: Array<{
    digit: string;
    label: string;
    actionType: IvrActionType;
    actionPayload: Record<string, any>;
    orderIndex: number;
    isHidden: boolean;
  }>;
}) {
  const existing = await getOrCreateDefaultMenuForTenant(tenantId);

  await db.update(ivrMenus).set({
    name: menuData.name || existing.name,
    greetingText: menuData.greetingText,
    noInputMessage: menuData.noInputMessage || existing.noInputMessage,
    invalidInputMessage: menuData.invalidInputMessage || existing.invalidInputMessage,
    voiceName: menuData.voiceName || existing.voiceName,
    maxAttempts: menuData.maxAttempts || existing.maxAttempts,
  }).where(eq(ivrMenus.id, existing.id));

  await db.delete(ivrMenuItems).where(eq(ivrMenuItems.menuId, existing.id));
  await db.insert(ivrMenuItems).values(menuData.items.map((item) => ({
    menuId: existing.id,
    tenantId,
    digit: item.digit,
    label: item.label,
    actionType: item.actionType,
    actionPayload: item.actionPayload,
    orderIndex: item.orderIndex,
    isHidden: item.isHidden,
  })));

  return getActiveMenuForTenant(tenantId, 'main') as Promise<IvrMenuWithItems>;
}
