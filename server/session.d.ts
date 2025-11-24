import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    tenantId?: string;
    twoFactorVerified?: boolean;
    isDemo?: boolean;
    demoStartedAt?: number;
    impersonatingTenantId?: string | null;
    impersonationTenantName?: string | null;
    impersonationStartedAt?: string | null;
    impersonationSessionId?: string | null;
  }
}
