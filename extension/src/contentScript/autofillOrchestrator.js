/**
 * Autofill Orchestrator - Phase 2
 * Coordinates automatic autofill workflow
 * Handles job detection, resume loading, and form filling
 */

class AutofillOrchestrator {
    constructor() {
        this.maxRetries = 3;
        this.delayBetweenFields = 100; // ms
    }

    /**
     * Start automatic autofill workflow
     */
    async start(options = {}) {
        const startTime = Date.now();

        try {
            console.log('[Orchestrator] Starting autofill workflow...');

            // Step 1: Detect if we're on an application form
            const isAppForm = this.detectApplicationForm();
            if (!isAppForm) {
                console.log('[Orchestrator] Not an application form');
                return this.sendResult('NOT_APPLICATION_FORM');
            }

            // Step 2: Extract job description
            console.log('[Orchestrator] Extracting job description...');
            const jobData = await this.extractJobDescription();

            if (!jobData || (jobData.confidence && jobData.confidence < 30)) {
                console.log('[Orchestrator] Job extraction failed or low confidence');
                return this.sendResult('ENABLE_MANUAL_JOB_INPUT', {
                    confidence: jobData?.confidence || 0
                });
            }

            // Step 3: Load user's resume
            console.log('[Orchestrator] Loading resume...');
            const resume = await this.loadResume();

            if (!resume) {
                console.log('[Orchestrator] No resume loaded');
                return this.sendResult('SHOW_RESUME_UPLOAD');
            }

            // Step 4: Detect and map form fields
            console.log('[Orchestrator] Detecting form fields...');
            const fields = this.detectFormFields();

            if (!fields || fields.length === 0) {
                console.log('[Orchestrator] No form fields detected');
                return this.sendResult('NO_FIELDS_DETECTED');
            }

            // Step 5: Auto-fill form fields
            console.log(`[Orchestrator] Auto-filling ${fields.length} form fields...`);
            const results = await this.autofillFormFields(fields, resume);

            // Step 6: Report results
            const duration = Date.now() - startTime;
            console.log(`[Orchestrator] Autofill completed in ${duration}ms`);

            return this.sendResult('AUTOFILL_COMPLETE', {
                filled: results.filled,
                skipped: results.skipped,
                failed: results.failed,
                total: results.total,
                details: results.details,
                duration
            });

        } catch (error) {
            console.error('[Orchestrator] Error:', error);
            return this.sendResult('AUTOFILL_ERROR', { error: error.message });
        }
    }

    /**
     * Detect if current page is an application form
     */
    detectApplicationForm() {
        const inputs = document.querySelectorAll('input, select, textarea, [role="textbox"], [contenteditable="true"]');
        return inputs.length > 0;
    }

    /**
     * Extract job description from page
     */
    async extractJobDescription() {
        // This would call existing job detection logic from content-script.js
        // For now, return placeholder
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'EXTRACT_JOB_DESCRIPTION'
            }, (response) => {
                resolve(response?.job || null);
            });
        });
    }

    /**
     * Load user's saved resume from storage
     */
    async loadResume() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['uploadedResume', 'currentProfile'], (result) => {
                let resume = result.uploadedResume;

                if (!resume && result.currentProfile) {
                    // Try to load from profile
                    resume = result.currentProfile.resumeData;
                }

                resolve(resume);
            });
        });
    }

    /**
     * Detect and map all form fields
     */
    detectFormFields() {
        const fields = [];
        const fieldDetector = new FieldDetector();
        const fieldMapper = new FieldMapper();

        // Detect all input elements
        const inputElements = document.querySelectorAll('input, select, textarea, [role="textbox"], [contenteditable="true"]');

        for (const element of inputElements) {
            // Skip hidden fields and buttons
            if (element.type === 'hidden' || element.type === 'button' || element.type === 'submit') {
                continue;
            }

            if (!this.isVisible(element)) {
                continue;
            }

            // Detect field info
            const fieldInfo = fieldDetector.detectField(element);

            // Map to resume field
            const label = this.getFieldLabel(element);
            const resumeFieldType = fieldMapper.mapLabelToField(label);

            if (resumeFieldType) {
                fields.push({
                    element,
                    label,
                    fieldType: fieldInfo.type,
                    resumeField: resumeFieldType,
                    confidence: fieldMapper.calculateConfidence(label, resumeFieldType)
                });
            }
        }

        return fields;
    }

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (!element) return false;

        // Check display property
        if (element.style.display === 'none') return false;

        // Check visibility
        if (element.style.visibility === 'hidden') return false;

        // Check opacity
        if (element.style.opacity === '0') return false;

        // Check offsetParent
        if (element.offsetParent === null && element.tagName !== 'BODY') return false;

        return true;
    }

    /**
     * Get field label
     */
    getFieldLabel(element) {
        // Try associated label
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }

        // Try aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        // Try placeholder
        if (element.placeholder) return element.placeholder;

        // Try name attribute
        if (element.name) return element.name;

        // Try nearby text
        const parent = element.parentElement;
        if (parent) {
            const text = parent.textContent;
            if (text) return text.split(element.textContent)[0].trim();
        }

        return '';
    }

    /**
     * Auto-fill all detected form fields
     */
    async autofillFormFields(fields, resume) {
        const results = {
            filled: 0,
            skipped: 0,
            failed: 0,
            total: fields.length,
            details: []
        };

        for (const field of fields) {
            try {
                // Extract value from resume
                const resumeValue = FieldMapper.extractResumeValue(resume, field.resumeField);

                if (!resumeValue) {
                    results.skipped++;
                    results.details.push({
                        label: field.label,
                        status: 'skipped',
                        reason: 'No data in resume'
                    });
                    continue;
                }

                // Transform value if needed
                let value = FieldMapper.transformValue(resumeValue, field.resumeField);

                // Fill the field based on type
                const success = await this.fillField(field, value);

                if (success) {
                    results.filled++;
                    results.details.push({
                        label: field.label,
                        status: 'filled',
                        value: value.toString().substring(0, 50)
                    });
                } else {
                    results.failed++;
                    results.details.push({
                        label: field.label,
                        status: 'failed',
                        reason: 'Could not set value'
                    });
                }

            } catch (error) {
                results.failed++;
                results.details.push({
                    label: field.label,
                    status: 'error',
                    error: error.message
                });
            }

            // Delay between fields
            await this.wait(this.delayBetweenFields);
        }

        return results;
    }

    /**
     * Fill a single field
     */
    async fillField(field, value) {
        const { element, fieldType, resumeField } = field;

        try {
            // Focus element
            EventDispatcher.focus(element);
            await this.wait(50);

            // Handle different field types
            switch (fieldType) {
                case 'checkbox':
                    return await EventDispatcher.dispatchCheckboxEvents(element, this.shouldCheck(value));

                case 'radio':
                    return await EventDispatcher.dispatchRadioEvents(element);

                case 'select':
                    return await this.fillSelectField(element, value);

                case 'textarea':
                    return await EventDispatcher.dispatchTextareaEvents(element, value);

                default:
                    return await EventDispatcher.dispatchInputEvents(element, value);
            }

        } catch (error) {
            console.error('[Orchestrator] Error filling field:', error);
            return false;
        }
    }

    /**
     * Fill select/dropdown field
     */
    async fillSelectField(element, value) {
        // Check if it's a React Select or other framework
        if (ReactSelectAdapter.detect(element)) {
            return await ReactSelectAdapter.setValue(element, value);
        }

        if (MUISelectAdapter.detect(element)) {
            return await MUISelectAdapter.setValue(element, value);
        }

        if (AntDesignSelectAdapter.detect(element)) {
            return await AntDesignSelectAdapter.setValue(element, value);
        }

        // Native select
        const options = Array.from(element.options || []);
        if (options.length === 0) {
            return false;
        }

        const selector = new DropdownSelector();
        const matchedOption = selector.findBestMatch(element.name || element.id || '', value, options);

        if (matchedOption) {
            element.value = matchedOption.value || matchedOption;
            return await EventDispatcher.dispatchSelectEvents(element, element.value);
        }

        return false;
    }

    /**
     * Determine if value should be checked (for checkboxes)
     */
    shouldCheck(value) {
        if (typeof value === 'boolean') return value;

        const lowerValue = value.toString().toLowerCase();
        return ['yes', 'true', 'checked', '1', 'on'].includes(lowerValue);
    }

    /**
     * Send result back to popup
     */
    sendResult(type, data = {}) {
        chrome.runtime.sendMessage({
            type: 'AUTOFILL_RESULT',
            resultType: type,
            data
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[Orchestrator] Send result error:', chrome.runtime.lastError);
            }
        });

        return { type, data };
    }

    /**
     * Helper: wait
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutofillOrchestrator;
}
