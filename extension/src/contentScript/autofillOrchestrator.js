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
            console.log('[Orchestrator] 🚀 Starting autofill workflow...');
            console.log('[Orchestrator] Options received:', options ? `${Object.keys(options).length} keys` : 'none');

            // Step 1: Detect if we're on an application form
            console.log('[Orchestrator] Step 1: Detecting if this is an application form...');
            const isAppForm = this.detectApplicationForm();
            if (!isAppForm) {
                console.log('[Orchestrator] ⚠️  Step 1: Not an application form, aborting');
                return {
                    status: 'NOT_APPLICATION_FORM',
                    data: { filled: 0, skipped: 0, failed: 0, total: 0 }
                };
            }
            console.log('[Orchestrator] ✅ Step 1: Confirmed this is an application form');

            // Step 2: Get profile (either from options or from storage)
            console.log('[Orchestrator] Step 2: Getting autofill profile...');
            let profile = options.profile;
            
            if (!profile) {
                // Load from storage if not provided
                console.log('[Orchestrator]   Loading profile from storage...');
                profile = await new Promise((resolve) => {
                    chrome.storage.local.get(['profile', 'autofillProfile'], (result) => {
                        resolve(result.profile || result.autofillProfile);
                    });
                });
            } else {
                console.log('[Orchestrator]   Profile provided in options');
            }
            
            if (!profile || Object.keys(profile).length === 0) {
                console.log('[Orchestrator] ❌ Step 2: No profile available');
                return {
                    status: 'NO_PROFILE',
                    data: { filled: 0, skipped: 0, failed: 0, total: 0 }
                };
            }
            console.log(`[Orchestrator] ✅ Step 2: Profile loaded with ${Object.keys(profile).length} keys`);

            // Step 3: Detect and map form fields
            console.log('[Orchestrator] Step 3: Detecting form fields...');
            const fields = this.detectFormFields();

            if (!fields || fields.length === 0) {
                console.log('[Orchestrator] ❌ Step 3: No form fields detected');
                return {
                    status: 'NO_FIELDS_DETECTED',
                    data: { filled: 0, skipped: 0, failed: 0, total: 0 }
                };
            }
            console.log(`[Orchestrator] ✅ Step 3: Detected ${fields.length} form fields`);

            // Step 4: Auto-fill form fields
            console.log(`[Orchestrator] Step 4: Auto-filling ${fields.length} form fields...`);
            const results = await this.autofillFormFields(fields, profile);
            console.log(`[Orchestrator] ✅ Step 4: Auto-fill completed`);

            // Step 5: Report results
            const duration = Date.now() - startTime;
            console.log(`[Orchestrator] ⏱️  Autofill completed in ${duration}ms`);
            console.log('[Orchestrator] 📊 Final Results:', results);

            return {
                status: 'AUTOFILL_COMPLETE',
                data: {
                    filled: results.filled,
                    skipped: results.skipped,
                    failed: results.failed,
                    total: results.total,
                    details: results.details,
                    duration
                }
            };

        } catch (error) {
            console.error('[Orchestrator] ❌ FATAL ERROR:', error);
            console.error('[Orchestrator] Stack:', error.stack);
            return {
                status: 'AUTOFILL_ERROR',
                data: { 
                    error: error.message,
                    filled: 0, 
                    skipped: 0, 
                    failed: 0, 
                    total: 0
                }
            };
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
     * Detect and map all form fields - INTELLIGENT SEMANTIC MATCHING
     */
    detectFormFields() {
        const fields = [];
        // ENHANCED: Semantic field mapping with multiple pattern variations
        const fieldMapper = {
            // Email - multiple variations
            email: [
                'email', 'emailaddress', 'e-mail', 'mail', 'electronic mail',
                'email address', 'your email', 'contact email', 'business email'
            ],
            // Full Name - handles name field that accepts full name
            full_name: [
                'name', 'full name', 'fullname', 'full-name',
                'your name', 'applicant name', 'candidate name', 'person name',
                'complete name', 'entire name'
            ],
            // First Name
            first_name: [
                'first name', 'firstname', 'first-name', 'given name',
                'first', 'given', 'forename', 'your first name'
            ],
            // Last Name
            last_name: [
                'last name', 'lastname', 'last-name', 'family name',
                'surname', 'last', 'family', 'your last name'
            ],
            // Phone - multiple variations including whatsapp, mobile, cell
            phone: [
                'phone', 'telephone', 'mobile', 'cell', 'contact', 'mobile number',
                'phone number', 'cell phone', 'whatsapp', 'mobile phone',
                'contact number', 'phone no', 'tel', 'contact no', 'cellular'
            ],
            // Address
            address: [
                'address', 'street', 'street address', 'residential address',
                'home address', 'full address', 'mailing address', 'location'
            ],
            // City
            city: [
                'city', 'town', 'municipality', 'your city', 'city name'
            ],
            // State/Province/Region
            state: [
                'state', 'province', 'region', 'state/province', 'state province',
                'territory', 'county', 'administrative division', 'your state'
            ],
            // ZIP/Postal Code
            zip: [
                'zip', 'postal', 'postcode', 'zip code', 'postal code',
                'pincode', 'pin', 'postal zip', 'zip-code'
            ],
            // Country
            country: [
                'country', 'nation', 'country name', 'your country'
            ],
            // Current Company/Employment
            current_company: [
                'current company', 'current employer', 'employer', 'company',
                'organization', 'current organization', 'workplace', 'current job company',
                'company name', 'current employment'
            ],
            // Current Job Title
            current_title: [
                'current title', 'current position', 'job title', 'position',
                'current job', 'job title', 'occupation', 'current role',
                'current job title', 'designation'
            ],
            // Expected Salary / Current Salary / Salary (SMART: can fill both fields if needed)
            expected_salary: [
                'expected salary', 'desired salary', 'salary expectation',
                'expected compensation', 'salary requirement', 'salary',
                'annual salary', 'compensation', 'expected pay', 'salary expectancy',
                'current salary', 'current compensation', 'salary cts', 'current cts'
            ],
            // GitHub
            github: [
                'github', 'github profile', 'github url', 'github link',
                'github username', 'github account'
            ],
            // LinkedIn
            linkedin: [
                'linkedin', 'linkedin profile', 'linkedin url', 'linkedin link',
                'linkedin username'
            ],
            // Portfolio/Website
            portfolio: [
                'portfolio', 'website', 'portfolio url', 'portfolio link',
                'personal website', 'web url', 'portfolio website', 'your website'
            ],
            // Years of Experience
            years_of_experience: [
                'years of experience', 'experience', 'yoe', 'years exp',
                'total experience', 'professional experience', 'work experience',
                'experience years', 'exp', 'years in industry'
            ],
            // Skills
            skills: [
                'skills', 'technical skills', 'key skills', 'competencies',
                'expertise', 'abilities', 'skillset'
            ],
            // Notice Period
            notice_period: [
                'notice period', 'notice', 'availability', 'notice required',
                'when available', 'start date'
            ],
            // Work Authorization
            work_authorization: [
                'work authorization', 'authorization', 'visa', 'visa status',
                'work permit', 'eligible to work', 'authorization to work',
                'legal to work'
            ],
            // Work Environment
            work_environment: [
                'work environment', 'work type', 'office', 'remote',
                'working environment', 'work location preference'
            ]
        };

        // Detect all input elements
        const inputElements = document.querySelectorAll('input, select, textarea, [role="textbox"], [contenteditable="true"]');
        console.log(`[Orchestrator] 🔍 Found ${inputElements.length} input elements on the page`);

        for (const element of inputElements) {
            // Skip hidden fields and buttons
            if (element.type === 'hidden' || element.type === 'button' || element.type === 'submit') {
                continue;
            }

            if (!this.isVisible(element)) {
                continue;
            }

            // Get field label
            const label = this.getFieldLabel(element).toLowerCase().trim();
            
            if (!label) {
                console.log(`[Orchestrator] ⏭️  Skipping field with no label`);
                continue;
            }
            
            // Try to match to a profile field with SMART SEMANTIC MATCHING
            const match = this.semanticFieldMatch(label, fieldMapper);
            
            if (match) {
                fields.push({
                    element,
                    label,
                    fieldType: element.tagName.toLowerCase(),
                    resumeField: match.field,
                    confidence: match.confidence
                });
                console.log(`[Orchestrator] ✅ Detected field: "${label}" → "${match.field}" (confidence: ${match.confidence.toFixed(2)}, ${element.tagName})`);
            } else {
                console.log(`[Orchestrator] ⚠️  No pattern match for field: "${label}"`);
            }
        }

        console.log(`[Orchestrator] 📋 Total detected fields: ${fields.length}`, fields.map(f => ({ label: f.label, field: f.resumeField })));
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
     * INTELLIGENT SEMANTIC FIELD MATCHING
     * Matches form field labels to profile fields using:
     * 1. Exact substring matching (highest confidence)
     * 2. Semantic similarity (medium confidence)
     * 3. Word-by-word matching (lower confidence)
     */
    semanticFieldMatch(label, fieldMapper) {
        let bestMatch = null;
        let bestConfidence = 0;

        for (const [fieldName, patterns] of Object.entries(fieldMapper)) {
            for (const pattern of patterns) {
                const confidence = this.calculateMatchConfidence(label, pattern);
                
                if (confidence > bestConfidence) {
                    bestConfidence = confidence;
                    bestMatch = { field: fieldName, confidence };
                    
                    // If we have a very high confidence match, use it immediately
                    if (confidence > 0.95) {
                        return bestMatch;
                    }
                }
            }
        }

        // Return match only if confidence is above threshold (0.6 = 60%)
        return bestConfidence >= 0.6 ? bestMatch : null;
    }

    /**
     * Calculate semantic similarity between field label and pattern
     * Returns confidence score 0-1
     */
    calculateMatchConfidence(label, pattern) {
        const labelWords = label.split(/[\s\-_/]+/).filter(w => w.length > 0);
        const patternWords = pattern.split(/[\s\-_/]+/).filter(w => w.length > 0);

        // Exact substring match = highest confidence
        if (label.includes(pattern) || pattern.includes(label)) {
            return 0.95;
        }

        // Check if one is prefix of other
        if (label.startsWith(pattern) || pattern.startsWith(label)) {
            return 0.90;
        }

        // Calculate word-level similarity (Jaccard similarity)
        const labelSet = new Set(labelWords.map(w => w.toLowerCase()));
        const patternSet = new Set(patternWords.map(w => w.toLowerCase()));

        // Find intersection and union
        const intersection = [...labelSet].filter(word => patternSet.has(word)).length;
        const union = new Set([...labelSet, ...patternSet]).size;

        if (union === 0) return 0;

        const similarity = intersection / union;

        // Boost confidence for perfect word matches
        if (similarity === 1.0) {
            return 0.95;
        }

        // If at least one word matches, give decent confidence
        if (intersection > 0) {
            // More words matching = higher confidence
            return Math.min(0.85, 0.5 + (intersection / Math.max(labelWords.length, patternWords.length)) * 0.35);
        }

        // Levenshtein distance for typos (e.g., "phne" vs "phone")
        const distance = this.levenshteinDistance(label, pattern);
        const maxLen = Math.max(label.length, pattern.length);
        
        if (distance <= 2 && maxLen > 0) {
            // Small typo distance = good match
            return 0.80 - (distance * 0.05);
        }

        return 0;
    }

    /**
     * Calculate Levenshtein distance for typo detection
     */
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Auto-fill all detected form fields - WORKING VERSION
     */
    async autofillFormFields(fields, profile) {
        const results = {
            filled: 0,
            skipped: 0,
            failed: 0,
            total: fields.length,
            details: [],
            missedFields: []
        };

        console.log(`[Orchestrator] 📋 Starting to fill ${fields.length} fields with profile keys:`, Object.keys(profile));

        for (const field of fields) {
            try {
                // Get value from profile using field name
                let value = profile[field.resumeField];

                if (!value) {
                    results.skipped++;
                    results.missedFields.push(field.label);
                    results.details.push({
                        label: field.label,
                        field: field.resumeField,
                        status: 'skipped',
                        reason: `No data in profile for: ${field.resumeField}`
                    });
                    console.log(`[Orchestrator] ⏭️  Skipped field "${field.label}" - no value for "${field.resumeField}"`);
                    continue;
                }

                // Convert value to string
                value = String(value).trim();

                if (!value) {
                    results.skipped++;
                    results.missedFields.push(field.label);
                    console.log(`[Orchestrator] ⏭️  Skipped field "${field.label}" - empty value`);
                    continue;
                }

                // Try to fill the field
                console.log(`[Orchestrator] 🖊️  Filling field "${field.label}" with value: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
                const success = await this.fillField(field, value);

                if (success) {
                    results.filled++;
                    results.details.push({
                        label: field.label,
                        field: field.resumeField,
                        status: 'filled',
                        value: value
                    });
                    console.log(`[Orchestrator] ✅ Successfully filled field "${field.label}"`);
                } else {
                    results.failed++;
                    results.details.push({
                        label: field.label,
                        field: field.resumeField,
                        status: 'failed',
                        value: value,
                        reason: 'Element manipulation failed'
                    });
                    console.warn(`[Orchestrator] ❌ Failed to fill field "${field.label}"`);
                }

                // Add delay between fields
                await this.wait(this.delayBetweenFields);

            } catch (error) {
                console.error('[Orchestrator] ❌ Error filling field:', field.label, error);
                results.failed++;
                results.details.push({
                    label: field.label,
                    field: field.resumeField,
                    status: 'error',
                    error: error.message
                });
            }
        }

        console.log('[Orchestrator] 📊 Autofill summary:', { filled: results.filled, skipped: results.skipped, failed: results.failed, total: results.total });
        return results;
    }

    /**
     * Fill a single field - DIRECT IMPLEMENTATION
     */
    async fillField(field, value) {
        const { element, fieldType } = field;

        if (!element || !value) {
            console.warn(`[Orchestrator] ⚠️ Missing element or value for field "${field.label}"`);
            return false;
        }

        try {
            // Focus element first
            element.focus();
            await this.wait(50);

            // Handle different element types directly
            if (element.tagName === 'SELECT') {
                // Handle select/dropdown
                console.log(`[Orchestrator] 📍 Filling SELECT field "${field.label}"`);
                return this.fillSelect(element, value);
            } else if (element.tagName === 'TEXTAREA') {
                // Handle textarea
                console.log(`[Orchestrator] 📍 Filling TEXTAREA field "${field.label}"`);
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            } else if (element.tagName === 'INPUT') {
                // Handle input field
                const type = element.type?.toLowerCase();
                
                if (type === 'checkbox') {
                    console.log(`[Orchestrator] 📍 Filling CHECKBOX field "${field.label}"`);
                    // Check checkbox based on value
                    const shouldCheck = this.shouldCheck(value);
                    element.checked = shouldCheck;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                } else if (type === 'radio') {
                    console.log(`[Orchestrator] 📍 Filling RADIO field "${field.label}"`);
                    // Select radio based on value
                    const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
                    for (const radio of radioGroup) {
                        if (radio.value === value || radio.getAttribute('value') === value) {
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    }
                    return false;
                } else {
                    console.log(`[Orchestrator] 📍 Filling TEXT INPUT field "${field.label}" (type: ${type})`);
                    // Text input
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                    return true;
                }
            } else if (element.hasAttribute('contenteditable')) {
                console.log(`[Orchestrator] 📍 Filling CONTENTEDITABLE field "${field.label}"`);
                // Handle contenteditable elements
                element.textContent = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }

            console.warn(`[Orchestrator] ⚠️ Unknown element type for field "${field.label}": ${element.tagName}`);
            return false;

        } catch (error) {
            console.error('[Orchestrator] ❌ Error filling field:', field.label, error.message);
            return false;
        }
    }

    /**
     * Fill select/dropdown field
     */
    fillSelect(element, value) {
        if (!element.options) {
            return false;
        }

        const valueStr = String(value).trim().toLowerCase();
        
        // Try to find exact match
        for (let i = 0; i < element.options.length; i++) {
            const option = element.options[i];
            if (option.value.toLowerCase() === valueStr || option.textContent.toLowerCase() === valueStr) {
                element.selectedIndex = i;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }

        // Try partial match
        for (let i = 0; i < element.options.length; i++) {
            const option = element.options[i];
            if (option.textContent.toLowerCase().includes(valueStr) || valueStr.includes(option.textContent.toLowerCase())) {
                element.selectedIndex = i;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }

        // Try value match
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return element.value === value;
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
