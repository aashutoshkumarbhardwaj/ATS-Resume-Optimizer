/**
 * DropdownInteractionEngine
 * Comprehensive, deterministic dropdown & combobox lifecycle manager for the ATS Optimizer.
 *
 * Implements:
 * 1. Sequential form traversal (top-to-bottom DOM order) with stable field signatures.
 * 2. 6-category dropdown type detection (native select, custom, searchable, combobox, multi-select, listbox).
 * 3. Evidence-grounded option matching (no guessing / clean skipping on no match).
 * 4. Explicit 6-state popup lifecycle management (CLOSED -> OPEN -> OPTIONS_LOADING -> OPTION_SELECTED -> CLOSING -> CLOSED_AND_VERIFIED).
 * 5. Multi-tier closing cascade (natural -> Escape -> single click -> double click -> outside click).
 * 6. Dynamic continuation past closed popups (identifying next field below without completing application).
 * 7. Infinite loop prevention (max 2 attempts per field, repeated click guards, state diffing).
 * 8. Verification and structured diagnostic logging.
 */

var DropdownInteractionEngine = (typeof window !== 'undefined' && window.DropdownInteractionEngine) || class DropdownInteractionEngine {
    constructor(options = {}) {
        this.maxAttemptsPerField = options.maxAttemptsPerField || 2;
        this.processedFields = new Map(); // signature -> { attempts, status, value, type, lastUpdated }
        this.interactionLog = [];
    }

    static get DropdownType() {
        return {
            NATIVE_SELECT: 'NATIVE_SELECT',
            CUSTOM_DROPDOWN: 'CUSTOM_DROPDOWN',
            SEARCHABLE_DROPDOWN: 'SEARCHABLE_DROPDOWN',
            AUTOCOMPLETE_COMBOBOX: 'AUTOCOMPLETE_COMBOBOX',
            MULTI_SELECT: 'MULTI_SELECT',
            POPUP_LISTBOX: 'POPUP_LISTBOX',
            UNKNOWN: 'UNKNOWN'
        };
    }

    static get PopupState() {
        return {
            CLOSED: 'CLOSED',
            OPEN: 'OPEN',
            OPTIONS_LOADING: 'OPTIONS_LOADING',
            OPTION_SELECTED: 'OPTION_SELECTED',
            CLOSING: 'CLOSING',
            CLOSED_AND_VERIFIED: 'CLOSED_AND_VERIFIED'
        };
    }

    /**
     * Generate a stable signature for a DOM field to track completion across dynamic re-renders
     */
    static getFieldSignature(element) {
        if (!element) return 'unknown_element';
        const id = element.id || '';
        const name = element.name || '';
        const ariaLabel = (element.getAttribute?.('aria-label') || '').trim();
        const dataId = element.getAttribute?.('data-automation-id') || element.getAttribute?.('data-testid') || '';
        
        let posKey = '';
        if (typeof element.getBoundingClientRect === 'function') {
            try {
                const r = element.getBoundingClientRect();
                posKey = `${Math.round(r.top)}_${Math.round(r.left)}`;
            } catch (e) {}
        }
        const tag = (element.tagName || '').toLowerCase();
        return `${tag}|id:${id}|name:${name}|aria:${ariaLabel}|data:${dataId}|pos:${posKey}`;
    }

    /**
     * Detect dropdown category based on DOM attributes, roles, and tag names
     */
    static detectDropdownType(element) {
        if (!element) return this.DropdownType.UNKNOWN;
        const tag = (element.tagName || '').toUpperCase();
        const role = (element.getAttribute?.('role') || '').toLowerCase();
        const ariaHasPopup = (element.getAttribute?.('aria-haspopup') || '').toLowerCase();
        const ariaAuto = (element.getAttribute?.('aria-autocomplete') || '').toLowerCase();
        const isMulti = Boolean(element.multiple || element.getAttribute?.('aria-multiselectable') === 'true');
        const className = (element.className || '').toString().toLowerCase();

        // 1. Native HTML <select>
        if (tag === 'SELECT') {
            return isMulti ? this.DropdownType.MULTI_SELECT : this.DropdownType.NATIVE_SELECT;
        }

        // 2. Multi-Select Custom Components
        if (isMulti || className.includes('multi-select') || className.includes('select--is-multi') || className.includes('ant-select-multiple')) {
            return this.DropdownType.MULTI_SELECT;
        }

        // 3. Autocomplete / Combobox (input-based with suggestions)
        if (tag === 'INPUT') {
            if (role === 'combobox' || ariaAuto || ariaHasPopup === 'listbox' || element.getAttribute?.('list') || className.includes('autocomplete') || className.includes('typeahead')) {
                return this.DropdownType.AUTOCOMPLETE_COMBOBOX;
            }
        }

        // 4. Searchable Dropdown (custom trigger containing or opening an input)
        if (role === 'combobox' || ariaHasPopup === 'listbox' || className.includes('select') || className.includes('combobox')) {
            const hasInnerInput = Boolean(element.querySelector?.('input') || element.parentElement?.querySelector?.('input[role="searchbox"], input[type="search"]'));
            if (hasInnerInput) {
                return this.DropdownType.SEARCHABLE_DROPDOWN;
            }
            return this.DropdownType.CUSTOM_DROPDOWN;
        }

        // 5. Standalone Popup Listbox
        if (role === 'listbox') {
            return this.DropdownType.POPUP_LISTBOX;
        }

        return this.DropdownType.CUSTOM_DROPDOWN;
    }

    /**
     * Check if an element is visible in the viewport and not obscured
     */
    static isVisible(el) {
        if (!el) return false;
        if (typeof el.getBoundingClientRect === 'function') {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
        }
        if (typeof window !== 'undefined' && window.getComputedStyle) {
            try {
                const s = window.getComputedStyle(el);
                if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) {
                    return false;
                }
            } catch (e) {}
        }
        return true;
    }

    /**
     * Sort form fields strictly in top-to-bottom visual DOM order
     */
    static sortFieldsSequentially(fields) {
        if (!Array.isArray(fields)) return [];
        return [...fields].sort((a, b) => {
            const elA = a.element || a;
            const elB = b.element || b;
            if (!elA || !elB) return 0;

            // Priority 1: Bounding rect vertical position
            if (typeof elA.getBoundingClientRect === 'function' && typeof elB.getBoundingClientRect === 'function') {
                try {
                    const rA = elA.getBoundingClientRect();
                    const rB = elB.getBoundingClientRect();
                    // Vertical difference threshold: fields within 10px vertically are sorted left-to-right
                    if (Math.abs(rA.top - rB.top) > 10) {
                        return rA.top - rB.top;
                    }
                    return rA.left - rB.left;
                } catch (e) {}
            }

            // Priority 2: DOM tree document position
            if (typeof elA.compareDocumentPosition === 'function') {
                const pos = elA.compareDocumentPosition(elB);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            }
            return 0;
        });
    }

    /**
     * Identify the next unprocessed field strictly following currentField in DOM order
     */
    getNextUnprocessedField(currentField, allFields) {
        const sorted = DropdownInteractionEngine.sortFieldsSequentially(allFields);
        const currentEl = currentField?.element || currentField;
        let pastCurrent = !currentEl;

        for (const f of sorted) {
            const el = f.element || f;
            if (currentEl && el === currentEl) {
                pastCurrent = true;
                continue;
            }

            if (!pastCurrent) continue;

            if (!el || el.disabled || !DropdownInteractionEngine.isVisible(el)) continue;

            const sig = DropdownInteractionEngine.getFieldSignature(el);
            const record = this.processedFields.get(sig);
            if (record && (record.status === 'completed' || record.status === 'skipped' || record.attempts >= this.maxAttemptsPerField)) {
                continue;
            }

            return f;
        }

        // Fallback: Check if any uncompleted field was dynamically revealed earlier in DOM
        if (currentEl) {
            for (const f of sorted) {
                const el = f.element || f;
                if (!el || el.disabled || !DropdownInteractionEngine.isVisible(el)) continue;
                const sig = DropdownInteractionEngine.getFieldSignature(el);
                const record = this.processedFields.get(sig);
                if (!record || (record.status !== 'completed' && record.status !== 'skipped' && record.attempts < this.maxAttemptsPerField)) {
                    return f;
                }
            }
        }

        return null;
    }

    /**
     * Find the associated popup/listbox for an active dropdown trigger
     */
    static findAssociatedPopup(triggerElement, root = document) {
        if (!triggerElement) return null;

        // 1. Explicit ARIA controls / owns pointer
        const controlsId = triggerElement.getAttribute?.('aria-controls') || triggerElement.getAttribute?.('aria-owns');
        if (controlsId && root.getElementById) {
            const pop = root.getElementById(controlsId);
            if (pop && this.isVisible(pop)) {
                pop.setAttribute?.('data-ats-dropdown-popup', 'true');
                return pop;
            }
        }

        // 2. Immediate sibling or child container
        const parent = triggerElement.closest?.('.select, .select__control, .form-group, .combobox, [class*="select" i]') || triggerElement.parentElement;
        if (parent) {
            const nearby = parent.querySelector?.('[role="listbox"], .select__menu, ul[class*="options" i], .dropdown-menu.show, .c-autocomplete__menu, .spl-select-options');
            if (nearby && this.isVisible(nearby)) {
                nearby.setAttribute?.('data-ats-dropdown-popup', 'true');
                return nearby;
            }
        }

        // 3. Top-level portal listboxes (rendered as direct body children or in portal wrappers)
        const portalSelectors = [
            '[role="listbox"]:not([aria-hidden="true"])',
            '.c-autocomplete__menu:not([aria-hidden="true"])',
            '.c-country-select__list',
            '.spl-select-options',
            '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
            '.MuiMenu-paper',
            '.dropdown-menu.show',
            '.pac-container',
            '.iti__country-list:not(.iti__hide)'
        ];

        for (const sel of portalSelectors) {
            const matches = Array.from(root.querySelectorAll ? root.querySelectorAll(sel) : []).filter(el => this.isVisible(el));
            if (matches.length > 0) {
                // If multiple portals exist, associate with the one closest in vertical proximity
                if (matches.length === 1) {
                    matches[0].setAttribute?.('data-ats-dropdown-popup', 'true');
                    return matches[0];
                }
                const triggerRect = triggerElement.getBoundingClientRect?.() || { top: 0, bottom: 0 };
                let closest = matches[0];
                let minDiff = Infinity;
                for (const m of matches) {
                    const mRect = m.getBoundingClientRect?.() || { top: 0 };
                    const diff = Math.abs(mRect.top - triggerRect.bottom);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = m;
                    }
                }
                closest.setAttribute?.('data-ats-dropdown-popup', 'true');
                return closest;
            }
        }

        return null;
    }

    /**
     * Inspect options from native select or open custom popup, handling async OPTIONS_LOADING state
     */
    static async extractOptions(element, popup, maxWaitMs = 1200) {
        // A. Native <select>
        if (element && element.tagName === 'SELECT') {
            const opts = Array.from(element.options || []).map((o, idx) => ({
                element: o,
                value: (o.value || '').trim(),
                text: (o.text || o.innerText || '').trim(),
                index: idx,
                selected: Boolean(o.selected)
            })).filter(o => o.text.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)$/i.test(o.text));
            return { state: this.PopupState.OPEN, options: opts };
        }

        if (!popup) {
            return { state: this.PopupState.CLOSED, options: [] };
        }

        // B. Handle OPTIONS_LOADING state
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
            const loadingIndicator = popup.querySelector?.('.spinner, [aria-busy="true"], .loading, [class*="loading" i]');
            const textContent = (popup.textContent || popup.innerText || '').toLowerCase();
            const isLoadingText = /loading\.\.\.|searching\.\.\.|fetching/i.test(textContent);

            if (!loadingIndicator && !isLoadingText) {
                break;
            }
            await new Promise(r => setTimeout(r, 80));
        }

        // C. Extract visible option nodes from popup
        const optionSelectors = [
            '[role="option"]',
            'li[role="option"]',
            '.c-autocomplete__item',
            '.c-country-select__item',
            '.spl-autocomplete-item',
            '.ant-select-item-option',
            '.MuiMenuItem-root',
            '[data-automation-id="selectOption"]',
            '.dropdown-item',
            '.select-option',
            'li',
            'div[tabindex]'
        ];

        let rawOptions = [];
        for (const sel of optionSelectors) {
            const found = Array.from(popup.querySelectorAll ? popup.querySelectorAll(sel) : []).filter(el => this.isVisible(el));
            if (found.length > 0) {
                rawOptions = found;
                break;
            }
        }

        const options = rawOptions.map((el, idx) => {
            const text = (el.textContent || el.innerText || '').trim();
            const val = el.getAttribute?.('data-value') || el.getAttribute?.('value') || text;
            const isSelected = el.getAttribute?.('aria-selected') === 'true' || el.classList?.contains('selected') || el.classList?.contains('active');
            return { element: el, value: val, text, index: idx, selected: Boolean(isSelected) };
        }).filter(o => o.text.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)$/i.test(o.text));

        return {
            state: this.PopupState.OPEN,
            options
        };
    }

    /**
     * Compare candidate profile and target answer with available options (evidence-grounded)
     */
    static matchOption(options, targetText, profile = {}) {
        if (!Array.isArray(options) || options.length === 0) return null;
        const want = String(targetText || '').trim().toLowerCase();
        if (!want) return null;

        // 1. Exact match (by text or value)
        const exact = options.find(o => o.text.toLowerCase() === want || o.value.toLowerCase() === want);
        if (exact) return exact;

        // 2. Gender specific guard (never match female for male or vice-versa)
        if (/^(?:male|man|m)$/i.test(want)) {
            const maleOpt = options.find(o => {
                const t = o.text.toLowerCase();
                return (/^(male|man|m)$/i.test(t) || (t.includes('male') && !t.includes('female')));
            });
            if (maleOpt) return maleOpt;
            return null; // Don't fall through to loose substring!
        }
        if (/^(?:female|woman|f)$/i.test(want)) {
            const femaleOpt = options.find(o => {
                const t = o.text.toLowerCase();
                return (/^(female|woman|f)$/i.test(t) || t.includes('female'));
            });
            if (femaleOpt) return femaleOpt;
            return null;
        }

        // 3. Country / Phone dialing code
        if (want.includes('+91') || want === '91' || want.includes('india')) {
            const inOpt = options.find(o => {
                const t = (o.text + ' ' + o.value).toLowerCase();
                return t.includes('+91') || t.includes('india') || t.includes('(91)');
            });
            if (inOpt) return inOpt;
        }
        if (/^\+?1$/i.test(want) || /united\s*states|usa?\b/i.test(want)) {
            const usOpt = options.find(o => {
                const t = (o.text + ' ' + o.value).toLowerCase();
                return t.includes('united states') || t.includes('+1') || t.includes('(1)');
            });
            if (usOpt) return usOpt;
        }

        // 4. Yes / No binary qualification
        if (/^(?:yes|true|authorized|eligible)$/i.test(want)) {
            const yesOpt = options.find(o => /^(?:yes|true|authorized|eligible)$/i.test(o.text));
            if (yesOpt) return yesOpt;
        }
        if (/^(?:no|false|not\s*required)$/i.test(want)) {
            const noOpt = options.find(o => /^(?:no|false|not\s*required)$/i.test(o.text));
            if (noOpt) return noOpt;
        }

        // 5. Strict word boundary match (target phrase exists as whole word tokens)
        const wordBoundaryMatch = options.find(o => {
            const t = o.text.toLowerCase();
            const regex = new RegExp(`\\b${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(t);
        });
        if (wordBoundaryMatch) return wordBoundaryMatch;

        // 6. Safe substring match (target must be > 3 characters)
        if (want.length > 3) {
            const sub = options.find(o => o.text.toLowerCase().includes(want) || want.includes(o.text.toLowerCase()));
            if (sub) return sub;
        }

        // No sufficient evidence match -> Return null (clean skip)
        return null;
    }

    /**
     * Multi-tier closing cascade:
     * 1. Natural closing
     * 2. Escape key
     * 3. Single click trigger
     * 4. Double click trigger fallback (per specification)
     * 5. Verify CLOSED_AND_VERIFIED
     */
    static async closePopup(triggerElement, popup, options = {}) {
        const delay = options.delay || 80;

        // Step 1: Check if already closed naturally
        if (!popup || !this.isVisible(popup)) {
            return this.PopupState.CLOSED_AND_VERIFIED;
        }

        await new Promise(r => setTimeout(r, delay));
        if (!this.isVisible(popup)) return this.PopupState.CLOSED_AND_VERIFIED;

        // Step 2: Use Escape key
        try {
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true });
            if (triggerElement) triggerElement.dispatchEvent(escEvent);
            if (popup) popup.dispatchEvent(escEvent);
        } catch (e) {}

        await new Promise(r => setTimeout(r, delay));
        if (!this.isVisible(popup)) return this.PopupState.CLOSED_AND_VERIFIED;

        // Step 3: Click dropdown trigger
        try {
            if (triggerElement && typeof triggerElement.click === 'function') {
                triggerElement.click();
            }
        } catch (e) {}

        await new Promise(r => setTimeout(r, delay));
        if (!this.isVisible(popup)) return this.PopupState.CLOSED_AND_VERIFIED;

        // Step 4: Double-click trigger fallback
        try {
            if (triggerElement) {
                triggerElement.click?.();
                await new Promise(r => setTimeout(r, 40));
                triggerElement.click?.();
                triggerElement.dispatchEvent?.(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            }
        } catch (e) {}

        await new Promise(r => setTimeout(r, delay));
        if (!this.isVisible(popup)) return this.PopupState.CLOSED_AND_VERIFIED;

        // Step 5: Document body / outside click fallback
        try {
            if (typeof document !== 'undefined' && document.body) {
                document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
        } catch (e) {}

        await new Promise(r => setTimeout(r, delay));
        const isClosed = !this.isVisible(popup);
        return isClosed ? this.PopupState.CLOSED_AND_VERIFIED : this.PopupState.CLOSING;
    }

    /**
     * Verify that the selected value was successfully applied to the field
     */
    static verifySelection(element, expectedOption) {
        if (!element || !expectedOption) return false;
        const expVal = String(expectedOption.value || expectedOption.text || '').trim().toLowerCase();
        const expText = String(expectedOption.text || '').trim().toLowerCase();

        // Native select
        if (element.tagName === 'SELECT') {
            const curVal = String(element.value || '').trim().toLowerCase();
            const curText = String(element.options?.[element.selectedIndex]?.text || '').trim().toLowerCase();
            return curVal === expVal || curText === expText;
        }

        // Input / Combobox
        if (element.tagName === 'INPUT') {
            const curVal = String(element.value || '').trim().toLowerCase();
            return curVal.includes(expText) || curVal.includes(expVal) || expText.includes(curVal);
        }

        // Custom trigger div / button
        const curText = (element.textContent || element.innerText || '').trim().toLowerCase();
        return curText.includes(expText) || curText.includes(expVal);
    }

    /**
     * Complete lifecycle handler for any dropdown field
     */
    async handleDropdown(field, candidateValue, context = {}) {
        const element = field.element || (field.id && typeof document !== 'undefined' ? document.getElementById(field.id) : null);
        if (!element) return { success: false, status: 'no_element' };

        const signature = DropdownInteractionEngine.getFieldSignature(element);
        const record = this.processedFields.get(signature) || { attempts: 0, status: 'pending' };

        // Infinite loop prevention: Bail out if maximum attempts reached
        if (record.attempts >= this.maxAttemptsPerField) {
            console.warn(`[DropdownEngine] ⚠️ Max interaction attempts (${this.maxAttemptsPerField}) reached for "${field.label}". Skipping.`);
            return { success: false, status: 'skipped_max_attempts' };
        }
        record.attempts++;
        this.processedFields.set(signature, record);

        const type = DropdownInteractionEngine.detectDropdownType(element);
        const fieldLabel = field.label || element.getAttribute?.('aria-label') || element.name || 'Dropdown Field';

        console.log(`[DropdownEngine] 🔍 Processing ${type} for "${fieldLabel}" (Attempt ${record.attempts}/${this.maxAttemptsPerField})...`);

        // Case A: Native HTML <Select>
        if (type === DropdownInteractionEngine.DropdownType.NATIVE_SELECT || element.tagName === 'SELECT') {
            const { options } = await DropdownInteractionEngine.extractOptions(element, null);
            const matched = DropdownInteractionEngine.matchOption(options, candidateValue, context.profile);

            if (!matched) {
                console.log(`[DropdownEngine] ⏭️ No matching option found for "${candidateValue}" in "${fieldLabel}". Skipping cleanly.`);
                record.status = 'skipped';
                this.processedFields.set(signature, record);
                this.logInteraction({ fieldLabel, type, optionsCount: options.length, selected: null, skipReason: 'no_matching_evidence' });
                return { success: false, status: 'skipped_no_match', type };
            }

            // Apply value with framework synthetic event triggers
            element.value = matched.value;
            if (matched.element) matched.element.selected = true;
            if (typeof matched.index === 'number') element.selectedIndex = matched.index;

            try {
                const proto = (typeof window !== 'undefined' && window.HTMLSelectElement?.prototype) || element.__proto__;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) setter.call(element, matched.value);
            } catch (e) {}

            element.dispatchEvent?.(new Event('input', { bubbles: true }));
            element.dispatchEvent?.(new Event('change', { bubbles: true }));
            element.blur?.();

            const verified = DropdownInteractionEngine.verifySelection(element, matched);
            record.status = verified ? 'completed' : 'failed';
            record.selectedValue = matched.text;
            this.processedFields.set(signature, record);

            this.logInteraction({ fieldLabel, type, optionsCount: options.length, selected: matched.text, verified });
            return { success: verified, status: verified ? 'completed' : 'unverified', type, selectedValue: matched.text };
        }

        // Case B: Custom Dropdown / Searchable / Combobox
        let popupState = DropdownInteractionEngine.PopupState.CLOSED;

        // 1. Open popup by interacting with trigger
        if (context.cursor && typeof context.cursor.moveTo === 'function') {
            await context.cursor.moveTo(element);
            await context.cursor.click(element);
        } else {
            element.click?.();
        }
        popupState = DropdownInteractionEngine.PopupState.OPEN;
        await new Promise(r => setTimeout(r, 120));

        // 2. Locate associated popup
        const popup = DropdownInteractionEngine.findAssociatedPopup(element);

        // 3. If searchable, filter via input
        const searchInput = (type === DropdownInteractionEngine.DropdownType.SEARCHABLE_DROPDOWN || type === DropdownInteractionEngine.DropdownType.AUTOCOMPLETE_COMBOBOX)
            ? (element.tagName === 'INPUT' ? element : popup?.querySelector?.('input[type="search"], input[type="text"], input[role="searchbox"]'))
            : null;

        if (searchInput && candidateValue) {
            try {
                if (context.cursor && typeof context.cursor.type === 'function') {
                    await context.cursor.type(searchInput, String(candidateValue), { humanSpeed: false });
                } else {
                    searchInput.value = String(candidateValue);
                    searchInput.dispatchEvent?.(new Event('input', { bubbles: true }));
                }
                await new Promise(r => setTimeout(r, 150));
            } catch (e) {}
        }

        // 4. Extract options (handles OPTIONS_LOADING)
        const { options } = await DropdownInteractionEngine.extractOptions(element, popup, 800);
        const matched = DropdownInteractionEngine.matchOption(options, candidateValue, context.profile);

        if (!matched) {
            console.log(`[DropdownEngine] ⏭️ No matching option for "${candidateValue}" in custom dropdown "${fieldLabel}". Closing and skipping.`);
            popupState = await DropdownInteractionEngine.closePopup(element, popup);
            record.status = 'skipped';
            this.processedFields.set(signature, record);
            this.logInteraction({ fieldLabel, type, optionsCount: options.length, selected: null, skipReason: 'no_matching_evidence', popupState });
            return { success: false, status: 'skipped_no_match', type, popupState };
        }

        // 5. Select matched option
        console.log(`[DropdownEngine] 🎯 Selecting option: "${matched.text}" for "${fieldLabel}"...`);
        const optEl = matched.element;
        if (optEl) {
            if (typeof optEl.scrollIntoView === 'function') {
                optEl.scrollIntoView({ block: 'nearest' });
            }
            if (context.cursor && typeof context.cursor.moveTo === 'function') {
                await context.cursor.moveTo(optEl);
                await context.cursor.click(optEl);
            }
            optEl.click?.();
            try {
                optEl.dispatchEvent?.(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                optEl.dispatchEvent?.(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                optEl.dispatchEvent?.(new MouseEvent('click', { bubbles: true, cancelable: true }));
            } catch (e) {}
        }
        popupState = DropdownInteractionEngine.PopupState.OPTION_SELECTED;

        // 6. Close popup via 5-tier closing priority
        popupState = await DropdownInteractionEngine.closePopup(element, popup);

        // 7. Verify result
        const verified = DropdownInteractionEngine.verifySelection(element, matched);
        record.status = verified ? 'completed' : 'failed';
        record.selectedValue = matched.text;
        this.processedFields.set(signature, record);

        this.logInteraction({ fieldLabel, type, optionsCount: options.length, selected: matched.text, verified, popupState });
        return { success: verified, status: verified ? 'completed' : 'unverified', type, selectedValue: matched.text, popupState };
    }

    logInteraction(entry) {
        this.interactionLog.push({ ...entry, timestamp: Date.now() });
        console.log(`[DropdownEngine] 📊 [${entry.type}] "${entry.fieldLabel}": ${entry.selected ? `Selected "${entry.selected}" (Verified: ${entry.verified})` : `Skipped (${entry.skipReason})`} | Popup: ${entry.popupState || 'CLOSED'}`);
    }
};

if (typeof window !== 'undefined') {
    window.DropdownInteractionEngine = DropdownInteractionEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DropdownInteractionEngine;
}
