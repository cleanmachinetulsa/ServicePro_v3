# Clean Machine Deployment Guide
**Last Updated:** November 16, 2025

## Issue: Published App Stuck on "Loading..."

### Root Cause
The published app at `cleanmachineintulsa.com` is stuck loading because the deployment needs proper production environment configuration.

---

## Quick Fix Steps

### 1. Access Deployment Settings
1. Open your Replit workspace
2. Click **"Deployments"** in the left sidebar
3. Select your active deployment (cleanmachineintulsa.com)
4. Click **"Settings"** or **"Configure"**

### 2. Set Required Environment Variables

**Critical Environment Variables to Add:**

```bash
NODE_ENV=production
SESSION_SECRET=<generate-a-secure-random-string-at-least-32-chars>
```

**To generate SESSION_SECRET:**
```bash
# Run this in Replit Shell to generate a secure secret:
openssl rand -base64 32
```

### 3. Verify Auto-Synced Secrets

These should already be synced from your workspace (verify they exist):
- ✅ `DATABASE_URL` - Production database connection
- ✅ `OPENAI_API_KEY` - AI chatbot functionality
- ✅ `TWILIO_ACCOUNT_SID` - SMS/Voice
- ✅ `TWILIO_AUTH_TOKEN` - SMS/Voice
- ✅ `SENDGRID_API_KEY` - Email
- ✅ `STRIPE_SECRET_KEY` - Payments
- ✅ `BUSINESS_OWNER_PERSONAL_PHONE` - Owner contact
- ✅ `BUSINESS_PHONE_NUMBER` - Main business line
- ✅ `GOOGLE_PLACE_ID` - Google reviews/maps

**Additional secrets that may be needed:**
- `TWILIO_PHONE_NUMBER` - Twilio phone number
- `SLACK_WEBHOOK_URL` - Slack notifications
- `PAYPAL_CLIENT_ID` - PayPal payments
- `PAYPAL_CLIENT_SECRET` - PayPal payments
- `FACEBOOK_PAGE_ACCESS_TOKEN` - Facebook Messenger
- `INSTAGRAM_PAGE_ACCESS_TOKEN` - Instagram DMs
- `VITE_STRIPE_PUBLIC_KEY` - Frontend Stripe integration
- `OPEN_METEO_API_KEY` - Weather API (if required)

### 4. Configure Production Database

**Option A: Use Replit Database (Recommended)**
1. In your deployment settings, ensure "Database" is enabled
2. Replit will automatically create a production database
3. `DATABASE_URL` will be auto-configured

**Option B: Use Existing Neon Database**
1. Get your production database URL from Neon
2. Add it to deployment secrets as `DATABASE_URL`
3. Format: `postgresql://user:pass@host/database?sslmode=require`

### 5. Deploy Configuration

**Build Command:**
```bash
npm run build
```

**Run Command:**
```bash
npm run start
```

**Port:** `5000` (default)

---

## Troubleshooting

### Issue: Still showing "Loading..."

**Check 1: Database Connection**
```bash
# In Replit Shell, test database connection:
psql $DATABASE_URL -c "SELECT 1"
```

**Check 2: Deployment Logs**
1. Go to Deployments → Active Deployment
2. Click "Logs" tab
3. Look for errors related to:
   - Database connection failures
   - Missing environment variables
   - Session middleware errors

**Check 3: Browser Console**
1. Open cleanmachineintulsa.com
2. Right-click → Inspect → Console tab
3. Look for API errors (401, 500, CORS errors)
4. Screenshot and share any red errors

### Issue: 401 Authentication Errors

**Cause:** Session middleware failing due to missing `SESSION_SECRET` or cookie configuration

**Fix:**
1. Add `SESSION_SECRET` to deployment secrets (32+ character random string)
2. Ensure `NODE_ENV=production` is set
3. Redeploy

### Issue: CORS Errors

**Cause:** Custom domain not properly configured in CORS settings

**Fix:** Check `server/index.ts` - CORS should allow cleanmachineintulsa.com

### Issue: Database Migration Errors

**Cause:** Production database schema not up to date

**Fix:**
```bash
# In production environment, run:
npm run db:push
```

---

## Production Checklist

Before deploying, verify:

- [ ] `NODE_ENV=production` set in deployment
- [ ] `SESSION_SECRET` configured (32+ chars)
- [ ] All workspace secrets auto-synced to deployment
- [ ] Production database provisioned and connected
- [ ] Database schema migrated (`npm run db:push`)
- [ ] Custom domain DNS configured (cleanmachineintulsa.com)
- [ ] SSL certificate active (HTTPS)
- [ ] Health check endpoint responding (`/api/health`)
- [ ] PWA manifest accessible (`/manifest.json`)
- [ ] Service worker registered (`/service-worker.js`)

---

## Security Notes

### Production-Only Features
When `NODE_ENV=production`:
- ✅ Session cookies are `secure` (HTTPS only)
- ✅ Session cookies use `sameSite: 'none'`
- ✅ SESSION_SECRET validation enforced (32+ chars)
- ✅ Error stack traces hidden from API responses
- ✅ Enhanced logging and monitoring

### Critical Security Requirements
1. **Never commit secrets to git**
2. **Use strong SESSION_SECRET** (32+ random characters)
3. **Rotate secrets regularly** (every 90 days)
4. **Enable HTTPS only** (HTTP redirects to HTTPS)
5. **Keep dependencies updated** (`npm audit`)

---

## Post-Deployment Testing

### 1. Test Core Features
- [ ] Homepage loads correctly
- [ ] User can log in
- [ ] Dashboard displays data
- [ ] Messages page works
- [ ] Booking form submits
- [ ] Payments process
- [ ] SMS sends successfully
- [ ] Email sends successfully

### 2. Test PWA Features
- [ ] Install prompt appears
- [ ] App installs to home screen
- [ ] Offline mode works
- [ ] App shortcuts function
- [ ] Badge notifications work
- [ ] Service worker active

### 3. Monitor Production
- [ ] Check deployment logs daily
- [ ] Monitor error rates
- [ ] Track API response times
- [ ] Verify database performance
- [ ] Review user feedback

---

## Rollback Plan

If deployment fails:

1. **Quick Rollback:**
   - Go to Deployments → History
   - Select previous working deployment
   - Click "Rollback to this version"

2. **Emergency Contact:**
   - Replit Support: support@replit.com
   - Check Replit Status: status.replit.com

---

## Next Steps After Fix

Once the app is working:

1. **Performance Optimization**
   - Enable CDN for static assets
   - Implement database connection pooling
   - Add Redis cache for sessions
   - Enable gzip compression

2. **Monitoring Setup**
   - Add error tracking (Sentry, LogRocket)
   - Set up uptime monitoring (UptimeRobot)
   - Configure performance monitoring (New Relic, DataDog)

3. **Backup Strategy**
   - Daily database backups
   - Weekly full system snapshots
   - Test restore process monthly

---

## Support Resources

- **Replit Docs:** https://docs.replit.com/
- **Deployment Guide:** https://docs.replit.com/deployments
- **Database Guide:** https://docs.replit.com/hosting/databases
- **Custom Domains:** https://docs.replit.com/deployments/custom-domains

---

**Need Help?**
If you're still stuck after following this guide:
1. Screenshot the deployment logs
2. Screenshot browser console errors
3. Share with Replit support or your development team
