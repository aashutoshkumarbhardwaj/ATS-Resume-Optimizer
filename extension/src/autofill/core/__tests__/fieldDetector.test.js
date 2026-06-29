/**
 * Field Detector Tests
 * Unit tests for intelligent field detection
 */

describe('FieldDetector', () => {
    let fieldDetector;
    let mockElement;

    beforeEach(() => {
        fieldDetector = new FieldDetector();
        
        // Mock DOM element
        mockElement = {
            tagName: 'INPUT',
            type: 'text',
            name: 'email',
            id: 'user-email',
            placeholder: 'Enter your email',
            className: 'form-control',
            disabled: false,
            readOnly: false,
            required: true,
            attributes: [],
            getAttribute: jest.fn((attr) => {
                if (attr === 'aria-label') return 'Email Address';
                if (attr === 'aria-describedby') return 'email-help';
                if (attr === 'data-test') return 'email-field';
                return null;
            }),
            style: { display: 'block', visibility: 'visible' },
            getBoundingClientRect: jest.fn(() => ({
                width: 300, height: 40, top: 0, left: 0
            }))
        };
    });

    describe('detectField', () => {
        it('should detect email field with all properties', () => {
            const field = fieldDetector.detectField(mockElement);

            expect(field).toHaveProperty('type', 'text');
            expect(field).toHaveProperty('name', 'email');
            expect(field).toHaveProperty('placeholder', 'Enter your email');
            expect(field).toHaveProperty('ariaLabel', 'Email Address');
            expect(field).toHaveProperty('isRequired', true);
            expect(field).toHaveProperty('isVisible', true);
            expect(field).toHaveProperty('isInteractive', true);
        });

        it('should extract label from associated label element', () => {
            mockElement.id = 'firstName';
            
            const mockLabel = {
                textContent: '  First Name  ',
                trim: () => 'First Name'
            };

            document.querySelector = jest.fn((selector) => {
                if (selector.includes('label[for')) return mockLabel;
                return null;
            });

            const field = fieldDetector.detectField(mockElement);
            expect(fieldDetector.extractLabel(mockElement)).toBe('First Name');
        });

        it('should use placeholder as label if no explicit label exists', () => {
            mockElement.placeholder = 'john.doe@example.com';
            document.querySelector = jest.fn(() => null);

            const label = fieldDetector.extractLabel(mockElement);
            expect(label).toBe('john.doe@example.com');
        });

        it('should detect field type correctly for email input', () => {
            mockElement.type = 'email';
            const type = fieldDetector.getFieldType(mockElement);
            expect(type).toBe('email');
        });

        it('should detect textarea field type', () => {
            mockElement.tagName = 'TEXTAREA';
            const type = fieldDetector.getFieldType(mockElement);
            expect(type).toBe('textarea');
        });

        it('should detect select field type', () => {
            mockElement.tagName = 'SELECT';
            const type = fieldDetector.getFieldType(mockElement);
            expect(type).toBe('select');
        });

        it('should default to text type for unknown input', () => {
            mockElement.type = undefined;
            const type = fieldDetector.getFieldType(mockElement);
            expect(type).toBe('text');
        });
    });

    describe('isVisible', () => {
        it('should return false for hidden input', () => {
            mockElement.type = 'hidden';
            const visible = fieldDetector.isVisible(mockElement);
            expect(visible).toBe(false);
        });

        it('should return false for display none element', () => {
            mockElement.style.display = 'none';
            const visible = fieldDetector.isVisible(mockElement);
            expect(visible).toBe(false);
        });

        it('should return false for visibility hidden element', () => {
            mockElement.style.visibility = 'hidden';
            const visible = fieldDetector.isVisible(mockElement);
            expect(visible).toBe(false);
        });

        it('should return false for zero-sized element', () => {
            mockElement.getBoundingClientRect.mockReturnValue({
                width: 0, height: 40, top: 0, left: 0
            });
            const visible = fieldDetector.isVisible(mockElement);
            expect(visible).toBe(false);
        });

        it('should return true for visible element', () => {
            const visible = fieldDetector.isVisible(mockElement);
            expect(visible).toBe(true);
        });
    });

    describe('isInteractive', () => {
        it('should return false for disabled element', () => {
            mockElement.disabled = true;
            const interactive = fieldDetector.isInteractive(mockElement);
            expect(interactive).toBe(false);
        });

        it('should return false for readonly element', () => {
            mockElement.readOnly = true;
            const interactive = fieldDetector.isInteractive(mockElement);
            expect(interactive).toBe(false);
        });

        it('should return true for enabled, non-readonly element', () => {
            const interactive = fieldDetector.isInteractive(mockElement);
            expect(interactive).toBe(true);
        });
    });

    describe('analyzeField', () => {
        it('should detect email field by keywords', () => {
            mockElement.label = 'What is your email address?';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            expect(analysis.length).toBeGreaterThan(0);
            expect(analysis[0].fieldKey).toBe('email');
            expect(analysis[0].confidence).toBeGreaterThan(0.8);
        });

        it('should detect phone field by name attribute', () => {
            mockElement.name = 'phone_number';
            mockElement.type = 'tel';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            const phoneMatch = analysis.find(a => a.fieldKey === 'phone');
            expect(phoneMatch).toBeDefined();
            expect(phoneMatch.confidence).toBeGreaterThan(0.7);
        });

        it('should detect LinkedIn URL field', () => {
            mockElement.label = 'LinkedIn Profile';
            mockElement.placeholder = 'https://linkedin.com/in/yourprofile';
            mockElement.type = 'url';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            const linkedinMatch = analysis.find(a => a.fieldKey === 'linkedIn');
            expect(linkedinMatch).toBeDefined();
        });

        it('should detect years of experience field', () => {
            mockElement.label = 'Years of Experience';
            mockElement.type = 'number';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            const expMatch = analysis.find(a => a.fieldKey === 'yearsExperience');
            expect(expMatch).toBeDefined();
        });

        it('should detect resume file upload field', () => {
            mockElement.label = 'Upload Resume';
            mockElement.type = 'file';
            mockElement.name = 'resume';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            const resumeMatch = analysis.find(a => a.fieldKey === 'resumeFile');
            expect(resumeMatch).toBeDefined();
        });

        it('should sort detections by confidence score', () => {
            mockElement.label = 'Email Address';
            mockElement.type = 'email';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            for (let i = 0; i < analysis.length - 1; i++) {
                expect(analysis[i].confidence).toBeGreaterThanOrEqual(analysis[i + 1].confidence);
            }
        });
    });

    describe('registerCustomPattern', () => {
        it('should register and use custom field pattern', () => {
            fieldDetector.registerCustomPattern('hackathons', {
                keywords: ['hackathon', 'competitions', 'contests'],
                patterns: [/hackathon/i, /competition/i]
            });

            mockElement.label = 'Number of Hackathons Attended';
            mockElement.type = 'number';
            const fieldInfo = fieldDetector.detectField(mockElement);
            const analysis = fieldDetector.analyzeField(fieldInfo);

            const hackathonMatch = analysis.find(a => a.fieldKey === 'hackathons');
            expect(hackathonMatch).toBeDefined();
        });

        it('should handle multiple custom patterns', () => {
            fieldDetector.registerCustomPattern('leetcode', {
                keywords: ['leetcode', 'rating'],
                patterns: [/leetcode/i]
            });

            fieldDetector.registerCustomPattern('codeforces', {
                keywords: ['codeforces', 'competitive'],
                patterns: [/codeforces/i]
            });

            expect(fieldDetector.customFieldPatterns.size).toBe(2);
        });
    });

    describe('extractDataAttributes', () => {
        it('should extract data attributes from element', () => {
            mockElement.attributes = [
                { name: 'data-test', value: 'email-field' },
                { name: 'data-required', value: 'true' },
                { name: 'class', value: 'form-control' }
            ];

            const data = fieldDetector.extractDataAttributes(mockElement);
            expect(data).toEqual({
                test: 'email-field',
                required: 'true'
            });
        });

        it('should return empty object for no data attributes', () => {
            mockElement.attributes = [
                { name: 'class', value: 'form-control' },
                { name: 'id', value: 'email' }
            ];

            const data = fieldDetector.extractDataAttributes(mockElement);
            expect(data).toEqual({});
        });
    });

    describe('generateReasoning', () => {
        it('should generate reasoning message for field detection', () => {
            const fieldInfo = {
                label: 'Email Address',
                name: 'email',
                type: 'email',
                placeholder: 'user@example.com'
            };

            const reasoning = fieldDetector.generateReasoning(fieldInfo, 'email', 0.95);
            expect(reasoning).toContain('email');
            expect(reasoning).toContain('95%');
        });

        it('should handle missing field properties in reasoning', () => {
            const fieldInfo = {
                label: '',
                name: '',
                type: 'text',
                placeholder: ''
            };

            const reasoning = fieldDetector.generateReasoning(fieldInfo, 'unknown', 0.5);
            expect(reasoning).toBeDefined();
            expect(reasoning.length).toBeGreaterThan(0);
        });
    });

    describe('detectMultiStepForm', () => {
        it('should detect multi-step form with step indicators', () => {
            document.querySelector = jest.fn((selector) => {
                if (selector.includes('[data-step]')) {
                    return { getAttribute: jest.fn(() => '1') };
                }
                return null;
            });

            const multiStep = fieldDetector.detectMultiStepForm();
            expect(multiStep.hasSteps).toBe(true);
        });

        it('should detect current step correctly', () => {
            document.querySelector = jest.fn((selector) => {
                if (selector.includes('.active')) {
                    return { getAttribute: jest.fn(() => '2') };
                }
                return null;
            });

            document.querySelectorAll = jest.fn((selector) => {
                if (selector.includes('[data-step]')) {
                    return [1, 2, 3]; // 3 steps total
                }
                return [];
            });

            const multiStep = fieldDetector.detectMultiStepForm();
            expect(multiStep.currentStep).toBe(2);
            expect(multiStep.totalSteps).toBe(3);
        });
    });

    describe('detectDynamicContent', () => {
        it('should detect loading indicators', () => {
            document.querySelector = jest.fn((selector) => {
                if (selector.includes('[role="progressbar"]')) {
                    return {};
                }
                return null;
            });

            const dynamic = fieldDetector.detectDynamicContent();
            expect(dynamic.hasLoadingIndicators).toBe(true);
        });

        it('should detect React elements', () => {
            window.__REACT_VERSION__ = '18.0.0';
            const dynamic = fieldDetector.detectDynamicContent();
            expect(dynamic.hasReactElements).toBe(true);
            delete window.__REACT_VERSION__;
        });

        it('should detect lazy-loaded fields', () => {
            document.querySelector = jest.fn((selector) => {
                if (selector.includes('[data-lazy]')) {
                    return {};
                }
                return null;
            });

            const dynamic = fieldDetector.detectDynamicContent();
            expect(dynamic.hasLazyLoadedFields).toBe(true);
        });
    });

    describe('getAllFormFields', () => {
        it('should find all visible form fields', () => {
            const mockInputs = [mockElement];
            document.querySelectorAll = jest.fn(() => mockInputs);

            const fields = fieldDetector.getAllFormFields();
            expect(fields.length).toBeGreaterThan(0);
            expect(fields[0]).toHaveProperty('uniqueId');
            expect(fields[0]).toHaveProperty('index');
        });

        it('should exclude hidden and disabled fields', () => {
            const visibleField = { ...mockElement, style: { display: 'block' } };
            const hiddenField = { ...mockElement, style: { display: 'none' } };

            document.querySelectorAll = jest.fn(() => [visibleField, hiddenField]);

            const fields = fieldDetector.getAllFormFields();
            expect(fields.length).toBe(1);
            expect(fields[0].isVisible).toBe(true);
        });
    });

    describe('detectFieldGroups', () => {
        it('should group related fields together', () => {
            const addressField = {
                label: 'Street Address',
                name: 'address',
                type: 'text',
                isVisible: true,
                isInteractive: true,
                placeholder: ''
            };

            const cityField = {
                label: 'City',
                name: 'city',
                type: 'text',
                isVisible: true,
                isInteractive: true,
                placeholder: ''
            };

            fieldDetector.getAllFormFields = jest.fn(() => [addressField, cityField]);

            const groups = fieldDetector.detectFieldGroups();
            expect(groups.size).toBeGreaterThan(0);
        });
    });
});
