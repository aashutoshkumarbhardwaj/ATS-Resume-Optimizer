/**
 * Session Manager
 * Handles persistent login sessions, cloud sync status, and user data caching
 * Provides immediate UI updates on popup open without waiting for backend
 */

class SessionManager {
    /**
     * Create or update session after successful authentication
     */
    static async createSession(authData) {
        try {
            console.log("========== CREATE SESSION ==========");
            console.log("AUTH DATA:", authData);
            console.log('[SessionManager] 📝 Creating new session...');
            
            const session = {
                // Authentication
                extensionToken: authData.extensionToken || authData.token,
                tokenType: authData.tokenType || 'Bearer',
                expiresIn: authData.expiresIn || 3600,
                expiresAt: Date.now() + ((authData.expiresIn || 3600) * 1000),
                
                // User Info
                user: authData.user || {},
                userId: authData.user?.id || authData.userId,
                
                // Session Metadata
                createdAt: new Date().toISOString(),
                lastVerifiedAt: new Date().toISOString(),
                lastSyncAt: null,
                syncStatus: 'never', // 'never', 'syncing', 'success', 'error'
                
                // Cached Data (for immediate UI display)
                cachedProfile: authData.profile || {},
                cachedResumes: authData.resumes || [],
                cachedApplications: authData.applications || [],
                cachedAnswers: authData.answers || [],
                cachedSettings: authData.settings || {},
                
                // Cloud Sync Info
                cloudSyncEnabled: true,
                lastCloudSyncAt: null,
                cloudSyncStatus: 'not-synced'
            };
            
            console.log("SESSION OBJECT:");
            console.log(session);
            
            console.log('[AUTH] Input payload:', authData);
            console.log('[AUTH] Final session object:', session);
            try {
                const jsonStr = JSON.stringify(session);
                console.log('[AUTH] JSON size:', jsonStr.length, 'bytes');
                console.log('[AUTH] JSON.stringify(session):', jsonStr);
            } catch (jsonErr) {
                console.error('[AUTH] Session object is NOT serializable:', jsonErr);
            }
            
            // Save to both sync and local storage
            const jobOrbitAuth = {
                extensionToken: session.extensionToken,
                user: session.user,
                expiresAt: session.expiresAt,
                receivedAt: session.createdAt
            };
            
            // Log the exact object being written to storage
            console.log('[SessionManager] Writing exact object to storage:', { jobOrbitSession: session, jobOrbitAuth });

        // Save ONLY auth info to sync storage to respect 8KB quota
        chrome.storage.sync.set({ jobOrbitAuth }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[SessionManager] ⚠️ Sync storage failed:', chrome.runtime.lastError.message)
          } else {
            console.log('[SessionManager] ✅ Auth stored in sync storage')
          }
        })
        
        try {
            // Save FULL session (with heavy cached profiles/resumes) to LOCAL storage exclusively
            // Awaiting this directly surfaces any DataCloneError or QuotaExceededError
            await chrome.storage.local.set({ jobOrbitSession: session, jobOrbitAuth });
            
            const stored = await chrome.storage.local.get(null);
            console.log("=========================================");
            console.log("[AUTH] Storage Immediately After Save", stored);
            console.log("=========================================");
            
            // Read-after-write verification
            const verifyResult = await chrome.storage.local.get(['jobOrbitSession', 'jobOrbitAuth']);
            console.log('[SessionManager] 🔍 Read-after-write verification:', {
                hasSession: !!verifyResult.jobOrbitSession,
                hasAuth: !!verifyResult.jobOrbitAuth,
                authKeys: Object.keys(verifyResult.jobOrbitAuth || {})
            });
            
            if (!verifyResult.jobOrbitSession || !verifyResult.jobOrbitAuth) {
                console.error('[SessionManager] ❌ Storage verification failed! Data was not persisted.');
                return { success: false, error: 'Storage verification failed' };
            } else {
                console.log('[SessionManager] ✅ Full session created and verified in local storage');
                return { success: true, stored: 'local' };
            }
        } catch (localErr) {
            console.error('[SessionManager] ❌ Local storage threw an exception:', localErr);
            return { success: false, error: localErr.message || String(localErr) };
        }
    } catch (e) {
        console.error("CREATE SESSION FAILED");
        console.error(e);
        return { success: false, error: e.message };
    }
}

    /**
     * Get current session
     */
    static async getSession() {
        return new Promise((resolve) => {
            console.log('[SessionManager] 🔍 Retrieving session...');
            
            // Session with heavy data is exclusively in local storage
            chrome.storage.local.get(['jobOrbitSession'], (localResult) => {
                if (localResult.jobOrbitSession) {
                    console.log('[SessionManager] ✅ Session found in local storage');
                    resolve({ success: true, session: localResult.jobOrbitSession, source: 'local' });
                } else {
                    console.log('[SessionManager] ❌ No session found in local storage');
                    resolve({ success: false, session: null, source: 'none' });
                }
            });
        });
    }

    /**
     * Check if session is valid (not expired)
     */
    static async isSessionValid() {
        console.log('[SessionManager] 🔐 Checking session validity...');
        
        const result = await this.getSession();
        
        if (!result.success || !result.session) {
            console.log('[SessionManager] ❌ No session found');
            return { valid: false, reason: 'NO_SESSION' };
        }
        
        const session = result.session;
        const now = Date.now();
        const timeToExpiry = session.expiresAt - now;
        
        console.log('[SessionManager] ⏰ Session expires in:', Math.round(timeToExpiry / 1000), 'seconds');
        
        if (timeToExpiry < 0) {
            console.log('[SessionManager] ❌ Session expired');
            return { valid: false, reason: 'EXPIRED' };
        }
        
        // Check if stale (need refresh)
        const oneHourInMs = 60 * 60 * 1000;
        const isStale = timeToExpiry < oneHourInMs;
        
        if (isStale) {
            console.log('[SessionManager] ⚠️ Session is stale (expiring soon)');
        }
        
        return { 
            valid: true, 
            session,
            isStale,
            timeToExpiry
        };
    }

    /**
     * Verify session with backend
     */
    static async verifySession() {
        console.log('[SessionManager] 🔄 Verifying session with backend...');
        
        const result = await this.getSession();
        
        if (!result.success || !result.session) {
            console.log('[SessionManager] ❌ No session to verify');
            return { verified: false, reason: 'NO_SESSION' };
        }
        
        const session = result.session;
        
        try {
            const apiUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL)
                ? CONFIG.API_BASE_URL
                : 'https://ats-resume-optimizer-359j.onrender.com/api';

            const response = await fetch(`${apiUrl}/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.extensionToken}`
                },
                timeout: 10000
            });

            if (!response.ok) {
                console.log('[SessionManager] ❌ Session verification failed (HTTP', response.status + ')');
                return { verified: false, reason: 'HTTP_ERROR', status: response.status };
            }

            const data = await response.json();

            if (!data.success || !data.authenticated) {
                console.log('[SessionManager] ❌ Backend rejected session');
                return { verified: false, reason: 'NOT_AUTHENTICATED' };
            }

            console.log('[SessionManager] ✅ Session verified by backend');
            
            // Update verification timestamp
            session.lastVerifiedAt = new Date().toISOString();
            await this.updateSession(session);

            return { 
                verified: true, 
                user: data.user,
                expiresIn: data.expiresIn 
            };
        } catch (error) {
            console.error('[SessionManager] ❌ Verification error:', error.message);
            return { verified: false, reason: 'VERIFICATION_ERROR', error: error.message };
        }
    }

    /**
     * Update session data
     */
    static async updateSession(session) {
        return new Promise((resolve) => {
            console.log('[SessionManager] 📝 Updating session...');
            
            const dataToSave = {
                jobOrbitSession: session,
                jobOrbitAuth: {
                    extensionToken: session.extensionToken,
                    user: session.user,
                    expiresAt: session.expiresAt,
                    receivedAt: session.createdAt
                }
            };
            
            chrome.storage.sync.set(dataToSave, () => {
                if (chrome.runtime.lastError) {
                    chrome.storage.local.set(dataToSave, () => {
                        resolve({ success: true });
                    });
                } else {
                    chrome.storage.local.set(dataToSave, () => {
                        resolve({ success: true });
                    });
                }
            });
        });
    }

    /**
     * Update sync status
     */
    static async updateSyncStatus(status, data = {}) {
        console.log('[SessionManager] 🔄 Updating sync status:', status);
        
        const result = await this.getSession();
        if (!result.success) {
            console.warn('[SessionManager] ⚠️ No session to update');
            return;
        }
        
        const session = result.session;
        session.syncStatus = status;
        session.lastSyncAt = new Date().toISOString();
        
        // Update cached data if provided
        if (data.profile) session.cachedProfile = data.profile;
        if (data.resumes) session.cachedResumes = data.resumes;
        if (data.applications) session.cachedApplications = data.applications;
        if (data.answers) session.cachedAnswers = data.answers;
        if (data.settings) session.cachedSettings = data.settings;
        
        return this.updateSession(session);
    }

    /**
     * Update cloud sync status
     */
    static async updateCloudSyncStatus(status, timestamp = null) {
        console.log('[SessionManager] ☁️ Updating cloud sync status:', status);
        
        const result = await this.getSession();
        if (!result.success) {
            console.warn('[SessionManager] ⚠️ No session to update');
            return;
        }
        
        const session = result.session;
        session.cloudSyncStatus = status;
        if (timestamp !== false) {
            session.lastCloudSyncAt = timestamp || new Date().toISOString();
        }
        
        return this.updateSession(session);
    }

    /**
     * Get cached user data (for immediate UI display)
     */
    static async getCachedUserData() {
        console.log('[SessionManager] 💾 Retrieving cached user data...');
        
        const result = await this.getSession();
        if (!result.success) {
            return { success: false };
        }
        
        const session = result.session;
        return {
            success: true,
            user: session.user,
            profile: session.cachedProfile,
            resumes: session.cachedResumes,
            applications: session.cachedApplications,
            answers: session.cachedAnswers,
            settings: session.cachedSettings,
            lastSyncAt: session.lastSyncAt,
            syncStatus: session.syncStatus,
            cloudSyncStatus: session.cloudSyncStatus
        };
    }

    /**
     * Clear session (logout)
     */
    static async clearSession() {
        console.warn("[AUTH] Session deletion");
        console.trace();
        const stored = await chrome.storage.local.get(null);
        console.log("[AUTH] Storage before deletion:", stored);
        console.log('[SessionManager] 🗑️ Clearing session (logout)...');
        
        return new Promise((resolve) => {
            chrome.storage.sync.remove(['jobOrbitSession', 'jobOrbitAuth'], () => {
                chrome.storage.local.remove(['jobOrbitSession', 'jobOrbitAuth'], () => {
                    console.log('[SessionManager] ✅ Session cleared');
                    resolve({ success: true });
                });
            });
        });
    }

    /**
     * Get session summary for UI display
     */
    static async getSessionSummary() {
        console.log('[SessionManager] 📊 Generating session summary...');
        
        const sessionResult = await this.getSession();
        const validResult = await this.isSessionValid();
        
        if (!sessionResult.success) {
            return {
                authenticated: false,
                message: 'Not logged in'
            };
        }
        
        const session = sessionResult.session;
        const timeToExpiry = session.expiresAt - Date.now();
        const hoursToExpiry = Math.round(timeToExpiry / (1000 * 60 * 60));
        
        return {
            authenticated: true,
            valid: validResult.valid,
            user: {
                name: session.user?.name || 'User',
                email: session.user?.email || '',
                id: session.userId || ''
            },
            token: {
                expiresAt: new Date(session.expiresAt).toISOString(),
                expiresIn: hoursToExpiry + ' hours',
                isStale: validResult.isStale
            },
            session: {
                createdAt: new Date(session.createdAt).toLocaleString(),
                lastVerifiedAt: session.lastVerifiedAt ? new Date(session.lastVerifiedAt).toLocaleTimeString() : 'Never',
                lastSyncAt: session.lastSyncAt ? new Date(session.lastSyncAt).toLocaleTimeString() : 'Never'
            },
            syncStatus: session.syncStatus,
            cloudSyncStatus: session.cloudSyncStatus
        };
    }

    /**
     * Debug session state
     */
    static async debugSessionState() {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 SESSION MANAGER DEBUG REPORT');
        console.log('='.repeat(70));
        
        const sessionResult = await this.getSession();
        console.log('\n📋 Session Data:');
        console.log('  Found:', sessionResult.success);
        console.log('  Source:', sessionResult.source);
        
        if (sessionResult.success) {
            const session = sessionResult.session;
            console.log('  User Email:', session.user?.email);
            console.log('  Token:', session.extensionToken ? session.extensionToken.substring(0, 30) + '...' : 'MISSING');
            console.log('  Created:', new Date(session.createdAt).toLocaleString());
            console.log('  Expires At:', new Date(session.expiresAt).toLocaleString());
            console.log('  Time to Expiry:', Math.round((session.expiresAt - Date.now()) / 1000), 'seconds');
        }
        
        const validResult = await this.isSessionValid();
        console.log('\n🔐 Session Validity:');
        console.log('  Valid:', validResult.valid);
        console.log('  Reason:', validResult.reason || 'N/A');
        console.log('  Stale:', validResult.isStale || false);
        
        const verifyResult = await this.verifySession();
        console.log('\n✅ Backend Verification:');
        console.log('  Verified:', verifyResult.verified);
        console.log('  Reason:', verifyResult.reason || 'N/A');
        
        const cachedResult = await this.getCachedUserData();
        console.log('\n💾 Cached Data:');
        console.log('  Profile Fields:', Object.keys(cachedResult.profile || {}).length);
        console.log('  Resumes:', cachedResult.resumes?.length || 0);
        console.log('  Applications:', cachedResult.applications?.length || 0);
        console.log('  Answers:', cachedResult.answers?.length || 0);
        console.log('  Last Sync:', cachedResult.lastSyncAt || 'Never');
        console.log('  Sync Status:', cachedResult.syncStatus);
        console.log('  Cloud Sync Status:', cachedResult.cloudSyncStatus);
        
        console.log('\n' + '='.repeat(70));
    }
}

// Export for use
if (typeof globalThis !== 'undefined') {
    globalThis.SessionManager = SessionManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}
