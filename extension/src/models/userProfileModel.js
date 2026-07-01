/**
 * User Profile Model - Phase 2 Enhancement
 * Extended profile with all personal, employment, and social fields
 */

class UserProfileModel {
    static PROFILE_SCHEMA = {
        // Personal Information
        firstName: { type: 'string', required: true },
        lastName: { type: 'string', required: true },
        preferredName: { type: 'string', required: false },
        email: { type: 'email', required: true },
        phone: { type: 'phone', required: false },

        // Address
        address: { type: 'string', required: false },
        city: { type: 'string', required: false },
        state: { type: 'string', required: false },
        pinCode: { type: 'string', required: false },
        country: { type: 'string', required: false },

        // Employment
        currentCompany: { type: 'string', required: false },
        currentSalary: { type: 'number', required: false },
        expectedSalary: { type: 'number', required: false },
        noticePeriod: { type: 'select', required: false, values: ['Immediate', '15 days', '30 days', '60 days', '90 days'] },
        yearsExperience: { type: 'number', required: false },

        // Work Authorization
        visaStatus: { type: 'select', required: false, values: ['Citizen', 'Permanent Resident', 'Need Sponsorship'] },
        sponsorshipRequired: { type: 'boolean', required: false },
        workAuthorization: { type: 'select', required: false, values: ['Yes', 'No', 'Need sponsorship'] },

        // Social & Links
        linkedIn: { type: 'url', required: false },
        github: { type: 'url', required: false },
        portfolio: { type: 'url', required: false },
        leetcode: { type: 'url', required: false },
        hackerrank: { type: 'url', required: false },
        personalWebsite: { type: 'url', required: false },

        // Additional Fields
        summary: { type: 'textarea', required: false },
        aboutYou: { type: 'textarea', required: false },
        writingStyle: { type: 'select', required: false, values: ['Professional', 'Casual', 'Formal', 'Friendly'] },
        
        // Meta
        createdAt: { type: 'timestamp', required: false },
        updatedAt: { type: 'timestamp', required: false },
        lastSaved: { type: 'timestamp', required: false }
    };

    /**
     * Create new profile
     */
    static async create(profileData) {
        const profile = {
            ...this.getDefaultProfile(),
            ...profileData,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Validate profile
        const validation = this.validate(profile);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Save to storage
        return new Promise((resolve) => {
            chrome.storage.local.set({ userProfile: profile }, () => {
                resolve({ success: true, profile });
            });
        });
    }

    /**
     * Get user profile
     */
    static async get() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['userProfile'], (result) => {
                const profile = result.userProfile || this.getDefaultProfile();
                resolve(profile);
            });
        });
    }

    /**
     * Update profile field
     */
    static async updateField(fieldName, fieldValue) {
        const profile = await this.get();
        profile[fieldName] = fieldValue;
        profile.updatedAt = Date.now();
        profile.lastSaved = Date.now();

        // Validate
        const validation = this.validate(profile);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        return new Promise((resolve) => {
            chrome.storage.local.set({ userProfile: profile }, () => {
                resolve({ success: true, profile });
            });
        });
    }

    /**
     * Update multiple fields
     */
    static async updateFields(fieldsData) {
        const profile = await this.get();

        for (const [key, value] of Object.entries(fieldsData)) {
            profile[key] = value;
        }

        profile.updatedAt = Date.now();
        profile.lastSaved = Date.now();

        // Validate
        const validation = this.validate(profile);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        return new Promise((resolve) => {
            chrome.storage.local.set({ userProfile: profile }, () => {
                resolve({ success: true, profile });
            });
        });
    }

    /**
     * Get default profile
     */
    static getDefaultProfile() {
        const defaultProfile = {};

        for (const [fieldName, fieldSpec] of Object.entries(this.PROFILE_SCHEMA)) {
            defaultProfile[fieldName] = '';
        }

        return defaultProfile;
    }

    /**
     * Validate profile
     */
    static validate(profile) {
        const errors = {};

        for (const [fieldName, fieldSpec] of Object.entries(this.PROFILE_SCHEMA)) {
            const value = profile[fieldName];

            // Check required fields
            if (fieldSpec.required && !value) {
                errors[fieldName] = `${fieldName} is required`;
                continue;
            }

            // Skip empty optional fields
            if (!value) continue;

            // Validate type
            switch (fieldSpec.type) {
                case 'email':
                    if (!this.isValidEmail(value)) {
                        errors[fieldName] = 'Invalid email format';
                    }
                    break;

                case 'phone':
                    if (!this.isValidPhone(value)) {
                        errors[fieldName] = 'Invalid phone format';
                    }
                    break;

                case 'url':
                    if (!this.isValidURL(value)) {
                        errors[fieldName] = 'Invalid URL format';
                    }
                    break;

                case 'number':
                    if (isNaN(value)) {
                        errors[fieldName] = 'Must be a number';
                    }
                    break;

                case 'select':
                    if (fieldSpec.values && !fieldSpec.values.includes(value)) {
                        errors[fieldName] = 'Invalid option selected';
                    }
                    break;
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Validate email
     */
    static isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Validate phone
     */
    static isValidPhone(phone) {
        const re = /^[\d\s\-\+\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }

    /**
     * Validate URL
     */
    static isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Export profile as JSON
     */
    static async exportAsJSON() {
        const profile = await this.get();
        return JSON.stringify(profile, null, 2);
    }

    /**
     * Import profile from JSON
     */
    static async importFromJSON(jsonString) {
        try {
            const profile = JSON.parse(jsonString);

            const validation = this.validate(profile);
            if (!validation.valid) {
                return { success: false, errors: validation.errors };
            }

            return await this.create(profile);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get profile completion percentage
     */
    static async getCompletionPercentage() {
        const profile = await this.get();
        const requiredFields = Object.entries(this.PROFILE_SCHEMA)
            .filter(([, spec]) => spec.required)
            .map(([name]) => name);

        const filledRequired = requiredFields.filter(field => profile[field]).length;
        const allFields = Object.keys(this.PROFILE_SCHEMA).length;
        const filledAll = Object.values(profile).filter(v => v).length;

        return {
            required: Math.round((filledRequired / requiredFields.length) * 100),
            overall: Math.round((filledAll / allFields) * 100),
            filledFields: filledAll,
            totalFields: allFields
        };
    }

    /**
     * Get all profile fields
     */
    static getFields() {
        return this.PROFILE_SCHEMA;
    }

    /**
     * Get field groups for UI
     */
    static getFieldGroups() {
        return {
            personal: [
                'firstName', 'lastName', 'preferredName', 'email', 'phone'
            ],
            address: [
                'address', 'city', 'state', 'pinCode', 'country'
            ],
            employment: [
                'currentCompany', 'currentSalary', 'expectedSalary',
                'noticePeriod', 'yearsExperience'
            ],
            authorization: [
                'visaStatus', 'sponsorshipRequired', 'workAuthorization'
            ],
            social: [
                'linkedIn', 'github', 'portfolio', 'leetcode',
                'hackerrank', 'personalWebsite'
            ],
            additional: [
                'summary', 'aboutYou', 'writingStyle'
            ]
        };
    }

    /**
     * Clear profile
     */
    static async clear() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ userProfile: this.getDefaultProfile() }, () => {
                resolve(true);
            });
        });
    }

    /**
     * Get profile summary
     */
    static async getSummary() {
        const profile = await this.get();

        return {
            name: `${profile.firstName} ${profile.lastName}`.trim(),
            email: profile.email,
            phone: profile.phone,
            location: `${profile.city}, ${profile.state}, ${profile.country}`.replace(/, ,/g, ',').trim(),
            experience: `${profile.yearsExperience} years`,
            currentRole: profile.currentCompany ? `${profile.currentCompany}` : 'Not specified',
            social: {
                linkedin: profile.linkedIn ? '✓' : '✗',
                github: profile.github ? '✓' : '✗',
                portfolio: profile.portfolio ? '✓' : '✗'
            }
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserProfileModel;
}
