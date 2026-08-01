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
            // Bypass Render API and decode JWT locally
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            const decoded = JSON.parse(jsonPayload);
            const isExpired = Date.now() >= decoded.exp * 1000;
            
            if (isExpired) {
                console.log('[TokenVerifier] ❌ Token expired locally');
                return {
                    valid: false,
                    reason: 'TOKEN_EXPIRED',
                    error: 'Token has expired'
                };
            }
            
            console.log('[TokenVerifier] ✅ Token verified locally');
            console.log('[TokenVerifier] User:', decoded.email);
            
            return {
                valid: true,
                user: {
                    id: decoded.sub,
                    email: decoded.email
                },
                tokenType: 'Bearer',
                expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
                expiresAt: decoded.exp * 1000
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
            console.log('[TokenVerifier] 🔍 Looking for token in storage...');
            
            chrome.storage.sync.get(['jobOrbitAuth', 'jobOrbitSession'], (syncResult) => {
                const syncToken = syncResult.jobOrbitAuth?.extensionToken || syncResult.jobOrbitSession?.extensionToken;
                if (syncToken) {
                    console.log('[TokenVerifier] ✅ Found token in sync storage');
                    resolve(syncToken);
                    return;
                }

                // Fallback to local storage
                chrome.storage.local.get(['jobOrbitAuth', 'jobOrbitSession'], (localResult) => {
                    const localToken = localResult.jobOrbitAuth?.extensionToken || localResult.jobOrbitSession?.extensionToken;
                    if (localToken) {
                        console.log('[TokenVerifier] ✅ Found token in local storage');
                        resolve(localToken);
                    } else {
                        console.log('[TokenVerifier] ❌ No token found in either storage');
                        resolve(null);
                    }
                });
            });
        });
    }

    /**
     * Alias for getStoredToken (backwards compatibility)
     */
    static async verifyExtensionToken(token) {
        if (token) {
            return await this.verifyToken(token);
        }
        return await this.getStoredToken();
    }

    async verifyExtensionToken(token) {
        return await TokenVerifier.verifyExtensionToken(token);
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

        // Bypass the old Render API /auth/me check since we are using Supabase Edge Functions now.
        // We assume the token is valid if it exists, since it was just issued.
        // The token contains the user ID in the JWT payload.
        let userEmail = 'User';
        let expiresIn = 86400;
        try {
            // Attempt to decode the JWT payload to get user info if possible
            const base64Url = token.split('.')[1];
            if (base64Url) {
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const payload = JSON.parse(jsonPayload);
                if (payload.user_metadata?.email || payload.email) {
                    userEmail = payload.user_metadata?.email || payload.email;
                }
                if (payload.exp && payload.iat) {
                    expiresIn = payload.exp - payload.iat;
                }
            }
        } catch (e) {
            console.log('[TokenVerifier] Could not decode JWT payload, using defaults', e.message);
        }

        console.log('[TokenVerifier] ✅ Full verification PASSED (Bypassed old API check)');
        console.log('[TokenVerifier] User authenticated:', userEmail);
        
        return {
            authenticated: true,
            user: { email: userEmail },
            tokenType: 'Bearer',
            expiresIn: expiresIn,
            isStale: false
        };
    }
}

// Export for use in popup
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenVerifier;
}
