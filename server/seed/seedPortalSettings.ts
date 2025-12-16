/**
 * Portal Settings Seeding
 * Ensures every tenant has a portal settings row with default values
 */

import { portalSettings, InsertPortalSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function seedPortalSettings(tenantDb: any, tenantId: string = 'root'): Promise<void> {
  try {
    const [existing] = await tenantDb
      .select()
      .from(portalSettings)
      .where(eq(portalSettings.tenantId, tenantId))
      .limit(1);

    if (!existing) {
      const defaultSettings: InsertPortalSettings = {
        tenantId,
        portalEnabled: true,
        pwaStartUrl: '/portal',
        pwaDisplayName: 'App',
        pwaShortName: 'App',
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

      await tenantDb.insert(portalSettings).values(defaultSettings);
      console.log(`[PORTAL MIGRATION] Seeded default portal settings for tenant ${tenantId}`);
    } else {
      console.log(`[PORTAL MIGRATION] Portal settings already exist for tenant ${tenantId}`);
    }
  } catch (error: any) {
    console.error(`[PORTAL MIGRATION] Error seeding portal settings for ${tenantId}:`, error.message);
    // Non-blocking - don't fail startup if seeding fails
  }
}
