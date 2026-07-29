/**
 * Token Verifier Utility
 * Handles token validation with backend
 * Requires CONFIG to be loaded first
 */

class TokenVerifier {
    /**
     * Verify token with backend
     * GET /api/auth/me with token in Authorization header
     */
    static async verifyToken(token) {
        if (!token) {
            console.log('[TokenVerifier] ❌ No token provided');
            return {
                valid: false,
                reason: 'NO_TOKEN',
                error: 'No token stored'
            };
        }

        console.log('[TokenVerifier] 🔐 Verifying token with backend...');
        console.log('[TokenVerifier] Token preview:', token.substring(0, 30) + '...');
        console.log('[TokenVerifier] Token length:', token.length);

        try {
            const apiUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                ? CONFIG.API_BASE_URL 
                : 'https://ats-resume-optimizer-359j.onrender.com/api';
            const timeout = (typeof CONFIG !== 'undefined' && CONFIG.SYNC.REQUEST_TIMEOUT_MS)
                ? CONFIG.SYNC.REQUEST_TIMEOUT_MS
                : 10000;

            console.log('[TokenVerifier] 🌐 Making request to:', `${apiUrl}/auth/me`);
            console.log('[TokenVerifier] Using timeout:', timeout, 'ms');

            const response = await fetch(`${apiUrl}/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: timeout
            });

            console.log('[TokenVerifier] 📡 Response status:', response.status);
            console.log('[TokenVerifier] Response headers:', {
                contentType: response.headers.get('content-type'),
                contentLength: response.headers.get('content-length')
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log('[TokenVerifier] ❌ Token invalid (HTTP', response.status + ')');
                console.log('[TokenVerifier] JWT Type/Prefix:', 'Bearer');
                console.log('[TokenVerifier] Error response:', errorText);
                return {
                    valid: false,
                    reason: 'INVALID_TOKEN',
                    status: response.status,
                    error: `HTTP ${response.status}`
                };
            }

            const data = await response.json();
            console.log('[TokenVerifier] Response data received:', {
                success: data.success,
                authenticated: data.authenticated,
                hasUser: !!data.user,
                tokenType: data.tokenType,
                expiresIn: data.expiresIn
            });

            if (!data.success || !data.authenticated) {
                console.log('[TokenVerifier] ❌ Token not authenticated');
                return {
                    valid: false,
                    reason: 'NOT_AUTHENTICATED',
                    error: data.error || 'Not authenticated'
                };
            }

            console.log('[TokenVerifier] ✅ Token verified successfully');
            console.log('[TokenVerifier] User:', data.user?.email);
            console.log('[TokenVerifier] Expires in:', data.expiresIn, 'seconds');

            return {
                valid: true,
                user: data.user,
                tokenType: data.tokenType,
                expiresIn: data.expiresIn,
                expiresAt: Date.now() + (data.expiresIn * 1000)
            };
        } catch (error) {
            console.error('[TokenVerifier] ❌ Verification error:', error.message);
            console.error('[TokenVerifier] Error stack:', error.stack);

            let reason = 'VERIFICATION_ERROR';
            if (error.message.includes('timeout')) {
                reason = 'TIMEOUT';
            } else if (error.message.includes('Failed to fetch')) {
                reason = 'NETWORK_ERROR';
            }

            return {
                valid: false,
                reason: reason,
                error: error.message
            };
        }
    }

    /**
     * Get token from storage
     */
    static getStoredToken() {
        return new Promise((resolve) => {
            console.log('[TokenVerifier] 🔍 Looking for token in chrome.storage.sync...');
            
            chrome.storage.sync.get(['jobOrbitAuth'], (syncResult) => {
                console.log('[TokenVerifier] Sync storage result:', {
                    found: !!syncResult.jobOrbitAuth,
                    hasExtensionToken: !!syncResult.jobOrbitAuth?.extensionToken,
                    keys: Object.keys(syncResult)
                });
                
                if (syncResult.jobOrbitAuth?.extensionToken) {
                    console.log('[TokenVerifier] ✅ Found token in sync storage');
                    resolve(syncResult.jobOrbitAuth.extensionToken);
                    return;
                }

                // Fallback to local storage
                console.log('[TokenVerifier] ❌ Not in sync, checking local storage...');
                chrome.storage.local.get(['jobOrbitAuth'], (localResult) => {
                    console.log('[TokenVerifier] Local storage result:', {
                        found: !!localResult.jobOrbitAuth,
                        hasExtensionToken: !!localResult.jobOrbitAuth?.extensionToken,
                        keys: Object.keys(localResult)
                    });
                    
                    if (localResult.jobOrbitAuth?.extensionToken) {
                        console.log('[TokenVerifier] ✅ Found token in local storage');
                        resolve(localResult.jobOrbitAuth.extensionToken);
                    } else {
                        console.log('[TokenVerifier] ❌ No token found in either storage');
                        resolve(null);
                    }
                });
            });
        });
    }

    /**
     * Clear stored token
     */
    static async clearToken() {
        console.warn("[AUTH] Session deletion initiated from TokenVerifier.clearToken");
        console.trace();
        const stored = await new Promise(r => chrome.storage.local.get(null, r));
        console.log("[AUTH] Storage before deletion:", stored);
        
        return new Promise((resolve) => {
            chrome.storage.sync.remove(['jobOrbitAuth'], () => {
                chrome.storage.local.remove(['jobOrbitAuth'], () => {
                    console.log('[TokenVerifier] 🗑️ Token cleared');
                    resolve();
                });
            });
        });
    }

    /**
     * Update stored token with new expiration
     */
    static updateTokenExpiration(token, expiresInSeconds) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
                if (result.jobOrbitAuth) {
                    result.jobOrbitAuth.expiresAt = Date.now() + (expiresInSeconds * 1000);
                    result.jobOrbitAuth.extensionToken = token;
                    result.jobOrbitAuth.lastVerifiedAt = new Date().toISOString();

                    chrome.storage.sync.set({ jobOrbitAuth: result.jobOrbitAuth }, () => {
                        console.log('[TokenVerifier] ✅ Token expiration updated');
                        resolve(true);
                    });
                } else {
                    resolve(false);
                }
            });
        });
    }

    /**
     * Check token freshness
     * Returns true if token needs refresh
     */
    static isTokenStale(expiresAt) {
        if (!expiresAt) return true;

        const now = Date.now();
        const timeToExpiry = expiresAt - now;
        const oneHourInMs = 60 * 60 * 1000;

        // Token is stale if expiring within 1 hour
        return timeToExpiry < oneHourInMs;
    }

    /**
     * Full verification flow
     * 1. Get stored token
     * 2. Verify with backend
     * 3. Handle results
     */
    static async fullVerification() {
        console.log('[TokenVerifier] 🔄 Starting full verification flow...');
        console.log('[TokenVerifier] ⏰ Timestamp:', new Date().toISOString());

        const token = await this.getStoredToken();

        if (!token) {
            console.log('[TokenVerifier] ❌ No token in storage - user not authenticated');
            return {
                authenticated: false,
                reason: 'NO_TOKEN'
            };
        }

        console.log('[TokenVerifier] ✅ Found token in storage, length:', token.length);
        console.log('[TokenVerifier] Token preview:', token.substring(0, 30) + '...');

        const result = await this.verifyToken(token);

        if (result.valid) {
            console.log('[TokenVerifier] ✅ Full verification PASSED');
            console.log('[TokenVerifier] User authenticated:', result.user?.email);
            console.log('[TokenVerifier] Token expires in:', result.expiresIn, 'seconds');
            
            return {
                authenticated: true,
                user: result.user,
                tokenType: result.tokenType,
                expiresIn: result.expiresIn,
                isStale: this.isTokenStale(result.expiresAt)
            };
        } else {
            console.log('[TokenVerifier] ❌ Full verification FAILED:', result.reason);
            console.log('[TokenVerifier] Error details:', result.error);
            
            // Clear invalid token
            await this.clearToken();

            return {
                authenticated: false,
                reason: result.reason,
                error: result.error
            };
        }
    }
}

// Export for use in popup
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenVerifier;
}
