/**
 * Storage Cleanup Migration
 * Removes duplicate and legacy auth keys
 * Consolidates storage to clean schema
 * Runs once on extension load
 */

class StorageCleanup {
    static MIGRATION_VERSION = 1;
    static MIGRATION_KEY = 'storageCleanupVersion';

    /**
     * Run cleanup if needed
     */
    static async run() {
        try {
            const version = await this.getMigrationVersion();
            
            if (version >= this.MIGRATION_VERSION) {
                console.log('[StorageCleanup] Already at version', version, '- skipping');
                return;
            }

            console.log('[StorageCleanup] ✅ Running migration from version', version, 'to', this.MIGRATION_VERSION);
            
            // Backup current data
            const backup = await this.backupStorage();
            console.log('[StorageCleanup] 💾 Backup created');

            // Remove legacy/duplicate keys
            await this.removeUnusedKeys();
            console.log('[StorageCleanup] 🗑️ Removed unused keys');

            // Consolidate auth keys
            await this.consolidateAuthKeys();
            console.log('[StorageCleanup] 🔄 Consolidated auth keys');

            // Update migration version
            await this.setMigrationVersion(this.MIGRATION_VERSION);
            console.log('[StorageCleanup] ✅ Migration complete - version', this.MIGRATION_VERSION);

        } catch (error) {
            console.error('[StorageCleanup] ❌ Migration failed:', error.message);
            // Don't throw - let extension continue even if migration fails
        }
    }

    /**
     * Get current migration version
     */
    static async getMigrationVersion() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.MIGRATION_KEY], (result) => {
                resolve(result[this.MIGRATION_KEY] || 0);
            });
        });
    }

    /**
     * Set migration version
     */
    static async setMigrationVersion(version) {
        return new Promise(resolve => {
            chrome.storage.local.set({ [this.MIGRATION_KEY]: version }, () => {
                resolve();
            });
        });
    }

    /**
     * Backup current storage state
     */
    static async backupStorage() {
        return new Promise(resolve => {
            chrome.storage.local.get(null, (result) => {
                chrome.storage.local.set({ 
                    _storageBackup: {
                        timestamp: new Date().toISOString(),
                        data: result
                    }
                }, () => {
                    resolve(result);
                });
            });
        });
    }

    /**
     * Remove unused/legacy keys
     */
    static async removeUnusedKeys() {
        const legacyKeys = [
            'supabaseUser',      // Old auth key
            'guestUser',         // Old guest key
            'auth_tokens',       // Alternative auth key (unused)
            'userProfile'        // Old profile format
        ];

        return new Promise(resolve => {
            // Remove from sync storage
            chrome.storage.sync.remove(legacyKeys, () => {
                console.log('[StorageCleanup] Removed from sync:', legacyKeys);
                
                // Remove from local storage
                chrome.storage.local.remove(legacyKeys, () => {
                    console.log('[StorageCleanup] Removed from local:', legacyKeys);
                    resolve();
                });
            });
        });
    }

    /**
     * Consolidate auth keys to single source
     */
    static async consolidateAuthKeys() {
        return new Promise(resolve => {
            // Get all auth-related keys from both storages
            chrome.storage.sync.get(['jobOrbitAuth', 'jobOrbitSession', 'extensionToken', 'expiresAt', 'isLoggedIn'], (syncResult) => {
                chrome.storage.local.get(['jobOrbitAuth', 'jobOrbitSession', 'extensionToken', 'expiresAt', 'isLoggedIn'], (localResult) => {
                    
                    // Prefer jobOrbitSession as authoritative (it has all data)
                    let sessionData = syncResult.jobOrbitSession || localResult.jobOrbitSession;
                    
                    // If no session but auth data exists, migrate it
                    if (!sessionData && (syncResult.jobOrbitAuth || localResult.jobOrbitAuth)) {
                        const authData = syncResult.jobOrbitAuth || localResult.jobOrbitAuth;
                        sessionData = {
                            extensionToken: authData.extensionToken,
                            tokenType: authData.tokenType || 'Bearer',
                            expiresAt: authData.expiresAt || syncResult.expiresAt || localResult.expiresAt,
                            user: authData.user || {},
                            createdAt: authData.receivedAt || new Date().toISOString(),
                            lastVerifiedAt: new Date().toISOString(),
                            cachedProfile: {},
                            cachedResumes: [],
                            cachedApplications: [],
                            cachedAnswers: [],
                            cachedSettings: {}
                        };
                    }

                    if (!sessionData) {
                        console.log('[StorageCleanup] No auth data found to consolidate');
                        resolve();
                        return;
                    }

                    // Keep only jobOrbitSession, remove the rest
                    const consolidatedData = { jobOrbitSession: sessionData };
                    const keysToRemove = ['jobOrbitAuth', 'extensionToken', 'expiresAt', 'isLoggedIn'];

                    // Save consolidated data
                    chrome.storage.sync.set(consolidatedData, () => {
                        chrome.storage.local.set(consolidatedData, () => {
                            // Remove old keys
                            chrome.storage.local.get(null, (stored) => {
                                console.warn("[AUTH] Session deletion");
                                console.trace();
                                console.log("[AUTH] Storage before deletion:", stored);
                                chrome.storage.sync.remove(keysToRemove, () => {
                                    chrome.storage.local.remove(keysToRemove, () => {
                                        console.log('[StorageCleanup] Auth data consolidated to jobOrbitSession');
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Verify storage integrity after cleanup
     */
    static async verifyStorage() {
        return new Promise(resolve => {
            chrome.storage.sync.get(null, (syncData) => {
                chrome.storage.local.get(null, (localData) => {
                    const syncKeys = Object.keys(syncData);
                    const localKeys = Object.keys(localData);

                    console.log('[StorageCleanup] Sync storage keys:', syncKeys.length, syncKeys);
                    console.log('[StorageCleanup] Local storage keys:', localKeys.length, localKeys);

                    // Check for legacy keys
                    const legacyKeys = ['supabaseUser', 'guestUser', 'auth_tokens'];
                    const foundLegacy = [
                        ...syncKeys.filter(k => legacyKeys.includes(k)),
                        ...localKeys.filter(k => legacyKeys.includes(k))
                    ];

                    if (foundLegacy.length > 0) {
                        console.warn('[StorageCleanup] ⚠️ Found legacy keys still present:', foundLegacy);
                    } else {
                        console.log('[StorageCleanup] ✅ No legacy keys found');
                    }

                    resolve({
                        syncKeyCount: syncKeys.length,
                        localKeyCount: localKeys.length,
                        legacyKeysFound: foundLegacy
                    });
                });
            });
        });
    }
}

// Auto-run on load if in background context
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('[StorageCleanup] Initializing...');
    StorageCleanup.run().catch(error => {
        console.error('[StorageCleanup] Error during init:', error);
    });
}
