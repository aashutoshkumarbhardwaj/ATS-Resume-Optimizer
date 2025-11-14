/**
 * Storage Utility
 * Handles chrome.storage operations for resume and job data
 */

const StorageUtil = {
    /**
     * Save resume to storage
     */
    async saveResume(resumeData) {
        try {
            const storageData = {
                resume: {
                    text: resumeData.text,
                    parsedData: resumeData.parsedData,
                    metadata: resumeData.metadata,
                    uploadedAt: Date.now()
                }
            };

            await chrome.storage.local.set(storageData);
            return { success: true };
        } catch (error) {
            console.error('Failed to save resume:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get saved resume from storage
     */
    async getResume() {
        try {
            const result = await chrome.storage.local.get(['resume']);
            if (result.resume) {
                return { success: true, resume: result.resume };
            }
            return { success: false, message: 'No resume found' };
        } catch (error) {
            console.error('Failed to get resume:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete saved resume
     */
    async deleteResume() {
        try {
            await chrome.storage.local.remove(['resume']);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete resume:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Save current job data
     */
    async saveCurrentJob(jobData) {
        try {
            const storageData = {
                currentJob: {
                    ...jobData,
                    detectedAt: Date.now()
                }
            };

            await chrome.storage.local.set(storageData);
            return { success: true };
        } catch (error) {
            console.error('Failed to save job:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get current job data
     */
    async getCurrentJob() {
        try {
            const result = await chrome.storage.local.get(['currentJob']);
            if (result.currentJob) {
                return { success: true, job: result.currentJob };
            }
            return { success: false, message: 'No job detected' };
        } catch (error) {
            console.error('Failed to get job:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Save analysis result
     */
    async saveAnalysis(analysisData) {
        try {
            const storageData = {
                currentAnalysis: {
                    ...analysisData,
                    analyzedAt: Date.now()
                }
            };

            await chrome.storage.local.set(storageData);
            return { success: true };
        } catch (error) {
            console.error('Failed to save analysis:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get current analysis
     */
    async getAnalysis() {
        try {
            const result = await chrome.storage.local.get(['currentAnalysis']);
            if (result.currentAnalysis) {
                return { success: true, analysis: result.currentAnalysis };
            }
            return { success: false, message: 'No analysis found' };
        } catch (error) {
            console.error('Failed to get analysis:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Save optimization history
     */
    async saveToHistory(historyEntry) {
        try {
            const result = await chrome.storage.local.get(['history']);
            const history = result.history || [];

            history.unshift({
                ...historyEntry,
                id: Date.now().toString(),
                createdAt: Date.now()
            });

            // Keep only last 50 entries
            const trimmedHistory = history.slice(0, 50);

            await chrome.storage.local.set({ history: trimmedHistory });
            return { success: true };
        } catch (error) {
            console.error('Failed to save history:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get optimization history
     */
    async getHistory() {
        try {
            const result = await chrome.storage.local.get(['history']);
            return { success: true, history: result.history || [] };
        } catch (error) {
            console.error('Failed to get history:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete history entry
     */
    async deleteHistoryEntry(entryId) {
        try {
            const result = await chrome.storage.local.get(['history']);
            const history = result.history || [];

            const updatedHistory = history.filter(entry => entry.id !== entryId);

            await chrome.storage.local.set({ history: updatedHistory });
            return { success: true };
        } catch (error) {
            console.error('Failed to delete history entry:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Clear all history
     */
    async clearHistory() {
        try {
            await chrome.storage.local.set({ history: [] });
            return { success: true };
        } catch (error) {
            console.error('Failed to clear history:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get settings
     */
    async getSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            const defaultSettings = {
                autoDetect: true,
                apiEndpoint: 'http://localhost:5000'
            };

            return {
                success: true,
                settings: result.settings || defaultSettings
            };
        } catch (error) {
            console.error('Failed to get settings:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Save settings
     */
    async saveSettings(settings) {
        try {
            await chrome.storage.local.set({ settings });
            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Clear all data
     */
    async clearAll() {
        try {
            await chrome.storage.local.clear();
            return { success: true };
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return { success: false, error: error.message };
        }
    }
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageUtil;
}
