/**
 * Ant Design Select Adapter - Phase 2
 * Handles Ant Design Select component interactions
 */

class AntDesignSelectAdapter {
    /**
     * Detect if element is Ant Design Select
     */
    static detect(element) {
        if (!element) return false;

        // Check Ant Design classes
        if (element.className?.includes('ant-select') ||
            element.className?.includes('ant-select-selector')) {
            return true;
        }

        // Check parent
        const parent = element.closest('[class*="ant-select"]');
        if (parent) return true;

        return false;
    }

    /**
     * Set value in Ant Select
     */
    static async setValue(element, value, options = {}) {
        const { delay = 100 } = options;

        if (!element) return false;

        try {
            // 1. Find the selector element
            let selector = element;
            if (!selector.className?.includes('ant-select-selector')) {
                selector = element.querySelector('.ant-select-selector') ||
                    element.closest('.ant-select');
            }

            if (!selector) return false;

            // 2. Click to open dropdown
            selector.click();

            // 3. Wait for dropdown to appear
            await this.waitForDropdown(delay);

            // 4. Find matching option
            const option = await this.findMatchingOption(value, delay);
            if (!option) {
                return false;
            }

            // 5. Click the option
            option.click();

            // 6. Wait for selection
            await this.wait(delay / 2);

            // 7. Dispatch change event
            selector.dispatchEvent(new Event('change', { bubbles: true }));

            return true;

        } catch (error) {
            console.error('[AntDesignSelectAdapter] Error setting value:', error);
            return false;
        }
    }

    /**
     * Wait for Ant Design dropdown to appear
     */
    static async waitForDropdown(delay = 100) {
        for (let i = 0; i < 50; i++) {
            // Ant Design dropdown menu
            const dropdown = document.querySelector('.ant-select-dropdown') ||
                document.querySelector('[class*="ant-select-dropdown"]');

            if (dropdown && dropdown.offsetHeight > 0) {
                await this.wait(10);
                return true;
            }

            await this.wait(delay / 50);
        }

        return false;
    }

    /**
     * Find matching Ant Design option
     */
    static async findMatchingOption(value, delay = 100) {
        const searchValue = value.toString().toLowerCase().trim();

        // Ant Design uses .ant-select-item-option
        const options = document.querySelectorAll('.ant-select-item-option');

        for (const option of options) {
            const optionText = option.textContent.toLowerCase().trim();

            if (optionText === searchValue ||
                optionText.includes(searchValue) ||
                searchValue.includes(optionText.split(' ')[0])) {
                return option;
            }
        }

        // Fallback: look for any option-like elements
        const allOptions = document.querySelectorAll('[class*="option"]');
        for (const option of allOptions) {
            const optionText = option.textContent.toLowerCase().trim();

            if (optionText.length > 0 && optionText.length < 100 &&
                (optionText === searchValue ||
                    optionText.includes(searchValue))) {
                return option;
            }
        }

        return null;
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
    module.exports = AntDesignSelectAdapter;
}
