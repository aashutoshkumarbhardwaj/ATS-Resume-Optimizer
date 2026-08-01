/**
 * Authentication Manager
 * Handles OAuth flow, token storage, and session management
 */

class AuthenticationManager {
    constructor() {
        this.SUPABASE_URL = 'https://dsbkjkwefszqqzukgdtk.supabase.co';
        this.REDIRECT_URL = chrome.identity.getRedirectURL();
        this.TOKEN_KEY = 'auth_tokens';
        this.GUEST_DATA_KEY = 'guest_profile_data';
        
        this.providers = {
            google: {
                id: 'google',
                name: 'Google',
                icon: '🔴'
            },
            github: {
                id: 'github',
                name: 'GitHub',
                icon: '⬛'
            },
            microsoft: {
                id: 'microsoft',
                name: 'Microsoft',
                icon: '🟦'
            }
        };

        this.tokens = null;
        this.isInitialized = false;
    }

    /**
     * Initialize authentication manager
     */
    async initialize() {
        try {
            // Initialize guest mode detection
            const isGuest = await GuestModeManager.isGuestMode();
            console.log('[Auth] Guest mode:', isGuest);
            
            // Load stored tokens
            const stored = await this.getStoredTokens();
            if (stored) {
                this.tokens = stored;
            }

            // Initialize bidirectional session sync
            if (typeof BidirectionalSessionSync !== 'undefined') {
                await BidirectionalSessionSync.initialize();
            }

            this.isInitialized = true;
            console.log('[Auth] Manager initialized');
            return true;
        } catch (error) {
            console.error('[Auth] Initialization error:', error);
            this.isInitialized = true;
            return false;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        if (!this.tokens || !this.tokens.access_token) {
            return false;
        }

        // Check if token is expired
        if (this.tokens.expires_at && this.tokens.expires_at < Date.now()) {
            return false;
        }

        return true;
    }

    /**
     * Get current user info
     */
    async getCurrentUser() {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            const response = await fetch(`${this.SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${this.tokens.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[Auth] Get user error:', error);
            return null;
        }
    }

    /**
     * Initiate OAuth flow
     */
    async initiateOAuthFlow(provider) {
        if (!this.providers[provider]) {
            throw new Error(`Unknown provider: ${provider}`);
        }

        try {
            const state = this.generateRandomString(32);
            const codeVerifier = this.generateRandomString(64);
            const codeChallenge = await this.generateCodeChallenge(codeVerifier);

            // Store state and code verifier for verification
            await this.storeOAuthState({ state, codeVerifier, provider });

            // Build OAuth URL
            const oauthUrl = new URL(`${this.SUPABASE_URL}/auth/v1/authorize`);
            oauthUrl.searchParams.set('client_id', 'your-supabase-client-id'); // Will be set via env
            oauthUrl.searchParams.set('redirect_uri', this.REDIRECT_URL);
            oauthUrl.searchParams.set('response_type', 'code');
            oauthUrl.searchParams.set('scope', 'openid profile email');
            oauthUrl.searchParams.set('state', state);
            oauthUrl.searchParams.set('provider', provider);
            oauthUrl.searchParams.set('code_challenge', codeChallenge);
            oauthUrl.searchParams.set('code_challenge_method', 'S256');

            // Open authorization tab
            chrome.tabs.create({ url: oauthUrl.toString() }, (tab) => {
                console.log('[Auth] OAuth tab opened:', tab.id);
                this.currentOAuthTabId = tab.id;
            });

            return true;
        } catch (error) {
            console.error('[Auth] OAuth flow error:', error);
            throw error;
        }
    }

    /**
     * Handle OAuth callback
     */
    async handleOAuthCallback(url) {
        try {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get('code');
            const state = urlObj.searchParams.get('state');

            if (!code) {
                const error = urlObj.searchParams.get('error');
                throw new Error(`OAuth error: ${error || 'No authorization code'}`);
            }

            // Verify state
            const storedState = await this.getOAuthState();
            if (state !== storedState.state) {
                throw new Error('State mismatch - possible CSRF attack');
            }

            // Exchange code for tokens
            const tokens = await this.exchangeCodeForTokens(code, storedState.codeVerifier);

            // Store tokens
            await this.storeTokens(tokens);
            this.tokens = tokens;

            // Clear OAuth state
            await this.clearOAuthState();

            console.log('[Auth] OAuth completed successfully');
            return {
                success: true,
                user: await this.getCurrentUser()
            };
        } catch (error) {
            console.error('[Auth] Callback error:', error);
            throw error;
        }
    }

    /**
     * Exchange OAuth code for tokens
     */
    async exchangeCodeForTokens(code, codeVerifier) {
        try {
            const response = await fetch(
                `${this.SUPABASE_URL}/auth/v1/token?grant_type=authorization_code`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        code,
                        code_verifier: codeVerifier,
                        client_id: 'your-supabase-client-id',
                        redirect_uri: this.REDIRECT_URL
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            return {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: Date.now() + (data.expires_in * 1000),
                token_type: data.token_type,
                provider: data.user?.user_metadata?.provider || 'unknown'
            };
        } catch (error) {
            console.error('[Auth] Token exchange error:', error);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        if (!this.tokens || !this.tokens.refresh_token) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(
                `${this.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        refresh_token: this.tokens.refresh_token,
                        client_id: 'your-supabase-client-id'
                    })
                }
            );

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Refresh token invalid, need to re-authenticate
                    await this.logout();
                    throw new Error('Refresh token expired - re-authentication required');
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            this.tokens = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: Date.now() + (data.expires_in * 1000),
                token_type: data.token_type,
                provider: this.tokens.provider
            };

            await this.storeTokens(this.tokens);

            console.log('[Auth] Token refreshed successfully');
            return this.tokens;
        } catch (error) {
            console.error('[Auth] Token refresh error:', error);
            throw error;
        }
    }

    /**
     * Get access token (refresh if needed)
     */
    async getAccessToken() {
        if (!this.tokens) {
            return null;
        }

        // Check if token is expired or about to expire (within 5 minutes)
        const expiresIn = this.tokens.expires_at - Date.now();
        if (expiresIn < 5 * 60 * 1000) {
            try {
                await this.refreshAccessToken();
            } catch (error) {
                console.error('[Auth] Auto-refresh failed:', error);
                return null;
            }
        }

        return this.tokens.access_token;
    }

    /**
     * Store tokens securely
     */
    async storeTokens(tokens) {
        try {
            const encrypted = await window.EncryptionUtils.encryptData(tokens);
            return new Promise((resolve, reject) => {
                chrome.storage.sync.set({ [this.TOKEN_KEY]: encrypted }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('[Auth] Store tokens error:', error);
            throw error;
        }
    }

    /**
     * Retrieve stored tokens
     */
    async getStoredTokens() {
        try {
            return new Promise((resolve, reject) => {
                chrome.storage.sync.get([this.TOKEN_KEY], async (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (!result[this.TOKEN_KEY]) {
                        resolve(null);
                        return;
                    }

                    try {
                        const decrypted = await window.EncryptionUtils.decryptData(
                            result[this.TOKEN_KEY]
                        );
                        resolve(decrypted);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.error('[Auth] Get stored tokens error:', error);
            return null;
        }
    }

    /**
     * Logout and clear tokens
     */
    async logout() {
        try {
            // Enable guest mode
            await GuestModeManager.enableGuestMode();

            // Notify website of logout
            if (typeof BidirectionalSessionSync !== 'undefined') {
                await BidirectionalSessionSync.notifyWebsiteOfLogout();
            }

            // Clear tokens
            await this.clearTokens();
            this.tokens = null;

            // Optional: Invalidate token on backend
            // POST /api/auth/logout

            console.log('[Auth] Logged out successfully');
            return true;
        } catch (error) {
            console.error('[Auth] Logout error:', error);
            throw error;
        }
    }

    /**
     * Clear tokens from storage
     */
    async clearTokens() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.remove([this.TOKEN_KEY], () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Store OAuth state for verification
     */
    async storeOAuthState(state) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ oauth_state: state }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Get stored OAuth state
     */
    async getOAuthState() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['oauth_state'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result.oauth_state || {});
                }
            });
        });
    }

    /**
     * Clear OAuth state
     */
    async clearOAuthState() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(['oauth_state'], () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Generate random string
     */
    generateRandomString(length) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Generate code challenge for PKCE
     */
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const bytes = new Uint8Array(digest);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Check if user is in guest mode
     */
    async isGuestMode() {
        if (typeof GuestModeManager !== 'undefined') {
            return await GuestModeManager.isGuestMode();
        }
        return !this.isAuthenticated();
    }

    /**
     * Get guest mode status
     */
    async getGuestStatus() {
        if (typeof GuestModeManager !== 'undefined') {
            return await GuestModeManager.getStatus();
        }
        return null;
    }

    /**
     * Check if guest data migration is needed
     */
    async isMigrationNeeded() {
        if (typeof GuestDataMigrationManager !== 'undefined') {
            return await GuestDataMigrationManager.isMigrationNeeded();
        }
        return false;
    }

    /**
     * Perform guest data migration
     */
    async performGuestDataMigration() {
        if (!this.isAuthenticated()) {
            throw new Error('User must be authenticated to migrate data');
        }

        if (typeof GuestDataMigrationManager === 'undefined') {
            throw new Error('Migration manager not available');
        }

        // Get current user info
        const user = await this.getCurrentUser();
        if (!user) {
            throw new Error('Failed to get user info');
        }

        // Perform migration
        const results = await GuestDataMigrationManager
            .migrateGuestData(this.tokens.access_token, user.id);

        // Disable guest mode
        await GuestModeManager.disableGuestMode();

        // Notify website of successful migration
        if (typeof BidirectionalSessionSync !== 'undefined') {
            await BidirectionalSessionSync.notifyWebsiteOfLogin(
                this.tokens,
                { id: user.id, email: user.email }
            );
        }

        return results;
    }

    /**
     * Handle successful OAuth login
     * (Called after tokens are obtained)
     */
    async handleSuccessfulLogin(tokens) {
        try {
            // Store tokens
            await this.storeTokens(tokens);
            this.tokens = tokens;

            // Disable guest mode
            await GuestModeManager.disableGuestMode();

            // Notify website of login
            const user = await this.getCurrentUser();
            if (user && typeof BidirectionalSessionSync !== 'undefined') {
                await BidirectionalSessionSync.notifyWebsiteOfLogin(tokens, {
                    id: user.id,
                    email: user.email
                });
            }

            console.log('[Auth] Successfully logged in');
            return true;
        } catch (error) {
            console.error('[Auth] Handle login error:', error);
            throw error;
        }
    }

    /**
     * Sync session with website
     * (Call when extension is activated to ensure consistency)
     */
    async syncSessionWithWebsite() {
        if (typeof BidirectionalSessionSync !== 'undefined') {
            return await BidirectionalSessionSync.syncWithWebsite();
        }
        return false;
    }

    /**
     * Get session sync status
     */
    async getSessionSyncStatus() {
        if (typeof BidirectionalSessionSync !== 'undefined') {
            const isValid = await BidirectionalSessionSync.isSessionValid();
            const timeSinceSync = await BidirectionalSessionSync.getTimeSinceLastSync();
            return {
                valid: isValid,
                time_since_sync_ms: timeSinceSync,
                in_sync: timeSinceSync < 60000 // Consider in sync if < 1 minute
            };
        }
        return null;
    }
}

// Create global instance
window.authManager = new AuthenticationManager();
