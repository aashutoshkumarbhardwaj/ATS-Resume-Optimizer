/**
 * Enhanced Google Forms Adapter
 * Comprehensive support for Google Forms including dynamic content
 * Handles: text, textarea, select, radio, checkbox, date, file upload
 */

class GoogleFormsEnhanced {
    /**
     * Constructor
     */
    constructor() {
        this.platformName = 'google-forms';
        this.logger = this.createLogger();
        this.mutationObserver = null;
        this.processedQuestions = new Set();
    }

    /**
     * Create logger
     */
    createLogger() {
        return {
            log: (msg) => console.log('[GoogleForms]', msg),
            warn: (msg) => console.warn('[GoogleForms] ⚠️', msg),
            error: (msg) => console.error('[GoogleForms] ❌', msg)
        };
    }

    /**
     * Detect if current page is Google Forms
     */
    detect() {
        return window.location.hostname.includes('docs.google.com') &&
               window.location.pathname.includes('/forms');
    }

    /**
     * Initialize enhanced Google Forms support
     */
    async initialize() {
        this.logger.log('Initializing enhanced Google Forms support');

        try {
            // Wait for form to load
            await this.waitForFormReady();

            // Start watching for new questions
            this.setupMutationObserver();

            this.logger.log('✅ Google Forms initialized');
            return true;
        } catch (error) {
            this.logger.error(`Initialization failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Wait for form to be ready
     */
    async waitForFormReady(timeout = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (this.isFormReady()) {
                return true;
            }

            await this.delay(100);
        }

        throw new Error('Google Forms failed to load within timeout');
    }

    /**
     * Check if form is ready
     */
    isFormReady() {
        // Form container is present
        const form = document.querySelector('[data-formid]') ||
                     document.querySelector('[role="form"]') ||
                     document.querySelector('[data-item-id]');

        return !!form;
    }

    /**
     * Setup MutationObserver to watch for new questions
     */
    setupMutationObserver() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        const observerOptions = {
            childList: true,
            subtree: true,
            attributes: true
        };

        this.mutationObserver = new MutationObserver((mutations) => {
            // Look for newly added question elements
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if it's a question
                            if (node.hasAttribute && node.hasAttribute('data-item-id')) {
                                this.onNewQuestion(node);
                            }

                            // Check children for questions
                            const questions = node.querySelectorAll?.('[data-item-id]');
                            if (questions) {
                                for (const question of questions) {
                                    this.onNewQuestion(question);
                                }
                            }
                        }
                    }
                }
            }
        });

        // Start observing
        const form = document.querySelector('[data-formid]') ||
                     document.querySelector('[role="form"]') ||
                     document.body;

        this.mutationObserver.observe(form, observerOptions);
        this.logger.log('MutationObserver started');
    }

    /**
     * Handle new question appearing
     */
    onNewQuestion(questionElement) {
        const itemId = questionElement.getAttribute('data-item-id');

        // Skip if already processed
        if (this.processedQuestions.has(itemId)) {
            return;
        }

        this.processedQuestions.add(itemId);
        this.logger.log(`New question detected: ${itemId}`);

        // Emit event so autofill engine can handle it
        window.dispatchEvent(new CustomEvent('googleform:newquestion', {
            detail: { questionElement, itemId }
        }));
    }

    /**
     * Get all form questions
     */
    getAllQuestions() {
        return document.querySelectorAll('[data-item-id]');
    }

    /**
     * Fill field in Google Forms
     */
    async fillField(element, value) {
        const questionElement = this.getQuestionContainer(element);

        if (!questionElement) {
            throw new Error('Could not find question container');
        }

        const questionType = this.detectQuestionType(questionElement);

        this.logger.log(`Filling ${questionType} with value: ${value}`);

        switch (questionType) {
            case 'short_answer':
                return this.fillShortAnswer(questionElement, value);

            case 'long_answer':
                return this.fillLongAnswer(questionElement, value);

            case 'multiple_choice':
                return this.fillMultipleChoice(questionElement, value);

            case 'checkboxes':
                return this.fillCheckboxes(questionElement, value);

            case 'dropdown':
                return this.fillDropdown(questionElement, value);

            case 'linear_scale':
                return this.fillLinearScale(questionElement, value);

            case 'multiple_choice_grid':
                return this.fillMultipleChoiceGrid(questionElement, value);

            case 'date':
                return this.fillDate(questionElement, value);

            case 'time':
                return this.fillTime(questionElement, value);

            case 'email':
                return this.fillEmail(questionElement, value);

            case 'phone':
                return this.fillPhone(questionElement, value);

            case 'file_upload':
                return this.fillFileUpload(questionElement, value);

            default:
                this.logger.warn(`Unknown question type: ${questionType}`);
                return this.fillShortAnswer(questionElement, value);
        }
    }

    /**
     * Detect question type
     */
    detectQuestionType(questionElement) {
        // Check for various Google Forms question type indicators

        // Short answer (text input)
        if (questionElement.querySelector('input[type="text"]:not([role])')) {
            return 'short_answer';
        }

        // Long answer (textarea)
        if (questionElement.querySelector('textarea')) {
            return 'long_answer';
        }

        // Email
        if (questionElement.querySelector('input[type="email"]')) {
            return 'email';
        }

        // Phone
        if (questionElement.querySelector('input[type="tel"]')) {
            return 'phone';
        }

        // Date picker
        if (questionElement.querySelector('input[type="date"]')) {
            return 'date';
        }

        // Time picker
        if (questionElement.querySelector('input[type="time"]')) {
            return 'time';
        }

        // File upload
        if (questionElement.querySelector('input[type="file"]')) {
            return 'file_upload';
        }

        // Dropdown/Select
        if (questionElement.querySelector('select') ||
            questionElement.querySelector('[role="listbox"]')) {
            return 'dropdown';
        }

        // Radio buttons (multiple choice)
        if (questionElement.querySelectorAll('[role="radio"]').length > 0) {
            return 'multiple_choice';
        }

        // Checkboxes
        if (questionElement.querySelectorAll('[role="checkbox"]').length > 0) {
            return 'checkboxes';
        }

        // Linear scale
        if (questionElement.querySelector('[data-value]')) {
            const scales = questionElement.querySelectorAll('[data-value]');
            if (scales.length > 1) {
                return 'linear_scale';
            }
        }

        return 'unknown';
    }

    /**
     * Get question container from any element within it
     */
    getQuestionContainer(element) {
        // If already a question container
        if (element.hasAttribute('data-item-id')) {
            return element;
        }

        // Find parent question container
        return element.closest('[data-item-id]');
    }

    /**
     * Fill short answer (text input)
     */
    async fillShortAnswer(questionElement, value) {
        const input = questionElement.querySelector('input[type="text"]:not([role])');

        if (!input) {
            throw new Error('Short answer input not found');
        }

        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();

        return Promise.resolve();
    }

    /**
     * Fill long answer (textarea)
     */
    async fillLongAnswer(questionElement, value) {
        const textarea = questionElement.querySelector('textarea');

        if (!textarea) {
            throw new Error('Textarea not found');
        }

        textarea.focus();
        textarea.value = value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.blur();

        return Promise.resolve();
    }

    /**
     * Fill multiple choice (radio)
     */
    async fillMultipleChoice(questionElement, value) {
        const options = questionElement.querySelectorAll('[role="radio"]');

        if (options.length === 0) {
            throw new Error('No radio options found');
        }

        for (const option of options) {
            const label = option.getAttribute('aria-label') ||
                         option.textContent ||
                         option.value;

            if (this.valueMatches(label, value)) {
                option.click();
                return Promise.resolve();
            }
        }

        throw new Error(`No matching option for value: ${value}`);
    }

    /**
     * Fill checkboxes
     */
    async fillCheckboxes(questionElement, value) {
        const options = questionElement.querySelectorAll('[role="checkbox"]');

        if (options.length === 0) {
            throw new Error('No checkbox options found');
        }

        let found = false;

        for (const option of options) {
            const label = option.getAttribute('aria-label') ||
                         option.textContent ||
                         option.value;

            if (this.valueMatches(label, value)) {
                if (!option.getAttribute('aria-checked')?.includes('true')) {
                    option.click();
                }
                found = true;
            }
        }

        if (!found) {
            throw new Error(`No matching option for value: ${value}`);
        }

        return Promise.resolve();
    }

    /**
     * Fill dropdown/select
     */
    async fillDropdown(questionElement, value) {
        // Try HTML select first
        const select = questionElement.querySelector('select');

        if (select) {
            const option = Array.from(select.options).find(opt =>
                opt.value === value || opt.textContent.trim() === value
            );

            if (!option) {
                throw new Error(`No matching dropdown option for value: ${value}`);
            }

            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return Promise.resolve();
        }

        // Try Google Forms custom dropdown
        const listbox = questionElement.querySelector('[role="listbox"]');

        if (!listbox) {
            throw new Error('Dropdown not found');
        }

        // Click to open
        listbox.click();
        await this.delay(200);

        // Find and click matching option
        const options = document.querySelectorAll('[role="option"]');

        for (const option of options) {
            if (this.valueMatches(option.textContent, value)) {
                option.click();
                return Promise.resolve();
            }
        }

        throw new Error(`No matching dropdown option for value: ${value}`);
    }

    /**
     * Fill linear scale
     */
    async fillLinearScale(questionElement, value) {
        const scaleItems = questionElement.querySelectorAll('[data-value]');

        if (scaleItems.length === 0) {
            throw new Error('No scale items found');
        }

        // Find matching scale value
        const numValue = parseInt(value);

        for (const item of scaleItems) {
            if (item.getAttribute('data-value') === numValue.toString()) {
                item.click();
                return Promise.resolve();
            }
        }

        throw new Error(`No matching scale value: ${value}`);
    }

    /**
     * Fill multiple choice grid
     */
    async fillMultipleChoiceGrid(questionElement, value) {
        // Grid format typically: "Row;Column" or just column if single row
        const rows = questionElement.querySelectorAll('[role="row"]');

        if (rows.length === 0) {
            throw new Error('Grid rows not found');
        }

        for (const row of rows) {
            const radios = row.querySelectorAll('[role="radio"]');

            for (const radio of radios) {
                if (this.valueMatches(radio.getAttribute('aria-label'), value)) {
                    radio.click();
                    return Promise.resolve();
                }
            }
        }

        throw new Error(`No matching grid option for value: ${value}`);
    }

    /**
     * Fill date input
     */
    async fillDate(questionElement, value) {
        const dateInput = questionElement.querySelector('input[type="date"]');

        if (!dateInput) {
            throw new Error('Date input not found');
        }

        const formatted = this.formatDate(value);

        if (!formatted) {
            throw new Error(`Invalid date format: ${value}`);
        }

        dateInput.value = formatted;
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));

        return Promise.resolve();
    }

    /**
     * Fill time input
     */
    async fillTime(questionElement, value) {
        const timeInput = questionElement.querySelector('input[type="time"]');

        if (!timeInput) {
            throw new Error('Time input not found');
        }

        const formatted = this.formatTime(value);

        if (!formatted) {
            throw new Error(`Invalid time format: ${value}`);
        }

        timeInput.value = formatted;
        timeInput.dispatchEvent(new Event('input', { bubbles: true }));
        timeInput.dispatchEvent(new Event('change', { bubbles: true }));

        return Promise.resolve();
    }

    /**
     * Fill email input
     */
    async fillEmail(questionElement, value) {
        const emailInput = questionElement.querySelector('input[type="email"]');

        if (!emailInput) {
            throw new Error('Email input not found');
        }

        emailInput.focus();
        emailInput.value = value;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        emailInput.blur();

        return Promise.resolve();
    }

    /**
     * Fill phone input
     */
    async fillPhone(questionElement, value) {
        const phoneInput = questionElement.querySelector('input[type="tel"]');

        if (!phoneInput) {
            throw new Error('Phone input not found');
        }

        phoneInput.focus();
        phoneInput.value = value;
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
        phoneInput.blur();

        return Promise.resolve();
    }

    /**
     * Fill file upload
     */
    async fillFileUpload(questionElement, fileData) {
        const fileInput = questionElement.querySelector('input[type="file"]');

        if (!fileInput) {
            throw new Error('File input not found');
        }

        // Create file from data
        const file = new File([fileData], 'upload.pdf', { type: 'application/pdf' });

        // Use DataTransfer to set files
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        return Promise.resolve();
    }

    /**
     * Check if value matches option (with fuzzy matching)
     */
    valueMatches(optionText, value) {
        if (!optionText || !value) return false;

        const normalized1 = optionText.toLowerCase().trim();
        const normalized2 = value.toLowerCase().trim();

        // Exact match
        if (normalized1 === normalized2) return true;

        // Contains match
        if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
            return true;
        }

        // Word matching
        const words1 = normalized1.split(/\s+/);
        const words2 = normalized2.split(/\s+/);

        const matches = words1.filter(w => words2.includes(w)).length;

        return matches > 0 && matches >= Math.min(1, Math.floor(words2.length / 2));
    }

    /**
     * Format date string to YYYY-MM-DD
     */
    formatDate(value) {
        if (!value) return null;

        let date;

        if (value instanceof Date) {
            date = value;
        } else {
            date = this.parseDate(value);
        }

        if (!date) return null;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    /**
     * Format time string to HH:MM
     */
    formatTime(value) {
        if (!value) return null;

        // Try HH:MM format
        const match = value.match(/(\d{1,2}):(\d{2})/);

        if (match) {
            const hours = String(match[1]).padStart(2, '0');
            const minutes = String(match[2]).padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        return null;
    }

    /**
     * Parse date string
     */
    parseDate(dateString) {
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/,           // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/,         // MM/DD/YYYY
        ];

        for (const format of formats) {
            const match = dateString.match(format);

            if (match) {
                try {
                    if (match[1].length === 4) {
                        return new Date(match[1], match[2] - 1, match[3]);
                    } else {
                        return new Date(match[3], match[1] - 1, match[2]);
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        return null;
    }

    /**
     * Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        this.processedQuestions.clear();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleFormsEnhanced;
}
