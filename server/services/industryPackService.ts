import { db } from '../db';
import { 
  industryPacks, 
  industryPackTemplates,
  tenants,
  tenantConfig,
  type IndustryPack,
  type InsertIndustryPack,
  type UpdateIndustryPack,
  type IndustryPackTemplate,
  type InsertIndustryPackTemplate,
} from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface IndustryPackWithTemplates extends IndustryPack {
  templates?: IndustryPackTemplate[];
}

export interface CloneTenantResult {
  success: boolean;
  tenantId?: string;
  message: string;
}

export interface TenantInfo {
  businessName: string;
  ownerEmail: string;
  subdomain?: string;
  phone?: string;
}

export async function listPacks(includePrivate = false): Promise<IndustryPack[]> {
  try {
    const query = includePrivate 
      ? db.select().from(industryPacks).orderBy(desc(industryPacks.createdAt))
      : db.select().from(industryPacks).where(eq(industryPacks.isPublic, true)).orderBy(desc(industryPacks.createdAt));
    
    return await query;
  } catch (error) {
    console.error('[INDUSTRY PACK] Error listing packs:', error);
    return [];
  }
}

export async function getPack(id: number): Promise<IndustryPackWithTemplates | null> {
  try {
    const [pack] = await db
      .select()
      .from(industryPacks)
      .where(eq(industryPacks.id, id))
      .limit(1);
    
    if (!pack) return null;

    const templates = await db
      .select()
      .from(industryPackTemplates)
      .where(eq(industryPackTemplates.packId, id));

    return { ...pack, templates };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error getting pack:', error);
    return null;
  }
}

export async function getPackByKey(key: string): Promise<IndustryPackWithTemplates | null> {
  try {
    const [pack] = await db
      .select()
      .from(industryPacks)
      .where(eq(industryPacks.key, key))
      .limit(1);
    
    if (!pack) return null;

    const templates = await db
      .select()
      .from(industryPackTemplates)
      .where(eq(industryPackTemplates.packId, pack.id));

    return { ...pack, templates };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error getting pack by key:', error);
    return null;
  }
}

export async function savePack(
  packData: InsertIndustryPack, 
  id?: number
): Promise<{ success: boolean; pack?: IndustryPack; message: string }> {
  try {
    if (id) {
      const [updated] = await db
        .update(industryPacks)
        .set({
          ...packData,
          updatedAt: new Date(),
        })
        .where(eq(industryPacks.id, id))
        .returning();
      
      return { success: true, pack: updated, message: 'Pack updated successfully' };
    } else {
      const [created] = await db
        .insert(industryPacks)
        .values(packData)
        .returning();
      
      return { success: true, pack: created, message: 'Pack created successfully' };
    }
  } catch (error) {
    console.error('[INDUSTRY PACK] Error saving pack:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to save pack' 
    };
  }
}

export async function updatePack(
  id: number, 
  updates: UpdateIndustryPack
): Promise<{ success: boolean; pack?: IndustryPack; message: string }> {
  try {
    const [updated] = await db
      .update(industryPacks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(industryPacks.id, id))
      .returning();
    
    if (!updated) {
      return { success: false, message: 'Pack not found' };
    }
    
    return { success: true, pack: updated, message: 'Pack updated successfully' };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error updating pack:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to update pack' 
    };
  }
}

export async function deletePack(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const [deleted] = await db
      .delete(industryPacks)
      .where(eq(industryPacks.id, id))
      .returning();
    
    if (!deleted) {
      return { success: false, message: 'Pack not found' };
    }
    
    return { success: true, message: 'Pack deleted successfully' };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error deleting pack:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to delete pack' 
    };
  }
}

export async function savePackTemplate(
  template: InsertIndustryPackTemplate
): Promise<{ success: boolean; template?: IndustryPackTemplate; message: string }> {
  try {
    const [created] = await db
      .insert(industryPackTemplates)
      .values(template)
      .onConflictDoUpdate({
        target: [industryPackTemplates.packId, industryPackTemplates.templateKey],
        set: {
          templateValue: template.templateValue,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return { success: true, template: created, message: 'Template saved successfully' };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error saving template:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to save template' 
    };
  }
}

export async function cloneTenantFromPack(
  packId: number, 
  tenantInfo: TenantInfo
): Promise<CloneTenantResult> {
  try {
    const pack = await getPack(packId);
    if (!pack) {
      return { success: false, message: 'Industry pack not found' };
    }

    const config = pack.configJson || {};
    const tenantId = `tenant-${nanoid(10)}`;
    const subdomain = tenantInfo.subdomain || tenantInfo.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existingSubdomain = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    if (existingSubdomain.length > 0) {
      return { 
        success: false, 
        message: `Subdomain "${subdomain}" is already taken. Please choose a different business name or subdomain.` 
      };
    }

    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: tenantInfo.businessName,
        subdomain,
        planTier: 'starter',
        billingStatus: 'trialing',
        isActive: true,
      });

      await tx.insert(tenantConfig).values({
        tenantId,
        businessName: tenantInfo.businessName,
        industry: config.industry || pack.key,
        phone: tenantInfo.phone || null,
        email: tenantInfo.ownerEmail,
        heroText: config.heroText || `Welcome to ${tenantInfo.businessName}`,
        heroSubtext: config.heroSubtext || 'Professional service you can trust',
        ctaText: config.ctaText || 'Book Now',
        primaryColor: config.colorPalette?.primary || '#1e40af',
        secondaryColor: config.colorPalette?.secondary || '#3b82f6',
        accentColor: config.colorPalette?.accent || '#f59e0b',
      });

      console.log(`[INDUSTRY PACK] Created tenant ${tenantId} from pack ${pack.key}`);
    });

    return { 
      success: true, 
      tenantId, 
      message: `Tenant "${tenantInfo.businessName}" created successfully from ${pack.name} pack` 
    };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error cloning tenant:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to clone tenant from pack' 
    };
  }
}

export async function exportPackAsJson(id: number): Promise<{ success: boolean; json?: string; message: string }> {
  try {
    const pack = await getPack(id);
    if (!pack) {
      return { success: false, message: 'Pack not found' };
    }

    const exportData = {
      key: pack.key,
      name: pack.name,
      description: pack.description,
      configJson: pack.configJson,
      isPublic: pack.isPublic,
      templates: pack.templates?.map(t => ({
        templateKey: t.templateKey,
        templateValue: t.templateValue,
      })),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    return { 
      success: true, 
      json: JSON.stringify(exportData, null, 2), 
      message: 'Pack exported successfully' 
    };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error exporting pack:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to export pack' 
    };
  }
}

export async function importPackFromJson(
  jsonString: string
): Promise<{ success: boolean; pack?: IndustryPack; message: string }> {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.key || !data.name) {
      return { success: false, message: 'Invalid pack JSON: missing key or name' };
    }

    const existing = await getPackByKey(data.key);
    if (existing) {
      return { success: false, message: `Pack with key "${data.key}" already exists` };
    }

    const [created] = await db
      .insert(industryPacks)
      .values({
        key: data.key,
        name: data.name,
        description: data.description || null,
        configJson: data.configJson || {},
        isPublic: data.isPublic || false,
      })
      .returning();

    if (data.templates && Array.isArray(data.templates)) {
      for (const template of data.templates) {
        await db.insert(industryPackTemplates).values({
          packId: created.id,
          templateKey: template.templateKey,
          templateValue: template.templateValue,
        });
      }
    }

    return { success: true, pack: created, message: 'Pack imported successfully' };
  } catch (error) {
    console.error('[INDUSTRY PACK] Error importing pack:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to import pack' 
    };
  }
}
