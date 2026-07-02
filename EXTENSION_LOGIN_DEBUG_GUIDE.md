# Extension Login & Data Sync - Complete Debug Guide

## Problem Statement
Even after successful Job Orbit login via OAuth, the extension shows "Login" button instead of "Connected", and no data is being fetched or pushed to the backend.

## Root Causes Fixed

### 1. ✅ Token Persistence Issue (CRITICAL)
**Problem**: Token was not persisting between popup opens
- Service worker stores token in `chrome.storage.sync` AND `chrome.storage.local`
- TokenVerifier reads from sync first, fallback to local
- Token storage key: `jobOrbitAuth` with structure `{ extensionToken, expiresAt, user, receivedAt }`

**Files Fixed**:
- `extension/src/utils/TokenVerifier.js` - Added detailed logging for token retrieval
- `extension/src/background/service-worker.js` - Confirmed dual storage (sync + local)

### 2. ✅ API Configuration Not Available (CRITICAL)
**Problem**: `API_BASE_URL` was used directly in popup.js but not defined
- Causes "ReferenceError: API_BASE_URL is not defined"
- Must use `CONFIG.API_BASE_URL` with fallback

**Files Fixed**:
- `extension/src/popup/popup.js` - Replaced all `API_BASE_URL` with `CONFIG.API_BASE_URL` (4 places)
- `extension/src/config/config.js` - Already defined, just needed to be used correctly

### 3. ✅ ProfileSyncManager.uploadProfile() Undefined Variable
**Problem**: `config.apiUrl` used but `config` variable never defined
- Should use `this.getApiConfig()`

**Files Fixed**:
- `extension/src/utils/ProfileSyncManager.js` - Added `const config = this.getApiConfig();`

### 4. ✅ Backend Auth Endpoint Not Logging Properly
**Problem**: `/api/auth/me` endpoint had no detailed logging to debug token issues

**Files Fixed**:
- `backend/src/routes/auth.js` - Added comprehensive logging at every step

## Step-by-Step Debug Flow

### Phase 1: Browser Console Testing (After Redeployment)

1. **Open Extension Popup** (DevTools F12)
   - Switch to extension popup
   - Open DevTools
   - Go to Console tab

2. **Check Token Storage**
   ```javascript
   // In DevTools Console:
   chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
     console.log('Sync storage:', result);
   });
   
   chrome.storage.local.get(['jobOrbitAuth'], (result) => {
     console.log('Local storage:', result);
   });
   ```

3. **Check Console Logs During Init**
   - Watch for `[TokenVerifier]` messages
   - Should see:
     - ✅ `🔍 Looking for token in chrome.storage.sync...`
     - ✅ `Found token in sync storage` (or local as fallback)
     - ✅ `🔐 Verifying token with backend...`
     - ✅ `📡 Response status: 200`
     - ✅ `✅ Token verified successfully`
     - ✅ `📥 Step 2: Syncing profile from Job Orbit...`

### Phase 2: Token Verification Flow

1. **Initial Token Should Be Stored**
   - After OAuth login, should see in service worker logs:
     - `[ServiceWorker] ⏬ Received external message: JOBORBIT_AUTH_RESPONSE`
     - `[ServiceWorker] ✅ Processing Job Orbit auth response`
     - `[ServiceWorker] 💾 Storing auth data`
     - `[ServiceWorker] ✅ Stored in chrome.storage.sync`
     - `[ServiceWorker] ✅ Stored in chrome.storage.local`

2. **TokenVerifier.getStoredToken() Should Find It**
   - Logs should show:
     - `[TokenVerifier] 🔍 Looking for token in chrome.storage.sync...`
     - `[TokenVerifier] ✅ Found token in sync storage`

3. **Backend Verification Should Pass**
   - Backend logs (via `console.log` in `/api/auth/me`):
     - `[Auth/me] Request received`
     - `[Auth/me] Token received, length: XXX`
     - `[Auth/me] Making request to: https://...`
     - `[Auth/me] Response status: 200`
     - `[Auth/me] ✅ Extension token verified for user: UUID`
     - `[Auth/me] User: email@example.com`

### Phase 3: Data Sync Should Begin
Once token is verified, should see:
- `[ProfileSync] 📥 Downloading profile from backend...`
- `[DataSync] 🔄 Starting full data synchronization...`
- `[DataSync] 📥 Fetching profile...`
- `[DataSync] 📥 Fetching resumes...`
- `[DataSync] 📥 Fetching applications...`
- `[DataSync] 📥 Fetching AI answers...`

## Testing After Redeployment

### Step 1: Verify Backend Updated
```bash
curl -s https://ats-resume-optimizer-359j.onrender.com/api/auth/me \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json"
```

Should return:
```json
{
  "success": false,
  "error": "Invalid token",
  "authenticated": false
}
```

NOT: `{"error":"Route not found","path":"/api/auth/me"...}`

### Step 2: Clear Extension Storage & Re-login
1. Open Extension DevTools (right-click extension icon → "Inspect popup")
2. Go to Console
3. Clear storage:
   ```javascript
   chrome.storage.sync.clear();
   chrome.storage.local.clear();
   ```
4. Close popup
5. Reopen popup
6. Should show "Login with Job Orbit"
7. Click login, complete OAuth
8. Watch console logs throughout process

### Step 3: Monitor Logs
Look for these patterns in console:

**✅ Good Sequence**:
```
[ServiceWorker] ⏬ Received external message: JOBORBIT_AUTH_RESPONSE
[ServiceWorker] ✅ Stored in chrome.storage.sync
[ServiceWorker] ✅ Stored in chrome.storage.local
[Popup] 🔐 Step 1: Verifying authentication...
[TokenVerifier] 🔍 Looking for token in chrome.storage.sync...
[TokenVerifier] ✅ Found token in sync storage
[TokenVerifier] 🌐 Making request to: https://ats-resume-optimizer-359j.onrender.com/api/auth/me
[TokenVerifier] ✅ Token verified successfully
[Popup] ✅ User authenticated: user@example.com
[Popup] 📥 Step 2: Syncing profile from Job Orbit...
[ProfileSync] 📥 Downloading profile from backend...
[Popup] ✅ Profile synced successfully
[Popup] 📥 Step 3: Syncing all data from Job Orbit...
[DataSync] ✅ Full data sync completed
```

**❌ Bad Sequence** (indicates problem):
```
[TokenVerifier] ❌ No token in storage
// OR
[TokenVerifier] ❌ Token invalid (HTTP 401)
// OR  
[TokenVerifier] ❌ Token not authenticated
```

## Common Issues & Solutions

### Issue 1: Token Not Persisting Between Popup Opens
**Symptoms**: Each time you open popup, it asks to login again

**Debugging Steps**:
1. After login, check chrome storage manually:
   ```javascript
   chrome.storage.sync.get(null, (result) => console.log(result));
   ```
2. Should contain `jobOrbitAuth` key
3. If not, service worker is not storing properly
4. Check for: `[ServiceWorker] ✅ Stored in chrome.storage.sync` log

**Solutions**:
- Chrome sync storage might be disabled → fallback to local works
- Check manifest.json has `"storage"` permission

### Issue 2: Backend Returns 401 (Unauthorized)
**Symptoms**: Token stored but verification fails with 401

**Debugging Steps**:
1. Get the actual token from storage
2. Test directly with curl:
   ```bash
   curl -X GET https://ats-resume-optimizer-359j.onrender.com/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json"
   ```
3. Check backend logs for token validation errors

**Solutions**:
- Token might be expired (check `expiresAt` in storage)
- Backend `extensionJWT.js` might have validation bug
- Check backend is deployed with latest code

### Issue 3: Profile Not Syncing After Verified Login
**Symptoms**: Token verifies OK but profile/data not syncing

**Debugging Steps**:
1. Check for errors in `[ProfileSync]` or `[DataSync]` logs
2. Verify token is correct: `TokenVerifier.getStoredToken()`
3. Check backend responds to profile endpoints:
   ```bash
   curl -X GET https://ats-resume-optimizer-359j.onrender.com/api/profile \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json"
   ```

**Solutions**:
- Backend profile endpoint might not be deployed
- Token might not have profile scope
- Network timeout (check timeout values in config)

## Files Modified

### Extension Files
1. `extension/src/popup/popup.js`
   - Fixed: API_BASE_URL → CONFIG.API_BASE_URL (4 places)

2. `extension/src/utils/TokenVerifier.js`
   - Enhanced: getStoredToken() with detailed logging
   - Enhanced: verifyToken() with request/response logging
   - Enhanced: fullVerification() with flow logging

3. `extension/src/utils/ProfileSyncManager.js`
   - Fixed: uploadProfile() undefined `config` variable

4. `extension/src/config/config.js`
   - Already correct, no changes needed

### Backend Files
1. `backend/src/routes/auth.js`
   - Enhanced: GET /api/auth/me with comprehensive logging
   - Logs every step: auth header, token parse, extension/supabase verification

## Verification Checklist

- [ ] Backend deployed (you'll handle this)
- [ ] Token persists in chrome.storage.sync OR chrome.storage.local
- [ ] GET /api/auth/me route returns 200 with user data
- [ ] TokenVerifier.fullVerification() returns authenticated: true
- [ ] ProfileSyncManager downloads profile successfully
- [ ] DataSyncManager downloads resumes, applications, answers
- [ ] All 27 autofill form fields populated from profile
- [ ] Auto-save listeners working (field changes sync to backend)
- [ ] UI shows "Connected" with user email instead of "Login"

## Next Steps (For You)

1. **Deploy Backend**: Push code to Render (just commit to main or trigger redeploy)
   - Need to restart the app on Render dashboard or redeploy

2. **Test Full Flow**:
   - Open extension, login via Job Orbit OAuth
   - Watch browser console for logs
   - Verify token persists
   - Verify profile syncs
   - Check autofill form populated

3. **Collect Logs**:
   - If not working, copy all console logs
   - Screenshot the chrome storage contents
   - Share backend logs from Render

4. **Debug by Logs**:
   - Use the "Good Sequence" vs "Bad Sequence" comparison above
   - Identify which step fails
   - Pinpoint root cause

## Key Improvements Made

1. ✅ **Token Visibility**: Added step-by-step logging to track token throughout lifecycle
2. ✅ **API Config**: Fixed undefined API_BASE_URL preventing API calls
3. ✅ **Error Messages**: Backend now logs exactly what validation fails
4. ✅ **Fallback Storage**: Uses both sync and local storage for reliability
5. ✅ **Complete Flow**: Can now trace from login → verification → sync

---

**Last Updated**: 2026-07-02
**Version**: 1.0.0 - Initial Debug Guide
