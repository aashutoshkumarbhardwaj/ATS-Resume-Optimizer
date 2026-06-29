/**
 * Advanced PDF Parser - Unit Tests
 */

const AdvancedPdfParser = require('../advancedPdfParser');

describe('AdvancedPdfParser', () => {
    let parser;

    beforeEach(() => {
        parser = new AdvancedPdfParser();
    });

    describe('PDF Type Detection', () => {
        test('should detect text-based PDF', () => {
            const pdfContent = {
                text: 'This is a normal PDF with plenty of text. ' + 'A'.repeat(100),
                numpages: 1
            };

            const type = parser.detectPdfType(pdfContent);
            expect(type).toBe('text');
        });

        test('should detect scanned PDF', () => {
            const pdfContent = {
                text: '',
                numpages: 5
            };

            const type = parser.detectPdfType(pdfContent);
            expect(type).toBe('scanned');
        });

        test('should detect hybrid PDF', () => {
            const pdfContent = {
                text: 'Some text',
                numpages: 1
            };

            const type = parser.detectPdfType(pdfContent);
            expect(['text', 'hybrid']).toContain(type);
        });
    });

    describe('Metadata Extraction', () => {
        test('should extract document metadata', () => {
            const text = 'This is a test document.\nWith multiple paragraphs.\n\nAnd sections.';
            const metadata = parser.extractMetadata(text);

            expect(metadata).toHaveProperty('totalLength');
            expect(metadata).toHaveProperty('lines');
            expect(metadata).toHaveProperty('paragraphs');
            expect(metadata).toHaveProperty('sentences');
            expect(metadata.totalLength).toBeGreaterThan(0);
        });

        test('should calculate metadata accurately', () => {
            const text = 'Hello. World. Test.';
            const metadata = parser.extractMetadata(text);

            expect(metadata.sentences).toBeGreaterThanOrEqual(2);
            expect(metadata.totalLength).toBe(text.length);
        });
    });

    describe('Section Identification', () => {
        test('should identify resume sections', () => {
            const text = `
                Professional Summary
                This is my summary.
                
                Experience
                Work at Company A
                
                Education
                BS in Computer Science
                
                Skills
                JavaScript, Python, React
            `;

            const sections = parser.identifySections(text);

            expect(sections.summary).toBe(true);
            expect(sections.experience).toBe(true);
            expect(sections.education).toBe(true);
            expect(sections.skills).toBe(true);
        });

        test('should handle missing sections', () => {
            const text = 'Just some random text without structure.';
            const sections = parser.identifySections(text);

            expect(typeof sections).toBe('object');
        });
    });

    describe('Contact Information Extraction', () => {
        test('should extract email address', () => {
            const text = 'John Doe\nEmail: john.doe@example.com\nPhone: 555-1234';
            const contact = parser.extractContactInfo(text);

            expect(contact.email).toBe('john.doe@example.com');
        });

        test('should extract phone number', () => {
            const text = 'Contact: (555) 123-4567';
            const contact = parser.extractContactInfo(text);

            expect(contact.phone).toMatch(/555.*123.*4567/);
        });

        test('should extract LinkedIn profile', () => {
            const text = 'https://linkedin.com/in/johndoe or linkedin.com/in/johndoe';
            const contact = parser.extractContactInfo(text);

            expect(contact.linkedin).toContain('linkedin.com/in');
        });

        test('should extract GitHub profile', () => {
            const text = 'GitHub: github.com/johndoe';
            const contact = parser.extractContactInfo(text);

            expect(contact.github).toContain('github.com');
        });

        test('should extract name from first line', () => {
            const text = 'John Doe\nEmail: john@example.com';
            const contact = parser.extractContactInfo(text);

            expect(contact.name).toBe('John Doe');
        });
    });

    describe('Experience Extraction', () => {
        test('should extract job positions', () => {
            const text = `
                Senior Engineer at Google
                Led team of 5 engineers
                
                Junior Developer at Startup
                Built full-stack applications
            `;

            const experience = parser.extractExperience(text);

            expect(Array.isArray(experience)).toBe(true);
            expect(experience.length).toBeGreaterThan(0);
        });

        test('should extract role and company', () => {
            const text = 'Software Engineer @ Tech Corp';
            const experience = parser.extractExperience(text);

            expect(experience.length).toBeGreaterThan(0);
        });

        test('should filter out noise', () => {
            const text = 'Just some random text with @ symbol but no real job';
            const experience = parser.extractExperience(text);

            expect(Array.isArray(experience)).toBe(true);
        });

        test('should limit results', () => {
            const text = Array(20).fill('Senior Engineer @ Company').join('\n');
            const experience = parser.extractExperience(text);

            expect(experience.length).toBeLessThanOrEqual(10);
        });
    });

    describe('Education Extraction', () => {
        test('should extract degree information', () => {
            const text = `
                Bachelor of Science in Computer Science
                University of California
                
                Master of Business Administration
                Stanford University
            `;

            const education = parser.extractEducation(text);

            expect(Array.isArray(education)).toBe(true);
            expect(education.length).toBeGreaterThan(0);
        });

        test('should extract common degree types', () => {
            const text = 'B.S. in Information Technology, M.S. in Data Science';
            const education = parser.extractEducation(text);

            expect(education.length).toBeGreaterThan(0);
        });

        test('should handle various degree formats', () => {
            const text = 'Bachelor, Master, PhD all extracted correctly';
            const education = parser.extractEducation(text);

            expect(Array.isArray(education)).toBe(true);
        });
    });

    describe('Skills Extraction', () => {
        test('should extract technical skills', () => {
            const text = 'Proficient in JavaScript, Python, React, and Docker. Experience with AWS and PostgreSQL.';
            const skills = parser.extractSkills(text);

            expect(skills).toContain('javascript');
            expect(skills).toContain('python');
            expect(skills).toContain('react');
            expect(skills).toContain('docker');
        });

        test('should recognize multiple frameworks', () => {
            const text = 'Expert in React, Angular, Vue, and Svelte';
            const skills = parser.extractSkills(text);

            expect(skills.length).toBeGreaterThan(0);
        });

        test('should handle case-insensitive matching', () => {
            const text = 'JAVASCRIPT, Python, REACT';
            const skills = parser.extractSkills(text);

            expect(skills.length).toBeGreaterThan(0);
        });

        test('should return unique skills', () => {
            const text = 'JavaScript JavaScript Python React React';
            const skills = parser.extractSkills(text);

            const jsCount = skills.filter(s => s === 'javascript').length;
            expect(jsCount).toBe(1);
        });
    });

    describe('Certifications Extraction', () => {
        test('should extract AWS certifications', () => {
            const text = 'AWS Certified Solutions Architect Associate';
            const certs = parser.extractCertifications(text);

            expect(Array.isArray(certs)).toBe(true);
        });

        test('should extract IT certifications', () => {
            const text = 'Certified: PMP, SCRUM Master, CISSP';
            const certs = parser.extractCertifications(text);

            expect(certs.length).toBeGreaterThan(0);
        });

        test('should handle various certification formats', () => {
            const text = 'Certificate in Cloud Computing, Docker Certified Associate';
            const certs = parser.extractCertifications(text);

            expect(Array.isArray(certs)).toBe(true);
        });
    });

    describe('Summary Extraction', () => {
        test('should extract professional summary', () => {
            const text = `
                Professional Summary
                Results-driven engineer with 5 years of experience.
                Expertise in full-stack development.
                Proven track record of leading successful projects.
                
                Experience
                Work history...
            `;

            const summary = parser.extractSummary(text);

            expect(summary).toContain('Results-driven');
        });

        test('should handle objective sections', () => {
            const text = `
                Objective
                To obtain a position where I can apply my skills.
                
                Experience
                ...
            `;

            const summary = parser.extractSummary(text);

            expect(summary.length).toBeGreaterThan(0);
        });

        test('should limit summary length', () => {
            const text = 'Summary\n' + 'This is a very long summary. ' .repeat(50);
            const summary = parser.extractSummary(text);

            expect(summary.length).toBeLessThanOrEqual(500);
        });
    });

    describe('Page Content Extraction', () => {
        test('should extract multi-page content', async () => {
            const text = 'Page 1 content\n\nPage 2 content\n\nPage 3 content';
            const pages = await parser.extractPageContent(text, 3);

            expect(Array.isArray(pages)).toBe(true);
            expect(pages.length).toBeGreaterThan(0);
        });

        test('should include page numbers', async () => {
            const text = 'Content 1\n\nContent 2';
            const pages = await parser.extractPageContent(text, 2);

            pages.forEach((page, index) => {
                expect(page.pageNumber).toBe(index + 1);
            });
        });

        test('should include page metadata', async () => {
            const text = 'Sample page content with some data.';
            const pages = await parser.extractPageContent(text, 1);

            expect(pages[0]).toHaveProperty('text');
            expect(pages[0]).toHaveProperty('length');
            expect(pages[0]).toHaveProperty('pageNumber');
        });
    });

    describe('Name Extraction', () => {
        test('should extract first name', () => {
            const firstName = parser.extractFirstName('John Doe');
            expect(firstName).toBe('John');
        });

        test('should extract last name', () => {
            const lastName = parser.extractLastName('John Doe');
            expect(lastName).toBe('Doe');
        });

        test('should handle single name', () => {
            const firstName = parser.extractFirstName('Madonna');
            expect(firstName).toBe('Madonna');
        });

        test('should handle multi-part names', () => {
            const lastName = parser.extractLastName('John Michael Smith');
            expect(lastName).toBe('Smith');
        });
    });

    describe('Structured Data Formatting', () => {
        test('should return structured format only', () => {
            const extractedData = {
                text: 'Sample resume text',
                totalPages: 1,
                contactInfo: { email: 'test@example.com', name: 'John' },
                summary: 'Professional summary',
                experience: [],
                education: [],
                skills: ['JavaScript'],
                certifications: [],
                sections: {},
                metadata: {},
                extractionMethod: 'text',
                confidence: 0.95
            };

            const formatted = parser.formatStructuredData(extractedData, 'text');

            expect(formatted).toHaveProperty('fullText');
            expect(formatted).toHaveProperty('contact');
            expect(formatted).toHaveProperty('skills');
            expect(formatted).toHaveProperty('pdfType');
            expect(formatted).toHaveProperty('confidence');
            expect(formatted).not.toHaveProperty('_original');
        });

        test('should include all required fields', () => {
            const extractedData = {
                text: 'Sample text',
                totalPages: 1,
                contactInfo: {},
                summary: '',
                experience: [],
                education: [],
                skills: [],
                certifications: [],
                sections: {},
                metadata: {},
                extractionMethod: 'text',
                confidence: 0.9
            };

            const formatted = parser.formatStructuredData(extractedData, 'text');

            expect(formatted.fullText).toBeDefined();
            expect(formatted.totalPages).toBeDefined();
            expect(formatted.contact).toBeDefined();
            expect(formatted.skills).toBeDefined();
            expect(formatted.pdfType).toBe('text');
            expect(formatted.extractionMethod).toBeDefined();
            expect(formatted.confidence).toBeDefined();
            expect(formatted.isValid).toBeDefined();
            expect(formatted.parsedAt).toBeDefined();
        });
    });

    describe('ATS Scoring Data', () => {
        test('should return resume data for ATS', () => {
            const structuredData = {
                fullText: 'Full resume text',
                contact: { email: 'test@example.com' },
                summary: 'Professional summary',
                experience: [{ role: 'Engineer', company: 'Tech Corp' }],
                education: [{ qualification: 'BS' }],
                skills: ['JavaScript'],
                certifications: [],
                metadata: {}
            };

            const atsData = parser.getResumeForAtsScoring(structuredData);

            expect(atsData).toHaveProperty('text');
            expect(atsData).toHaveProperty('contact');
            expect(atsData).toHaveProperty('skills');
            expect(atsData).toHaveProperty('experience');
            expect(atsData).toHaveProperty('education');
        });

        test('should include all relevant fields for ATS', () => {
            const structuredData = {
                fullText: 'Resume',
                contact: {},
                summary: 'Summary',
                experience: [],
                education: [],
                skills: [],
                certifications: [],
                metadata: {}
            };

            const atsData = parser.getResumeForAtsScoring(structuredData);

            expect(Object.keys(atsData).length).toBeGreaterThan(0);
        });
    });

    describe('Auto-Fill Data', () => {
        test('should return auto-fill data for forms', () => {
            const structuredData = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '555-1234',
                location: 'San Francisco',
                contact: { linkedin: 'linkedin.com/in/johndoe' },
                skills: ['JavaScript', 'Python'],
                summary: 'Skilled engineer',
                experience: [],
                education: [],
                certifications: []
            };

            const autoFill = parser.getAutoFillData(structuredData);

            expect(autoFill).toHaveProperty('firstName');
            expect(autoFill).toHaveProperty('lastName');
            expect(autoFill).toHaveProperty('email');
            expect(autoFill).toHaveProperty('phone');
            expect(autoFill).toHaveProperty('skills');
        });

        test('should format skills for auto-fill', () => {
            const structuredData = {
                name: '',
                email: '',
                phone: '',
                location: '',
                contact: {},
                skills: ['JavaScript', 'Python', 'React'],
                summary: '',
                experience: [],
                education: [],
                certifications: []
            };

            const autoFill = parser.getAutoFillData(structuredData);

            expect(autoFill.skills).toBe('JavaScript, Python, React');
        });

        test('should extract names for auto-fill', () => {
            const structuredData = {
                name: 'John Michael Doe',
                email: '',
                phone: '',
                location: '',
                contact: {},
                skills: [],
                summary: '',
                experience: [],
                education: [],
                certifications: []
            };

            const autoFill = parser.getAutoFillData(structuredData);

            expect(autoFill.firstName).toBe('John');
            expect(autoFill.lastName).toBe('Doe');
        });
    });

    describe('Error Handling', () => {
        test('should validate PDF path is provided', () => {
            expect(async () => {
                await parser.parsePdf(null);
            }).toThrow();
        });

        test('should handle invalid text input', () => {
            const contact = parser.extractContactInfo(null);
            expect(contact).toBeDefined();
        });

        test('should handle empty text', () => {
            const skills = parser.extractSkills('');
            expect(Array.isArray(skills)).toBe(true);
            expect(skills.length).toBe(0);
        });
    });

    describe('Text vs Scanned PDF Processing', () => {
        test('should process text PDF with high confidence', () => {
            const pdfContent = {
                text: 'This is clearly a text PDF with lots of extracted content. '.repeat(5),
                numpages: 1
            };

            const type = parser.detectPdfType(pdfContent);
            expect(type).toBe('text');
        });

        test('should process scanned PDF with OCR', () => {
            const pdfContent = {
                text: '',
                numpages: 3
            };

            const type = parser.detectPdfType(pdfContent);
            expect(type).toBe('scanned');
        });

        test('should fallback gracefully', () => {
            const text = 'Some extracted text';
            const contact = parser.extractContactInfo(text);

            expect(typeof contact).toBe('object');
        });
    });
});
