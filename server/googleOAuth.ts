import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Express } from 'express';
import * as oauthStorage from './oauthStorage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

export function setupGoogleOAuth(app: Express) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('[GOOGLE OAUTH] Missing credentials - Google OAuth login disabled');
    return;
  }

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google OAuth strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already has this Google account linked
          const oauthProvider = await oauthStorage.getOAuthProvider('google', profile.id);

          if (oauthProvider) {
            // Update last used timestamp and tokens
            await oauthStorage.updateOAuthProvider(oauthProvider.id, {
              accessToken,
              refreshToken: refreshToken || oauthProvider.refreshToken,
              lastUsedAt: new Date(),
            });

            // Get the linked user account
            const user = await oauthStorage.getUserById(oauthProvider.userId);
            return done(null, user);
          }

          // No existing link - check if user with this email exists
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email provided by Google'));
          }

          let user = await oauthStorage.getUserByEmail(email);

          if (user) {
            // Link this Google account to existing user
            await oauthStorage.createOAuthProvider({
              userId: user.id,
              provider: 'google',
              providerId: profile.id,
              email,
              displayName: profile.displayName,
              profileImageUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            });
          } else {
            // Create new user account
            user = await oauthStorage.createUserFromOAuth({
              email,
              fullName: profile.displayName,
              role: 'employee',
            });

            // Link Google account to new user
            await oauthStorage.createOAuthProvider({
              userId: user.id,
              provider: 'google',
              providerId: profile.id,
              email,
              displayName: profile.displayName,
              profileImageUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            });
          }

          return done(null, user);
        } catch (error) {
          console.error('[GOOGLE OAUTH] Authentication error:', error);
          return done(error);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await oauthStorage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Google OAuth routes
  app.get(
    '/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get(
    '/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' }),
    async (req, res) => {
      // Check if user account is active
      const user = req.user as any;
      
      if (!user?.isActive) {
        // SECURITY: User exists but account is inactive - destroy session before redirect
        // This prevents unauthorized access with the session cookie
        try {
          // Wait for logout to complete
          await new Promise<void>((resolve, reject) => {
            req.logout((err) => {
              if (err) {
                console.error('[GOOGLE OAUTH] Logout error for inactive user:', err);
                reject(err);
              } else {
                resolve();
              }
            });
          });

          // Wait for session destruction to complete
          await new Promise<void>((resolve, reject) => {
            req.session.destroy((destroyErr) => {
              if (destroyErr) {
                console.error('[GOOGLE OAUTH] Session destroy error:', destroyErr);
                reject(destroyErr);
              } else {
                resolve();
              }
            });
          });

          // Clear the session cookie
          res.clearCookie('connect.sid');
          // Redirect to login with error message
          return res.redirect('/login?error=account_inactive');
        } catch (error) {
          // If session cleanup fails, still redirect but log the error
          console.error('[GOOGLE OAUTH] Failed to clean up session for inactive user:', error);
          res.clearCookie('connect.sid');
          return res.redirect('/login?error=account_inactive');
        }
      }
      
      // Successful authentication - redirect to dashboard
      res.redirect('/messages');
    }
  );

  console.log('[GOOGLE OAUTH] Routes initialized successfully');
}
