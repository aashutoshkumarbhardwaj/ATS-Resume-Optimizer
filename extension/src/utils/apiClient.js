/**
 * API Client with Automatic Retry & Token Refresh
 * Handles 401 errors transparently by refreshing token and retrying
 */

class APIClient {
    constructor() {
        this.BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
        this.REQUEST_TIMEOUT = 30000; // 30 seconds
        this.MAX_RETRIES = 1; // Retry once on 401
    }

    /**
     * Make authenticated API request with 401 retry
     * @param {string} endpoint - API endpoint path (e.g., '/resume/parse')
     * @param {Object} options - Request options { method, body, headers }
     * @returns {Promise} Response data
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
                throw new Error('No authentication token available');
            }

            // Build request with AbortController for timeout
            const url = `${this.BASE_URL}${endpoint}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

            const init = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                },
                signal: controller.signal
            };

            if (body) {
                init.body = typeof body === 'string' ? body : JSON.stringify(body);
            }

            // Make request
            let response;
            try {
                response = await fetch(url, init);
            } finally {
                clearTimeout(timeout);
            }

            // Handle 401 - retry with fresh token
            if (response.status === 401 && retryCount < this.MAX_RETRIES) {
                console.log('[APIClient] 🔄 Got 401, refreshing token and retrying...');
                
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // Retry with incremented count
                    options.retryCount = retryCount + 1;
                    return this.request(endpoint, options);
                } else {
                    console.error('[APIClient] ❌ Token refresh failed, giving up');
                    throw new Error('Token refresh failed after 401');
                }
            }

            // Check other errors
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[APIClient] ❌ ${response.status}:`, errorText.substring(0, 200));
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Parse response
            const data = await response.json();
            console.log(`[APIClient] ✅ ${method} ${endpoint} - Success`);
            return data;

        } catch (error) {
            console.error(`[APIClient] ❌ Request failed:`, error.message);
            throw error;
        }
    }

    /**
     * Get current token from storage
     */
    async getToken() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['jobOrbitSession'], result => {
                if (chrome.runtime.lastError) {
                    console.warn('[APIClient] Sync error:', chrome.runtime.lastError.message);
                }
                if (result.jobOrbitSession?.extensionToken) {
                    resolve({ token: result.jobOrbitSession.extensionToken });
                    return;
                }
                
                chrome.storage.local.get(['jobOrbitSession'], localResult => {
                    if (chrome.runtime.lastError) {
                        console.warn('[APIClient] Local error:', chrome.runtime.lastError.message);
                    }
                    resolve({ token: localResult.jobOrbitSession?.extensionToken || null });
                });
            });
        });
    }

    /**
     * Refresh token via backend
     */
    async refreshToken() {
        try {
            const { token } = await this.getToken();
            if (!token) {
                console.error('[APIClient] No token to refresh');
                return false;
            }

            console.log('[APIClient] 🔄 Refreshing token...');

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

            let response;
            try {
                response = await fetch(`${this.BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                console.error('[APIClient] Token refresh failed, HTTP', response.status);
                return false;
            }

            const data = await response.json();
            if (!data.access_token) {
                console.error('[APIClient] No token in refresh response');
                return false;
            }

            // Update session with new token
            const session = await this.getSessionFromStorage();
            if (!session) {
                console.error('[APIClient] No session to update');
                return false;
            }

            session.extensionToken = data.access_token;
            session.expiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
            session.lastRefreshAt = new Date().toISOString();

            await this.saveSessionToStorage(session);
            console.log('[APIClient] ✅ Token refreshed successfully');
            return true;

        } catch (error) {
            console.error('[APIClient] Refresh error:', error.message);
            return false;
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
                    return;
                }
                chrome.storage.local.get(['jobOrbitSession'], localResult => {
                    resolve(localResult.jobOrbitSession || null);
                });
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
}

// Global instance
const apiClient = new APIClient();
