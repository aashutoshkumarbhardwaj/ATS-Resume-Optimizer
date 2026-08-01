/**
 * Extension Configuration
 * Centralized config for all extension utilities
 * Must be loaded FIRST before other utilities
 */

// Create CONFIG object only once
if (typeof window !== 'undefined' && !window.CONFIG) {
    window.CONFIG = {
        API_BASE_URL: 'https://ats-resume-optimizer-359j.onrender.com/api',
        STORAGE_KEYS: {
            JOBORBIT_AUTH: 'jobOrbitAuth',
            SYNC_DATA: 'jobOrbitSyncData',
            AUTOFILL_PROFILE: 'autofillProfile',
            SETTINGS: 'settings'
        },
        SYNC: {
            PROFILE_DEBOUNCE_MS: 2000,
            STALE_DATA_MS: 60 * 60 * 1000, // 1 hour
            REQUEST_TIMEOUT_MS: 10000
        },
        getExtensionId: function() {
            return chrome && chrome.runtime ? chrome.runtime.id : 'unknown';
        }
    };
}

// For service workers and other contexts
const CONFIG = (typeof window !== 'undefined' && window.CONFIG) || {
    API_BASE_URL: 'https://ats-resume-optimizer-359j.onrender.com/api',
    STORAGE_KEYS: {
        JOBORBIT_AUTH: 'jobOrbitAuth',
        SYNC_DATA: 'jobOrbitSyncData',
        AUTOFILL_PROFILE: 'autofillProfile',
        SETTINGS: 'settings'
    },
    SYNC: {
        PROFILE_DEBOUNCE_MS: 2000,
        STALE_DATA_MS: 60 * 60 * 1000,
        REQUEST_TIMEOUT_MS: 10000
    },
    getExtensionId: function() {
        return chrome && chrome.runtime ? chrome.runtime.id : 'unknown';
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
