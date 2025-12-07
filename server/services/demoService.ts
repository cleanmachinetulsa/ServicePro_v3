/**
 * CM-DEMO-1: Demo Mode Service
 * 
 * Handles demo session management, phone verification, and demo data seeding.
 */

import { db } from '../db';
import { demoSessions, tenants, customers, appointments, messages, DemoSession } from '@shared/schema';
import { DEMO_TENANT_ID, DEMO_TENANT_NAME, DEMO_TENANT_SLUG, DEMO_SESSION_DURATION_HOURS, isDemoTenant } from '@shared/demoConfig';
import { eq, and, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { addHours, addMinutes } from 'date-fns';

export interface CreateDemoSessionResult {
  success: boolean;
  sessionToken?: string;
  sessionId?: string;
  expiresAt?: Date;
  error?: string;
}

export async function createDemoSession(
  ipAddress?: string,
  userAgent?: string
): Promise<CreateDemoSessionResult> {
  try {
    const expiresAt = addHours(new Date(), DEMO_SESSION_DURATION_HOURS);
    const sessionToken = `demo-${nanoid(32)}`;

    const [session] = await db.insert(demoSessions).values({
      tenantId: DEMO_TENANT_ID,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    }).returning();

    console.log(`[DEMO] Created demo session: ${session.id}`);

    return {
      success: true,
      sessionToken: `${sessionToken}-${session.id}`,
      sessionId: session.id,
      expiresAt,
    };
  } catch (error) {
    console.error('[DEMO] Failed to create demo session:', error);
    return {
      success: false,
      error: 'Failed to create demo session',
    };
  }
}

export async function getDemoSession(sessionToken: string): Promise<DemoSession | null> {
  if (!sessionToken || !sessionToken.startsWith('demo-')) {
    return null;
  }

  const parts = sessionToken.split('-');
  const sessionId = parts[parts.length - 1];

  try {
    const [session] = await db
      .select()
      .from(demoSessions)
      .where(
        and(
          eq(demoSessions.id, sessionId),
          gt(demoSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    return session || null;
  } catch (error) {
    console.error('[DEMO] Failed to get demo session:', error);
    return null;
  }
}

export async function sendDemoVerificationCode(
  sessionToken: string,
  phone: string,
  sendSmsFn: (to: string, body: string) => Promise<boolean>
): Promise<{ success: boolean; error?: string }> {
  const session = await getDemoSession(sessionToken);
  
  if (!session) {
    return { success: false, error: 'Demo session not found or expired' };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeExpiresAt = addMinutes(new Date(), 10);

  try {
    await db.update(demoSessions)
      .set({
        pendingCode: code,
        codeExpiresAt,
      })
      .where(eq(demoSessions.id, session.id));

    const sent = await sendSmsFn(phone, `Your Clean Machine Demo verification code is: ${code}. Valid for 10 minutes.`);

    if (!sent) {
      return { success: false, error: 'Failed to send verification SMS' };
    }

    console.log(`[DEMO] Sent verification code to ${phone} for session ${session.id}`);
    return { success: true };
  } catch (error) {
    console.error('[DEMO] Failed to send verification code:', error);
    return { success: false, error: 'Failed to send verification code' };
  }
}

export async function verifyDemoCode(
  sessionToken: string,
  code: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getDemoSession(sessionToken);
  
  if (!session) {
    return { success: false, error: 'Demo session not found or expired' };
  }

  if (!session.pendingCode || !session.codeExpiresAt) {
    return { success: false, error: 'No verification code pending' };
  }

  if (new Date() > session.codeExpiresAt) {
    return { success: false, error: 'Verification code expired' };
  }

  if (session.pendingCode !== code) {
    return { success: false, error: 'Invalid verification code' };
  }

  try {
    await db.update(demoSessions)
      .set({
        verifiedDemoPhone: phone,
        pendingCode: null,
        codeExpiresAt: null,
      })
      .where(eq(demoSessions.id, session.id));

    console.log(`[DEMO] Phone ${phone} verified for session ${session.id}`);
    return { success: true };
  } catch (error) {
    console.error('[DEMO] Failed to verify demo code:', error);
    return { success: false, error: 'Failed to verify code' };
  }
}

export async function getDemoSessionInfo(sessionToken: string): Promise<{
  verified: boolean;
  phone?: string;
  expiresAt?: Date;
} | null> {
  const session = await getDemoSession(sessionToken);
  
  if (!session) {
    return null;
  }

  return {
    verified: !!session.verifiedDemoPhone,
    phone: session.verifiedDemoPhone || undefined,
    expiresAt: session.expiresAt,
  };
}

export async function ensureDemoTenantExists(): Promise<boolean> {
  try {
    const [existing] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, DEMO_TENANT_ID))
      .limit(1);

    if (existing) {
      console.log('[DEMO] Demo tenant already exists');
      return true;
    }

    await db.insert(tenants).values({
      id: DEMO_TENANT_ID,
      name: DEMO_TENANT_NAME,
      subdomain: DEMO_TENANT_SLUG,
      isRoot: false,
      planTier: 'pro',
      status: 'active',
    });

    console.log('[DEMO] Demo tenant created');
    return true;
  } catch (error) {
    console.error('[DEMO] Failed to ensure demo tenant:', error);
    return false;
  }
}

const FAKE_FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Parker', 'Dakota', 'Skyler', 'Jamie', 'Drew', 'Reese', 'Cameron', 'Charlie', 'Finley', 'Hayden', 'Jessie', 'Kelly'];
const FAKE_LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson'];

export function generateFakePhone(index: number): string {
  const suffix = String(1000 + index).padStart(4, '0');
  return `+1555${String(100 + Math.floor(index / 100)).slice(-3)}${suffix}`;
}

export function generateFakeEmail(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo-cleanmachine.example`;
}

export async function seedDemoData(): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDemoTenantExists();

    console.log('[DEMO SEED] Demo data seeding would occur here');
    console.log('[DEMO SEED] For full implementation, run: npm run seed:demo');

    return { success: true };
  } catch (error) {
    console.error('[DEMO SEED] Failed to seed demo data:', error);
    return { success: false, error: 'Failed to seed demo data' };
  }
}
