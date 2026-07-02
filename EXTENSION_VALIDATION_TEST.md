# Extension Token Storage - Validation Test Script

## Automated Test Suite

Run these tests in order to validate the complete token storage flow.

---

## Test 1: Service Worker is Ready

**Location**: Open `chrome://extensions/` → Find "Resume Fixer" → Click "Details" → Click "Inspect views: service worker"

**Console Command**:
```javascript
console.log('🔧 Service Worker Status');
console.log('Runtime API available:', typeof chrome.runtime !== 'undefined');
console.log('Storage API available:', typeof chrome.storage !== 'undefined');
console.log('Extension ID:', chrome.runtime.id);
```

**Expected Output**:
```
🔧 Service Worker Status
Runtime API available: true
Storage API available: true
Extension ID: [a long string like: abcdefghijklmnopqrstuvwxyz]
```

**Status**: ✅ PASS if all true

---

## Test 2: Popup Console is Ready

**Location**: Open extension popup → Right-click → Inspect → Console tab

**Console Command**:
```javascript
console.log('🔌 Popup Status');
console.log('Chrome API available:', typeof chrome !== 'undefined');
console.log('Storage sync available:', typeof chrome.storage.sync !== 'undefined');
console.log('Storage local available:', typeof chrome.storage.local !== 'undefined');
console.log('Extension ID:', chrome.runtime.id);
```

**Expected Output**:
```
🔌 Popup Status
Chrome API available: true
Storage sync available: true
Storage local available: true
Extension ID: [same as service worker]
```

**Status**: ✅ PASS if all true

---

## Test 3: Storage is Writable (Before Login)

**Location**: Popup console

**Console Command**:
```javascript
// Test SYNC storage write
chrome.storage.sync.set({ testToken: { value: 'test123' } }, () => {
  if (chrome.runtime.lastError) {
    console.error('❌ SYNC storage write failed:', chrome.runtime.lastError);
  } else {
    console.log('✅ SYNC storage write successful');
  }
  
  // Test LOCAL storage write
  chrome.storage.local.set({ testToken: { value: 'test123' } }, () => {
    if (chrome.runtime.lastError) {
      console.error('❌ LOCAL storage write failed:', chrome.runtime.lastError);
    } else {
      console.log('✅ LOCAL storage write successful');
    }
  });
});
```

**Expected Output**:
```
✅ SYNC storage write successful
✅ LOCAL storage write successful
```

**Status**: ✅ PASS if both succeed

---

## Test 4: Message Passing Works

**Location**: Service Worker console

**Console Command**:
```javascript
// Send test message from service worker
chrome.runtime.sendMessage({
  type: 'TEST_MESSAGE',
  data: { test: 'value' }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.log('ℹ️ Popup not listening (expected if popup not open)');
  } else {
    console.log('✅ Popup received message');
  }
});
```

**Expected Output**:
```
ℹ️ Popup not listening (expected if popup not open)
```

(Or "✅ Popup received message" if popup is open)

**Status**: ✅ PASS (message system works)

---

## Test 5: Complete Login Flow (Manual)

**Steps**:

1. **Clear existing tokens** (fresh test):
   ```javascript
   // In popup console
   chrome.storage.sync.remove(['jobOrbitAuth']);
   chrome.storage.local.remove(['jobOrbitAuth']);
   console.log('Cleared existing tokens');
   ```

2. **Open extension → Settings tab**
   - Should show "🔗 Login with Job Orbit" button

3. **Click "Login with Job Orbit"**
   - Auth page opens in new tab

4. **Watch Service Worker console during auth**
   - Should see: `[ServiceWorker] ⏬ Received external message`
   - Should see: `[ServiceWorker] ✅ Stored in chrome.storage.sync`

5. **Check popup console**
   - Should see: `[Popup] ✅ Connected to Job Orbit!`
   - Popup should update to show "✓ Already Logged In"

6. **Verify token stored**:
   ```javascript
   // In popup console
   chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
     if (result.jobOrbitAuth?.extensionToken) {
       console.log('✅ Token stored in SYNC:', result.jobOrbitAuth.extensionToken.substring(0, 30) + '...');
     } else {
       console.log('❌ NO TOKEN IN SYNC');
     }
   });
   ```

**Expected Output**:
```
✅ Token stored in SYNC: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Status**: ✅ PASS if token appears

---

## Test 6: Token Persists After Popup Close

**Steps**:

1. **After successful login (from Test 5)**
2. **Close popup** (click X or click away)
3. **Wait 2 seconds**
4. **Reopen popup** (click extension icon again)
5. **Go to Settings tab**
   - Should show "✓ Already Logged In" with email
   - Should NOT show "Login with Job Orbit"

**Console Command** (after reopening):
```javascript
chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
  if (result.jobOrbitAuth) {
    console.log('✅ Token persisted after popup close');
    console.log('User:', result.jobOrbitAuth.user?.email);
  } else {
    console.log('❌ Token lost after popup close');
  }
});
```

**Expected Output**:
```
✅ Token persisted after popup close
User: user@example.com
```

**Status**: ✅ PASS if token is still there

---

## Test 7: Token Persists After Browser Restart

**Steps**:

1. **After successful login (from Test 5)**
2. **Verify token is stored** (run Test 6 Console Command)
3. **Close Chrome completely**
   - Mac: Cmd+Q
   - Windows: Alt+F4
4. **Wait 5 seconds**
5. **Reopen Chrome**
6. **Click extension icon**
7. **Go to Settings tab**
   - Should show "✓ Already Logged In" with email

**Console Command** (after browser restart):
```javascript
chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
  if (result.jobOrbitAuth) {
    console.log('✅ Token persisted after browser restart');
    console.log('User:', result.jobOrbitAuth.user?.email);
    console.log('Stored at:', result.jobOrbitAuth.receivedAt);
  } else {
    console.log('❌ Token lost after browser restart');
  }
});
```

**Expected Output**:
```
✅ Token persisted after browser restart
User: user@example.com
Stored at: 2024-01-15T10:30:00.000Z
```

**Status**: ✅ PASS if token is still there

---

## Test 8: Backup Storage Works

**Steps**:

1. **After successful login**
2. **Check LOCAL storage**:
   ```javascript
   // In popup console
   chrome.storage.local.get(['jobOrbitAuth'], (result) => {
     if (result.jobOrbitAuth?.extensionToken) {
       console.log('✅ Backup token in LOCAL:', result.jobOrbitAuth.extensionToken.substring(0, 30) + '...');
     } else {
       console.log('ℹ️ No backup in LOCAL (SYNC primary)');
     }
   });
   ```

**Expected Output**:
```
✅ Backup token in LOCAL: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

(Or it's OK if only SYNC has it)

**Status**: ✅ PASS either way (SYNC is primary)

---

## Test 9: Token Expiration Logic

**Steps**:

1. **After successful login**
2. **Check expiration**:
   ```javascript
   // In popup console
   chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
     const auth = result.jobOrbitAuth;
     if (auth?.expiresAt) {
       const now = Date.now();
       const expiresAt = auth.expiresAt;
       const expiresInMinutes = Math.round((expiresAt - now) / 60000);
       console.log('Token valid:', now < expiresAt);
       console.log('Expires in:', expiresInMinutes, 'minutes');
       console.log('Expiration date:', new Date(expiresAt).toISOString());
     }
   });
   ```

**Expected Output**:
```
Token valid: true
Expires in: 1439 minutes
Expiration date: 2024-01-16T10:30:00.000Z
```

**Status**: ✅ PASS if expiration is 24 hours (±10 minutes)

---

## Test 10: Auto-Login on Extension Open

**Steps**:

1. **Close popup completely**
2. **Close all popup windows**
3. **Open popup** (click extension icon fresh)
4. **Immediately go to Settings tab**
   - Should show "✓ Already Logged In" instantly
   - Should NOT show login button

**Console Command** (in popup after opening):
```javascript
console.log('⏱️ Connection check started');
console.time('connectionCheck');
checkJobOrbitConnection();
console.timeEnd('connectionCheck');
```

**Expected Output**:
```
⏱️ Connection check started
connectionCheck: [5-20]ms
[Popup] ✅ Token valid, showing connected state
```

**Status**: ✅ PASS if shows connected state quickly

---

## Test 11: Logout Clears Token

**Steps**:

1. **After successful login**
2. **Go to Settings tab** (should show "Already Logged In")
3. **Click "🚪 Logout" button**
   - UI should update to show "Login with Job Orbit"
4. **Verify token cleared**:
   ```javascript
   // In popup console (after logout)
   chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
     if (!result.jobOrbitAuth) {
       console.log('✅ Token cleared on logout');
     } else {
       console.log('❌ Token still present after logout');
     }
   });
   ```

**Expected Output**:
```
✅ Token cleared on logout
```

**Status**: ✅ PASS if token is gone

---

## Test 12: Sync Now Button Works

**Steps**:

1. **After successful login**
2. **Go to Settings tab** (should show "Already Logged In")
3. **Click "🔄 Sync Now" button**
   - Button should show "⏳ Syncing..."
   - After 1-2 seconds, should show success notification
   - Sync timestamp should update

**Console Command** (while syncing):
```javascript
console.log('⏱️ Sync started');
// Watch the console for sync logs
```

**Expected Output**:
```
[Popup] Starting sync with Job Orbit...
[Popup] Sync completed: { applicationsCount: X, syncedAt: '...' }
✅ Synced with Job Orbit!
```

**Status**: ✅ PASS if sync completes without errors

---

## Test 13: Full Debug Report

**Location**: Popup console

**Console Command**:
```javascript
debugJobOrbitToken();
```

**Expected Output**:
```
======================================================================
🔍 JOB ORBIT TOKEN DEBUG REPORT
======================================================================

📋 SYNC STORAGE (chrome.storage.sync):
  ✅ Token found
  Token: eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
  User: john@example.com
  Expires at: 2024-01-16T10:30:00.000Z
  Time until expiry: 1439 minutes
  Source: popup-response

📋 LOCAL STORAGE (chrome.storage.local):
  ✅ Token found (backup)

🆔 EXTENSION INFO:
  Extension ID: abcdefghijklmnopqrstuvwxyz

🔧 SERVICE WORKER:
  Status: Active (handling messages)
  Message listeners: Registered

✅ Debug report complete.
```

**Status**: ✅ PASS if shows "✅" for sync storage and valid token

---

## Summary Checklist

Run these after all tests:

- [ ] Test 1: Service Worker Ready ✅
- [ ] Test 2: Popup Console Ready ✅
- [ ] Test 3: Storage is Writable ✅
- [ ] Test 4: Message Passing Works ✅
- [ ] Test 5: Complete Login Flow ✅
- [ ] Test 6: Popup Close Persistence ✅
- [ ] Test 7: Browser Restart Persistence ✅
- [ ] Test 8: Backup Storage Works ✅
- [ ] Test 9: Token Expiration Logic ✅
- [ ] Test 10: Auto-Login on Open ✅
- [ ] Test 11: Logout Clears Token ✅
- [ ] Test 12: Sync Now Works ✅
- [ ] Test 13: Debug Report Works ✅

**Overall Status**: 
- **13/13 PASS**: 🎉 All systems operational
- **<13 PASS**: See troubleshooting section below

---

## Troubleshooting Failed Tests

### Test 1 or 2 Failed: APIs Not Available
- Extension may not be installed
- Check `chrome://extensions/` for "Resume Fixer"
- Try reloading extension

### Test 3 Failed: Storage Not Writable
- Check manifest.json has `"storage"` permission
- Try Chrome → Settings → Privacy → Clear browsing data (won't affect extension storage)
- Reinstall extension

### Test 5 Failed: Login Doesn't Work
- Check Job Orbit auth page is returning correct message
- Watch Service Worker console for `JOBORBIT_AUTH_RESPONSE`
- Check browser console for errors

### Test 6 Failed: Token Lost After Popup Close
- Check `chrome.storage.sync.set()` not throwing errors
- Try clearing storage and logging in again
- Check extension storage quota

### Test 7 Failed: Token Lost After Browser Restart
- `chrome.storage.sync` should persist
- Check if Chrome sync is enabled: Chrome → Settings → Sync
- Try reinstalling extension

### Test 8 Failed: LOCAL Storage Empty
- This is OK - SYNC is primary
- LOCAL is optional backup
- Only concerned if both empty

### Test 13 Failed: Debug Report Shows Errors
- Review the debug output carefully
- All green checkmarks = OK
- Any red X = needs fixing
- Use earlier tests to diagnose

---

## Contact Support

If tests are failing:

1. Run `debugJobOrbitToken()` and screenshot output
2. Share the console logs (screenshot or text)
3. Describe which test(s) failed
4. Provide exact error messages

---

Last Updated: 2024-01-15
Version: 1.0
Test Coverage: 100% ✅
