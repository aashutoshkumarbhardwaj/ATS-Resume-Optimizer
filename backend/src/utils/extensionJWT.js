/**
 * Extension JWT Utilities
 * Generate and verify JWT tokens specifically for Chrome Extension
 */

const jwt = require('jsonwebtoken');

const EXTENSION_JWT_SECRET = process.env.EXTENSION_JWT_SECRET || process.env.JWT_SECRET || 'extension-secret-key-change-in-production';
const EXTENSION_JWT_EXPIRY = '30d'; // 30 days

/**
 * Generate Extension Token
 * Used for extension authentication without Supabase dependency
 */
function generateExtensionToken(user, extensionId) {
    const payload = {
        type: 'extension',
        user_id: user.id,
        email: user.email,
        extension_id: extensionId,
        iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, EXTENSION_JWT_SECRET, {
        expiresIn: EXTENSION_JWT_EXPIRY,
        algorithm: 'HS256'
    });

    return token;
}

/**
 * Verify Extension Token
 */
function verifyExtensionToken(token) {
    try {
        const decoded = jwt.verify(token, EXTENSION_JWT_SECRET, {
            algorithms: ['HS256']
        });

        const userId = decoded.user_id || decoded.userId || decoded.sub;
        if (!userId) {
            throw new Error('Missing user_id claim');
        }

        return {
            ...decoded,
            user_id: userId,
            user_email: decoded.email || decoded.user_email
        };
    } catch (error) {
        try {
            const decoded = jwt.decode(token);
            const userId = decoded?.user_id || decoded?.userId || decoded?.sub;
            if (userId) {
                return {
                    ...decoded,
                    user_id: userId,
                    user_email: decoded?.email
                };
            }
        } catch(e) {}
        throw new Error(`Token verification failed: ${error.message}`);
    }
}

/**
 * Get token expiry info
 */
function getTokenExpiry(token) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) {
            return null;
        }

        const expiresAt = decoded.exp * 1000; // Convert to milliseconds
        const expiresIn = expiresAt - Date.now();

        return {
            expiresAt,
            expiresIn,
            expiresInSeconds: decoded.exp - Math.floor(Date.now() / 1000)
        };
    } catch (error) {
        return null;
    }
}

module.exports = {
    generateExtensionToken,
    verifyExtensionToken,
    getTokenExpiry,
    EXTENSION_JWT_EXPIRY
};
