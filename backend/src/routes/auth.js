/**
 * Authentication Routes
 * Handle token refresh and session management
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest, requireAuth } = require('../middleware/auth');

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * (Backend wrapper around Supabase refresh endpoint)
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                error: 'refresh_token is required'
            });
        }

        // Call Supabase token refresh endpoint
        const supabaseUrl = process.env.SUPABASE_URL;
        if (!supabaseUrl) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }

        const response = await fetch(
            `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token,
                    grant_type: 'refresh_token'
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('[Auth] Token refresh failed:', error);
            
            // If refresh token is invalid, return 401
            if (response.status === 401 || response.status === 403) {
                return res.status(401).json({
                    success: false,
                    error: 'refresh_token_invalid',
                    message: 'Refresh token expired, please log in again'
                });
            }

            throw new Error(error.error || 'Token refresh failed');
        }

        const data = await response.json();

        res.json({
            success: true,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            token_type: data.token_type,
            expires_at: new Date().getTime() + (data.expires_in * 1000)
        });
    } catch (error) {
        console.error('[Auth] Refresh endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            message: error.message
        });
    }
});

/**
 * POST /api/auth/logout
 * Invalidate tokens and end session
 * (Optional backend-side token invalidation)
 */
router.post('/logout', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Optional: Store logout timestamp for audit logging
        // Optional: Revoke all tokens for user
        // For now, logout is client-side only (clear tokens from storage)

        console.log('[Auth] User logged out:', userId);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

/**
 * GET /api/auth/session
 * Get current session information
 */
router.get('/session', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        res.json({
            success: true,
            session: {
                user_id: userId,
                email: req.user.email,
                provider: req.user.provider,
                authenticated_at: new Date(req.user.iat * 1000).toISOString(),
                expires_at: new Date(req.user.exp * 1000).toISOString(),
                token_expires_in_minutes: Math.floor((req.user.exp * 1000 - Date.now()) / 60000)
            }
        });
    } catch (error) {
        console.error('[Auth] Session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session info'
        });
    }
});

/**
 * GET /api/auth/check
 * Check if current token is valid
 * (Useful for frontend to verify auth state)
 */
router.get('/check', authenticateRequest, async (req, res) => {
    try {
        if (req.user) {
            res.json({
                success: true,
                authenticated: true,
                user_id: req.user.id,
                email: req.user.email
            });
        } else {
            res.json({
                success: true,
                authenticated: false
            });
        }
    } catch (error) {
        console.error('[Auth] Check error:', error);
        res.status(500).json({
            success: false,
            error: 'Check failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Works with both Supabase tokens and extension tokens
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        console.log('[Auth/me] Request received');
        console.log('[Auth/me] Auth header present:', !!authHeader);
        console.log('[Auth/me] Auth header format:', authHeader?.substring(0, 20) + '...');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[Auth/me] ❌ Missing or invalid authorization header');
            return res.status(401).json({
                success: false,
                error: 'Missing or invalid authorization header',
                authenticated: false
            });
        }

        const token = authHeader.substring('Bearer '.length);
        console.log('[Auth/me] Token received, length:', token.length);
        console.log('[Auth/me] Token preview:', token.substring(0, 30) + '...');

        let extErrorMessage = 'Not attempted';
        let subErrorMessage = 'Not attempted';
        let jwtType = 'Unknown';
        try {
            const decoded = require('jsonwebtoken').decode(token);
            if (decoded) jwtType = decoded.type || 'Supabase/Other';
        } catch(e) {}

        // Try extension token first
        try {
            const { verifyExtensionToken } = require('../utils/extensionJWT');
            const verified = verifyExtensionToken(token);
            
            console.log('[Auth/me] ✅ Extension token verified for user:', verified.user_id);
            
            return res.json({
                success: true,
                authenticated: true,
                tokenType: 'extension',
                user: {
                    id: verified.user_id,
                    email: verified.user_email,
                    extensionId: verified.extension_id
                },
                expiresIn: Math.round((verified.exp * 1000 - Date.now()) / 1000)
            });
        } catch (extError) {
            extErrorMessage = extError.message;
            console.log('[Auth/me] Extension token invalid:', extError.message);
        }

        // Try Supabase token
        try {
            const { verifyToken } = require('../middleware/auth');
            const verified = await verifyToken(token);
            
            console.log('[Auth/me] ✅ Supabase token verified for user:', verified.sub);
            
            return res.json({
                success: true,
                authenticated: true,
                tokenType: 'supabase',
                user: {
                    id: verified.sub,
                    email: verified.email,
                    provider: verified.aud?.[0] || 'unknown'
                },
                expiresIn: Math.round((verified.exp * 1000 - Date.now()) / 1000)
            });
        } catch (subError) {
            subErrorMessage = subError.message;
            console.log('[Auth/me] Supabase token invalid:', subError.message);
        }

        // Token invalid
        console.log('[Auth/me] ❌ Token validation failed');
        res.status(401).json({
            success: false,
            error: 'Invalid token',
            authenticated: false,
            details: {
                authHeaderPrefix: authHeader.substring(0, 7),
                jwtType: jwtType,
                extensionError: extErrorMessage,
                supabaseError: subErrorMessage
            }
        });
    } catch (error) {
        console.error('[Auth/me] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication check failed'
        });
    }
});

module.exports = router;
