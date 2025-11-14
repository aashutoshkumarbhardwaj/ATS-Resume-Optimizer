/**
 * Simple In-Memory Cache Utility
 * Caches parsed job descriptions and analysis results
 */

class Cache {
    constructor() {
        this.cache = new Map();
        this.ttl = 60 * 60 * 1000; // 1 hour default TTL
    }

    /**
     * Set cache entry
     */
    set(key, value, ttl = this.ttl) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Get cache entry
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return null;
        }
        
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.value;
    }

    /**
     * Delete cache entry
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
}

// Create singleton instance
const cache = new Cache();

// Run cleanup every 10 minutes
setInterval(() => {
    cache.cleanup();
    console.log(`Cache cleanup: ${cache.size()} entries remaining`);
}, 10 * 60 * 1000);

module.exports = cache;
