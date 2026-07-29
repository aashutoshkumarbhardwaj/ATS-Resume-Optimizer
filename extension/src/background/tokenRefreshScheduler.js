/**
 * Token Refresh Scheduler
 * Automatically refreshes auth token before expiration
 * Runs in background service worker
 */

class TokenRefreshScheduler {
    constructor() {
        this.refreshTimerId = null;
        this.isRefreshing = false;
        this.REFRESH_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
        this.REFRESH_BUFFER = 10 * 60 * 1000; // Refresh 10 mins before expiry
        this.API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
    }

    /**
     * Static initialize method - called from service worker
     */
    static initialize() {
        if (typeof tokenRefreshScheduler !== 'undefined' && tokenRefreshScheduler) {
            tokenRefreshScheduler.start();
        } else {
            console.error('[TokenRefresh] Global instance not available');
        }
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

            console.log('[AUTH] Current expiresAt:', session.expiresAt);
            console.log('[AUTH] Current Date.now():', now);
            console.log('[AUTH] Calculated timeToExpiry:', timeToExpiry);

            // If expires in < 10 minutes, refresh now
            if (timeToExpiry < timeToRefresh) {
                console.log('[AUTH] Refresh starts: YES');
                console.log('[TokenRefresh] ⚠️ Token expiring soon, refreshing...');
                await this.refreshToken(session);
            } else {
                console.log('[TokenRefresh] Token still valid, expires in:', Math.round(timeToExpiry / 1000), 'seconds');
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
            console.log('[TokenRefresh] 🔄 Making refresh request...');
            
            const response = await fetch(`${this.API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.extensionToken}`
                },
                timeout: 10000
            });

            if (!response.ok) {
                const responseBody = await response.text().catch(() => 'Failed to read body');
                console.error('[AUTH] Backend response HTTP:', response.status);
                console.error('[AUTH] Backend response body:', responseBody);
                
                if (response.status === 401 || response.status === 403) {
                    console.log('[AUTH] clearSession() executes: YES');
                    console.log('[TokenRefresh] Token invalid, logging out...');
                    await this.clearSession();
                } else {
                    console.log('[AUTH] clearSession() executes: NO');
                }
                this.isRefreshing = false;
                return;
            }

            const data = await response.json();

            if (!data.success || !data.access_token) {
                console.error('[TokenRefresh] ❌ Invalid refresh response');
                this.isRefreshing = false;
                return;
            }

            // Update session with new token
            session.extensionToken = data.access_token;
            session.expiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
            session.lastRefreshAt = new Date().toISOString();

            await this.saveSessionToStorage(session);
            console.log('[TokenRefresh] ✅ Token refreshed, new expiry:', new Date(session.expiresAt).toISOString());

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
                if (chrome.runtime.lastError) {
                    console.warn('[TokenRefresh] Sync error:', chrome.runtime.lastError.message);
                }
                if (result.jobOrbitSession) {
                    resolve(result.jobOrbitSession);
                    return;
                }
                chrome.storage.local.get(['jobOrbitSession'], localResult => {
                    if (chrome.runtime.lastError) {
                        console.warn('[TokenRefresh] Local error:', chrome.runtime.lastError.message);
                    }
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
                if (chrome.runtime.lastError) {
                    console.warn('[TokenRefresh] Sync save error:', chrome.runtime.lastError.message);
                }
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[TokenRefresh] Local save error:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            });
        });
    }

    /**
     * Clear session (logout)
     */
    async clearSession() {
        console.warn("[AUTH] Session deletion");
        console.trace();
        const stored = await new Promise(r => chrome.storage.local.get(null, r));
        console.log("[AUTH] Storage before deletion:", stored);
        return new Promise(resolve => {
            const keys = ['jobOrbitSession', 'jobOrbitAuth', 'extensionToken', 'expiresAt', 'isLoggedIn'];
            chrome.storage.sync.remove(keys, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[TokenRefresh] Sync clear error:', chrome.runtime.lastError.message);
                }
                chrome.storage.local.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[TokenRefresh] Local clear error:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            });
        });
    }
}

// Global instance
const tokenRefreshScheduler = new TokenRefreshScheduler();
