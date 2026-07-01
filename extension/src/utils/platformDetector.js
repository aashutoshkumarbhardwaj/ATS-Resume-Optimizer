/**
 * Platform Detector - Phase 2 Enhancement
 * Detects which ATS/job platform the user is on
 * Enables platform-specific handling
 */

class PlatformDetector {
    static PLATFORMS = {
        LINKEDIN: 'LinkedIn',
        INDEED: 'Indeed',
        GLASSDOOR: 'Glassdoor',
        GREENHOUSE: 'Greenhouse',
        LEVER: 'Lever',
        ASHBY: 'Ashby',
        WORKDAY: 'Workday',
        ORACLE: 'Oracle Recruiting',
        SAP: 'SAP SuccessFactors',
        TALEO: 'Taleo',
        BAMBOOHR: 'BambooHR',
        SMARTRECRUITERS: 'SmartRecruiters',
        GOOGLE_FORMS: 'Google Forms',
        MONSTER: 'Monster',
        ZIPRECRUITER: 'ZipRecruiter',
        WORKABLE: 'Workable',
        DICE: 'Dice',
        GENERIC: 'Generic Application Form'
    };

    /**
     * Detect current platform
     */
    static detect() {
        const url = window.location.href.toLowerCase();
        const domain = this.getDomain(url);
        const hostname = window.location.hostname.toLowerCase();

        // Check domain patterns
        if (hostname.includes('linkedin.com')) return this.PLATFORMS.LINKEDIN;
        if (hostname.includes('indeed.com')) return this.PLATFORMS.INDEED;
        if (hostname.includes('glassdoor.com')) return this.PLATFORMS.GLASSDOOR;
        if (hostname.includes('greenhouse.io')) return this.PLATFORMS.GREENHOUSE;
        if (hostname.includes('lever.co')) return this.PLATFORMS.LEVER;
        if (hostname.includes('ashby.com')) return this.PLATFORMS.ASHBY;
        if (hostname.includes('workday.com')) return this.PLATFORMS.WORKDAY;
        if (hostname.includes('oracle.com')) return this.PLATFORMS.ORACLE;
        if (hostname.includes('sap.com') || hostname.includes('successfactors')) return this.PLATFORMS.SAP;
        if (hostname.includes('taleo.net')) return this.PLATFORMS.TALEO;
        if (hostname.includes('bamboohr.com')) return this.PLATFORMS.BAMBOOHR;
        if (hostname.includes('smartrecruiters.com')) return this.PLATFORMS.SMARTRECRUITERS;
        if (hostname.includes('docs.google.com') && url.includes('forms')) return this.PLATFORMS.GOOGLE_FORMS;
        if (hostname.includes('monster.com')) return this.PLATFORMS.MONSTER;
        if (hostname.includes('ziprecruiter.com')) return this.PLATFORMS.ZIPRECRUITER;
        if (hostname.includes('workable.com')) return this.PLATFORMS.WORKABLE;
        if (hostname.includes('dice.com')) return this.PLATFORMS.DICE;

        // Check for common ATS indicators
        if (this.isWorkdayATS()) return this.PLATFORMS.WORKDAY;
        if (this.isGreenhouseATS()) return this.PLATFORMS.GREENHOUSE;
        if (this.isLeverATS()) return this.PLATFORMS.LEVER;

        return this.PLATFORMS.GENERIC;
    }

    /**
     * Get domain from URL
     */
    static getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

    /**
     * Check if page is Workday ATS
     */
    static isWorkdayATS() {
        // Workday-specific selectors
        return !!document.querySelector('[data-react-beautydnd-draggable]') ||
               !!document.querySelector('[class*="workday"]') ||
               window.__WORKDAY__ !== undefined;
    }

    /**
     * Check if page is Greenhouse ATS
     */
    static isGreenhouseATS() {
        return !!document.querySelector('[data-gh-job-id]') ||
               !!document.querySelector('[class*="greenhouse"]') ||
               window.__GREENHOUSE__ !== undefined;
    }

    /**
     * Check if page is Lever ATS
     */
    static isLeverATS() {
        return !!document.querySelector('[class*="lever"]') ||
               !!document.querySelector('[data-lever-id]') ||
               window.__LEVER__ !== undefined;
    }

    /**
     * Get platform-specific configuration
     */
    static getConfiguration(platform) {
        const configs = {
            [this.PLATFORMS.LINKEDIN]: {
                jobTitleSelector: '[data-test-id="job-details-jobs-unified-top-card__job-title"]',
                companySelector: '[data-test-id="job-details-jobs-unified-top-card__company-name"]',
                descriptionSelector: '.jobs-description__content',
                applyButtonSelector: '[aria-label*="Apply"]'
            },

            [this.PLATFORMS.INDEED]: {
                jobTitleSelector: 'h1[class*="jobTitle"]',
                companySelector: '[data-company-name]',
                descriptionSelector: '#jobDescriptionText',
                applyButtonSelector: '[aria-label*="Apply"]'
            },

            [this.PLATFORMS.GLASSDOOR]: {
                jobTitleSelector: '[data-test="job-title"]',
                companySelector: '[data-test="employer-name"]',
                descriptionSelector: '.jobDescriptionContent',
                applyButtonSelector: '[aria-label*="Apply"]'
            },

            [this.PLATFORMS.GREENHOUSE]: {
                jobTitleSelector: '.application_title',
                companySelector: '.company-name',
                descriptionSelector: '.description',
                applyButtonSelector: '[class*="apply"]'
            },

            [this.PLATFORMS.LEVER]: {
                jobTitleSelector: '.posting-headline',
                companySelector: '.company-name',
                descriptionSelector: '.posting-content',
                applyButtonSelector: '[class*="apply"]'
            },

            [this.PLATFORMS.WORKDAY]: {
                jobTitleSelector: '[data-automation-id="jobTitle"]',
                companySelector: '[data-automation-id="company"]',
                descriptionSelector: '[data-automation-id="jobDescription"]',
                applyButtonSelector: '[data-automation-id="topApplyButton"]'
            },

            [this.PLATFORMS.GOOGLE_FORMS]: {
                formSelector: 'form[action*="formResponse"]',
                fieldsSelector: '[role="listitem"]',
                submitSelector: '[aria-label="Submit"]'
            },

            [this.PLATFORMS.GENERIC]: {
                jobTitleSelector: 'h1',
                companySelector: '[class*="company"]',
                descriptionSelector: '[class*="description"]',
                formSelector: 'form'
            }
        };

        return configs[platform] || configs[this.PLATFORMS.GENERIC];
    }

    /**
     * Get platform-specific instructions
     */
    static getInstructions(platform) {
        const instructions = {
            [this.PLATFORMS.LINKEDIN]: {
                autoFill: true,
                jobDetection: 'high',
                difficulty: 'easy',
                tips: 'Enable "Easy apply" for faster applications'
            },

            [this.PLATFORMS.INDEED]: {
                autoFill: true,
                jobDetection: 'high',
                difficulty: 'easy',
                tips: 'Indeed accounts can save profiles for quicker applications'
            },

            [this.PLATFORMS.GLASSDOOR]: {
                autoFill: true,
                jobDetection: 'high',
                difficulty: 'easy',
                tips: 'Glassdoor syncs with your profile automatically'
            },

            [this.PLATFORMS.GREENHOUSE]: {
                autoFill: true,
                jobDetection: 'high',
                difficulty: 'medium',
                tips: 'Greenhouse might require manual handling for some fields'
            },

            [this.PLATFORMS.LEVER]: {
                autoFill: true,
                jobDetection: 'high',
                difficulty: 'medium',
                tips: 'Lever uses modern JavaScript - wait for fields to load'
            },

            [this.PLATFORMS.WORKDAY]: {
                autoFill: true,
                jobDetection: 'medium',
                difficulty: 'hard',
                tips: 'Workday is complex - some fields may need manual input'
            },

            [this.PLATFORMS.GOOGLE_FORMS]: {
                autoFill: true,
                jobDetection: 'low',
                difficulty: 'medium',
                tips: 'Google Forms might use custom question types'
            },

            [this.PLATFORMS.GENERIC]: {
                autoFill: true,
                jobDetection: 'medium',
                difficulty: 'hard',
                tips: 'Generic forms may require more manual intervention'
            }
        };

        return instructions[platform] || instructions[this.PLATFORMS.GENERIC];
    }

    /**
     * Check if platform is supported
     */
    static isSupported(platform) {
        return Object.values(this.PLATFORMS).includes(platform);
    }

    /**
     * Get all supported platforms
     */
    static getSupportedPlatforms() {
        return Object.values(this.PLATFORMS);
    }

    /**
     * Check if current page has a job application form
     */
    static hasApplicationForm() {
        const platform = this.detect();
        const config = this.getConfiguration(platform);

        // Check for common form indicators
        if (config.formSelector) {
            return !!document.querySelector(config.formSelector);
        }

        // Fallback: check for any input/select/textarea
        return document.querySelectorAll('input, select, textarea').length > 0;
    }

    /**
     * Get job information from current page
     */
    static extractJobInfo() {
        const platform = this.detect();
        const config = this.getConfiguration(platform);

        const jobInfo = {
            platform,
            title: '',
            company: '',
            description: '',
            url: window.location.href
        };

        // Try to extract job info using platform-specific selectors
        if (config.jobTitleSelector) {
            const titleEl = document.querySelector(config.jobTitleSelector);
            if (titleEl) jobInfo.title = titleEl.textContent.trim();
        }

        if (config.companySelector) {
            const companyEl = document.querySelector(config.companySelector);
            if (companyEl) jobInfo.company = companyEl.textContent.trim();
        }

        if (config.descriptionSelector) {
            const descEl = document.querySelector(config.descriptionSelector);
            if (descEl) jobInfo.description = descEl.textContent.trim();
        }

        return jobInfo;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlatformDetector;
}
