/**
 * Background Service Worker - Fixed Version
 * Handles background tasks, message passing, and API communication
 * 
 * Fixes:
 * - Offloads long-running tasks from popup
 * - Handles file processing
 * - Manages API calls
 * - Single response pattern
 */

const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';

// Track active tabs to detect switches
let lastActiveTab = null;

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
        
        const response = await fetch(`${API_BASE_URL}/documents/upload`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(errorData.error || 'Upload failed');
        }
        
        const data = await response.json();
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] File processing error:', error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Upload timed out';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server at ' + API_BASE_URL;
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
        
        const response = await fetch(`${API_BASE_URL}/resume/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(errorData.error || 'Parse failed');
        }
        
        const data = await response.json();
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

        const response = await fetch(`${API_BASE_URL}/analysis/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(errorData.error || 'Optimization failed');
        }
        
        const data = await response.json();
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

        const response = await fetch(`${API_BASE_URL}/documents/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
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
