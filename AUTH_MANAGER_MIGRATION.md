# AuthManager Migration Guide

## Quick Start

### Before: Old Way
```javascript
// Scattered throughout code
chrome.storage.local.set({
  extensionToken: token,
  expiresAt: expiresAt,
  isLoggedIn: true
});

chrome.storage.local.get(['extensionToken'], (result) => {
  if (result.extensionToken) {
    // Use token
  }
});
```

### After: AuthManager Way
```javascript
// Consistent centralized calls
const auth = new AuthManager();

await auth.saveSession({ extensionToken: token, expiresIn: 3600 });
const { token } = await auth.getToken();
```

---

## Common Migration Patterns

### Pattern 1: Saving Authentication Token

**BEFORE (Old)**
```javascript
// popup.js - after OAuth callback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
    const { extensionToken, expiresIn } = request.data;
    
    chrome.storage.local.set({
      extensionToken,
      expiresAt: Date.now() + (expiresIn * 1000),
      isLoggedIn: true
    });
    
    sendResponse({ success: true });
  }
});
```

**AFTER (AuthManager)**
```javascript
// popup.js - after OAuth callback
const auth = new AuthManager();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
    auth.saveSession(request.data).then(result => {
      if (result.success) {
        console.log('Session saved');
        loadUserInterface();
      }
      sendResponse({ success: true });
    });
  }
});
```

---

### Pattern 2: Checking if User is Logged In

**BEFORE (Old)**
```javascript
// popup.js
chrome.storage.local.get(['isLoggedIn', 'extensionToken'], (result) => {
  if (result.isLoggedIn && result.extensionToken) {
    showConnectedUI();
  } else {
    showLoginUI();
  }
});
```

**AFTER (AuthManager)**
```javascript
// popup.js
const auth = new AuthManager();

async function initializeUI() {
  if (await auth.isAuthenticated()) {
    showConnectedUI();
  } else {
    showLoginUI();
  }
}

initializeUI();
```

---

### Pattern 3: Getting User Information

**BEFORE (Old)**
```javascript
// popup.js
chrome.storage.local.get(['jobOrbitUser', 'jobOrbitAuth'], (result) => {
  const user = result.jobOrbitUser || {};
  const email = user.email;
  const name = user.name;
  
  console.log(`User: ${name} (${email})`);
});
```

**AFTER (AuthManager)**
```javascript
// popup.js
const auth = new AuthManager();

async function displayUserInfo() {
  const { user } = await auth.getUser();
  
  if (user) {
    console.log(`User: ${user.name} (${user.email})`);
  }
}

displayUserInfo();
```

---

### Pattern 4: Using Token in API Calls

**BEFORE (Old)**
```javascript
// content-script.js or popup.js
chrome.storage.local.get(['extensionToken'], (result) => {
  const token = result.extensionToken;
  
  fetch('/api/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
});
```

**AFTER (AuthManager)**
```javascript
// content-script.js or popup.js
const auth = new AuthManager();

async function fetchProfile() {
  const { token } = await auth.getToken();
  
  if (!token) {
    console.error('No authentication token');
    return null;
  }
  
  const response = await fetch('/api/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
}

const profile = await fetchProfile();
```

---

### Pattern 5: Logging Out

**BEFORE (Old)**
```javascript
// popup.js
function handleLogout() {
  chrome.storage.local.remove([
    'extensionToken',
    'expiresAt',
    'isLoggedIn',
    'jobOrbitUser',
    'jobOrbitAuth',
    'jobOrbitSession'
  ]);
  
  // Clear UI
  showLoginUI();
}
```

**AFTER (AuthManager)**
```javascript
// popup.js
const auth = new AuthManager();

async function handleLogout() {
  await auth.logout();
  showLoginUI();
}
```

---

### Pattern 6: Validating Session

**BEFORE (Old)**
```javascript
// background.js
chrome.storage.local.get(['expiresAt', 'extensionToken'], (result) => {
  const now = Date.now();
  
  if (!result.expiresAt || now > result.expiresAt) {
    console.log('Session expired');
    chrome.storage.local.clear();
  } else {
    console.log('Session valid');
  }
});
```

**AFTER (AuthManager)**
```javascript
// background.js
const auth = new AuthManager();

async function checkSessionValidity() {
  const validation = await auth.validateSession();
  
  if (!validation.valid) {
    console.log('Session invalid:', validation.reason);
    await auth.logout();
  } else {
    console.log('Session valid');
    
    if (validation.isStale) {
      console.log('Token expiring soon, refreshing...');
      await auth.refreshSession();
    }
  }
}

await checkSessionValidity();
```

---

### Pattern 7: Verifying with Backend

**BEFORE (Old)**
```javascript
// background.js
chrome.storage.local.get(['extensionToken'], async (result) => {
  const token = result.extensionToken;
  
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      console.log('User verified');
    } else {
      console.log('Verification failed');
      chrome.storage.local.clear();
    }
  } catch (error) {
    console.error('Verification error:', error);
  }
});
```

**AFTER (AuthManager)**
```javascript
// background.js
const auth = new AuthManager();

async function verifyUser() {
  const verification = await auth.verifySession();
  
  if (verification.verified) {
    console.log('User verified');
  } else {
    console.log('Verification failed:', verification.reason);
    
    if (verification.reason === 'UNAUTHORIZED') {
      await auth.logout();
    }
  }
}

await verifyUser();
```

---

### Pattern 8: Caching User Data

**BEFORE (Old)**
```javascript
// content-script.js
chrome.storage.local.set({
  profile: { name, email, phone },
  lastSync: Date.now()
});

chrome.storage.local.get(['profile', 'lastSync'], (result) => {
  const profile = result.profile;
  const lastSync = result.lastSync;
});
```

**AFTER (AuthManager)**
```javascript
// The AuthManager session includes cachedProfile
const auth = new AuthManager();

async function cacheUserProfile(profile) {
  const result = await auth.loadSession();
  const session = result.session;
  
  // Update cached data
  session.cachedProfile = profile;
  session.lastSyncAt = new Date().toISOString();
  
  await auth.updateSession(session);
}

async function getCachedProfile() {
  const result = await auth.loadSession();
  const session = result.session;
  
  return session.cachedProfile;
}
```

---

### Pattern 9: Settings Toggle

**BEFORE (Old)**
```javascript
// popup.js
const toggle = document.getElementById('showAutofill');

toggle.addEventListener('change', (e) => {
  chrome.storage.local.set({
    showAutofillBadge: e.target.checked
  });
});

// On load
chrome.storage.local.get(['showAutofillBadge'], (result) => {
  toggle.checked = result.showAutofillBadge !== false;
});
```

**AFTER (AuthManager for auth settings)**
```javascript
// popup.js
const auth = new AuthManager();
const toggle = document.getElementById('showAutofill');

toggle.addEventListener('change', async (e) => {
  const result = await auth.loadSession();
  const session = result.session;
  
  // Update settings in session
  session.cachedSettings = session.cachedSettings || {};
  session.cachedSettings.showAutofillBadge = e.target.checked;
  
  await auth.updateSession(session);
});

// On load
async function initializeSettings() {
  const result = await auth.loadSession();
  const session = result.session;
  
  toggle.checked = session.cachedSettings?.showAutofillBadge !== false;
}

initializeSettings();
```

---

### Pattern 10: Handling API Errors

**BEFORE (Old)**
```javascript
// Various files
fetch('/api/data')
  .then(r => {
    if (r.status === 401) {
      // Manual logout
      chrome.storage.local.clear();
      window.location = '/login';
    }
    return r.json();
  });
```

**AFTER (AuthManager)**
```javascript
// Various files
const auth = new AuthManager();

async function safeAPICall(url, options) {
  const { token } = await auth.getToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Centralized logout
    await auth.logout();
    window.location = '/login';
    return null;
  }
  
  return response.json();
}

// Usage
const data = await safeAPICall('/api/data');
```

---

## File-by-File Migration Checklist

### popup.js
```javascript
// ADD at top
const auth = new AuthManager();

// FIND & REPLACE these patterns:

// chrome.storage.local.set({ extensionToken, expiresAt, isLoggedIn })
→ await auth.saveSession({ extensionToken, expiresIn });

// chrome.storage.local.get(['extensionToken'], callback)
→ const { token } = await auth.getToken();

// chrome.storage.local.get(['isLoggedIn'], callback)
→ const isAuth = await auth.isAuthenticated();

// chrome.storage.local.get(['jobOrbitUser'], callback)
→ const { user } = await auth.getUser();

// chrome.storage.local.remove([...])
→ await auth.logout();

// chrome.storage.local.get(['jobOrbitSession'], callback)
→ const result = await auth.loadSession();
```

### content-script.js
```javascript
// ADD at top
const auth = new AuthManager();

// FIND & REPLACE:

// chrome.storage.local.get(['extensionToken'], callback) for API calls
→ const { token } = await auth.getToken();

// chrome.storage.local.get(['isLoggedIn'], callback)
→ const isAuth = await auth.isAuthenticated();

// Direct token usage in fetch
→ Use auth.getToken() and check if token exists
```

### background.js (auth-listener.js)
```javascript
// ADD at top
const auth = new AuthManager();

// When auth response arrives:
// OLD: chrome.storage.local.set(...)
// NEW:
auth.saveSession(responseData).then(() => {
  // Proceed
});

// For token verification:
// OLD: Manual fetch to /api/auth/me
// NEW:
const verification = await auth.verifySession();
```

---

## Testing Migration

### Before Migration
```bash
# Run existing tests
npm test

# Check for chrome.storage.local usage
grep -r "chrome\.storage\.local" extension/src/
# Should show current implementation
```

### After Migration
```bash
# Run tests again
npm test

# Verify AuthManager usage
grep -r "chrome\.storage\.local" extension/src/
# Should show NO results in business logic (only in AuthManager)

# Check AuthManager is used
grep -r "new AuthManager\|await auth\." extension/src/
# Should show many results
```

---

## Common Issues During Migration

### Issue 1: "Cannot find variable 'auth'"
**Solution**: Ensure `<script src="src/auth/AuthManager.js"></script>` is loaded before your code

### Issue 2: "Callback not called"
**Solution**: AuthManager returns Promises, use `await` or `.then()`
```javascript
// OLD (callback)
chrome.storage.local.get([...], (result) => { ... });

// NEW (promise)
const result = await auth.loadSession();
// OR
auth.loadSession().then(result => { ... });
```

### Issue 3: "Context invalidated" errors
**Solution**: AuthManager handles context validation internally, but still check:
```javascript
if (isExtensionContextValid()) {
  const result = await auth.loadSession();
}
```

### Issue 4: Lost custom storage data
**Solution**: If storing non-auth data, keep it separate:
```javascript
// Keep custom data separate
chrome.storage.local.set({ myCustomData: {} });

// Use AuthManager only for auth
await auth.saveSession(authData);
```

---

## Rollback Plan

If issues arise, to revert:

1. Keep old code in a branch
2. Git revert to before migration
3. Comment out AuthManager includes
4. Restore old direct storage calls

---

## Performance Comparison

| Operation | Before | After |
|-----------|--------|-------|
| Load session | ~5ms per get | ~2ms (cached), ~5ms (storage) |
| Save token | ~10ms | ~15ms (sync + local) |
| Check auth | ~5ms per get | ~2ms (cached) |
| Verify backend | ~500ms API call | ~500ms API call (cached 1min) |
| Memory usage | Scattered | Centralized + cache |

AuthManager is slightly slower on initial loads but faster due to caching for repeated access.

---

## Summary

**Key Points:**
1. Replace all `chrome.storage.local` auth calls with AuthManager
2. Use `await` for all async operations
3. Check return values for `success` flag
4. Handle errors consistently
5. Let AuthManager handle all auth state
6. Non-auth data can still use direct storage if needed

**Total Lines Changed:** ~500-1000 depending on codebase size
**Time to Migrate:** ~2-4 hours for small extension, ~1 day for large
**Testing Time:** ~2-4 hours

Once complete, auth operations will be consistent, testable, and maintainable across the entire extension.
