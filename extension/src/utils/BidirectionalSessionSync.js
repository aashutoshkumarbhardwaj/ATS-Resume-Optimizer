/**
 * Bidirectional Session Synchronization
 * Syncs authentication state between Job Orbit website and Chrome Extension
 * Ensures single login across all surfaces (website, extension, multiple tabs)
 */

class BidirectionalSessionSync {
    // Storage keys for session state
    static SESSION_KEYS = {
        EXTENSION_SESSION: 'extension_session',
        WEBSITE_SESSION: 'website_session',
        LAST_SYNC: 'session_sync_timestamp'
    };

    // Message types for cross-communication
    static MESSAGE_TYPES = {
        AUTH_CHANGED: 'AUTH_CHANGED',
        SESSION_SYNC_REQUEST: 'SESSION_SYNC_REQUEST',
        SESSION_SYNC_RESPONSE: 'SESSION_SYNC_RESPONSE',
        TOKEN_REFRESHED: 'TOKEN_REFRESHED',
        LOGOUT_REQUESTED: 'LOGOUT_REQUESTED'
    };

    /**
     * Initialize bidirectional sync
     * Call once on extension startup
     */
    static async initialize() {
        try {
            // Listen for messages from content scripts (website)
            chrome.runtime.onMessage.addListener(
                BidirectionalSessionSync.handleMessage
            );

            // Listen for storage changes from other tabs
            chrome.storage.onChanged.addListener(
                BidirectionalSessionSync.handleStorageChange
            );

            console.log('[Session Sync] Initialized');
            return true;
        } catch (error) {
            console.error('[Session Sync] Init failed:', error);
            return false;
        }
    }

    /**
     * Handle incoming messages from content scripts
     */
    static handleMessage = async (message, sender, sendResponse) => {
        try {
            switch (message.type) {
                case BidirectionalSessionSync.MESSAGE_TYPES.AUTH_CHANGED:
                    await BidirectionalSessionSync.handleAuthChanged(message);
                    sendResponse({ success: true });
                    break;

                case BidirectionalSessionSync.MESSAGE_TYPES.SESSION_SYNC_REQUEST:
                    const sessionData = await BidirectionalSessionSync.getSessionData();
                    sendResponse({ success: true, session: sessionData });
                    break;

                case BidirectionalSessionSync.MESSAGE_TYPES.LOGOUT_REQUESTED:
                    await BidirectionalSessionSync.handleLogoutRequest();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('[Session Sync] Message handling error:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    /**
     * Handle auth change from website
     */
    static async handleAuthChanged(message) {
        try {
            const { tokens, user_info } = message;

            if (tokens) {
                // Website user logged in - sync to extension
                console.log('[Session Sync] Website login detected, syncing...');
                await chrome.storage.sync.set({
                    auth_tokens: {
                        encrypted: true,
                        token_data: tokens,
                        timestamp: new Date().toISOString()
                    }
                });

                // Broadcast to extension UI that auth changed
                chrome.runtime.sendMessage({
                    type: 'AUTH_STATE_CHANGED',
                    authenticated: true,
                    user: user_info
                }).catch(() => {}); // Ignore if popup not open
            }

            // Update sync timestamp
            await chrome.storage.local.set({
                [BidirectionalSessionSync.SESSION_KEYS.LAST_SYNC]: new Date().getTime()
            });
        } catch (error) {
            console.error('[Session Sync] Handle auth change failed:', error);
        }
    }

    /**
     * Handle logout request from website
     */
    static async handleLogoutRequest() {
        try {
            console.log('[Session Sync] Website logout detected, syncing...');
            
            // Clear tokens
            await chrome.storage.sync.remove('auth_tokens');
            
            // Update sync timestamp
            await chrome.storage.local.set({
                [BidirectionalSessionSync.SESSION_KEYS.LAST_SYNC]: new Date().getTime()
            });

            // Broadcast to extension UI
            chrome.runtime.sendMessage({
                type: 'AUTH_STATE_CHANGED',
                authenticated: false
            }).catch(() => {});
        } catch (error) {
            console.error('[Session Sync] Handle logout failed:', error);
        }
    }

    /**
     * Handle storage changes (from other tabs/extension pages)
     */
    static handleStorageChange = async (changes, area) => {
        try {
            if (area !== 'sync') return;

            if (changes.auth_tokens) {
                // Auth token changed in storage
                const newValue = changes.auth_tokens.newValue;
                const oldValue = changes.auth_tokens.oldValue;

                if (newValue && !oldValue) {
                    // User logged in
                    console.log('[Session Sync] Login detected via storage change');
                    chrome.runtime.sendMessage({
                        type: 'AUTH_STATE_CHANGED',
                        authenticated: true
                    }).catch(() => {});
                } else if (!newValue && oldValue) {
                    // User logged out
                    console.log('[Session Sync] Logout detected via storage change');
                    chrome.runtime.sendMessage({
                        type: 'AUTH_STATE_CHANGED',
                        authenticated: false
                    }).catch(() => {});
                }
            }
        } catch (error) {
            console.error('[Session Sync] Storage change handler error:', error);
        }
    };

    /**
     * Notify website about extension login
     * Call from extension when user logs in via extension
     */
    static async notifyWebsiteOfLogin(tokenData, userInfo) {
        try {
            // Save to session storage that website can read
            await chrome.storage.local.set({
                extension_login_signal: {
                    tokens: tokenData,
                    user_info: userInfo,
                    timestamp: new Date().toISOString()
                }
            });

            // Try to send message to content scripts in all tabs
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                if (tab.url && (tab.url.includes('job-orbit') || tab.url.includes('localhost'))) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: BidirectionalSessionSync.MESSAGE_TYPES.AUTH_CHANGED,
                        source: 'extension',
                        tokens: tokenData,
                        user_info: userInfo
                    }).catch(() => {}); // Ignore if content script not ready
                }
            });

            console.log('[Session Sync] Website notified of extension login');
            return true;
        } catch (error) {
            console.error('[Session Sync] Notify website failed:', error);
            return false;
        }
    }

    /**
     * Notify website about extension logout
     */
    static async notifyWebsiteOfLogout() {
        try {
            // Clear login signal
            await chrome.storage.local.remove('extension_login_signal');

            // Notify all tabs
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                if (tab.url && (tab.url.includes('job-orbit') || tab.url.includes('localhost'))) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: BidirectionalSessionSync.MESSAGE_TYPES.LOGOUT_REQUESTED,
                        source: 'extension'
                    }).catch(() => {});
                }
            });

            console.log('[Session Sync] Website notified of extension logout');
            return true;
        } catch (error) {
            console.error('[Session Sync] Notify logout failed:', error);
            return false;
        }
    }

    /**
     * Get current session data
     */
    static async getSessionData() {
        try {
            const storage = await chrome.storage.sync.get('auth_tokens');
            return {
                authenticated: !!storage.auth_tokens,
                tokens: storage.auth_tokens || null,
                timestamp: new Date().getTime()
            };
        } catch (error) {
            console.error('[Session Sync] Get session data failed:', error);
            return {
                authenticated: false,
                tokens: null,
                error: error.message
            };
        }
    }

    /**
     * Sync session with website
     * Call periodically or on app focus to ensure consistency
     */
    static async syncWithWebsite() {
        try {
            // Query website tab
            const tabs = await chrome.tabs.query({
                url: '*://*.job-orbit.com/*'
            });

            if (tabs.length === 0) return false;

            // Get current session
            const sessionData = await BidirectionalSessionSync.getSessionData();

            // Send sync request to website
            for (const tab of tabs) {
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        type: BidirectionalSessionSync.MESSAGE_TYPES.SESSION_SYNC_REQUEST,
                        extension_session: sessionData
                    });

                    if (response.success) {
                        console.log('[Session Sync] Synced with website');
                        return true;
                    }
                } catch (error) {
                    // Tab might not have content script
                    continue;
                }
            }

            return false;
        } catch (error) {
            console.error('[Session Sync] Website sync failed:', error);
            return false;
        }
    }

    /**
     * Check if session is valid and synced
     */
    static async isSessionValid() {
        try {
            const session = await BidirectionalSessionSync.getSessionData();
            return session.authenticated;
        } catch (error) {
            console.error('[Session Sync] Session validity check failed:', error);
            return false;
        }
    }

    /**
     * Get time since last sync
     */
    static async getTimeSinceLastSync() {
        try {
            const data = await chrome.storage.local.get(
                BidirectionalSessionSync.SESSION_KEYS.LAST_SYNC
            );
            
            const lastSync = data[BidirectionalSessionSync.SESSION_KEYS.LAST_SYNC];
            if (!lastSync) return Infinity;

            return Date.now() - lastSync;
        } catch (error) {
            console.error('[Session Sync] Get time since last sync failed:', error);
            return Infinity;
        }
    }

    /**
     * Force resync
     */
    static async forceResync() {
        try {
            console.log('[Session Sync] Force resyncing...');
            await BidirectionalSessionSync.syncWithWebsite();
            
            await chrome.storage.local.set({
                [BidirectionalSessionSync.SESSION_KEYS.LAST_SYNC]: new Date().getTime()
            });

            return true;
        } catch (error) {
            console.error('[Session Sync] Force resync failed:', error);
            return false;
        }
    }
}

// Export for use in background scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BidirectionalSessionSync;
}
