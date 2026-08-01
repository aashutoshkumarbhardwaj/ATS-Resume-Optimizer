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
 * Decode JWT token safely without external library
 */
function decodeJWT(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadB64 = parts[1];
        const fixed = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = decodeURIComponent(atob(fixed).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonStr);
    } catch(e) {
        return null;
    }
}

/**
 * Automatically sync session from web app's localStorage
 * Scans for extension_session_token, auth_token, sb-*-auth-token, etc.
 */
let lastSyncedToken = null;

function syncWebsiteSession() {
    try {
        const isJobOrbitSite = window.location.hostname.includes('job-orbit') || 
                               window.location.hostname.includes('vercel.app') || 
                               window.location.hostname.includes('localhost');
        if (!isJobOrbitSite) return;

        let detectedToken = null;
        let detectedUser = null;
        let detectedExpiresIn = 86400;

        // 1. Direct key checks in localStorage
        const directTokenKeys = ['extension_session_token', 'auth_token', 'accessToken'];
        for (const key of directTokenKeys) {
            const val = localStorage.getItem(key);
            if (val && typeof val === 'string' && val.startsWith('ey')) {
                detectedToken = val;
                const decoded = decodeJWT(val);
                if (decoded) {
                    detectedUser = {
                        id: decoded.sub,
                        email: decoded.email || decoded.user_metadata?.email
                    };
                    if (decoded.exp) {
                        detectedExpiresIn = Math.max(0, Math.floor(decoded.exp - (Date.now() / 1000)));
                    }
                }
                break;
            }
        }

        // 2. Fallback: Scan all localStorage keys for Supabase session objects
        if (!detectedToken) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                if (key.includes('auth') || key.includes('token') || key.includes('supabase') || key.startsWith('sb-')) {
                    const rawVal = localStorage.getItem(key);
                    if (!rawVal) continue;

                    // Check if raw value is already a JWT
                    if (typeof rawVal === 'string' && rawVal.startsWith('ey')) {
                        detectedToken = rawVal;
                        const decoded = decodeJWT(rawVal);
                        if (decoded) {
                            detectedUser = { id: decoded.sub, email: decoded.email || decoded.user_metadata?.email };
                            if (decoded.exp) detectedExpiresIn = Math.max(0, Math.floor(decoded.exp - (Date.now() / 1000)));
                        }
                        break;
                    }

                    // Check if JSON object
                    try {
                        const parsed = JSON.parse(rawVal);
                        const tokenStr = parsed.access_token || parsed.token || parsed.extensionToken || parsed.currentSession?.access_token;
                        if (tokenStr && typeof tokenStr === 'string') {
                            detectedToken = tokenStr;
                            const userObj = parsed.user || parsed.currentSession?.user;
                            const decoded = decodeJWT(tokenStr);
                            detectedUser = userObj || (decoded ? { id: decoded.sub, email: decoded.email || decoded.user_metadata?.email } : null);
                            const exp = parsed.expires_at || parsed.currentSession?.expires_at;
                            if (exp) detectedExpiresIn = Math.max(0, Math.floor(exp - (Date.now() / 1000)));
                            else if (decoded && decoded.exp) detectedExpiresIn = Math.max(0, Math.floor(decoded.exp - (Date.now() / 1000)));
                            break;
                        }
                    } catch (e) {
                        // Skip non-JSON
                    }
                }
            }
        }

        if (detectedToken && detectedToken !== lastSyncedToken) {
            console.log('[ContentScript] 🔑 Detected active Job Orbit token in localStorage');
            lastSyncedToken = detectedToken;

            chrome.runtime.sendMessage({
                type: 'JOBORBIT_AUTH_RESPONSE',
                data: {
                    extensionToken: detectedToken,
                    expiresIn: detectedExpiresIn,
                    user: detectedUser
                }
            }, function(response) {
                console.log('[ContentScript] 📤 Auto-synced session to background, result:', response);
            });
        }
    } catch (e) {
        console.warn('[ContentScript] Could not access localStorage for session sync:', e.message);
    }
}

// Run auto-sync immediately and periodically
syncWebsiteSession();
setInterval(syncWebsiteSession, 3000);

console.log('[ContentScript] 🚀 Auth receiver initialized with robust token scanning');
