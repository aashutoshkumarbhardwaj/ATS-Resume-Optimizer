/**
 * Smart Autofill Engine - Enhanced
 * Comprehensive autofill with intelligent field detection and dropdown matching
 * Handles text, select, radio, checkbox, and framework-specific fields
 */

class SmartAutofillEngine {
    constructor() {
        this.results = {
            filled: 0,
            skipped: 0,
            failed: 0,
            total: 0,
            details: []
        };
        this.delayBetweenFields = 100; // ms between field fills
        this.attemptCount = 0;
        this.maxAttempts = 3; // Retry count for each field
    }

    /**
     * Main autofill entry point
     */
    async autofill(profile) {
        try {
            console.log('[SmartAutofill] Starting autofill with profile:', {
                name: profile.fullName || profile.firstName,
                email: profile.email,
                phone: profile.phone
            });

            // Detect form fields
            const fields = this.detectFormFields();
            console.log('[SmartAutofill] Detected fields:', fields.length);
            this.results.total = fields.length;

            // Process each field
            for (const field of fields) {
                await this.processField(field, profile);
                await this.delay(this.delayBetweenFields);
            }

            console.log('[SmartAutofill] Autofill complete:', this.results);
            return this.results;

        } catch (error) {
            console.error('[SmartAutofill] Error:', error);
            return this.results;
        }
    }

    /**
     * Process individual field
     */
    async processField(field, profile) {
        try {
            // Get value from profile
            const value = this.extractProfileValue(profile, field);

            if (!value) {
                this.results.skipped++;
                this.results.details.push({
                    label: field.label,
                    status: 'skipped',
                    reason: 'No matching data in profile'
                });
                return;
            }

            console.log(`[SmartAutofill] Processing field: ${field.label} → ${value}`);

            // Fill based on field type
            let success = false;
            for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
                success = await this.fillField(field, value);
                if (success) break;
                if (attempt < this.maxAttempts - 1) {
                    await this.delay(200);
                }
            }

            if (success) {
                this.results.filled++;
                this.results.details.push({
                    label: field.label,
                    status: 'filled',
                    value: this.truncateValue(value),
                    fieldType: field.type
                });
                console.log(`[SmartAutofill] ✅ Filled: ${field.label}`);
            } else {
                this.results.failed++;
                this.results.details.push({
                    label: field.label,
                    status: 'failed',
                    reason: 'Could not set value',
                    fieldType: field.type
                });
                console.log(`[SmartAutofill] ❌ Failed to fill: ${field.label}`);
            }

        } catch (error) {
            this.results.failed++;
            this.results.details.push({
                label: field.label,
                status: 'error',
                error: error.message
            });
            console.error(`[SmartAutofill] Error processing ${field.label}:`, error);
        }
    }

    /**
     * Detect all form fields
     */
    detectFormFields() {
        const fields = [];
        const elements = document.querySelectorAll('input, select, textarea');

        elements.forEach((element, index) => {
            if (this.isVisibleAndInteractive(element)) {
                const field = {
                    id: element.id || `field_${index}`,
                    element,
                    type: this.getFieldType(element),
                    label: this.getFieldLabel(element),
                    name: element.name || '',
                    value: element.value || '',
                    placeholder: element.placeholder || '',
                    ariaLabel: element.getAttribute('aria-label') || ''
                };

                fields.push(field);
            }
        });

        return fields;
    }

    /**
     * Get field type
     */
    getFieldType(element) {
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'input') {
            return element.type || 'text';
        } else if (tagName === 'select') {
            return 'select';
        } else if (tagName === 'textarea') {
            return 'textarea';
        }

        return 'unknown';
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

        // Try title
        const title = element.getAttribute('title');
        if (title) return title;

        // Try placeholder
        if (element.placeholder) return element.placeholder;

        // Try data-testid
        const testid = element.getAttribute('data-testid');
        if (testid) return testid;

        // Try name
        if (element.name) return element.name;

        // Try nearby text
        return this.getNearbyText(element);
    }

    /**
     * Get nearby text for context
     */
    getNearbyText(element) {
        const parent = element.parentElement;
        if (!parent) return '';

        const text = parent.textContent
            .substring(0, 100)
            .split('\n')
            .map(t => t.trim())
            .filter(t => t)
            .slice(0, 2)
            .join(' ');

        return text;
    }

    /**
     * Check if element is visible and interactive
     */
    isVisibleAndInteractive(element) {
        // Skip hidden inputs
        if (element.type === 'hidden' || element.style.display === 'none') {
            return false;
        }

        // Check visibility
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;

        // Check if disabled
        if (element.disabled || element.readOnly) return false;

        return true;
    }

    /**
     * Extract value from profile
     */
    extractProfileValue(profile, field) {
        const fieldLabel = (field.label + ' ' + field.name).toLowerCase();

        // Get field type for matching
        const fieldType = this.detectFieldType(fieldLabel, field.type);

        // Get value based on field type
        const value = this.getProfileData(profile, fieldType);
        return value;
    }

    /**
     * Detect field type from label/name
     */
    detectFieldType(text, inputType) {
        // Direct input type checks
        if (inputType === 'email') return 'email';
        if (inputType === 'tel') return 'phone';
        if (inputType === 'date') return 'date';

        // Label-based detection
        if (text.includes('country')) return 'country';
        if (text.includes('state') || text.includes('province')) return 'state';
        if (text.includes('employment') && text.includes('type')) return 'employmentType';
        if (text.includes('notice') || text.includes('availability')) return 'noticePeriod';
        if (text.includes('visa') || text.includes('sponsorship')) return 'visaStatus';
        if (text.includes('experience') || text.includes('years')) return 'yearsExperience';
        if (text.includes('education') || text.includes('degree')) return 'education';
        if (text.includes('salary') || text.includes('compensation')) return 'salary';
        if (text.includes('email')) return 'email';
        if (text.includes('phone') || text.includes('mobile')) return 'phone';
        if (text.includes('name') && text.includes('first')) return 'firstName';
        if (text.includes('name') && text.includes('last')) return 'lastName';
        if (text.includes('address')) return 'address';
        if (text.includes('city')) return 'city';
        if (text.includes('zip') || text.includes('postal')) return 'zipCode';
        if (text.includes('company')) return 'currentCompany';
        if (text.includes('title') || text.includes('position')) return 'jobTitle';
        if (text.includes('linkedin')) return 'linkedin';
        if (text.includes('github')) return 'github';
        if (text.includes('portfolio')) return 'portfolio';
        if (text.includes('website')) return 'website';

        return 'unknown';
    }

    /**
     * Get profile data by field type
     */
    getProfileData(profile, fieldType) {
        switch (fieldType) {
            case 'email':
                return profile.email || null;
            case 'phone':
                return profile.phone || null;
            case 'firstName':
                return profile.firstName || (profile.fullName?.split(' ')[0]) || null;
            case 'lastName':
                return profile.lastName || (profile.fullName?.split(' ').pop()) || null;
            case 'fullName':
                return profile.fullName || profile.firstName + ' ' + profile.lastName || null;
            case 'address':
                return profile.address || null;
            case 'city':
                return profile.city || null;
            case 'state':
                return profile.state || null;
            case 'zipCode':
                return profile.zip || profile.zipCode || null;
            case 'country':
                return profile.country || null;
            case 'currentCompany':
                return profile.currentCompany || null;
            case 'jobTitle':
                return profile.currentTitle || profile.jobTitle || null;
            case 'yearsExperience':
                return profile.yearsOfExperience?.toString() || null;
            case 'education':
                return profile.degree || profile.education || null;
            case 'salary':
                return profile.expectedSalary || profile.salary || null;
            case 'noticePeriod':
                return profile.noticePeriod || null;
            case 'visaStatus':
                return profile.workAuthorization || profile.visaStatus || null;
            case 'linkedin':
                return profile.linkedin || profile.linkedIn || null;
            case 'github':
                return profile.github || null;
            case 'portfolio':
                return profile.portfolio || null;
            case 'website':
                return profile.website || profile.portfolio || null;
            default:
                return null;
        }
    }

    /**
     * Fill field based on type
     */
    async fillField(field, value) {
        try {
            const element = field.element;

            if (field.type === 'select') {
                return this.fillSelectField(element, value);
            } else if (field.type === 'checkbox') {
                return this.fillCheckboxField(element, value);
            } else if (field.type === 'radio') {
                return this.fillRadioField(element, value);
            } else if (field.type === 'textarea') {
                return this.fillTextarea(element, value);
            } else {
                return this.fillTextField(element, value);
            }
        } catch (error) {
            console.error('[SmartAutofill] Error filling field:', error);
            return false;
        }
    }

    /**
     * Fill text input
     */
    fillTextField(element, value) {
        try {
            element.focus();
            element.value = value?.toString() || '';

            // Trigger events for framework compatibility
            this.triggerEvents(element, 'text');

            return element.value === (value?.toString() || '');
        } catch (error) {
            console.error('[SmartAutofill] Error filling text field:', error);
            return false;
        }
    }

    /**
     * Fill textarea
     */
    fillTextarea(element, value) {
        return this.fillTextField(element, value);
    }

    /**
     * Fill select dropdown with smart matching
     */
    fillSelectField(element, value) {
        try {
            if (!value) return false;

            const options = Array.from(element.options || []);
            if (options.length === 0) return false;

            // Get field type for smart matching
            const fieldLabel = this.getFieldLabel(element).toLowerCase();
            let fieldType = 'generic';

            if (fieldLabel.includes('country')) {
                fieldType = 'country';
            } else if (fieldLabel.includes('state')) {
                fieldType = 'state';
            } else if (fieldLabel.includes('employment')) {
                fieldType = 'employmentType';
            } else if (fieldLabel.includes('notice')) {
                fieldType = 'noticePeriod';
            } else if (fieldLabel.includes('visa') || fieldLabel.includes('sponsorship')) {
                fieldType = 'visaStatus';
            } else if (fieldLabel.includes('experience')) {
                fieldType = 'yearsExperience';
            } else if (fieldLabel.includes('education') || fieldLabel.includes('degree')) {
                fieldType = 'education';
            } else if (fieldLabel.includes('salary')) {
                fieldType = 'salary';
            }

            // Use DropdownSelector for smart matching
            if (typeof DropdownSelector !== 'undefined') {
                const matchedOption = DropdownSelector.findBestMatch(fieldType, value, options);
                if (matchedOption) {
                    const optionValue = DropdownSelector.getOptionValue(matchedOption);
                    element.value = optionValue;
                    this.triggerEvents(element, 'select');
                    return element.value === optionValue;
                }
            }

            // Fallback: basic string matching
            for (const option of options) {
                const optionText = option.text?.toLowerCase() || option.value?.toLowerCase() || '';
                const valueStr = value?.toString()?.toLowerCase() || '';

                if (optionText.includes(valueStr) || valueStr.includes(optionText) || optionText === valueStr) {
                    element.value = option.value;
                    this.triggerEvents(element, 'select');
                    return element.value === option.value;
                }
            }

            return false;
        } catch (error) {
            console.error('[SmartAutofill] Error filling select field:', error);
            return false;
        }
    }

    /**
     * Fill checkbox
     */
    fillCheckboxField(element, value) {
        try {
            const shouldCheck = this.shouldCheck(value);
            element.checked = shouldCheck;
            this.triggerEvents(element, 'checkbox');
            return element.checked === shouldCheck;
        } catch (error) {
            console.error('[SmartAutofill] Error filling checkbox:', error);
            return false;
        }
    }

    /**
     * Fill radio button
     */
    fillRadioField(element, value) {
        try {
            const name = element.name;
            const radioButtons = document.querySelectorAll(`input[type="radio"][name="${name}"]`);

            for (const radio of radioButtons) {
                const valueStr = value?.toString()?.toLowerCase() || '';
                const radioValue = radio.value?.toLowerCase() || '';

                if (radioValue === valueStr || radioValue.includes(valueStr)) {
                    radio.checked = true;
                    this.triggerEvents(radio, 'radio');
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('[SmartAutofill] Error filling radio field:', error);
            return false;
        }
    }

    /**
     * Determine if checkbox should be checked
     */
    shouldCheck(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;

        const strValue = value?.toString()?.toLowerCase() || '';
        return ['yes', 'true', 'checked', '1', 'on', 'y'].includes(strValue);
    }

    /**
     * Trigger events for framework compatibility
     */
    triggerEvents(element, fieldType) {
        const eventNames = ['focus', 'input', 'change', 'blur'];

        eventNames.forEach(eventName => {
            const event = new Event(eventName, { bubbles: true, cancelable: true });
            element.dispatchEvent(event);
        });

        // React compatibility
        try {
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(changeEvent);
        } catch (e) {
            // Silently fail
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Truncate value for display
     */
    truncateValue(value) {
        const str = value?.toString() || '';
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartAutofillEngine;
}
