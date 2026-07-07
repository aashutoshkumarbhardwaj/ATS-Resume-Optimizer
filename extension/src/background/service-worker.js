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
    storageConsolidation: false
};

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
    
    if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
        console.log("JOBORBIT_AUTH_RESPONSE RECEIVED");
        console.log(request);
        console.log('[ServiceWorker] ✅ Processing Job Orbit auth response');
        
        // Validate required data
        if (!request.data || !request.data.extensionToken) {
            console.error('[ServiceWorker] ❌ Missing extensionToken in response');
            sendResponse({ success: false, error: 'Missing token' });
            return;
        }
        
        const authData = {
            extensionToken: request.data.extensionToken,
            expiresIn: request.data.expiresIn || 86400,
            expiresAt: request.data.expiresAt || (Date.now() + ((request.data.expiresIn || 86400) * 1000)),
            user: request.data.user || null,
            receivedAt: new Date().toISOString(),
            state: request.state || null
        };
        
        console.log('[ServiceWorker] 💾 Storing auth data:', {
            token: authData.extensionToken.substring(0, 20) + '...',
            expiresAt: new Date(authData.expiresAt).toISOString(),
            user: authData.user?.email,
            receivedAt: authData.receivedAt
        });
        
        // Store in SYNC storage (persists across sessions)
        (async () => {
            console.log(JSON.stringify(request.data, null, 2));
            console.log("Calling SessionManager.createSession...");
            const result = await SessionManager.createSession({
                extensionToken: authData.extensionToken,
                expiresIn: authData.expiresIn,
                user: authData.user
            });
            console.log("createSession returned:");
            console.log(result);
    
            chrome.storage.sync.get(null, (result) => {
                console.log(result);
            });

            chrome.storage.sync.set({ jobOrbitAuth: authData }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[ServiceWorker] ❌ Failed to store in sync:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                
                console.log('[ServiceWorker] ✅ Stored in chrome.storage.sync');
                
                // Also store in LOCAL storage as backup
                chrome.storage.local.set({ jobOrbitAuth: authData }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[ServiceWorker] ⚠️ Failed to store in local:', chrome.runtime.lastError);
                    } else {
                        console.log('[ServiceWorker] ✅ Stored in chrome.storage.local');
                    }
                });
                
                // Notify all windows/tabs that auth was successful
                chrome.runtime.sendMessage({
                    type: 'EXTENSION_TOKEN_RECEIVED',
                    data: authData
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('[ServiceWorker] ℹ️ Popup not open (will update on next open):', chrome.runtime.lastError.message);
                    } else {
                        console.log('[ServiceWorker] ✅ Popup notified of token arrival');
                    }
                });
                
                // Send success response to auth page
                sendResponse({ 
                    success: true, 
                    message: 'Token stored successfully',
                    stored: {
                        sync: true,
                        local: true,
                        timestamp: authData.receivedAt
                    }
                });
            });
        })().catch((error) => {
            console.error('[ServiceWorker] ❌ Failed to create session:', error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Keep channel open for async response
    }
    
    // Handle other message types
    console.log('[ServiceWorker] Unknown message type:', request.type);
    sendResponse({ success: false, error: 'Unknown message type' });
});

// Also listen for internal messages from popup during auth callback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
        console.log("JOBORBIT_AUTH_RESPONSE RECEIVED");
        console.log(request);
        console.log('[ServiceWorker] ⏬ Received internal message from:', sender.tab?.url);
        
        if (request.data && request.data.extensionToken) {
            const authData = {
                extensionToken: request.data.extensionToken,
                expiresIn: request.data.expiresIn || 86400,
                expiresAt: request.data.expiresAt || (Date.now() + ((request.data.expiresIn || 86400) * 1000)),
                user: request.data.user || null,
                receivedAt: new Date().toISOString(),
                state: request.state || null
            };
            
            (async () => {
                console.log(JSON.stringify(request.data, null, 2));
                console.log("Calling SessionManager.createSession...");
                const result = await SessionManager.createSession({
                    extensionToken: authData.extensionToken,
                    expiresIn: authData.expiresIn,
                    user: authData.user
                });
                console.log("createSession returned:");
                console.log(result);
    
                chrome.storage.sync.get(null, (result) => {
                    console.log(result);
                });

                chrome.storage.sync.set({ jobOrbitAuth: authData }, () => {
                    console.log('[ServiceWorker] ✅ Internal: Stored in chrome.storage.sync');
                    sendResponse({ success: true, stored: true });
                });
            })().catch((error) => {
                console.error('[ServiceWorker] ❌ Internal: Failed to create session:', error);
                sendResponse({ success: false, error: error.message });
            });
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
    chrome.storage.sync.set({ autofillProfile: payload }, () => {
        sendResponse({ success: true });
    });
}

/**
 * Save application record for tracking
 */
function saveApplicationRecord(payload, sendResponse) {
    chrome.storage.local.get(['applicationHistory'], (result) => {
        const history = result.applicationHistory || [];
        
        const record = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...payload
        };
        
        history.push(record);
        
        // Keep only last 100 applications
        if (history.length > 100) {
            history.shift();
        }
        
        chrome.storage.local.set({ applicationHistory: history }, () => {
            sendResponse({ success: true, record });
        });
    });
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
    chrome.storage.sync.get(['supabaseUser'], (syncResult) => {
        const user = syncResult.supabaseUser;
        
        if (user) {
            // User is logged in
            sendResponse({ success: true, user, isLoggedIn: true });
        } else {
            // Check for guest user
            chrome.storage.local.get(['guestUser'], (localResult) => {
                if (localResult.guestUser) {
                    sendResponse({ success: true, user: localResult.guestUser, isLoggedIn: false, isGuest: true });
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
