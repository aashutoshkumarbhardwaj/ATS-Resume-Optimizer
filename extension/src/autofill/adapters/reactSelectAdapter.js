/**
 * React Select Adapter - Phase 2
 * Handles React Select component interactions
 * Supports single and multi-select scenarios
 */

class ReactSelectAdapter {
    /**
     * Detect if element is React Select component
     */
    static detect(element) {
        if (!element) return false;

        // Check class names
        if (element.className?.includes('react-select') ||
            element.className?.includes('Select') ||
            element.className?.includes('select__control')) {
            return true;
        }

        // Check parent elements
        const parent = element.closest('[class*="react-select"]');
        if (parent) return true;

        const selectParent = element.closest('[class*="Select"]');
        if (selectParent && selectParent.className?.includes('control')) {
            return true;
        }

        return false;
    }

    /**
     * Set value in React Select dropdown
     */
    static async setValue(element, value, options = {}) {
        const { delay = 100 } = options;

        if (!element) return false;

        try {
            // 1. Find the actual input or control element
            let inputElement = element;
            if (!inputElement.className?.includes('input')) {
                inputElement = element.querySelector('input[type="text"]') ||
                    element.querySelector('input') ||
                    element.querySelector('[class*="input"]');
            }

            if (!inputElement) {
                return this.fallbackSetValue(element, value, delay);
            }

            // 2. Click to open dropdown
            const controlElement = element.closest('[class*="control"]') || element;
            controlElement.click();

            // 3. Wait for dropdown to render
            await this.waitForDropdown(delay);

            // 4. Find and click the matching option
            const options_list = await this.findMatchingOption(value, delay);
            if (!options_list) {
                // Try typing value
                inputElement.value = value;
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                await this.wait(delay);

                const typed = await this.findMatchingOption(value, delay);
                if (typed) {
                    typed.click();
                    await this.wait(delay);
                    return true;
                }

                return false;
            }

            options_list.click();

            // 5. Wait for selection
            await this.wait(delay);

            // 6. Dispatch change events
            controlElement.dispatchEvent(new Event('change', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));

            return true;

        } catch (error) {
            console.error('[ReactSelectAdapter] Error setting value:', error);
            return false;
        }
    }

    /**
     * Fallback method for React Select
     */
    static async fallbackSetValue(element, value, delay) {
        try {
            // Find any input within the component
            const inputs = element.querySelectorAll('input');
            if (inputs.length === 0) return false;

            const input = inputs[0];

            // Type the value
            input.focus();
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Wait for suggestions to render
            await this.wait(delay);

            // Find and click matching option
            const option = await this.findMatchingOption(value, delay);
            if (option) {
                option.click();
                await this.wait(delay / 2);
                return true;
            }

            // If no option found, just blur
            input.blur();
            return true;

        } catch (error) {
            console.warn('[ReactSelectAdapter] Fallback failed:', error);
            return false;
        }
    }

    /**
     * Wait for dropdown menu to appear
     */
    static async waitForDropdown(delay = 100) {
        for (let i = 0; i < 50; i++) {
            const menuList = document.querySelector('[class*="MenuList"]') ||
                document.querySelector('[class*="menu"]') ||
                document.querySelector('[class*="option-list"]');

            if (menuList) {
                await this.wait(10);
                return true;
            }

            await this.wait(delay / 50);
        }

        return false;
    }

    /**
     * Find option matching the value
     */
    static async findMatchingOption(value, delay = 100) {
        const searchValue = value.toString().toLowerCase().trim();

        // Look for option elements
        const optionSelectors = [
            '[class*="option"]',
            '[role="option"]',
            '[class*="Option"]',
            '[data-test*="option"]'
        ];

        for (const selector of optionSelectors) {
            const options = document.querySelectorAll(selector);

            for (const option of options) {
                const optionText = option.textContent.toLowerCase().trim();

                if (optionText === searchValue ||
                    optionText.includes(searchValue) ||
                    searchValue.includes(optionText.split(' ')[0])) {
                    return option;
                }
            }
        }

        return null;
    }

    /**
     * Close dropdown
     */
    static closeDropdown() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
            }
        });

        // Press Escape
        const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            bubbles: true,
            cancelable: true
        });

        document.dispatchEvent(event);
    }

    /**
     * Helper: wait
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReactSelectAdapter;
}
