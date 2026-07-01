/**
 * Dropdown Selector Module - Phase 2
 * Intelligent dropdown value selection with fuzzy matching
 * Maps resume values to dropdown options across multiple fields
 */

class DropdownSelector {
    static FIELD_MAPPINGS = {
        country: {
            'India': ['India', 'IN', 'IND', 'Ind'],
            'United States': ['USA', 'US', 'United States', 'America', 'U.S.A', 'U.S'],
            'Canada': ['Canada', 'CA', 'CAN', 'Can'],
            'United Kingdom': ['UK', 'GB', 'United Kingdom', 'England', 'Great Britain'],
            'Australia': ['Australia', 'AU', 'AUS', 'Aus'],
            'Germany': ['Germany', 'DE', 'DEU', 'Ger'],
            'France': ['France', 'FR', 'FRA', 'Fra'],
            'Japan': ['Japan', 'JP', 'JPN', 'Jpn'],
            'China': ['China', 'CN', 'CHN', 'Chn'],
            'Singapore': ['Singapore', 'SG', 'SGP', 'Sin'],
            'Hong Kong': ['Hong Kong', 'HK', 'HKG', 'Hong Kong SAR'],
            'Malaysia': ['Malaysia', 'MY', 'MYS'],
            'Thailand': ['Thailand', 'TH', 'THA'],
            'Vietnam': ['Vietnam', 'VN', 'VNM'],
            'Philippines': ['Philippines', 'PH', 'PHL'],
            'Indonesia': ['Indonesia', 'ID', 'IDN'],
            'Pakistan': ['Pakistan', 'PK', 'PAK'],
            'Bangladesh': ['Bangladesh', 'BD', 'BGD'],
            'Sri Lanka': ['Sri Lanka', 'LK', 'LKA'],
            'New Zealand': ['New Zealand', 'NZ', 'NZL'],
            'South Africa': ['South Africa', 'ZA', 'ZAF'],
        },

        state: {
            // US States
            'Alabama': ['AL', 'Alabama', 'Ala'],
            'Alaska': ['AK', 'Alaska', 'Alas'],
            'Arizona': ['AZ', 'Arizona', 'Ariz'],
            'Arkansas': ['AR', 'Arkansas', 'Ark'],
            'California': ['CA', 'California', 'Calif'],
            'Colorado': ['CO', 'Colorado', 'Colo'],
            'Connecticut': ['CT', 'Connecticut', 'Conn'],
            'Delaware': ['DE', 'Delaware', 'Del'],
            'Florida': ['FL', 'Florida', 'Fla'],
            'Georgia': ['GA', 'Georgia', 'Ga'],
            'Hawaii': ['HI', 'Hawaii', 'Hawaii'],
            'Idaho': ['ID', 'Idaho', 'Idaho'],
            'Illinois': ['IL', 'Illinois', 'Ill'],
            'Indiana': ['IN', 'Indiana', 'Ind'],
            'Iowa': ['IA', 'Iowa', 'Iowa'],
            'Kansas': ['KS', 'Kansas', 'Kan'],
            'Kentucky': ['KY', 'Kentucky', 'Ky'],
            'Louisiana': ['LA', 'Louisiana', 'La'],
            'Maine': ['ME', 'Maine', 'Me'],
            'Maryland': ['MD', 'Maryland', 'Md'],
            'Massachusetts': ['MA', 'Massachusetts', 'Mass'],
            'Michigan': ['MI', 'Michigan', 'Mich'],
            'Minnesota': ['MN', 'Minnesota', 'Minn'],
            'Mississippi': ['MS', 'Mississippi', 'Miss'],
            'Missouri': ['MO', 'Missouri', 'Mo'],
            'Montana': ['MT', 'Montana', 'Mont'],
            'Nebraska': ['NE', 'Nebraska', 'Nebr'],
            'Nevada': ['NV', 'Nevada', 'Nev'],
            'New Hampshire': ['NH', 'New Hampshire'],
            'New Jersey': ['NJ', 'New Jersey'],
            'New Mexico': ['NM', 'New Mexico'],
            'New York': ['NY', 'New York', 'N.Y.'],
            'North Carolina': ['NC', 'North Carolina'],
            'North Dakota': ['ND', 'North Dakota'],
            'Ohio': ['OH', 'Ohio'],
            'Oklahoma': ['OK', 'Oklahoma', 'Okla'],
            'Oregon': ['OR', 'Oregon', 'Oreg'],
            'Pennsylvania': ['PA', 'Pennsylvania', 'Penn'],
            'Rhode Island': ['RI', 'Rhode Island'],
            'South Carolina': ['SC', 'South Carolina'],
            'South Dakota': ['SD', 'South Dakota'],
            'Tennessee': ['TN', 'Tennessee', 'Tenn'],
            'Texas': ['TX', 'Texas', 'Tex'],
            'Utah': ['UT', 'Utah'],
            'Vermont': ['VT', 'Vermont', 'Vt'],
            'Virginia': ['VA', 'Virginia', 'Va'],
            'Washington': ['WA', 'Washington', 'Wash'],
            'West Virginia': ['WV', 'West Virginia'],
            'Wisconsin': ['WI', 'Wisconsin', 'Wis'],
            'Wyoming': ['WY', 'Wyoming', 'Wyo'],
        },

        employmentType: {
            'Full-time': ['Full-time', 'Full time', 'FT', 'Fulltime', 'Full-Time', 'Full Time'],
            'Part-time': ['Part-time', 'Part time', 'PT', 'Parttime', 'Part-Time', 'Part Time'],
            'Contract': ['Contract', 'Contractor', 'Contract Work', 'Contract Based'],
            'Temporary': ['Temporary', 'Temp', 'Temporary Contract', 'Temp Work'],
            'Internship': ['Internship', 'Intern', 'Internships', 'Student Intern'],
            'Freelance': ['Freelance', 'Freelancer', 'Freelancing', 'Freelance Work'],
            'Self-Employed': ['Self-Employed', 'Self Employed', 'Entrepreneur'],
            'Permanent': ['Permanent', 'Permanent Position', 'Permanent Role'],
        },

        noticePeriod: {
            'Immediate': ['Immediate', 'Now', 'Ready to join', '0', '0 days', 'ASAP'],
            '15 days': ['15 days', '15', 'Two weeks', '2 weeks', '14-15 days'],
            '30 days': ['30 days', '30', 'One month', 'Month', 'A month', '1 month'],
            '60 days': ['60 days', '60', 'Two months', '2 months'],
            '90 days': ['90 days', '90', 'Three months', '3 months', 'Negotiable'],
            'Flexible': ['Flexible', 'Negotiable', 'Open'],
        },

        visaStatus: {
            'Citizen': ['Citizen', 'Yes, I am a citizen', 'Permanent Resident', 'PR', 'Passport holder', 'Citizen/PR'],
            'Need sponsorship': ['Need sponsorship', 'Visa required', 'Require sponsorship', 'Will need sponsor', 'Yes, sponsorship needed'],
            'No sponsorship needed': ['No sponsorship', 'No visa required', 'Have work authorization', 'Authorized to work', 'Work permit holder'],
        },

        yearsExperience: {
            '0-2': ['0-2 years', '0-2', 'Less than 2', 'Entry level', 'Junior', 'Fresher', '0-1', '1-2'],
            '2-5': ['2-5 years', '2-5', 'Mid-level', 'Mid level', '3-5'],
            '5-10': ['5-10 years', '5-10', 'Senior', '7-10', '6-10'],
            '10+': ['10+ years', '10+', 'More than 10', 'Expert', '10-15', '15+', '20+'],
        },

        education: {
            'High School': ['High School', 'Secondary', '12th', 'S.S.C', 'HSC'],
            'Bachelor': ['Bachelor', 'Bachelor Degree', 'B.Tech', 'B.A', 'B.S', 'B.Sc', 'B.Com', 'Undergraduate'],
            'Master': ['Master', 'Master Degree', 'M.Tech', 'M.A', 'M.S', 'M.Sc', 'MBA', 'Postgraduate'],
            'PhD': ['PhD', 'Doctoral', 'Doctor', 'D.Phil'],
            'Diploma': ['Diploma', 'Associate Degree'],
            'Certificate': ['Certificate', 'Certification'],
            'Other': ['Other', 'Not Listed'],
        },

        salary: {
            '0-20L': ['0-20L', '0-20 LPA', '0-2000000', 'Below 20 Lakhs'],
            '20-40L': ['20-40L', '20-40 LPA', '2000000-4000000'],
            '40-60L': ['40-60L', '40-60 LPA', '4000000-6000000'],
            '60-100L': ['60-100L', '60-100 LPA', '6000000-10000000'],
            '100L+': ['100L+', '100+ LPA', '10000000+', 'More than 100 Lakhs'],
        },
    };

    /**
     * Find best matching dropdown option for a resume value
     */
    static findBestMatch(fieldType, resumeValue, dropdownOptions) {
        if (!fieldType || !resumeValue || !dropdownOptions || dropdownOptions.length === 0) {
            return null;
        }

        const mappings = this.FIELD_MAPPINGS[fieldType];
        if (!mappings) {
            return this.fuzzyMatchOption(resumeValue, dropdownOptions);
        }

        // Find which key the resume value matches
        let resumeKey = null;
        for (const [key, aliases] of Object.entries(mappings)) {
            if (aliases.some(alias =>
                this.matchesValue(resumeValue.toString(), alias)
            )) {
                resumeKey = key;
                break;
            }
        }

        if (!resumeKey) {
            return this.fuzzyMatchOption(resumeValue, dropdownOptions);
        }

        // Find matching dropdown option from aliases
        const targetAliases = mappings[resumeKey];
        for (const option of dropdownOptions) {
            const optionText = this.getOptionText(option);

            for (const alias of targetAliases) {
                if (this.matchesOption(optionText, alias)) {
                    return option;
                }
            }
        }

        // Fallback: fuzzy match
        return this.fuzzyMatchOption(resumeValue, dropdownOptions);
    }

    /**
     * Fuzzy match option from dropdown
     */
    static fuzzyMatchOption(resumeValue, dropdownOptions) {
        const resumeStr = resumeValue.toString().toLowerCase().trim();
        let bestMatch = null;
        let bestScore = 0;

        for (const option of dropdownOptions) {
            const optionText = this.getOptionText(option).toLowerCase().trim();
            const score = this.calculateMatchScore(resumeStr, optionText);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = option;
            }
        }

        return bestScore > 0.4 ? bestMatch : null;
    }

    /**
     * Calculate similarity score between two strings
     */
    static calculateMatchScore(str1, str2) {
        if (str1 === str2) return 1.0;

        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);

        let matches = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (word1 === word2 || this.levenshteinDistance(word1, word2) <= 1) {
                    matches++;
                    break;
                }
            }
        }

        return matches / Math.max(words1.length, words2.length);
    }

    /**
     * Levenshtein distance for fuzzy matching
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
     * Check if two values match
     */
    static matchesValue(value, target) {
        const cleanValue = value.toString().toLowerCase().trim()
            .replace(/[^\w\s]/g, '');
        const cleanTarget = target.toString().toLowerCase().trim()
            .replace(/[^\w\s]/g, '');

        return cleanValue === cleanTarget ||
            cleanValue.includes(cleanTarget) ||
            cleanTarget.includes(cleanValue);
    }

    /**
     * Check if option text matches target
     */
    static matchesOption(optionText, target) {
        return this.matchesValue(optionText, target);
    }

    /**
     * Extract text from option element or string
     */
    static getOptionText(option) {
        if (typeof option === 'string') {
            return option;
        }

        if (option.textContent) {
            return option.textContent.trim();
        }

        if (option.text) {
            return option.text.trim();
        }

        if (option.value) {
            return option.value.trim();
        }

        return '';
    }

    /**
     * Get option value from option element
     */
    static getOptionValue(option) {
        if (typeof option === 'string') {
            return option;
        }

        if (option.value) {
            return option.value;
        }

        return this.getOptionText(option);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DropdownSelector;
}
