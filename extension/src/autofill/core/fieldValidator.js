/**
 * Field Validator Module
 * Validates user data before filling forms
 * Supports multiple formats and country-specific validations
 */

class FieldValidator {
    constructor() {
        this.countryPhoneFormats = this.initializePhoneFormats();
        this.countryPostalFormats = this.initializePostalFormats();
        this.customValidators = new Map();
    }

    /**
     * Initialize phone formats by country
     */
    initializePhoneFormats() {
        return {
            'US': {
                pattern: /^(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
                example: '+1-555-123-4567'
            },
            'UK': {
                pattern: /^(\+?44[-.\s]?)?\(?[0-9]{1,5}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}$/,
                example: '+44-20-7946-0958'
            },
            'India': {
                pattern: /^(\+?91[-.\s]?)?[0-9]{10}$/,
                example: '+91-9876543210'
            },
            'Canada': {
                pattern: /^(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
                example: '+1-555-123-4567'
            },
            'Australia': {
                pattern: /^(\+?61[-.\s]?)?[0-9]{9,10}$/,
                example: '+61-412-345-678'
            },
            'Germany': {
                pattern: /^(\+?49[-.\s]?)?[0-9]{2,5}[-.\s]?[0-9]{3,12}$/,
                example: '+49-30-12345678'
            },
            'France': {
                pattern: /^(\+?33[-.\s]?)?[0-9]{9}$/,
                example: '+33-1-23-45-67-89'
            }
        };
    }

    /**
     * Initialize postal code formats by country
     */
    initializePostalFormats() {
        return {
            'US': {
                pattern: /^\d{5}(?:-\d{4})?$/,
                example: '12345 or 12345-6789'
            },
            'UK': {
                pattern: /^[A-Z]{1,2}[0-9]{1,2}\s?[0-9][A-Z]{2}$/i,
                example: 'SW1A 1AA'
            },
            'Canada': {
                pattern: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
                example: 'K1A 0B1'
            },
            'India': {
                pattern: /^\d{6}$/,
                example: '110001'
            },
            'Germany': {
                pattern: /^\d{5}$/,
                example: '10115'
            },
            'France': {
                pattern: /^\d{5}$/,
                example: '75001'
            },
            'Australia': {
                pattern: /^\d{4}$/,
                example: '2000'
            }
        };
    }

    /**
     * Validate email
     */
    validateEmail(email) {
        if (!email) {
            return { valid: false, error: 'Email is required' };
        }

        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!pattern.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }

        if (email.length > 254) {
            return { valid: false, error: 'Email is too long' };
        }

        return { valid: true };
    }

    /**
     * Validate phone number
     */
    validatePhone(phone, country = 'US') {
        if (!phone) {
            return { valid: false, error: 'Phone number is required' };
        }

        const format = this.countryPhoneFormats[country];
        
        if (!format) {
            // Fallback: basic phone validation
            const basicPattern = /^[\d\s\-\+\(\)\.]{7,15}$/;
            if (!basicPattern.test(phone)) {
                return { valid: false, error: 'Invalid phone format' };
            }
            return { valid: true };
        }

        if (!format.pattern.test(phone)) {
            return { 
                valid: false, 
                error: `Invalid phone format for ${country}. Example: ${format.example}` 
            };
        }

        return { valid: true };
    }

    /**
     * Validate URL
     */
    validateUrl(url) {
        if (!url) {
            return { valid: false, error: 'URL is required' };
        }

        try {
            new URL(url);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    /**
     * Validate date
     */
    validateDate(date, format = 'YYYY-MM-DD') {
        if (!date) {
            return { valid: false, error: 'Date is required' };
        }

        let dateObj;
        
        if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else {
            dateObj = date;
        }

        if (isNaN(dateObj.getTime())) {
            return { valid: false, error: 'Invalid date format' };
        }

        return { valid: true, date: dateObj };
    }

    /**
     * Validate postal code
     */
    validatePostalCode(postalCode, country = 'US') {
        if (!postalCode) {
            return { valid: false, error: 'Postal code is required' };
        }

        const format = this.countryPostalFormats[country];
        
        if (!format) {
            // Fallback: basic postal validation
            const basicPattern = /^[A-Z0-9\s\-]{3,10}$/i;
            if (!basicPattern.test(postalCode)) {
                return { valid: false, error: 'Invalid postal code format' };
            }
            return { valid: true };
        }

        if (!format.pattern.test(postalCode)) {
            return { 
                valid: false, 
                error: `Invalid postal code for ${country}. Example: ${format.example}` 
            };
        }

        return { valid: true };
    }

    /**
     * Validate years of experience (0-70)
     */
    validateYearsExperience(years) {
        if (years === null || years === undefined || years === '') {
            return { valid: false, error: 'Years of experience is required' };
        }

        const yearsNum = parseInt(years);
        
        if (isNaN(yearsNum)) {
            return { valid: false, error: 'Years must be a number' };
        }

        if (yearsNum < 0 || yearsNum > 70) {
            return { valid: false, error: 'Years must be between 0 and 70' };
        }

        return { valid: true, value: yearsNum };
    }

    /**
     * Validate GPA (0-4.0)
     */
    validateGPA(gpa) {
        if (gpa === null || gpa === undefined || gpa === '') {
            return { valid: false, error: 'GPA is required' };
        }

        const gpaNum = parseFloat(gpa);
        
        if (isNaN(gpaNum)) {
            return { valid: false, error: 'GPA must be a number' };
        }

        if (gpaNum < 0 || gpaNum > 4.0) {
            return { valid: false, error: 'GPA must be between 0 and 4.0' };
        }

        return { valid: true, value: gpaNum };
    }

    /**
     * Validate salary
     */
    validateSalary(salary) {
        if (!salary) {
            return { valid: false, error: 'Salary is required' };
        }

        // Remove common currency symbols and formats
        const cleanedSalary = String(salary)
            .replace(/[\$€£¥₹]/g, '')
            .replace(/[,\s]/g, '')
            .trim();

        const salaryNum = parseFloat(cleanedSalary);
        
        if (isNaN(salaryNum) || salaryNum <= 0) {
            return { valid: false, error: 'Invalid salary format' };
        }

        if (salaryNum > 1000000000) {
            return { valid: false, error: 'Salary seems unusually high' };
        }

        return { valid: true, value: salaryNum };
    }

    /**
     * Validate graduation year
     */
    validateGraduationYear(year) {
        if (!year) {
            return { valid: false, error: 'Graduation year is required' };
        }

        const yearNum = parseInt(year);
        const currentYear = new Date().getFullYear();
        
        if (isNaN(yearNum)) {
            return { valid: false, error: 'Year must be a number' };
        }

        if (yearNum < 1950 || yearNum > currentYear + 10) {
            return { 
                valid: false, 
                error: `Year must be between 1950 and ${currentYear + 10}` 
            };
        }

        return { valid: true, value: yearNum };
    }

    /**
     * Validate file
     */
    validateFile(file, options = {}) {
        if (!file) {
            return { valid: false, error: 'File is required' };
        }

        const allowedTypes = options.allowedTypes || ['application/pdf', 'application/msword', 'text/plain'];
        const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default

        // Check file type
        if (!allowedTypes.includes(file.type)) {
            return { 
                valid: false, 
                error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
            };
        }

        // Check file size
        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB` 
            };
        }

        return { valid: true };
    }

    /**
     * Validate required field
     */
    validateRequired(value) {
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
            return { valid: false, error: 'This field is required' };
        }

        return { valid: true };
    }

    /**
     * Validate text field
     */
    validateText(text, options = {}) {
        const minLength = options.minLength || 1;
        const maxLength = options.maxLength || 1000;

        if (!text || typeof text !== 'string') {
            return { valid: false, error: 'Invalid text input' };
        }

        if (text.length < minLength) {
            return { valid: false, error: `Minimum length is ${minLength} characters` };
        }

        if (text.length > maxLength) {
            return { valid: false, error: `Maximum length is ${maxLength} characters` };
        }

        return { valid: true };
    }

    /**
     * Validate number field
     */
    validateNumber(value, options = {}) {
        const min = options.min !== undefined ? options.min : -Infinity;
        const max = options.max !== undefined ? options.max : Infinity;

        const num = parseFloat(value);
        
        if (isNaN(num)) {
            return { valid: false, error: 'Invalid number' };
        }

        if (num < min) {
            return { valid: false, error: `Minimum value is ${min}` };
        }

        if (num > max) {
            return { valid: false, error: `Maximum value is ${max}` };
        }

        return { valid: true };
    }

    /**
     * Validate field by type
     */
    validateByType(value, fieldType, options = {}) {
        const validators = {
            email: () => this.validateEmail(value),
            phone: () => this.validatePhone(value, options.country),
            url: () => this.validateUrl(value),
            date: () => this.validateDate(value),
            postalCode: () => this.validatePostalCode(value, options.country),
            yearsExperience: () => this.validateYearsExperience(value),
            gpa: () => this.validateGPA(value),
            salary: () => this.validateSalary(value),
            graduationYear: () => this.validateGraduationYear(value),
            file: () => this.validateFile(value, options),
            text: () => this.validateText(value, options),
            number: () => this.validateNumber(value, options)
        };

        if (validators[fieldType]) {
            return validators[fieldType]();
        }

        return { valid: true }; // Unknown type defaults to valid
    }

    /**
     * Validate entire profile
     */
    validateProfile(profile, schema = {}) {
        const errors = {};
        const warnings = [];

        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                const value = this.getNestedValue(profile, field);
                const validation = this.validateRequired(value);
                if (!validation.valid) {
                    errors[field] = validation.error;
                }
            }
        }

        // Check field-specific validations
        if (schema.fields) {
            for (const [field, fieldSchema] of Object.entries(schema.fields)) {
                const value = this.getNestedValue(profile, field);
                
                if (value !== null && value !== undefined && value !== '') {
                    const validation = this.validateByType(value, fieldSchema.type, fieldSchema.options);
                    if (!validation.valid) {
                        errors[field] = validation.error;
                    }
                }
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    /**
     * Register custom validator
     */
    registerCustomValidator(name, validatorFunction) {
        this.customValidators.set(name, validatorFunction);
    }

    /**
     * Validate using custom validator
     */
    validateCustom(name, value) {
        const validator = this.customValidators.get(name);
        
        if (!validator) {
            return { valid: false, error: `Custom validator "${name}" not found` };
        }

        try {
            return validator(value);
        } catch (error) {
            return { valid: false, error: `Validation error: ${error.message}` };
        }
    }

    /**
     * Sanitize input for security
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Remove potentially dangerous characters
        return input
            .replace(/[<>\"']/g, '')
            .trim();
    }

    /**
     * Check for suspicious patterns
     */
    checkSuspiciousPatterns(value) {
        if (typeof value !== 'string') return false;

        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /onerror=/i,
            /onclick=/i,
            /eval\(/i
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate batch of fields
     */
    validateBatch(fieldData, schema = {}) {
        const results = {};

        for (const [fieldName, value] of Object.entries(fieldData)) {
            const fieldSchema = schema[fieldName] || {};
            
            results[fieldName] = {
                value,
                valid: true,
                errors: [],
                warnings: []
            };

            // Check required
            if (fieldSchema.required) {
                const req = this.validateRequired(value);
                if (!req.valid) {
                    results[fieldName].valid = false;
                    results[fieldName].errors.push(req.error);
                }
            }

            // Check type validation
            if (value && fieldSchema.type) {
                const validation = this.validateByType(value, fieldSchema.type, fieldSchema.options);
                if (!validation.valid) {
                    results[fieldName].valid = false;
                    results[fieldName].errors.push(validation.error);
                }
            }

            // Check custom rules
            if (fieldSchema.custom && value) {
                const customResult = this.validateCustom(fieldSchema.custom, value);
                if (!customResult.valid) {
                    results[fieldName].valid = false;
                    results[fieldName].errors.push(customResult.error);
                }
            }

            // Check for suspicious patterns
            if (this.checkSuspiciousPatterns(value)) {
                results[fieldName].warnings.push('Suspicious patterns detected');
            }
        }

        return results;
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldValidator;
}
