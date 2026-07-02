/**
 * Auth Listener - Background Script
 * Listens for messages from Job Orbit auth page
 * And passes them to the popup if it's open
 */

// Listen for messages from content scripts and external pages
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log('[AuthListener] Received external message:', request.type, 'from:', sender.url);
    
    if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
        // Forward the message to all popup windows
        chrome.runtime.sendMessage({
            type: 'JOBORBIT_AUTH_RESPONSE',
            state: request.state,
            data: request.data
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('[AuthListener] No popup listener:', chrome.runtime.lastError.message);
                // Popup is not open, which is fine - the auth page can close itself
            } else {
                console.log('[AuthListener] Forwarded auth response to popup');
            }
        });
        
        sendResponse({ success: true });
    }
});

// Also listen for messages from the Job Orbit tab directly
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
        console.log('[AuthListener] Received internal message from:', sender.tab?.url);
        
        // Broadcast to popup
        chrome.runtime.sendMessage({
            type: 'JOBORBIT_AUTH_RESPONSE',
            state: request.state,
            data: request.data
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('[AuthListener] No popup listener');
            }
        });
        
        sendResponse({ success: true });
    }
});
