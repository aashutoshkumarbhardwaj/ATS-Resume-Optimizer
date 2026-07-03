/**
 * Auth Manager
 * Centralized authentication service for the entire extension
 * 
 * Single source of truth for:
 * - Session management
 * - Token storage and validation
 * - User authentication state
 * - Token refresh logic
 * - Logout operations
 * 
 * Usage:
 *   const auth = new AuthManager();
 *   await auth.saveSession(tokenData);
 *   const isValid = await auth.validateSession();
 *   await auth.logout();
 */

class AuthManager {
    constructor() {
        this.STORAGE_KEYS = {
            SESSION: 'jobOrbitSession',
            AUTH: 'jobOrbitAuth',
            TOKEN: 'extensionToken',
            EXPIRES_AT: 'expiresAt',
            IS_LOGGED_IN: 'isLoggedIn',
            USER: 'jobOrbitUser'
        };

        this.SESSION_CONFIG = {
            TOKEN_TYPE: 'Bearer',
            DEFAULT_EXPIRY: 3600, // 1 hour in seconds
            STALE_THRESHOLD: 300, // 5 minutes before expiry
            VALIDATION_TIMEOUT: 10000, // 10 seconds
            REFRESH_BUFFER: 600, // Refresh 10 mins before expiry
        };

        this.API_CONFIG = {
            BASE_URL: (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL)
                ? CONFIG.API_BASE_URL
                : 'https://ats-resume-optimizer-359j.onrender.com/api'
        };

        this.cache = {
            session: null,
            lastFetch: 0,
            cacheDuration: 5000 // 5 seconds
        };

        console.log('[AuthManager] ✅ Initialized');
    }

    /**
     * Save session after successful authentication
     * @param {Object} authData - Data from OAuth response
     * @returns {Promise<{success: boolean, stored: string}>}
     */
    async saveSession(authData) {
        if (!authData || !authData.extensionToken) {
            console.error('[AuthManager] ❌ No token in auth data');
            return { success: false, error: 'NO_TOKEN' };
        }

        try {
            console.log('[AuthManager] 💾 Saving session...');

            const session = {
                // Token information
                extensionToken: authData.extensionToken || authData.token,
                tokenType: authData.tokenType || this.SESSION_CONFIG.TOKEN_TYPE,
                expiresIn: authData.expiresIn || this.SESSION_CONFIG.DEFAULT_EXPIRY,
                expiresAt: Date.now() + ((authData.expiresIn || this.SESSION_CONFIG.DEFAULT_EXPIRY) * 1000),

                // User information
                user: authData.user || {},
                userId: authData.user?.id || authData.userId,
                userEmail: authData.user?.email || authData.userEmail,

                // Session metadata
                createdAt: new Date().toISOString(),
                lastVerifiedAt: new Date().toISOString(),
                lastSyncAt: null,
                lastRefreshAt: null,
                syncStatus: 'never',
                verificationStatus: 'pending',

                // Cache
                cachedProfile: authData.profile || {},
                cachedResumes: authData.resumes || [],
                cachedApplications: authData.applications || [],
                cachedAnswers: authData.answers || [],
                cachedSettings: authData.settings || {},
            };

            // Store in both sync and local
            const storageData = {
                [this.STORAGE_KEYS.SESSION]: session,
                [this.STORAGE_KEYS.AUTH]: {
                    extensionToken: session.extensionToken,
                    tokenType: session.tokenType,
                    expiresAt: session.expiresAt,
                    user: session.user,
                    createdAt: session.createdAt
                },
                [this.STORAGE_KEYS.TOKEN]: session.extensionToken,
                [this.STORAGE_KEYS.EXPIRES_AT]: session.expiresAt,
                [this.STORAGE_KEYS.IS_LOGGED_IN]: true,
                [this.STORAGE_KEYS.USER]: session.user
            };

            return new Promise((resolve) => {
                // Try sync storage first (preferred for cross-device sync)
                chrome.storage.sync.set(storageData, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[AuthManager] ⚠️ Sync storage failed, using local');
                        chrome.storage.local.set(storageData, () => {
                            this.cache.session = session;
                            this.cache.lastFetch = Date.now();
                            console.log('[AuthManager] ✅ Session saved to local storage');
                            resolve({ success: true, stored: 'local' });
                        });
                    } else {
                        // Also backup to local
                        chrome.storage.local.set(storageData, () => {
                            this.cache.session = session;
                            this.cache.lastFetch = Date.now();
                            console.log('[AuthManager] ✅ Session saved to sync + local storage');
                            resolve({ success: true, stored: 'sync+local' });
                        });
                    }
                });
            });
        } catch (error) {
            console.error('[AuthManager] ❌ Error saving session:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load session from storage
     * Uses cache for performance
     * @returns {Promise<{success: boolean, session: Object|null, source: string}>}
     */
    async loadSession() {
        try {
            // Check cache first
            if (this.cache.session && (Date.now() - this.cache.lastFetch) < this.cache.cacheDuration) {
                console.log('[AuthManager] 💾 Returning cached session');
                return { success: true, session: this.cache.session, source: 'cache' };
            }

            console.log('[AuthManager] 🔍 Loading session...');

            return new Promise((resolve) => {
                // Try sync storage first
                chrome.storage.sync.get([this.STORAGE_KEYS.SESSION], (syncResult) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[AuthManager] ⚠️ Sync storage error:', chrome.runtime.lastError.message);
                    }

                    if (syncResult[this.STORAGE_KEYS.SESSION]) {
                        const session = syncResult[this.STORAGE_KEYS.SESSION];
                        this.cache.session = session;
                        this.cache.lastFetch = Date.now();
                        console.log('[AuthManager] ✅ Session loaded from sync storage');
                        resolve({ success: true, session, source: 'sync' });
                        return;
                    }

                    // Fallback to local storage
                    chrome.storage.local.get([this.STORAGE_KEYS.SESSION], (localResult) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[AuthManager] ⚠️ Local storage error:', chrome.runtime.lastError.message);
                            resolve({ success: false, session: null, source: 'error' });
                            return;
                        }

                        if (localResult[this.STORAGE_KEYS.SESSION]) {
                            const session = localResult[this.STORAGE_KEYS.SESSION];
                            this.cache.session = session;
                            this.cache.lastFetch = Date.now();
                            console.log('[AuthManager] ✅ Session loaded from local storage');
                            resolve({ success: true, session, source: 'local' });
                        } else {
                            console.log('[AuthManager] ❌ No session found');
                            resolve({ success: false, session: null, source: 'none' });
                        }
                    });
                });
            });
        } catch (error) {
            console.error('[AuthManager] ❌ Error loading session:', error.message);
            return { success: false, session: null, source: 'error', error: error.message };
        }
    }

    /**
     * Check if session is valid (not expired)
     * @returns {Promise<{valid: boolean, session: Object|null, reason: string, timeToExpiry: number, isStale: boolean}>}
     */
    async validateSession() {
        try {
            console.log('[AuthManager] 🔐 Validating session...');

            const result = await this.loadSession();

            if (!result.success || !result.session) {
                console.log('[AuthManager] ❌ No session to validate');
                return { valid: false, session: null, reason: 'NO_SESSION', timeToExpiry: 0, isStale: false };
            }

            const session = result.session;
            const now = Date.now();
            const timeToExpiry = session.expiresAt - now;

            // Check if expired
            if (timeToExpiry < 0) {
                console.log('[AuthManager] ❌ Session expired');
                return { valid: false, session, reason: 'EXPIRED', timeToExpiry: 0, isStale: false };
            }

            // Check if stale (expiring soon)
            const isStale = timeToExpiry < (this.SESSION_CONFIG.STALE_THRESHOLD * 1000);

            if (isStale) {
                console.log('[AuthManager] ⚠️ Session is stale (expiring soon)');
            } else {
                console.log('[AuthManager] ✅ Session is valid, expires in:', Math.round(timeToExpiry / 1000), 'seconds');
            }

            return { valid: true, session, reason: 'VALID', timeToExpiry, isStale };
        } catch (error) {
            console.error('[AuthManager] ❌ Error validating session:', error.message);
            return { valid: false, session: null, reason: 'ERROR', timeToExpiry: 0, isStale: false, error: error.message };
        }
    }

    /**
     * Verify session with backend
     * @returns {Promise<{verified: boolean, user: Object|null, reason: string, expiresIn: number}>}
     */
    async verifySession() {
        try {
            console.log('[AuthManager] 🔄 Verifying session with backend...');

            const result = await this.loadSession();

            if (!result.success || !result.session) {
                console.log('[AuthManager] ❌ No session to verify');
                return { verified: false, user: null, reason: 'NO_SESSION' };
            }

            const session = result.session;

            // Check if already verified recently (within 1 minute)
            if (session.lastVerifiedAt) {
                const lastVerified = new Date(session.lastVerifiedAt).getTime();
                const timeSinceVerify = Date.now() - lastVerified;
                if (timeSinceVerify < 60000) { // 1 minute
                    console.log('[AuthManager] ✅ Session recently verified, skipping backend check');
                    return { verified: true, user: session.user, reason: 'CACHED_VERIFICATION', expiresIn: Math.round((session.expiresAt - Date.now()) / 1000) };
                }
            }

            try {
                const response = await fetch(`${this.API_CONFIG.BASE_URL}/auth/me`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `${session.tokenType} ${session.extensionToken}`
                    },
                    timeout: this.SESSION_CONFIG.VALIDATION_TIMEOUT
                });

                if (!response.ok) {
                    console.error('[AuthManager] ❌ Backend verification failed (HTTP', response.status + ')');
                    
                    if (response.status === 401 || response.status === 403) {
                        // Unauthorized - token is invalid
                        await this.logout();
                        return { verified: false, user: null, reason: 'UNAUTHORIZED', expiresIn: 0 };
                    }

                    return { verified: false, user: null, reason: 'HTTP_ERROR', expiresIn: 0, status: response.status };
                }

                const data = await response.json();

                if (!data.success || !data.authenticated) {
                    console.log('[AuthManager] ❌ Backend rejected session');
                    return { verified: false, user: null, reason: 'NOT_AUTHENTICATED', expiresIn: 0 };
                }

                console.log('[AuthManager] ✅ Session verified by backend');

                // Update verification timestamp
                session.lastVerifiedAt = new Date().toISOString();
                session.verificationStatus = 'verified';
                await this.updateSession(session);

                return {
                    verified: true,
                    user: data.user,
                    reason: 'VERIFIED',
                    expiresIn: data.expiresIn || Math.round((session.expiresAt - Date.now()) / 1000)
                };
            } catch (fetchError) {
                console.error('[AuthManager] ❌ Verification request failed:', fetchError.message);
                
                // Network error - but session might still be valid locally
                if (session.expiresAt > Date.now()) {
                    console.log('[AuthManager] ⚠️ Network error, but session still valid locally');
                    return { verified: true, user: session.user, reason: 'OFFLINE_VALID', expiresIn: Math.round((session.expiresAt - Date.now()) / 1000) };
                }

                return { verified: false, user: null, reason: 'VERIFICATION_ERROR', expiresIn: 0, error: fetchError.message };
            }
        } catch (error) {
            console.error('[AuthManager] ❌ Verification error:', error.message);
            return { verified: false, user: null, reason: 'ERROR', expiresIn: 0, error: error.message };
        }
    }

    /**
     * Refresh session token
     * @returns {Promise<{refreshed: boolean, session: Object|null, reason: string}>}
     */
    async refreshSession() {
        try {
            console.log('[AuthManager] 🔄 Refreshing session...');

            const result = await this.loadSession();

            if (!result.success || !result.session) {
                console.log('[AuthManager] ❌ No session to refresh');
                return { refreshed: false, session: null, reason: 'NO_SESSION' };
            }

            const session = result.session;

            // Check if refresh token exists (if using refresh tokens)
            if (!session.extensionToken) {
                console.log('[AuthManager] ❌ No token to refresh');
                return { refreshed: false, session: null, reason: 'NO_TOKEN' };
            }

            try {
                // Call backend refresh endpoint
                const response = await fetch(`${this.API_CONFIG.BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `${session.tokenType} ${session.extensionToken}`
                    },
                    timeout: this.SESSION_CONFIG.VALIDATION_TIMEOUT
                });

                if (!response.ok) {
                    console.error('[AuthManager] ❌ Refresh failed (HTTP', response.status + ')');
                    
                    if (response.status === 401 || response.status === 403) {
                        await this.logout();
                        return { refreshed: false, session: null, reason: 'UNAUTHORIZED' };
                    }

                    return { refreshed: false, session: null, reason: 'HTTP_ERROR', status: response.status };
                }

                const data = await response.json();

                if (!data.success) {
                    console.log('[AuthManager] ❌ Backend rejected refresh');
                    await this.logout();
                    return { refreshed: false, session: null, reason: 'REFRESH_REJECTED' };
                }

                // Update session with new token
                session.extensionToken = data.access_token || data.extensionToken;
                session.expiresIn = data.expires_in || this.SESSION_CONFIG.DEFAULT_EXPIRY;
                session.expiresAt = Date.now() + (session.expiresIn * 1000);
                session.lastRefreshAt = new Date().toISOString();

                await this.updateSession(session);

                console.log('[AuthManager] ✅ Session refreshed, new expiry:', new Date(session.expiresAt).toISOString());

                return { refreshed: true, session, reason: 'REFRESHED' };
            } catch (fetchError) {
                console.error('[AuthManager] ❌ Refresh request failed:', fetchError.message);
                return { refreshed: false, session: null, reason: 'REFRESH_ERROR', error: fetchError.message };
            }
        } catch (error) {
            console.error('[AuthManager] ❌ Refresh error:', error.message);
            return { refreshed: false, session: null, reason: 'ERROR', error: error.message };
        }
    }

    /**
     * Update session data
     * @param {Object} session - Updated session object
     * @returns {Promise<{success: boolean}>}
     */
    async updateSession(session) {
        try {
            console.log('[AuthManager] 📝 Updating session...');

            const storageData = {
                [this.STORAGE_KEYS.SESSION]: session,
                [this.STORAGE_KEYS.AUTH]: {
                    extensionToken: session.extensionToken,
                    tokenType: session.tokenType,
                    expiresAt: session.expiresAt,
                    user: session.user,
                    createdAt: session.createdAt
                },
                [this.STORAGE_KEYS.TOKEN]: session.extensionToken,
                [this.STORAGE_KEYS.EXPIRES_AT]: session.expiresAt,
                [this.STORAGE_KEYS.IS_LOGGED_IN]: true,
                [this.STORAGE_KEYS.USER]: session.user
            };

            return new Promise((resolve) => {
                chrome.storage.sync.set(storageData, () => {
                    if (chrome.runtime.lastError) {
                        chrome.storage.local.set(storageData, () => {
                            this.cache.session = session;
                            this.cache.lastFetch = Date.now();
                            resolve({ success: true });
                        });
                    } else {
                        chrome.storage.local.set(storageData, () => {
                            this.cache.session = session;
                            this.cache.lastFetch = Date.now();
                            resolve({ success: true });
                        });
                    }
                });
            });
        } catch (error) {
            console.error('[AuthManager] ❌ Error updating session:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if user is authenticated
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        try {
            const validation = await this.validateSession();
            return validation.valid;
        } catch (error) {
            console.error('[AuthManager] ❌ Error checking authentication:', error.message);
            return false;
        }
    }

    /**
     * Get current user info
     * @returns {Promise<{user: Object|null, success: boolean}>}
     */
    async getUser() {
        try {
            const result = await this.loadSession();

            if (!result.success || !result.session) {
                return { user: null, success: false };
            }

            return { user: result.session.user, success: true };
        } catch (error) {
            console.error('[AuthManager] ❌ Error getting user:', error.message);
            return { user: null, success: false, error: error.message };
        }
    }

    /**
     * Get authentication token
     * @returns {Promise<{token: string|null, expiresAt: number|null, success: boolean}>}
     */
    async getToken() {
        try {
            const result = await this.loadSession();

            if (!result.success || !result.session) {
                return { token: null, expiresAt: null, success: false };
            }

            return {
                token: result.session.extensionToken,
                expiresAt: result.session.expiresAt,
                success: true
            };
        } catch (error) {
            console.error('[AuthManager] ❌ Error getting token:', error.message);
            return { token: null, expiresAt: null, success: false, error: error.message };
        }
    }

    /**
     * Logout user
     * @returns {Promise<{success: boolean}>}
     */
    async logout() {
        try {
            console.log('[AuthManager] 🚪 Logging out...');

            return new Promise((resolve) => {
                const keysToRemove = Object.values(this.STORAGE_KEYS);

                chrome.storage.sync.remove(keysToRemove, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[AuthManager] ⚠️ Sync remove error:', chrome.runtime.lastError.message);
                    }

                    chrome.storage.local.remove(keysToRemove, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('[AuthManager] ⚠️ Local remove error:', chrome.runtime.lastError.message);
                        }

                        // Clear cache
                        this.cache = {
                            session: null,
                            lastFetch: 0,
                            cacheDuration: 5000
                        };

                        console.log('[AuthManager] ✅ Logged out successfully');
                        resolve({ success: true });
                    });
                });
            });
        } catch (error) {
            console.error('[AuthManager] ❌ Logout error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get session summary for debugging/UI display
     * @returns {Promise<Object>}
     */
    async getSessionSummary() {
        try {
            const sessionResult = await this.loadSession();
            const validResult = await this.validateSession();

            if (!sessionResult.success) {
                return {
                    authenticated: false,
                    message: 'Not logged in'
                };
            }

            const session = sessionResult.session;
            const timeToExpiry = session.expiresAt - Date.now();
            const hoursToExpiry = Math.round(timeToExpiry / (1000 * 60 * 60));

            return {
                authenticated: true,
                valid: validResult.valid,
                user: {
                    name: session.user?.name || 'User',
                    email: session.user?.email || '',
                    id: session.userId || ''
                },
                token: {
                    exists: !!session.extensionToken,
                    expiresAt: new Date(session.expiresAt).toISOString(),
                    expiresIn: hoursToExpiry + ' hours',
                    isStale: validResult.isStale
                },
                session: {
                    createdAt: new Date(session.createdAt).toLocaleString(),
                    lastVerifiedAt: session.lastVerifiedAt ? new Date(session.lastVerifiedAt).toLocaleTimeString() : 'Never',
                    lastRefreshAt: session.lastRefreshAt ? new Date(session.lastRefreshAt).toLocaleTimeString() : 'Never',
                    verificationStatus: session.verificationStatus || 'unknown'
                },
                storage: {
                    source: sessionResult.source,
                    cached: sessionResult.source === 'cache'
                }
            };
        } catch (error) {
            console.error('[AuthManager] ❌ Error getting session summary:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Debug helper - log full auth state
     */
    async debugAuthState() {
        console.log('\n' + '='.repeat(70));
        console.log('🔐 AUTH MANAGER DEBUG STATE');
        console.log('='.repeat(70));

        const summary = await this.getSessionSummary();
        console.log('📊 Session Summary:', JSON.stringify(summary, null, 2));

        const validation = await this.validateSession();
        console.log('🔍 Validation Result:', validation);

        const verification = await this.verifySession();
        console.log('✅ Verification Result:', { verified: verification.verified, reason: verification.reason });

        console.log('='.repeat(70) + '\n');
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
