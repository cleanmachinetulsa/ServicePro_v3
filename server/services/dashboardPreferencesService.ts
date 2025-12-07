/**
 * SP-15: Dashboard Preferences Service
 * 
 * Manages tenant dashboard mode (simple/advanced) and
 * which panels are visible in simple mode.
 */

import { db } from '../db';
import { 
  dashboardPreferences, 
  DashboardPreferences,
  UpdateDashboardPreferences,
  DashboardPanelId,
  DASHBOARD_PANEL_IDS
} from '@shared/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_SIMPLE_PANELS: DashboardPanelId[] = [
  'conversations',
  'calendar',
  'booking-requests',
  'customers',
  'rewards',
  'settings',
];

export class DashboardPreferencesService {
  async getByTenantId(tenantId: string): Promise<DashboardPreferences | null> {
    const [prefs] = await db
      .select()
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.tenantId, tenantId))
      .limit(1);
    
    return prefs || null;
  }

  async getOrCreate(tenantId: string): Promise<DashboardPreferences> {
    let prefs = await this.getByTenantId(tenantId);
    
    if (!prefs) {
      const [newPrefs] = await db
        .insert(dashboardPreferences)
        .values({
          tenantId,
          mode: 'simple',
          simpleVisiblePanels: DEFAULT_SIMPLE_PANELS,
        })
        .returning();
      
      prefs = newPrefs;
    }
    
    return prefs;
  }

  async update(tenantId: string, updates: UpdateDashboardPreferences): Promise<DashboardPreferences> {
    await this.getOrCreate(tenantId);

    const updateData: Partial<DashboardPreferences> = {
      updatedAt: new Date(),
    };

    if (updates.mode !== undefined) {
      updateData.mode = updates.mode;
    }

    if (updates.simpleVisiblePanels !== undefined) {
      const validPanels = updates.simpleVisiblePanels.filter(
        (panel): panel is DashboardPanelId => DASHBOARD_PANEL_IDS.includes(panel as DashboardPanelId)
      );
      updateData.simpleVisiblePanels = validPanels;
    }

    const [updated] = await db
      .update(dashboardPreferences)
      .set(updateData)
      .where(eq(dashboardPreferences.tenantId, tenantId))
      .returning();

    return updated;
  }

  async setMode(tenantId: string, mode: 'simple' | 'advanced'): Promise<DashboardPreferences> {
    return this.update(tenantId, { mode });
  }

  async setSimpleVisiblePanels(tenantId: string, panels: DashboardPanelId[]): Promise<DashboardPreferences> {
    return this.update(tenantId, { simpleVisiblePanels: panels });
  }

  async addPanelToSimple(tenantId: string, panelId: DashboardPanelId): Promise<DashboardPreferences> {
    const prefs = await this.getOrCreate(tenantId);
    const currentPanels = prefs.simpleVisiblePanels || [];
    
    if (!currentPanels.includes(panelId)) {
      return this.update(tenantId, { 
        simpleVisiblePanels: [...currentPanels, panelId] 
      });
    }
    
    return prefs;
  }

  async removePanelFromSimple(tenantId: string, panelId: DashboardPanelId): Promise<DashboardPreferences> {
    const prefs = await this.getOrCreate(tenantId);
    const currentPanels = prefs.simpleVisiblePanels || [];
    
    return this.update(tenantId, { 
      simpleVisiblePanels: currentPanels.filter(p => p !== panelId) 
    });
  }
}

export const dashboardPreferencesService = new DashboardPreferencesService();
