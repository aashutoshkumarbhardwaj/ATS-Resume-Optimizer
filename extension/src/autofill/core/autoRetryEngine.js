/**
 * Auto Retry Engine
 * Handles failed autofill attempts with exponential backoff
 * Implements resilient field filling with verification
 */

class AutoRetryEngine {
    /**
     * Retry configuration
     */
    static CONFIG = {
        MAX_RETRIES: 3,
        INITIAL_DELAY_MS: 500,      // Start with 500ms
        MAX_DELAY_MS: 8000,          // Cap at 8s
        BACKOFF_MULTIPLIER: 2,       // Double each time
        VERIFICATION_DELAY_MS: 200,  // Wait before verifying
        TIMEOUT_MS: 15000            // Overall timeout per field
    };

    constructor() {
        this.retryHistory = new Map();  // Track retries per field element
        this.logger = this.createLogger();
    }

    /**
     * Create logger with context
     */
    createLogger() {
        return {
            log: (message) => console.log('[AutoRetry]', message),
            warn: (message) => console.warn('[AutoRetry] ⚠️', message),
            error: (message) => console.error('[AutoRetry] ❌', message),
            debug: (message) => console.debug('[AutoRetry] 🔍', message)
        };
    }

    /**
     * Attempt to fill field with retry logic
     * @param {Element} element - Form field element
     * @param {string} value - Value to fill
     * @param {Object} options - Options { verifier, adapter, maxRetries }
     * @returns {Promise} { success, retries, finalValue, error }
     */
    async fillWithRetry(element, value, options = {}) {
        const fieldId = this.getElementId(element);
        const maxRetries = options.maxRetries || AutoRetryEngine.CONFIG.MAX_RETRIES;
        
        this.logger.log(`Starting fill retry for field: ${fieldId}, value: ${value}`);

        const startTime = Date.now();
        let lastError = null;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                // Check timeout
                if (Date.now() - startTime > AutoRetryEngine.CONFIG.TIMEOUT_MS) {
                    this.logger.error(`Timeout exceeded for ${fieldId}`);
                    return {
                        success: false,
                        retries: attempt,
                        finalValue: null,
                        error: 'Timeout exceeded'
                    };
                }

                this.logger.log(`Attempt ${attempt + 1}/${maxRetries + 1} for ${fieldId}`);

                // Check if element still valid
                if (!this.isElementValid(element)) {
                    throw new Error('Element is no longer valid');
                }

                // Clear previous value
                this.clearField(element);

                // Fill the field
                await this.fillField(element, value, options);

                // Verify fill was successful
                await this.delay(AutoRetryEngine.CONFIG.VERIFICATION_DELAY_MS);
                
                const verificationResult = await this.verifyFill(element, value, options);

                if (verificationResult.success) {
                    this.logger.log(`✅ Field filled successfully on attempt ${attempt + 1}: ${fieldId}`);
                    
                    this.recordSuccess(fieldId, attempt);
                    return {
                        success: true,
                        retries: attempt,
                        finalValue: value,
                        error: null
                    };
                } else {
                    lastError = verificationResult.error || 'Verification failed';
                    this.logger.warn(`Verification failed: ${lastError}`);
                }

            } catch (error) {
                lastError = error.message;
                this.logger.warn(`Attempt ${attempt + 1} failed: ${lastError}`);
            }

            // Don't wait after last attempt
            if (attempt < maxRetries) {
                const delay = this.calculateBackoffDelay(attempt);
                this.logger.log(`Waiting ${delay}ms before retry...`);
                await this.delay(delay);
            }

            attempt++;
        }

        // All retries exhausted
        this.logger.error(`All ${maxRetries + 1} attempts failed for ${fieldId}`);
        this.recordFailure(fieldId, maxRetries);

        return {
            success: false,
            retries: maxRetries,
            finalValue: this.getFieldValue(element),
            error: lastError
        };
    }

    /**
     * Fill field using appropriate method
     */
    async fillField(element, value, options = {}) {
        const fieldType = this.detectFieldType(element);

        switch (fieldType) {
            case 'text':
            case 'email':
            case 'password':
            case 'number':
            case 'tel':
                return this.fillTextInput(element, value);

            case 'textarea':
                return this.fillTextarea(element, value);

            case 'select':
                return this.fillSelect(element, value);

            case 'radio':
                return this.fillRadio(element, value);

            case 'checkbox':
                return this.fillCheckbox(element, value);

            case 'date':
                return this.fillDateInput(element, value);

            case 'react-input':
                return this.fillReactInput(element, value);

            case 'vue-input':
                return this.fillVueInput(element, value);

            default:
                return this.fillGenericField(element, value);
        }
    }

    /**
     * Detect field type
     */
    detectFieldType(element) {
        // Check for HTML5 input types
        if (element.tagName === 'INPUT') {
            const type = element.type;
            
            // Check for React input
            if (this.isReactElement(element)) {
                return 'react-input';
            }
            
            // Check for Vue input
            if (this.isVueElement(element)) {
                return 'vue-input';
            }

            return type;
        }

        if (element.tagName === 'TEXTAREA') {
            return 'textarea';
        }

        if (element.tagName === 'SELECT') {
            return 'select';
        }

        if (element.getAttribute('role') === 'radio') {
            return 'radio';
        }

        if (element.getAttribute('role') === 'checkbox') {
            return 'checkbox';
        }

        if (element.hasAttribute('contenteditable')) {
            return 'contenteditable';
        }

        return 'unknown';
    }

    /**
     * Fill text input field
     */
    fillTextInput(element, value) {
        element.focus();
        element.value = value;

        // Trigger events that frameworks listen to
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        return Promise.resolve();
    }

    /**
     * Fill textarea
     */
    fillTextarea(element, value) {
        element.focus();
        element.value = value;

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        return Promise.resolve();
    }

    /**
     * Fill select dropdown
     */
    async fillSelect(element, value) {
        // Try to find matching option
        const options = element.querySelectorAll('option');
        let found = false;

        for (const option of options) {
            if (option.value === value || option.textContent.trim() === value) {
                element.value = option.value;
                found = true;
                break;
            }

            // Try partial match
            if (option.textContent.toLowerCase().includes(value.toLowerCase())) {
                element.value = option.value;
                found = true;
                break;
            }
        }

        if (!found) {
            throw new Error(`No matching option for value: ${value}`);
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        return Promise.resolve();
    }

    /**
     * Fill radio button by value
     */
    async fillRadio(element, value) {
        // Find radio with matching value in same group
        const name = element.getAttribute('name');
        const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);

        for (const radio of radios) {
            if (radio.value === value || radio.textContent === value) {
                radio.click();
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                return Promise.resolve();
            }
        }

        throw new Error(`No matching radio for value: ${value}`);
    }

    /**
     * Check/uncheck checkbox
     */
    async fillCheckbox(element, value) {
        // Normalize value to boolean
        const shouldCheck = this.parseBoolean(value);

        if (element.checked !== shouldCheck) {
            element.click();
            element.checked = shouldCheck;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return Promise.resolve();
    }

    /**
     * Fill date input
     */
    fillDateInput(element, value) {
        // Parse and format date
        const formatted = this.formatDate(value);
        
        if (!formatted) {
            throw new Error(`Invalid date format: ${value}`);
        }

        element.value = formatted;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return Promise.resolve();
    }

    /**
     * Fill React-controlled input
     */
    async fillReactInput(element, value) {
        // React stores event handlers and state internally
        // Need to trigger React's synthetic events
        
        element.focus();
        element.value = value;

        // Create and dispatch React-compatible event
        const event = new Event('input', { bubbles: true });
        Object.defineProperty(event, 'target', {
            value: { value: value },
            enumerable: true
        });

        element.dispatchEvent(event);
        
        // Also dispatch change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        element.blur();

        return Promise.resolve();
    }

    /**
     * Fill Vue-controlled input
     */
    async fillVueInput(element, value) {
        // Vue watches for input events
        element.focus();
        element.value = value;

        // Dispatch events in sequence
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        element.blur();

        return Promise.resolve();
    }

    /**
     * Fill generic field (contenteditable, etc)
     */
    async fillGenericField(element, value) {
        if (element.hasAttribute('contenteditable')) {
            element.focus();
            element.textContent = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.blur();
        } else {
            element.focus();
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.blur();
        }

        return Promise.resolve();
    }

    /**
     * Verify field was filled correctly
     */
    async verifyFill(element, expectedValue, options = {}) {
        try {
            if (!this.isElementValid(element)) {
                return { success: false, error: 'Element is no longer valid' };
            }

            const actualValue = this.getFieldValue(element);
            const fieldType = this.detectFieldType(element);

            // Normalize values for comparison
            const normalizedExpected = this.normalizeValue(expectedValue, fieldType);
            const normalizedActual = this.normalizeValue(actualValue, fieldType);

            // Check if values match
            if (normalizedActual === normalizedExpected || 
                this.valuesMatch(normalizedActual, normalizedExpected)) {
                return { success: true, value: actualValue };
            }

            return { 
                success: false, 
                error: `Value mismatch: expected "${normalizedExpected}", got "${normalizedActual}"`
            };

        } catch (error) {
            return { 
                success: false, 
                error: `Verification error: ${error.message}`
            };
        }
    }

    /**
     * Clear field value
     */
    clearField(element) {
        const fieldType = this.detectFieldType(element);

        if (fieldType === 'checkbox') {
            element.checked = false;
        } else if (fieldType === 'radio') {
            element.checked = false;
        } else if (element.tagName === 'SELECT') {
            element.selectedIndex = 0;
        } else {
            element.value = '';
        }
    }

    /**
     * Get field value
     */
    getFieldValue(element) {
        const fieldType = this.detectFieldType(element);

        if (fieldType === 'checkbox') {
            return element.checked ? 'true' : 'false';
        }

        if (fieldType === 'radio') {
            return element.checked ? element.value : '';
        }

        return element.value || element.textContent || '';
    }

    /**
     * Check if values match (with tolerance for variations)
     */
    valuesMatch(actual, expected) {
        if (!actual || !expected) return false;

        // Exact match
        if (actual === expected) return true;

        // Case-insensitive match
        if (actual.toLowerCase() === expected.toLowerCase()) return true;

        // Partial match (for dropdowns)
        if (actual.includes(expected) || expected.includes(actual)) return true;

        // Fuzzy match for phone numbers, zips, etc
        const cleanActual = actual.replace(/\D/g, '');
        const cleanExpected = expected.replace(/\D/g, '');

        if (cleanActual && cleanExpected && cleanActual.includes(cleanExpected)) {
            return true;
        }

        return false;
    }

    /**
     * Normalize value for comparison
     */
    normalizeValue(value, fieldType) {
        if (!value) return '';

        const str = value.toString().trim();

        switch (fieldType) {
            case 'email':
                return str.toLowerCase();

            case 'tel':
            case 'phone':
                return str.replace(/\D/g, '');

            case 'checkbox':
                return str.toLowerCase() === 'true' ? 'true' : 'false';

            default:
                return str;
        }
    }

    /**
     * Parse boolean value
     */
    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return !['false', '0', 'no', 'off', ''].includes(value.toLowerCase());
        }
        return !!value;
    }

    /**
     * Format date for input[type="date"]
     */
    formatDate(value) {
        if (!value) return null;

        let date;

        if (value instanceof Date) {
            date = value;
        } else if (typeof value === 'string') {
            // Try parsing various formats
            date = this.parseDate(value);
        }

        if (!date) return null;

        // Format as YYYY-MM-DD for HTML5 date input
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    /**
     * Parse date from string
     */
    parseDate(dateString) {
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/,           // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/,         // MM/DD/YYYY
            /(\d{4})\/(\d{2})\/(\d{2})/,         // YYYY/MM/DD
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                try {
                    if (match.length === 4 && match[1].length === 4) {
                        return new Date(match[1], match[2] - 1, match[3]);
                    } else if (match.length === 4) {
                        return new Date(match[3], match[1] - 1, match[2]);
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        return null;
    }

    /**
     * Calculate exponential backoff delay
     */
    calculateBackoffDelay(attemptNumber) {
        const delay = AutoRetryEngine.CONFIG.INITIAL_DELAY_MS * 
                     Math.pow(AutoRetryEngine.CONFIG.BACKOFF_MULTIPLIER, attemptNumber);
        
        return Math.min(delay, AutoRetryEngine.CONFIG.MAX_DELAY_MS);
    }

    /**
     * Sleep/delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if element is still valid in DOM
     */
    isElementValid(element) {
        try {
            return element && 
                   element.tagName &&
                   document.contains(element) &&
                   !element.disabled;
        } catch {
            return false;
        }
    }

    /**
     * Check if element is React-controlled
     */
    isReactElement(element) {
        // React stores event handlers in __reactEventHandlers or __reactProps
        for (const key in element) {
            if (key.startsWith('__react')) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if element is Vue-controlled
     */
    isVueElement(element) {
        // Vue stores instances in __vue__
        return !!element.__vue__ || !!element.__vueParentComponent;
    }

    /**
     * Get unique element ID for tracking
     */
    getElementId(element) {
        return element.id || 
               element.name || 
               element.getAttribute('data-testid') ||
               `${element.tagName}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Record successful retry
     */
    recordSuccess(fieldId, attempts) {
        if (!this.retryHistory.has(fieldId)) {
            this.retryHistory.set(fieldId, { successes: 0, failures: 0, totalAttempts: 0 });
        }

        const record = this.retryHistory.get(fieldId);
        record.successes++;
        record.totalAttempts += attempts + 1;
    }

    /**
     * Record failed retry
     */
    recordFailure(fieldId, attempts) {
        if (!this.retryHistory.has(fieldId)) {
            this.retryHistory.set(fieldId, { successes: 0, failures: 0, totalAttempts: 0 });
        }

        const record = this.retryHistory.get(fieldId);
        record.failures++;
        record.totalAttempts += attempts + 1;
    }

    /**
     * Get retry statistics
     */
    getRetryStats() {
        const stats = {
            totalAttempts: 0,
            totalSuccesses: 0,
            totalFailures: 0,
            successRate: 0
        };

        for (const [fieldId, record] of this.retryHistory.entries()) {
            stats.totalAttempts += record.totalAttempts;
            stats.totalSuccesses += record.successes;
            stats.totalFailures += record.failures;
        }

        if (stats.totalAttempts > 0) {
            stats.successRate = (stats.totalSuccesses / stats.totalAttempts) * 100;
        }

        return stats;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoRetryEngine;
}
