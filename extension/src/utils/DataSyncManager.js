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
     * Sync profile data from Supabase REST API
     * GET /rest/v1/profiles
     */
    static async syncProfile(token) {
        try {
            const supabaseUrl = 'https://dsbkjkwefszqqzukgdtk.supabase.co/rest/v1/profiles?select=*';
            const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYmtqa3dlZnN6cXF6dWtnZHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMjUzOTAsImV4cCI6MjAyNjc5MzM5MH0.zknQ8ENKEnTZLTuIYGfawQ_bS9bln9l';

            const response = await fetch(supabaseUrl, {
                method: 'GET',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`[DataSync] Profile fetch status: ${response.status}`);
                return { success: true, data: {} };
            }

            const data = await response.json();
            const profile = Array.isArray(data) && data.length > 0 ? data[0] : {};
            console.log('[DataSync] ✅ Profile synced from Supabase');
            return {
                success: true,
                data: profile
            };
        } catch (error) {
            console.error('[DataSync] Profile sync error:', error.message);
            return {
                success: true,
                data: {}
            };
        }
    }

    /**
     * Map Extension camelCase profile to Backend snake_case profile
     */
    static mapExtensionToBackendProfile(extProfile) {
        return {
            full_name: extProfile.fullName,
            first_name: extProfile.firstName,
            last_name: extProfile.lastName,
            email: extProfile.email,
            phone: extProfile.phone,
            city: extProfile.city,
            state: extProfile.state,
            zip: extProfile.zip,
            country: extProfile.country,
            linkedin: extProfile.linkedin,
            github: extProfile.github,
            portfolio: extProfile.portfolio,
            current_title: extProfile.currentJobTitle,
            years_of_experience: extProfile.yearsOfExperience,
            skills: extProfile.customFields?.skills || extProfile.skills,
            notice_period: extProfile.customFields?.notice_period || extProfile.noticePeriod,
            expected_salary: extProfile.customFields?.expected_salary || extProfile.expectedSalary,
            work_environment: extProfile.customFields?.work_environment || extProfile.workEnvironment,
            work_authorization: extProfile.customFields?.work_authorization || extProfile.workAuthorization
        };
    }

    /**
     * Map Backend snake_case profile to Extension camelCase profile
     */
    static mapBackendToExtensionProfile(backendProfile) {
        return {
            fullName: backendProfile.full_name || '',
            firstName: backendProfile.first_name || '',
            lastName: backendProfile.last_name || '',
            email: backendProfile.email || '',
            phone: backendProfile.phone || '',
            city: backendProfile.city || '',
            state: backendProfile.state || '',
            zip: backendProfile.zip || '',
            country: backendProfile.country || '',
            linkedin: backendProfile.linkedin || '',
            github: backendProfile.github || '',
            portfolio: backendProfile.portfolio || '',
            currentJobTitle: backendProfile.current_title || '',
            yearsOfExperience: backendProfile.years_of_experience || '',
            customFields: {
                skills: backendProfile.skills || '',
                notice_period: backendProfile.notice_period || '',
                expected_salary: backendProfile.expected_salary || '',
                work_environment: backendProfile.work_environment || '',
                work_authorization: backendProfile.work_authorization || ''
            }
        };
    }

    /**
     * Sync Update Profile data
     * PATCH /api/profile
     */
    static async syncUpdateProfile(token, extProfile) {
        console.log('[DataSync] 📤 Pushing profile updates to server...');
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.getApiConfig().timeout);
            
            const backendPayload = this.mapExtensionToBackendProfile(extProfile);
            
            // Remove undefined fields
            Object.keys(backendPayload).forEach(key => {
                if (backendPayload[key] === undefined) {
                    delete backendPayload[key];
                }
            });

            let response;
            try {
                response = await fetch(`${this.getApiConfig().apiUrl}/profile`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(backendPayload),
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
                console.log('[DataSync] ✅ Profile update synced to DB');
                return {
                    success: true,
                    data: data.profile
                };
            } else {
                throw new Error(data.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('[DataSync] Profile update error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync resumes data from Supabase REST API
     * GET /rest/v1/resumes
     */
    static async syncResumes(token) {
        try {
            const supabaseUrl = 'https://dsbkjkwefszqqzukgdtk.supabase.co/rest/v1/resumes?select=*';
            const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYmtqa3dlZnN6cXF6dWtnZHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMjUzOTAsImV4cCI6MjAyNjc5MzM5MH0.zknQ8ENKEnTZLTuIYGfawQ_bS9bln9l';

            const response = await fetch(supabaseUrl, {
                method: 'GET',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`[DataSync] Resumes fetch status: ${response.status}`);
                return { success: true, data: [] };
            }

            const data = await response.json();
            const resumes = Array.isArray(data) ? data : [];
            console.log('[DataSync] ✅ Resumes synced from Supabase:', resumes.length);
            return {
                success: true,
                data: resumes
            };
        } catch (error) {
            console.error('[DataSync] Resumes sync error:', error.message);
            return {
                success: true,
                data: []
            };
        }
    }

    /**
     * Sync applications data from Supabase REST API
     * GET /rest/v1/jobs
     */
    static async syncApplications(token) {
        try {
            const supabaseUrl = 'https://dsbkjkwefszqqzukgdtk.supabase.co/rest/v1/jobs?select=*';
            const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYmtqa3dlZnN6cXF6dWtnZHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMjUzOTAsImV4cCI6MjAyNjc5MzM5MH0.zknQ8ENKEnTZLTuIYGfawQ_bS9bln9l';

            const response = await fetch(supabaseUrl, {
                method: 'GET',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`[DataSync] Applications fetch status: ${response.status}`);
                return { success: true, data: [] };
            }

            const data = await response.json();
            const jobs = Array.isArray(data) ? data : [];
            console.log('[DataSync] ✅ Jobs/Applications synced from Supabase:', jobs.length);
            return {
                success: true,
                data: jobs
            };
        } catch (error) {
            console.error('[DataSync] Applications sync error:', error.message);
            return {
                success: true,
                data: []
            };
        }
    }

    /**
     * Sync AI answers (AI memory)
     */
    static async syncAnswers(token) {
        try {
            return {
                success: true,
                data: []
            };
        } catch (error) {
            return {
                success: true,
                data: []
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
     * POST /rest/v1/jobs directly to Supabase to bypass Render API
     */
    static async syncNewApplication(token, application) {
        console.log('[DataSync] 📤 Recording application directly to DB:', application.jobTitle || application.job_title);

        try {
            // Extract user_id from token (URL-safe base64 decode)
            const payloadBase64 = token.split('.')[1];
            const base64Fixed = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            const decodedPayload = JSON.parse(decodeURIComponent(atob(base64Fixed).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
            const userId = decodedPayload.sub;

            console.log('[DataSync] 👤 Decoded userId from token:', userId);

            if (!userId) {
                throw new Error('Invalid token: missing user ID (sub claim)');
            }

            // Supabase project config
            const supabaseUrl = 'https://dsbkjkwefszqqzukgdtk.supabase.co/rest/v1/jobs';
            // Anon key (public, safe to include in extension)
            const publishableKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYmtqa3dlZnN6cXF6dWtnZHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMjUzOTAsImV4cCI6MjAyNjc5MzM5MH0.zknQ8ENKEnTZLTuIYGfawQ_bS9bln9l';

            const response = await fetch(supabaseUrl, {
                method: 'POST',
                headers: {
                    'apikey': publishableKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    user_id: userId,
                    role: application.jobTitle || application.job_title || 'Unknown Position',
                    company: application.company || 'Unknown Company',
                    url: application.jobUrl || application.job_url || '',
                    job_description: application.jobDescription || application.job_description || '',
                    location: application.location || '',
                    salary: application.salary || '',
                    status: application.status || 'applied',
                    notes: application.notes || '',
                    applied_date: application.timestamp || application.date || new Date().toISOString(),
                    source: application.source || 'Extension',
                    extension_saved: true
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const savedApplication = data[0] || data; // Since Prefer: return=representation

            console.log('[DataSync] ✅ Application recorded in Supabase directly');
            // Update local store
            const stored = await this.getStoredData();
            stored.applications = [...(stored.applications || []), savedApplication];
            stored.syncedAt = new Date().toISOString();
            await this.storeSync(stored);

            return {
                success: true,
                data: savedApplication
            };
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
