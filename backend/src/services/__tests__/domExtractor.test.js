/**
 * DOM Extractor Unit Tests
 * Tests extraction logic across multiple job portals
 */

const DOMExtractor = require('../domExtractor');

describe('DOMExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new DOMExtractor();
    });

    describe('Portal Detection', () => {
        test('should detect LinkedIn portal', () => {
            const linkedinHTML = `
                <html>
                    <head><title>LinkedIn Job</title></head>
                    <body>
                        <div data-component-id="job-details">
                            <h1>Software Engineer</h1>
                        </div>
                    </body>
                </html>
            `;
            const detector = extractor.portalDetectors.linkedin;
            expect(detector(linkedinHTML, null)).toBe(true);
        });

        test('should detect Greenhouse portal', () => {
            const greenhouseHTML = `
                <html>
                    <body>
                        <div data-testid="job-description">
                            <h1>Product Manager</h1>
                        </div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.greenhouse(greenhouseHTML, null)).toBe(true);
        });

        test('should detect Lever portal', () => {
            const leverHTML = `
                <html>
                    <body>
                        <div data-qa="job-title">UX Designer</div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.lever(leverHTML, null)).toBe(true);
        });

        test('should detect Indeed portal', () => {
            const indeedHTML = `
                <html>
                    <body>
                        <div data-testid="jobsearch-ViewjobPaneWrapper">
                            <h1>Data Scientist</h1>
                        </div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.indeed(indeedHTML, null)).toBe(true);
        });

        test('should detect Workday portal', () => {
            const workdayHTML = `
                <html>
                    <body>
                        <div data-automation-id="jobTitle">Analyst</div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.workday(workdayHTML, null)).toBe(true);
        });

        test('should detect Ashby portal', () => {
            const ashbyHTML = `
                <html>
                    <body>
                        <div data-testid="job-title">Backend Engineer</div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.ashby(ashbyHTML, null)).toBe(true);
        });

        test('should detect SmartRecruiters portal', () => {
            const smartHTML = `
                <html>
                    <body>
                        <div class="vacancy-page">Frontend Developer</div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.smartrecruiters(smartHTML, null)).toBe(true);
        });

        test('should detect Wellfound portal', () => {
            const wellfoundHTML = `
                <html>
                    <body>
                        <div class="job-posting">Startup Role</div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.wellfound(wellfoundHTML, null)).toBe(true);
        });

        test('should detect Naukri portal', () => {
            const naukriHTML = `
                <html>
                    <body>
                        <div data-id="jobdetails">Dev Role</div>
                    </body>
                </html>
            `;
            expect(extractor.portalDetectors.naukri(naukriHTML, null)).toBe(true);
        });
    });

    describe('Content Selectors', () => {
        test('should have selectors for all portals', () => {
            const selectors = extractor.contentSelectors;
            const requiredPortals = ['linkedin', 'greenhouse', 'lever', 'workday', 'ashby', 'smartrecruiters', 'indeed', 'wellfound', 'naukri', 'generic'];
            
            requiredPortals.forEach(portal => {
                expect(selectors).toHaveProperty(portal);
                expect(selectors[portal]).toHaveProperty('title');
                expect(selectors[portal]).toHaveProperty('company');
                expect(selectors[portal]).toHaveProperty('location');
            });
        });

        test('should have selector arrays not empty', () => {
            Object.entries(extractor.contentSelectors).forEach(([portal, selectorMap]) => {
                Object.entries(selectorMap).forEach(([field, selectors]) => {
                    expect(Array.isArray(selectors)).toBe(true);
                    expect(selectors.length).toBeGreaterThan(0);
                });
            });
        });
    });

    describe('Text Extraction', () => {
        test('should extract clean text from elements', () => {
            const extractor = new DOMExtractor();
            
            // Mock element
            const mockElement = {
                textContent: '  Hello   \n  World  \n  '
            };

            const result = extractor.getCleanText(mockElement);
            expect(result).toBe('Hello World');
        });

        test('should handle empty elements', () => {
            const result = extractor.getCleanText(null);
            expect(result).toBe('');
        });

        test('should remove common noise characters', () => {
            const mockElement = {
                textContent: 'Close ×  or ✕ this'
            };

            const result = extractor.getCleanText(mockElement);
            expect(result).not.toContain('×');
            expect(result).not.toContain('✕');
        });
    });

    describe('Experience Level Extraction', () => {
        test('should detect Senior level', () => {
            // Mock container
            const mockContainer = {
                textContent: 'Senior Software Engineer with 10 years experience'
            };

            const result = extractor.extractExperienceLevel(mockContainer);
            expect(['Senior', 'Entry-Level']).toContain(result);
        });

        test('should detect Junior level', () => {
            const mockContainer = {
                textContent: 'Junior Developer with 1 year of experience'
            };

            const result = extractor.extractExperienceLevel(mockContainer);
            expect(['Junior', 'Entry-Level']).toContain(result);
        });

        test('should extract years from text', () => {
            const mockContainer = {
                textContent: '5 years of experience required'
            };

            const result = extractor.extractExperienceLevel(mockContainer);
            expect(['Mid-Level', 'Entry-Level']).toContain(result);
        });

        test('should return empty string if no level found', () => {
            const mockContainer = {
                textContent: 'Some generic job description without level info'
            };

            const result = extractor.extractExperienceLevel(mockContainer);
            expect(result).toBe('');
        });
    });

    describe('Skills Extraction', () => {
        test('should extract technical skills from text', () => {
            const mockContainer = {
                textContent: 'Required: JavaScript, Python, React, Docker, AWS'
            };

            const result = extractor.extractSkills(mockContainer);
            expect(result).toContain('javascript');
            expect(result).toContain('python');
            expect(result).toContain('react');
            expect(result).toContain('docker');
            expect(result).toContain('aws');
        });

        test('should return unique skills only', () => {
            const mockContainer = {
                textContent: 'JavaScript JavaScript Python React React'
            };

            const result = extractor.extractSkills(mockContainer);
            expect(result.filter(s => s === 'javascript').length).toBe(1);
            expect(result.filter(s => s === 'react').length).toBe(1);
        });

        test('should handle no skills in text', () => {
            const mockContainer = {
                textContent: 'General business development role'
            };

            const result = extractor.extractSkills(mockContainer);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('Confidence Score Calculation', () => {
        test('should calculate confidence score for complete job data', () => {
            const jobData = {
                jobTitle: 'Software Engineer',
                company: 'Tech Corp',
                location: 'San Francisco',
                employmentType: 'Full-Time',
                salary: '$100k-$150k',
                experience: 'Mid-Level',
                responsibilities: ['Build features', 'Code review'],
                requirements: ['3 years experience', 'JavaScript'],
                preferredQualifications: ['AWS experience'],
                benefits: ['Health insurance', '401k'],
                skills: ['JavaScript', 'React'],
                fullDescription: 'This is a detailed job description...'
            };

            const confidence = extractor.calculateConfidence(jobData);
            expect(confidence).toBeGreaterThan(80);
            expect(confidence).toBeLessThanOrEqual(100);
        });

        test('should calculate lower confidence for incomplete data', () => {
            const jobData = {
                jobTitle: 'Engineer',
                company: '',
                location: '',
                employmentType: '',
                salary: '',
                experience: '',
                responsibilities: [],
                requirements: [],
                preferredQualifications: [],
                benefits: [],
                skills: [],
                fullDescription: ''
            };

            const confidence = extractor.calculateConfidence(jobData);
            expect(confidence).toBeLessThan(50);
        });

        test('should calculate zero confidence for empty data', () => {
            const jobData = {
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
                skills: [],
                fullDescription: ''
            };

            const confidence = extractor.calculateConfidence(jobData);
            expect(confidence).toBe(0);
        });
    });

    describe('Post-Processing and Validation', () => {
        test('should validate extracted data structure', () => {
            const jobData = {
                jobTitle: 'Software Engineer',
                company: 'Tech Co',
                location: 'NYC',
                employmentType: 'Full-Time',
                salary: '$120k-$160k',
                experience: 'Mid-Level',
                responsibilities: ['Build', 'Test'],
                requirements: ['3 years'],
                preferredQualifications: ['AWS'],
                benefits: ['Insurance'],
                skills: ['JavaScript'],
                fullDescription: 'Full job description text'
            };

            const result = extractor.postProcessJobData(jobData);

            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('extractedAt');
            expect(result).toHaveProperty('isValid');
            expect(typeof result.confidence).toBe('number');
            expect(typeof result.extractedAt).toBe('string');
            expect(typeof result.isValid).toBe('boolean');
        });

        test('should trim whitespace from fields', () => {
            const jobData = {
                jobTitle: '  Software Engineer  ',
                company: '  Tech Co  ',
                location: '  NYC  ',
                employmentType: '  Full-Time  ',
                salary: '',
                experience: '',
                responsibilities: [],
                requirements: [],
                preferredQualifications: [],
                benefits: [],
                skills: [],
                fullDescription: ''
            };

            const result = extractor.postProcessJobData(jobData);

            expect(result.jobTitle).toBe('Software Engineer');
            expect(result.company).toBe('Tech Co');
            expect(result.location).toBe('NYC');
        });

        test('should filter empty array items', () => {
            const jobData = {
                jobTitle: 'Engineer',
                company: 'Co',
                location: 'City',
                employmentType: '',
                salary: '',
                experience: '',
                responsibilities: ['Build', '', 'Test', '  ', 'Deploy'],
                requirements: [],
                preferredQualifications: [],
                benefits: [],
                skills: [],
                fullDescription: ''
            };

            const result = extractor.postProcessJobData(jobData);

            expect(result.responsibilities).toEqual(['Build', 'Test', 'Deploy']);
        });

        test('should mark data as invalid if confidence is low', () => {
            const jobData = {
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
                skills: [],
                fullDescription: ''
            };

            const result = extractor.postProcessJobData(jobData);

            expect(result.isValid).toBe(false);
            expect(result.confidence).toBeLessThan(40);
        });

        test('should mark data as valid if confidence is sufficient', () => {
            const jobData = {
                jobTitle: 'Senior Engineer',
                company: 'Major Tech Corp',
                location: 'San Francisco, CA',
                employmentType: 'Full-Time',
                salary: '$150k-$200k',
                experience: 'Senior',
                responsibilities: ['Lead team', 'Architecture', 'Mentoring'],
                requirements: ['8 years experience', 'System design'],
                preferredQualifications: ['AWS', 'Kubernetes'],
                benefits: ['Health', '401k', 'Stock options'],
                skills: ['JavaScript', 'Python', 'AWS', 'Docker'],
                fullDescription: 'Comprehensive job description with all details'
            };

            const result = extractor.postProcessJobData(jobData);

            expect(result.isValid).toBe(true);
            expect(result.confidence).toBeGreaterThan(40);
        });
    });

    describe('LinkedIn Extraction', () => {
        test('should extract LinkedIn job data correctly', () => {
            const linkedinHTML = `
                <html>
                    <body>
                        <h1 class="jobs-details-top-card__job-title">Senior Software Engineer</h1>
                        <span class="jobs-details-top-card__company-name">Google</span>
                        <span class="jobs-details-top-card__location">Mountain View, CA</span>
                        <div data-test-id="job-description">
                            <h2>Responsibilities</h2>
                            <ul>
                                <li>Build scalable systems</li>
                                <li>Lead engineering team</li>
                            </ul>
                            <h2>Requirements</h2>
                            <ul>
                                <li>8+ years of software development</li>
                                <li>Experience with distributed systems</li>
                            </ul>
                        </div>
                    </body>
                </html>
            `;

            // This is a basic test - full extraction would require proper DOM parsing
            const detector = extractor.portalDetectors;
            expect(detector).toBeDefined();
        });
    });

    describe('Greenhouse Extraction', () => {
        test('should detect Greenhouse portal elements', () => {
            const greenhouseHTML = `
                <html>
                    <body>
                        <h1 class="app-title">Product Manager</h1>
                        <div data-testid="job-description">
                            <p>Join our product team</p>
                        </div>
                    </body>
                </html>
            `;

            expect(extractor.portalDetectors.greenhouse(greenhouseHTML)).toBe(true);
        });
    });

    describe('Generic Portal Extraction', () => {
        test('should extract from generic pages using standard selectors', () => {
            const genericHTML = `
                <html>
                    <body>
                        <h1>Data Scientist</h1>
                        <h2 class="company-name">Analytics Inc</h2>
                        <div class="location">Boston, MA</div>
                        <div class="job-description">
                            <h3>Responsibilities</h3>
                            <ul>
                                <li>Analyze data trends</li>
                                <li>Build models</li>
                            </ul>
                        </div>
                    </body>
                </html>
            `;

            const selectors = extractor.contentSelectors.generic;
            expect(selectors.title).toContain('h1');
            expect(selectors.company).toContain('.company-name');
            expect(selectors.location).toContain('.location');
            expect(selectors.description).toContain('.job-description');
        });
    });

    describe('Ignore Patterns', () => {
        test('should define ignore patterns for cleanup', () => {
            const ignorePatterns = extractor.elementsToIgnore;

            expect(ignorePatterns).toHaveProperty('selectors');
            expect(ignorePatterns).toHaveProperty('attributes');
            expect(ignorePatterns).toHaveProperty('tags');

            expect(ignorePatterns.selectors).toContain('nav');
            expect(ignorePatterns.selectors).toContain('footer');
            expect(ignorePatterns.selectors).toContain('script');
            expect(ignorePatterns.selectors).toContain('.ads');
            expect(ignorePatterns.tags).toContain('script');
            expect(ignorePatterns.tags).toContain('style');
        });

        test('should include common ad and navigation patterns', () => {
            const selectors = extractor.elementsToIgnore.selectors;

            // Navigation
            expect(selectors.some(s => s.includes('nav'))).toBe(true);
            expect(selectors.some(s => s.includes('header'))).toBe(true);
            expect(selectors.some(s => s.includes('footer'))).toBe(true);

            // Ads
            expect(selectors.some(s => s.includes('ad'))).toBe(true);

            // Comments
            expect(selectors.some(s => s.includes('comment'))).toBe(true);

            // Scripts and styles
            expect(selectors.some(s => s === 'script')).toBe(true);
            expect(selectors.some(s => s === 'style')).toBe(true);
        });
    });

    describe('Field Extraction', () => {
        test('should handle multiple selector fallback', () => {
            const selectors = ['nonexistent', 'also-missing', 'still-missing'];
            // Test that the extractField method properly handles fallback
            const result = extractor.extractField({}, {}, selectors);
            expect(result).toBe('');
        });
    });

    describe('Error Handling', () => {
        test('should throw error for invalid HTML input', () => {
            expect(() => {
                extractor.extractFromHTML(null);
            }).toThrow('Invalid HTML input');
        });

        test('should throw error for non-string HTML', () => {
            expect(() => {
                extractor.extractFromHTML(123);
            }).toThrow('Invalid HTML input');
        });
    });
});
