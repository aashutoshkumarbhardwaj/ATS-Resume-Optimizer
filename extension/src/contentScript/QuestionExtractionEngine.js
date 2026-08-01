/**
 * Question Extraction Engine
 * Extracts open-ended questions and form fields across major ATS platforms and generic HTML forms,
 * producing standardized JSON objects.
 */

class QuestionExtractionEngine {
    constructor() {
        this.platform = this.detectPlatform();
    }

    /**
     * Detect the ATS platform based on URL, meta tags, or DOM markers.
     */
    detectPlatform() {
        const url = window.location.href.toLowerCase();
        
        if (url.includes('greenhouse.io')) return 'Greenhouse';
        if (url.includes('jobs.lever.co')) return 'Lever';
        if (url.includes('jobs.ashbyhq.com')) return 'Ashby';
        if (url.includes('myworkdayjobs.com')) return 'Workday';
        if (url.includes('smartrecruiters.com')) return 'SmartRecruiters';
        if (url.includes('taleo.net')) return 'Taleo';
        if (url.includes('successfactors.com')) return 'SuccessFactors';
        
        // Additional DOM checks if URL is masked
        if (document.getElementById('grnhse_app')) return 'Greenhouse';
        if (document.querySelector('.lever-job-page')) return 'Lever';
        if (document.querySelector('meta[property="og:site_name"][content="Ashby"]')) return 'Ashby';
        if (document.querySelector('[data-automation-id="workday-logo"]')) return 'Workday';
        if (document.querySelector('meta[name="apple-itunes-app"][content*="smartrecruiters"]')) return 'SmartRecruiters';
        
        return 'Generic';
    }

    /**
     * Main entry point to extract all questions on the page.
     * @returns {Array<Object>} Array of standardized Question JSON objects
     */
    extractAll() {
        console.log(`[QEE] Running extraction for platform: ${this.platform}`);
        
        // Find candidate inputs (we focus on inputs that usually hold open-ended questions)
        const candidates = [
            ...document.querySelectorAll('textarea'),
            ...document.querySelectorAll('input[type="text"]'),
            // Including contenteditable for custom inputs
            ...document.querySelectorAll('[contenteditable="true"]'),
            ...document.querySelectorAll('[role="textbox"]')
        ];

        const questions = [];
        
        candidates.forEach(el => {
            // Filter out hidden or tiny inputs
            const rect = el.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) return;
            if (!el.offsetParent) return;

            // Extract raw data
            const extracted = this.extractFieldData(el);
            
            // Heuristic to determine if this is actually a "Question" worth answering vs standard field (e.g. "First Name")
            if (this.isLikelyQuestion(extracted)) {
                questions.push(extracted);
            }
        });

        console.log(`[QEE] Extracted ${questions.length} questions`);
        return questions;
    }

    /**
     * Extracts full structured data for a single input element.
     */
    extractFieldData(el) {
        return {
            id: this.generateFieldId(el),
            questionText: this.extractQuestionText(el),
            placeholder: el.placeholder || el.getAttribute('placeholder') || '',
            helpText: this.extractHelpText(el),
            required: this.extractRequiredStatus(el),
            maxLength: this.extractMaxLength(el),
            fieldType: el.tagName.toLowerCase() === 'input' ? (el.type || 'text') : el.tagName.toLowerCase(),
            sectionHeading: this.extractSectionHeading(el),
            nearbyLabels: this.extractNearbyLabels(el),
            validationHints: this.extractValidationHints(el),
            element: el // Keep reference for filling later
        };
    }

    /**
     * Generate a stable, unique ID for the field.
     */
    generateFieldId(el) {
        if (el.id) return el.id;
        if (el.name) return `name-${el.name}`;
        
        // Generate a random stable-ish ID based on its position
        const index = Array.from(document.querySelectorAll(el.tagName)).indexOf(el);
        return `anon-${el.tagName.toLowerCase()}-${index}`;
    }

    /**
     * Extracts the primary question text / label for the field.
     */
    extractQuestionText(el) {
        let labelText = '';

        // 1. Check for standard <label for="...">
        if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label) {
                // Remove any child spans (like required '*' markers) before getting text
                const clone = label.cloneNode(true);
                const reqMarks = clone.querySelectorAll('.asterisk, .required, [title="required"]');
                reqMarks.forEach(m => m.remove());
                labelText = clone.textContent.trim();
            }
        }

        // 2. Check aria attributes
        if (!labelText && el.getAttribute('aria-label')) {
            labelText = el.getAttribute('aria-label');
        }

        if (!labelText && el.getAttribute('aria-labelledby')) {
            const ref = document.getElementById(el.getAttribute('aria-labelledby'));
            if (ref) labelText = ref.textContent.trim();
        }

        // 3. Platform specific logic (Workday often uses complex label structures)
        if (!labelText && this.platform === 'Workday') {
            const container = el.closest('[data-automation-id="formField"]');
            if (container) {
                const label = container.querySelector('[data-automation-id="formLabel"]');
                if (label) labelText = label.textContent.trim();
            }
        }

        // 4. Wrapping label
        if (!labelText) {
            const wrap = el.closest('label');
            if (wrap) {
                const clone = wrap.cloneNode(true);
                // Remove the input itself from the text
                const inputInClone = clone.querySelector(el.tagName);
                if (inputInClone) inputInClone.remove();
                labelText = clone.textContent.trim();
            }
        }

        // 5. Preceding text heuristic
        if (!labelText) {
            let current = el.previousElementSibling;
            for (let i = 0; i < 3 && current; i++) {
                if (['LABEL', 'DIV', 'P', 'SPAN'].includes(current.tagName)) {
                    if (current.textContent.trim().length > 3) {
                        labelText = current.textContent.trim();
                        break;
                    }
                }
                current = current.previousElementSibling;
            }
        }

        return this.cleanText(labelText);
    }

    /**
     * Extracts supplementary help text (e.g. "Max 500 words" or "Please describe in detail").
     */
    extractHelpText(el) {
        let helpText = '';
        
        // 1. Check aria-describedby
        const describedBy = el.getAttribute('aria-describedby');
        if (describedBy) {
            const ref = document.getElementById(describedBy);
            if (ref) helpText = ref.textContent;
        }

        // 2. Check platform specific hints
        if (!helpText && this.platform === 'Greenhouse') {
            const desc = el.closest('.field')?.querySelector('.description');
            if (desc) helpText = desc.textContent;
        }

        if (!helpText && this.platform === 'Lever') {
            const desc = el.closest('.application-question')?.querySelector('.application-field-description');
            if (desc) helpText = desc.textContent;
        }

        // 3. Heuristic: Look for small text near the input
        if (!helpText) {
            const parent = el.parentElement;
            if (parent) {
                const hint = parent.querySelector('small, .hint, .help-block, .description, [class*="help"], [class*="hint"]');
                if (hint) helpText = hint.textContent;
            }
        }

        return this.cleanText(helpText);
    }

    /**
     * Determines if the field is required.
     */
    extractRequiredStatus(el) {
        if (el.required) return true;
        if (el.getAttribute('aria-required') === 'true') return true;
        
        // Check for required asterisks in the label
        if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label && (label.textContent.includes('*') || label.querySelector('.required, .asterisk, [title="required"]'))) {
                return true;
            }
        }

        if (this.platform === 'Workday') {
            const container = el.closest('[data-automation-id="formField"]');
            if (container && container.querySelector('[data-automation-id="requiredStar"]')) return true;
        }

        return false;
    }

    /**
     * Extracts maximum length constraint, returning a number or null.
     */
    extractMaxLength(el) {
        if (el.hasAttribute('maxlength')) {
            const max = parseInt(el.getAttribute('maxlength'), 10);
            if (!isNaN(max) && max > 0) return max;
        }

        // Look for hints in help text like "Max 500 words" or "2000 characters left"
        const helpText = this.extractHelpText(el) || '';
        const charMatch = helpText.match(/(\d+)\s*(character|word)/i);
        if (charMatch) {
            return parseInt(charMatch[1], 10);
        }

        return null;
    }

    /**
     * Extracts the heading of the section this field belongs to.
     */
    extractSectionHeading(el) {
        let current = el.parentElement;
        while (current && current.tagName !== 'BODY') {
            // Check for explicit section elements
            if (current.tagName === 'FIELDSET') {
                const legend = current.querySelector('legend');
                if (legend) return this.cleanText(legend.textContent);
            }
            if (current.tagName === 'SECTION' || current.getAttribute('role') === 'group') {
                const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
                if (heading) return this.cleanText(heading.textContent);
            }

            // Platform specific
            if (this.platform === 'Lever' && current.classList.contains('section-wrapper')) {
                const heading = current.querySelector('.section-heading');
                if (heading) return this.cleanText(heading.textContent);
            }

            // General heuristic: find the nearest preceding heading in the container
            const containerHeadings = current.querySelectorAll('h1, h2, h3');
            if (containerHeadings.length === 1) {
                // If there's exactly one prominent heading in a close wrapper, it's likely the section heading
                // But only use it if we are relatively deep in the DOM to avoid grabbing the page title
                if (current.querySelectorAll('input, textarea').length < 15) {
                     return this.cleanText(containerHeadings[0].textContent);
                }
            }

            current = current.parentElement;
        }
        return '';
    }

    /**
     * Extracts an array of labels/texts located nearby (to provide context for AI).
     */
    extractNearbyLabels(el) {
        const labels = [];
        let current = el.previousElementSibling;
        let count = 0;
        
        while (current && count < 3) {
            const text = this.cleanText(current.textContent);
            if (text && text.length > 3 && text.length < 100) {
                labels.push(text);
            }
            current = current.previousElementSibling;
            count++;
        }
        return labels;
    }

    /**
     * Extracts validation patterns or error messages (hints for how to answer).
     */
    extractValidationHints(el) {
        const hints = [];
        if (el.hasAttribute('pattern')) hints.push(`Pattern: ${el.getAttribute('pattern')}`);
        if (el.hasAttribute('minlength')) hints.push(`Min length: ${el.getAttribute('minlength')}`);
        
        const title = el.getAttribute('title');
        if (title && !this.extractQuestionText(el).includes(title)) {
            hints.push(`Hint: ${title}`);
        }

        // Look for hidden error messages that might reveal rules
        const parent = el.parentElement;
        if (parent) {
            const errors = parent.querySelectorAll('.error-message, .invalid-feedback, [role="alert"]');
            errors.forEach(err => {
                const text = this.cleanText(err.textContent);
                if (text) hints.push(`Error rule: ${text}`);
            });
        }

        return hints;
    }

    /**
     * Filter function to determine if a field is likely an open-ended question that AI should answer,
     * rather than a basic info field (Name, Email, etc).
     */
    isLikelyQuestion(extractedData) {
        const text = (extractedData.questionText + ' ' + extractedData.placeholder).toLowerCase();
        
        // If it's a textarea, it's almost always an open ended question, unless it's a cover letter (which we usually handle separately, but could handle here)
        if (extractedData.fieldType === 'textarea') return true;

        // Common patterns for open ended questions
        const questionPatterns = [
            /\?$/,
            /\bwhy\b/, /\bhow\b/, /\bdescribe\b/, /\btell us\b/, /\bexplain\b/,
            /\bwhat.{0,20}(experience|skills|background|motivat|bring)/,
            /\bplease (share|provide|describe|tell)/,
            /\bachievement\b/, /\bstrength\b/, /\bweakness\b/,
            /\bgoal\b/, /\bself.?introduc/
        ];

        return questionPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Cleans up text by removing extra spaces, newlines, and asterisks.
     */
    cleanText(str) {
        if (!str) return '';
        return str.replace(/[\n\r]+/g, ' ') // replace newlines with space
                  .replace(/\s{2,}/g, ' ')   // collapse multiple spaces
                  .replace(/^\*|\*$/g, '')   // remove leading/trailing asterisks
                  .trim();
    }
}

// Export for module systems (or make available globally in content script)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestionExtractionEngine;
} else {
    window.QuestionExtractionEngine = QuestionExtractionEngine;
}
