import { db } from './db';
import { sql } from 'drizzle-orm';
import { wrapTenantDb } from './tenantDb';

export async function initializePushNotificationsTable(): Promise<void> {
  const tenantDb = wrapTenantDb(db, 'root');
  try {
    await tenantDb.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('[PUSH INIT] Push subscriptions table initialized');
  } catch (error) {
    console.error('[PUSH INIT] Error initializing push subscriptions table:', error);
    throw error;
  }
}
