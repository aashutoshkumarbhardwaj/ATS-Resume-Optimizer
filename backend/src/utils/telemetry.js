const crypto = require('crypto');

/**
 * TelemetryTracker
 * Gathers observability metrics throughout the lifecycle of a request.
 */
class TelemetryTracker {
    constructor(req = null) {
        this.requestId = req?.headers['x-request-id'] || crypto.randomUUID();
        this.startTime = performance.now();
        this.endpoint = req ? `${req.method} ${req.originalUrl}` : 'Unknown';
        
        // Storage for metrics
        this.executionTraces = [];
        this.agentTimings = {};
        this.retrievalTimings = {};
        this.llmMetrics = {
            totalLatencyMs: 0,
            calls: 0,
            promptTokens: 0,
            completionTokens: 0
        };
        this.cacheMetrics = {
            hits: 0,
            misses: 0,
            keys: []
        };
        this.errors = [];
        
        // Active spans
        this.activeSpans = new Map();
    }

    /**
     * Start a timing trace span
     */
    startTrace(spanName, category = 'agent') {
        this.activeSpans.set(spanName, {
            startTime: performance.now(),
            category
        });
    }

    /**
     * End a timing trace span and record it
     */
    endTrace(spanName) {
        const span = this.activeSpans.get(spanName);
        if (!span) return;
        
        const duration = performance.now() - span.startTime;
        this.activeSpans.delete(spanName);

        this.executionTraces.push({
            name: spanName,
            category: span.category,
            durationMs: Math.round(duration)
        });

        if (span.category === 'agent') {
            this.agentTimings[spanName] = (this.agentTimings[spanName] || 0) + duration;
        } else if (span.category === 'retrieval') {
            this.retrievalTimings[spanName] = (this.retrievalTimings[spanName] || 0) + duration;
        }
    }

    /**
     * Record a cache access
     */
    recordCache(key, isHit) {
        if (isHit) this.cacheMetrics.hits++;
        else this.cacheMetrics.misses++;
        
        this.cacheMetrics.keys.push({ key, hit: isHit });
    }

    /**
     * Record an LLM invocation
     */
    recordLLMCall(latencyMs, promptTokens = 0, completionTokens = 0) {
        this.llmMetrics.calls++;
        this.llmMetrics.totalLatencyMs += latencyMs;
        this.llmMetrics.promptTokens += promptTokens;
        this.llmMetrics.completionTokens += completionTokens;
    }

    /**
     * Record an error with a specific category
     */
    recordError(error, category = 'UNKNOWN_ERROR') {
        this.errors.push({
            category,
            message: error.message,
            stack: error.stack
        });
    }

    /**
     * Generate the final structured JSON payload for logging
     */
    generateReport(statusCode) {
        const totalDuration = Math.round(performance.now() - this.startTime);
        const cacheHitRate = this.cacheMetrics.hits + this.cacheMetrics.misses > 0
            ? (this.cacheMetrics.hits / (this.cacheMetrics.hits + this.cacheMetrics.misses)).toFixed(2)
            : 0;

        return {
            timestamp: new Date().toISOString(),
            request_id: this.requestId,
            endpoint: this.endpoint,
            status_code: statusCode,
            total_duration_ms: totalDuration,
            execution_traces: this.executionTraces,
            agent_timings_ms: this.agentTimings,
            retrieval_timings_ms: this.retrievalTimings,
            llm_metrics: {
                ...this.llmMetrics,
                totalTokens: this.llmMetrics.promptTokens + this.llmMetrics.completionTokens
            },
            cache_metrics: {
                hits: this.cacheMetrics.hits,
                misses: this.cacheMetrics.misses,
                hit_rate: parseFloat(cacheHitRate)
            },
            errors: this.errors,
            has_errors: this.errors.length > 0
        };
    }
}

module.exports = TelemetryTracker;
