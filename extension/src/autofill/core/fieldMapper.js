/**
 * Field Mapper Module - Phase 2
 * Maps form field labels to resume data using fuzzy matching
 * Supports extensive field name variations
 */

class FieldMapper {
    static FIELD_VARIATIONS = {
        // Personal Information
        firstName: [
            'first name', 'given name', 'legal name', 'preferred name',
            'first_name', 'firstname', 'forename', 'first n',
            'fname', 'givenname', 'legalname', 'preferredname',
            'first n.', 'given', 'name'
        ],
        lastName: [
            'last name', 'family name', 'surname',
            'last_name', 'lastname', 'lname', 'familyname'
        ],
        email: [
            'email', 'email address', 'e-mail', 'contact email',
            'primary email', 'work email', 'your email', 'email id'
        ],
        phone: [
            'phone', 'mobile', 'phone number', 'contact number',
            'mobile number', 'telephone', 'tel', 'phone no',
            'cell phone', 'contact phone'
        ],
        address: [
            'address', 'street address', 'mailing address', 'current address',
            'street', 'residential address', 'home address'
        ],
        city: [
            'city', 'city name', 'location city', 'municipality',
            'town', 'current city', 'your city'
        ],
        state: [
            'state', 'province', 'region', 'state/province', 'province/state',
            'state or province', 'state province'
        ],
        zipCode: [
            'zip', 'postal code', 'zip code', 'postcode', 'post code',
            'zipcode', 'zip/postal', 'postal'
        ],
        country: [
            'country', 'country of residence', 'nationality',
            'country code', 'select country', 'your country',
            'residing country'
        ],

        // Professional Information
        currentCompany: [
            'company', 'current company', 'employer', 'current employer',
            'organization', 'company name', 'current organization',
            'organisation', 'present company'
        ],
        jobTitle: [
            'job title', 'current position', 'title', 'position',
            'designation', 'current job', 'present position',
            'job position', 'your position'
        ],
        yearsExperience: [
            'years of experience', 'experience', 'years exp',
            'years experience', 'experience level', 'experience years',
            'total experience', 'years in industry'
        ],
        expectedSalary: [
            'expected salary', 'desired salary', 'salary', 'compensation',
            'ctc', 'annual salary', 'salary expectation', 'salary range'
        ],
        noticePeriod: [
            'notice period', 'availability', 'available from', 'notice',
            'notice time', 'availability notice', 'joining date'
        ],
        employmentType: [
            'employment type', 'job type', 'contract type', 'employment status',
            'type of position', 'position type', 'work type'
        ],
        visaStatus: [
            'visa status', 'work authorization', 'sponsorship',
            'visa', 'work permit', 'authorized to work',
            'visa required', 'sponsorship required', 'right to work'
        ],

        // Education
        education: [
            'education', 'university', 'college', 'school', 'institution',
            'highest education', 'education level'
        ],
        degree: [
            'degree', 'qualification', 'qualification level',
            'degree level', 'educational qualification'
        ],
        major: [
            'major', 'field of study', 'specialization', 'subject',
            'course', 'field', 'discipline'
        ],
        gpa: [
            'gpa', 'grade', 'score', 'cgpa', 'grade point',
            'marks', 'percentage'
        ],
        graduationYear: [
            'graduation', 'graduation year', 'passing year',
            'expected graduation', 'pass out year'
        ],

        // Links & URLs
        linkedIn: [
            'linkedin', 'linkedin profile', 'linkedin url', 'linkedin link',
            'linkedn', 'linked-in'
        ],
        github: [
            'github', 'github profile', 'github url', 'github link'
        ],
        portfolio: [
            'portfolio', 'portfolio url', 'portfolio link', 'portfolio website',
            'your portfolio'
        ],
        website: [
            'website', 'personal website', 'your website', 'web link',
            'web url', 'website url'
        ],
        resumeUrl: [
            'resume', 'resume url', 'resume link', 'cv', 'cv url',
            'curriculum vitae'
        ]
    };

    /**
     * Map a label to a field type using fuzzy matching
     */
    static mapLabelToField(label) {
        if (!label) return null;

        const normalizedLabel = label.toLowerCase().trim()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ');

        // Exact and fuzzy matching
        for (const [fieldKey, variations] of Object.entries(this.FIELD_VARIATIONS)) {
            for (const variation of variations) {
                const normalizedVariation = variation.toLowerCase().trim()
                    .replace(/[^\w\s]/g, ' ')
                    .replace(/\s+/g, ' ');

                // Check for exact match
                if (normalizedLabel === normalizedVariation) {
                    return fieldKey;
                }

                // Check if label includes variation or variation includes label
                if (normalizedLabel.includes(normalizedVariation) ||
                    normalizedVariation.includes(normalizedLabel)) {
                    return fieldKey;
                }

                // Check for partial word matches
                const labelWords = normalizedLabel.split(' ');
                const variationWords = normalizedVariation.split(' ');

                if (labelWords.length > 0 && variationWords.length > 0) {
                    const commonWords = labelWords.filter(w =>
                        variationWords.some(v => this.similarWords(w, v))
                    );

                    if (commonWords.length > 0 && commonWords.length >= Math.max(1, Math.floor(variationWords.length / 2))) {
                        return fieldKey;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if two words are similar (Levenshtein distance)
     */
    static similarWords(word1, word2) {
        if (word1 === word2) return true;

        const maxLen = Math.max(word1.length, word2.length);
        const distance = this.levenshteinDistance(word1, word2);

        // Allow up to 2 character differences for words longer than 4 chars
        const threshold = Math.max(1, Math.ceil(maxLen * 0.3));
        return distance <= threshold;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    static levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Extract value from resume for a field type
     */
    static extractResumeValue(resume, fieldType) {
        if (!resume) return null;

        switch (fieldType) {
            case 'firstName':
                return resume.contact?.firstName || resume.firstName || null;

            case 'lastName':
                return resume.contact?.lastName || resume.lastName || null;

            case 'email':
                return resume.contact?.email || resume.email || null;

            case 'phone':
                return resume.contact?.phone || resume.phone || null;

            case 'address':
                return resume.contact?.address || resume.address || null;

            case 'city':
                return resume.contact?.city || resume.city || null;

            case 'state':
                return resume.contact?.state || resume.state || null;

            case 'zipCode':
                return resume.contact?.zipCode || resume.zipCode || null;

            case 'country':
                return resume.contact?.country || resume.country || null;

            case 'currentCompany':
                return resume.experience?.[0]?.company || resume.currentCompany || null;

            case 'jobTitle':
                return resume.experience?.[0]?.title || resume.jobTitle || null;

            case 'yearsExperience':
                if (resume.yearsExperience) {
                    return resume.yearsExperience.toString();
                }
                // Calculate from experience dates
                if (resume.experience && resume.experience.length > 0) {
                    const years = this.calculateYearsExperience(resume.experience);
                    return years > 0 ? years.toString() : null;
                }
                return null;

            case 'expectedSalary':
                return resume.expectedSalary || resume.salary || null;

            case 'noticePeriod':
                return resume.noticePeriod || null;

            case 'employmentType':
                return resume.preferredEmploymentType || null;

            case 'visaStatus':
                return resume.visaStatus || null;

            case 'degree':
                return resume.education?.[0]?.degree || resume.degree || null;

            case 'major':
                return resume.education?.[0]?.major || resume.major || null;

            case 'gpa':
                return resume.education?.[0]?.gpa || resume.gpa || null;

            case 'graduationYear':
                return resume.education?.[0]?.graduationYear?.toString() || null;

            case 'linkedIn':
                return resume.contact?.linkedIn || resume.linkedIn || null;

            case 'github':
                return resume.contact?.github || resume.github || null;

            case 'portfolio':
                return resume.contact?.portfolio || resume.portfolio || null;

            case 'website':
                return resume.contact?.website || resume.website || null;

            default:
                return null;
        }
    }

    /**
     * Calculate years of experience from experience array
     */
    static calculateYearsExperience(experience) {
        if (!Array.isArray(experience) || experience.length === 0) {
            return 0;
        }

        let totalMonths = 0;

        for (const exp of experience) {
            const startDate = this.parseDate(exp.startDate);
            const endDate = exp.endDate ? this.parseDate(exp.endDate) : new Date();

            if (startDate && endDate) {
                const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                    (endDate.getMonth() - startDate.getMonth());
                totalMonths += months;
            }
        }

        return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
    }

    /**
     * Parse date string
     */
    static parseDate(dateString) {
        if (!dateString) return null;

        // Try different date formats
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})/i, // "Jan 2020"
            /(\d{4})/, // Just year
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                try {
                    if (match.length === 4) {
                        // YYYY-MM-DD format
                        return new Date(match[1], match[2] - 1, match[3]);
                    } else if (match.length === 3 && !isNaN(match[2])) {
                        // Month Year format
                        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                            'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                        const monthIndex = monthNames.indexOf(match[1].substring(0, 3).toLowerCase());
                        return new Date(match[2], monthIndex, 1);
                    } else if (match.length === 2) {
                        // Year only
                        return new Date(match[1], 0, 1);
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        return null;
    }

    /**
     * Transform resume value to field format
     */
    static transformValue(value, fieldType) {
        if (!value) return null;

        switch (fieldType) {
            case 'phone':
                // Clean phone number
                return value.toString().replace(/\D/g, '').slice(-10);

            case 'zipCode':
                // Take first 5-10 digits
                return value.toString().replace(/\D/g, '').slice(0, 10);

            case 'yearsExperience':
                // Convert to number
                const years = parseInt(value);
                return isNaN(years) ? null : years.toString();

            case 'expectedSalary':
                // Remove currency symbols and extra text
                return value.toString().replace(/[^\d.]/g, '');

            default:
                return value?.toString() || null;
        }
    }

    /**
     * Calculate confidence score for field match
     */
    static calculateConfidence(label, fieldType) {
        if (!label || !fieldType) return 0;

        const normalizedLabel = label.toLowerCase().trim();
        const variations = this.FIELD_VARIATIONS[fieldType] || [];

        for (const variation of variations) {
            const normalizedVariation = variation.toLowerCase().trim();

            // Exact match = highest confidence
            if (normalizedLabel === normalizedVariation) {
                return 1.0;
            }

            // Includes match = high confidence
            if (normalizedLabel.includes(normalizedVariation) ||
                normalizedVariation.includes(normalizedLabel)) {
                return 0.9;
            }
        }

        // Partial match = medium confidence
        return 0.6;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldMapper;
}
