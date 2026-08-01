/**
 * Intelligent Form Filler
 * Uses Application Understanding Engine to fill forms intelligently
 */

class IntelligentFormFiller {
    constructor() {
        this.engine = new ApplicationUnderstandingEngine();
        this.verificationEnabled = true;
        this.delayBetweenFields = 150; // ms
    }

    /**
     * Fill form intelligently
     */
    async fillForm(profile, context = {}) {
        console.log('[IFF] 🚀 Starting intelligent form fill...');

        try {
            // Step 1: Analyze application
            const formStructure = await this.engine.analyzeApplication();
            console.log('[IFF] 📋 Form analyzed:', formStructure);

            // Step 2: Save form structure to backend
            await this.saveFormStructure(formStructure);

            // Step 3: Fill fields
            const results = await this.fillAllFields(formStructure, profile, context);
            console.log('[IFF] ✅ Form fill complete:', results);

            // Step 4: Save application record
            await this.saveApplicationRecord(formStructure, results, profile);

            return results;
        } catch (error) {
            console.error('[IFF] ❌ Fill error:', error);
            throw error;
        }
    }

    /**
     * Fill all fields in the form
     */
    async fillAllFields(formStructure, profile, context) {
        const results = {
            filled: 0,
            skipped: 0,
            failed: 0,
            verified: 0,
            total: formStructure.fields.length,
            details: []
        };

        for (const fieldData of formStructure.fields) {
            try {
                await this.wait(this.delayBetweenFields);

                // Skip if no semantic intent recognized
                if (fieldData.semanticIntent.intent === 'unknown') {
                    results.skipped++;
                    results.details.push({
                        field: fieldData.label,
                        status: 'skipped',
                        reason: 'Unknown intent'
                    });
                    continue;
                }

                // Get value to fill
                const value = await this.getValueForField(fieldData, profile, context);

                if (!value && value !== false && value !== 0) {
                    results.skipped++;
                    results.details.push({
                        field: fieldData.label,
                        status: 'skipped',
                        reason: 'No value available'
                    });
                    continue;
                }

                // Fill the field
                const filled = await this.fillField(fieldData, value);

                if (filled) {
                    // Verify if enabled
                    if (this.verificationEnabled) {
                        const verified = await this.verifyField(fieldData, value);
                        if (verified) {
                            results.verified++;
                        } else {
                            console.warn('[IFF] ⚠️ Verification failed for:', fieldData.label);
                            // Try filling again
                            await this.fillField(fieldData, value);
                        }
                    }

                    results.filled++;
                    results.details.push({
                        field: fieldData.label,
                        intent: fieldData.semanticIntent.intent,
                        status: 'filled',
                        value: this.truncateValue(value)
                    });
                } else {
                    results.failed++;
                    results.details.push({
                        field: fieldData.label,
                        status: 'failed',
                        reason: 'Fill operation failed'
                    });
                }
            } catch (error) {
                console.error('[IFF] ❌ Error filling field:', fieldData.label, error);
                results.failed++;
                results.details.push({
                    field: fieldData.label,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get value for a field based on its semantic intent
     */
    async getValueForField(fieldData, profile, context) {
        const { semanticIntent, options, type } = fieldData;
        const intent = semanticIntent.intent;

        // For select/radio/checkbox with options, use intelligent matching
        if (options && options.length > 0 && ['select', 'radio', 'custom-select'].includes(type)) {
            const matchedOption = await this.engine.optionMatcher.findBestMatch(
                fieldData,
                profile,
                context
            );
            return matchedOption ? matchedOption.value : null;
        }

        // For regular fields, get value from profile
        return this.getProfileValue(intent, profile);
    }

    /**
     * Get value from profile based on intent
     */
    getProfileValue(intent, profile) {
        const mapping = {
            email: profile.email,
            full_name: profile.full_name || profile.name,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            address: profile.address,
            city: profile.city,
            state: profile.state,
            zip: profile.zip,
            country: profile.country,
            current_company: profile.current_company,
            current_title: profile.current_title,
            linkedin: profile.linkedin,
            github: profile.github,
            portfolio: profile.portfolio,
            years_of_experience: profile.years_of_experience,
            skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills,
            expected_salary: profile.expected_salary,
            notice_period: profile.notice_period,
            work_authorization: profile.work_authorization,
            work_environment: profile.work_environment,
            preferred_location: profile.preferred_location,
            why_company: profile.answer_why_company,
            why_hire: profile.answer_hire_you,
            about_you: profile.answer_about_you,
            cover_letter: profile.cover_letter,
            education: profile.education,
            graduation_year: profile.graduation_year
        };

        return mapping[intent] || null;
    }


    /**
     * Fill a single field
     */
    async fillField(fieldData, value) {
        const { element, type } = fieldData;

        if (!element || !this.isVisible(element)) {
            return false;
        }

        try {
            // Focus element
            element.focus();
            await this.wait(50);

            switch (type) {
                case 'text':
                case 'email':
                case 'tel':
                case 'url':
                case 'number':
                    return await this.fillTextInput(element, value);

                case 'textarea':
                    return await this.fillTextarea(element, value);

                case 'select':
                    return await this.fillSelect(element, value);

                case 'custom-select':
                    return await this.fillCustomSelect(element, value, fieldData);

                case 'radio':
                    return await this.fillRadio(element, value);

                case 'checkbox':
                    return await this.fillCheckbox(element, value);

                case 'date':
                    return await this.fillDate(element, value);

                case 'contenteditable':
                    return await this.fillContentEditable(element, value);

                default:
                    console.warn('[IFF] ⚠️ Unsupported field type:', type);
                    return false;
            }
        } catch (error) {
            console.error('[IFF] ❌ Fill error:', error);
            return false;
        }
    }

    /**
     * Fill text input
     */
    async fillTextInput(element, value) {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        return true;
    }

    /**
     * Fill textarea
     */
    async fillTextarea(element, value) {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /**
     * Fill standard select dropdown
     */
    async fillSelect(element, value) {
        const valueStr = String(value).toLowerCase().trim();

        // Try exact value match
        for (let i = 0; i < element.options.length; i++) {
            if (element.options[i].value.toLowerCase() === valueStr) {
                element.selectedIndex = i;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }

        // Try label match
        for (let i = 0; i < element.options.length; i++) {
            if (element.options[i].textContent.toLowerCase().trim() === valueStr) {
                element.selectedIndex = i;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }

        return false;
    }

    /**
     * Fill custom select (React Select, MUI, Ant Design)
     */
    async fillCustomSelect(element, value, fieldData) {
        try {
            // Click to open dropdown
            element.click();
            await this.wait(300);

            // Find option with matching value
            const optionSelectors = [
                `[role="option"][data-value="${value}"]`,
                `[role="option"]:contains("${value}")`,
                `[class*="option"][data-value="${value}"]`,
                `.ant-select-item[title="${value}"]`,
                `.MuiMenuItem-root[data-value="${value}"]`
            ];

            for (const selector of optionSelectors) {
                try {
                    const option = document.querySelector(selector);
                    if (option && this.isVisible(option)) {
                        option.click();
                        await this.wait(100);
                        return true;
                    }
                } catch (e) {
                    // Try next selector
                }
            }

            // Fallback: find by text content
            const options = document.querySelectorAll('[role="option"]');
            for (const option of options) {
                if (option.textContent.trim() === String(value).trim()) {
                    option.click();
                    await this.wait(100);
                    return true;
                }
            }

            // Close dropdown if no match
            document.body.click();
            return false;
        } catch (error) {
            console.error('[IFF] ❌ Custom select error:', error);
            return false;
        }
    }

    /**
     * Fill radio button
     */
    async fillRadio(element, value) {
        const name = element.name;
        const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        
        for (const radio of radios) {
            if (radio.value === String(value) || this.extractLabel(radio).toLowerCase() === String(value).toLowerCase()) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }
        
        return false;
    }

    /**
     * Fill checkbox
     */
    async fillCheckbox(element, value) {
        const shouldCheck = this.shouldCheck(value);
        if (element.checked !== shouldCheck) {
            element.checked = shouldCheck;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
    }

    /**
     * Fill date input
     */
    async fillDate(element, value) {
        // Convert value to YYYY-MM-DD format
        let dateStr = String(value);
        
        // If already in correct format, use it
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            element.value = dateStr;
        } else {
            // Try to parse and convert
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                element.value = `${year}-${month}-${day}`;
            }
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /**
     * Fill contenteditable element
     */
    async fillContentEditable(element, value) {
        element.textContent = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /**
     * Verify that field was filled correctly
     */
    async verifyField(fieldData, expectedValue) {
        await this.wait(100); // Wait for value to settle

        const { element, type } = fieldData;
        const actualValue = this.getCurrentValue(element, type);

        // For selects and radios, verify exact match
        if (['select', 'radio', 'custom-select'].includes(type)) {
            return String(actualValue).trim() === String(expectedValue).trim();
        }

        // For text fields, verify value is present
        if (['text', 'email', 'tel', 'url', 'textarea', 'contenteditable'].includes(type)) {
            return String(actualValue).trim().length > 0;
        }

        // For checkboxes, verify checked state
        if (type === 'checkbox') {
            return element.checked === this.shouldCheck(expectedValue);
        }

        return true;
    }

    /**
     * Get current value of element
     */
    getCurrentValue(element, type) {
        if (type === 'checkbox' || type === 'radio') {
            return element.checked;
        }
        if (type === 'contenteditable') {
            return element.textContent;
        }
        return element.value || '';
    }

    /**
     * Determine if value should check a checkbox
     */
    shouldCheck(value) {
        if (typeof value === 'boolean') return value;
        const lowerValue = String(value).toLowerCase();
        return ['yes', 'true', 'checked', '1', 'on'].includes(lowerValue);
    }

    /**
     * Extract label for element
     */
    extractLabel(element) {
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;
        return element.name || '';
    }

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetParent !== null;
    }

    /**
     * Save form structure to backend
     */
    async saveFormStructure(formStructure) {
        try {
            const response = await fetch('YOUR_BACKEND_URL/api/form-structures', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formStructure)
            });
            console.log('[IFF] 💾 Form structure saved');
        } catch (error) {
            console.warn('[IFF] ⚠️ Could not save form structure:', error);
        }
    }

    /**
     * Save application record
     */
    async saveApplicationRecord(formStructure, results, profile) {
        try {
            const record = {
                url: formStructure.url,
                platform: formStructure.platform,
                timestamp: new Date().toISOString(),
                profile: profile,
                results: results,
                formStructure: formStructure
            };

            await chrome.storage.local.get(['applicationHistory'], (data) => {
                const history = data.applicationHistory || [];
                history.push(record);
                chrome.storage.local.set({ applicationHistory: history });
            });

            console.log('[IFF] 💾 Application record saved');
        } catch (error) {
            console.warn('[IFF] ⚠️ Could not save application record:', error);
        }
    }

    /**
     * Truncate value for logging
     */
    truncateValue(value) {
        const str = String(value);
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }

    /**
     * Wait helper
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export
if (typeof window !== 'undefined') {
    window.IntelligentFormFiller = IntelligentFormFiller;
}
