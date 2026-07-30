const TelemetryTracker = require('../utils/telemetry');

/**
 * Observability Middleware
 * Injects a TelemetryTracker into the request and logs the final trace when the response finishes.
 */
function observabilityMiddleware(req, res, next) {
    // Inject the tracker
    req.telemetry = new TelemetryTracker(req);

    // Set the request ID on the response headers for client tracking
    res.setHeader('X-Request-ID', req.telemetry.requestId);

    // Hook into response finish event
    res.on('finish', () => {
        const report = req.telemetry.generateReport(res.statusCode);
        
        // Log the structured JSON payload to stdout
        // In production, log aggregation systems (Datadog, ELK) will parse this JSON automatically
        console.log(JSON.stringify(report));
    });

    // Also hook into response close/error just in case it drops before finish
    res.on('close', () => {
        if (!res.writableEnded) {
            req.telemetry.recordError(new Error('Connection closed by client before finish'), 'NETWORK_ERROR');
            const report = req.telemetry.generateReport(499); // 499 Client Closed Request
            console.log(JSON.stringify(report));
        }
    });

    next();
}

module.exports = observabilityMiddleware;
