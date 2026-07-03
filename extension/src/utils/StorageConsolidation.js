/**
 * Storage Consolidation Utility
 * Ensures all token and session data uses a single authoritative storage key
 * SINGLE SOURCE OF TRUTH: jobOrbitSession
 * 
 * This prevents data inconsistency, race conditions, and lost updates
 * All other keys are deprecated and should be cleaned up during first run
 */

class StorageConsolidation {
    /**
     * Primary storage key - single source of truth
     */
    static AUTHORITATIVE_KEY = 'jobOrbitSession';

    /**
     * Legacy keys to clean up (deprecated)
     */
    static DEPRECATED_KEYS = [
        'jobOrbitAuth',
        'extensionToken',
        'expiresAt',
        'isLoggedIn',
        'supabaseUser',
        'guestUser',
        'auth_tokens'
    ];

    /**
     * Get session from storage with fallback chain
     * Tries sync first, then local, then legacy keys
     * @returns {Promise} { session, source }
     */
    static async getSession() {
        return new Promise((resolve) => {
            // Step 1: Try primary key in sync storage
            chrome.storage.sync.get([this.AUTHORITATIVE_KEY], (syncResult) => {
                if (chrome.runtime.lastError) {
                    console.warn('[StorageConsolidation] Sync read error:', chrome.runtime.lastError.message);
                }

                if (syncResult[this.AUTHORITATIVE_KEY]) {
                    console.log('[StorageConsolidation] ✅ Session found in sync storage');
                    resolve({ session: syncResult[this.AUTHORITATIVE_KEY], source: 'sync' });
                    return;
                }

                // Step 2: Try primary key in local storage
                chrome.storage.local.get([this.AUTHORITATIVE_KEY], (localResult) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[StorageConsolidation] Local read error:', chrome.runtime.lastError.message);
                    }

                    if (localResult[this.AUTHORITATIVE_KEY]) {
                        console.log('[StorageConsolidation] ✅ Session found in local storage');
                        // Promote to sync
                        chrome.storage.sync.set({ [this.AUTHORITATIVE_KEY]: localResult[this.AUTHORITATIVE_KEY] });
                        resolve({ session: localResult[this.AUTHORITATIVE_KEY], source: 'local' });
                        return;
                    }

                    // Step 3: Try legacy keys for migration
                    this._tryLegacyKeys((legacySession) => {
                        if (legacySession) {
                            console.log('[StorageConsolidation] ⚠️ Migrating session from legacy storage');
                            // Save to primary key
                            this.saveSession(legacySession);
                            resolve({ session: legacySession, source: 'legacy' });
                        } else {
                            console.log('[StorageConsolidation] ❌ No session found');
                            resolve({ session: null, source: 'none' });
                        }
                    });
                });
            });
        });
    }

    /**
     * Save session to storage (both sync and local for redundancy)
     * @param {Object} session - Session object
     */
    static async saveSession(session) {
        if (!session || !session.extensionToken) {
            console.error('[StorageConsolidation] ❌ Invalid session - missing token');
            return { success: false, error: 'Invalid session' };
        }

        return new Promise((resolve) => {
            const data = { [this.AUTHORITATIVE_KEY]: session };

            // Save to sync storage (primary)
            chrome.storage.sync.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('[StorageConsolidation] Failed to save to sync:', chrome.runtime.lastError.message);
                    // Fallback to local only
                    chrome.storage.local.set(data, () => {
                        console.log('[StorageConsolidation] ✅ Session saved to local (sync failed)');
                        resolve({ success: true, source: 'local' });
                    });
                    return;
                }

                // Also save to local as backup
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[StorageConsolidation] Warning: Local backup failed');
                    } else {
                        console.log('[StorageConsolidation] ✅ Session saved to sync and local');
                    }
                    resolve({ success: true, source: 'both' });
                });
            });
        });
    }

    /**
     * Clear session from storage
     */
    static async clearSession() {
        return new Promise((resolve) => {
            const keys = [this.AUTHORITATIVE_KEY, ...this.DEPRECATED_KEYS];

            // Clear from sync storage
            chrome.storage.sync.remove(keys, () => {
                // Clear from local storage
                chrome.storage.local.remove(keys, () => {
                    console.log('[StorageConsolidation] ✅ Session and all legacy keys cleared');
                    resolve({ success: true });
                });
            });
        });
    }

    /**
     * Try to find session in legacy storage keys
     * @private
     */
    static _tryLegacyKeys(callback) {
        const allDeprecatedKeys = [...this.DEPRECATED_KEYS, 'jobOrbitAuth', 'jobOrbitSession'];

        chrome.storage.sync.get(allDeprecatedKeys, (syncResult) => {
            // Try sync storage first
            for (const key of allDeprecatedKeys) {
                if (syncResult[key]) {
                    const session = this._normalizeSession(syncResult[key], key);
                    if (session) {
                        callback(session);
                        return;
                    }
                }
            }

            // Try local storage
            chrome.storage.local.get(allDeprecatedKeys, (localResult) => {
                for (const key of allDeprecatedKeys) {
                    if (localResult[key]) {
                        const session = this._normalizeSession(localResult[key], key);
                        if (session) {
                            callback(session);
                            return;
                        }
                    }
                }

                callback(null);
            });
        });
    }

    /**
     * Normalize legacy session format to current format
     * @private
     */
    static _normalizeSession(data, sourceKey) {
        try {
            // If it's already a proper session object
            if (data && typeof data === 'object') {
                // Has extensionToken or token field
                if (data.extensionToken || data.token) {
                    return {
                        extensionToken: data.extensionToken || data.token,
                        expiresAt: data.expiresAt || Date.now() + 86400000,
                        user: data.user || null,
                        tokenType: data.tokenType || 'Bearer',
                        createdAt: data.createdAt || new Date().toISOString(),
                        expiresIn: data.expiresIn || 3600
                    };
                }

                // If it's a supabaseUser object
                if (sourceKey === 'supabaseUser' && data.email) {
                    return {
                        extensionToken: data.id || null,
                        expiresAt: Date.now() + 86400000,
                        user: { email: data.email },
                        tokenType: 'Bearer',
                        createdAt: new Date().toISOString(),
                        expiresIn: 86400
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('[StorageConsolidation] Error normalizing session:', error);
            return null;
        }
    }

    /**
     * Verify storage integrity
     * Checks for duplicate keys and consolidates if needed
     */
    static async verifyAndConsolidate() {
        return new Promise((resolve) => {
            const allKeys = [this.AUTHORITATIVE_KEY, ...this.DEPRECATED_KEYS];

            chrome.storage.sync.get(allKeys, (syncResult) => {
                chrome.storage.local.get(allKeys, (localResult) => {
                    const report = {
                        syncKeys: Object.keys(syncResult).filter(k => syncResult[k]),
                        localKeys: Object.keys(localResult).filter(k => localResult[k]),
                        authoritative: !!syncResult[this.AUTHORITATIVE_KEY] || !!localResult[this.AUTHORITATIVE_KEY],
                        duplicates: [],
                        hasLegacy: false
                    };

                    // Check for duplicates
                    for (const key of this.DEPRECATED_KEYS) {
                        if ((syncResult[key] || localResult[key]) && report.authoritative) {
                            report.duplicates.push(key);
                            report.hasLegacy = true;
                        }
                    }

                    // If we have duplicates and authoritative exists, clean up
                    if (report.hasLegacy && report.authoritative) {
                        console.log('[StorageConsolidation] 🧹 Cleaning up duplicate keys:', report.duplicates);
                        chrome.storage.sync.remove(report.duplicates);
                        chrome.storage.local.remove(report.duplicates);
                    }

                    resolve(report);
                });
            });
        });
    }
}
