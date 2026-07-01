/**
 * Extension Authentication Routes
 * Handle extension-specific auth flow
 * This endpoint is called from Job Orbit after user authenticates
 */

const express = require('express');
const router = express.Router();
const { generateExtensionToken, getTokenExpiry } = require('../utils/extensionJWT');
const { authenticateRequest } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');

/**
 * POST /extension-auth/verify
 * Verify Supabase token and generate extension token
 * Called from extension after OAuth callback
 */
router.post('/verify', authenticateRequest, async (req, res) => {
    try {
        const { extensionId } = req.body;

        if (!extensionId) {
            return res.status(400).json({
                success: false,
                error: 'extensionId is required'
            });
        }

        // User is already authenticated via Supabase token (from middleware)
        const userId = req.user.id;
        const email = req.user.email;

        console.log('[ExtensionAuth] Verifying extension for user:', userId);

        // Get or create user profile
        let profile = await supabaseService.getProfile(userId);
        if (!profile) {
            profile = await supabaseService.createProfile(
                userId,
                email,
                req.user.provider
            );
            console.log('[ExtensionAuth] Created new profile:', userId);
        }

        // Generate extension token (valid for 24 hours)
        const extensionToken = generateExtensionToken(
            { id: userId, email },
            extensionId
        );

        // Get token expiry info
        const tokenExpiry = getTokenExpiry(extensionToken);

        console.log('[ExtensionAuth] Generated extension token for:', userId);

        res.json({
            success: true,
            extensionToken,
            expiresIn: tokenExpiry.expiresInSeconds,
            expiresAt: tokenExpiry.expiresAt,
            user: {
                id: userId,
                email: email
            }
        });
    } catch (error) {
        console.error('[ExtensionAuth] Verify error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate extension token',
            message: error.message
        });
    }
});

/**
 * POST /extension-auth/refresh
 * Refresh extension token
 * Called when token is about to expire
 */
router.post('/refresh', authenticateRequest, async (req, res) => {
    try {
        const { extensionId } = req.body;

        if (!extensionId) {
            return res.status(400).json({
                success: false,
                error: 'extensionId is required'
            });
        }

        const userId = req.user.id;
        const email = req.user.email;

        // Generate new extension token
        const extensionToken = generateExtensionToken(
            { id: userId, email },
            extensionId
        );

        // Get token expiry info
        const tokenExpiry = getTokenExpiry(extensionToken);

        console.log('[ExtensionAuth] Refreshed extension token for:', userId);

        res.json({
            success: true,
            extensionToken,
            expiresIn: tokenExpiry.expiresInSeconds,
            expiresAt: tokenExpiry.expiresAt
        });
    } catch (error) {
        console.error('[ExtensionAuth] Refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh extension token'
        });
    }
});

/**
 * GET /extension-auth/callback
 * OAuth callback from Job Orbit auth page
 * This is called by the Job Orbit /extension-auth page after successful auth
 * 
 * Query params:
 * - code: OAuth authorization code
 * - state: CSRF protection state
 * - extensionId: Chrome extension ID
 * - nonce: Additional security nonce
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state, extensionId, nonce } = req.query;

        // Validate required parameters
        if (!code || !state || !extensionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: code, state, extensionId'
            });
        }

        console.log('[ExtensionAuth] Processing OAuth callback with extensionId:', extensionId);

        // Note: This endpoint needs Job Orbit backend to exchange `code` for user info
        // For now, this is a placeholder that will be implemented by Job Orbit backend
        // The flow should be:
        // 1. Validate state parameter
        // 2. Exchange code for access token (with Job Orbit backend)
        // 3. Get user info from Job Orbit
        // 4. Create/get user in our system
        // 5. Generate extension token
        // 6. Send token back to extension (via chrome.runtime.sendMessage)

        res.json({
            success: false,
            error: 'OAuth callback processing not yet implemented',
            message: 'Job Orbit backend needs to exchange auth code for token',
            received: { code, state, extensionId }
        });
    } catch (error) {
        console.error('[ExtensionAuth] Callback error:', error);
        res.status(500).json({
            success: false,
            error: 'OAuth callback failed'
        });
    }
});

module.exports = router;
