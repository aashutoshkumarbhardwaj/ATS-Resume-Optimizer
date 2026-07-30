/**
 * Error Handler Middleware
 * Comprehensive error handling with logging and user-friendly messages
 */

const errorHandler = (err, req, res, next) => {
    // Log error details
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Determine status code
    const status = err.status || err.statusCode || 500;

    // Create user-friendly error message
    let message = err.message || 'Internal Server Error';
    let retryable = false;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        message = 'Invalid input data';
        retryable = false;
    } else if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size exceeds 5MB limit';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file upload';
        } else {
            message = 'File upload error';
        }
        retryable = false;
    } else if (err.code === 'ECONNREFUSED') {
        message = 'Unable to connect to service';
        retryable = true;
    } else if (err.code === 'ETIMEDOUT') {
        message = 'Request timed out';
        retryable = true;
    } else if (status >= 500) {
        message = 'Server error occurred. Please try again later.';
        retryable = true;
    }

    // Send error response
    res.status(status).json({
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            retryable: retryable
        }
    });
};

module.exports = errorHandler;
