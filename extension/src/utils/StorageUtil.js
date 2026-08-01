/**
 * Storage Utilities
 * Handles all Chrome storage operations for autofill profile, analysis, and history
 * With robustness against extension context invalidation errors
 */

// Helper function to safely check if chrome API is available
const isChromeStorageAvailable = () => {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            console.warn('[StorageUtil] ⚠️ chrome.storage is unavailable');
            return false;
        }
        // Test if we can access storage without throwing
        chrome.storage.local;
        return true;
    } catch (e) {
        console.warn('[StorageUtil] ⚠️ Chrome storage access failed:', e.message);
        return false;
    }
};

const StorageUtil = {
    /**
     * Save autofill profile to storage - with guarantee of completion
     */
    saveAutofillProfile: async (profileData) => {
        return new Promise(async (resolve) => {
            try {
                if (!isChromeStorageAvailable()) {
                    console.error('[StorageUtil] ❌ Chrome storage unavailable - cannot save profile');
                    resolve({ success: false, error: 'Extension context invalidated' });
                    return;
                }

                // Save to both storages in parallel
                const syncSave = new Promise((resolveSync) => {
                    const dataToSave = {
                        autofillProfile: profileData,
                        lastSavedAt: new Date().toISOString()
                    };
                    
                    chrome.storage.sync.set(dataToSave, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('[StorageUtil] Sync storage write failed:', chrome.runtime.lastError.message);
                            resolveSync({ success: false });
                        } else {
                            console.log('[StorageUtil] Profile saved to sync storage');
                            resolveSync({ success: true });
                        }
                    });
                });
                
                const localSave = new Promise((resolveLocal) => {
                    const dataToSave = {
                        autofillProfile: profileData,
                        lastSavedAt: new Date().toISOString()
                    };
                    
                    chrome.storage.local.set(dataToSave, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('[StorageUtil] Local storage write failed:', chrome.runtime.lastError.message);
                            resolveLocal({ success: false });
                        } else {
                            console.log('[StorageUtil] Profile saved to local storage (backup)');
                            resolveLocal({ success: true });
                        }
                    });
                });
                
                // Wait for both saves to complete
                const [syncResult, localResult] = await Promise.all([syncSave, localSave]);
                
                // Verify at least one save succeeded
                if (!syncResult.success && !localResult.success) {
                    console.error('[StorageUtil] ❌ Both storage writes failed');
                    resolve({ success: false, error: 'Failed to save profile to any storage' });
                    return;
                }
                
                // Verify profile was actually saved
                const verified = await StorageUtil.verifyProfileExists();
                if (!verified.anyExists) {
                    console.error('[StorageUtil] ❌ Profile verification failed after save');
                    resolve({ success: false, error: 'Profile save failed verification' });
                    return;
                }
                
                console.log('[StorageUtil] ✅ Profile saved and verified');
                resolve({ 
                    success: true, 
                    stored: syncResult.success && localResult.success ? 'sync+local' : (syncResult.success ? 'sync' : 'local'),
                    verified: true
                });
                
            } catch (error) {
                console.error('[StorageUtil] ❌ Error saving profile:', error);
                resolve({ success: false, error: error.message });
            }
        });
    },

    /**
     * Get autofill profile from storage - checks both sync and local
     */
    getAutofillProfile: async () => {
        return new Promise((resolve) => {
            try {
                if (!isChromeStorageAvailable()) {
                    console.error('[StorageUtil] ❌ Chrome storage unavailable - cannot get profile');
                    resolve({ success: false, profile: {}, error: 'Extension context invalidated' });
                    return;
                }

                // Try sync storage first
                chrome.storage.sync.get(['autofillProfile'], (syncResult) => {
                    try {
                        if (chrome.runtime.lastError) {
                            console.warn('[StorageUtil] Sync storage read failed');
                        }
                        
                        if (syncResult && syncResult.autofillProfile) {
                            console.log('[StorageUtil] Profile loaded from sync storage');
                            resolve({ success: true, profile: syncResult.autofillProfile, source: 'sync' });
                            return;
                        }
                        
                        // Fallback to local storage
                        chrome.storage.local.get(['autofillProfile'], (localResult) => {
                            try {
                                if (localResult && localResult.autofillProfile) {
                                    console.log('[StorageUtil] Profile loaded from local storage (sync was empty)');
                                    // Re-sync to sync storage for future
                                    chrome.storage.sync.set({ autofillProfile: localResult.autofillProfile });
                                    resolve({ success: true, profile: localResult.autofillProfile, source: 'local' });
                                } else {
                                    console.log('[StorageUtil] No autofill profile found in either storage');
                                    resolve({ success: true, profile: {}, source: 'none' });
                                }
                            } catch (e) {
                                console.error('[StorageUtil] ❌ Error reading local storage:', e);
                                resolve({ success: true, profile: {}, source: 'none', error: e.message });
                            }
                        });
                    } catch (e) {
                        console.error('[StorageUtil] ❌ Error in sync storage callback:', e);
                        resolve({ success: true, profile: {}, source: 'none', error: e.message });
                    }
                });
            } catch (error) {
                console.error('[StorageUtil] ❌ Error getting profile:', error);
                resolve({ success: false, profile: {}, error: error.message });
            }
        });
    },

    /**
     * Get settings from storage
     */
    getSettings: async () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get([
                'autoStartAutofill',
                'showFloatingButton',
                'enableNotifications',
                'showAutofillBadge'
            ], (result) => {
                const settings = {
                    autoStartAutofill: result.autoStartAutofill !== false,
                    showFloatingButton: result.showFloatingButton !== false,
                    enableNotifications: result.enableNotifications !== false,
                    showAutofillBadge: result.showAutofillBadge !== false
                };
                resolve({ success: true, settings });
            });
        });
    },

    /**
     * Save settings to storage
     */
    saveSettings: async (settings) => {
        return new Promise((resolve) => {
            chrome.storage.sync.set(settings, () => {
                resolve({ success: true });
            });
        });
    },

    /**
     * Save analysis results
     */
    saveAnalysis: async (analysisData) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ lastAnalysis: analysisData }, () => {
                resolve({ success: true });
            });
        });
    },

    /**
     * Get analysis results
     */
    getAnalysis: async () => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['lastAnalysis'], (result) => {
                resolve({ success: true, analysis: result.lastAnalysis || null });
            });
        });
    },

    /**
     * Save to history
     */
    saveToHistory: async (historyEntry) => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['analysisHistory'], (result) => {
                let history = result.analysisHistory || [];
                
                // Add timestamp if not present
                if (!historyEntry.timestamp) {
                    historyEntry.timestamp = new Date().toISOString();
                }
                
                history.unshift(historyEntry); // Add to beginning
                
                // Keep only last 50 entries
                if (history.length > 50) {
                    history = history.slice(0, 50);
                }
                
                chrome.storage.local.set({ analysisHistory: history }, () => {
                    resolve({ success: true });
                });
            });
        });
    },

    /**
     * Get history
     */
    getHistory: async () => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['analysisHistory'], (result) => {
                const history = result.analysisHistory || [];
                resolve({ success: true, history });
            });
        });
    },

    /**
     * Clear history
     */
    clearHistory: async () => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ analysisHistory: [] }, () => {
                console.log('[StorageUtil] Analysis history cleared');
                resolve({ success: true });
            });
        });
    },

    /**
     * Verify profile data exists (check for corruption/deletion)
     */
    verifyProfileExists: async () => {
        return new Promise((resolve) => {
            try {
                // Check sync storage
                chrome.storage.sync.get(['autofillProfile'], (syncResult) => {
                    const syncExists = !!(syncResult?.autofillProfile && Object.keys(syncResult.autofillProfile).length > 0);
                    
                    // Also check local storage
                    chrome.storage.local.get(['autofillProfile'], (localResult) => {
                        const localExists = !!(localResult?.autofillProfile && Object.keys(localResult.autofillProfile).length > 0);
                        
                        const result = {
                            success: true,
                            syncExists,
                            localExists,
                            anyExists: syncExists || localExists,
                            status: syncExists && localExists ? 'Both' : syncExists ? 'Sync only' : localExists ? 'Local only' : 'None'
                        };
                        
                        if (!result.anyExists) {
                            console.warn('[StorageUtil] ⚠️ Profile data not found in either storage!');
                        }
                        
                        resolve(result);
                    });
                });
            } catch (error) {
                console.error('[StorageUtil] Error verifying profile:', error);
                resolve({ success: false, anyExists: false, error: error.message });
            }
        });
    },

    /**
     * Restore profile from backup if primary is corrupted
     */
    restoreProfileFromBackup: async () => {
        return new Promise((resolve) => {
            // Try to get profile from local backup
            chrome.storage.local.get(['autofillProfile'], (localResult) => {
                if (localResult.autofillProfile && Object.keys(localResult.autofillProfile).length > 0) {
                    console.log('[StorageUtil] 🔄 Restoring profile from local backup...');
                    // Restore to sync
                    chrome.storage.sync.set({ autofillProfile: localResult.autofillProfile }, () => {
                        console.log('[StorageUtil] ✅ Profile restored from backup');
                        resolve({ success: true, restored: true });
                    });
                } else {
                    console.warn('[StorageUtil] ❌ No backup available to restore');
                    resolve({ success: false, restored: false, error: 'No backup found' });
                }
            });
        });
    },

    /**
     * Get AI answers
     */
    getAIAnswers: async () => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['aiAnswers'], (result) => {
                const answers = result.aiAnswers || [];
                resolve({ success: true, answers });
            });
        });
    },

    /**
     * Save AI answers
     */
    saveAIAnswers: async (answers) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ aiAnswers: answers }, () => {
                resolve({ success: true });
            });
        });
    }
};
