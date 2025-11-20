import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';

// Validate SESSION_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('CRITICAL: SESSION_SECRET environment variable is required in production!');
  process.exit(1);
}

// Require strong SESSION_SECRET (at least 32 characters)
const sessionSecret = process.env.SESSION_SECRET || 'clean-machine-session-secret-change-in-production';
if (process.env.NODE_ENV === 'production' && sessionSecret.length < 32) {
  console.error('CRITICAL: SESSION_SECRET must be at least 32 characters long!');
  process.exit(1);
}

// Configure PostgreSQL session store for persistent sessions
const PgSession = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Shared session middleware for both Express and Socket.IO
 * This ensures consistent session handling across HTTP and WebSocket connections
 */
// Detect if running on Replit (always HTTPS even in dev)
const isReplit = process.env.REPL_ID !== undefined || process.env.REPL_SLUG !== undefined;

export const sessionMiddleware = session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'session', // Table name for storing sessions
    createTableIfMissing: true, // Auto-create the session table
    pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: 'auto', // Auto-detect based on request protocol and trust proxy setting
    sameSite: (isReplit || process.env.NODE_ENV === 'production') ? 'none' : 'lax', // 'none' for Replit/production
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (extended session)
    path: '/', // Ensure cookie is available on all paths
  },
  name: 'sessionId', // Custom cookie name
  proxy: true, // Trust proxy (Replit uses proxy)
});
