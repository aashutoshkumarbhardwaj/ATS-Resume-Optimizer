// Listens for postMessage from JobOrbit web app and forwards it to the background script
window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'JOBORBIT_AUTH_RESPONSE') {
        console.log('[ContentScript] 📥 Received JOBORBIT_AUTH_RESPONSE from webpage:', event.data);
        
        // Forward to background script
        chrome.runtime.sendMessage({
            type: 'JOBORBIT_AUTH_RESPONSE',
            data: event.data.payload,
            state: event.data.state
        }, function(response) {
            console.log('[ContentScript] 📤 Forwarded auth response to background, result:', response);
            
            // Optionally tell the web app we got it
            window.postMessage({ type: 'JOBORBIT_AUTH_SAVED', success: response?.success }, '*');
        });
    }
});
console.log('[ContentScript] 🚀 Auth receiver initialized and listening for messages');
