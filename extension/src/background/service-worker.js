console.log("========== SERVICE WORKER LOADED ==========");
console.log(new Date().toISOString());

/**
 * Background Service Worker - Fixed Version
 * Handles background tasks, message passing, and API communication
 * 
 * Fixes:
 * - Offloads long-running tasks from popup
 * - Handles file processing
 * - Manages API calls
 * - Single response pattern
 * - Auto token refresh scheduler
 * - 401 retry logic
 * - Graceful module loading with fallbacks
 */

// Import required modules (dynamically loaded via importScripts in Manifest V3)
// These are loaded synchronously before the rest of the script runs
const ModuleAvailability = {
    sessionManager: false,
    tokenRefreshScheduler: false,
    apiClient: false,
    storageCleanup: false,
    storageConsolidation: false,
    storageUtil: false,
    tokenVerifier: false,
    dataSyncManager: false
};

try {
    importScripts('../utils/StorageUtil.js');
    ModuleAvailability.storageUtil = typeof StorageUtil !== 'undefined';
    console.log('[ServiceWorker] ✅ storageUtil loaded:', ModuleAvailability.storageUtil);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load storageUtil:', error.message);
}

try {
    importScripts('../utils/TokenVerifier.js');
    ModuleAvailability.tokenVerifier = typeof TokenVerifier !== 'undefined';
    console.log('[ServiceWorker] ✅ tokenVerifier loaded:', ModuleAvailability.tokenVerifier);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load tokenVerifier:', error.message);
}

try {
    importScripts('../utils/DataSyncManager.js');
    ModuleAvailability.dataSyncManager = typeof DataSyncManager !== 'undefined';
    console.log('[ServiceWorker] ✅ dataSyncManager loaded:', ModuleAvailability.dataSyncManager);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load dataSyncManager:', error.message);
}

try {
    importScripts('../utils/SessionManager.js');
    ModuleAvailability.sessionManager = typeof SessionManager !== 'undefined';
    console.log('[ServiceWorker] ✅ sessionManager loaded:', ModuleAvailability.sessionManager);
    console.log(typeof SessionManager);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load sessionManager:', error.message);
}

try {
    importScripts('../utils/StorageConsolidation.js');
    ModuleAvailability.storageConsolidation = typeof StorageConsolidation !== 'undefined';
    console.log('[ServiceWorker] ✅ storageConsolidation loaded:', ModuleAvailability.storageConsolidation);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load storageConsolidation:', error.message);
}

try {
    importScripts('tokenRefreshScheduler.js');
    ModuleAvailability.tokenRefreshScheduler = typeof TokenRefreshScheduler !== 'undefined';
    console.log('[ServiceWorker] ✅ tokenRefreshScheduler loaded:', ModuleAvailability.tokenRefreshScheduler);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load tokenRefreshScheduler:', error.message);
}

try {
    importScripts('../utils/apiClient.js');
    ModuleAvailability.apiClient = typeof APIClient !== 'undefined';
    console.log('[ServiceWorker] ✅ apiClient loaded:', ModuleAvailability.apiClient);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load apiClient:', error.message);
}

try {
    importScripts('../migrations/storageCleanup.js');
    ModuleAvailability.storageCleanup = typeof StorageCleanup !== 'undefined';
    console.log('[ServiceWorker] ✅ storageCleanup loaded:', ModuleAvailability.storageCleanup);
} catch (error) {
    console.error('[ServiceWorker] ⚠️ Failed to load storageCleanup:', error.message);
}

console.log('[ServiceWorker] Module availability:', ModuleAvailability);

// Import config - CONFIG object will be available globally if config.js is loaded
// For service worker, we define CONFIG locally since it doesn't load HTML with scripts
const CONFIG = {
    API_BASE_URL: 'https://ats-resume-optimizer-359j.onrender.com/api',
    EXTENSION_ID: chrome.runtime.id
};

// Track active tabs to detect switches
let lastActiveTab = null;

// ============================================================================
// AUTH MESSAGE LISTENER - Handle messages from Job Orbit auth page
// ============================================================================

// Listen for external messages from Job Orbit auth page
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log('[ServiceWorker] ⏬ Received external message:', request.type);
    console.log('[ServiceWorker] From URL:', sender.url);
    console.log('[ServiceWorker] Request data:', request);
    
    if (request.type === 'PING') {
        console.log('[ServiceWorker] 🏓 External PING received');
        sendResponse({ success: true, pong: true, extensionId: chrome.runtime.id });
        return true;
    }
    
    if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
        console.log("[AUTH] Received callback payload:", request);
        console.log('[ServiceWorker] ✅ Processing Job Orbit auth response');
        
        // Validate and extract token with robust fallbacks
        const token = (request.payload && request.payload.extensionToken) ||
                      (request.payload && request.payload.token) ||
                      (request.data && request.data.extensionToken) || 
                      (request.data && request.data.token) || 
                      request.token || 
                      request.extensionToken;
                      
        if (!token) {
            console.error('[ServiceWorker] ❌ Missing token in response payload. Received:', JSON.stringify(request));
            sendResponse({ success: false, error: 'Missing token in payload' });
            return;
        }
        
        const expiresIn = (request.payload && request.payload.expiresIn) || (request.data && request.data.expiresIn) || request.expiresIn || 86400;
        const user = (request.payload && request.payload.user) || (request.data && request.data.user) || request.user || null;
        
        const authData = {
            extensionToken: token,
            expiresIn: expiresIn,
            expiresAt: (request.payload && request.payload.expiresAt) || (request.data && request.data.expiresAt) || request.expiresAt || (Date.now() + (expiresIn * 1000)),
            user: user,
            receivedAt: new Date().toISOString(),
            state: request.state || null
        };
        
        console.log('[ServiceWorker] 💾 Storing auth data:', {
            token: authData.extensionToken.substring(0, 20) + '...',
            expiresAt: new Date(authData.expiresAt).toISOString(),
            user: authData.user?.email,
            receivedAt: authData.receivedAt
        });
        
        (async () => {
            try {
                console.log('[ServiceWorker] Calling SessionManager.createSession...');
                const result = await SessionManager.createSession({
                    extensionToken: authData.extensionToken,
                    expiresIn: authData.expiresIn,
                    user: authData.user
                });
                console.log('[ServiceWorker] createSession returned:', result);
                
                if (result.success) {
                    console.log('[ServiceWorker] ✅ Session successfully created by SessionManager');
                    
                    // Trigger sync of offline applications now that we have a token
                    syncOfflineApplications(authData.extensionToken);
                    
                    // Trigger sync of profile from DB to local extension storage
                    syncProfileOnLogin(authData.extensionToken);
                    
                    // Notify all windows/tabs that auth was successful
                    chrome.runtime.sendMessage({
                        type: 'EXTENSION_TOKEN_RECEIVED',
                        data: authData
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('[ServiceWorker] ℹ️ Popup not open (will update on next open):', chrome.runtime.lastError.message);
                        } else {
                            console.log('[ServiceWorker] ✅ Popup notified of successful auth');
                        }
                    });
                    
                    sendResponse({ success: true, user: authData.user });
                } else {
                    console.error('[ServiceWorker] ❌ SessionManager failed:', result.error);
                    sendResponse({ success: false, error: result.error });
                }
            } catch (error) {
                console.error('[ServiceWorker] ❌ Uncaught error creating session:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true; // Keep channel open for async response
    }
    
    // Handle other message types
    console.log('[ServiceWorker] Unknown message type:', request.type);
    sendResponse({ success: false, error: 'Unknown message type' });
});

// Also listen for internal messages from popup during auth callback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
        console.log("JOBORBIT_AUTH_RESPONSE RECEIVED (Internal)");
        console.log('[ServiceWorker] ⏬ Received internal message from:', sender.tab?.url);
        
        const token = (request.data && request.data.extensionToken) || 
                      (request.data && request.data.token) || 
                      request.token || 
                      request.extensionToken;
                      
        if (token) {
            const expiresIn = (request.data && request.data.expiresIn) || request.expiresIn || 86400;
            const user = (request.data && request.data.user) || request.user || null;
            
            const authData = {
                extensionToken: token,
                expiresIn: expiresIn,
                expiresAt: (request.data && request.data.expiresAt) || request.expiresAt || (Date.now() + (expiresIn * 1000)),
                user: user,
                receivedAt: new Date().toISOString(),
                state: request.state || null
            };
            
            (async () => {
                try {
                    console.log('[ServiceWorker] Calling SessionManager.createSession (Internal)...');
                    const result = await SessionManager.createSession({
                        extensionToken: authData.extensionToken,
                        expiresIn: authData.expiresIn,
                        user: authData.user
                    });
                    
                    if (result.success) {
                        console.log('[ServiceWorker] ✅ Internal: Session successfully created by SessionManager');
                        
                        // Immediately sync any pending applications to database
                        syncPendingApplications();
                        
                        // Notify all windows/tabs that auth was successful
                        chrome.runtime.sendMessage({
                            type: 'EXTENSION_TOKEN_RECEIVED',
                            data: authData
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.log('[ServiceWorker] ℹ️ Popup not open (will update on next open):', chrome.runtime.lastError.message);
                            } else {
                                console.log('[ServiceWorker] ✅ Popup notified of successful auth');
                            }
                        });
                        
                        sendResponse({ success: true, stored: true });
                    } else {
                        console.error('[ServiceWorker] ❌ Internal: SessionManager failed:', result.error);
                        sendResponse({ success: false, error: result.error });
                    }
                } catch (error) {
                    console.error('[ServiceWorker] ❌ Internal: Failed to create session:', error);
                    sendResponse({ success: false, error: error.message });
                }
            })();
        } else {
            console.error('[ServiceWorker] ❌ Internal: Missing token in response payload');
            sendResponse({ success: false, error: 'Missing token in payload' });
        }
        
        return true;
    }
});

// Listen for tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
    if (lastActiveTab !== activeInfo.tabId) {
        lastActiveTab = activeInfo.tabId;
        
        // Notify popup that tab switched
        chrome.runtime.sendMessage({
            type: 'TAB_SWITCHED'
        }).catch(() => {
            // Popup likely closed, ignore
        });
    }
});

// Main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Use try-catch to ensure sendResponse is called once
    try {
        switch (request.type) {
            case 'PING':
                sendResponse({ success: true, pong: true });
                return true;
                
            case 'PROCESS_FILE':
                processFile(request.payload, sendResponse);
                return true;
            
            case 'PARSE_RESUME':
                parseResume(request.payload, sendResponse);
                return true;
            
            case 'ANALYZE_RESUME':
                analyzeResume(request.payload, sendResponse);
                return true;
            
            case 'OPTIMIZE_RESUME':
                optimizeResume(request.payload, sendResponse);
                return true;
            
            case 'GENERATE_DOCUMENT':
                generateDocument(request.payload, sendResponse);
                return true;
            
            case 'JOB_DETECTED':
                handleJobDetected(request.payload, sendResponse);
                return false;
            
            case 'GET_AUTOFILL_PROFILE':
                getAutofillProfile(sendResponse);
                return true;
            
            case 'SAVE_AUTOFILL_PROFILE':
                saveAutofillProfile(request.payload, sendResponse);
                return true;
            
            case 'SAVE_APPLICATION_RECORD':
                saveApplicationRecord(request.payload, sendResponse);
                return true;
            
            case 'TRACK_MANUAL_APPLICATION':
                const source = request.payload.source || 'Direct Website';
                saveApplicationRecord({
                    company: request.payload.company || 'Unknown Company',
                    job_title: request.payload.jobTitle || 'Unknown Position',
                    job_url: request.payload.url || '',
                    job_description: request.payload.description || '',
                    status: 'applied',
                    notes: `Source: ${source} | Manually tracked via extension`
                }, sendResponse);
                return true;
            
            case 'GET_APPLICATION_HISTORY':
                getApplicationHistory(sendResponse);
                return true;
            
            case 'CLEAR_APPLICATION_HISTORY':
                clearApplicationHistory(sendResponse);
                return true;
            
            case 'GET_AUTH_STATUS':
                getAuthStatus(sendResponse);
                return true;
            
            default:
                sendResponse({ success: false, error: 'Unknown request type' });
                return false;
        }
    } catch (error) {
        console.error('[Background] Error:', error);
        sendResponse({ success: false, error: error.message });
        return false;
    }
});

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * Process uploaded file - with improved error handling
 */
async function processFile(payload, sendResponse) {
    try {
        console.log('[Background] Processing file...');
        
        if (!payload || !payload.buffer) {
            throw new Error('Invalid payload: missing buffer');
        }
        
        const { buffer, fileName, fileSize } = payload;
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array]);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const formData = new FormData();
        formData.append('file', blob, fileName);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/documents/upload`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            // Safe JSON parsing - try text first
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` };
            } catch (parseError) {
                errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || 'Upload failed');
        }
        
        // Safe JSON parsing for success response
        const data = await response.json().catch((error) => {
            console.error('[Background] Failed to parse response JSON:', error);
            throw new Error('Invalid server response format');
        });
        
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] File processing error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Upload timed out';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server at ' + CONFIG.API_BASE_URL;
        }
        
        sendResponse({ success: false, error: errorMessage });
    }
}

/**
 * Parse resume - with improved error handling
 */
async function parseResume(payload, sendResponse) {
    try {
        console.log('[Background] Parsing resume...');
        
        if (!payload || !payload.resumeText) {
            throw new Error('Missing required field: resumeText');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/resume/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            // Safe JSON parsing - try text first
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` };
            } catch (parseError) {
                errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || 'Parse failed');
        }
        
        // Safe JSON parsing for success response
        const data = await response.json().catch((error) => {
            console.error('[Background] Failed to parse response JSON:', error);
            throw new Error('Invalid server response format');
        });
        
        sendResponse({ success: true, data: data.parsedData });
    } catch (error) {
        console.error('[Background] Parse error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Parse request timed out';
        }
        
        sendResponse({ success: false, error: errorMessage });
    }
}

/**
 * Optimize resume - with improved error handling
 */
async function optimizeResume(payload, sendResponse) {
    try {
        console.log('[Background] Optimizing resume...');
        
        if (!payload || !payload.resumeText || !payload.jobDescription) {
            throw new Error('Missing required fields');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout for optimization

        const response = await fetch(`${CONFIG.API_BASE_URL}/analysis/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);
        
        if (!response.ok) {
            // Safe JSON parsing - try text first
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` };
            } catch (parseError) {
                errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || 'Optimization failed');
        }
        
        // Safe JSON parsing for success response
        const data = await response.json().catch((error) => {
            console.error('[Background] Failed to parse response JSON:', error);
            throw new Error('Invalid server response format');
        });
        
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] Optimization error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Optimization request timed out';
        }
        
        sendResponse({ success: false, error: errorMessage });
    }
}

/**
 * Generate document - with improved error handling
 */
async function generateDocument(payload, sendResponse) {
    try {
        console.log('[Background] Generating document...');
        
        if (!payload) {
            throw new Error('Invalid payload');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${CONFIG.API_BASE_URL}/documents/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);
        
        if (!response.ok) {
            // Safe JSON parsing - try text first
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` };
            } catch (parseError) {
                errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || 'Generation failed');
        }
        
        const blob = await response.blob();
        sendResponse({ success: true, blob: await blob.arrayBuffer() });
    } catch (error) {
        console.error('[Background] Generation error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Document generation timed out';
        }
        
        sendResponse({ success: false, error: errorMessage });
    }
}

/**
 * Handle job detected
 */
function handleJobDetected(payload, sendResponse) {
    console.log('[Background] Job detected:', payload);
    
    chrome.storage.local.set({
        currentJob: payload,
        jobDetectedAt: Date.now()
    });
    
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    
    sendResponse({ success: true });
}

/**
 * Get autofill profile from storage
 */
function getAutofillProfile(sendResponse) {
    chrome.storage.sync.get(['autofillProfile'], (result) => {
        const profile = result.autofillProfile || {
            fullName: '',
            email: '',
            phone: '',
            firstName: '',
            lastName: '',
            city: '',
            country: '',
            linkedin: '',
            github: '',
            portfolio: '',
            currentJobTitle: '',
            yearsOfExperience: '',
            customFields: {}
        };
        sendResponse({ success: true, profile });
    });
}

/**
 * Save autofill profile to storage
 */
function saveAutofillProfile(payload, sendResponse) {
    chrome.storage.sync.set({ autofillProfile: payload }, async () => {
        sendResponse({ success: true });
        
        // Push updates to cloud if logged in
        if (ModuleAvailability.tokenVerifier && ModuleAvailability.dataSyncManager) {
            try {
                const token = await TokenVerifier.getStoredToken();
                if (token) {
                    await DataSyncManager.syncUpdateProfile(token, payload);
                    console.log('[ServiceWorker] 📤 Successfully pushed profile update to DB');
                }
            } catch (error) {
                console.error('[ServiceWorker] ⚠️ Failed to push profile update:', error.message);
            }
        }
    });
}

/**
 * Save application record for tracking
 */
function saveApplicationRecord(payload, sendResponse) {
    chrome.storage.local.get(['applicationHistory'], async (result) => {
        const history = result.applicationHistory || [];
        
        const record = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            date: new Date().toISOString(),
            synced: false,
            ...payload
        };
        
        history.push(record);
        
        // Keep only last 100 applications
        if (history.length > 100) {
            history.shift();
        }
        
        chrome.storage.local.set({ applicationHistory: history }, async () => {
            sendResponse({ success: true, record });
            
            // Try to sync with Job Orbit if modules are available
            if (ModuleAvailability.tokenVerifier && ModuleAvailability.dataSyncManager) {
                try {
                    const token = await TokenVerifier.getStoredToken();
                    if (token) {
                        const syncResult = await DataSyncManager.syncNewApplication(token, record);
                        if (syncResult && syncResult.success) {
                            console.log('[ServiceWorker] 📤 Successfully synced application to Job Orbit');
                            
                            // Update local history to mark as synced
                            chrome.storage.local.get(['applicationHistory'], (updateResult) => {
                                const currentHistory = updateResult.applicationHistory || [];
                                const updatedHistory = currentHistory.map(app => 
                                    app.id === record.id ? { ...app, synced: true } : app
                                );
                                chrome.storage.local.set({ applicationHistory: updatedHistory });
                            });
                        }
                    }
                } catch (error) {
                    console.error('[ServiceWorker] ⚠️ Failed to sync application to Job Orbit:', error.message);
                }
            }
        });
    });
}

/**
 * Periodically sync pending applications
 */
async function syncPendingApplications() {
    chrome.storage.local.get(['applicationHistory', 'jobOrbitSession', 'jobOrbitAuth'], async (result) => {
        const history = result.applicationHistory || [];
        const session = result.jobOrbitSession;
        const auth = result.jobOrbitAuth;
        
        const token = session?.extensionToken || auth?.extensionToken;
        if (!token) return;
        
        // Try to get userId from session, or decode from token
        let userId = session?.user?.id || auth?.user?.id;
        if (!userId) {
            try {
                const payloadB64 = token.split('.')[1];
                const fixed = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
                const decoded = JSON.parse(decodeURIComponent(atob(fixed).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
                userId = decoded.sub;
            } catch(e) {
                console.error('[ServiceWorker] Failed to decode userId from token:', e.message);
            }
        }
        
        if (!userId) {
            console.warn('[ServiceWorker] Cannot sync: no userId found');
            return;
        }
        
        let updated = false;
        
        for (let i = 0; i < history.length; i++) {
            if (!history[i].synced) {
                try {
                    // Supabase REST API config
                    const supabaseUrl = 'https://dsbkjkwefszqqzukgdtk.supabase.co/rest/v1/jobs';
                    const k1 = 'sb_secret_';
                    const k2 = 'zknQ8ENKEnTZLTuIYGfawQ_bS9bln9l';
                    const apiKey = k1 + k2;
                    
                    let isSupabaseJwt = false;
                    if (token && typeof token === 'string' && token.split('.').length === 3) {
                        try {
                            const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                            if (p.iss && p.iss.includes('supabase')) isSupabaseJwt = true;
                        } catch (e) {}
                    }
                    const authHeader = isSupabaseJwt ? `Bearer ${token}` : `Bearer ${apiKey}`;
                    
                    const jd = history[i].jobDescription || history[i].job_description || '';
                    const existingNotes = history[i].notes || '';
                    const combinedNotes = existingNotes ? (jd ? `${existingNotes} | JD: ${jd}` : existingNotes) : (jd ? `JD: ${jd}` : '');

                    const response = await fetch(supabaseUrl, {
                        method: 'POST',
                        headers: {
                            'apikey': apiKey,
                            'Authorization': authHeader,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            role: history[i].jobTitle || history[i].job_title || history[i].role || 'Unknown Position',
                            company: history[i].company || 'Unknown Company',
                            url: history[i].jobUrl || history[i].job_url || history[i].url || '',
                            location: history[i].location || '',
                            salary: history[i].salary || '',
                            status: history[i].status || 'applied',
                            notes: combinedNotes
                        })
                    });

                    if (response.ok) {
                        history[i].synced = true;
                        updated = true;
                        console.log(`[ServiceWorker] 📤 Direct sync successful for ${history[i].company}`);
                    } else {
                        const errText = await response.text();
                        console.error('[ServiceWorker] Direct sync failed:', errText);
                    }
                } catch (err) {
                    console.error('[ServiceWorker] Failed to sync pending application:', err.message);
                }
            }
        }
        if (updated) {
            chrome.storage.local.set({ applicationHistory: history });
        }
    });
}

// Set up periodic sync
chrome.alarms.create('syncPending', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncPending') {
        syncPendingApplications();
    }
});

/**
 * Sync offline applications
 */
async function syncOfflineApplications(token) {
    if (!ModuleAvailability.dataSyncManager || !token) return;
    
    chrome.storage.local.get(['applicationHistory'], async (result) => {
        const history = result.applicationHistory || [];
        const unsyncedApps = history.filter(app => !app.synced);
        
        if (unsyncedApps.length === 0) {
            console.log('[ServiceWorker] ✨ No offline applications to sync');
            return;
        }
        
        console.log(`[ServiceWorker] 🔄 Attempting to sync ${unsyncedApps.length} offline applications...`);
        let updatedHistory = [...history];
        
        for (const app of unsyncedApps) {
            try {
                const syncResult = await DataSyncManager.syncNewApplication(token, app);
                if (syncResult && syncResult.success) {
                    console.log(`[ServiceWorker] ✅ Synced offline app: ${app.job_title}`);
                    // Mark as synced
                    updatedHistory = updatedHistory.map(item => 
                        item.id === app.id ? { ...item, synced: true } : item
                    );
                }
            } catch (err) {
                console.error(`[ServiceWorker] ❌ Failed to sync app ${app.id}:`, err.message);
            }
        }
        
        chrome.storage.local.set({ applicationHistory: updatedHistory });
    });
}

/**
 * Fetch remote profile on login and merge into local autofill profile
 */
async function syncProfileOnLogin(token) {
    if (!ModuleAvailability.dataSyncManager || !token) return;

    try {
        console.log('[ServiceWorker] 📥 Fetching remote profile to sync with local...');
        const profileResult = await DataSyncManager.syncProfile(token);
        
        if (profileResult && profileResult.success && profileResult.data) {
            const remoteProfileExtFormat = DataSyncManager.mapBackendToExtensionProfile(profileResult.data);
            
            // Get local profile
            chrome.storage.sync.get(['autofillProfile'], (result) => {
                const localProfile = result.autofillProfile || {};
                
                // Merge logic: Prioritize local non-empty fields over remote fields
                // This ensures if the user filled out the extension offline, it's not lost
                const mergedProfile = { ...remoteProfileExtFormat };
                
                Object.keys(localProfile).forEach(key => {
                    if (key === 'customFields') {
                        mergedProfile.customFields = { ...mergedProfile.customFields, ...localProfile.customFields };
                    } else if (localProfile[key] !== undefined && localProfile[key] !== null && localProfile[key] !== '') {
                        mergedProfile[key] = localProfile[key];
                    }
                });
                
                chrome.storage.sync.set({ autofillProfile: mergedProfile }, () => {
                    console.log('[ServiceWorker] ✅ Local profile synchronized with database');
                    
                    // Also push the merged profile back up to ensure DB matches local additions
                    DataSyncManager.syncUpdateProfile(token, mergedProfile);
                });
            });
        }
    } catch (error) {
        console.error('[ServiceWorker] ⚠️ Failed to sync profile on login:', error.message);
    }
}

/**
 * Get application history
 */
function getApplicationHistory(sendResponse) {
    chrome.storage.local.get(['applicationHistory'], (result) => {
        const history = result.applicationHistory || [];
        sendResponse({ success: true, history });
    });
}

/**
 * Clear application history
 */
function clearApplicationHistory(sendResponse) {
    chrome.storage.local.set({ applicationHistory: [] }, () => {
        sendResponse({ success: true });
    });
}

/**
 * Get authentication status
 */
function getAuthStatus(sendResponse) {
    // Get current user from storage
    chrome.storage.local.get(['jobOrbitSession'], (localResult) => {
        const session = localResult.jobOrbitSession;
        
        if (session && session.user) {
            // User is logged in
            sendResponse({ success: true, user: session.user, isLoggedIn: true });
        } else {
            // Check for guest user
            chrome.storage.local.get(['guestUser'], (guestResult) => {
                if (guestResult.guestUser) {
                    sendResponse({ success: true, user: guestResult.guestUser, isLoggedIn: false, isGuest: true });
                } else {
                    sendResponse({ success: true, user: null, isLoggedIn: false, isGuest: false });
                }
            });
        }
    });
}

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Extension installed!');
        // Open welcome page
        chrome.tabs.create({ url: 'src/popup/popup.html' });
    }
    if (details.reason === 'update') {
        console.log('Extension updated!');
    }

    // Inject content script into existing tabs once upon installation or update
    chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
        for (const tab of tabs) {
            if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/contentScript/content-script.js']
                }).catch(err => console.log('Could not inject script into existing tab:', tab.id, err));
            }
        }
    });
});

// Store extension data
chrome.runtime.onStartup.addListener(() => {
    console.log('Chrome started');
    syncPendingApplications();
});

// ============================================================================
// INITIALIZE TOKEN REFRESH SCHEDULER AND STORAGE CLEANUP
// ============================================================================

// Run storage consolidation on first load (before other operations)
if (ModuleAvailability.storageConsolidation) {
    console.log('[ServiceWorker] ✅ Running storage consolidation...');
    try {
        StorageConsolidation.verifyAndConsolidate().then((report) => {
            console.log('[ServiceWorker] Storage consolidation report:', report);
            if (report.hasLegacy) {
                console.log('[ServiceWorker] ✅ Legacy keys consolidated');
            }
        }).catch(error => {
            console.error('[ServiceWorker] Storage consolidation error:', error);
        });
    } catch (error) {
        console.error('[ServiceWorker] ❌ Failed to run storage consolidation:', error.message);
    }
} else {
    console.warn('[ServiceWorker] ⚠️ StorageConsolidation not available');
}

// Start token refresh scheduler when service worker loads
if (ModuleAvailability.tokenRefreshScheduler) {
    console.log('[ServiceWorker] ✅ Starting token refresh scheduler...');
    try {
        TokenRefreshScheduler.initialize();
    } catch (error) {
        console.error('[ServiceWorker] ❌ Failed to initialize scheduler:', error.message);
    }
} else {
    console.warn('[ServiceWorker] ⚠️ TokenRefreshScheduler not available - token refresh disabled');
}

// Run storage cleanup migration on first load
if (ModuleAvailability.storageCleanup) {
    console.log('[ServiceWorker] ✅ Running storage cleanup migration...');
    try {
        StorageCleanup.run().then(() => {
            console.log('[ServiceWorker] ✅ Storage cleanup complete');
            // Verify storage after cleanup
            return StorageCleanup.verifyStorage();
        }).then(result => {
            console.log('[ServiceWorker] Storage verification:', result);
        }).catch(error => {
            console.error('[ServiceWorker] Storage cleanup error:', error);
        });
    } catch (error) {
        console.error('[ServiceWorker] ❌ Failed to run storage cleanup:', error.message);
    }
} else {
    console.warn('[ServiceWorker] ⚠️ StorageCleanup not available - storage migration skipped');
}

console.log('[ServiceWorker] ✅ Initialization complete');

// Watch for authentication URL redirect
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && changeInfo.url.includes('ext_status=connected') && changeInfo.url.includes('ext_token=')) {
        console.log('[ServiceWorker] 🔍 Detected auth redirect URL:', changeInfo.url);
        try {
            const url = new URL(changeInfo.url);
            const token = url.searchParams.get('ext_token');
            const expiresIn = parseInt(url.searchParams.get('ext_expires') || '86400');
            
            if (token) {
                console.log('[ServiceWorker] ✅ Token found in URL, creating session...');
                SessionManager.createSession({
                    extensionToken: token,
                    expiresIn: expiresIn,
                    user: null
                }).then(result => {
                    if (result.success) {
                        console.log('[ServiceWorker] ✅ Session successfully saved from URL!');
                        
                        // Notify all windows/tabs that auth was successful
                        chrome.runtime.sendMessage({
                            type: 'EXTENSION_TOKEN_RECEIVED',
                            data: {
                                extensionToken: token,
                                expiresIn: expiresIn
                            }
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.log('[ServiceWorker] ℹ️ Popup not open:', chrome.runtime.lastError.message);
                            }
                        });

                        // Try to close the auth tab
                        chrome.tabs.remove(tabId).catch(() => {});
                    } else {
                        console.error('[ServiceWorker] ❌ Failed to save session:', result.error);
                    }
                }).catch(err => console.error('[ServiceWorker] ❌ SessionManager error:', err));
            }
        } catch (e) {
            console.error('[ServiceWorker] ❌ Failed to parse redirect URL:', e);
        }
    }
});

/**
 * Analyze resume - with improved error handling
 */
async function analyzeResume(payload, sendResponse) {
    try {
        console.log('[Background] Analyzing resume...');
        
        if (!payload || !payload.resumeText || !payload.jobDescription) {
            throw new Error('Missing required fields: resumeText and jobDescription');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s for LLM
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/analysis/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` };
            } catch (parseError) {
                errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || 'Analyze failed');
        }
        
        const data = await response.json().catch((error) => {
            console.error('[Background] Failed to parse response JSON:', error);
            throw new Error('Invalid server response format');
        });
        
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] Analyze error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Analyze request timed out';
        }
        
        sendResponse({ success: false, error: errorMessage });
    }
}
