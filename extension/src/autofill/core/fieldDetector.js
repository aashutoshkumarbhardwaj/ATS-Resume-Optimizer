/**
 * Field Detector Module
 * Intelligent field type detection and analysis
 * Supports HTML5 inputs, custom frameworks (React/Vue/Angular), and dynamic forms
 */

class FieldDetector {
    constructor() {
        this.fieldPatterns = this.initializeFieldPatterns();
        this.customFieldPatterns = new Map();
    }

    /**
     * Initialize standard field detection patterns
     */
    initializeFieldPatterns() {
        return {
            // Personal Information
            email: {
                keywords: ['email', 'e-mail', 'contact email', 'email address', 'your email', 'primary email'],
                patterns: [/^email$/i, /email/i, /^mail$/i],
                types: ['email'],
                confidence: 0.95
            },
            phone: {
                keywords: ['phone', 'mobile', 'phone number', 'contact number', 'mobile number', 'telephone'],
                patterns: [/^phone$/i, /^tel$/i, /mobile/i, /telephone/i],
                types: ['tel', 'phone'],
                confidence: 0.90
            },
            firstName: {
                keywords: ['first name', 'given name', 'first', 'firstname', 'forename'],
                patterns: [/^firstName$/i, /^first_name$/i, /firstName/i],
                types: ['text'],
                confidence: 0.85
            },
            lastName: {
                keywords: ['last name', 'family name', 'surname', 'lastname'],
                patterns: [/^lastName$/i, /^last_name$/i, /surname/i],
                types: ['text'],
                confidence: 0.85
            },
            fullName: {
                keywords: ['full name', 'name', 'your name', 'candidate name', 'applicant name'],
                patterns: [/^name$/i, /^fullName$/i, /^full_name$/i],
                types: ['text'],
                confidence: 0.80
            },
            address: {
                keywords: ['address', 'street address', 'mailing address', 'current address', 'street'],
                patterns: [/^address$/i, /^street$/i, /address/i],
                types: ['text', 'textarea'],
                confidence: 0.80
            },
            city: {
                keywords: ['city', 'city name', 'location city', 'municipality'],
                patterns: [/^city$/i, /city/i],
                types: ['text'],
                confidence: 0.75
            },
            state: {
                keywords: ['state', 'province', 'region', 'state/province', 'province/state'],
                patterns: [/^state$/i, /^province$/i, /state|province/i],
                types: ['text', 'select'],
                confidence: 0.75
            },
            zipCode: {
                keywords: ['zip', 'postal code', 'zip code', 'postcode', 'post code'],
                patterns: [/^zip$/i, /^postal/i, /zip|postcode/i],
                types: ['text'],
                confidence: 0.80
            },
            country: {
                keywords: ['country', 'country of residence', 'nationality'],
                patterns: [/^country$/i, /country/i, /nationality/i],
                types: ['text', 'select'],
                confidence: 0.80
            },
            
            // Professional Information
            currentCompany: {
                keywords: ['company', 'current company', 'employer', 'current employer', 'organization'],
                patterns: [/^company$/i, /^currentCompany$/i, /employer/i],
                types: ['text'],
                confidence: 0.85
            },
            jobTitle: {
                keywords: ['job title', 'current position', 'title', 'position', 'designation'],
                patterns: [/^jobTitle$/i, /^job_title$/i, /position|title/i],
                types: ['text'],
                confidence: 0.85
            },
            yearsExperience: {
                keywords: ['years of experience', 'experience', 'years exp', 'years', 'experience level'],
                patterns: [/^experience$/i, /^years/i, /experienceLevel/i],
                types: ['number', 'select', 'text'],
                confidence: 0.80
            },
            expectedSalary: {
                keywords: ['salary', 'expected salary', 'desired salary', 'compensation', 'ctc'],
                patterns: [/^salary$/i, /salary|compensation|ctc/i],
                types: ['text', 'number'],
                confidence: 0.75
            },
            noticePeriod: {
                keywords: ['notice', 'notice period', 'availability', 'available from'],
                patterns: [/^notice/i, /availability/i],
                types: ['select', 'text'],
                confidence: 0.70
            },
            
            // Education
            education: {
                keywords: ['education', 'university', 'college', 'school', 'institution'],
                patterns: [/^education$/i, /^school$/i, /university|college/i],
                types: ['text'],
                confidence: 0.80
            },
            degree: {
                keywords: ['degree', 'qualification', 'qualification level'],
                patterns: [/^degree$/i, /degree/i],
                types: ['select', 'text'],
                confidence: 0.75
            },
            major: {
                keywords: ['major', 'field of study', 'specialization', 'subject'],
                patterns: [/^major$/i, /major|field/i],
                types: ['text'],
                confidence: 0.75
            },
            gpa: {
                keywords: ['gpa', 'grade', 'score', 'cgpa'],
                patterns: [/^gpa$/i, /^cgpa$/i, /gpa|grade/i],
                types: ['number', 'text'],
                confidence: 0.70
            },
            graduationYear: {
                keywords: ['graduation', 'graduation year', 'passing year', 'expected graduation'],
                patterns: [/^graduation/i, /graduation|passing/i],
                types: ['number', 'date', 'select'],
                confidence: 0.75
            },
            
            // Links & URLs
            linkedIn: {
                keywords: ['linkedin', 'linkedin profile', 'linkedin url', 'linkedin link'],
                patterns: [/^linkedin$/i, /linkedin/i],
                types: ['url', 'text'],
                confidence: 0.90
            },
            github: {
                keywords: ['github', 'github profile', 'github url', 'github link'],
                patterns: [/^github$/i, /github/i],
                types: ['url', 'text'],
                confidence: 0.90
            },
            portfolio: {
                keywords: ['portfolio', 'portfolio url', 'portfolio link', 'portfolio website'],
                patterns: [/^portfolio$/i, /portfolio/i],
                types: ['url', 'text'],
                confidence: 0.85
            },
            website: {
                keywords: ['website', 'personal website', 'your website', 'web link'],
                patterns: [/^website$/i, /website/i],
                types: ['url', 'text'],
                confidence: 0.80
            },
            resumeUrl: {
                keywords: ['resume', 'resume url', 'resume link', 'cv'],
                patterns: [/^resume$/i, /^cv$/i, /resume|cv/i],
                types: ['url', 'text', 'file'],
                confidence: 0.85
            },
            
            // Cover Letter & Summary
            summary: {
                keywords: ['summary', 'cover letter', 'about', 'about you', 'bio', 'introduction'],
                patterns: [/^summary$/i, /^coverLetter$/i, /summary|about|bio/i],
                types: ['textarea'],
                confidence: 0.75
            },
            coverLetter: {
                keywords: ['cover letter', 'cover', 'letter', 'motivation letter'],
                patterns: [/^coverLetter$/i, /^cover_letter$/i, /cover.*letter/i],
                types: ['textarea', 'file'],
                confidence: 0.80
            },
            
            // Work Authorization
            workAuthorization: {
                keywords: ['work authorization', 'authorized', 'eligible to work', 'visa'],
                patterns: [/^workAuth/i, /authorization|eligible/i],
                types: ['select', 'radio', 'checkbox'],
                confidence: 0.70
            },
            visaStatus: {
                keywords: ['visa', 'visa status', 'visa type'],
                patterns: [/^visa/i, /visa/i],
                types: ['select', 'text'],
                confidence: 0.75
            },
            
            // File Uploads
            resumeFile: {
                keywords: ['resume', 'resume file', 'upload resume', 'cv', 'cv file'],
                patterns: [/^resume/i, /^cv$/i, /resume.*file|upload.*resume/i],
                types: ['file'],
                confidence: 0.90
            },
            coverLetterFile: {
                keywords: ['cover letter', 'cover letter file', 'upload cover letter'],
                patterns: [/^coverLetter/i, /cover.*letter.*file|upload.*cover/i],
                types: ['file'],
                confidence: 0.85
            },
            portfolioFile: {
                keywords: ['portfolio', 'portfolio file', 'upload portfolio'],
                patterns: [/^portfolio/i, /portfolio.*file|upload.*portfolio/i],
                types: ['file'],
                confidence: 0.80
            }
        };
    }

    /**
     * Detect field information
     */
    detectField(element) {
        const fieldInfo = {
            element,
            type: this.getFieldType(element),
            name: element.name || element.id || '',
            label: this.extractLabel(element),
            placeholder: element.placeholder || '',
            ariaLabel: element.getAttribute('aria-label') || '',
            ariaDescribedBy: element.getAttribute('aria-describedby') || '',
            isRequired: element.required || element.hasAttribute('aria-required'),
            isVisible: this.isVisible(element),
            isInteractive: this.isInteractive(element),
            dataAttributes: this.extractDataAttributes(element),
            classNames: element.className || ''
        };

        return fieldInfo;
    }

    /**
     * Get field type
     */
    getFieldType(element) {
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'input') {
            return element.type || 'text';
        } else if (tagName === 'textarea') {
            return 'textarea';
        } else if (tagName === 'select') {
            return 'select';
        } else if (element.contentEditable === 'true') {
            return 'contenteditable';
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
            if (label) {
                return label.textContent.trim();
            }
        }

        // Try aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }

        // Try aria-labelledby
        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement) {
                return labelElement.textContent.trim();
            }
        }

        // Try placeholder
        if (element.placeholder) {
            return element.placeholder;
        }

        // Try nearby label
        let parent = element.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
            const label = parent.querySelector('label');
            if (label) {
                return label.textContent.trim();
            }
            parent = parent.parentElement;
        }

        return '';
    }

    /**
     * Extract data attributes
     */
    extractDataAttributes(element) {
        const data = {};
        for (const attr of element.attributes || []) {
            if (attr.name.startsWith('data-')) {
                data[attr.name.substring(5)] = attr.value;
            }
        }
        return data;
    }

    /**
     * Check if element is visible
     */
    isVisible(element) {
        if (element.type === 'hidden') return false;
        if (element.style.display === 'none') return false;
        if (element.style.visibility === 'hidden') return false;

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * Check if element is interactive
     */
    isInteractive(element) {
        return !element.disabled && !element.readOnly;
    }

    /**
     * Analyze field with pattern matching
     */
    analyzeField(fieldInfo) {
        const fullText = `${fieldInfo.label} ${fieldInfo.placeholder} ${fieldInfo.name}`.toLowerCase();
        
        const detections = [];

        for (const [fieldKey, pattern] of Object.entries(this.fieldPatterns)) {
            let matchScore = 0;

            // Check keywords
            for (const keyword of pattern.keywords) {
                if (fullText.includes(keyword.toLowerCase())) {
                    matchScore += 0.3;
                }
            }

            // Check patterns
            for (const p of pattern.patterns) {
                if (p.test(fieldInfo.name) || p.test(fieldInfo.label)) {
                    matchScore += 0.4;
                }
            }

            // Check type match
            if (pattern.types.includes(fieldInfo.type)) {
                matchScore += 0.3;
            }

            if (matchScore > 0) {
                detections.push({
                    fieldKey,
                    confidence: Math.min(matchScore, pattern.confidence),
                    reasoning: this.generateReasoning(fieldInfo, fieldKey, matchScore)
                });
            }
        }

        // Check custom patterns
        for (const [fieldKey, customPattern] of this.customFieldPatterns) {
            let matchScore = 0;

            if (customPattern.keywords) {
                for (const keyword of customPattern.keywords) {
                    if (fullText.includes(keyword.toLowerCase())) {
                        matchScore += 0.3;
                    }
                }
            }

            if (customPattern.patterns) {
                for (const p of customPattern.patterns) {
                    if (p.test(fieldInfo.name) || p.test(fieldInfo.label)) {
                        matchScore += 0.4;
                    }
                }
            }

            if (matchScore > 0) {
                detections.push({
                    fieldKey,
                    confidence: matchScore,
                    reasoning: `Custom pattern matched for "${fieldKey}"`
                });
            }
        }

        detections.sort((a, b) => b.confidence - a.confidence);
        return detections;
    }

    /**
     * Generate reasoning for detection
     */
    generateReasoning(fieldInfo, fieldKey, score) {
        const reasons = [];

        if (fieldInfo.label) reasons.push(`label="${fieldInfo.label}"`);
        if (fieldInfo.name) reasons.push(`name="${fieldInfo.name}"`);
        if (fieldInfo.type) reasons.push(`type="${fieldInfo.type}"`);
        if (fieldInfo.placeholder) reasons.push(`placeholder="${fieldInfo.placeholder}"`);

        return `Detected as "${fieldKey}" (${Math.round(score * 100)}%) based on: ${reasons.join(', ')}`;
    }

    /**
     * Register custom field pattern
     */
    registerCustomPattern(fieldKey, pattern) {
        this.customFieldPatterns.set(fieldKey, {
            keywords: pattern.keywords || [],
            patterns: pattern.patterns || []
        });
    }

    /**
     * Get all form fields
     */
    getAllFormFields() {
        const fields = [];
        const inputs = document.querySelectorAll('input, textarea, select');

        inputs.forEach((element, index) => {
            const fieldInfo = this.detectField(element);
            
            if (fieldInfo.isVisible && fieldInfo.isInteractive) {
                fields.push({
                    ...fieldInfo,
                    index,
                    uniqueId: element.id || `field_${index}`
                });
            }
        });

        return fields;
    }

    /**
     * Detect field groups (e.g., address components)
     */
    detectFieldGroups() {
        const fields = this.getAllFormFields();
        const groups = new Map();

        fields.forEach(field => {
            const analysis = this.analyzeField(field);
            if (analysis.length > 0) {
                const primaryKey = analysis[0].fieldKey;
                
                if (!groups.has(primaryKey)) {
                    groups.set(primaryKey, []);
                }
                groups.get(primaryKey).push(field);
            }
        });

        return groups;
    }

    /**
     * Check for multi-step forms
     */
    detectMultiStepForm() {
        return {
            hasSteps: !!(
                document.querySelector('[data-step]') ||
                document.querySelector('.step') ||
                document.querySelector('[role="tablist"]') ||
                document.querySelector('.form-step') ||
                document.querySelector('.wizard')
            ),
            currentStep: this.getCurrentFormStep(),
            totalSteps: this.getTotalFormSteps()
        };
    }

    /**
     * Get current form step
     */
    getCurrentFormStep() {
        const stepElement = 
            document.querySelector('[data-step].active') ||
            document.querySelector('.step.active') ||
            document.querySelector('[role="tab"][aria-selected="true"]');

        if (stepElement) {
            const stepNum = stepElement.getAttribute('data-step') || 
                           stepElement.getAttribute('data-index');
            return parseInt(stepNum) || 1;
        }

        return 1;
    }

    /**
     * Get total form steps
     */
    getTotalFormSteps() {
        const steps = 
            document.querySelectorAll('[data-step]').length ||
            document.querySelectorAll('.step').length ||
            document.querySelectorAll('[role="tab"]').length;

        return Math.max(steps, 1);
    }

    /**
     * Check for dynamic form loading
     */
    detectDynamicContent() {
        return {
            hasLoadingIndicators: !!(
                document.querySelector('[role="progressbar"]') ||
                document.querySelector('.spinner') ||
                document.querySelector('.loading') ||
                document.querySelector('[data-loading]')
            ),
            hasLazyLoadedFields: !!document.querySelector('[data-lazy]'),
            hasReactElements: !!document.querySelector('[data-react]') ||
                             !!window.__REACT_VERSION__
        };
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldDetector;
}
