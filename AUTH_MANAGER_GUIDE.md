# AuthManager - Centralized Authentication Service

## Overview

AuthManager is a single, centralized authentication service that handles all auth operations across the extension. It eliminates scattered `chrome.storage.local` calls throughout the codebase and provides a unified API for:

- Session management
- Token storage and validation
- User authentication state
- Token refresh
- Logout operations

## Why AuthManager?

### Before (Problematic)
```javascript
// Scattered throughout codebase
chrome.storage.local.set({ extensionToken: token, expiresAt: expiresAt, isLoggedIn: true });
chrome.storage.local.get(['profile'], (result) => { ... });
if (result.isLoggedIn) { /* do something */ }
// Inconsistent patterns, hard to maintain, no centralized logic
```

### After (Clean)
```javascript
// Consistent, centralized, testable
const auth = new AuthManager();
await auth.saveSession(tokenData);
const isAuth = await auth.isAuthenticated();
await auth.logout();
```

## Installation

### 1. Add to manifest.json

```json
{
  "permissions": [
    "storage"
  ]
}
```

### 2. Include in popup.html

```html
<script src="src/auth/AuthManager.js"></script>
```

### 3. Include in content-script.js

```javascript
// At the top of content-script.js
const auth = new AuthManager();
```

### 4. Include in background script

```javascript
// At the top of background script
const auth = new AuthManager();
```

## API Reference

### Core Methods

#### `saveSession(authData)`
Save user session after successful OAuth

**Parameters:**
```javascript
{
  extensionToken: "token_string",  // Required
  expiresIn: 3600,                 // Optional, seconds
  user: { id: "123", email: "..." }, // Optional
  profile: {},                       // Optional
  resumes: [],                       // Optional
  settings: {}                       // Optional
}
```

**Returns:** `Promise<{success: boolean, stored: string}>`

**Usage:**
```javascript
const result = await auth.saveSession({
  extensionToken: tokenFromBackend,
  expiresIn: 3600,
  user: { id: userId, email: userEmail }
});

if (result.success) {
  console.log('Session saved to', result.stored);
}
```

---

#### `loadSession()`
Load session from storage (with caching)

**Returns:** `Promise<{success: boolean, session: Object|null, source: string}>`

**Source values:** `'cache'`, `'sync'`, `'local'`, `'error'`, `'none'`

**Usage:**
```javascript
const result = await auth.loadSession();

if (result.success) {
  console.log('User:', result.session.user.email);
  console.log('Loaded from:', result.source);
}
```

---

#### `validateSession()`
Check if session is valid (not expired)

**Returns:** `Promise<{valid: boolean, session: Object|null, reason: string, timeToExpiry: number, isStale: boolean}>`

**Reason values:** `'VALID'`, `'EXPIRED'`, `'NO_SESSION'`, `'ERROR'`

**Usage:**
```javascript
const validation = await auth.validateSession();

if (validation.valid) {
  if (validation.isStale) {
    // Token expiring soon - consider refresh
    await auth.refreshSession();
  }
}
```

---

#### `verifySession()`
Verify session with backend

**Returns:** `Promise<{verified: boolean, user: Object|null, reason: string, expiresIn: number}>`

**Reason values:** `'VERIFIED'`, 'UNAUTHORIZED'`, `'NOT_AUTHENTICATED'`, `'NO_SESSION'`, `'OFFLINE_VALID'`, etc.

**Usage:**
```javascript
const verification = await auth.verifySession();

if (verification.verified) {
  console.log('Backend confirmed authentication');
} else if (verification.reason === 'OFFLINE_VALID') {
  console.log('No network, but session still valid locally');
}
```

---

#### `refreshSession()`
Refresh token via backend

**Returns:** `Promise<{refreshed: boolean, session: Object|null, reason: string}>`

**Usage:**
```javascript
const refresh = await auth.refreshSession();

if (refresh.refreshed) {
  console.log('Token refreshed successfully');
  // Resend any pending requests
}
```

---

#### `isAuthenticated()`
Quick check if user is logged in

**Returns:** `Promise<boolean>`

**Usage:**
```javascript
if (await auth.isAuthenticated()) {
  // Show authenticated UI
} else {
  // Show login prompt
}
```

---

#### `getUser()`
Get current user information

**Returns:** `Promise<{user: Object|null, success: boolean}>`

**Usage:**
```javascript
const { user } = await auth.getUser();

if (user) {
  console.log('Welcome,', user.name);
}
```

---

#### `getToken()`
Get current authentication token

**Returns:** `Promise<{token: string|null, expiresAt: number|null, success: boolean}>`

**Usage:**
```javascript
const { token, expiresAt } = await auth.getToken();

// Use token for API calls
fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

#### `updateSession(session)`
Update existing session data

**Parameters:** Complete session object with updates

**Returns:** `Promise<{success: boolean}>`

**Usage:**
```javascript
const result = await auth.loadSession();
const session = result.session;

// Update cached data
session.cachedResumes = [...];
session.lastSyncAt = new Date().toISOString();

await auth.updateSession(session);
```

---

#### `logout()`
Logout user and clear all session data

**Returns:** `Promise<{success: boolean}>`

**Usage:**
```javascript
const result = await auth.logout();

if (result.success) {
  // Redirect to login
  window.location.href = '/login';
}
```

---

#### `getSessionSummary()`
Get formatted session info for UI/debugging

**Returns:** `Promise<Object>`

**Usage:**
```javascript
const summary = await auth.getSessionSummary();

console.log('User:', summary.user.email);
console.log('Expires in:', summary.token.expiresIn);
console.log('Is stale:', summary.token.isStale);
```

---

#### `debugAuthState()`
Log complete auth state to console (development only)

**Usage:**
```javascript
if (DEBUG_MODE) {
  await auth.debugAuthState();
}
```

## Storage Structure

AuthManager manages these storage keys:

```javascript
{
  jobOrbitSession: { /* full session object */ },
  jobOrbitAuth: { /* token + user info */ },
  extensionToken: "token_string",
  expiresAt: 1234567890,
  isLoggedIn: true,
  jobOrbitUser: { /* user object */ }
}
```

**Storage Strategy:**
- Primary: `chrome.storage.sync` (cross-device sync)
- Backup: `chrome.storage.local` (fallback if sync fails)
- Cache: In-memory for 5 seconds (performance)

## Usage Patterns

### Pattern 1: Check Authentication on Startup

```javascript
const auth = new AuthManager();

async function initializeApp() {
  if (await auth.isAuthenticated()) {
    const { user } = await auth.getUser();
    loadUserData(user);
  } else {
    showLoginScreen();
  }
}

initializeApp();
```

### Pattern 2: Make Authenticated API Calls

```javascript
const auth = new AuthManager();

async function fetchUserProfile() {
  const { token } = await auth.getToken();

  if (!token) {
    console.error('No authentication token');
    return null;
  }

  const response = await fetch('/api/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.json();
}
```

### Pattern 3: Auto-Refresh Stale Tokens

```javascript
const auth = new AuthManager();

async function ensureValidSession() {
  const validation = await auth.validateSession();

  if (!validation.valid) {
    console.log('Session invalid:', validation.reason);
    await auth.logout();
    return false;
  }

  if (validation.isStale) {
    console.log('Token expiring soon, refreshing...');
    const refresh = await auth.refreshSession();
    if (!refresh.refreshed) {
      await auth.logout();
      return false;
    }
  }

  return true;
}

// Use before making important API calls
if (await ensureValidSession()) {
  // Safe to proceed
}
```

### Pattern 4: Handle OAuth Response

```javascript
// In popup.js when OAuth callback arrives
const auth = new AuthManager();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
    const { extensionToken, expiresIn, user } = request.data;

    auth.saveSession({
      extensionToken,
      expiresIn,
      user
    }).then(() => {
      // Reload UI to show authenticated state
      loadUserInterface();
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Failed to save session:', error);
      sendResponse({ success: false, error: error.message });
    });
  }
});
```

### Pattern 5: Logout

```javascript
// In UI button click handler
async function handleLogoutClick() {
  const result = await auth.logout();

  if (result.success) {
    // Clear UI
    resetUserInterface();
    showLoginScreen();
  } else {
    console.error('Logout failed:', result.error);
  }
}
```

## Migration Checklist

### Popup.js
- [ ] Replace all `chrome.storage.local.set(...)` with `auth.saveSession(...)`
- [ ] Replace all `chrome.storage.local.get(...)` with `auth.loadSession()` or `auth.getToken()`
- [ ] Replace auth checks with `auth.isAuthenticated()` or `auth.validateSession()`
- [ ] Replace logout with `auth.logout()`

### Content-Script.js
- [ ] Replace all token retrieval with `auth.getToken()`
- [ ] Replace all auth checks with `auth.isAuthenticated()`
- [ ] Remove direct storage access for tokens

### Background Script
- [ ] Replace all token storage with `auth.saveSession()`
- [ ] Replace all token loading with `auth.loadSession()`
- [ ] Use `auth.verifySession()` for backend validation

### API Calls
- [ ] All API requests should get token from `auth.getToken()`
- [ ] Check authentication before making requests
- [ ] Handle 401 responses by calling `auth.logout()`

## Configuration

AuthManager includes sensible defaults, but can be customized:

```javascript
const auth = new AuthManager();

// Defaults (in constructor)
SESSION_CONFIG = {
  TOKEN_TYPE: 'Bearer',
  DEFAULT_EXPIRY: 3600,           // 1 hour
  STALE_THRESHOLD: 300,           // 5 minutes before expiry
  VALIDATION_TIMEOUT: 10000,      // 10 seconds
  REFRESH_BUFFER: 600             // Refresh 10 mins early
};
```

## Error Handling

All methods return structured results with `success` flag and reason:

```javascript
const result = await auth.saveSession(data);

if (result.success) {
  // Proceed
} else {
  console.error('Failed:', result.error);
  // Handle error
}
```

## Debugging

Enable detailed logging:

```javascript
const auth = new AuthManager();

// Check full auth state
await auth.debugAuthState();

// Check specific aspects
const validation = await auth.validateSession();
const verification = await auth.verifySession();
const summary = await auth.getSessionSummary();
```

## Performance Considerations

- **Caching**: Session loaded from cache for 5 seconds
- **Storage**: Prefers sync storage (faster for cross-device)
- **Verification**: Backend verification cached for 1 minute
- **Async**: All methods are async, use await or `.then()`

## Security Best Practices

1. **Always validate** before API calls:
   ```javascript
   if (await auth.isAuthenticated()) {
     // Proceed
   }
   ```

2. **Check stale status**:
   ```javascript
   const validation = await auth.validateSession();
   if (validation.isStale) {
     await auth.refreshSession();
   }
   ```

3. **Handle 401 responses**:
   ```javascript
   if (response.status === 401) {
     await auth.logout();
   }
   ```

4. **Verify with backend** periodically:
   ```javascript
   const verification = await auth.verifySession();
   if (!verification.verified) {
     await auth.logout();
   }
   ```

## Testing

```javascript
// In console during development
const auth = new AuthManager();

// Test save
await auth.saveSession({
  extensionToken: 'test_token',
  user: { email: 'test@example.com' }
});

// Test load
const result = await auth.loadSession();
console.log(result);

// Test validation
const validation = await auth.validateSession();
console.log(validation);

// Test logout
await auth.logout();
```

## Troubleshooting

### "No session found"
- Check if user is actually logged in
- Verify `saveSession()` was called after OAuth
- Check browser dev tools → Application → Storage

### "Session expired"
- User's token has genuinely expired
- Call `refreshSession()` to get new token
- If refresh fails, logout and re-authenticate

### "Network error during verification"
- Normal if offline
- AuthManager falls back to local session validation
- Will show `OFFLINE_VALID` reason

### "Storage error"
- Check browser permissions
- Ensure manifest.json includes `"storage"` permission
- Check browser storage limits (usually 10MB+)

---

**Summary**: Use AuthManager for ALL authentication operations. Never call `chrome.storage.local` directly for auth data. This ensures consistency, security, and maintainability across the entire extension.
