import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    twoFactorVerified?: boolean;
    isDemo?: boolean;
    demoStartedAt?: number;
  }
}
