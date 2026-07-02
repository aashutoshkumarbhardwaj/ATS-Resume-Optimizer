/**
 * Storage Utilities
 * Handles all Chrome storage operations for autofill profile, analysis, and history
 */

const StorageUtil = {
    /**
     * Save autofill profile to storage - with fallback to local if sync fails
     */
    saveAutofillProfile: async (profileData) => {
        return new Promise((resolve) => {
            // Always save to BOTH sync and local storage for redundancy
            const dataToSave = {
                autofillProfile: profileData,
                lastSavedAt: new Date().toISOString()
            };
            
            // Primary: sync storage (persists across devices)
            chrome.storage.sync.set(dataToSave, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[StorageUtil] Sync storage failed, using local:', chrome.runtime.lastError);
                    // Fallback to local storage
                    chrome.storage.local.set(dataToSave, () => {
                        resolve({ success: true, stored: 'local' });
                    });
                } else {
                    console.log('[StorageUtil] Profile saved to sync storage');
                    
                    // Also save to local as backup
                    chrome.storage.local.set(dataToSave, () => {
                        console.log('[StorageUtil] Profile backed up to local storage');
                        resolve({ success: true, stored: 'sync+local' });
                    });
                }
            });
        });
    },

    /**
     * Get autofill profile from storage - checks both sync and local
     */
    getAutofillProfile: async () => {
        return new Promise((resolve) => {
            // Try sync storage first
            chrome.storage.sync.get(['autofillProfile'], (syncResult) => {
                if (chrome.runtime.lastError) {
                    console.warn('[StorageUtil] Sync storage read failed');
                }
                
                if (syncResult.autofillProfile) {
                    console.log('[StorageUtil] Profile loaded from sync storage');
                    resolve({ success: true, profile: syncResult.autofillProfile, source: 'sync' });
                    return;
                }
                
                // Fallback to local storage
                chrome.storage.local.get(['autofillProfile'], (localResult) => {
                    if (localResult.autofillProfile) {
                        console.log('[StorageUtil] Profile loaded from local storage (sync was empty)');
                        // Re-sync to sync storage for future
                        chrome.storage.sync.set({ autofillProfile: localResult.autofillProfile });
                        resolve({ success: true, profile: localResult.autofillProfile, source: 'local' });
                    } else {
                        console.log('[StorageUtil] No autofill profile found in either storage');
                        resolve({ success: true, profile: {}, source: 'none' });
                    }
                });
            });
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
            chrome.storage.sync.get(['autofillProfile'], (syncResult) => {
                const syncExists = !!syncResult.autofillProfile && Object.keys(syncResult.autofillProfile).length > 0;
                
                chrome.storage.local.get(['autofillProfile'], (localResult) => {
                    const localExists = !!localResult.autofillProfile && Object.keys(localResult.autofillProfile).length > 0;
                    
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
