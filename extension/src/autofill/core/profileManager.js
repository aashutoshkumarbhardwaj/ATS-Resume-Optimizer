/**
 * Profile Manager
 * Manages user profiles for autofill
 * Supports multiple profiles with persistent storage
 */

class ProfileManager {
    constructor(storage = chrome.storage.local) {
        this.storage = storage;
        this.profiles = new Map();
        this.activeProfileId = null;
        this.initialized = false;
    }

    /**
     * Initialize profile manager
     */
    async initialize() {
        if (this.initialized) return;

        const data = await this.storage.get(['profiles', 'activeProfileId']);
        
        if (data.profiles) {
            data.profiles.forEach(profile => {
                this.profiles.set(profile.id, profile);
            });
        }

        this.activeProfileId = data.activeProfileId || null;
        this.initialized = true;
    }

    /**
     * Create new profile
     */
    async createProfile(name, type = 'default') {
        const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const profile = {
            id: profileId,
            name,
            type, // 'default', 'software_engineer', 'data_scientist', etc.
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            personal: {},
            professional: {},
            education: {},
            links: {},
            customFields: {},
            fileAttachments: {}
        };

        this.profiles.set(profileId, profile);
        await this.saveProfiles();

        return profile;
    }

    /**
     * Get profile by ID
     */
    getProfile(profileId) {
        return this.profiles.get(profileId);
    }

    /**
     * Get all profiles
     */
    getAllProfiles() {
        return Array.from(this.profiles.values());
    }

    /**
     * Update profile
     */
    async updateProfile(profileId, updates) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        const updated = {
            ...profile,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.profiles.set(profileId, updated);
        await this.saveProfiles();

        return updated;
    }

    /**
     * Update profile personal information
     */
    async updatePersonal(profileId, personalData) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        profile.personal = {
            ...profile.personal,
            ...personalData
        };

        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Update profile professional information
     */
    async updateProfessional(profileId, professionalData) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        profile.professional = {
            ...profile.professional,
            ...professionalData
        };

        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Update profile education information
     */
    async updateEducation(profileId, educationData) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        profile.education = {
            ...profile.education,
            ...educationData
        };

        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Update profile links
     */
    async updateLinks(profileId, linksData) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        profile.links = {
            ...profile.links,
            ...linksData
        };

        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Add custom field
     */
    async addCustomField(profileId, fieldName, fieldValue) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        profile.customFields[fieldName] = fieldValue;
        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Remove custom field
     */
    async removeCustomField(profileId, fieldName) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        delete profile.customFields[fieldName];
        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Set file attachment
     */
    async setFileAttachment(profileId, fileType, fileData) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        profile.fileAttachments[fileType] = fileData;
        profile.updatedAt = new Date().toISOString();
        await this.saveProfiles();

        return profile;
    }

    /**
     * Get file attachment
     */
    getFileAttachment(profileId, fileType) {
        const profile = this.profiles.get(profileId);
        if (!profile) return null;

        return profile.fileAttachments[fileType] || null;
    }

    /**
     * Get active profile
     */
    getActiveProfile() {
        if (!this.activeProfileId) return null;
        return this.profiles.get(this.activeProfileId);
    }

    /**
     * Set active profile
     */
    async setActiveProfile(profileId) {
        if (!this.profiles.has(profileId)) {
            throw new Error(`Profile ${profileId} not found`);
        }

        this.activeProfileId = profileId;
        await this.storage.set({ activeProfileId: profileId });

        return this.profiles.get(profileId);
    }

    /**
     * Delete profile
     */
    async deleteProfile(profileId) {
        if (!this.profiles.has(profileId)) {
            throw new Error(`Profile ${profileId} not found`);
        }

        this.profiles.delete(profileId);

        if (this.activeProfileId === profileId) {
            this.activeProfileId = null;
            await this.storage.set({ activeProfileId: null });
        }

        await this.saveProfiles();
    }

    /**
     * Duplicate profile
     */
    async duplicateProfile(sourceProfileId, newName) {
        const source = this.profiles.get(sourceProfileId);
        if (!source) throw new Error(`Profile ${sourceProfileId} not found`);

        const newProfile = await this.createProfile(newName, source.type);
        
        newProfile.personal = { ...source.personal };
        newProfile.professional = { ...source.professional };
        newProfile.education = { ...source.education };
        newProfile.links = { ...source.links };
        newProfile.customFields = { ...source.customFields };

        this.profiles.set(newProfile.id, newProfile);
        await this.saveProfiles();

        return newProfile;
    }

    /**
     * Export profile
     */
    exportProfile(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Profile ${profileId} not found`);

        return JSON.stringify(profile, null, 2);
    }

    /**
     * Import profile
     */
    async importProfile(profileJson) {
        try {
            const profile = JSON.parse(profileJson);
            
            // Validate profile structure
            if (!profile.name || !profile.personal) {
                throw new Error('Invalid profile format');
            }

            // Generate new ID
            profile.id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            profile.createdAt = new Date().toISOString();
            profile.updatedAt = new Date().toISOString();

            this.profiles.set(profile.id, profile);
            await this.saveProfiles();

            return profile;
        } catch (error) {
            throw new Error(`Failed to import profile: ${error.message}`);
        }
    }

    /**
     * Get profile as autofill-ready object
     */
    getProfileForAutofill(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) return null;

        return {
            // Personal
            email: profile.personal.email,
            phone: profile.personal.phone,
            alternatePhone: profile.personal.alternatePhone,
            firstName: profile.personal.firstName,
            middleName: profile.personal.middleName,
            lastName: profile.personal.lastName,
            fullName: profile.personal.fullName || 
                `${profile.personal.firstName || ''} ${profile.personal.lastName || ''}`.trim(),
            address: profile.personal.address,
            city: profile.personal.city,
            state: profile.personal.state,
            country: profile.personal.country,
            zipCode: profile.personal.zipCode,

            // Professional
            currentCompany: profile.professional.currentCompany,
            jobTitle: profile.professional.jobTitle,
            yearsOfExperience: profile.professional.yearsOfExperience,
            expectedSalary: profile.professional.expectedSalary,
            noticePeriod: profile.professional.noticePeriod,
            currentSalary: profile.professional.currentSalary,
            preferredLocation: profile.professional.preferredLocation,
            workAuthorization: profile.professional.workAuthorization,
            visaStatus: profile.professional.visaStatus,
            summary: profile.professional.summary,

            // Education
            university: profile.education.university,
            degree: profile.education.degree,
            major: profile.education.major,
            gpa: profile.education.gpa,
            graduationYear: profile.education.graduationYear,

            // Links
            linkedIn: profile.links.linkedIn,
            github: profile.links.github,
            portfolio: profile.links.portfolio,
            website: profile.links.website,
            resumeUrl: profile.links.resumeUrl,

            // Custom fields
            ...profile.customFields,

            // Metadata
            profileId,
            profileName: profile.name,
            profileType: profile.type
        };
    }

    /**
     * Save profiles to storage
     */
    async saveProfiles() {
        const profilesArray = Array.from(this.profiles.values());
        await this.storage.set({
            profiles: profilesArray,
            lastSaved: new Date().toISOString()
        });
    }

    /**
     * Validate required fields
     */
    validateProfile(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) return { valid: false, errors: ['Profile not found'] };

        const errors = [];
        const autofill = this.getProfileForAutofill(profileId);

        // Check essential fields
        if (!autofill.email) errors.push('Email is required');
        if (!autofill.firstName && !autofill.fullName) errors.push('Name is required');
        if (!autofill.phone) errors.push('Phone number is required');

        return {
            valid: errors.length === 0,
            errors,
            completeness: this.calculateCompleteness(profile)
        };
    }

    /**
     * Calculate profile completeness
     */
    calculateCompleteness(profile) {
        let totalFields = 0;
        let filledFields = 0;

        const checkObject = (obj) => {
            for (const [key, value] of Object.entries(obj)) {
                totalFields++;
                if (value && value !== '') {
                    filledFields++;
                }
            }
        };

        checkObject(profile.personal);
        checkObject(profile.professional);
        checkObject(profile.education);
        checkObject(profile.links);

        return totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
    }

    /**
     * Get profile statistics
     */
    getProfileStats(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) return null;

        return {
            id: profile.id,
            name: profile.name,
            type: profile.type,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            completeness: this.calculateCompleteness(profile),
            personalFields: Object.keys(profile.personal).length,
            professionalFields: Object.keys(profile.professional).length,
            educationFields: Object.keys(profile.education).length,
            customFields: Object.keys(profile.customFields).length
        };
    }
}

module.exports = ProfileManager;
