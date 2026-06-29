/**
 * Universal Autofill Engine
 * Core autofill logic with support for multiple job platforms
 * Handles field detection, mapping, and intelligent filling
 */

class AutofillEngine {
    constructor() {
        this.fieldDetectors = new Map();
        this.platformAdapters = new Map();
        this.fieldConfidenceThreshold = 0.7; // Minimum confidence to auto-fill
        this.detectedFields = [];
        this.filledFields = [];
        this.skippedFields = [];
        this.mode = 'quick'; // 'quick', 'review', 'selective'
        this.progressCallback = null;
        this.eventBus = this.createEventBus();
    }

    /**
     * Initialize autofill engine with platform adapters
     */
    registerPlatformAdapter(platformName, adapter) {
        this.platformAdapters.set(platformName.toLowerCase(), adapter);
    }

    /**
     * Detect current platform
     */
    async detectPlatform() {
        const url = window.location.href;
        const hostname = window.location.hostname;

        const platforms = [
            { name: 'linkedin', pattern: /linkedin\.com/i },
            { name: 'greenhouse', pattern: /greenhouse\.io/i },
            { name: 'lever', pattern: /lever\.co|jobs\.lever\.co/i },
            { name: 'workday', pattern: /workday\.com|myworkday/i },
            { name: 'ashby', pattern: /ashby\.recruitment|jobs\.ashby/i },
            { name: 'smartrecruiters', pattern: /smartrecruiters\.com/i },
            { name: 'taleo', pattern: /taleo\.net|careers\.taleo/i },
            { name: 'bamboohr', pattern: /bamboohr\.com|jobs\.bamboohr/i },
            { name: 'rippling', pattern: /rippling\.com/i },
            { name: 'oracle', pattern: /oracle\.com.*careers/i },
            { name: 'sap', pattern: /sap\.com.*careers|careers\.sap/i },
            { name: 'icims', pattern: /icims\.com|ats\.icims/i },
            { name: 'indeed', pattern: /indeed\.com/i },
            { name: 'naukri', pattern: /naukri\.com/i },
            { name: 'foundit', pattern: /foundit\.in/i },
            { name: 'wellfound', pattern: /wellfound\.com/i },
            { name: 'google-forms', pattern: /docs\.google\.com\/forms/i }
        ];

        for (const platform of platforms) {
            if (platform.pattern.test(url)) {
                return platform.name;
            }
        }

        return 'generic';
    }

    /**
     * Main autofill function
     */
    async autofill(profile, options = {}) {
        try {
            this.reportProgress('Detecting platform...');
            const platform = await this.detectPlatform();

            this.reportProgress('Detecting form fields...');
            const fields = await this.detectFormFields();

            this.reportProgress('Matching profile data...');
            const matches = await this.matchFieldsToProfile(fields, profile);

            this.reportProgress('Processing fields...');
            await this.processFields(matches, profile, platform);

            const result = {
                platform,
                totalFields: fields.length,
                filledFields: this.filledFields.length,
                skippedFields: this.skippedFields.length,
                summary: this.generateSummary()
            };

            this.reportProgress(`Completed: Filled ${result.filledFields} of ${result.totalFields} fields`);
            return result;
        } catch (error) {
            console.error('Autofill error:', error);
            throw error;
        }
    }

    /**
     * Detect all form fields on page
     */
    async detectFormFields() {
        await this.waitForDomStable();

        const fields = [];
        const inputs = document.querySelectorAll('input, textarea, select');

        inputs.forEach((element, index) => {
            if (this.isVisibleAndInteractive(element)) {
                const field = {
                    id: element.id || `field_${index}`,
                    element,
                    type: this.detectFieldType(element),
                    label: this.extractLabel(element),
                    placeholder: element.placeholder || '',
                    ariaLabel: element.getAttribute('aria-label') || '',
                    name: element.name || '',
                    value: element.value || '',
                    nearbyText: this.getNearbyText(element),
                    isRequired: element.required || element.hasAttribute('aria-required'),
                    detectContext: {
                        tagName: element.tagName,
                        className: element.className,
                        dataset: element.dataset
                    }
                };

                fields.push(field);
            }
        });

        return fields;
    }

    /**
     * Detect field type
     */
    detectFieldType(element) {
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'input') {
            return element.type || 'text';
        } else if (tagName === 'textarea') {
            return 'textarea';
        } else if (tagName === 'select') {
            return 'select';
        }

        return 'unknown';
    }

    /**
     * Extract label for field
     */
    extractLabel(element) {
        // Try associated label
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }

        // Try aria-label
        if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
        }

        // Try placeholder
        if (element.placeholder) {
            return element.placeholder;
        }

        // Try nearby text
        return this.getNearbyText(element);
    }

    /**
     * Get nearby text for context
     */
    getNearbyText(element) {
        const texts = [];
        let parent = element.parentElement;

        for (let i = 0; i < 3 && parent; i++) {
            const text = parent.textContent
                .substring(0, 200)
                .split('\n')
                .map(t => t.trim())
                .filter(t => t)
                .slice(0, 3)
                .join(' ');
            
            if (text) texts.push(text);
            parent = parent.parentElement;
        }

        return texts.join(' ');
    }

    /**
     * Check if element is visible and interactive
     */
    isVisibleAndInteractive(element) {
        if (element.type === 'hidden' || element.style.display === 'none') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * Match detected fields to profile data
     */
    async matchFieldsToProfile(fields, profile) {
        const matches = [];

        for (const field of fields) {
            const candidate = await this.findBestMatch(field, profile);
            
            if (candidate) {
                matches.push({
                    field,
                    profileKey: candidate.key,
                    profileValue: candidate.value,
                    confidence: candidate.confidence,
                    reasoning: candidate.reasoning
                });
            }
        }

        return matches;
    }

    /**
     * Find best matching profile data for field
     */
    async findBestMatch(field, profile) {
        const candidates = [];

        // Semantic matching
        const semanticMatch = this.performSemanticMatching(field, profile);
        if (semanticMatch) candidates.push(semanticMatch);

        // Name attribute matching
        const nameMatch = this.matchByName(field.name, profile);
        if (nameMatch) candidates.push(nameMatch);

        // Label matching
        const labelMatch = this.matchByLabel(field.label, profile);
        if (labelMatch) candidates.push(labelMatch);

        // Type-based matching
        const typeMatch = this.matchByType(field.type, profile);
        if (typeMatch) candidates.push(typeMatch);

        // Return best match
        if (candidates.length === 0) return null;

        candidates.sort((a, b) => b.confidence - a.confidence);
        return candidates[0];
    }

    /**
     * Perform semantic matching
     */
    performSemanticMatching(field, profile) {
        const fieldText = `${field.label} ${field.placeholder} ${field.name}`.toLowerCase();
        
        const mappings = {
            email: ['email', 'e-mail', 'contact email', 'email address', 'your email'],
            phone: ['phone', 'mobile', 'phone number', 'contact number', 'mobile number'],
            firstName: ['first name', 'given name', 'first', 'firstname'],
            lastName: ['last name', 'family name', 'surname', 'lastname'],
            fullName: ['full name', 'name', 'your name', 'candidate name'],
            address: ['address', 'street address', 'mailing address', 'current address'],
            city: ['city', 'city name', 'location city'],
            state: ['state', 'province', 'region', 'state/province'],
            zipCode: ['zip', 'postal code', 'zip code', 'postcode'],
            country: ['country', 'country of residence'],
            linkedin: ['linkedin', 'linkedin profile', 'linkedin url'],
            github: ['github', 'github profile', 'github url'],
            website: ['website', 'portfolio', 'personal website', 'your website'],
            currentCompany: ['company', 'current company', 'employer', 'current employer'],
            jobTitle: ['job title', 'current position', 'title', 'position'],
            yearsExperience: ['years of experience', 'experience', 'years exp'],
            education: ['education', 'university', 'college', 'school'],
            degree: ['degree', 'qualification'],
            major: ['major', 'field of study', 'specialization'],
            gpa: ['gpa', 'grade', 'score'],
            summary: ['summary', 'cover letter', 'about', 'about you']
        };

        for (const [key, keywords] of Object.entries(mappings)) {
            for (const keyword of keywords) {
                if (fieldText.includes(keyword)) {
                    const value = this.getProfileValue(profile, key);
                    if (value) {
                        return {
                            key,
                            value,
                            confidence: 0.95,
                            reasoning: `Matched by semantic "${keyword}"`
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Match by name attribute
     */
    matchByName(name, profile) {
        if (!name) return null;

        const nameLower = name.toLowerCase();
        const directMatches = {
            'email': profile.email,
            'phone': profile.phone,
            'firstname': profile.firstName,
            'lastname': profile.lastName,
            'fullname': profile.fullName,
            'address': profile.address,
            'city': profile.city,
            'state': profile.state,
            'zipcode': profile.zipCode,
            'country': profile.country,
            'company': profile.currentCompany,
            'jobtitle': profile.jobTitle
        };

        for (const [key, value] of Object.entries(directMatches)) {
            if (nameLower.includes(key) || nameLower === key) {
                if (value) {
                    return {
                        key,
                        value,
                        confidence: 0.85,
                        reasoning: `Matched by name attribute "${name}"`
                    };
                }
            }
        }

        return null;
    }

    /**
     * Match by label
     */
    matchByLabel(label, profile) {
        return this.performSemanticMatching({ label, name: '', placeholder: '' }, profile);
    }

    /**
     * Match by field type
     */
    matchByType(type, profile) {
        const typeMatches = {
            'email': profile.email,
            'tel': profile.phone,
            'url': profile.website,
            'date': profile.graduationYear,
            'number': profile.yearsExperience
        };

        if (typeMatches[type]) {
            return {
                key: type,
                value: typeMatches[type],
                confidence: 0.6,
                reasoning: `Matched by input type "${type}"`
            };
        }

        return null;
    }

    /**
     * Get profile value by key
     */
    getProfileValue(profile, key) {
        const mapping = {
            email: profile.email,
            phone: profile.phone,
            firstName: profile.firstName,
            lastName: profile.lastName,
            fullName: profile.fullName,
            address: profile.address,
            city: profile.city,
            state: profile.state,
            zipCode: profile.zipCode,
            country: profile.country,
            linkedin: profile.linkedIn,
            github: profile.github,
            website: profile.website,
            currentCompany: profile.currentCompany,
            jobTitle: profile.jobTitle,
            yearsExperience: profile.yearsOfExperience,
            education: profile.university,
            degree: profile.degree,
            major: profile.major,
            gpa: profile.gpa,
            summary: profile.summary
        };

        return mapping[key] || null;
    }

    /**
     * Process and fill matched fields
     */
    async processFields(matches, profile, platform) {
        for (const match of matches) {
            if (match.confidence >= this.fieldConfidenceThreshold) {
                await this.fillField(match, platform);
            }
        }
    }

    /**
     * Fill individual field
     */
    async fillField(match, platform) {
        try {
            const { field, profileValue } = match;
            const adapter = this.platformAdapters.get(platform);

            if (adapter && adapter.fillField) {
                await adapter.fillField(field.element, profileValue);
            } else {
                await this.defaultFillField(field.element, profileValue);
            }

            this.filledFields.push(match);
            this.triggerFieldEvents(field.element);
        } catch (error) {
            console.warn(`Failed to fill field: ${match.field.label}`, error);
            this.skippedFields.push(match);
        }
    }

    /**
     * Default field filling logic
     */
    async defaultFillField(element, value) {
        if (element.tagName === 'SELECT') {
            // Handle select dropdowns
            const options = Array.from(element.options);
            const option = options.find(o => 
                o.textContent.toLowerCase().includes(String(value).toLowerCase()) ||
                o.value === value
            );
            if (option) {
                element.value = option.value;
            }
        } else if (element.tagName === 'TEXTAREA') {
            element.value = value;
        } else if (element.type === 'checkbox') {
            element.checked = Boolean(value);
        } else if (element.type === 'radio') {
            const matching = document.querySelector(`input[name="${element.name}"][value="${value}"]`);
            if (matching) matching.checked = true;
        } else {
            element.value = value;
        }

        // Update element for React compatibility
        this.notifyReactElement(element, value);
    }

    /**
     * Notify React of value change
     */
    notifyReactElement(element, value) {
        // Trigger React's internal state update
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);

        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
    }

    /**
     * Trigger field events for framework compatibility
     */
    triggerFieldEvents(element) {
        const events = ['focus', 'input', 'change', 'blur'];
        
        events.forEach(eventName => {
            const event = new Event(eventName, { bubbles: true });
            element.dispatchEvent(event);
        });
    }

    /**
     * Wait for DOM to stabilize
     */
    async waitForDomStable(timeout = 2000) {
        return new Promise(resolve => {
            let lastMutationTime = Date.now();
            let checkInterval;

            const observer = new MutationObserver(() => {
                lastMutationTime = Date.now();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            checkInterval = setInterval(() => {
                const timeSinceLastMutation = Date.now() - lastMutationTime;
                if (timeSinceLastMutation > 500) {
                    clearInterval(checkInterval);
                    observer.disconnect();
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                observer.disconnect();
                resolve();
            }, timeout);
        });
    }

    /**
     * Generate summary of autofill operation
     */
    generateSummary() {
        return {
            filled: this.filledFields.length,
            skipped: this.skippedFields.length,
            details: {
                filledFields: this.filledFields.map(f => f.field.label),
                skippedFields: this.skippedFields.map(f => f.field.label)
            }
        };
    }

    /**
     * Report progress
     */
    reportProgress(message) {
        if (this.progressCallback) {
            this.progressCallback(message);
        }
    }

    /**
     * Create event bus for communication
     */
    createEventBus() {
        return {
            listeners: new Map(),
            on: (event, callback) => {
                if (!this.listeners.has(event)) {
                    this.listeners.set(event, []);
                }
                this.listeners.get(event).push(callback);
            },
            off: (event, callback) => {
                if (this.listeners.has(event)) {
                    const callbacks = this.listeners.get(event);
                    const index = callbacks.indexOf(callback);
                    if (index > -1) callbacks.splice(index, 1);
                }
            },
            emit: (event, data) => {
                if (this.listeners.has(event)) {
                    this.listeners.get(event).forEach(callback => callback(data));
                }
            }
        };
    }

    /**
     * Set autofill mode
     */
    setMode(mode) {
        if (['quick', 'review', 'selective'].includes(mode)) {
            this.mode = mode;
        }
    }

    /**
     * Set progress callback
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
}

module.exports = AutofillEngine;
