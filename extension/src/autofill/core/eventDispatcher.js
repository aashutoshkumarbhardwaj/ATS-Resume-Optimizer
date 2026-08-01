/**
 * Event Dispatcher Module - Phase 2
 * Handles event dispatching for all form types (React, Vue, Angular, etc.)
 * Ensures form state updates properly across different frameworks
 */

class EventDispatcher {
    /**
     * Dispatch all necessary events when setting input value
     * Works across HTML, React, Vue, and Angular
     */
    static async dispatchInputEvents(element, value, options = {}) {
        const { delay = 50 } = options;

        if (!element) return false;

        try {
            // 0. Focus element first
            element.focus();
            element.dispatchEvent(new Event('focus', { bubbles: true, cancelable: true }));

            // 1. Native Property Descriptor Setter (Bypasses React/Vue/Angular value override tracking)
            const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

            if (nativeValueSetter) {
                nativeValueSetter.call(element, value);
            } else {
                element.value = value;
            }

            // 2. Trigger React component Fiber update if detected
            if (this.isReactComponent(element)) {
                this.triggerReactUpdate(element, value);
            }

            // 3. Dispatch beforeinput & input events
            try {
                element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(value) }));
            } catch (e) {}

            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            // 4. Dispatch change event
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            // 5. Post-Fill Verification
            let isVerified = (element.value === value || element.textContent === value);
            
            // If post-fill verification failed (e.g. React state reset value to empty), try execCommand / keypress fallback
            if (!isVerified) {
                try {
                    element.select();
                    document.execCommand('insertText', false, value);
                    isVerified = (element.value === value || element.textContent === value);
                } catch (cmdErr) {}
            }

            // 6. Dispatch blur event
            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new CustomEvent('update', { bubbles: true, detail: { value } }));

            return true;
        } catch (error) {
            console.error('[EventDispatcher] Error dispatching events:', error);
            return false;
        }
    }

    /**
     * Dispatch events for select/dropdown
     */
    static async dispatchSelectEvents(element, value, options = {}) {
        const { delay = 50 } = options;

        if (!element) return false;

        try {
            element.value = value;

            // Trigger React update if applicable
            if (this.isReactComponent(element)) {
                this.triggerReactUpdate(element, value);
            }

            // Dispatch events in sequence
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            // Also trigger click to ensure selection
            element.dispatchEvent(new Event('click', { bubbles: true }));

            return true;
        } catch (error) {
            console.error('[EventDispatcher] Error dispatching select events:', error);
            return false;
        }
    }

    /**
     * Dispatch events for checkbox
     */
    static async dispatchCheckboxEvents(element, checked, options = {}) {
        const { delay = 50 } = options;

        if (!element) return false;

        try {
            element.checked = checked;

            if (this.isReactComponent(element)) {
                this.triggerReactUpdate(element, checked);
            }

            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            return true;
        } catch (error) {
            console.error('[EventDispatcher] Error dispatching checkbox events:', error);
            return false;
        }
    }

    /**
     * Dispatch events for radio button
     */
    static async dispatchRadioEvents(element, options = {}) {
        const { delay = 50 } = options;

        if (!element) return false;

        try {
            element.checked = true;

            if (this.isReactComponent(element)) {
                this.triggerReactUpdate(element, true);
            }

            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            return true;
        } catch (error) {
            console.error('[EventDispatcher] Error dispatching radio events:', error);
            return false;
        }
    }

    /**
     * Check if element is a React component
     */
    static isReactComponent(element) {
        const reactKey = Object.keys(element).find(key =>
            key.startsWith('__react')
        );
        return !!reactKey;
    }

    /**
     * Trigger React state update via Fiber
     * This ensures React components recognize the value change
     */
    static triggerReactUpdate(element, value) {
        try {
            // Find React fiber key
            const fiberKey = Object.keys(element).find(key =>
                key.startsWith('__react')
            );

            if (!fiberKey) return false;

            // Get the fiber instance
            const fiberInstance = element[fiberKey];

            if (!fiberInstance) return false;

            // Find the state updater
            let fiber = fiberInstance;
            let hookState = null;

            // Traverse through fiber to find state
            while (fiber) {
                // Check for hooks
                if (fiber.memoizedState) {
                    hookState = fiber.memoizedState;
                    break;
                }

                if (fiber.child) {
                    fiber = fiber.child;
                } else if (fiber.sibling) {
                    fiber = fiber.sibling;
                } else {
                    fiber = fiber.return;
                }
            }

            if (hookState) {
                // Update through React's internal mechanism
                // This is a bit hacky but necessary for React controlled inputs
                const event = new Event('change', { bubbles: true });
                Object.defineProperty(event, 'target', {
                    writable: false,
                    value: { value, checked: value === true }
                });

                element.dispatchEvent(event);
                return true;
            }

            return false;
        } catch (error) {
            console.warn('[EventDispatcher] React update failed, using standard method:', error);
            return false;
        }
    }

    /**
     * Dispatch textarea events
     */
    static async dispatchTextareaEvents(element, value, options = {}) {
        const { delay = 50 } = options;

        if (!element) return false;

        try {
            element.value = value;
            element.textContent = value; // For contenteditable

            if (this.isReactComponent(element)) {
                this.triggerReactUpdate(element, value);
            }

            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

            return true;
        } catch (error) {
            console.error('[EventDispatcher] Error dispatching textarea events:', error);
            return false;
        }
    }

    /**
     * Dispatch events for contenteditable divs
     */
    static async dispatchContenteditableEvents(element, value, options = {}) {
        const { delay = 50 } = options;

        if (!element) return false;

        try {
            element.textContent = value;

            // Set innerHTML carefully to preserve structure
            if (element.innerHTML.includes('<')) {
                element.innerHTML = value;
            }

            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            await this.wait(delay / 3);

            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

            return true;
        } catch (error) {
            console.error('[EventDispatcher] Error dispatching contenteditable events:', error);
            return false;
        }
    }

    /**
     * Focus element before setting value
     */
    static focus(element) {
        if (!element) return;

        try {
            element.focus();

            // Scroll into view if needed
            if (element.scrollIntoView) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Trigger focus event
            element.dispatchEvent(new Event('focus', { bubbles: true }));
        } catch (error) {
            console.warn('[EventDispatcher] Error focusing element:', error);
        }
    }

    /**
     * Blur element after setting value
     */
    static blur(element) {
        if (!element) return;

        try {
            element.blur();
            element.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (error) {
            console.warn('[EventDispatcher] Error blurring element:', error);
        }
    }

    /**
     * Helper: wait for specified milliseconds
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get appropriate event dispatch method for element type
     */
    static getEventDispatcher(element) {
        if (!element) return null;

        const tagName = element.tagName.toLowerCase();
        const type = element.type || '';

        if (tagName === 'input') {
            switch (type) {
                case 'checkbox':
                    return this.dispatchCheckboxEvents.bind(this);
                case 'radio':
                    return this.dispatchRadioEvents.bind(this);
                default:
                    return this.dispatchInputEvents.bind(this);
            }
        } else if (tagName === 'select') {
            return this.dispatchSelectEvents.bind(this);
        } else if (tagName === 'textarea') {
            return this.dispatchTextareaEvents.bind(this);
        } else if (element.contentEditable === 'true') {
            return this.dispatchContenteditableEvents.bind(this);
        }

        return this.dispatchInputEvents.bind(this);
    }

    /**
     * Dispatch event based on element type
     */
    static async dispatchEvent(element, value, options = {}) {
        const dispatcher = this.getEventDispatcher(element);
        if (dispatcher) {
            return await dispatcher(element, value, options);
        }
        return false;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventDispatcher;
}
