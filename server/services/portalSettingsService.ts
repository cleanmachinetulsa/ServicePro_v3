/**
 * Portal Settings Service
 * 
 * Provides idempotent get/update operations for portal settings.
 * Settings are tenant-scoped and stored in the portal_settings table.
 */

import { eq } from 'drizzle-orm';
import { portalSettings, tenantConfig, tenants } from '@shared/schema';
import type { PortalSettings } from '@shared/schema';
import type { TenantDb } from '../tenantDb';

export interface PortalSettingsWithBranding extends PortalSettings {
  businessName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

const DEFAULT_SETTINGS: Omit<PortalSettings, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  portalEnabled: true,
  pwaStartUrl: '/portal',
  pwaDisplayName: null,
  pwaShortName: null,
  pwaThemeColor: '#3b82f6',
  pwaBackgroundColor: '#ffffff',
  moduleHomeEnabled: true,
  moduleBookEnabled: true,
  moduleAppointmentsEnabled: true,
  moduleMessagesEnabled: true,
  moduleLoyaltyEnabled: true,
  moduleProfileEnabled: true,
  installPromptEnabled: true,
  installPromptTrigger: 'booking_confirmed',
  installPromptCooldownDays: 21,
  installPromptPageVisitThreshold: 3,
  installPromptBannerText: 'Install our app for quick access to your appointments and rewards',
  installPromptButtonText: 'Install App',
  portalTitle: null,
  portalWelcomeMessage: null,
  landingPath: '/portal',
  showRewards: true,
  showBooking: true,
  showServices: true,
  showContact: true,
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
  digestEnabled: false,
  digestFrequency: 'daily',
};

export async function getPortalSettings(
  tenantDb: TenantDb,
  tenantId: string
): Promise<PortalSettings> {
  const [existing] = await tenantDb
    .select()
    .from(portalSettings)
    .where(eq(portalSettings.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const newSettings = {
    tenantId,
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };

  const [inserted] = await tenantDb
    .insert(portalSettings)
    .values(newSettings)
    .returning();

  console.log(`[PORTAL SETTINGS] Created default settings for tenant ${tenantId}`);
  return inserted;
}

export async function getPortalSettingsWithBranding(
  tenantDb: TenantDb,
  tenantId: string
): Promise<PortalSettingsWithBranding> {
  const settings = await getPortalSettings(tenantDb, tenantId);

  const [config] = await tenantDb
    .select({
      businessName: tenantConfig.businessName,
      logoUrl: tenantConfig.logoUrl,
      primaryColor: tenantConfig.primaryColor,
      accentColor: tenantConfig.accentColor,
    })
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  return {
    ...settings,
    businessName: config?.businessName || 'Customer Portal',
    logoUrl: config?.logoUrl || null,
    primaryColor: config?.primaryColor || '#3b82f6',
    accentColor: config?.accentColor || null,
  };
}

export async function updatePortalSettings(
  tenantDb: TenantDb,
  tenantId: string,
  patch: Partial<Omit<PortalSettings, 'tenantId' | 'createdAt' | 'updatedAt'>>
): Promise<PortalSettings> {
  await getPortalSettings(tenantDb, tenantId);

  const [updated] = await tenantDb
    .update(portalSettings)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(portalSettings.tenantId, tenantId))
    .returning();

  console.log(`[PORTAL SETTINGS] Updated settings for tenant ${tenantId}`);
  return updated;
}

export default {
  getPortalSettings,
  getPortalSettingsWithBranding,
  updatePortalSettings,
  DEFAULT_SETTINGS,
};
