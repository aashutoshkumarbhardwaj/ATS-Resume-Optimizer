/**
 * DOM Extractor Service
 * Intelligent DOM extraction for job postings across multiple platforms
 * Extracts only relevant job content, ignoring navigation, ads, scripts, etc.
 */

class DOMExtractor {
    constructor() {
        this.portalDetectors = this.buildPortalDetectors();
        this.contentSelectors = this.buildContentSelectors();
        this.elementsToIgnore = this.buildIgnorePatterns();
        this.fields = {
            jobTitle: '',
            company: '',
            location: '',
            employmentType: '',
            salary: '',
            experience: '',
            responsibilities: [],
            requirements: [],
            preferredQualifications: [],
            benefits: [],
            skills: []
        };
    }

    /**
     * Main entry point - extract job data from HTML
     * @param {string} html - Raw HTML content
     * @returns {Object} Extracted job data
     */
    extractFromHTML(html) {
        if (!html || typeof html !== 'string') {
            throw new Error('Invalid HTML input');
        }

        // Create a DOM parser-like object (for Node.js environment)
        const parser = require('node-html-parser').parse;
        let dom;
        
        try {
            dom = parser(html);
        } catch (e) {
            throw new Error(`Failed to parse HTML: ${e.message}`);
        }

        // Clean irrelevant elements first
        this.removeIgnoredElements(dom);

        // Detect portal type
        const portal = this.detectPortal(html, dom);

        // Extract data based on portal type
        const jobData = this.extractByPortal(dom, portal);

        // Post-process and validate extracted data
        return this.postProcessJobData(jobData);
    }

    /**
     * Detect which job portal the HTML is from
     */
    detectPortal(html, dom) {
        for (const [portalName, detector] of Object.entries(this.portalDetectors)) {
            if (detector(html, dom)) {
                console.log(`Detected portal: ${portalName}`);
                return portalName;
            }
        }
        return 'generic';
    }

    /**
     * Build portal detection functions
     */
    buildPortalDetectors() {
        return {
            linkedin: (html, dom) => {
                return html.includes('linkedin.com') || 
                       html.includes('data-component-id="job-details"') ||
                       html.includes('jobs-details-top-card');
            },
            greenhouse: (html, dom) => {
                return html.includes('greenhouse.io') ||
                       html.includes('job-advert') ||
                       dom.querySelector('[data-testid="job-description"]') !== null;
            },
            lever: (html, dom) => {
                return html.includes('lever.co') ||
                       html.includes('jobs.lever.co') ||
                       dom.querySelector('[data-qa="job-title"]') !== null;
            },
            workday: (html, dom) => {
                return html.includes('workday.com') ||
                       html.includes('jobdetails') ||
                       dom.querySelector('[data-automation-id="jobTitle"]') !== null;
            },
            ashby: (html, dom) => {
                return html.includes('ashby.recruitment') ||
                       html.includes('jobs.ashby.recruitment') ||
                       dom.querySelector('[data-testid="job-title"]') !== null;
            },
            smartrecruiters: (html, dom) => {
                return html.includes('smartrecruiters.com') ||
                       html.includes('jobs.smartrecruiters.com') ||
                       dom.querySelector('.vacancy-page') !== null;
            },
            indeed: (html, dom) => {
                return html.includes('indeed.com') ||
                       dom.querySelector('[data-testid="jobsearch-ViewjobPaneWrapper"]') !== null;
            },
            wellfound: (html, dom) => {
                return html.includes('wellfound.com') ||
                       html.includes('angel.co/jobs') ||
                       dom.querySelector('[class*="job-posting"]') !== null;
            },
            naukri: (html, dom) => {
                return html.includes('naukri.com') ||
                       html.includes('jobs.naukri.com') ||
                       dom.querySelector('[data-id="jobdetails"]') !== null;
            }
        };
    }

    /**
     * Build content extraction selectors for each portal
     */
    buildContentSelectors() {
        return {
            linkedin: {
                title: ['.jobs-details-top-card__job-title', '[data-test-id="job-title"]', '.top-card-layout__title'],
                company: ['.jobs-details-top-card__company-name', '.top-card-layout__company', '[data-test-id="company-name"]'],
                location: ['.jobs-details-top-card__location', '[data-test-id="job-location"]', '.top-card-layout__subtitle-primary-group'],
                employmentType: ['.jobs-details-top-card__job-insight', '[data-test-id="job-type"]'],
                description: ['[data-test-id="job-description"]', '.show-more-less-html__markup', '.description'],
                salary: ['.job-details-jobs-details-top-card__salary', '[data-test-id="salary"]'],
                benefits: ['.description__job-criteria-list', '[data-test-id="benefits"]']
            },
            greenhouse: {
                title: ['h1.app-title', '[data-testid="job-title"]', '.job-title'],
                company: ['a.company-name', '[data-testid="company-name"]', '.company'],
                location: ['div[itemprop="jobLocation"]', '[data-testid="job-location"]', '.location'],
                employmentType: ['.employment-type', '[data-testid="employment-type"]'],
                description: ['[data-testid="job-description"]', '.description', '.content'],
                salary: ['.salary-range', '[data-testid="salary"]'],
                benefits: ['.benefits', '[data-testid="benefits"]']
            },
            lever: {
                title: ['[data-qa="job-title"]', 'h2.section-title', '.postcard__title'],
                company: ['[data-qa="company-name"]', '.company', 'h3'],
                location: ['[data-qa="job-location"]', '[data-qa="location"]', '.location'],
                employmentType: ['[data-qa="employment-type"]', '.employment-type'],
                description: ['[data-qa="job-description"]', '.section--full', '.description'],
                salary: ['[data-qa="salary"]', '.salary'],
                benefits: ['[data-qa="benefits"]', '.benefits']
            },
            workday: {
                title: ['[data-automation-id="jobTitle"]', 'h1'],
                company: ['[data-automation-id="jobCompany"]', '.company-name'],
                location: ['[data-automation-id="jobLocation"]', '.job-location'],
                employmentType: ['[data-automation-id="employmentType"]', '.employment-type'],
                description: ['[data-automation-id="jobDescription"]', '.job-description', '.description'],
                salary: ['[data-automation-id="salary"]', '.salary-range'],
                benefits: ['[data-automation-id="benefits"]', '.benefits']
            },
            ashby: {
                title: ['[data-testid="job-title"]', 'h1'],
                company: ['[data-testid="company-name"]', '.company'],
                location: ['[data-testid="job-location"]', '.location'],
                employmentType: ['[data-testid="employment-type"]', '.employment-type'],
                description: ['[data-testid="job-description"]', '.job-description', '.description'],
                salary: ['[data-testid="salary"]', '.salary-range'],
                benefits: ['[data-testid="benefits"]', '.benefits']
            },
            smartrecruiters: {
                title: ['.vacancy-page h1', '[itemprop="title"]', '.job-title'],
                company: ['.vacancy-page-company-name', '[itemprop="hiringOrganization"]', '.company'],
                location: ['[itemprop="jobLocation"]', '.job-location', '.location'],
                employmentType: ['.employment-type', '[itemprop="employmentType"]'],
                description: ['.vacancy-page-description', '[itemprop="description"]', '.description'],
                salary: ['[itemprop="baseSalary"]', '.salary-range'],
                benefits: ['.benefits', '.perks']
            },
            indeed: {
                title: ['h1[class*="jobTitle"]', '.jobTitle', '[data-testid="jobTitle"]'],
                company: ['[data-testid="jobCompany"]', '.companyName', '[class*="company"]'],
                location: ['[data-testid="jobLocation"]', '.jobLocation', '[class*="location"]'],
                employmentType: ['[class*="jobMeta"]', '.jobType', '[class*="employment"]'],
                description: ['[id="jobDescriptionText"]', '[class*="description"]', '.job-description'],
                salary: ['[class*="salary"]', '[data-testid="salary"]'],
                benefits: ['[class*="benefits"]', '.benefits-list']
            },
            wellfound: {
                title: ['h1.job-title', '[data-testid="job-title"]', '.title'],
                company: ['.company-name', '[data-testid="company"]', 'a[href*="/companies/"]'],
                location: ['.job-location', '[data-testid="location"]', '.location'],
                employmentType: ['.job-type', '[data-testid="employment-type"]'],
                description: ['.job-description', '[data-testid="description"]', '.description'],
                salary: ['.salary-range', '[data-testid="salary"]', '.compensation'],
                benefits: ['.benefits', '[data-testid="benefits"]']
            },
            naukri: {
                title: ['h1.jd-header-title', '[data-test-id="jobTitle"]', '.job-title'],
                company: ['.jd-header-company', '[data-test-id="company"]', '.company-name'],
                location: ['.jd-location', '[data-test-id="location"]', '.location'],
                employmentType: ['.emp-type', '[data-test-id="employmentType"]'],
                description: ['.job-desc', '[data-test-id="jobDescription"]', '.description'],
                salary: ['.sal-wrap', '[data-test-id="salary"]', '.salary'],
                benefits: ['.benefits', '[data-test-id="benefits"]']
            },
            generic: {
                title: ['h1', '.job-title', '[data-testid="job-title"]', '.title'],
                company: ['.company', '.company-name', '[data-testid="company"]', 'h2'],
                location: ['.location', '.job-location', '[data-testid="location"]'],
                employmentType: ['.employment-type', '.job-type', '[data-testid="employment-type"]'],
                description: ['.description', '.job-description', 'main', 'article', '.content'],
                salary: ['.salary', '.salary-range', '[data-testid="salary"]'],
                benefits: ['.benefits', '.perks', '[data-testid="benefits"]']
            }
        };
    }

    /**
     * Build patterns for elements to ignore
     */
    buildIgnorePatterns() {
        return {
            selectors: [
                'nav', 'header', 'footer',
                'script', 'style', 'meta', 'link',
                '[role="navigation"]', '[role="contentinfo"]',
                '.navbar', '.navigation', '.header', '.footer',
                '.ads', '.advertisement', '[id*="ad"]', '[class*="ad-"]',
                '.comments', '.comment-section', '[role="complementary"]',
                'aside[role="complementary"]', '.sidebar',
                '.form', 'form', 'input', 'textarea',
                '.cookie-banner', '.modal-backdrop', '.overlay',
                '[style*="display: none"]', '[style*="visibility: hidden"]',
                '[aria-hidden="true"]',
                '.share-buttons', '.social-media',
                '.related-jobs', '.job-recommendations',
                'iframe', '.external-content'
            ],
            attributes: ['style', 'onclick', 'onerror', 'onload'],
            tags: ['script', 'style', 'meta', 'link', 'iframe']
        };
    }

    /**
     * Remove ignored elements from DOM
     */
    removeIgnoredElements(dom) {
        const { selectors } = this.elementsToIgnore;
        
        selectors.forEach(selector => {
            try {
                const elements = dom.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el && el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                });
            } catch (e) {
                // Skip invalid selectors
            }
        });

        // Remove hidden elements
        const allElements = dom.querySelectorAll('*');
        allElements.forEach(el => {
            try {
                const style = el.getAttribute('style') || '';
                if (style.includes('display:none') || style.includes('display: none') ||
                    style.includes('visibility:hidden') || style.includes('visibility: hidden')) {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                }
            } catch (e) {
                // Skip elements that error
            }
        });
    }

    /**
     * Detect main content container
     */
    detectMainContentContainer(dom) {
        const mainSelectors = [
            'main',
            '[role="main"]',
            'article',
            '[class*="main-content"]',
            '[class*="job-content"]',
            '[class*="job-details"]',
            '[id*="main"]',
            '[id*="content"]',
            '.container',
            '.job-posting'
        ];

        for (const selector of mainSelectors) {
            try {
                const element = dom.querySelector(selector);
                if (element) {
                    const textContent = element.textContent || '';
                    if (textContent.length > 200) {
                        return element;
                    }
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        // Fallback: return the body content
        return dom.querySelector('body') || dom;
    }

    /**
     * Extract job data by portal type
     */
    extractByPortal(dom, portal) {
        const selectors = this.contentSelectors[portal] || this.contentSelectors.generic;
        const mainContainer = this.detectMainContentContainer(dom);

        return {
            jobTitle: this.extractField(dom, mainContainer, selectors.title),
            company: this.extractField(dom, mainContainer, selectors.company),
            location: this.extractField(dom, mainContainer, selectors.location),
            employmentType: this.extractField(dom, mainContainer, selectors.employmentType),
            salary: this.extractField(dom, mainContainer, selectors.salary),
            experience: this.extractExperienceLevel(mainContainer),
            responsibilities: this.extractListItems(mainContainer, ['responsibilities', 'duties', 'what you', 'role', 'key responsibilities']),
            requirements: this.extractListItems(mainContainer, ['requirements', 'required', 'must have', 'minimum']),
            preferredQualifications: this.extractListItems(mainContainer, ['preferred', 'nice to have', 'bonus', 'plus', 'ideal']),
            benefits: this.extractListItems(mainContainer, ['benefits', 'perks', 'offer', 'compensation']),
            skills: this.extractSkills(mainContainer),
            fullDescription: this.extractFullDescription(mainContainer)
        };
    }

    /**
     * Extract a single field using multiple selectors
     */
    extractField(dom, container, selectors) {
        if (!Array.isArray(selectors)) {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            try {
                let element = container.querySelector(selector);
                if (!element) {
                    element = dom.querySelector(selector);
                }
                
                if (element) {
                    const text = this.getCleanText(element);
                    if (text && text.length > 0) {
                        return text;
                    }
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        return '';
    }

    /**
     * Extract list items from a container
     */
    extractListItems(container, keywords) {
        const items = [];
        
        // Find sections containing keywords
        const sections = this.findSectionsByKeywords(container, keywords);
        
        sections.forEach(section => {
            // Extract bullet points
            const listItems = section.querySelectorAll('li, [role="listitem"]');
            listItems.forEach(li => {
                const text = this.getCleanText(li);
                if (text && text.length > 10) {
                    items.push(text);
                }
            });

            // If no list items, try to extract paragraphs or divs
            if (items.length === 0) {
                const children = section.childNodes;
                let currentText = '';
                
                children.forEach(child => {
                    if (child.nodeType === 3) { // Text node
                        currentText += child.textContent;
                    } else if (child.nodeName === 'P' || child.nodeName === 'DIV') {
                        const text = this.getCleanText(child);
                        if (text && text.length > 10) {
                            items.push(text);
                        }
                    }
                });
            }
        });

        return items;
    }

    /**
     * Find sections by keywords
     */
    findSectionsByKeywords(container, keywords) {
        const sections = [];
        const allHeadings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');

        allHeadings.forEach(heading => {
            const headingText = this.getCleanText(heading).toLowerCase();
            
            for (const keyword of keywords) {
                if (headingText.includes(keyword.toLowerCase())) {
                    // Found a matching section header
                    let section = heading.nextElementSibling;
                    let sectionContainer = document.createElement('div');
                    
                    // Collect content until next heading
                    while (section && !this.isHeading(section)) {
                        sectionContainer.appendChild(section.cloneNode(true));
                        section = section.nextElementSibling;
                    }
                    
                    if (sectionContainer.textContent.length > 0) {
                        sections.push(sectionContainer);
                    }
                    break;
                }
            }
        });

        return sections;
    }

    /**
     * Check if element is a heading
     */
    isHeading(element) {
        return /^H[1-6]$/.test(element.nodeName) || element.getAttribute('role') === 'heading';
    }

    /**
     * Extract experience level from content
     */
    extractExperienceLevel(container) {
        const text = this.getCleanText(container).toLowerCase();
        
        const patterns = [
            { level: 'Senior', regex: /\b(senior|sr\.|lead|principal|staff)\s+(?:engineer|developer|manager)/i },
            { level: 'Mid-Level', regex: /\b(mid-level|intermediate|mid level)\b/i },
            { level: 'Junior', regex: /\b(junior|jr\.|entry|entry-level|entry level)\b/i },
            { level: 'Intern', regex: /\b(intern|internship)\b/i }
        ];

        for (const { level, regex } of patterns) {
            if (regex.test(text)) {
                return level;
            }
        }

        // Try to extract years of experience
        const yearsMatch = text.match(/(\d+)\+?\s*years?\s*(?:of)?\s*experience/i);
        if (yearsMatch) {
            const years = parseInt(yearsMatch[1]);
            if (years >= 8) return 'Senior';
            if (years >= 4) return 'Mid-Level';
            if (years >= 1) return 'Junior';
            return 'Entry-Level';
        }

        return '';
    }

    /**
     * Extract skills from description
     */
    extractSkills(container) {
        const skills = new Set();
        const text = this.getCleanText(container).toLowerCase();

        // Common technical skills
        const technicalSkills = [
            'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php',
            'react', 'angular', 'vue', 'svelte', 'nodejs', 'express', 'django', 'flask',
            'mongodb', 'postgresql', 'mysql', 'redis', 'sql', 'aws', 'azure', 'gcp',
            'docker', 'kubernetes', 'git', 'html', 'css', 'sass', 'webpack', 'jenkins',
            'machine learning', 'ai', 'tensorflow', 'pytorch', 'data science'
        ];

        technicalSkills.forEach(skill => {
            const regex = new RegExp(`\\b${skill}\\b`, 'gi');
            if (regex.test(text)) {
                skills.add(skill);
            }
        });

        return Array.from(skills);
    }

    /**
     * Extract full job description
     */
    extractFullDescription(container) {
        let description = this.getCleanText(container);
        
        // Limit description length
        if (description.length > 10000) {
            description = description.substring(0, 10000) + '...';
        }

        return description;
    }

    /**
     * Get clean text from element
     */
    getCleanText(element) {
        if (!element) return '';

        let text = element.textContent || '';
        
        // Clean up whitespace
        text = text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();

        // Remove common noise
        text = text
            .replace(/×/g, '')
            .replace(/✕/g, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '');

        return text;
    }

    /**
     * Post-process and validate extracted data
     */
    postProcessJobData(jobData) {
        // Clean and trim all string fields
        Object.keys(jobData).forEach(key => {
            if (typeof jobData[key] === 'string') {
                jobData[key] = jobData[key].trim();
            } else if (Array.isArray(jobData[key])) {
                jobData[key] = jobData[key].filter(item => item && item.length > 0);
            }
        });

        // Calculate confidence score
        const confidence = this.calculateConfidence(jobData);

        return {
            ...jobData,
            confidence,
            extractedAt: new Date().toISOString(),
            isValid: confidence > 40
        };
    }

    /**
     * Calculate confidence score for extraction
     */
    calculateConfidence(jobData) {
        let score = 0;
        const weights = {
            jobTitle: 25,
            company: 20,
            location: 10,
            employmentType: 5,
            salary: 5,
            experience: 5,
            responsibilities: 10,
            requirements: 10,
            skills: 5,
            fullDescription: 5
        };

        Object.entries(weights).forEach(([key, weight]) => {
            if (jobData[key]) {
                if (typeof jobData[key] === 'string' && jobData[key].length > 0) {
                    score += weight;
                } else if (Array.isArray(jobData[key]) && jobData[key].length > 0) {
                    score += weight;
                }
            }
        });

        return score;
    }
}

module.exports = DOMExtractor;
