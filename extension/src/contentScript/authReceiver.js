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

/**
 * Automatically sync session from web app's localStorage
 * If user is logged into Job Orbit website, sync token to extension background!
 */
let lastSyncedToken = null;

function syncWebsiteSession() {
    try {
        const isJobOrbitSite = window.location.hostname.includes('job-orbit') || 
                               window.location.hostname.includes('vercel.app') || 
                               window.location.hostname.includes('localhost');
        if (!isJobOrbitSite) return;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            // Match Supabase auth token keys
            if (key.includes('auth-token') || key.includes('supabase') || key.startsWith('sb-')) {
                const rawVal = localStorage.getItem(key);
                if (!rawVal) continue;

                try {
                    const parsed = JSON.parse(rawVal);
                    const accessToken = parsed.access_token || parsed.currentSession?.access_token;
                    const user = parsed.user || parsed.currentSession?.user;
                    const expiresAt = parsed.expires_at || parsed.currentSession?.expires_at;

                    if (accessToken && accessToken !== lastSyncedToken) {
                        console.log('[ContentScript] 🔑 Detected active Job Orbit session in localStorage:', key);
                        lastSyncedToken = accessToken;

                        let expiresIn = 86400;
                        if (expiresAt) {
                            expiresIn = Math.max(0, Math.floor(expiresAt - (Date.now() / 1000)));
                        }

                        chrome.runtime.sendMessage({
                            type: 'JOBORBIT_AUTH_RESPONSE',
                            data: {
                                extensionToken: accessToken,
                                expiresIn: expiresIn,
                                user: user || null
                            }
                        }, function(response) {
                            console.log('[ContentScript] 📤 Auto-synced website session to extension background, result:', response);
                        });
                        break;
                    }
                } catch (e) {
                    // Ignore non-JSON localStorage items
                }
            }
        }
    } catch (e) {
        console.warn('[ContentScript] Could not access localStorage for session auto-sync:', e.message);
    }
}

// Execute session auto-sync on load
syncWebsiteSession();
// Check periodically every 5 seconds for session changes
setInterval(syncWebsiteSession, 5000);

console.log('[ContentScript] 🚀 Auth receiver initialized with automatic localStorage session detection');
