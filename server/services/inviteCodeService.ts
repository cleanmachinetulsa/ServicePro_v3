import { db } from '../db';
import { tenantInviteCodes, tenants } from '@shared/schema';
import { eq, and, sql, lt, or, isNull, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { TenantInviteCode, InsertTenantInviteCode } from '@shared/schema';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export type InviteCodeValidationResult = 
  | { success: false; reason: 'not_found' | 'inactive' | 'expired' | 'max_redemptions_reached' }
  | { success: true; invite: { code: string; inviteType: string; planTier: string; label: string; description: string | null } };

export const inviteCodeService = {
  async listCodes(): Promise<TenantInviteCode[]> {
    return db
      .select()
      .from(tenantInviteCodes)
      .orderBy(desc(tenantInviteCodes.createdAt));
  },

  async getCodeById(id: number): Promise<TenantInviteCode | null> {
    const [code] = await db
      .select()
      .from(tenantInviteCodes)
      .where(eq(tenantInviteCodes.id, id))
      .limit(1);
    return code || null;
  },

  async getCodeByCode(code: string): Promise<TenantInviteCode | null> {
    const [inviteCode] = await db
      .select()
      .from(tenantInviteCodes)
      .where(eq(tenantInviteCodes.code, code.toUpperCase()))
      .limit(1);
    return inviteCode || null;
  },

  async createCode(data: InsertTenantInviteCode & { createdByUserId?: number }): Promise<TenantInviteCode> {
    const code = generateInviteCode();
    
    const [created] = await db
      .insert(tenantInviteCodes)
      .values({
        code,
        label: data.label,
        description: data.description || null,
        inviteType: data.inviteType || 'friends_family',
        planTier: data.planTier,
        maxRedemptions: data.maxRedemptions || null,
        expiresAt: data.expiresAt || null,
        isActive: data.isActive ?? true,
        createdByUserId: data.createdByUserId || null,
        metadata: data.metadata || null,
      })
      .returning();
    
    return created;
  },

  async updateCode(
    id: number,
    updates: Partial<Pick<TenantInviteCode, 'label' | 'description' | 'maxRedemptions' | 'expiresAt' | 'isActive'>>
  ): Promise<TenantInviteCode | null> {
    const [updated] = await db
      .update(tenantInviteCodes)
      .set(updates)
      .where(eq(tenantInviteCodes.id, id))
      .returning();
    return updated || null;
  },

  async validateCode(code: string): Promise<InviteCodeValidationResult> {
    const inviteCode = await this.getCodeByCode(code);
    
    if (!inviteCode) {
      return { success: false, reason: 'not_found' };
    }
    
    if (!inviteCode.isActive) {
      return { success: false, reason: 'inactive' };
    }
    
    if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
      return { success: false, reason: 'expired' };
    }
    
    if (inviteCode.maxRedemptions !== null && inviteCode.usedCount >= inviteCode.maxRedemptions) {
      return { success: false, reason: 'max_redemptions_reached' };
    }
    
    return {
      success: true,
      invite: {
        code: inviteCode.code,
        inviteType: inviteCode.inviteType,
        planTier: inviteCode.planTier,
        label: inviteCode.label,
        description: inviteCode.description,
      },
    };
  },

  async redeemCode(code: string, tenantId: string): Promise<{ success: boolean; error?: string; planTier?: string }> {
    const validation = await this.validateCode(code);
    
    if (!validation.success) {
      return { 
        success: false, 
        error: validation.reason === 'not_found' ? 'Invite code not found' :
               validation.reason === 'inactive' ? 'Invite code is no longer active' :
               validation.reason === 'expired' ? 'Invite code has expired' :
               'Invite code has reached maximum redemptions'
      };
    }
    
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(tenantInviteCodes)
          .set({
            usedCount: sql`${tenantInviteCodes.usedCount} + 1`,
            lastUsedAt: new Date(),
          })
          .where(and(
            eq(tenantInviteCodes.code, code.toUpperCase()),
            eq(tenantInviteCodes.isActive, true),
            or(
              isNull(tenantInviteCodes.expiresAt),
              lt(sql`NOW()`, tenantInviteCodes.expiresAt)
            ),
            or(
              isNull(tenantInviteCodes.maxRedemptions),
              lt(tenantInviteCodes.usedCount, tenantInviteCodes.maxRedemptions)
            )
          ));
        
        await tx
          .update(tenants)
          .set({
            planTier: validation.invite.planTier as any,
            billingComplimentary: true,
            inviteCodeUsed: code.toUpperCase(),
            status: 'active',
          })
          .where(eq(tenants.id, tenantId));
      });
      
      return { success: true, planTier: validation.invite.planTier };
    } catch (error: any) {
      console.error('[INVITE CODE] Redemption error:', error);
      return { success: false, error: error.message };
    }
  },
};
