# Deployment Safety Checklist for Clean Machine Auto Detail

## Pre-Deployment Verification

Before republishing to production, verify these critical settings:

### 1. **Session & Authentication** ✅ CRITICAL
```typescript
// server/index.ts - Express trust proxy setting
app.set('trust proxy', true); // MUST be true for Replit multi-proxy setup

// server/sessionMiddleware.ts - Session cookie configuration
cookie: {
  secure: 'auto', // Auto-detect HTTPS based on trust proxy
  sameSite: 'none', // Required for Replit's proxy chain
  proxy: true, // Trust proxy for session handling
}
```

**Why:** Replit uses Cloudflare + Load Balancer. The `secure: 'auto'` setting allows Express to auto-detect HTTPS based on proxy headers, ensuring cookies work correctly in both dev and production.

**Test:** After deployment, open browser DevTools → Application → Cookies and verify `sessionId` has:
- ✅ `Secure` flag set (production only)
- ✅ `SameSite=None`
- ✅ Cookie is present after login
- ✅ Cookie persists across page refreshes

### 2. **Service Worker Version** 
Check `public/service-worker.js`:
```javascript
const CACHE_VERSION = 'comm-hub-v18-dev-bypass'; // Bump version on major changes
```

**Why:** Old cached service workers can serve stale code to users.

**Action:** Increment version number when deploying breaking changes.

### 3. **Database Schema Migrations**
Before deploying schema changes:
```bash
# Run this in development first
npm run db:push --force
```

**Check:** Ensure no breaking schema changes (like `tenantId` addition) without migration.

### 4. **Environment Secrets**
Verify all required secrets are set in Replit:
- ✅ `GOOGLE_PLACE_ID` (for reviews)
- ✅ `BUSINESS_OWNER_PERSONAL_PHONE` (for call forwarding)
- ✅ `BUSINESS_PHONE_NUMBER` (main line)
- ✅ All API keys (Twilio, OpenAI, Stripe, etc.)

**Test:** Check `/api/health` endpoint after deployment.

### 5. **API Rate Limits**
Verify rate limiting is appropriate for production:
```typescript
max: 600, // Requests per minute per IP
```

### 6. **Cache Headers**
Ensure production caching is enabled:
```typescript
if (isDevelopment) {
  // Dev: no cache
} else {
  // Production: smart caching ✅
}
```

## Post-Deployment Smoke Tests

After republishing, manually test these critical flows:

### User-Facing Features:
1. ✅ **Homepage loads** without errors
2. ✅ **Book appointment** - click "Book Now" → verify scheduler loads
3. ✅ **Web chat** - send message → AI responds
4. ✅ **Google Reviews** - reviews display on homepage
5. ✅ **Gallery** - photos load correctly

### Admin Features:
1. ✅ **Login** - admin can authenticate
2. ✅ **Dashboard** - loads without 401 errors
3. ✅ **Messages** - can view/send SMS
4. ✅ **Schedule** - can view/create appointments
5. ✅ **Settings** - can update business settings

### Mobile Testing:
1. ✅ **PWA Install** - install prompt appears
2. ✅ **Offline Mode** - app works when offline
3. ✅ **Push Notifications** - notifications arrive

## Common Deployment Issues & Fixes

### Issue 1: "401 Unauthorized" on all admin features
**Root Cause:** Session cookie not persisting due to incorrect `secure` setting
**Fix:** 
1. Verify `app.set('trust proxy', true)` in server/index.ts
2. Set `cookie.secure = 'auto'` in server/sessionMiddleware.ts (NOT hard-coded to true)
3. Ensure `proxy: true` in session configuration
**Validation:** Check browser DevTools → Cookies → verify `sessionId` appears and persists

### Issue 2: Users see old version after deployment
**Cause:** Stale service worker cache
**Fix:** Bump `CACHE_VERSION` in service-worker.js

### Issue 3: Google Reviews not loading
**Cause:** Invalid `GOOGLE_PLACE_ID`
**Fix:** Update secret with correct Place ID from Google Business Profile

### Issue 4: Database errors on new features
**Cause:** Schema not migrated to production
**Fix:** Schema migrations happen automatically on Replit deploy, but verify no errors in logs

### Issue 5: Stripe payments fail
**Cause:** Webhook signature mismatch or missing secret
**Fix:** Verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are correct

## Quick Deployment Command

```bash
# 1. Test locally first
npm run dev

# 2. Verify no errors in browser console

# 3. Commit changes
git add .
git commit -m "Production deployment: [describe changes]"

# 4. Republish via Replit UI
# Click "Publish" button in Replit

# 5. Run post-deployment smoke tests (see above)
```

## Rollback Procedure

If deployment breaks production:

1. **Immediate:** Use Replit's rollback feature (checkpoints)
2. **Identify:** Check production logs for errors
3. **Fix:** Apply hotfix in dev → test → redeploy
4. **Communicate:** Notify customers if downtime occurred

## Production Monitoring

After deployment, monitor:
- ✅ Error logs for 401/500 errors
- ✅ Google Analytics for traffic drops
- ✅ Customer messages/calls about issues
- ✅ Uptime monitoring (if configured)

---

**Last Updated:** November 20, 2024
**Maintained By:** Clean Machine Development Team
