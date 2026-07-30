/**
 * Authentication Middleware
 * Verifies JWT tokens from Supabase and extracts user information
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL;

// Cache for JWKS to avoid repeated downloads
let jwksCache = null;
let jwksCacheTime = null;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Fetch JWKS from Supabase
 */
async function getJWKS() {
    const now = Date.now();
    
    // Return cached JWKS if still valid
    if (jwksCache && jwksCacheTime && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
        return jwksCache;
    }

    try {
        const response = await axios.get(SUPABASE_JWKS_URL, {
            timeout: 5000
        });
        
        jwksCache = response.data;
        jwksCacheTime = now;
        return jwksCache;
    } catch (error) {
        console.error('[Auth] Failed to fetch JWKS:', error.message);
        // Return cached version even if expired on error
        if (jwksCache) return jwksCache;
        throw error;
    }
}

/**
 * Get signing key from JWKS
 */
function getSigningKey(kid, jwks) {
    const key = jwks.keys.find(k => k.kid === kid);
    if (!key) {
        throw new Error(`Unable to find signing key with kid: ${kid}`);
    }
    
    // Convert JWK to PEM
    const jwkToPem = require('jwk-to-pem');
    return jwkToPem(key);
}

/**
 * Middleware to verify JWT token
 */
async function verifyToken(token) {
    try {
        // Decode token to get header
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded) {
            throw new Error('Invalid token format');
        }

        // Get JWKS
        const jwks = await getJWKS();

        // Get signing key
        const signingKey = getSigningKey(decoded.header.kid, jwks);

        // Verify and decode token
        const verified = jwt.verify(token, signingKey, {
            algorithms: ['RS256']
        });

        return verified;
    } catch (error) {
        console.error('[Auth] Token verification failed:', error.message);
        throw error;
    }
}

/**
 * Express middleware to authenticate requests
 */
async function authenticateRequest(req, res, next) {
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
        const verified = await verifyToken(token);

        // Attach user info to request
        req.user = {
            id: verified.sub,
            email: verified.email,
            provider: verified.aud?.[0] || 'unknown',
            iat: verified.iat,
            exp: verified.exp
        };

        next();
    } catch (error) {
        console.error('[Auth] Authentication error:', error.message);
        
        if (error.message.includes('expired')) {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
}

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    next();
}

/**
 * Middleware to check if token is about to expire (within 5 minutes)
 */
function checkTokenExpiry(req, res, next) {
    if (req.user && req.user.exp) {
        const expiresIn = (req.user.exp * 1000) - Date.now();
        const fiveMinutesInMs = 5 * 60 * 1000;

        if (expiresIn < fiveMinutesInMs && expiresIn > 0) {
            // Add header to indicate token is expiring soon
            res.set('X-Token-Expires-Soon', 'true');
            res.set('X-Token-Expires-In-Ms', expiresIn.toString());
        }
    }
    next();
}

module.exports = {
    authenticateRequest,
    requireAuth,
    verifyToken,
    checkTokenExpiry
};
