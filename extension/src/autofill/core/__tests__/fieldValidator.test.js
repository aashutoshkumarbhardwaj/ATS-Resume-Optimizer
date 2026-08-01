/**
 * Field Validator Tests
 * Unit tests for input validation
 */

describe('FieldValidator', () => {
    let validator;

    beforeEach(() => {
        validator = new FieldValidator();
    });

    describe('validateEmail', () => {
        it('should validate correct email addresses', () => {
            const result = validator.validateEmail('john.doe@example.com');
            expect(result.valid).toBe(true);
        });

        it('should reject email without @ symbol', () => {
            const result = validator.validateEmail('johndoe.example.com');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid');
        });

        it('should reject empty email', () => {
            const result = validator.validateEmail('');
            expect(result.valid).toBe(false);
        });

        it('should reject email longer than 254 characters', () => {
            const longEmail = 'a'.repeat(250) + '@example.com';
            const result = validator.validateEmail(longEmail);
            expect(result.valid).toBe(false);
        });

        it('should accept email with subdomain', () => {
            const result = validator.validateEmail('user@mail.example.co.uk');
            expect(result.valid).toBe(true);
        });

        it('should accept email with plus addressing', () => {
            const result = validator.validateEmail('user+tag@example.com');
            expect(result.valid).toBe(true);
        });
    });

    describe('validatePhone', () => {
        it('should validate US phone number', () => {
            const result = validator.validatePhone('555-123-4567', 'US');
            expect(result.valid).toBe(true);
        });

        it('should validate US phone with country code', () => {
            const result = validator.validatePhone('+1-555-123-4567', 'US');
            expect(result.valid).toBe(true);
        });

        it('should validate India phone number', () => {
            const result = validator.validatePhone('+91-9876543210', 'India');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid US phone', () => {
            const result = validator.validatePhone('123', 'US');
            expect(result.valid).toBe(false);
        });

        it('should validate UK phone number', () => {
            const result = validator.validatePhone('+44-20-7946-0958', 'UK');
            expect(result.valid).toBe(true);
        });

        it('should fallback to basic validation for unknown country', () => {
            const result = validator.validatePhone('123-456-7890', 'UnknownCountry');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid phone for unknown country', () => {
            const result = validator.validatePhone('abc', 'UnknownCountry');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateUrl', () => {
        it('should validate correct URLs', () => {
            const result = validator.validateUrl('https://example.com');
            expect(result.valid).toBe(true);
        });

        it('should validate URLs with paths', () => {
            const result = validator.validateUrl('https://example.com/path/to/page');
            expect(result.valid).toBe(true);
        });

        it('should validate LinkedIn URLs', () => {
            const result = validator.validateUrl('https://linkedin.com/in/johndoe');
            expect(result.valid).toBe(true);
        });

        it('should validate GitHub URLs', () => {
            const result = validator.validateUrl('https://github.com/johndoe');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid URLs', () => {
            const result = validator.validateUrl('not a url');
            expect(result.valid).toBe(false);
        });

        it('should reject empty URL', () => {
            const result = validator.validateUrl('');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateDate', () => {
        it('should validate valid date string', () => {
            const result = validator.validateDate('2020-06-15');
            expect(result.valid).toBe(true);
            expect(result.date).toBeInstanceOf(Date);
        });

        it('should validate date object', () => {
            const date = new Date('2020-06-15');
            const result = validator.validateDate(date);
            expect(result.valid).toBe(true);
        });

        it('should validate timestamp', () => {
            const timestamp = new Date('2020-06-15').getTime();
            const result = validator.validateDate(timestamp);
            expect(result.valid).toBe(true);
        });

        it('should reject invalid date string', () => {
            const result = validator.validateDate('not-a-date');
            expect(result.valid).toBe(false);
        });

        it('should reject empty date', () => {
            const result = validator.validateDate('');
            expect(result.valid).toBe(false);
        });
    });

    describe('validatePostalCode', () => {
        it('should validate US zip code', () => {
            const result = validator.validatePostalCode('12345', 'US');
            expect(result.valid).toBe(true);
        });

        it('should validate US zip+4 code', () => {
            const result = validator.validatePostalCode('12345-6789', 'US');
            expect(result.valid).toBe(true);
        });

        it('should validate UK postcode', () => {
            const result = validator.validatePostalCode('SW1A 1AA', 'UK');
            expect(result.valid).toBe(true);
        });

        it('should validate Canada postal code', () => {
            const result = validator.validatePostalCode('K1A 0B1', 'Canada');
            expect(result.valid).toBe(true);
        });

        it('should validate India pin code', () => {
            const result = validator.validatePostalCode('110001', 'India');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid zip code', () => {
            const result = validator.validatePostalCode('abc', 'US');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateYearsExperience', () => {
        it('should validate valid experience year', () => {
            const result = validator.validateYearsExperience(5);
            expect(result.valid).toBe(true);
        });

        it('should accept 0 years', () => {
            const result = validator.validateYearsExperience(0);
            expect(result.valid).toBe(true);
        });

        it('should accept maximum 70 years', () => {
            const result = validator.validateYearsExperience(70);
            expect(result.valid).toBe(true);
        });

        it('should reject negative years', () => {
            const result = validator.validateYearsExperience(-1);
            expect(result.valid).toBe(false);
        });

        it('should reject years over 70', () => {
            const result = validator.validateYearsExperience(71);
            expect(result.valid).toBe(false);
        });

        it('should reject non-numeric years', () => {
            const result = validator.validateYearsExperience('abc');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateGPA', () => {
        it('should validate valid GPA', () => {
            const result = validator.validateGPA(3.8);
            expect(result.valid).toBe(true);
        });

        it('should accept 0 GPA', () => {
            const result = validator.validateGPA(0);
            expect(result.valid).toBe(true);
        });

        it('should accept perfect 4.0 GPA', () => {
            const result = validator.validateGPA(4.0);
            expect(result.valid).toBe(true);
        });

        it('should reject GPA over 4.0', () => {
            const result = validator.validateGPA(4.1);
            expect(result.valid).toBe(false);
        });

        it('should reject negative GPA', () => {
            const result = validator.validateGPA(-0.5);
            expect(result.valid).toBe(false);
        });

        it('should accept string GPA', () => {
            const result = validator.validateGPA('3.5');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateSalary', () => {
        it('should validate numeric salary', () => {
            const result = validator.validateSalary(100000);
            expect(result.valid).toBe(true);
        });

        it('should validate salary with currency symbol', () => {
            const result = validator.validateSalary('$100,000');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(100000);
        });

        it('should validate salary with currency codes', () => {
            const result = validator.validateSalary('₹25,00,000');
            expect(result.valid).toBe(true);
        });

        it('should reject zero salary', () => {
            const result = validator.validateSalary(0);
            expect(result.valid).toBe(false);
        });

        it('should reject unusually high salary', () => {
            const result = validator.validateSalary(1000000000);
            expect(result.valid).toBe(false);
        });

        it('should reject negative salary', () => {
            const result = validator.validateSalary(-50000);
            expect(result.valid).toBe(false);
        });
    });

    describe('validateGraduationYear', () => {
        it('should validate valid graduation year', () => {
            const result = validator.validateGraduationYear(2020);
            expect(result.valid).toBe(true);
        });

        it('should accept current year', () => {
            const currentYear = new Date().getFullYear();
            const result = validator.validateGraduationYear(currentYear);
            expect(result.valid).toBe(true);
        });

        it('should accept future year within 10 years', () => {
            const futureYear = new Date().getFullYear() + 5;
            const result = validator.validateGraduationYear(futureYear);
            expect(result.valid).toBe(true);
        });

        it('should reject year before 1950', () => {
            const result = validator.validateGraduationYear(1949);
            expect(result.valid).toBe(false);
        });

        it('should reject year too far in future', () => {
            const futureYear = new Date().getFullYear() + 15;
            const result = validator.validateGraduationYear(futureYear);
            expect(result.valid).toBe(false);
        });

        it('should accept historical year', () => {
            const result = validator.validateGraduationYear(2000);
            expect(result.valid).toBe(true);
        });
    });

    describe('validateFile', () => {
        it('should validate PDF file', () => {
            const file = {
                type: 'application/pdf',
                size: 1024 * 1024 // 1MB
            };
            const result = validator.validateFile(file);
            expect(result.valid).toBe(true);
        });

        it('should reject unsupported file type', () => {
            const file = {
                type: 'application/exe',
                size: 1024 * 1024
            };
            const result = validator.validateFile(file);
            expect(result.valid).toBe(false);
        });

        it('should reject oversized file', () => {
            const file = {
                type: 'application/pdf',
                size: 20 * 1024 * 1024 // 20MB
            };
            const result = validator.validateFile(file, { maxSize: 10 * 1024 * 1024 });
            expect(result.valid).toBe(false);
        });

        it('should accept custom allowed types', () => {
            const file = {
                type: 'image/png',
                size: 512 * 1024
            };
            const result = validator.validateFile(file, { 
                allowedTypes: ['image/png', 'image/jpg'] 
            });
            expect(result.valid).toBe(true);
        });
    });

    describe('validateRequired', () => {
        it('should accept non-empty string', () => {
            const result = validator.validateRequired('value');
            expect(result.valid).toBe(true);
        });

        it('should reject empty string', () => {
            const result = validator.validateRequired('');
            expect(result.valid).toBe(false);
        });

        it('should reject null', () => {
            const result = validator.validateRequired(null);
            expect(result.valid).toBe(false);
        });

        it('should reject undefined', () => {
            const result = validator.validateRequired(undefined);
            expect(result.valid).toBe(false);
        });

        it('should accept zero as valid', () => {
            const result = validator.validateRequired(0);
            expect(result.valid).toBe(true);
        });
    });

    describe('validateText', () => {
        it('should validate text within constraints', () => {
            const result = validator.validateText('hello world', { minLength: 5, maxLength: 20 });
            expect(result.valid).toBe(true);
        });

        it('should reject text too short', () => {
            const result = validator.validateText('hi', { minLength: 5 });
            expect(result.valid).toBe(false);
        });

        it('should reject text too long', () => {
            const result = validator.validateText('a'.repeat(1001), { maxLength: 1000 });
            expect(result.valid).toBe(false);
        });
    });

    describe('sanitizeInput', () => {
        it('should remove HTML tags', () => {
            const result = validator.sanitizeInput('<script>alert("xss")</script>');
            expect(result).not.toContain('<');
            expect(result).not.toContain('>');
        });

        it('should remove quotes', () => {
            const result = validator.sanitizeInput('test"value\'quote');
            expect(result).not.toContain('"');
            expect(result).not.toContain("'");
        });

        it('should trim whitespace', () => {
            const result = validator.sanitizeInput('  hello world  ');
            expect(result).toBe('hello world');
        });
    });

    describe('checkSuspiciousPatterns', () => {
        it('should detect script tag', () => {
            const isSuspicious = validator.checkSuspiciousPatterns('<script>code</script>');
            expect(isSuspicious).toBe(true);
        });

        it('should detect javascript protocol', () => {
            const isSuspicious = validator.checkSuspiciousPatterns('javascript:alert(1)');
            expect(isSuspicious).toBe(true);
        });

        it('should detect onerror handler', () => {
            const isSuspicious = validator.checkSuspiciousPatterns('onerror=alert(1)');
            expect(isSuspicious).toBe(true);
        });

        it('should not flag normal text', () => {
            const isSuspicious = validator.checkSuspiciousPatterns('normal text');
            expect(isSuspicious).toBe(false);
        });
    });

    describe('validateProfile', () => {
        it('should validate profile with schema', () => {
            const profile = {
                email: 'john@example.com',
                phone: '555-123-4567'
            };

            const schema = {
                required: ['email'],
                fields: {
                    email: { type: 'email' },
                    phone: { type: 'phone' }
                }
            };

            const result = validator.validateProfile(profile, schema);
            expect(result.valid).toBe(true);
        });

        it('should report missing required fields', () => {
            const profile = {
                phone: '555-123-4567'
            };

            const schema = {
                required: ['email', 'phone']
            };

            const result = validator.validateProfile(profile, schema);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveProperty('email');
        });
    });

    describe('validateBatch', () => {
        it('should validate multiple fields', () => {
            const fieldData = {
                email: 'john@example.com',
                phone: '555-123-4567',
                experience: 5
            };

            const schema = {
                email: { type: 'email', required: true },
                phone: { type: 'phone', required: true },
                experience: { type: 'yearsExperience' }
            };

            const results = validator.validateBatch(fieldData, schema);
            expect(results.email.valid).toBe(true);
            expect(results.phone.valid).toBe(true);
            expect(results.experience.valid).toBe(true);
        });

        it('should report multiple errors', () => {
            const fieldData = {
                email: 'invalid-email',
                phone: 'abc'
            };

            const schema = {
                email: { type: 'email', required: true },
                phone: { type: 'phone', required: true }
            };

            const results = validator.validateBatch(fieldData, schema);
            expect(results.email.valid).toBe(false);
            expect(results.phone.valid).toBe(false);
        });
    });

    describe('registerCustomValidator', () => {
        it('should register and use custom validator', () => {
            validator.registerCustomValidator('even', (value) => ({
                valid: value % 2 === 0,
                error: 'Must be even'
            }));

            const result = validator.validateCustom('even', 4);
            expect(result.valid).toBe(true);

            const result2 = validator.validateCustom('even', 3);
            expect(result2.valid).toBe(false);
        });

        it('should reject unknown custom validator', () => {
            const result = validator.validateCustom('unknown', 'value');
            expect(result.valid).toBe(false);
        });
    });
});
