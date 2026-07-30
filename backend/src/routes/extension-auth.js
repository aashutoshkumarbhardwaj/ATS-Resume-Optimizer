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

/**
 * POST /extension-auth/sync
 * Sync extension data with Job Orbit backend
 * This endpoint is called periodically to sync applications, answers, profiles, etc.
 */
router.post('/sync', async (req, res) => {
    try {
        const { extensionId } = req.body;
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing authorization header'
            });
        }

        const token = authHeader.substring('Bearer '.length);
        
        // Verify extension token
        const { verifyExtensionToken } = require('../utils/extensionJWT');
        let verified;
        try {
            verified = verifyExtensionToken(token);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        const userId = verified.user_id;

        console.log('[ExtensionAuth] Sync initiated for user:', userId);

        // Sync data:
        // 1. Fetch applications from local storage (via extension) - not applicable here
        // 2. Fetch AI answers from local storage (via extension) - not applicable here
        // 3. Update profile if needed
        // 4. Return sync status

        // Get user profile
        const profile = await supabaseService.getProfile(userId);
        
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'User profile not found'
            });
        }

        // Get applications count
        const applications = await supabaseService.getApplications(userId);
        
        // Get AI answers count (if table exists)
        // const answers = await supabaseService.getAIAnswers(userId);

        console.log('[ExtensionAuth] Sync completed. Applications:', applications?.length || 0);

        res.json({
            success: true,
            syncStatus: {
                userId,
                email: profile.user_id,
                syncedAt: new Date().toISOString(),
                applicationsCount: applications?.length || 0,
                profileUpdated: profile.updated_at
            },
            message: 'Sync completed successfully'
        });
    } catch (error) {
        console.error('[ExtensionAuth] Sync error:', error);
        res.status(500).json({
            success: false,
            error: 'Sync failed',
            message: error.message
        });
    }
});

module.exports = router;
