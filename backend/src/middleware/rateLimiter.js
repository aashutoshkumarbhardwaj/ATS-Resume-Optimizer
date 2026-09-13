/**
 * Native Token Bucket Rate Limiter Middleware
 * 
 * High-performance, zero-dependency rate limiter for Express.
 * Protects AI analysis, context-graph, and resume endpoints from abuse.
 */

function createRateLimiter(options = {}) {
    const windowMs = options.windowMs || 60 * 1000; // 1 minute default
    const maxRequests = options.max || 60; // 60 requests per window
    const message = options.message || { error: 'Too many requests, please try again later.', retryAfterSeconds: Math.ceil(windowMs / 1000) };

    const clients = new Map();

    // Clean up stale client entries every 2 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of clients.entries()) {
            if (now - record.resetTime > windowMs) {
                clients.delete(ip);
            }
        }
    }, 2 * 60 * 1000).unref();

    return function rateLimiterMiddleware(req, res, next) {
        // Exempt health checks
        if (req.path === '/health') return next();

        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        let client = clients.get(ip);
        if (!client || now > client.resetTime) {
            client = {
                count: 1,
                resetTime: now + windowMs
            };
            clients.set(ip, client);
        } else {
            client.count++;
        }

        const remaining = Math.max(0, maxRequests - client.count);
        const resetSeconds = Math.ceil((client.resetTime - now) / 1000);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetSeconds);

        if (client.count > maxRequests) {
            res.setHeader('Retry-After', resetSeconds);
            return res.status(429).json(message);
        }

        next();
    };
}

module.exports = createRateLimiter;
