/**
 * Data Auto-Sync Manager
 * Handles automatic syncing of profile, resume, and application data to Supabase
 * Debounces writes and handles failures gracefully
 */

class DataAutoSyncManager {
    static BASE_URL = 'http://localhost:3000/api';

    // Debounce timers
    static debounceTimers = {
        profile: null,
        resume: null,
        application: null
    };

    // Debounce delays (ms)
    static DEBOUNCE_DELAYS = {
        profile: 2000,    // 2 seconds - profiles change slowly
        resume: 3000,     // 3 seconds - resumes are large
        application: 1000 // 1 second - applications are quick
    };

    // Sync queue for offline operations
    static syncQueue = [];
    static queueStorageKey = 'sync_queue';

    /**
     * Initialize auto-sync
     */
    static async initialize() {
        try {
            // Load sync queue from storage
            const stored = await chrome.storage.local.get(
                DataAutoSyncManager.queueStorageKey
            );
            if (stored[DataAutoSyncManager.queueStorageKey]) {
                DataAutoSyncManager.syncQueue = stored[DataAutoSyncManager.queueStorageKey];
                console.log('[AutoSync] Loaded queue with', DataAutoSyncManager.syncQueue.length, 'items');
            }

            // Process any queued operations
            await DataAutoSyncManager.processQueue();

            // Listen for online/offline events
            window.addEventListener('online', () => {
                console.log('[AutoSync] Online - processing queue');
                DataAutoSyncManager.processQueue();
            });

            console.log('[AutoSync] Initialized');
            return true;
        } catch (error) {
            console.error('[AutoSync] Init failed:', error);
            return false;
        }
    }

    /**
     * Auto-sync profile changes
     * Debounced to prevent excessive API calls
     */
    static async autoSyncProfile(profileData, accessToken) {
        try {
            // Clear existing timer
            if (DataAutoSyncManager.debounceTimers.profile) {
                clearTimeout(DataAutoSyncManager.debounceTimers.profile);
            }

            // Set new debounced timer
            DataAutoSyncManager.debounceTimers.profile = setTimeout(async () => {
                try {
                    console.log('[AutoSync] Syncing profile...');
                    const response = await fetch(
                        `${DataAutoSyncManager.BASE_URL}/profile`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`
                            },
                            body: JSON.stringify({
                                preferences: profileData
                            })
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const result = await response.json();
                    console.log('[AutoSync] Profile synced successfully');
                    return result;
                } catch (error) {
                    console.error('[AutoSync] Profile sync failed:', error);
                    await DataAutoSyncManager.queueOperation({
                        type: 'profile',
                        method: 'PATCH',
                        endpoint: '/profile',
                        data: profileData,
                        timestamp: Date.now()
                    });
                }
            }, DataAutoSyncManager.DEBOUNCE_DELAYS.profile);

            return true;
        } catch (error) {
            console.error('[AutoSync] Auto-sync profile error:', error);
            return false;
        }
    }

    /**
     * Auto-sync resume changes
     */
    static async autoSyncResume(resumeData, resumeId, accessToken) {
        try {
            // Clear existing timer
            if (DataAutoSyncManager.debounceTimers.resume) {
                clearTimeout(DataAutoSyncManager.debounceTimers.resume);
            }

            DataAutoSyncManager.debounceTimers.resume = setTimeout(async () => {
                try {
                    console.log('[AutoSync] Syncing resume...');
                    
                    const method = resumeId ? 'PATCH' : 'POST';
                    const endpoint = resumeId ? `/resumes/${resumeId}` : '/resumes';

                    const response = await fetch(
                        `${DataAutoSyncManager.BASE_URL}${endpoint}`,
                        {
                            method,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`
                            },
                            body: JSON.stringify(resumeData)
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const result = await response.json();
                    console.log('[AutoSync] Resume synced successfully');
                    return result;
                } catch (error) {
                    console.error('[AutoSync] Resume sync failed:', error);
                    await DataAutoSyncManager.queueOperation({
                        type: 'resume',
                        method,
                        endpoint,
                        data: resumeData,
                        timestamp: Date.now()
                    });
                }
            }, DataAutoSyncManager.DEBOUNCE_DELAYS.resume);

            return true;
        } catch (error) {
            console.error('[AutoSync] Auto-sync resume error:', error);
            return false;
        }
    }

    /**
     * Auto-track application
     */
    static async autoTrackApplication(appData, accessToken) {
        try {
            // No debounce for application tracking (do immediately)
            try {
                console.log('[AutoSync] Tracking application...');
                const response = await fetch(
                    `${DataAutoSyncManager.BASE_URL}/applications`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify(appData)
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
                console.log('[AutoSync] Application tracked successfully');
                return result;
            } catch (error) {
                console.error('[AutoSync] Application tracking failed:', error);
                await DataAutoSyncManager.queueOperation({
                    type: 'application',
                    method: 'POST',
                    endpoint: '/applications',
                    data: appData,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('[AutoSync] Auto-track application error:', error);
            return false;
        }
    }

    /**
     * Queue operation for retry
     */
    static async queueOperation(operation) {
        try {
            DataAutoSyncManager.syncQueue.push(operation);
            
            // Save to storage
            await chrome.storage.local.set({
                [DataAutoSyncManager.queueStorageKey]: DataAutoSyncManager.syncQueue
            });

            console.log('[AutoSync] Operation queued, queue size:', DataAutoSyncManager.syncQueue.length);
            return true;
        } catch (error) {
            console.error('[AutoSync] Queue operation failed:', error);
            return false;
        }
    }

    /**
     * Process queued operations
     */
    static async processQueue() {
        try {
            if (DataAutoSyncManager.syncQueue.length === 0) {
                return;
            }

            console.log('[AutoSync] Processing queue, items:', DataAutoSyncManager.syncQueue.length);

            const toRemove = [];

            for (let i = 0; i < DataAutoSyncManager.syncQueue.length; i++) {
                const operation = DataAutoSyncManager.syncQueue[i];

                try {
                    // Get current access token
                    let tokens;
                    if (typeof window.authManager !== 'undefined') {
                        tokens = await window.authManager.getStoredTokens();
                    } else {
                        const stored = await chrome.storage.sync.get('auth_tokens');
                        tokens = stored.auth_tokens;
                    }

                    if (!tokens || !tokens.access_token) {
                        console.warn('[AutoSync] No access token, cannot process queue');
                        break; // Stop processing if no auth
                    }

                    // Retry operation
                    const response = await fetch(
                        `${DataAutoSyncManager.BASE_URL}${operation.endpoint}`,
                        {
                            method: operation.method,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${tokens.access_token}`
                            },
                            body: JSON.stringify(operation.data)
                        }
                    );

                    if (response.ok) {
                        console.log('[AutoSync] Queued operation processed:', operation.type);
                        toRemove.push(i);
                    } else if (response.status === 401 || response.status === 403) {
                        // Auth error - stop processing
                        console.warn('[AutoSync] Auth error, stopping queue processing');
                        break;
                    }
                } catch (error) {
                    console.error('[AutoSync] Queue operation failed:', error);
                    // Continue to next operation
                }
            }

            // Remove successfully processed operations
            for (let i = toRemove.length - 1; i >= 0; i--) {
                DataAutoSyncManager.syncQueue.splice(toRemove[i], 1);
            }

            // Save updated queue
            if (toRemove.length > 0) {
                await chrome.storage.local.set({
                    [DataAutoSyncManager.queueStorageKey]: DataAutoSyncManager.syncQueue
                });
            }

            console.log('[AutoSync] Queue processing complete, remaining:', DataAutoSyncManager.syncQueue.length);
        } catch (error) {
            console.error('[AutoSync] Process queue failed:', error);
        }
    }

    /**
     * Clear sync queue
     */
    static async clearQueue() {
        try {
            DataAutoSyncManager.syncQueue = [];
            await chrome.storage.local.remove(DataAutoSyncManager.queueStorageKey);
            console.log('[AutoSync] Queue cleared');
            return true;
        } catch (error) {
            console.error('[AutoSync] Clear queue failed:', error);
            return false;
        }
    }

    /**
     * Get queue status
     */
    static getQueueStatus() {
        return {
            queue_size: DataAutoSyncManager.syncQueue.length,
            operations: DataAutoSyncManager.syncQueue.map(op => ({
                type: op.type,
                age_ms: Date.now() - op.timestamp
            }))
        };
    }

    /**
     * Stop all debounced operations
     */
    static stopAllDebounces() {
        Object.keys(DataAutoSyncManager.debounceTimers).forEach(key => {
            if (DataAutoSyncManager.debounceTimers[key]) {
                clearTimeout(DataAutoSyncManager.debounceTimers[key]);
                DataAutoSyncManager.debounceTimers[key] = null;
            }
        });
        console.log('[AutoSync] All debounces stopped');
    }
}

// Export for use in background and popup scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataAutoSyncManager;
}
