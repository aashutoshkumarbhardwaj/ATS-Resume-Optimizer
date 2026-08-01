/**
 * Platform-Specific Adapters
 * Handles unique form structures for different job platforms
 */

// Base adapter class
class BasePlatformAdapter {
    constructor(platformName) {
        this.platformName = platformName;
    }

    /**
     * Detect if current page is this platform
     */
    detect() {
        throw new Error('Must implement detect()');
    }

    /**
     * Wait for form to be ready
     */
    async waitForForm(timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (this.isFormReady()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return false;
    }

    /**
     * Check if form is ready
     */
    isFormReady() {
        return document.querySelectorAll('input, textarea, select').length > 0;
    }

    /**
     * Fill field with platform-specific logic
     */
    async fillField(element, value) {
        element.value = value;
        this.triggerEvents(element);
    }

    /**
     * Trigger necessary events for the platform
     */
    triggerEvents(element) {
        ['focus', 'input', 'change', 'blur'].forEach(eventName => {
            element.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
    }
}

/**
 * LinkedIn Adapter
 */
class LinkedInAdapter extends BasePlatformAdapter {
    constructor() {
        super('linkedin');
    }

    detect() {
        return window.location.hostname.includes('linkedin.com');
    }

    async fillField(element, value) {
        element.focus();
        element.value = value;
        
        // LinkedIn uses React, trigger input and change events
        const inputEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
        
        element.blur();
    }

    async getFormMetadata() {
        const form = document.querySelector('[data-application-form]');
        return {
            formType: form?.getAttribute('data-form-type') || 'standard',
            position: document.querySelector('[data-job-title]')?.textContent,
            company: document.querySelector('[data-company-name]')?.textContent
        };
    }
}

/**
 * Greenhouse Adapter
 */
class GreenhouseAdapter extends BasePlatformAdapter {
    constructor() {
        super('greenhouse');
    }

    detect() {
        return window.location.hostname.includes('greenhouse.io') ||
               window.location.hostname.includes('jobs.lever.co');
    }

    isFormReady() {
        return document.querySelector('form[data-testid]') !== null ||
               document.querySelector('[data-testid="application-form"]') !== null;
    }

    async fillField(element, value) {
        element.value = value;
        
        // Greenhouse requires change event
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
        
        // Also trigger input for React state
        const inputEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
    }

    async handleFileUpload(fileType, fileBlob) {
        const fileInput = this.findFileInput(fileType);
        if (!fileInput) return false;

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([fileBlob], `${fileType}.pdf`, { type: 'application/pdf' }));
        fileInput.files = dataTransfer.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    findFileInput(fileType) {
        const inputs = document.querySelectorAll('input[type="file"]');
        for (const input of inputs) {
            const label = input.closest('label')?.textContent || '';
            if (label.toLowerCase().includes(fileType.toLowerCase())) {
                return input;
            }
        }
        return null;
    }
}

/**
 * Lever Adapter
 */
class LeverAdapter extends BasePlatformAdapter {
    constructor() {
        super('lever');
    }

    detect() {
        return window.location.hostname.includes('lever.co') ||
               window.location.hostname.includes('jobs.lever.co');
    }

    isFormReady() {
        return document.querySelector('[data-qa="form"]') !== null;
    }

    async fillField(element, value) {
        // Lever uses custom data attributes
        element.value = value;
        
        const event = new Event('change', { bubbles: true });
        element.dispatchEvent(event);
    }

    async handleMultiStepForm() {
        const steps = document.querySelectorAll('[data-qa="form-step"]');
        return {
            totalSteps: steps.length,
            currentStep: Array.from(steps).findIndex(s => s.classList.contains('active')),
            nextButton: document.querySelector('[data-qa="button-next"]')
        };
    }
}

/**
 * Workday Adapter
 */
class WorkdayAdapter extends BasePlatformAdapter {
    constructor() {
        super('workday');
    }

    detect() {
        return window.location.hostname.includes('workday.com') ||
               window.location.hostname.includes('myworkday');
    }

    isFormReady() {
        return document.querySelector('[data-automation-id="section"]') !== null;
    }

    async fillField(element, value) {
        // Workday often uses custom input elements
        if (element.hasAttribute('data-automation-id')) {
            element.value = value;
            const event = new Event('change', { bubbles: true });
            element.dispatchEvent(event);
        } else {
            element.value = value;
            this.triggerEvents(element);
        }
    }

    async handleDynamicSections() {
        const sections = document.querySelectorAll('[data-automation-id="section"]');
        return Array.from(sections).map(section => ({
            id: section.getAttribute('data-automation-id'),
            title: section.querySelector('h2')?.textContent,
            fields: Array.from(section.querySelectorAll('input, textarea, select')).length
        }));
    }
}

/**
 * Google Forms Adapter
 */
class GoogleFormsAdapter extends BasePlatformAdapter {
    constructor() {
        super('google-forms');
    }

    detect() {
        return window.location.hostname.includes('docs.google.com') &&
               window.location.pathname.includes('/forms');
    }

    isFormReady() {
        return document.querySelector('[data-item-id]') !== null;
    }

    async fillField(element, value) {
        // Google Forms uses complex nested structures
        const question = element.closest('[data-item-id]');
        if (!question) return;

        const questionType = this.getQuestionType(question);

        if (questionType === 'text' || questionType === 'email') {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (questionType === 'radio') {
            const options = question.querySelectorAll('[role="radio"]');
            for (const option of options) {
                if (option.textContent.includes(value)) {
                    option.click();
                    break;
                }
            }
        } else if (questionType === 'checkbox') {
            const options = question.querySelectorAll('[role="checkbox"]');
            for (const option of options) {
                if (option.textContent.includes(value)) {
                    option.click();
                }
            }
        } else if (questionType === 'dropdown') {
            const select = question.querySelector('select');
            if (select) {
                select.value = value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    getQuestionType(questionElement) {
        if (questionElement.querySelector('textarea')) return 'text';
        if (questionElement.querySelector('[type="email"]')) return 'email';
        if (questionElement.querySelector('[role="radio"]')) return 'radio';
        if (questionElement.querySelector('[role="checkbox"]')) return 'checkbox';
        if (questionElement.querySelector('select')) return 'dropdown';
        return 'unknown';
    }
}

/**
 * Indeed Adapter
 */
class IndeedAdapter extends BasePlatformAdapter {
    constructor() {
        super('indeed');
    }

    detect() {
        return window.location.hostname.includes('indeed.com');
    }

    isFormReady() {
        return document.querySelector('[data-testid*="apply"]') !== null ||
               document.querySelector('.applicant-form') !== null;
    }

    async fillField(element, value) {
        element.value = value;
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
    }

    async detectApplicationRequirements() {
        const requirements = [];
        const container = document.querySelector('[data-testid="apply-section"]');
        
        if (container) {
            const fields = container.querySelectorAll('input, textarea, select');
            fields.forEach(field => {
                requirements.push({
                    name: field.name || field.id,
                    required: field.required,
                    type: field.type || 'unknown'
                });
            });
        }

        return requirements;
    }
}

/**
 * Adapter Registry
 */
class AdapterRegistry {
    constructor() {
        this.adapters = [
            new LinkedInAdapter(),
            new GreenhouseAdapter(),
            new LeverAdapter(),
            new WorkdayAdapter(),
            new GoogleFormsAdapter(),
            new IndeedAdapter()
        ];
    }

    /**
     * Get appropriate adapter for current platform
     */
    getAdapter() {
        for (const adapter of this.adapters) {
            if (adapter.detect()) {
                return adapter;
            }
        }
        return new BasePlatformAdapter('generic');
    }

    /**
     * Register custom adapter
     */
    registerAdapter(adapter) {
        this.adapters.push(adapter);
    }

    /**
     * Get all available adapters
     */
    getAllAdapters() {
        return this.adapters;
    }
}

module.exports = {
    BasePlatformAdapter,
    LinkedInAdapter,
    GreenhouseAdapter,
    LeverAdapter,
    WorkdayAdapter,
    GoogleFormsAdapter,
    IndeedAdapter,
    AdapterRegistry
};
