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

const API_BASE_URL = 'http://localhost:3000/api';

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
 * Process uploaded file
 */
async function processFile(payload, sendResponse) {
    try {
        console.log('[Background] Processing file...');
        
        const { buffer, fileName, fileSize } = payload;
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array]);
        
        // Send to backend for processing
        const formData = new FormData();
        formData.append('file', blob, fileName);
        
        const response = await fetch(`${API_BASE_URL}/documents/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] File processing error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Parse resume details
 */
async function parseResume(payload, sendResponse) {
    try {
        console.log('[Background] Parsing resume...');
        
        const response = await fetch(`${API_BASE_URL}/resume/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Parse failed');
        
        const data = await response.json();
        sendResponse({ success: true, data: data.parsedData });
    } catch (error) {
        console.error('[Background] Parse error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Analyze resume
 */
async function analyzeResume(payload, sendResponse) {
    try {
        console.log('[Background] Analyzing resume...');
        
        const response = await fetch(`${API_BASE_URL}/analysis/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Analysis failed');
        
        const data = await response.json();
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] Analysis error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Optimize resume
 */
async function optimizeResume(payload, sendResponse) {
    try {
        console.log('[Background] Optimizing resume...');
        
        const response = await fetch(`${API_BASE_URL}/analysis/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Optimization failed');
        
        const data = await response.json();
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('[Background] Optimization error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Generate document
 */
async function generateDocument(payload, sendResponse) {
    try {
        console.log('[Background] Generating document...');
        
        const response = await fetch(`${API_BASE_URL}/documents/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Generation failed');
        
        const blob = await response.blob();
        sendResponse({ success: true, blob: blob.arrayBuffer() });
    } catch (error) {
        console.error('[Background] Generation error:', error);
        sendResponse({ success: false, error: error.message });
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
