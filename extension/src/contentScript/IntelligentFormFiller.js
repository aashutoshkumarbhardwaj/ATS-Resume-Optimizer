/**
 * Intelligent Form Filler
 * Uses Application Understanding Engine to fill forms intelligently
 */

class IntelligentFormFiller {
    constructor() {
        const EngineClass = (typeof window !== 'undefined' && window.ApplicationUnderstandingEngine) || (typeof ApplicationUnderstandingEngine !== 'undefined' ? ApplicationUnderstandingEngine : null);
        this.engine = EngineClass ? new EngineClass() : null;
        const BrainClass = (typeof window !== 'undefined' && window.PersonalAgentBrain) || (typeof PersonalAgentBrain !== 'undefined' ? PersonalAgentBrain : null);
        this.brain = BrainClass ? new BrainClass() : null;
        this.verificationEnabled = true;
        this.delayBetweenFields = 150; // ms
    }

    /**
     * Fill form intelligently
     */
    async fillForm(profile, context = {}) {
        console.log('[IFF] 🚀 Starting intelligent form fill...');

        try {
            if (this.brain) {
                await this.brain.init();
                if (profile) {
                    this.brain.profile = Object.assign({}, this.brain.profile, profile);
                }
            }

            // Step 1: Analyze application
            const formStructure = this.engine ? await this.engine.analyzeApplication() : { fields: [] };
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
     * Check if a field is already filled by the user or pre-populated
     */
    isFieldAlreadyFilled(fieldData, element) {
        if (!element) return false;

        const type = fieldData?.type || element.type || element.tagName?.toLowerCase();

        // 1. File inputs
        if (type === 'file' || element.type === 'file') {
            return !!(element.files && element.files.length > 0);
        }

        // 2. Radio buttons
        if (type === 'radio' || element.type === 'radio') {
            if (element.name) {
                return !!document.querySelector(`input[type="radio"][name="${element.name}"]:checked`);
            }
            return !!element.checked;
        }

        // 3. Checkboxes
        if (type === 'checkbox' || element.type === 'checkbox') {
            return !!element.checked;
        }

        // 4. HTML <select> Element
        if (element.tagName === 'SELECT') {
            if (element.selectedIndex < 0) return false;
            const opt = element.options[element.selectedIndex];
            if (!opt) return false;
            const text = (opt.text || opt.textContent || '').trim();
            const val = (opt.value || '').trim();
            if (!val && !text) return false;
            const isPlaceholder = !val || /^(?:select|choose|pick|please\s*select|none|\-\-)/i.test(text);
            return !isPlaceholder;
        }

        // 5. Custom dropdowns & ARIA comboboxes
        if (type === 'custom-select' || (element.getAttribute && element.getAttribute('role') === 'combobox')) {
            const ariaSelected = (typeof element.querySelector === 'function')
                ? element.querySelector('[aria-selected="true"], [class*="singleValue"], .selected-option, [class*="value-container"]')
                : null;
            if (ariaSelected) {
                const text = (ariaSelected.textContent || '').trim();
                return text.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(text);
            }
            const innerText = (element.innerText || element.textContent || '').trim();
            return innerText.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(innerText);
        }

        // 6. Contenteditable
        if ((typeof element.hasAttribute === 'function' && element.hasAttribute('contenteditable')) || (element.getAttribute && element.getAttribute('role') === 'textbox')) {
            const text = (element.innerText || element.textContent || '').trim();
            return text.length > 0;
        }

        // 7. Text, email, tel, number, textarea, date
        const val = (element.value || '').trim();
        const placeholder = (element.placeholder || '').trim();
        if (!val) return false;
        if (placeholder && val.toLowerCase() === placeholder.toLowerCase()) return false;
        return true;
    }

    /**
     * Sort fields strictly by visual on-screen coordinates (top-to-bottom, then left-to-right)
     */
    sortFieldsSequentially(fields) {
        if (!Array.isArray(fields) || fields.length <= 1) return fields;
        const scrollY = (typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : 0);
        const scrollX = (typeof window !== 'undefined' && typeof window.scrollX === 'number' ? window.scrollX : 0);

        return [...fields].sort((a, b) => {
            const elA = a.element || (a.id && typeof document !== 'undefined' ? document.getElementById(a.id) : null);
            const elB = b.element || (b.id && typeof document !== 'undefined' ? document.getElementById(b.id) : null);
            if (!elA || !elB) return 0;

            const rectA = elA.getBoundingClientRect ? elA.getBoundingClientRect() : { top: 0, left: 0 };
            const rectB = elB.getBoundingClientRect ? elB.getBoundingClientRect() : { top: 0, left: 0 };
            const topA = (rectA.top || 0) + scrollY;
            const topB = (rectB.top || 0) + scrollY;
            const leftA = (rectA.left || 0) + scrollX;
            const leftB = (rectB.left || 0) + scrollX;

            if (Math.abs(topA - topB) > 8) {
                return topA - topB;
            }
            return leftA - leftB;
        });
    }

    /**
     * Fill all fields in the form sequentially, skipping already filled fields
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

        const sortedFields = this.sortFieldsSequentially(formStructure.fields);

        for (const fieldData of sortedFields) {
            try {
                const element = fieldData.element;

                // STRICT USER RULE: Never touch already filled data!
                if (this.isFieldAlreadyFilled(fieldData, element)) {
                    results.skipped++;
                    results.details.push({
                        field: fieldData.label,
                        status: 'skipped',
                        reason: 'Field already filled'
                    });
                    console.log(`[IFF] ⏭️ Field already filled: "${fieldData.label}". Leaving as is.`);
                    continue;
                }

                await this.wait(this.delayBetweenFields);

                // Get value to fill via PersonalAgentBrain or semantic mappings
                const value = await this.getValueForField(fieldData, profile, context);

                if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                    results.skipped++;
                    results.details.push({
                        field: fieldData.label,
                        status: 'skipped',
                        reason: 'No value available'
                    });
                    continue;
                }

                // Fill the field based on its type
                const filled = await this.fillField(fieldData, value);

                if (filled) {
                    // Closed-loop Verification & Self-Correction (Claude in Chrome pattern)
                    let isVerified = true;
                    let verificationDetails = null;

                    if (this.verificationEnabled) {
                        verificationDetails = await this.verifyField(fieldData, element, value);
                        if (!verificationDetails.verified) {
                            console.warn(`[IFF] ⚠️ Initial verification failed for "${fieldData.label}". Initiating self-correction...`);
                            const correction = await this.selfCorrectField(fieldData, element, value, verificationDetails);
                            isVerified = correction.verified;
                            if (isVerified) {
                                console.log(`[IFF] 🎯 Self-correction succeeded for "${fieldData.label}"!`);
                            }
                        }
                    }

                    if (isVerified) {
                        results.filled++;
                        results.verified = (results.verified || 0) + 1;
                        results.details.push({
                            field: fieldData.label,
                            status: 'success',
                            verified: true,
                            value: typeof value === 'string' && value.length > 20 ? value.substring(0, 20) + '...' : value
                        });

                        // Highlight filled field if helper exists
                        if (typeof this.highlightField === 'function') {
                            this.highlightField(element, 'success');
                        }
                    } else {
                        results.failed++;
                        results.details.push({
                            field: fieldData.label,
                            status: 'failed',
                            verified: false,
                            reason: verificationDetails?.errorReason || 'Value rejected by form validation'
                        });
                        if (typeof this.highlightField === 'function') {
                            this.highlightField(element, 'error');
                        }
                    }
                } else {
                    results.failed++;
                    results.details.push({
                        field: fieldData.label,
                        status: 'failed',
                        reason: 'Fill operation returned false'
                    });
                    if (typeof this.highlightField === 'function') {
                        this.highlightField(element, 'error');
                    }
                }

            } catch (error) {
                console.error(`[IFF] Error filling field "${fieldData.label}":`, error);
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
     * Get value for a field based on its semantic intent and Personal Agent Brain
     */
    async getValueForField(fieldData, profile, context) {
        // 1. First priority: Consult Personal Agent Brain (handles notice period, ex-employee, country code, Gemini)
        if (this.brain) {
            try {
                const resolution = await this.brain.resolveAnswer(fieldData, context);
                if (resolution && resolution.value !== null && resolution.value !== undefined && String(resolution.value).trim() !== '') {
                    return resolution.value;
                }
            } catch (err) {
                console.warn('[IFF] Brain resolution fallback:', err);
            }
        }

        const { semanticIntent, options, type } = fieldData;
        const intent = semanticIntent?.intent;

        // 2. For select/radio/checkbox with options, use intelligent matching
        if (options && options.length > 0 && ['select', 'radio', 'custom-select'].includes(type) && this.engine?.optionMatcher) {
            const matchedOption = await this.engine.optionMatcher.findBestMatch(
                fieldData,
                profile,
                context
            );
            if (matchedOption) return matchedOption.value || matchedOption.label;
        }

        // 3. For regular fields, get value from profile mapping
        const val = this.getProfileValue(intent, profile);
        if (val !== null && val !== undefined) return val;

        // 4. Fallback matching by field name / label
        if (profile) {
            const key = (fieldData.name || fieldData.label || '').toLowerCase();
            if (key.includes('first') && profile.first_name) return profile.first_name;
            if (key.includes('last') && profile.last_name) return profile.last_name;
            if (key.includes('email') && profile.email) return profile.email;
            if (key.includes('phone') && profile.phone) return profile.phone;
        }

        return null;
    }

    /**
     * Get value from profile based on intent
     */
    getProfileValue(intent, profile) {
        if (!profile) return null;
        const mapping = {
            email: profile.email,
            full_name: profile.full_name || profile.name,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            country_code: profile.country_code || '+91',
            gender: profile.gender || 'Male',
            address: profile.address || profile.street_address,
            street_address: profile.street_address || profile.address,
            address_line_2: profile.address_line2 || profile.address_line_2 || '',
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
            earliest_date: profile.earliest_date || profile.notice_period,
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
     * Fill text input with React/Vue/Angular fiber-aware prototype setter and full trusted event lifecycle.
     */
    async fillTextInput(element, value) {
        const strVal = String(value);

        // 1. Pre-interaction: Focus and pointer sequence
        try {
            if (typeof element.focus === 'function') element.focus();
            if (typeof PointerEvent !== 'undefined') {
                element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
            }
            if (typeof MouseEvent !== 'undefined') {
                element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            }
        } catch (e) {}

        // 2. Set value using native prototype descriptor to bypass framework wrappers
        try {
            const proto = Object.getPrototypeOf(element);
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                || (typeof window !== 'undefined' && window.HTMLInputElement && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set);
            if (nativeSetter) {
                nativeSetter.call(element, strVal);
            } else {
                element.value = strVal;
            }
        } catch (e) {
            element.value = strVal;
        }

        // 3. Dispatch full event cycle (React, Vue, Angular, Workday validators)
        try {
            if (typeof KeyboardEvent !== 'undefined') {
                element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Process' }));
                element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'Process' }));
            }
            if (typeof InputEvent !== 'undefined') {
                element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: strVal }));
            } else {
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (typeof KeyboardEvent !== 'undefined') {
                element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Process' }));
            }
            element.dispatchEvent(new Event('change', { bubbles: true }));
            // Trigger blur so framework validation cleans up or formats
            element.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) {}

        return true;
    }

    /**
     * Fill textarea (supporting React, Vue synthetic events and full event cycle)
     */
    async fillTextarea(element, value) {
        const strVal = String(value);

        try {
            if (typeof element.focus === 'function') element.focus();
            if (typeof PointerEvent !== 'undefined') {
                element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
            }
        } catch (e) {}

        try {
            const proto = Object.getPrototypeOf(element);
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                || (typeof window !== 'undefined' && window.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set);
            if (nativeSetter) {
                nativeSetter.call(element, strVal);
            } else {
                element.value = strVal;
            }
        } catch (e) {
            element.value = strVal;
        }

        try {
            if (typeof InputEvent !== 'undefined') {
                element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: strVal }));
            } else {
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) {}

        return true;
    }

    /**
     * Closed-loop verification of field state after fill operation (Claude in Chrome verify step).
     * Supports both (fieldData, element, expectedValue) and (fieldData, expectedValue) signatures.
     */
    async verifyField(fieldData, elementOrExpectedValue, maybeExpectedValue) {
        let element = fieldData?.element;
        let expectedValue = elementOrExpectedValue;

        if (maybeExpectedValue !== undefined) {
            element = elementOrExpectedValue;
            expectedValue = maybeExpectedValue;
        } else if (!element && fieldData?.id && typeof document !== 'undefined') {
            element = document.getElementById(fieldData.id);
        }

        if (!element) return { verified: true, actualValue: null };

        // Wait a brief tick for async validations & mutation observers to settle
        await this.wait(60);

        const type = fieldData.type || element.type || element.tagName.toLowerCase();
        let actualValue = '';
        let isMatching = false;
        const expectedStr = String(expectedValue).trim().toLowerCase();

        // 1. Read actual value based on field type
        if (type === 'checkbox') {
            actualValue = !!element.checked;
            isMatching = actualValue === !!expectedValue;
        } else if (type === 'radio') {
            const name = element.name;
            const checkedRadio = name ? document.querySelector(`input[type="radio"][name="${name}"]:checked`) : (element.checked ? element : null);
            actualValue = checkedRadio ? (checkedRadio.value || '').trim().toLowerCase() : '';
            isMatching = actualValue.length > 0;
        } else if (type === 'select') {
            const opt = element.options ? element.options[element.selectedIndex] : null;
            actualValue = opt ? (opt.value || opt.textContent || '').trim().toLowerCase() : '';
            isMatching = actualValue === expectedStr || (opt && opt.textContent.toLowerCase().includes(expectedStr));
        } else if (type === 'contenteditable') {
            actualValue = (element.innerText || element.textContent || '').trim().toLowerCase();
            isMatching = actualValue.length > 0;
        } else {
            actualValue = (element.value || '').trim().toLowerCase();
            isMatching = actualValue === expectedStr || actualValue.includes(expectedStr) || expectedStr.includes(actualValue);
        }

        // 2. Check for validation errors on element or adjacent DOM container
        let hasError = false;
        let errorReason = '';

        if (element.getAttribute && element.getAttribute('aria-invalid') === 'true') {
            hasError = true;
            errorReason = 'Element marked aria-invalid="true"';
        }

        const container = (typeof element.closest === 'function') 
            ? element.closest('.form-group, [data-automation-id="formField"], .field, fieldset') || element.parentElement
            : element.parentElement;

        if (container) {
            const errorNodes = container.querySelectorAll('.has-error, .is-invalid, .invalid-feedback, .error-message, [role="alert"], [class*="error"]');
            for (const node of errorNodes) {
                // Avoid mistaking the element itself if it contains 'error' in another context
                if (node !== element && this.isVisible(node)) {
                    const text = (node.textContent || '').trim();
                    if (text.length > 2 && !/^(optional|required)$/i.test(text)) {
                        hasError = true;
                        errorReason = text;
                        break;
                    }
                }
            }
        }

        return {
            verified: isMatching && !hasError,
            actualValue,
            hasError,
            errorReason
        };
    }

    /**
     * Self-Correction Loop: Adapt value or formatting when ATS validation rejects initial fill.
     */
    async selfCorrectField(fieldData, element, value, verificationResult) {
        const type = fieldData.type || element.type || element.tagName.toLowerCase();
        let retryValue = value;

        // 1. Phone number formatting correction
        if (type === 'tel' || /phone|mobile/i.test(fieldData.label || '')) {
            const rawDigits = String(value).replace(/\D/g, '');
            // If full with country code failed, try last 10 digits
            if (rawDigits.length > 10) {
                retryValue = rawDigits.slice(-10);
            } else if (rawDigits.length === 10) {
                // Try format (XXX) XXX-XXXX
                retryValue = `(${rawDigits.slice(0, 3)}) ${rawDigits.slice(3, 6)}-${rawDigits.slice(6)}`;
            } else {
                retryValue = rawDigits;
            }
        }
        // 2. Date format correction
        else if (type === 'date' || /date|birth/i.test(fieldData.label || '')) {
            const dateStr = String(value).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                // Convert ISO YYYY-MM-DD to US MM/DD/YYYY
                const [y, m, d] = dateStr.split('-');
                retryValue = `${m}/${d}/${y}`;
            } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                // Convert US MM/DD/YYYY to ISO YYYY-MM-DD
                const [m, d, y] = dateStr.split('/');
                retryValue = `${y}-${m}-${d}`;
            }
        }
        // 3. Fallback: Trim whitespace or special characters
        else if (typeof value === 'string') {
            retryValue = value.trim();
        }

        // Re-attempt fill with corrected representation
        await this.fillTextInput(element, retryValue);
        await this.wait(80);

        // Re-verify
        const recheck = await this.verifyField(fieldData, element, retryValue);
        return {
            verified: recheck.verified,
            correctedValue: retryValue,
            recheck
        };
    }

    /**
     * Fill standard select dropdown
     */
    async fillSelect(element, value) {
        const valueStr = String(value).toLowerCase().trim();
        let targetIndex = -1;

        // Priority 1: Exact value or text match
        for (let i = 0; i < element.options.length; i++) {
            const optVal = element.options[i].value.toLowerCase().trim();
            const optText = element.options[i].textContent.toLowerCase().trim();
            if (optVal === valueStr || optText === valueStr) {
                targetIndex = i;
                break;
            }
        }

        // Priority 2: Gender specific match (never match female for male)
        if (targetIndex === -1 && /male|man/i.test(valueStr) && !/fe/i.test(valueStr)) {
            for (let i = 0; i < element.options.length; i++) {
                const optText = element.options[i].textContent.toLowerCase().trim();
                const optVal = element.options[i].value.toLowerCase().trim();
                if (/^(male|man|m)$/i.test(optVal) || (/male/i.test(optText) && !/female/i.test(optText))) {
                    targetIndex = i;
                    break;
                }
            }
        } else if (targetIndex === -1 && /female|woman/i.test(valueStr)) {
            for (let i = 0; i < element.options.length; i++) {
                const optText = element.options[i].textContent.toLowerCase().trim();
                const optVal = element.options[i].value.toLowerCase().trim();
                if (/^(female|woman|f)$/i.test(optVal) || /female/i.test(optText)) {
                    targetIndex = i;
                    break;
                }
            }
        }

        // Priority 3: Country code match
        if (targetIndex === -1 && (valueStr.includes('+91') || valueStr === '91' || valueStr.includes('india'))) {
            for (let i = 0; i < element.options.length; i++) {
                const fullText = (element.options[i].textContent + ' ' + element.options[i].value).toLowerCase();
                if (fullText.includes('+91') || fullText.includes('india') || fullText.includes('(91)')) {
                    targetIndex = i;
                    break;
                }
            }
        }

        // Priority 4: Safe substring match
        if (targetIndex === -1 && !/^(male|man|m|fe)$/i.test(valueStr)) {
            for (let i = 0; i < element.options.length; i++) {
                const optText = element.options[i].textContent.toLowerCase().trim();
                if (optText.includes(valueStr) || (valueStr.length > 4 && valueStr.includes(optText))) {
                    targetIndex = i;
                    break;
                }
            }
        }

        if (targetIndex >= 0) {
            element.selectedIndex = targetIndex;
            try {
                const selectSetter = (typeof window !== 'undefined' && window.HTMLSelectElement)
                    ? Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
                    : null;
                if (selectSetter) selectSetter.call(element, element.options[targetIndex].value);
            } catch (e) {}
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
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
            const options = Array.from(document.querySelectorAll('[role="option"], .MuiMenuItem-root, .ant-select-item-option'));
            const valueStr = String(value).toLowerCase().trim();

            let matched = options.find(o => (o.textContent || '').trim().toLowerCase() === valueStr);
            if (!matched && /male|man/i.test(valueStr) && !/fe/i.test(valueStr)) {
                matched = options.find(o => {
                    const t = (o.textContent || '').trim().toLowerCase();
                    return (/^(male|man|m)$/i.test(t) || (/male/i.test(t) && !/female/i.test(t)));
                });
            } else if (!matched && /female|woman/i.test(valueStr)) {
                matched = options.find(o => {
                    const t = (o.textContent || '').trim().toLowerCase();
                    return (/^(female|woman|f)$/i.test(t) || /female/i.test(t));
                });
            }

            if (!matched && !/^(male|man|m|fe)$/i.test(valueStr)) {
                matched = options.find(o => (o.textContent || '').toLowerCase().includes(valueStr));
            }

            if (matched) {
                matched.click();
                await this.wait(100);
                return true;
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
     * Fill radio button with accurate option matching
     */
    async fillRadio(element, value) {
        const name = element.name;
        let radios = [];
        if (name) {
            radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`));
        }
        if (radios.length === 0) {
            const container = (typeof element.closest === 'function' ? element.closest('fieldset, [role="radiogroup"], .form-group, .question') : null) || element.parentElement;
            radios = container ? Array.from(container.querySelectorAll('input[type="radio"]')) : [element];
        }

        const valueStr = String(value).toLowerCase().trim();
        const getLabel = (r) => {
            let t = '';
            if (r.id) {
                const l = document.querySelector(`label[for="${r.id}"]`);
                if (l) t = l.textContent;
            }
            if (!t && r.parentElement) t = r.parentElement.textContent;
            return (t || r.value || '').toLowerCase().trim();
        };

        // 1. Exact match
        let target = radios.find(r => (r.value || '').toLowerCase().trim() === valueStr || getLabel(r) === valueStr);

        // 2. Gender match
        if (!target && /male|man/i.test(valueStr) && !/fe/i.test(valueStr)) {
            target = radios.find(r => /^(male|man|m)$/i.test(r.value) || (/male/i.test(getLabel(r)) && !/female/i.test(getLabel(r))));
        } else if (!target && /female|woman/i.test(valueStr)) {
            target = radios.find(r => /^(female|woman|f)$/i.test(r.value) || /female/i.test(getLabel(r)));
        }

        // 3. Yes/No match
        if (!target && /^(yes|true|y)$/i.test(valueStr)) {
            target = radios.find(r => /^(yes|true|y)$/i.test(r.value) || /^(yes|true|y)$/i.test(getLabel(r)));
        } else if (!target && /^(no|false|n)$/i.test(valueStr)) {
            target = radios.find(r => /^(no|false|n)$/i.test(r.value) || /^(no|false|n)$/i.test(getLabel(r)));
        }

        // 4. Substring
        if (!target && valueStr.length > 2) {
            target = radios.find(r => getLabel(r).includes(valueStr) || valueStr.includes(getLabel(r)));
        }

        if (target) {
            target.checked = true;
            target.click();
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
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
        const strVal = String(value);
        try {
            if (typeof InputEvent !== 'undefined') {
                element.dispatchEvent(new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: strVal
                }));
            }
        } catch (e) {}
        element.textContent = strVal;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntelligentFormFiller;
}
