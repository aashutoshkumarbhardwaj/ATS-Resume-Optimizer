# Extension Session Token Debugging Guide

## Overview

This guide helps verify that the extension is receiving and storing the Job Orbit session token correctly. Follow these steps to diagnose any issues.

---

## Quick Test: 5-Minute Verification

### Step 1: Enable Console Logging

1. Open Chrome Extensions: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Find "Resume Fixer" extension
4. Click "Details"
5. Scroll down and click "Inspect views: service worker"
   - This opens the Service Worker console
6. Also open the popup console: Right-click popup → Inspect → Console tab

### Step 2: Complete Login Flow

1. Click extension icon → Settings tab
2. Click "🔗 Login with Job Orbit"
3. Complete authentication on Job Orbit auth page
4. **Watch the console logs** - should see messages like:
   ```
   [ServiceWorker] ⏬ Received external message: JOBORBIT_AUTH_RESPONSE
   [ServiceWorker] ✅ Processing Job Orbit auth response
   [ServiceWorker] 💾 Storing auth data: ...
   [ServiceWorker] ✅ Stored in chrome.storage.sync
   ```

### Step 3: Verify Token Storage

In the **Service Worker console**, run:
```javascript
chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
  console.log('Stored token:', result.jobOrbitAuth);
});
```

Expected output:
```javascript
{
  extensionToken: "eyJhbGc...",
  expiresAt: 1234567890000,
  user: { id: "...", email: "user@example.com" },
  receivedAt: "2024-01-15T10:30:00.000Z",
  source: "popup-response"
}
```

### Step 4: Close and Reopen Extension

1. Close the extension popup
2. Click extension icon again
3. Go to Settings tab
4. Should show **"✓ Already Logged In"** with user email
5. **NOT** "Login with Job Orbit" button

---

## Detailed Debugging Steps

### Check 1: Service Worker Receiving Message

**Console Location**: Service Worker (chrome://extensions → Details → Inspect views)

**Command**:
```javascript
// This will show when the service worker receives auth messages
console.log('Service Worker message listeners are active');
```

**Expected Behavior**:
- When you complete login, should see logs like:
  ```
  [ServiceWorker] ⏬ Received external message: JOBORBIT_AUTH_RESPONSE
  [ServiceWorker] From URL: https://job-orbit-flax.vercel.app/extension-auth
  [ServiceWorker] Request data: { type: 'JOBORBIT_AUTH_RESPONSE', state: '...', data: { extensionToken: '...', ... } }
  ```

**If NOT seeing this**:
- ❌ Auth page is not sending message to extension
- ❌ Extension ID might be wrong
- ❌ Message type might have typo
- ✅ Check Job Orbit backend auth page implementation

---

### Check 2: Sync Storage (Primary)

**Console Location**: Popup console (Ctrl+Shift+J while popup open)

**Command**:
```javascript
chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
  if (result.jobOrbitAuth) {
    console.log('✅ Token in SYNC storage:', result.jobOrbitAuth.extensionToken.substring(0, 30) + '...');
  } else {
    console.log('❌ NO token in SYNC storage');
  }
});
```

**Expected**:
```
✅ Token in SYNC storage: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...
```

**If empty**:
- ❌ Service worker didn't store token
- ❌ Token was cleared
- ✅ Check step 1

---

### Check 3: Local Storage (Backup)

**Console Location**: Popup console

**Command**:
```javascript
chrome.storage.local.get(['jobOrbitAuth'], (result) => {
  if (result.jobOrbitAuth) {
    console.log('✅ Token in LOCAL storage:', result.jobOrbitAuth.extensionToken.substring(0, 30) + '...');
  } else {
    console.log('ℹ️ No backup token in LOCAL storage');
  }
});
```

**Expected**:
```
✅ Token in LOCAL storage: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...
```

**Note**: It's okay if LOCAL is empty - SYNC is primary

---

### Check 4: Token Expiration

**Console Location**: Popup console

**Command**:
```javascript
chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
  const auth = result.jobOrbitAuth;
  if (auth && auth.expiresAt) {
    const now = Date.now();
    const expiresAt = auth.expiresAt;
    const expiresInMinutes = Math.round((expiresAt - now) / 60000);
    console.log('Token expires in', expiresInMinutes, 'minutes');
    console.log('Expiration date:', new Date(expiresAt).toISOString());
  }
});
```

**Expected**:
```
Token expires in 1439 minutes
Expiration date: 2024-01-16T10:30:00.000Z
```

**If expired or missing**:
- ❌ Token creation has wrong timestamp
- ❌ Token not being stored with expiration
- ✅ Check Job Orbit auth page response format

---

### Check 5: User Information

**Console Location**: Popup console

**Command**:
```javascript
chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
  const auth = result.jobOrbitAuth;
  if (auth && auth.user) {
    console.log('User ID:', auth.user.id);
    console.log('User email:', auth.user.email);
    console.log('User name:', auth.user.name);
  } else {
    console.log('❌ No user info stored');
  }
});
```

**Expected**:
```
User ID: user_123
User email: john@example.com
User name: John Doe
```

---

### Check 6: UI Correctly Shows Connection Status

**Console Location**: Popup console

**Command**:
```javascript
// Manually trigger connection check
checkJobOrbitConnection();
```

**Check visually**:
- Should see "✓ Already Logged In" 
- Should show user email
- Should show "🔄 Sync Now" and "🚪 Logout" buttons
- Should NOT show "🔗 Login with Job Orbit" button

**If showing login button instead**:
- ❌ Token not stored
- ❌ Token expired
- ❌ UI not updating
- ✅ Check earlier debugging steps

---

### Check 7: Persistence Across Browser Restart

**Test procedure**:
1. Complete login (verify token stored - Check 2)
2. Close Chrome completely (`Cmd+Q` on Mac)
3. Reopen Chrome
4. Open extension popup
5. Go to Settings tab

**Expected**:
- Should show "✓ Already Logged In" immediately
- Should NOT show "Login with Job Orbit"

**If showing login button**:
- ❌ `chrome.storage.sync` not persisting
- ❌ Chrome storage permissions missing
- ✅ Check manifest.json permissions

---

### Check 8: Manifest Permissions

**File**: `extension/manifest.json`

**Verify these permissions exist**:
```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage",  // ← REQUIRED
    "webRequest",
    "tabs",
    "identity"
  ]
}
```

**Command to verify**:
```javascript
// In Service Worker console
console.log('Storage API available:', typeof chrome.storage !== 'undefined');
```

Expected: `true`

---

## Automated Debug Report

**Console Location**: Popup console

**Command**:
```javascript
debugJobOrbitToken();
```

This runs a comprehensive debug report showing:
- Sync storage status
- Local storage status
- Extension ID
- Service worker status
- All critical info in one place

**Example output**:
```
======================================================================
🔍 JOB ORBIT TOKEN DEBUG REPORT
======================================================================

📋 SYNC STORAGE (chrome.storage.sync):
  ✅ Token found
  Token: eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
  User: john@example.com
  Received at: 2024-01-15T10:30:00.000Z
  Expires at: 2024-01-16T10:30:00.000Z
  Time until expiry: 1439 minutes
  Source: popup-response

📋 LOCAL STORAGE (chrome.storage.local):
  ✅ Token found (backup)
  Token: eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
  User: john@example.com
  Received at: 2024-01-15T10:30:00.000Z

🆔 EXTENSION INFO:
  Extension ID: abcdefghijklmnopqrstuvwxyz

🔧 SERVICE WORKER:
  Status: Active (handling messages)
  Message listeners: Registered
  External messages: Enabled

======================================================================
✅ Debug report complete. Check console logs above.
```

---

## Common Issues & Fixes

### Issue 1: "Login with Job Orbit" still showing after successful login

**Cause**: Token not being stored
**Fix**:
1. Check Service Worker console for errors (Check 1)
2. Verify Job Orbit auth page is sending correct message
3. Run: `debugJobOrbitToken()` to identify which storage failed

### Issue 2: Token not persisting after browser restart

**Cause**: Using LOCAL storage instead of SYNC
**Fix**:
1. Verify both storages have token (Check 2 & 3)
2. SYNC storage should be primary
3. Clear LOCAL storage: `chrome.storage.local.clear()`

### Issue 3: "Token expired" message appears too quickly

**Cause**: Incorrect expiration timestamp calculation
**Fix**:
1. Check token expiration (Check 4)
2. Verify `expiresIn` is in SECONDS (not milliseconds)
3. Calculation should be: `Date.now() + (expiresIn * 1000)`

### Issue 4: User email not showing in UI

**Cause**: User info not sent or stored
**Fix**:
1. Check user info (Check 5)
2. Job Orbit auth page must send `user` object with at least `email`
3. Verify response format in Service Worker console

### Issue 5: Sync button not working

**Cause**: Token not available or permission issues
**Fix**:
1. Check token exists (Check 2)
2. Check extension permissions (Check 8)
3. Check backend `/api/extension-auth/sync` endpoint

---

## Testing Checklist

Use this to verify everything is working:

- [ ] Service Worker receives auth message (Check 1)
- [ ] Token stored in SYNC storage (Check 2)
- [ ] Token also in LOCAL storage as backup (Check 3)
- [ ] Token has correct expiration (Check 4)
- [ ] User info is stored (Check 5)
- [ ] UI shows "Already Logged In" (Check 6)
- [ ] Token persists after browser restart (Check 7)
- [ ] Manifest has storage permission (Check 8)
- [ ] `debugJobOrbitToken()` shows all green (Automated Report)
- [ ] Sync Now button works (optional)
- [ ] Logout button clears token (optional)

---

## Getting Help

If debugging doesn't reveal the issue:

1. **Run debug report**: `debugJobOrbitToken()`
2. **Screenshot the output**
3. **Check these logs**:
   - Service Worker console (extension messages)
   - Popup console (UI updates)
   - Network tab (API calls)
4. **Share**:
   - Screenshot of debug report
   - Error messages from console
   - Steps to reproduce

---

## Advanced: Manual Token Injection

**For testing UI without auth page**:

```javascript
// Inject fake token for testing
const fakeToken = {
  extensionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiZXh0ZW5zaW9uIn0.test',
  expiresAt: Date.now() + (24 * 60 * 60 * 1000),
  user: {
    id: 'test_user_123',
    email: 'test@example.com',
    name: 'Test User'
  },
  receivedAt: new Date().toISOString(),
  source: 'manual-injection'
};

chrome.storage.sync.set({ jobOrbitAuth: fakeToken }, () => {
  console.log('Fake token injected for testing');
  window.location.reload();
});
```

**Usage**: Run in popup console, then reload popup

---

## Performance Notes

- **Sync storage**: Syncs across all Chrome profiles (slower but persistent)
- **Local storage**: Local to device only (faster but not synced)
- **Both used**: SYNC for persistence, LOCAL as backup
- **Token lifetime**: 24 hours (configurable in backend)
- **Refresh trigger**: Token within 1 hour of expiry or on manual sync

---

Last Updated: 2024-01-15
Version: 1.0
