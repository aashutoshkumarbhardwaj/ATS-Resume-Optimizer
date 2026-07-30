/**
 * Async Cache Utility
 * Supports Redis with a graceful fallback to a Simple In-Memory Cache
 */

const { createClient } = require('redis');

class AsyncCache {
    constructor() {
        this.ttlMs = 60 * 60 * 1000; // 1 hour default TTL
        
        // In-memory fallback
        this.memoryCache = new Map();
        
        // Redis Setup
        this.redisClient = null;
        this.isRedisConnected = false;
        
        this._initRedis();
    }

    async _initRedis() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            console.log('[Cache] REDIS_URL not set. Falling back to in-memory cache.');
            this._startMemoryCleanup();
            return;
        }

        try {
            this.redisClient = createClient({ url: redisUrl });
            
            this.redisClient.on('error', (err) => {
                console.error('[Cache] Redis Client Error:', err.message);
                this.isRedisConnected = false;
                // If Redis fails, we seamlessly fallback to memory
                if (this.memoryCache.size === 0) {
                    this._startMemoryCleanup();
                }
            });

            this.redisClient.on('connect', () => {
                console.log('[Cache] Connected to Redis.');
                this.isRedisConnected = true;
            });

            await this.redisClient.connect();
        } catch (err) {
            console.error('[Cache] Failed to initialize Redis. Falling back to in-memory.', err.message);
            this.isRedisConnected = false;
            this._startMemoryCleanup();
        }
    }

    _startMemoryCleanup() {
        // Run cleanup every 10 minutes
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => {
                this._memoryCleanup();
                console.log(`[Cache] Memory cleanup: ${this.memoryCache.size} entries remaining`);
            }, 10 * 60 * 1000);
        }
    }

    _memoryCleanup() {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
            }
        }
    }

    /**
     * Set cache entry
     */
    async set(key, value, ttlMs = this.ttlMs) {
        if (this.isRedisConnected) {
            try {
                // Redis requires EX in seconds
                await this.redisClient.set(key, JSON.stringify(value), { EX: Math.round(ttlMs / 1000) });
                return;
            } catch (err) {
                console.warn(`[Cache] Redis set failed for ${key}:`, err.message);
                // Fallback to memory if Redis write fails
            }
        }
        
        // Fallback
        const expiresAt = Date.now() + ttlMs;
        this.memoryCache.set(key, { value, expiresAt });
    }

    /**
     * Get cache entry
     */
    async get(key, telemetry = null) {
        if (this.isRedisConnected) {
            try {
                const data = await this.redisClient.get(key);
                if (data) {
                    if (telemetry) telemetry.recordCache(key, true);
                    return JSON.parse(data);
                } else {
                    if (telemetry) telemetry.recordCache(key, false);
                    return null;
                }
            } catch (err) {
                console.warn(`[Cache] Redis get failed for ${key}:`, err.message);
                // If Redis read fails, try memory fallback
            }
        }

        // Fallback
        const entry = this.memoryCache.get(key);
        
        if (!entry) {
            if (telemetry) telemetry.recordCache(key, false);
            return null;
        }
        
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.memoryCache.delete(key);
            if (telemetry) telemetry.recordCache(key, false);
            return null;
        }
        
        if (telemetry) telemetry.recordCache(key, true);
        return entry.value;
    }

    /**
     * Delete cache entry
     */
    async delete(key) {
        if (this.isRedisConnected) {
            try {
                await this.redisClient.del(key);
            } catch (err) {
                console.warn(`[Cache] Redis del failed for ${key}:`, err.message);
            }
        }
        this.memoryCache.delete(key);
    }

    /**
     * Clear all cache
     */
    async clear() {
        if (this.isRedisConnected) {
            try {
                await this.redisClient.flushDb();
            } catch (err) {
                console.warn(`[Cache] Redis flushDb failed:`, err.message);
            }
        }
        this.memoryCache.clear();
    }
}

// Create singleton instance
const cache = new AsyncCache();

module.exports = cache;
