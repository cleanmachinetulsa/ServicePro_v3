import { db } from './db';
import { users, oauthProviders } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export interface OAuthProvider {
  id: number;
  userId: number;
  provider: string;
  providerId: string;
  email: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  lastUsedAt: Date | null;
}

export async function getOAuthProvider(provider: string, providerId: string) {
  const [result] = await db
    .select()
    .from(oauthProviders)
    .where(
      and(
        eq(oauthProviders.provider, provider),
        eq(oauthProviders.providerId, providerId)
      )
    )
    .limit(1);
  return result;
}

export async function createOAuthProvider(data: {
  userId: number;
  provider: string;
  providerId: string;
  email: string;
  displayName?: string;
  profileImageUrl?: string;
  accessToken?: string;
  refreshToken?: string | null;
}) {
  const [provider] = await db
    .insert(oauthProviders)
    .values({
      userId: data.userId,
      provider: data.provider,
      providerId: data.providerId,
      email: data.email,
      displayName: data.displayName || null,
      profileImageUrl: data.profileImageUrl || null,
      accessToken: data.accessToken || null,
      refreshToken: data.refreshToken || null,
      lastUsedAt: new Date(),
    })
    .returning();
  return provider;
}

export async function updateOAuthProvider(
  id: number,
  updates: {
    accessToken?: string;
    refreshToken?: string;
    lastUsedAt?: Date;
  }
) {
  const [updated] = await db
    .update(oauthProviders)
    .set(updates)
    .where(eq(oauthProviders.id, id))
    .returning();
  return updated;
}

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user;
}

export async function getUserById(id: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function createUserFromOAuth(data: {
  email: string;
  fullName: string;
  role: string;
}) {
  // Generate a random password for OAuth users (they won't use it)
  const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
  
  // Create username from email
  const username = data.email.split('@')[0] + '_' + Math.random().toString(36).substring(7);

  const [user] = await db
    .insert(users)
    .values({
      username,
      password: randomPassword,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      isActive: false, // OAuth users start INACTIVE and need admin approval for security
      requirePasswordChange: false, // OAuth users don't need password change
    })
    .returning();
  return user;
}
