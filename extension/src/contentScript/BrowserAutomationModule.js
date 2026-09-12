/**
 * Browser Automation Module
 * Pure DOM-manipulation layer responsible for securely and robustly
 * populating form fields across complex SPAs (React, Vue, Angular).
 * Includes retry logic, event simulation, and verification.
 */

class BrowserAutomationModule {
    constructor() {
        this.maxRetries = 3;
        this.retryDelayMs = 250;
    }

    /**
     * Set a value on an HTML input/textarea bypassing virtual DOM wrappers.
     */
    setNativeValue(element, value) {
        const proto = Object.getPrototypeOf(element);
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
            'value'
        )?.set;

        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            'value'
        )?.set;

        if (element.tagName === 'SELECT' && nativeSelectValueSetter) {
            nativeSelectValueSetter.call(element, value);
        } else if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        } else {
            element.value = value;
        }
    }

    /**
     * Dispatch standard events to notify frameworks of a change.
     */
    triggerEvents(element) {
        const events = ['input', 'change', 'keyup'];
        events.forEach(eventType => {
            const ev = new Event(eventType, { bubbles: true, cancelable: true });
            element.dispatchEvent(ev);
        });
        
        // Also fire InputEvent for newer React versions
        const inputEv = new InputEvent('input', { bubbles: true, data: element.value });
        element.dispatchEvent(inputEv);
        
        element.blur();
    }

    /**
     * Verify that the element's value successfully updated.
     */
    verifyValue(element, expectedValue) {
        if (!element) return false;
        if (element.tagName === 'SELECT') {
            return element.value === expectedValue || (element.options[element.selectedIndex] && element.options[element.selectedIndex].text === expectedValue);
        }
        
        // Trim for comparison since some frameworks strip whitespace
        const current = (element.value || '').trim();
        const expected = (expectedValue || '').trim();
        return current === expected;
    }

    /**
     * Sleep helper for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fill a single field robustly with retries.
     * @param {HTMLElement} element 
     * @param {string} value 
     * @returns {Promise<boolean>} true if successful, false otherwise
     */
    async fillFieldRobustly(element, value) {
        if (!element) return false;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                element.focus();
                
                // For contenteditables
                if (element.hasAttribute('contenteditable')) {
                    element.textContent = value;
                    this.triggerEvents(element);
                } else {
                    this.setNativeValue(element, value);
                    this.triggerEvents(element);
                }

                await this.sleep(this.retryDelayMs);

                // Verify
                if (element.hasAttribute('contenteditable')) {
                    if (element.textContent.trim() === value.trim()) return true;
                } else if (this.verifyValue(element, value)) {
                    return true;
                }

                console.warn(`[BrowserAutomation] Verification failed on attempt ${attempt} for element. Retrying...`);
                
            } catch (e) {
                console.error(`[BrowserAutomation] Error filling field on attempt ${attempt}:`, e);
            }
        }
        
        console.error('[BrowserAutomation] Failed to fill field after max retries.');
        return false;
    }

    /**
     * Populate a batch of answers into a map of elements.
     * @param {Array<{element: HTMLElement, answer: string, id: string}>} mapping
     * @param {Function} onProgress callback (current, total, status)
     * @returns {Promise<Object>} Results summary
     */
    async fillBatch(mapping, onProgress = () => {}) {
        const results = {
            filled: 0,
            failed: 0,
            total: mapping.length,
            details: []
        };

        for (let i = 0; i < mapping.length; i++) {
            const item = mapping[i];
            
            onProgress(i + 1, mapping.length, `Filling field ${i + 1} of ${mapping.length}...`);
            
            const success = await this.fillFieldRobustly(item.element, item.answer);
            
            if (success) {
                results.filled++;
                results.details.push({ id: item.id, status: 'success' });
            } else {
                results.failed++;
                results.details.push({ id: item.id, status: 'failed' });
            }
        }

        onProgress(mapping.length, mapping.length, `Completed filling ${results.filled}/${mapping.length} fields.`);
        return results;
    }

    /**
     * Dispatch full human-like pointer event cascade (pointerover, mouseover, pointerdown, mousedown, focus, pointerup, mouseup, click)
     */
    async clickHumanLike(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;

        const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };

        element.dispatchEvent(new PointerEvent('pointerover', mouseOpts));
        element.dispatchEvent(new MouseEvent('mouseover', mouseOpts));
        element.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
        element.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        element.focus();
        await this.sleep(40);

        element.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
        element.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
        element.dispatchEvent(new MouseEvent('click', mouseOpts));
        return true;
    }

    /**
     * Dispatch realistic keystroke events per character
     */
    async typeHumanLike(element, text, options = {}) {
        if (!element) return false;
        await this.clickHumanLike(element);

        const str = String(text || '');
        let current = '';

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            current += char;

            const keyOpts = { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true };
            element.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            element.dispatchEvent(new KeyboardEvent('keypress', keyOpts));

            this.setNativeValue(element, current);
            element.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
            element.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

            const delay = 18 + Math.random() * 25;
            await this.sleep(delay);
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        return true;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.BrowserAutomationModule = BrowserAutomationModule;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserAutomationModule;
}
