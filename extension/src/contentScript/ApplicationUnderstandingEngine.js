/**
 * Application Understanding Engine
 * Intelligently detects, classifies, and fills job application forms
 * Supports multiple ATS platforms and custom forms
 */

class ApplicationUnderstandingEngine {
    constructor() {
        this.detectedFields = [];
        this.formStructure = null;
        this.platformDetector = new PlatformDetector();
        this.fieldClassifier = new FieldClassifier();
        this.optionMatcher = new IntelligentOptionMatcher();
        this.learningEngine = new LearningEngine();
    }

    /**
     * Main entry point - Detect and understand the entire application form
     */
    async analyzeApplication() {
        console.log('[AUE] 🚀 Starting application analysis...');

        try {
            // Step 1: Detect platform
            const platform = this.platformDetector.detect();
            console.log('[AUE] 📍 Platform detected:', platform);

            // Step 2: Detect all form fields
            const fields = await this.detectAllFields();
            console.log(`[AUE] 📋 Detected ${fields.length} fields`);

            // Step 3: Classify semantic intent
            const classifiedFields = await this.classifyFields(fields);
            console.log(`[AUE] 🧠 Classified ${classifiedFields.length} fields`);

            // Step 4: Build structured representation
            this.formStructure = this.buildFormStructure(classifiedFields, platform);
            console.log('[AUE] 📦 Form structure built');

            return this.formStructure;
        } catch (error) {
            console.error('[AUE] ❌ Analysis error:', error);
            throw error;
        }
    }

    /**
     * Detect all form fields on the page
     */
    async detectAllFields() {
        const fields = [];
        const selectors = [
            // Standard HTML inputs
            'input:not([type="hidden"]):not([type="button"]):not([type="submit"])',
            'textarea',
            'select',
            // Contenteditable
            '[contenteditable="true"]',
            '[role="textbox"]',
            '[role="combobox"]',
            // React/MUI/Ant Design custom selects
            '[class*="select"]',
            '[class*="Select"]',
            '[data-testid*="select"]',
            // Radio and checkbox groups
            'input[type="radio"]',
            'input[type="checkbox"]',
            // Date pickers
            '[type="date"]',
            '[class*="date"]',
            '[class*="Date"]'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (this.isVisible(element) && !this.isDuplicate(element, fields)) {
                    const fieldData = await this.extractFieldData(element);
                    if (fieldData) {
                        fields.push(fieldData);
                    }
                }
            }
        }

        return fields;
    }

    /**
     * Extract comprehensive data from a single field
     */
    async extractFieldData(element) {
        const fieldData = {
            element,
            id: element.id || this.generateFieldId(element),
            type: this.detectFieldType(element),
            label: this.extractLabel(element),
            placeholder: element.placeholder || '',
            name: element.name || '',
            required: this.isRequired(element),
            value: this.getCurrentValue(element),
            section: this.detectSection(element),
            ariaLabel: element.getAttribute('aria-label') || '',
            options: [],
            metadata: {}
        };

        // Extract options for select/radio/checkbox fields
        if (['select', 'radio', 'checkbox', 'custom-select'].includes(fieldData.type)) {
            fieldData.options = await this.extractOptions(element, fieldData.type);
        }

        // Extract additional metadata
        fieldData.metadata = {
            xpath: this.getXPath(element),
            classList: Array.from(element.classList),
            dataAttributes: this.getDataAttributes(element),
            validationRules: this.extractValidationRules(element)
        };

        return fieldData;
    }

    /**
     * Detect field type (including custom component types)
     */
    detectFieldType(element) {
        // Standard HTML types
        if (element.tagName === 'INPUT') {
            return element.type || 'text';
        }
        if (element.tagName === 'TEXTAREA') {
            return 'textarea';
        }
        if (element.tagName === 'SELECT') {
            return 'select';
        }

        // Custom select components (React Select, MUI, Ant Design)
        const classList = Array.from(element.classList).join(' ').toLowerCase();
        const role = element.getAttribute('role');

        if (role === 'combobox' || classList.includes('select')) {
            return 'custom-select';
        }
        if (role === 'textbox' || element.hasAttribute('contenteditable')) {
            return 'contenteditable';
        }
        if (classList.includes('date') || element.type === 'date') {
            return 'date';
        }

        return 'text';
    }

    /**
     * Extract label text for a field (comprehensive approach)
     */
    extractLabel(element) {
        // Try associated label
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return this.cleanText(label.textContent);
        }

        // Try parent label
        const parentLabel = element.closest('label');
        if (parentLabel) {
            return this.cleanText(parentLabel.textContent.replace(element.textContent, ''));
        }

        // Try aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return this.cleanText(ariaLabel);

        // Try aria-labelledby
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) return this.cleanText(labelElement.textContent);
        }

        // Try placeholder
        if (element.placeholder) return this.cleanText(element.placeholder);

        // Try name attribute (convert to human-readable)
        if (element.name) {
            return this.cleanText(element.name.replace(/[_-]/g, ' '));
        }

        // Look for nearby text (previous sibling, parent text, etc.)
        return this.extractNearbyText(element);
    }

    /**
     * Extract nearby text to determine field label
     */
    extractNearbyText(element) {
        // Check previous sibling
        let sibling = element.previousElementSibling;
        while (sibling && sibling.tagName !== 'FORM') {
            const text = this.cleanText(sibling.textContent);
            if (text && text.length < 200) {
                return text;
            }
            sibling = sibling.previousElementSibling;
        }

        // Check parent's text content
        const parent = element.parentElement;
        if (parent) {
            const parentText = Array.from(parent.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => this.cleanText(node.textContent))
                .join(' ');
            if (parentText) return parentText;
        }

        return '';
    }

    /**
     * Extract options from select/radio/checkbox fields
     */
    async extractOptions(element, fieldType) {
        const options = [];

        if (fieldType === 'select') {
            // Standard HTML select
            const optionElements = element.querySelectorAll('option');
            for (const option of optionElements) {
                if (option.value && option.value !== '') {
                    options.push({
                        value: option.value,
                        label: this.cleanText(option.textContent),
                        selected: option.selected
                    });
                }
            }
        } else if (fieldType === 'radio' || fieldType === 'checkbox') {
            // Radio/checkbox group
            const name = element.name;
            const group = document.querySelectorAll(`input[name="${name}"]`);
            for (const input of group) {
                const label = this.extractLabel(input);
                options.push({
                    value: input.value,
                    label: label,
                    checked: input.checked
                });
            }
        } else if (fieldType === 'custom-select') {
            // Custom select components - wait for options to load
            options.push(...await this.extractCustomSelectOptions(element));
        }

        return options;
    }

    /**
     * Extract options from custom select components (React Select, MUI, Ant Design)
     */
    async extractCustomSelectOptions(element) {
        const options = [];

        // Click to open dropdown and wait for options to appear
        try {
            element.click();
            await this.wait(300);

            // Look for option lists
            const optionSelectors = [
                '[role="option"]',
                '[class*="option"]',
                '[class*="Option"]',
                '[class*="menu"] li',
                '[class*="Menu"] li',
                '.ant-select-item',
                '.MuiMenuItem-root',
                '[data-value]'
            ];

            for (const selector of optionSelectors) {
                const optionElements = document.querySelectorAll(selector);
                if (optionElements.length > 0) {
                    for (const opt of optionElements) {
                        const value = opt.getAttribute('data-value') || opt.textContent;
                        const label = this.cleanText(opt.textContent);
                        if (label) {
                            options.push({ value, label, selected: false });
                        }
                    }
                    break;
                }
            }

            // Close dropdown
            document.body.click();
            await this.wait(100);
        } catch (error) {
            console.warn('[AUE] Could not extract custom select options:', error);
        }

        return options;
    }


    /**
     * Classify semantic intent of fields
     */
    async classifyFields(fields) {
        return fields.map(field => {
            const semanticIntent = this.fieldClassifier.classify(field);
            return {
                ...field,
                semanticIntent,
                confidence: semanticIntent.confidence
            };
        });
    }

    /**
     * Build structured form representation
     */
    buildFormStructure(fields, platform) {
        return {
            platform,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            totalFields: fields.length,
            sections: this.groupFieldsBySections(fields),
            fields: fields.map(f => ({
                id: f.id,
                type: f.type,
                label: f.label,
                semanticIntent: f.semanticIntent,
                required: f.required,
                options: f.options,
                section: f.section,
                metadata: f.metadata
            }))
        };
    }

    /**
     * Group fields by sections
     */
    groupFieldsBySections(fields) {
        const sections = {};
        for (const field of fields) {
            const sectionName = field.section || 'General';
            if (!sections[sectionName]) {
                sections[sectionName] = [];
            }
            sections[sectionName].push(field);
        }
        return sections;
    }

    /**
     * Detect section for a field
     */
    detectSection(element) {
        // Look for heading elements above the field
        let current = element;
        while (current && current !== document.body) {
            current = current.parentElement;
            
            // Check for section headings
            const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
                return this.cleanText(heading.textContent);
            }

            // Check for fieldset legend
            if (current.tagName === 'FIELDSET') {
                const legend = current.querySelector('legend');
                if (legend) {
                    return this.cleanText(legend.textContent);
                }
            }

            // Check for div with section-like class
            const classList = Array.from(current.classList).join(' ').toLowerCase();
            if (classList.includes('section') || classList.includes('step')) {
                const sectionText = this.extractSectionTitle(current);
                if (sectionText) return sectionText;
            }
        }

        return 'General';
    }

    /**
     * Extract section title from container
     */
    extractSectionTitle(container) {
        const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
            return this.cleanText(heading.textContent);
        }

        const title = container.querySelector('[class*="title"], [class*="Title"], [class*="heading"]');
        if (title) {
            return this.cleanText(title.textContent);
        }

        return '';
    }

    /**
     * Check if field is required
     */
    isRequired(element) {
        // Check required attribute
        if (element.hasAttribute('required') || element.required) {
            return true;
        }

        // Check aria-required
        if (element.getAttribute('aria-required') === 'true') {
            return true;
        }

        // Check for asterisk in label
        const label = this.extractLabel(element);
        if (label.includes('*') || label.includes('required')) {
            return true;
        }

        return false;
    }

    /**
     * Get current value of field
     */
    getCurrentValue(element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked;
        }
        if (element.hasAttribute('contenteditable')) {
            return element.textContent;
        }
        return element.value || '';
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
     * Check if field is duplicate
     */
    isDuplicate(element, existingFields) {
        return existingFields.some(f => f.element === element);
    }

    /**
     * Generate unique field ID
     */
    generateFieldId(element) {
        return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get XPath for element
     */
    getXPath(element) {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        const parts = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = element.previousSibling;
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            const tagName = element.nodeName.toLowerCase();
            const pathIndex = index ? `[${index + 1}]` : '';
            parts.unshift(`${tagName}${pathIndex}`);
            element = element.parentNode;
        }
        return parts.length ? `/${parts.join('/')}` : '';
    }

    /**
     * Get data attributes
     */
    getDataAttributes(element) {
        const dataAttrs = {};
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-')) {
                dataAttrs[attr.name] = attr.value;
            }
        }
        return dataAttrs;
    }

    /**
     * Extract validation rules
     */
    extractValidationRules(element) {
        const rules = {};
        
        if (element.hasAttribute('minlength')) {
            rules.minLength = parseInt(element.getAttribute('minlength'));
        }
        if (element.hasAttribute('maxlength')) {
            rules.maxLength = parseInt(element.getAttribute('maxlength'));
        }
        if (element.hasAttribute('min')) {
            rules.min = element.getAttribute('min');
        }
        if (element.hasAttribute('max')) {
            rules.max = element.getAttribute('max');
        }
        if (element.hasAttribute('pattern')) {
            rules.pattern = element.getAttribute('pattern');
        }
        if (element.type === 'email') {
            rules.email = true;
        }
        if (element.type === 'url') {
            rules.url = true;
        }

        return rules;
    }

    /**
     * Clean text (remove extra whitespace, etc.)
     */
    cleanText(text) {
        return text ? text.trim().replace(/\s+/g, ' ').replace(/\*/g, '') : '';
    }

    /**
     * Wait helper
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


/**
 * Platform Detector - Identifies which ATS platform is being used
 */
class PlatformDetector {
    detect() {
        const url = window.location.href;
        const hostname = window.location.hostname;
        const html = document.documentElement.outerHTML;

        // Google Forms
        if (hostname.includes('docs.google.com') && url.includes('/forms/')) {
            return { name: 'Google Forms', type: 'google-forms' };
        }

        // LinkedIn
        if (hostname.includes('linkedin.com') && url.includes('/jobs/')) {
            return { name: 'LinkedIn', type: 'linkedin' };
        }

        // Greenhouse
        if (hostname.includes('greenhouse.io') || html.includes('greenhouse')) {
            return { name: 'Greenhouse', type: 'greenhouse' };
        }

        // Lever
        if (hostname.includes('lever.co') || html.includes('lever-framework')) {
            return { name: 'Lever', type: 'lever' };
        }

        // Workday
        if (hostname.includes('myworkdayjobs.com') || html.includes('workday')) {
            return { name: 'Workday', type: 'workday' };
        }

        // Ashby
        if (hostname.includes('ashbyhq.com') || html.includes('ashby')) {
            return { name: 'Ashby', type: 'ashby' };
        }

        // BambooHR
        if (hostname.includes('bamboohr.com')) {
            return { name: 'BambooHR', type: 'bamboohr' };
        }

        // Jobvite
        if (hostname.includes('jobvite.com')) {
            return { name: 'Jobvite', type: 'jobvite' };
        }

        // iCIMS
        if (hostname.includes('icims.com')) {
            return { name: 'iCIMS', type: 'icims' };
        }

        // Taleo
        if (html.includes('taleo') || hostname.includes('taleo')) {
            return { name: 'Taleo', type: 'taleo' };
        }

        // SmartRecruiters
        if (hostname.includes('smartrecruiters.com')) {
            return { name: 'SmartRecruiters', type: 'smartrecruiters' };
        }

        // Custom/Unknown
        return { name: 'Custom ATS', type: 'custom' };
    }
}


/**
 * Field Classifier - Classifies semantic intent of form fields
 */
class FieldClassifier {
    constructor() {
        this.intentPatterns = this.buildIntentPatterns();
    }

    /**
     * Build comprehensive intent patterns - ENHANCED with 100+ real-world variations
     */
    buildIntentPatterns() {
        return {
            // ==================== PERSONAL INFORMATION ====================
            email: {
                patterns: [
                    'email', 'e-mail', 'mail', 'email address', 'e-mail address',
                    'electronic mail', 'mail address', 'work email', 'personal email',
                    'contact email', 'primary email', 'business email', 'email id',
                    'your email', 'applicant email', 'candidate email', 'professional email'
                ],
                confidence: 0.95
            },
            
            full_name: {
                patterns: [
                    'full name', 'name', 'full legal name', 'complete name', 'legal name',
                    'your name', 'applicant name', 'candidate name', 'your full name',
                    'name as per records', 'official name', 'name in full', 'entire name',
                    'person name', 'individual name', 'preferred name'
                ],
                confidence: 0.90
            },
            
            first_name: {
                patterns: [
                    'first name', 'firstname', 'first', 'given name', 'forename',
                    'fname', 'your first name', 'applicant first name', 'first given name',
                    'christian name', 'personal name'
                ],
                confidence: 0.95
            },
            
            middle_name: {
                patterns: [
                    'middle name', 'middlename', 'middle', 'middle initial', 'mi',
                    'second name', 'middle given name'
                ],
                confidence: 0.95
            },
            
            last_name: {
                patterns: [
                    'last name', 'lastname', 'surname', 'family name', 'last',
                    'lname', 'second name', 'your last name', 'applicant last name',
                    'family surname', 'inherited name'
                ],
                confidence: 0.95
            },
            
            phone: {
                patterns: [
                    'phone', 'phone number', 'mobile', 'mobile number', 'telephone',
                    'cell', 'cell phone', 'cellphone', 'cellular', 'contact number',
                    'contact phone', 'phone no', 'tel', 'telephone number', 'phno',
                    'primary phone', 'whatsapp', 'whatsapp number', 'alternate phone',
                    'secondary phone', 'home phone', 'work phone', 'mobile phone number',
                    'contact details', 'reachable number', 'best contact number'
                ],
                confidence: 0.90
            },
            
            date_of_birth: {
                patterns: [
                    'date of birth', 'dob', 'birth date', 'birthday', 'birthdate',
                    'date born', 'your dob', 'dd/mm/yyyy', 'mm/dd/yyyy', 'birth day',
                    'when were you born'
                ],
                confidence: 0.95
            },
            
            age: {
                patterns: [
                    'age', 'your age', 'how old', 'years old', 'current age'
                ],
                confidence: 0.95
            },
            
            // ==================== LOCATION ====================
            address: {
                patterns: [
                    'address', 'street address', 'street', 'residential address',
                    'home address', 'current address', 'permanent address', 'mailing address',
                    'correspondence address', 'full address', 'complete address', 'location',
                    'residence', 'address line', 'address 1', 'address line 1',
                    'street name', 'house number', 'apartment', 'flat', 'building'
                ],
                confidence: 0.90
            },
            
            address_line_2: {
                patterns: [
                    'address line 2', 'address 2', 'apartment', 'apt', 'suite', 'unit',
                    'floor', 'building name', 'landmark', 'near'
                ],
                confidence: 0.90
            },
            
            city: {
                patterns: [
                    'city', 'town', 'municipality', 'urban area', 'your city',
                    'city name', 'current city', 'home city', 'residing city'
                ],
                confidence: 0.95
            },
            
            state: {
                patterns: [
                    'state', 'province', 'region', 'state/province', 'state province',
                    'territory', 'county', 'administrative division', 'your state',
                    'state name', 'state/region'
                ],
                confidence: 0.95
            },
            
            zip: {
                patterns: [
                    'zip', 'zip code', 'postal', 'postal code', 'postcode', 'post code',
                    'pin', 'pin code', 'pincode', 'area code', 'zip/postal'
                ],
                confidence: 0.95
            },
            
            country: {
                patterns: [
                    'country', 'nation', 'country of residence', 'your country',
                    'country name', 'residing country', 'current country', 'nationality'
                ],
                confidence: 0.95
            },
            
            // ==================== PROFESSIONAL ====================
            current_company: {
                patterns: [
                    'current company', 'company', 'employer', 'current employer',
                    'present company', 'organization', 'current organization', 'workplace',
                    'company name', 'current employment', 'present employer', 'working at',
                    'employed at', 'company you work for', 'current workplace', 'firm',
                    'business name', 'organization name'
                ],
                confidence: 0.85
            },
            
            previous_company: {
                patterns: [
                    'previous company', 'former company', 'last company', 'previous employer',
                    'former employer', 'last employer', 'past company', 'past employer'
                ],
                confidence: 0.85
            },
            
            current_title: {
                patterns: [
                    'current title', 'job title', 'position', 'current position',
                    'role', 'current role', 'designation', 'current designation',
                    'job role', 'position title', 'your title', 'your role',
                    'current job title', 'present position', 'occupation', 'your position',
                    'what do you do', 'job function', 'work role'
                ],
                confidence: 0.85
            },
            
            linkedin: {
                patterns: [
                    'linkedin', 'linkedin profile', 'linkedin url', 'linkedin link',
                    'linkedin username', 'linkedin id', 'linkedin account', 'linkedin page',
                    'linkedin handle', 'linkedin address', 'linkedin profile url',
                    'linkedin profile link'
                ],
                confidence: 0.95
            },
            
            github: {
                patterns: [
                    'github', 'github profile', 'github url', 'github link',
                    'github username', 'github id', 'github account', 'github page',
                    'github handle', 'git', 'github repository', 'github repo'
                ],
                confidence: 0.95
            },
            
            portfolio: {
                patterns: [
                    'portfolio', 'portfolio url', 'portfolio link', 'portfolio website',
                    'website', 'personal website', 'personal site', 'web portfolio',
                    'online portfolio', 'your website', 'personal page', 'web url',
                    'portfolio page', 'professional website'
                ],
                confidence: 0.90
            },
            
            twitter: {
                patterns: [
                    'twitter', 'twitter handle', 'twitter profile', 'twitter username',
                    'twitter id', 'twitter url', 'twitter link', 'twitter account', 'x profile'
                ],
                confidence: 0.95
            },
            
            stackoverflow: {
                patterns: [
                    'stackoverflow', 'stack overflow', 'stackoverflow profile',
                    'stackoverflow url', 'stackoverflow link', 'stackoverflow account',
                    'stack overflow profile'
                ],
                confidence: 0.95
            },
            
            behance: {
                patterns: [
                    'behance', 'behance profile', 'behance url', 'behance link',
                    'behance portfolio', 'behance account'
                ],
                confidence: 0.95
            },
            
            dribbble: {
                patterns: [
                    'dribbble', 'dribbble profile', 'dribbble url', 'dribbble link',
                    'dribbble portfolio', 'dribbble account'
                ],
                confidence: 0.95
            },
            
            // ==================== EXPERIENCE & SKILLS ====================
            years_of_experience: {
                patterns: [
                    'years of experience', 'experience', 'yoe', 'total experience',
                    'work experience', 'professional experience', 'experience years',
                    'years experience', 'how many years', 'exp', 'years in industry',
                    'career experience', 'overall experience', 'relevant experience',
                    'years of work experience', 'total years', 'work years'
                ],
                confidence: 0.90
            },
            
            relevant_experience: {
                patterns: [
                    'relevant experience', 'related experience', 'experience in this field',
                    'experience in this role', 'specific experience'
                ],
                confidence: 0.85
            },
            
            skills: {
                patterns: [
                    'skills', 'technical skills', 'skill set', 'skillset', 'competencies',
                    'expertise', 'abilities', 'core skills', 'key skills', 'your skills',
                    'professional skills', 'technical competencies', 'technologies',
                    'tech stack', 'tools', 'proficiencies', 'technical expertise',
                    'core competencies', 'technical proficiency'
                ],
                confidence: 0.90
            },
            
            certifications: {
                patterns: [
                    'certifications', 'certificates', 'professional certifications',
                    'cert', 'certified', 'professional certificates', 'credentials',
                    'professional credentials', 'licenses', 'accreditations'
                ],
                confidence: 0.90
            },
            
            languages: {
                patterns: [
                    'languages', 'language', 'language known', 'languages known',
                    'language proficiency', 'spoken languages', 'language skills',
                    'linguistic skills', 'fluent in', 'speak'
                ],
                confidence: 0.90
            },
            
            // ==================== COMPENSATION & AVAILABILITY ====================
            expected_salary: {
                patterns: [
                    'salary', 'expected salary', 'salary expectation', 'salary expectations',
                    'desired salary', 'compensation', 'expected compensation', 'pay',
                    'expected pay', 'salary requirement', 'salary range', 'ctc',
                    'expected ctc', 'current ctc', 'salary cts', 'current cts',
                    'annual salary', 'annual ctc', 'compensation expectation', 'pay expectation',
                    'expected annual salary', 'salary per annum', 'salary per month',
                    'monthly salary', 'yearly salary', 'salary bracket', 'remuneration',
                    'expected remuneration', 'compensation package'
                ],
                confidence: 0.85
            },
            
            current_salary: {
                patterns: [
                    'current salary', 'current ctc', 'current compensation',
                    'current pay', 'present salary', 'existing salary', 'current package',
                    'current annual salary', 'current monthly salary'
                ],
                confidence: 0.85
            },
            
            notice_period: {
                patterns: [
                    'notice period', 'notice', 'notice required', 'availability',
                    'when can you start', 'start date', 'joining date', 'available from',
                    'earliest start date', 'how soon can you join', 'when available',
                    'notice length', 'notice duration', 'days notice', 'weeks notice',
                    'months notice', 'serving notice', 'immediate joiner'
                ],
                confidence: 0.85
            },
            
            // ==================== WORK PREFERENCES ====================
            work_authorization: {
                patterns: [
                    'work authorization', 'visa', 'visa status', 'work visa',
                    'work permit', 'eligible to work', 'authorization', 'work eligibility',
                    'legal to work', 'authorized to work', 'right to work', 'immigration status',
                    'sponsorship', 'require sponsorship', 'need sponsorship', 'visa type',
                    'citizen', 'citizenship', 'permanent resident', 'green card'
                ],
                confidence: 0.90
            },
            
            work_environment: {
                patterns: [
                    'work environment', 'work type', 'work mode', 'working mode',
                    'office', 'remote', 'hybrid', 'work from home', 'wfh', 'onsite',
                    'work location preference', 'working preference', 'location preference',
                    'preferred work environment', 'in-office', 'work remotely',
                    'telecommute', 'work preference'
                ],
                confidence: 0.85
            },
            
            preferred_location: {
                patterns: [
                    'preferred location', 'desired location', 'location preference',
                    'willing to relocate', 'open to relocate', 'relocation', 'relocate',
                    'preferred city', 'preferred work location', 'work location',
                    'job location preference', 'where would you like to work'
                ],
                confidence: 0.85
            },
            
            employment_type: {
                patterns: [
                    'employment type', 'job type', 'type of employment', 'contract type',
                    'full time', 'part time', 'contract', 'freelance', 'internship',
                    'temporary', 'permanent', 'consulting', 'full-time', 'part-time'
                ],
                confidence: 0.90
            },
            
            // ==================== APPLICATION-SPECIFIC QUESTIONS ====================
            why_company: {
                patterns: [
                    'why do you want to work', 'why this company', 'why are you interested',
                    'why join', 'why our company', 'why us', 'interest in company',
                    'why apply', 'what interests you', 'attracted to company', 'why here',
                    'motivation to join', 'why do you want this job'
                ],
                confidence: 0.80
            },
            
            why_hire: {
                patterns: [
                    'why should we hire you', 'why hire you', 'what makes you suitable',
                    'why you', 'why are you the best', 'what makes you unique',
                    'your strengths', 'why good fit', 'what can you bring',
                    'value you add', 'what makes you stand out', 'convince us'
                ],
                confidence: 0.80
            },
            
            cover_letter: {
                patterns: [
                    'cover letter', 'letter', 'motivation letter', 'motivation',
                    'why are you applying', 'letter of interest', 'application letter',
                    'letter of motivation', 'introductory letter', 'covering letter'
                ],
                confidence: 0.85
            },
            
            about_you: {
                patterns: [
                    'about you', 'about yourself', 'tell us about yourself',
                    'introduce yourself', 'your background', 'introduction',
                    'describe yourself', 'who are you', 'personal statement',
                    'brief introduction', 'profile summary', 'summary', 'bio',
                    'biography', 'tell me about yourself'
                ],
                confidence: 0.80
            },
            
            strengths: {
                patterns: [
                    'strengths', 'your strengths', 'strong points', 'what are your strengths',
                    'key strengths', 'core strengths', 'greatest strengths'
                ],
                confidence: 0.85
            },
            
            weaknesses: {
                patterns: [
                    'weaknesses', 'your weaknesses', 'weak points', 'what are your weaknesses',
                    'areas of improvement', 'areas for improvement', 'growth areas'
                ],
                confidence: 0.85
            },
            
            career_goals: {
                patterns: [
                    'career goals', 'career objectives', 'future goals', 'professional goals',
                    'career aspirations', 'long term goals', 'where do you see yourself',
                    '5 year plan', '10 year plan', 'career plan'
                ],
                confidence: 0.85
            },
            
            achievements: {
                patterns: [
                    'achievements', 'accomplishments', 'major achievements', 'key achievements',
                    'professional achievements', 'career highlights', 'biggest achievement',
                    'proud of', 'success stories'
                ],
                confidence: 0.85
            },
            
            projects: {
                patterns: [
                    'projects', 'key projects', 'major projects', 'project experience',
                    'projects worked on', 'relevant projects', 'significant projects'
                ],
                confidence: 0.85
            },
            
            // ==================== REFERENCES ====================
            reference_name: {
                patterns: [
                    'reference name', 'reference', 'referral', 'referee', 'referee name',
                    'referred by', 'reference person', 'referral name', 'who referred you',
                    'recommendation', 'professional reference'
                ],
                confidence: 0.85
            },
            
            reference_email: {
                patterns: [
                    'reference email', 'referee email', 'referral email',
                    'reference contact email', 'reference mail'
                ],
                confidence: 0.90
            },
            
            reference_phone: {
                patterns: [
                    'reference phone', 'referee phone', 'reference contact',
                    'reference number', 'referral phone', 'referral contact'
                ],
                confidence: 0.90
            },
            
            reference_company: {
                patterns: [
                    'reference company', 'referee company', 'reference organization',
                    'referral company', 'reference workplace'
                ],
                confidence: 0.85
            },
            
            reference_relationship: {
                patterns: [
                    'reference relationship', 'relationship with reference',
                    'how do you know', 'relationship to referee', 'connection'
                ],
                confidence: 0.85
            },
            
            how_did_you_hear: {
                patterns: [
                    'how did you hear', 'how did you find', 'where did you hear',
                    'source', 'referral source', 'heard about us', 'found us',
                    'know about this position', 'learn about this job'
                ],
                confidence: 0.85
            },
            
            // ==================== EDUCATION ====================
            education: {
                patterns: [
                    'education', 'educational background', 'education details',
                    'degree', 'qualification', 'qualifications', 'school', 'university',
                    'college', 'educational qualification', 'academic background',
                    'education level', 'highest education', 'academic qualification'
                ],
                confidence: 0.85
            },
            
            degree: {
                patterns: [
                    'degree', 'degree type', 'degree name', 'what degree', 'bachelors',
                    'masters', 'phd', 'doctorate', 'undergraduate', 'graduate',
                    'postgraduate', 'diploma'
                ],
                confidence: 0.90
            },
            
            major: {
                patterns: [
                    'major', 'field of study', 'specialization', 'specialisation',
                    'major subject', 'course', 'stream', 'branch', 'concentration',
                    'academic major', 'subject'
                ],
                confidence: 0.85
            },
            
            university: {
                patterns: [
                    'university', 'college', 'school', 'institution', 'university name',
                    'college name', 'school name', 'educational institution',
                    'institute', 'alma mater'
                ],
                confidence: 0.90
            },
            
            graduation_year: {
                patterns: [
                    'graduation year', 'graduated', 'year of graduation', 'completion year',
                    'passing year', 'when did you graduate', 'graduation date',
                    'year completed', 'finish year', 'year passed'
                ],
                confidence: 0.85
            },
            
            gpa: {
                patterns: [
                    'gpa', 'grade point average', 'cgpa', 'percentage', 'marks',
                    'grades', 'academic performance', 'score', 'grade'
                ],
                confidence: 0.90
            },
            
            // ==================== LEGAL & COMPLIANCE ====================
            gender: {
                patterns: [
                    'gender', 'sex', 'gender identity', 'male', 'female', 'other',
                    'your gender', 'what is your gender', 'gender preference',
                    'gender identification'
                ],
                confidence: 0.95
            },
            
            ethnicity: {
                patterns: [
                    'ethnicity', 'race', 'ethnic background', 'racial background',
                    'ethnic origin', 'racial identity', 'heritage', 'ancestry'
                ],
                confidence: 0.95
            },
            
            veteran_status: {
                patterns: [
                    'veteran', 'military', 'veteran status', 'military service',
                    'served in military', 'armed forces', 'military veteran',
                    'ex-military', 'ex-serviceman'
                ],
                confidence: 0.95
            },
            
            disability: {
                patterns: [
                    'disability', 'disabled', 'disability status', 'accommodation',
                    'special needs', 'accessibility', 'accessibility needs',
                    'require accommodation', 'reasonable accommodation',
                    'physical disability', 'medical condition'
                ],
                confidence: 0.90
            },
            
            criminal_record: {
                patterns: [
                    'criminal record', 'conviction', 'convicted', 'criminal history',
                    'background check', 'ever been convicted', 'criminal background'
                ],
                confidence: 0.95
            },
            
            // ==================== DOCUMENTS ====================
            resume_upload: {
                patterns: [
                    'resume', 'cv', 'curriculum vitae', 'upload resume', 'attach resume',
                    'resume upload', 'cv upload', 'attach cv', 'upload cv', 'resume file',
                    'cv file', 'your resume', 'your cv', 'resume attachment',
                    'upload your resume', 'resume document'
                ],
                confidence: 0.95
            },
            
            cover_letter_upload: {
                patterns: [
                    'cover letter upload', 'upload cover letter', 'attach cover letter',
                    'cover letter file', 'cover letter document', 'upload letter'
                ],
                confidence: 0.95
            },
            
            transcript: {
                patterns: [
                    'transcript', 'academic transcript', 'transcripts', 'marksheet',
                    'mark sheet', 'grade sheet', 'academic records', 'upload transcript'
                ],
                confidence: 0.95
            },
            
            // ==================== ADDITIONAL ====================
            additional_info: {
                patterns: [
                    'additional information', 'additional info', 'anything else',
                    'other information', 'other details', 'comments', 'notes',
                    'anything to add', 'further information', 'extra information',
                    'is there anything else', 'additional comments', 'additional details'
                ],
                confidence: 0.75
            },
            
            start_date_preference: {
                patterns: [
                    'start date', 'joining date', 'available to start', 'can you start',
                    'when can you join', 'earliest start date', 'preferred start date',
                    'when available', 'start availability', 'joining availability'
                ],
                confidence: 0.85
            }
        };
    }

    /**
     * Classify a field's semantic intent
     */
    classify(field) {
        const label = (field.label + ' ' + field.placeholder + ' ' + field.ariaLabel).toLowerCase();
        
        let bestMatch = null;
        let bestConfidence = 0;

        for (const [intent, config] of Object.entries(this.intentPatterns)) {
            for (const pattern of config.patterns) {
                const confidence = this.calculateSimilarity(label, pattern);
                
                if (confidence > bestConfidence) {
                    bestConfidence = confidence;
                    bestMatch = {
                        intent,
                        confidence: confidence * config.confidence,
                        matchedPattern: pattern
                    };
                }
            }
        }

        // Return best match or unknown
        if (bestMatch && bestMatch.confidence > 0.6) {
            return bestMatch;
        }

        return {
            intent: 'unknown',
            confidence: 0,
            matchedPattern: null,
            originalLabel: field.label
        };
    }

    /**
     * Calculate similarity between label and pattern
     */
    calculateSimilarity(label, pattern) {
        // Exact substring match
        if (label.includes(pattern)) {
            return 0.95;
        }

        // Word-based matching
        const labelWords = label.split(/[\s\-_/]+/).filter(w => w.length > 0);
        const patternWords = pattern.split(/[\s\-_/]+/).filter(w => w.length > 0);

        const labelSet = new Set(labelWords);
        const patternSet = new Set(patternWords);

        const intersection = [...labelSet].filter(word => patternSet.has(word)).length;
        const union = new Set([...labelSet, ...patternSet]).size;

        if (union === 0) return 0;

        return intersection / union;
    }
}


/**
 * Intelligent Option Matcher - Chooses best option from dropdowns
 */
class IntelligentOptionMatcher {
    constructor() {
        this.learningEngine = null; // Will be set by AUE
    }

    /**
     * Find best matching option for a field
     */
    async findBestMatch(field, profile, context = {}) {
        const { options, semanticIntent } = field;
        
        if (!options || options.length === 0) {
            return null;
        }

        // Get user value from profile
        const userValue = this.getUserValue(semanticIntent.intent, profile);
        
        if (!userValue) {
            return null;
        }

        // Check learning engine for previous selection
        const previousSelection = await this.getPreviousSelection(field, userValue);
        if (previousSelection && previousSelection.confidence > 0.8) {
            return previousSelection.option;
        }

        // Try exact match
        const exactMatch = this.findExactMatch(options, userValue);
        if (exactMatch) {
            return exactMatch;
        }

        // Try fuzzy match
        const fuzzyMatch = this.findFuzzyMatch(options, userValue);
        if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
            return fuzzyMatch.option;
        }

        // Use context-aware matching
        const contextMatch = this.findContextualMatch(options, userValue, context);
        if (contextMatch && contextMatch.confidence > 0.6) {
            // Ask user for confirmation if confidence is low
            if (contextMatch.confidence < 0.8) {
                const confirmed = await this.askUserConfirmation(field, contextMatch.option);
                if (confirmed) {
                    await this.saveUserChoice(field, userValue, contextMatch.option);
                    return contextMatch.option;
                }
            }
            return contextMatch.option;
        }

        // If no good match, ask user
        return await this.askUserToSelect(field, options);
    }

    /**
     * Get user value from profile based on intent
     */
    getUserValue(intent, profile) {
        // Map intent to profile field
        const mapping = {
            email: profile.email,
            full_name: profile.full_name,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            address: profile.address,
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
            skills: profile.skills,
            expected_salary: profile.expected_salary,
            notice_period: profile.notice_period,
            work_authorization: profile.work_authorization,
            work_environment: profile.work_environment,
            preferred_location: profile.preferred_location
        };

        return mapping[intent] || null;
    }

    /**
     * Find exact match in options
     */
    findExactMatch(options, userValue) {
        const valueStr = String(userValue).toLowerCase().trim();
        
        for (const option of options) {
            const optionValue = String(option.value).toLowerCase().trim();
            const optionLabel = String(option.label).toLowerCase().trim();
            
            if (optionValue === valueStr || optionLabel === valueStr) {
                return option;
            }
        }
        
        return null;
    }

    /**
     * Find fuzzy match using string similarity
     */
    findFuzzyMatch(options, userValue) {
        const valueStr = String(userValue).toLowerCase().trim();
        let bestMatch = null;
        let bestScore = 0;

        for (const option of options) {
            const optionLabel = String(option.label).toLowerCase().trim();
            
            // Check if option contains user value
            if (optionLabel.includes(valueStr)) {
                const score = valueStr.length / optionLabel.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = option;
                }
            }
            
            // Check if user value contains option
            if (valueStr.includes(optionLabel)) {
                const score = optionLabel.length / valueStr.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = option;
                }
            }
        }

        return bestMatch ? { option: bestMatch, confidence: bestScore } : null;
    }

    /**
     * Find contextual match using job description and other context
     */
    findContextualMatch(options, userValue, context) {
        // For now, use fuzzy match
        // TODO: Implement ML-based contextual matching
        return this.findFuzzyMatch(options, userValue);
    }

    /**
     * Get previous user selection from learning engine
     */
    async getPreviousSelection(field, userValue) {
        if (!this.learningEngine) return null;
        return await this.learningEngine.getPreviousChoice(field, userValue);
    }

    /**
     * Save user choice to learning engine
     */
    async saveUserChoice(field, userValue, selectedOption) {
        if (!this.learningEngine) return;
        await this.learningEngine.saveChoice(field, userValue, selectedOption);
    }

    /**
     * Ask user for confirmation
     */
    async askUserConfirmation(field, suggestedOption) {
        // TODO: Implement UI for user confirmation
        // For now, accept suggestion
        return true;
    }

    /**
     * Ask user to manually select
     */
    async askUserToSelect(field, options) {
        // TODO: Implement UI for manual selection
        // For now, return null (skip field)
        console.log(`[Matcher] ⚠️ Could not auto-select for field: ${field.label}`);
        return null;
    }
}


/**
 * Learning Engine - Learns from user selections and corrections
 */
class LearningEngine {
    constructor() {
        this.storageKey = 'aue_learning_data';
    }

    /**
     * Get previous choice for a field
     */
    async getPreviousChoice(field, userValue) {
        const data = await this.loadLearningData();
        const key = this.generateKey(field.label, field.semanticIntent.intent, userValue);
        
        if (data[key]) {
            return {
                option: data[key].option,
                confidence: data[key].confidence,
                uses: data[key].uses
            };
        }
        
        return null;
    }

    /**
     * Save user choice
     */
    async saveChoice(field, userValue, selectedOption) {
        const data = await this.loadLearningData();
        const key = this.generateKey(field.label, field.semanticIntent.intent, userValue);
        
        if (data[key]) {
            // Increment uses and adjust confidence
            data[key].uses++;
            data[key].confidence = Math.min(0.95, data[key].confidence + 0.05);
        } else {
            // New entry
            data[key] = {
                fieldLabel: field.label,
                intent: field.semanticIntent.intent,
                userValue: userValue,
                option: selectedOption,
                confidence: 0.7,
                uses: 1,
                timestamp: new Date().toISOString()
            };
        }
        
        await this.saveLearningData(data);
    }

    /**
     * Record user correction (when user changes an auto-filled value)
     */
    async recordCorrection(field, oldValue, newValue) {
        const data = await this.loadLearningData();
        const key = this.generateKey(field.label, field.semanticIntent.intent, oldValue);
        
        // Lower confidence for old choice
        if (data[key]) {
            data[key].confidence = Math.max(0.3, data[key].confidence - 0.2);
        }
        
        // Create new entry for corrected value
        await this.saveChoice(field, oldValue, newValue);
    }

    /**
     * Generate unique key for field + value combination
     */
    generateKey(fieldLabel, intent, userValue) {
        const normalized = `${fieldLabel}_${intent}_${userValue}`.toLowerCase().replace(/\s+/g, '_');
        return normalized.substring(0, 100); // Limit length
    }

    /**
     * Load learning data from storage
     */
    async loadLearningData() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || {});
            });
        });
    }

    /**
     * Save learning data to storage
     */
    async saveLearningData(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: data }, resolve);
        });
    }

    /**
     * Export learning data
     */
    async exportData() {
        return await this.loadLearningData();
    }

    /**
     * Clear learning data
     */
    async clearData() {
        await this.saveLearningData({});
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.ApplicationUnderstandingEngine = ApplicationUnderstandingEngine;
    window.PlatformDetector = PlatformDetector;
    window.FieldClassifier = FieldClassifier;
    window.IntelligentOptionMatcher = IntelligentOptionMatcher;
    window.LearningEngine = LearningEngine;
}
