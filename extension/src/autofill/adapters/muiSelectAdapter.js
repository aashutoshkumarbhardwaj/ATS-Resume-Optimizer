/**
 * Material-UI (MUI) Select Adapter - Phase 2
 * Handles Material-UI Select component interactions
 */

class MUISelectAdapter {
    /**
     * Detect if element is MUI Select component
     */
    static detect(element) {
        if (!element) return false;

        // Check MUI-specific classes
        if (element.className?.includes('MuiSelect') ||
            element.className?.includes('MuiOutlinedInput') ||
            element.className?.includes('MuiInput')) {
            return true;
        }

        // Check parent
        const parent = element.closest('[class*="MuiSelect"]');
        if (parent) return true;

        const inputParent = element.closest('[class*="MuiInputBase"]');
        if (inputParent) return true;

        return false;
    }

    /**
     * Set value in MUI Select
     */
    static async setValue(element, value, options = {}) {
        const { delay = 100 } = options;

        if (!element) return false;

        try {
            // 1. Find the button or input to click
            let selectButton = element;
            if (!selectButton.tagName.includes('button') && !selectButton.className.includes('MuiSelect')) {
                selectButton = element.closest('[role="button"]') ||
                    element.querySelector('[role="button"]') ||
                    element.closest('[class*="MuiInputBase"]') ||
                    element;
            }

            // 2. Click to open menu
            selectButton.click();

            // 3. Wait for menu to appear
            await this.waitForMenu(delay);

            // 4. Find matching option
            const option = await this.findMatchingOption(value, delay);
            if (!option) {
                return false;
            }

            // 5. Click option
            option.click();

            // 6. Wait for selection
            await this.wait(delay / 2);

            // 7. Dispatch change event
            selectButton.dispatchEvent(new Event('change', { bubbles: true }));

            return true;

        } catch (error) {
            console.error('[MUISelectAdapter] Error setting value:', error);
            return false;
        }
    }

    /**
     * Wait for MUI menu to appear
     */
    static async waitForMenu(delay = 100) {
        for (let i = 0; i < 50; i++) {
            // MUI menu usually has ul[role="listbox"]
            const menu = document.querySelector('[role="listbox"]') ||
                document.querySelector('[role="menu"]') ||
                document.querySelector('[class*="MuiMenu-paper"]') ||
                document.querySelector('[class*="MuiPopper-root"]');

            if (menu && menu.offsetHeight > 0) {
                await this.wait(10);
                return true;
            }

            await this.wait(delay / 50);
        }

        return false;
    }

    /**
     * Find matching MUI option
     */
    static async findMatchingOption(value, delay = 100) {
        const searchValue = value.toString().toLowerCase().trim();

        // MUI uses role="option"
        const options = document.querySelectorAll('[role="option"]');

        for (const option of options) {
            const optionText = option.textContent.toLowerCase().trim();

            if (optionText === searchValue ||
                optionText.includes(searchValue) ||
                searchValue.includes(optionText.split(' ')[0])) {
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
    module.exports = MUISelectAdapter;
}
