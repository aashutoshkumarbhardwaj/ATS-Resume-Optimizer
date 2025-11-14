/**
 * Background Service Worker
 * Handles background tasks, message passing, and API communication
 */

// Store detected job data
let currentDetectedJob = null;

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_RESUME_TEXT') {
        // Handle getting resume text from a page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_RESUME' }, (response) => {
                sendResponse(response);
            });
        });
        return true; // Will respond asynchronously
    }

    if (request.type === 'ANALYZE_RESUME') {
        // Forward analysis request to backend
        analyzeResume(request.payload, sendResponse);
        return true; // Will respond asynchronously
    }

    if (request.type === 'JOB_DETECTED') {
        // Store detected job data
        currentDetectedJob = request.payload;
        console.log('Job detected:', currentDetectedJob);
        
        // Store in chrome storage
        chrome.storage.local.set({ 
            currentJob: currentDetectedJob,
            jobDetectedAt: Date.now()
        });
        
        // Update badge to show job is detected
        chrome.action.setBadgeText({ text: '1' });
        chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
        
        sendResponse({ success: true });
        return true;
    }

    if (request.type === 'GET_CURRENT_JOB') {
        // Return currently detected job
        if (currentDetectedJob) {
            sendResponse({ success: true, job: currentDetectedJob });
        } else {
            // Try to get from storage
            chrome.storage.local.get(['currentJob'], (result) => {
                if (result.currentJob) {
                    currentDetectedJob = result.currentJob;
                    sendResponse({ success: true, job: result.currentJob });
                } else {
                    sendResponse({ success: false, message: 'No job detected' });
                }
            });
            return true;
        }
    }

    if (request.type === 'DETECT_JOB_ON_CURRENT_TAB') {
        // Request job detection from content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'DETECT_JOB' }, (response) => {
                    if (response && response.success) {
                        currentDetectedJob = response.payload;
                        chrome.storage.local.set({ currentJob: currentDetectedJob });
                    }
                    sendResponse(response);
                });
            } else {
                sendResponse({ success: false, message: 'No active tab' });
            }
        });
        return true;
    }

    if (request.type === 'OPEN_POPUP') {
        // Store job data and let popup retrieve it
        currentDetectedJob = request.payload;
        chrome.storage.local.set({ currentJob: currentDetectedJob });
        sendResponse({ success: true });
    }
});

/**
 * Analyze resume via backend API
 */
async function analyzeResume(payload, sendResponse) {
    try {
        const response = await fetch('http://localhost:5000/api/resume/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('Error analyzing resume:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Optionally inject content script
        injectContentScript(tabId);
    }
});

/**
 * Inject content script into a tab
 */
function injectContentScript(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/contentScript/content-script.js']
    }).catch(err => console.log('Script already injected or injection failed:', err));
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
});

// Store extension data
chrome.runtime.onStartup.addListener(() => {
    console.log('Chrome started');
});
