# CRITICAL FIXES - IMPLEMENTATION GUIDE

## Overview

This document provides exact code to fix the CRITICAL auth issues identified in the production audit.

**Priority Order:**
1. Fix login race condition (blocks user experience)
2. Consolidate to AuthManager (reduces bugs)
3. Add token auto-refresh (prevents silent failures)
4. Add 401 retry logic (improves resilience)
5. Clean storage keys (improves maintainability)

---

## CRITICAL FIX #1: Fix Login Race Condition

### Problem

User sees "Login with Job Orbit" button even after successful OAuth.

### Root Cause

Race condition between storage write and popup check.

### Solution

Have popup wait for explicit auth message instead of polling storage.

### Implementation

**File:** `extension/src/popup/popup.js`

**Find this code (lines ~80-150):**

```javascript
// OLD: Checks storage immediately - may happen before service worker writes it
async function checkJobOrbitConnection() {
    return new Promise(resolve => {
        chrome.storage.local.get(['jobOrbitAuth', 'isLoggedIn'], (result) => {
            const isConnected = !!(result.jobOrbitAuth && result.jobOrbitAuth.extensionToken) ||
                              result.isLoggedIn === true;
```

**Replace with this:**

```javascript
// NEW: Wait for explicit auth message with timeout fallback
async function checkJobOrbitConnection() {
    return new Promise(resolve => {
        // Set a timeout - if no message in 2 seconds, check storage
        const timeoutId = setTimeout(() => {
            console.log('[Popup] Timeout waiting for auth message, checking storage...');
            fallbackStorageCheck();
        }, 2000);
        
        // Flag to ensure we only resolve once
        let resolved = false;
        
        function resolveOnce(isConnected) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                console.log('[Popup] Auth state resolved:', isConnected ? 'LOGGED_IN' : 'GUEST');
                resolve(isConnected);
            }
        }
        
        // Try immediate storage check first (user might have been logged in already)
        chrome.storage.local.get(['jobOrbitAuth', 'isLoggedIn'], (result) => {
            const isConnected = !!(result.jobOrbitAuth?.extensionToken) || result.isLoggedIn === true;
            if (isConnected) {
                resolveOnce(true);
                return;
            }
            // Not connected yet, wait for auth message
        });
        
        // Helper: Check storage as fallback
        function fallbackStorageCheck() {
            chrome.storage.sync.get(['jobOrbitSession'], (syncResult) => {
                if (chrome.runtime.lastError) {
                    chrome.storage.local.get(['jobOrbitSession'], (localResult) => {
                        const session = localResult.jobOrbitSession;
                        resolveOnce(!!(session && session.extensionToken && session.expiresAt > Date.now()));
                    });
                } else {
                    const session = syncResult.jobOrbitSession;
                    resolveOnce(!!(session && session.extensionToken && session.expiresAt > Date.now()));
                }
            });
        }
    });
}
```

**Also add message listener in init():**

```javascript
// Add this inside the setupAutoClose() or init() function
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
        console.log('[Popup] ✅ Received token, updating UI...');
        // Immediately update UI without waiting
        showConnectedUI();
        sendResponse({ success: true });
    }
    
    // ... rest of handlers
});
```

---

## CRITICAL FIX #2: Consolidate to AuthManager

### Problem

Three parallel auth systems cause confusion and bugs.

### Solution

Update popup.js to use AuthManager for ALL auth operations.

### Implementation

**File:** `extension/src/popup/popup.js`

**Add at the very top (after other includes):**

```javascript
// Add auth manager
// Assume AuthManager.js is already in manifest content_scripts or popup.html
// If not in popup.html yet, add: <script src="../auth/AuthManager.js"></script>

let authManager = null;

function initAuthManager() {
    if (!authManager) {
        authManager = new AuthManager();
        console.log('[Popup] AuthManager initialized');
    }
    return authManager;
}
```

**Find this code (old checkJobOrbitConnection continuation):**

```javascript
// OLD: Direct storage access
        if (result.jobOrbitAuth && result.jobOrbitAuth.extensionToken) {
            const token = result.jobOrbitAuth.extensionToken;
            const expiresAt = result.jobOrbitAuth.expiresAt;
            
            if (Date.now() < expiresAt) {
                // Token still valid
                showConnectedUI();
            } else {
                // Token expired
                showLoginUI();
            }
        } else {
            showLoginUI();
        }
```

**Replace with this:**

```javascript
// NEW: Use AuthManager
        const auth = initAuthManager();
        const validation = await auth.validateSession();
        
        if (validation.valid) {
            console.log('[Popup] Session valid');
            const { user } = await auth.getUser();
            showConnectedUI(user);
        } else {
            console.log('[Popup] Session invalid:', validation.reason);
            showLoginUI();
        }
```

**Find logout button handler:**

```javascript
// OLD: Direct storage clear
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    chrome.storage.local.clear();
    showLoginUI();
});
```

**Replace with:**

```javascript
// NEW: Use AuthManager
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    const auth = initAuthManager();
    const result = await auth.logout();
    if (result.success) {
        console.log('[Popup] Logout successful');
        showLoginUI();
    } else {
        console.error('[Popup] Logout failed:', result.error);
    }
});
```

**Find where popup listens for EXTENSION_TOKEN_RECEIVED:**

```javascript
// OLD: Direct storage access
        if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
            console.log('[Popup] Received extension token from auth page');
            // Store it
            chrome.storage.local.set({
                extensionToken: request.data.extensionToken,
                expiresAt: request.data.expiresAt,
                isLoggedIn: true
            }, () => {
                checkJobOrbitConnection();
            });
        }
```

**Replace with:**

```javascript
// NEW: Use AuthManager
        if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
            console.log('[Popup] Received extension token from auth page');
            const auth = initAuthManager();
            const result = await auth.saveSession(request.data);
            
            if (result.success) {
                console.log('[Popup] Token saved successfully');
                await checkJobOrbitConnection();
            } else {
                console.error('[Popup] Failed to save token:', result.error);
            }
        }
```

---

## CRITICAL FIX #3: Implement Auto Token Refresh

### Problem

Token expires silently if extension left open.

### Solution

Add background task to refresh token 10 minutes before expiry.

### Implementation

**Create new file:** `extension/src/background/tokenRefreshScheduler.js`

```javascript
/**
 * Token Refresh Scheduler
 * Automatically refreshes auth token before expiration
 */

class TokenRefreshScheduler {
    constructor() {
        this.refreshTimerId = null;
        this.isRefreshing = false;
        this.REFRESH_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
        this.REFRESH_BUFFER = 10 * 60 * 1000; // Refresh 10 mins before expiry
    }

    /**
     * Start the refresh scheduler
     */
    start() {
        if (this.refreshTimerId) {
            console.log('[TokenRefresh] Scheduler already running');
            return;
        }

        console.log('[TokenRefresh] ✅ Starting scheduler');
        
        // Check immediately
        this.checkAndRefresh();
        
        // Then check every 5 minutes
        this.refreshTimerId = setInterval(() => {
            this.checkAndRefresh();
        }, this.REFRESH_CHECK_INTERVAL);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.refreshTimerId) {
            clearInterval(this.refreshTimerId);
            this.refreshTimerId = null;
            console.log('[TokenRefresh] ⏹️ Scheduler stopped');
        }
    }

    /**
     * Check if token needs refresh
     */
    async checkAndRefresh() {
        if (this.isRefreshing) {
            return; // Already refreshing
        }

        try {
            console.log('[TokenRefresh] 🔍 Checking token...');

            // Get current session
            const session = await this.getSessionFromStorage();
            if (!session) {
                console.log('[TokenRefresh] No session found');
                return;
            }

            // Calculate time to expiry
            const now = Date.now();
            const timeToExpiry = session.expiresAt - now;
            const timeToRefresh = this.REFRESH_BUFFER;

            console.log('[TokenRefresh] Time to expiry:', Math.round(timeToExpiry / 1000), 'seconds');
            console.log('[TokenRefresh] Refresh threshold:', Math.round(timeToRefresh / 1000), 'seconds');

            // If expires in < 10 minutes, refresh now
            if (timeToExpiry < timeToRefresh) {
                console.log('[TokenRefresh] ⚠️ Token expiring soon, refreshing...');
                await this.refreshToken(session);
            }

        } catch (error) {
            console.error('[TokenRefresh] ❌ Error during check:', error.message);
        }
    }

    /**
     * Refresh the token
     */
    async refreshToken(session) {
        this.isRefreshing = true;

        try {
            const apiUrl = 'https://ats-resume-optimizer-359j.onrender.com/api';
            
            const response = await fetch(`${apiUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.extensionToken}`
                },
                timeout: 10000
            });

            if (!response.ok) {
                console.error('[TokenRefresh] ❌ Refresh failed (HTTP', response.status + ')');
                
                if (response.status === 401 || response.status === 403) {
                    console.log('[TokenRefresh] Token invalid, logging out...');
                    await this.clearSession();
                }
                return;
            }

            const data = await response.json();

            if (!data.success || !data.access_token) {
                console.error('[TokenRefresh] ❌ Invalid refresh response');
                return;
            }

            // Update session with new token
            session.extensionToken = data.access_token;
            session.expiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
            session.lastRefreshAt = new Date().toISOString();

            await this.saveSessionToStorage(session);
            console.log('[TokenRefresh] ✅ Token refreshed, expires:', new Date(session.expiresAt).toISOString());

        } catch (error) {
            console.error('[TokenRefresh] ❌ Refresh error:', error.message);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Get session from storage
     */
    async getSessionFromStorage() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['jobOrbitSession'], result => {
                if (result.jobOrbitSession) {
                    resolve(result.jobOrbitSession);
                } else {
                    chrome.storage.local.get(['jobOrbitSession'], localResult => {
                        resolve(localResult.jobOrbitSession);
                    });
                }
            });
        });
    }

    /**
     * Save session to storage
     */
    async saveSessionToStorage(session) {
        return new Promise(resolve => {
            const data = { jobOrbitSession: session };
            chrome.storage.sync.set(data, () => {
                chrome.storage.local.set(data, () => {
                    resolve();
                });
            });
        });
    }

    /**
     * Clear session (logout)
     */
    async clearSession() {
        return new Promise(resolve => {
            const keys = ['jobOrbitSession', 'jobOrbitAuth', 'extensionToken', 'expiresAt', 'isLoggedIn'];
            chrome.storage.sync.remove(keys, () => {
                chrome.storage.local.remove(keys, () => {
                    resolve();
                });
            });
        });
    }
}

// Global instance
const tokenRefreshScheduler = new TokenRefreshScheduler();
```

**Add to manifest.json content_scripts (add to service-worker section):**

```json
"background": {
  "service_worker": "src/background/service-worker.js",
  "scripts": ["src/background/tokenRefreshScheduler.js"]
}
```

**Add to service-worker.js (at end of file):**

```javascript
// Start token refresh scheduler when service worker loads
console.log('[ServiceWorker] Starting token refresh scheduler...');
if (typeof tokenRefreshScheduler !== 'undefined') {
    tokenRefreshScheduler.start();
}
```

---

## CRITICAL FIX #4: Add 401 Retry Logic

### Problem

Failed API calls don't retry with fresh token.

### Solution

Add centralized API client with retry logic.

### Implementation

**Create new file:** `extension/src/utils/apiClient.js`

```javascript
/**
 * API Client with Automatic Retry & Token Refresh
 * Handles authentication errors transparently
 */

class APIClient {
    constructor() {
        this.BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
        this.REQUEST_TIMEOUT = 30000; // 30 seconds
        this.MAX_RETRIES = 1; // Retry once on 401
    }

    /**
     * Make authenticated API request with retry
     */
    async request(endpoint, options = {}) {
        const method = options.method || 'GET';
        const body = options.body;
        const retryCount = options.retryCount || 0;

        try {
            console.log(`[APIClient] ${method} ${endpoint}`);

            // Get current token
            const { token } = await this.getToken();
            if (!token) {
                throw new Error('No authentication token');
            }

            // Build request
            const url = `${this.BASE_URL}${endpoint}`;
            const init = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                },
                timeout: this.REQUEST_TIMEOUT
            };

            if (body) {
                init.body = JSON.stringify(body);
            }

            // Make request
            const response = await fetch(url, init);

            // Handle 401 - retry with fresh token
            if (response.status === 401 && retryCount < this.MAX_RETRIES) {
                console.log('[APIClient] 🔄 Got 401, refreshing token and retrying...');
                
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // Retry with incremented count
                    options.retryCount = retryCount + 1;
                    return this.request(endpoint, options);
                } else {
                    throw new Error('Token refresh failed');
                }
            }

            // Check other errors
            if (!response.ok) {
                const error = await response.text();
                console.error(`[APIClient] ❌ ${response.status}:`, error.substring(0, 200));
                throw new Error(`HTTP ${response.status}: ${error}`);
            }

            // Parse response
            const data = await response.json();
            console.log(`[APIClient] ✅ ${method} ${endpoint}`);
            return data;

        } catch (error) {
            console.error(`[APIClient] ❌ Request failed:`, error.message);
            throw error;
        }
    }

    /**
     * Get current token
     */
    async getToken() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['jobOrbitSession'], result => {
                if (result.jobOrbitSession?.extensionToken) {
                    resolve({ token: result.jobOrbitSession.extensionToken });
                } else {
                    chrome.storage.local.get(['jobOrbitSession'], localResult => {
                        resolve({ token: localResult.jobOrbitSession?.extensionToken });
                    });
                }
            });
        });
    }

    /**
     * Refresh token
     */
    async refreshToken() {
        try {
            const { token } = await this.getToken();
            if (!token) return false;

            const response = await fetch(`${this.BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: this.REQUEST_TIMEOUT
            });

            if (!response.ok) {
                console.error('[APIClient] Token refresh failed');
                return false;
            }

            const data = await response.json();
            if (!data.access_token) {
                console.error('[APIClient] No token in refresh response');
                return false;
            }

            // Update session
            const session = await this.getSessionFromStorage();
            session.extensionToken = data.access_token;
            session.expiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
            await this.saveSessionToStorage(session);

            console.log('[APIClient] ✅ Token refreshed');
            return true;

        } catch (error) {
            console.error('[APIClient] Refresh error:', error);
            return false;
        }
    }

    /**
     * Get session from storage
     */
    async getSessionFromStorage() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['jobOrbitSession'], result => {
                resolve(result.jobOrbitSession || {});
            });
        });
    }

    /**
     * Save session to storage
     */
    async saveSessionToStorage(session) {
        return new Promise(resolve => {
            chrome.storage.sync.set({ jobOrbitSession: session }, () => {
                chrome.storage.local.set({ jobOrbitSession: session }, () => {
                    resolve();
                });
            });
        });
    }
}

// Global instance
const apiClient = new APIClient();
```

**Usage in service-worker.js - replace all fetch calls:**

```javascript
// OLD:
const response = await fetch(`${apiUrl}/resume/parse`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(resumeText)
});

// NEW:
const result = await apiClient.request('/resume/parse', {
    method: 'POST',
    body: { text: resumeText }
});
```

---

## Summary of Changes

| File | Changes | Priority |
|------|---------|----------|
| popup.js | Use AuthManager, fix race condition | CRITICAL |
| service-worker.js | Add token refresh scheduler | HIGH |
| apiClient.js (new) | Add 401 retry logic | HIGH |
| manifest.json | Add tokenRefreshScheduler.js to background | HIGH |

**Expected Outcomes After Fixes:**
- ✅ Login UI doesn't flicker after successful auth
- ✅ Token refreshes automatically before expiry
- ✅ Failed API calls retry with new token transparently
- ✅ Single source of truth for auth (AuthManager)
- ✅ No race conditions or timing issues
- ✅ Consistent error handling

---

