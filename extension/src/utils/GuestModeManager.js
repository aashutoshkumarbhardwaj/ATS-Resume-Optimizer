/**
 * Guest Mode Manager
 * Manages local-only guest mode operations when user is not authenticated
 * Guest data is stored locally and never synced to backend unless user logs in
 */

class GuestModeManager {
    // Storage keys
    static STORAGE_KEYS = {
        GUEST_PROFILE: 'guest_profile',
        GUEST_RESUME: 'guest_resume',
        GUEST_SETTINGS: 'guest_settings',
        GUEST_AI_HISTORY: 'guest_ai_history',
        GUEST_MODE_ENABLED: 'guest_mode_enabled'
    };

    // Feature availability in guest mode
    static GUEST_FEATURES = {
        resume_optimize: true,
        extract_jd: true,
        autofill: true,
        ats_score: true,
        ai_questions: true,
        
        // Not available in guest mode
        application_tracking: false,
        cloud_sync: false,
        ai_memory: false,
        multi_device: false,
        profile_backup: false
    };

    /**
     * Check if guest mode is active (no valid auth token)
     */
    static async isGuestMode() {
        try {
            const tokens = await chrome.storage.sync.get('auth_tokens');
            return !tokens.auth_tokens;
        } catch (error) {
            console.error('[Guest Mode] Check failed:', error);
            return true; // Assume guest on error
        }
    }

    /**
     * Enable guest mode (clear auth and set flag)
     */
    static async enableGuestMode() {
        try {
            await chrome.storage.local.set({
                [GuestModeManager.STORAGE_KEYS.GUEST_MODE_ENABLED]: true
            });
            console.log('[Guest Mode] Enabled');
            return true;
        } catch (error) {
            console.error('[Guest Mode] Enable failed:', error);
            return false;
        }
    }

    /**
     * Disable guest mode (user logged in)
     */
    static async disableGuestMode() {
        try {
            await chrome.storage.local.remove(
                GuestModeManager.STORAGE_KEYS.GUEST_MODE_ENABLED
            );
            console.log('[Guest Mode] Disabled');
            return true;
        } catch (error) {
            console.error('[Guest Mode] Disable failed:', error);
            return false;
        }
    }

    /**
     * Save guest profile locally
     * @param {Object} profile - Profile data
     */
    static async saveGuestProfile(profile) {
        try {
            const data = {
                ...profile,
                saved_at: new Date().toISOString()
            };
            
            await chrome.storage.local.set({
                [GuestModeManager.STORAGE_KEYS.GUEST_PROFILE]: data
            });
            
            console.log('[Guest Mode] Profile saved:', profile);
            return true;
        } catch (error) {
            console.error('[Guest Mode] Save profile failed:', error);
            return false;
        }
    }

    /**
     * Get guest profile
     */
    static async getGuestProfile() {
        try {
            const data = await chrome.storage.local.get(
                GuestModeManager.STORAGE_KEYS.GUEST_PROFILE
            );
            return data[GuestModeManager.STORAGE_KEYS.GUEST_PROFILE] || null;
        } catch (error) {
            console.error('[Guest Mode] Get profile failed:', error);
            return null;
        }
    }

    /**
     * Save guest resume locally
     * @param {Object} resume - Resume data
     */
    static async saveGuestResume(resume) {
        try {
            const data = {
                ...resume,
                saved_at: new Date().toISOString()
            };
            
            await chrome.storage.local.set({
                [GuestModeManager.STORAGE_KEYS.GUEST_RESUME]: data
            });
            
            console.log('[Guest Mode] Resume saved');
            return true;
        } catch (error) {
            console.error('[Guest Mode] Save resume failed:', error);
            return false;
        }
    }

    /**
     * Get guest resume
     */
    static async getGuestResume() {
        try {
            const data = await chrome.storage.local.get(
                GuestModeManager.STORAGE_KEYS.GUEST_RESUME
            );
            return data[GuestModeManager.STORAGE_KEYS.GUEST_RESUME] || null;
        } catch (error) {
            console.error('[Guest Mode] Get resume failed:', error);
            return null;
        }
    }

    /**
     * Save guest settings locally
     * @param {Object} settings - Settings data
     */
    static async saveGuestSettings(settings) {
        try {
            const data = {
                ...settings,
                saved_at: new Date().toISOString()
            };
            
            await chrome.storage.local.set({
                [GuestModeManager.STORAGE_KEYS.GUEST_SETTINGS]: data
            });
            
            console.log('[Guest Mode] Settings saved');
            return true;
        } catch (error) {
            console.error('[Guest Mode] Save settings failed:', error);
            return false;
        }
    }

    /**
     * Get guest settings
     */
    static async getGuestSettings() {
        try {
            const data = await chrome.storage.local.get(
                GuestModeManager.STORAGE_KEYS.GUEST_SETTINGS
            );
            return data[GuestModeManager.STORAGE_KEYS.GUEST_SETTINGS] || null;
        } catch (error) {
            console.error('[Guest Mode] Get settings failed:', error);
            return null;
        }
    }

    /**
     * Save AI interaction to guest history
     * @param {Object} interaction - AI interaction data
     */
    static async addToAIHistory(interaction) {
        try {
            const history = await GuestModeManager.getAIHistory() || [];
            
            const entry = {
                id: `guest_${Date.now()}`,
                ...interaction,
                timestamp: new Date().toISOString()
            };
            
            history.push(entry);
            
            // Keep only last 50 interactions
            if (history.length > 50) {
                history.shift();
            }
            
            await chrome.storage.local.set({
                [GuestModeManager.STORAGE_KEYS.GUEST_AI_HISTORY]: history
            });
            
            console.log('[Guest Mode] AI history updated');
            return entry;
        } catch (error) {
            console.error('[Guest Mode] Add to AI history failed:', error);
            return null;
        }
    }

    /**
     * Get guest AI history
     */
    static async getAIHistory() {
        try {
            const data = await chrome.storage.local.get(
                GuestModeManager.STORAGE_KEYS.GUEST_AI_HISTORY
            );
            return data[GuestModeManager.STORAGE_KEYS.GUEST_AI_HISTORY] || [];
        } catch (error) {
            console.error('[Guest Mode] Get AI history failed:', error);
            return [];
        }
    }

    /**
     * Check if a feature is available in guest mode
     * @param {string} feature - Feature name
     */
    static isFeatureAvailable(feature) {
        return GuestModeManager.GUEST_FEATURES[feature] === true;
    }

    /**
     * Get all available guest features
     */
    static getAvailableFeatures() {
        return Object.keys(GuestModeManager.GUEST_FEATURES)
            .filter(feature => GuestModeManager.GUEST_FEATURES[feature]);
    }

    /**
     * Get all locked features
     */
    static getLockedFeatures() {
        return Object.keys(GuestModeManager.GUEST_FEATURES)
            .filter(feature => !GuestModeManager.GUEST_FEATURES[feature]);
    }

    /**
     * Collect all guest data for migration
     */
    static async collectAllGuestData() {
        try {
            const profile = await GuestModeManager.getGuestProfile();
            const resume = await GuestModeManager.getGuestResume();
            const settings = await GuestModeManager.getGuestSettings();
            const aiHistory = await GuestModeManager.getAIHistory();
            
            return {
                profile,
                resume,
                settings,
                ai_history: aiHistory,
                collected_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('[Guest Mode] Collect all data failed:', error);
            return null;
        }
    }

    /**
     * Clear all guest data (after successful migration)
     */
    static async clearAllGuestData() {
        try {
            await chrome.storage.local.remove([
                GuestModeManager.STORAGE_KEYS.GUEST_PROFILE,
                GuestModeManager.STORAGE_KEYS.GUEST_RESUME,
                GuestModeManager.STORAGE_KEYS.GUEST_SETTINGS,
                GuestModeManager.STORAGE_KEYS.GUEST_AI_HISTORY
            ]);
            
            console.log('[Guest Mode] All guest data cleared');
            return true;
        } catch (error) {
            console.error('[Guest Mode] Clear data failed:', error);
            return false;
        }
    }

    /**
     * Check if guest has any data worth migrating
     */
    static async hasDataToMigrate() {
        try {
            const profile = await GuestModeManager.getGuestProfile();
            const resume = await GuestModeManager.getGuestResume();
            const settings = await GuestModeManager.getGuestSettings();
            const aiHistory = await GuestModeManager.getAIHistory();
            
            const hasData = profile || resume || settings || (aiHistory && aiHistory.length > 0);
            return !!hasData;
        } catch (error) {
            console.error('[Guest Mode] Check migration data failed:', error);
            return false;
        }
    }

    /**
     * Get guest mode status and info
     */
    static async getStatus() {
        try {
            const isGuest = await GuestModeManager.isGuestMode();
            const hasData = await GuestModeManager.hasDataToMigrate();
            const availableFeatures = GuestModeManager.getAvailableFeatures();
            
            return {
                is_guest: isGuest,
                has_data: hasData,
                available_features: availableFeatures,
                feature_count: availableFeatures.length
            };
        } catch (error) {
            console.error('[Guest Mode] Get status failed:', error);
            return null;
        }
    }
}

// Export for use in background and popup scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuestModeManager;
}
