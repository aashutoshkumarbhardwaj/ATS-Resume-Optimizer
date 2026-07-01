/**
 * Storage Utilities
 * Handles all Chrome storage operations for autofill profile, analysis, and history
 */

const StorageUtil = {
    /**
     * Get autofill profile from storage
     */
    getAutofillProfile: async () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['autofillProfile'], (result) => {
                const profile = result.autofillProfile || {};
                resolve({ success: true, profile });
            });
        });
    },

    /**
     * Save autofill profile to storage
     */
    saveAutofillProfile: async (profileData) => {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ autofillProfile: profileData }, () => {
                resolve({ success: true });
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
                resolve({ success: true });
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
