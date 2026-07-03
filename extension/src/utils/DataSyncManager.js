/**
 * Data Sync Manager
 * Handles comprehensive data synchronization with Job Orbit backend
 * Syncs: profile, resumes, applications, AI answers on startup
 * Also handles incremental updates on user changes
 * Requires CONFIG to be loaded first
 */

class DataSyncManager {
    /**
     * Get API configuration with fallback
     */
    static getApiConfig() {
        return {
            apiUrl: (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                ? CONFIG.API_BASE_URL 
                : 'https://ats-resume-optimizer-359j.onrender.com/api',
            timeout: (typeof CONFIG !== 'undefined' && CONFIG.SYNC.REQUEST_TIMEOUT_MS)
                ? CONFIG.SYNC.REQUEST_TIMEOUT_MS
                : 10000
        };
    }

    /**
     * Full data sync on startup
     * Downloads all user data from backend and syncs to local storage
     */
    static async fullSync(token) {
        console.log('[DataSync] 🔄 Starting full data synchronization...');

        try {
            const results = {
                profile: null,
                resumes: [],
                applications: [],
                answers: [],
                errors: []
            };

            // Sync profile
            console.log('[DataSync] 📥 Fetching profile...');
            const profileResult = await this.syncProfile(token);
            if (profileResult.success) {
                results.profile = profileResult.data;
            } else {
                results.errors.push(`Profile: ${profileResult.error}`);
            }

            // Sync resumes
            console.log('[DataSync] 📥 Fetching resumes...');
            const resumesResult = await this.syncResumes(token);
            if (resumesResult.success) {
                results.resumes = resumesResult.data;
            } else {
                results.errors.push(`Resumes: ${resumesResult.error}`);
            }

            // Sync applications
            console.log('[DataSync] 📥 Fetching applications...');
            const appsResult = await this.syncApplications(token);
            if (appsResult.success) {
                results.applications = appsResult.data;
            } else {
                results.errors.push(`Applications: ${appsResult.error}`);
            }

            // Sync AI answers (AI memory)
            console.log('[DataSync] 📥 Fetching AI answers...');
            const answersResult = await this.syncAnswers(token);
            if (answersResult.success) {
                results.answers = answersResult.data;
            } else {
                results.errors.push(`Answers: ${answersResult.error}`);
            }

            // Store everything in local storage
            await this.storeSync(results);

            console.log('[DataSync] ✅ Full sync completed');
            console.log('[DataSync] Synced:', {
                profile: !!results.profile,
                resumes: results.resumes.length,
                applications: results.applications.length,
                answers: results.answers.length,
                errors: results.errors.length
            });

            return {
                success: true,
                data: results,
                errors: results.errors
            };
        } catch (error) {
            console.error('[DataSync] ❌ Full sync error:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Sync profile data
     * GET /api/profile
     */
    static async syncProfile(token) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.getApiConfig().timeout);

            let response;
            try {
                response = await fetch(`${this.getApiConfig().apiUrl}/profile`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.profile) {
                console.log('[DataSync] ✅ Profile synced');
                return {
                    success: true,
                    data: data.profile
                };
            } else {
                throw new Error(data.error || 'No profile data');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[DataSync] Profile sync timeout');
                return {
                    success: false,
                    error: 'Request timeout'
                };
            }
            console.error('[DataSync] Profile sync error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync resumes data
     * GET /api/resumes
     */
    static async syncResumes(token) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.getApiConfig().timeout);

            let response;
            try {
                response = await fetch(`${this.getApiConfig().apiUrl}/resumes`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.resumes)) {
                console.log('[DataSync] ✅ Resumes synced:', data.resumes.length);
                return {
                    success: true,
                    data: data.resumes
                };
            } else {
                throw new Error(data.error || 'No resumes data');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[DataSync] Resumes sync timeout');
                return {
                    success: false,
                    error: 'Request timeout'
                };
            }
            console.error('[DataSync] Resumes sync error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync applications data
     * GET /api/applications
     */
    static async syncApplications(token) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.getApiConfig().timeout);

            let response;
            try {
                response = await fetch(`${this.getApiConfig().apiUrl}/applications`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.applications)) {
                console.log('[DataSync] ✅ Applications synced:', data.applications.length);
                return {
                    success: true,
                    data: data.applications
                };
            } else {
                throw new Error(data.error || 'No applications data');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[DataSync] Applications sync timeout');
                return {
                    success: false,
                    error: 'Request timeout'
                };
            }
            console.error('[DataSync] Applications sync error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync AI answers (AI memory)
     * GET /api/ai-memory
     */
    static async syncAnswers(token) {
        try {
            const response = await fetch(`${this.getApiConfig().apiUrl}/ai-memory?limit=100`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.getApiConfig().timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.entries)) {
                console.log('[DataSync] ✅ AI answers synced:', data.entries.length);
                return {
                    success: true,
                    data: data.entries
                };
            } else {
                throw new Error(data.error || 'No answers data');
            }
        } catch (error) {
            console.error('[DataSync] Answers sync error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Store synced data in local storage
     */
    static async storeSync(results) {
        return new Promise((resolve) => {
            const storageData = {
                profile: results.profile,
                resumes: results.resumes,
                applications: results.applications,
                answers: results.answers,
                syncedAt: new Date().toISOString(),
                errors: results.errors
            };

            chrome.storage.local.set({ jobOrbitSyncData: storageData }, () => {
                console.log('[DataSync] 💾 Data stored in local storage');
                resolve();
            });
        });
    }

    /**
     * Get synced data from local storage
     */
    static async getStoredData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['jobOrbitSyncData'], (result) => {
                const data = result.jobOrbitSyncData || {
                    profile: null,
                    resumes: [],
                    applications: [],
                    answers: [],
                    syncedAt: null,
                    errors: []
                };
                resolve(data);
            });
        });
    }

    /**
     * Sync individual resume after upload
     * POST /api/resumes
     */
    static async syncNewResume(token, resume) {
        console.log('[DataSync] 📤 Uploading new resume:', resume.title);

        try {
            const response = await fetch(`${this.getApiConfig().apiUrl}/resumes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: resume.title,
                    content: resume.content,
                    file_format: resume.file_format || 'text'
                }),
                timeout: this.getApiConfig().timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('[DataSync] ✅ Resume uploaded');
                // Update local store
                const stored = await this.getStoredData();
                stored.resumes = [...(stored.resumes || []), data.resume];
                stored.syncedAt = new Date().toISOString();
                await this.storeSync(stored);

                return {
                    success: true,
                    data: data.resume
                };
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('[DataSync] Resume upload error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync individual application
     * POST /api/applications
     */
    static async syncNewApplication(token, application) {
        console.log('[DataSync] 📤 Recording application:', application.job_title);

        try {
            const response = await fetch(`${this.getApiConfig().apiUrl}/applications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(application),
                timeout: this.getApiConfig().timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('[DataSync] ✅ Application recorded');
                // Update local store
                const stored = await this.getStoredData();
                stored.applications = [...(stored.applications || []), data.application];
                stored.syncedAt = new Date().toISOString();
                await this.storeSync(stored);

                return {
                    success: true,
                    data: data.application
                };
            } else {
                throw new Error(data.error || 'Recording failed');
            }
        } catch (error) {
            console.error('[DataSync] Application record error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync AI answer
     * POST /api/ai-memory
     */
    static async syncNewAnswer(token, answer) {
        console.log('[DataSync] 📤 Saving AI answer:', answer.question_type);

        try {
            const response = await fetch(`${this.getApiConfig().apiUrl}/ai-memory`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_type: answer.question_type,
                    context: answer.context || {},
                    response_content: answer.response_content
                }),
                timeout: this.getApiConfig().timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('[DataSync] ✅ AI answer saved');
                // Update local store
                const stored = await this.getStoredData();
                stored.answers = [...(stored.answers || []), data.entry];
                stored.syncedAt = new Date().toISOString();
                await this.storeSync(stored);

                return {
                    success: true,
                    data: data.entry
                };
            } else {
                throw new Error(data.error || 'Save failed');
            }
        } catch (error) {
            console.error('[DataSync] Answer save error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if sync is stale (older than 1 hour)
     */
    static isDataStale() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['jobOrbitSyncData'], (result) => {
                const data = result.jobOrbitSyncData;
                if (!data || !data.syncedAt) {
                    resolve(true);
                    return;
                }

                const syncedAt = new Date(data.syncedAt).getTime();
                const now = Date.now();
                const oneHourInMs = 60 * 60 * 1000;

                resolve((now - syncedAt) > oneHourInMs);
            });
        });
    }

    /**
     * Clear all synced data
     */
    static async clearSync() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['jobOrbitSyncData'], () => {
                console.log('[DataSync] 🗑️ Synced data cleared');
                resolve();
            });
        });
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataSyncManager;
}
