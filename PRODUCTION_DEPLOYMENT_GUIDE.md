# Production Deployment Guide - Clean Machine PWA

## Current Status: READY FOR PRODUCTION DEPLOYMENT

### What Was Fixed

**Root Cause:** The app was running in development mode even on cleanmachinetulsa.com, which disabled all PWA features:
- ❌ Service worker didn't register
- ❌ Session cookies missing `Secure` flag → mobile browsers rejected them
- ❌ Manifest's `start_url` ignored → always opened to homepage
- ❌ No app shortcuts, no fullscreen mode

**Solution Implemented:**
1. ✅ Built production bundle (`dist/index.js` + static assets)
2. ✅ Created smart `/launch` route with device detection:
   - 📱 **Phones** → `/messages` (your primary communication hub)
   - 📱 **iPad/Tablets** → `/technician` (technician workflow interface)
3. ✅ Updated manifest.json to use `/launch` as start_url
4. ✅ Updated all login redirects to use device-aware routing

---

## Step-by-Step: Deploy to Production

### Step 1: Publish the App

In Replit, click the **"Publish"** button (or "Deploy" if using Deployments).

**What happens automatically:**
- Replit runs `npm run build` (creates production bundle)
- Launches with `NODE_ENV=production node dist/index.js`
- Service worker activates
- Secure session cookies enabled
- All PWA features turn on

### Step 2: Verify Production Mode is Active

After publishing, open **cleanmachinetulsa.com** in your browser and:

1. **Open DevTools Console** (F12)
2. **Check for production mode:**
   - ✅ Should see: `[PWA] PRODUCTION - Service Worker registered successfully`
   - ❌ Should NOT see: `[PWA] DEV MODE - Service Worker disabled`

3. **Verify Service Worker:**
   - DevTools → Application tab → Service Workers
   - ✅ Should show: **service-worker.js (activated and running)**

4. **Verify Session Cookie:**
   - DevTools → Application tab → Cookies
   - ✅ Find cookie named `sessionId`
   - ✅ Check: `Secure = ✓` and `SameSite = None`

---

## Step 3: Install PWA on Your Phone

**CRITICAL: Follow this exact order!**

1. **Delete any existing PWA** from your home screen
2. **Open cleanmachinetulsa.com** in your mobile browser (Safari/Chrome)
3. **Log in first** (this creates your session cookie)
4. **THEN tap "Add to Home Screen"**
5. **Name it** whatever you want (e.g., "Clean Machine")

---

## Step 4: Test PWA Features

### Expected Behavior:

**✅ On iPhone:**
- Opens in fullscreen (no Safari chrome/address bar)
- Launches directly to `/messages` (not homepage)
- Session persists (stays logged in)
- Press-and-hold icon → shows app shortcuts:
  - Today's Schedule
  - This Week's Openings
  - Quick Booking
  - New Message

**✅ On iPad:**
- Opens in fullscreen
- Launches directly to `/technician` page
- Session persists (stays logged in)
- Same app shortcuts as iPhone

---

## Step 5: Verify Device Detection

To confirm the smart routing works:

1. **Open the PWA on your phone**
   - Should go to `/messages`
   - Check console: `[LAUNCH] Mobile phone detected → redirecting to /messages`

2. **Open the PWA on your iPad**
   - Should go to `/technician`
   - Check console: `[LAUNCH] iPad/Tablet detected → redirecting to /technician`

---

## Troubleshooting

### Problem: Still opens to homepage (/)
**Cause:** You installed the PWA before publishing, or while logged out  
**Fix:** Delete PWA, log in on website first, then reinstall

### Problem: Session doesn't persist (asks to login every time)
**Cause:** Cookie not set with Secure flag (still in dev mode)  
**Fix:** Verify production deployment, check DevTools for `sessionId` cookie with `Secure = ✓`

### Problem: No fullscreen mode / shows Safari chrome
**Cause:** Service worker not registered (still in dev mode)  
**Fix:** Verify production deployment, check console for service worker registration

### Problem: No app shortcuts on press-and-hold
**Cause:** Manifest not loaded or service worker not active  
**Fix:** Verify service worker is active in DevTools, reinstall PWA

### Problem: Opens to wrong page on device
**Cause:** Device detection logic may need adjustment  
**Fix:** Check console logs in `/launch` route, verify user agent detection

---

## Production Checklist

Before telling users the app is ready:

- [ ] Published from Replit (Deploy/Publish button clicked)
- [ ] Console shows: `[PWA] PRODUCTION - Service Worker registered`
- [ ] DevTools shows: Service worker active
- [ ] `sessionId` cookie has `Secure = ✓` and `SameSite = None`
- [ ] PWA installs on phone and opens to `/messages`
- [ ] PWA installs on iPad and opens to `/technician`
- [ ] Session persists across PWA launches (stays logged in)
- [ ] Fullscreen mode works (no browser chrome)
- [ ] App shortcuts appear on press-and-hold

---

## What's Different Between Dev and Production?

| Feature | Development Mode | Production Mode |
|---------|------------------|-----------------|
| Service Worker | ❌ Disabled | ✅ Active |
| Session Cookies | `Secure = false` | `Secure = true` |
| Cookie SameSite | `lax` | `none` |
| PWA Fullscreen | ❌ No | ✅ Yes |
| App Shortcuts | ❌ No | ✅ Yes |
| Manifest `start_url` | Ignored | `/launch` |
| Caching | Disabled | Smart caching |

---

## Technical Details

### Production Build Output:
```
dist/
├── index.js (1.7MB server bundle)
└── public/
    ├── index.html
    └── assets/
        ├── index-[hash].js (3.3MB client bundle)
        └── index-[hash].css (203KB styles)
```

### Deployment Command:
```bash
NODE_ENV=production node dist/index.js
```

### Service Worker Detection:
```javascript
// In client/src/main.tsx
const isDevelopment = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('.replit.dev');

if (!isDevelopment) {
  navigator.serviceWorker.register('/service-worker.js');
}
```

### Session Middleware (Production):
```javascript
cookie: {
  httpOnly: true,
  secure: true,         // HTTPS only
  sameSite: 'none',     // Cross-site compatible
  maxAge: 30 days
}
```

---

## Next Steps

1. **Click "Publish" in Replit**
2. **Wait for deployment to complete** (~1-2 minutes)
3. **Verify production mode** (check console logs)
4. **Test PWA installation** on phone and iPad
5. **Confirm device-specific routing** works correctly

---

## Support

If anything doesn't work as expected:

1. **Check the console** for error messages
2. **Verify service worker** is active in DevTools
3. **Clear browser cache** and cookies, try again
4. **Reinstall PWA** after deleting old version
5. **Check network tab** for failed requests

Remember: The PWA must be installed while logged in for session persistence to work!
