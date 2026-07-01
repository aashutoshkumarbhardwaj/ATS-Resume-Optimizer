/**
 * Extension Authentication Middleware
 * Verifies extension JWT tokens and validates extension ID
 */

const { verifyExtensionToken } = require('../utils/extensionJWT');

/**
 * Middleware to authenticate extension requests
 */
function authenticateExtension(req, res, next) {
    try {
        // Get authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing or invalid authorization header'
            });
        }

        // Extract token
        const token = authHeader.substring('Bearer '.length);

        // Verify token
        const verified = verifyExtensionToken(token);

        // Attach user and extension info to request
        req.user = {
            id: verified.user_id,
            email: verified.email,
            source: 'extension'
        };
        req.extensionId = verified.extension_id;

        next();
    } catch (error) {
        console.error('[ExtensionAuth] Authentication error:', error.message);
        
        if (error.message.includes('expired')) {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(401).json({
            success: false,
            error: 'Extension authentication failed'
        });
    }
}

/**
 * Middleware to require extension authentication
 */
function requireExtensionAuth(req, res, next) {
    if (!req.user || req.user.source !== 'extension') {
        return res.status(401).json({
            success: false,
            error: 'Extension authentication required'
        });
    }
    next();
}

/**
 * Middleware to authenticate either extension or web
 */
async function authenticateAny(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing or invalid authorization header'
            });
        }

        const token = authHeader.substring('Bearer '.length);

        // Try extension JWT first
        try {
            const extensionVerified = verifyExtensionToken(token);
            req.user = {
                id: extensionVerified.user_id,
                email: extensionVerified.email,
                source: 'extension'
            };
            req.extensionId = extensionVerified.extension_id;
            return next();
        } catch (e) {
            // Not an extension token, continue to Supabase check
        }

        // Try Supabase JWT
        const { authenticateRequest } = require('./auth');
        return authenticateRequest(req, res, next);
    } catch (error) {
        console.error('[AuthenticateAny] Error:', error.message);
        res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
}

module.exports = {
    authenticateExtension,
    requireExtensionAuth,
    authenticateAny
};
