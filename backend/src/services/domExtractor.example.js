/**
 * DOM Extractor - Usage Examples
 * Demonstrates how to use the DOM Extraction Service
 */

const DOMExtractor = require('./domExtractor');
const fs = require('fs');

/**
 * Example 1: Basic extraction from a LinkedIn job posting
 */
function example1_LinkedInExtraction() {
    console.log('\n=== Example 1: LinkedIn Job Extraction ===\n');

    const extractor = new DOMExtractor();

    // Sample LinkedIn HTML (in real scenario, you'd fetch this from a URL)
    const linkedinHTML = `
        <html>
            <body>
                <nav>Navigation</nav>
                <main>
                    <h1 class="jobs-details-top-card__job-title">Senior Software Engineer</h1>
                    <span class="jobs-details-top-card__company-name">Google</span>
                    <span class="jobs-details-top-card__location">Mountain View, CA</span>
                    <div data-test-id="job-description">
                        <h2>Responsibilities</h2>
                        <ul>
                            <li>Design scalable systems</li>
                            <li>Lead engineering team</li>
                        </ul>
                        <h2>Requirements</h2>
                        <ul>
                            <li>8+ years of software development</li>
                            <li>Experience with distributed systems</li>
                        </ul>
                    </div>
                </main>
                <footer>© LinkedIn 2024</footer>
            </body>
        </html>
    `;

    try {
        const result = extractor.extractFromHTML(linkedinHTML);
        console.log('Extracted Job Data:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Extraction failed:', error.message);
    }
}

/**
 * Example 2: Portal detection
 */
function example2_PortalDetection() {
    console.log('\n=== Example 2: Portal Detection ===\n');

    const extractor = new DOMExtractor();

    const testCases = [
        { name: 'LinkedIn', html: '<div data-component-id="job-details"></div>' },
        { name: 'Greenhouse', html: '<div data-testid="job-description"></div>' },
        { name: 'Lever', html: '<div data-qa="job-title"></div>' },
        { name: 'Workday', html: '<div data-automation-id="jobTitle"></div>' },
        { name: 'Indeed', html: '<div data-testid="jobsearch-ViewjobPaneWrapper"></div>' },
        { name: 'Generic', html: '<h1>Generic Job Title</h1>' }
    ];

    testCases.forEach(({ name, html }) => {
        const portal = extractor.detectPortal(html);
        console.log(`${name}: Detected as "${portal}"`);
    });
}

/**
 * Example 3: Extracting from different portals
 */
function example3_MultiPortalExtraction() {
    console.log('\n=== Example 3: Multi-Portal Extraction ===\n');

    const extractor = new DOMExtractor();

    const portals = [
        {
            name: 'Greenhouse',
            html: `
                <h1 class="app-title">Product Manager</h1>
                <a class="company-name">TechCorp</a>
                <div itemprop="jobLocation">San Francisco, CA</div>
            `
        },
        {
            name: 'Lever',
            html: `
                <div data-qa="job-title">Full Stack Engineer</div>
                <div data-qa="company-name">StartupXYZ</div>
                <div data-qa="job-location">Austin, TX</div>
            `
        }
    ];

    portals.forEach(({ name, html }) => {
        console.log(`\n${name}:`);
        const portal = extractor.detectPortal(html);
        console.log(`- Detected: ${portal}`);
    });
}

/**
 * Example 4: Confidence scoring
 */
function example4_ConfidenceScoring() {
    console.log('\n=== Example 4: Confidence Scoring ===\n');

    const extractor = new DOMExtractor();

    // High confidence extraction
    const highConfidence = {
        jobTitle: 'Senior Engineer',
        company: 'Major Tech Corp',
        location: 'San Francisco, CA',
        employmentType: 'Full-Time',
        salary: '$150k-$200k',
        experience: 'Senior',
        responsibilities: ['Build', 'Lead', 'Mentor'],
        requirements: ['8 years', 'System design'],
        preferredQualifications: ['AWS'],
        benefits: ['Health', '401k', 'Stock'],
        skills: ['JavaScript', 'Python', 'AWS'],
        fullDescription: 'Comprehensive job description...'
    };

    // Low confidence extraction
    const lowConfidence = {
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

    const highScore = extractor.calculateConfidence(highConfidence);
    const lowScore = extractor.calculateConfidence(lowConfidence);

    console.log(`High Confidence Score: ${highScore}/100`);
    console.log(`- All major fields present`);
    console.log(`- Data appears complete and valid\n`);

    console.log(`Low Confidence Score: ${lowScore}/100`);
    console.log(`- Missing most fields`);
    console.log(`- Data is incomplete`);
}

/**
 * Example 5: Error handling
 */
function example5_ErrorHandling() {
    console.log('\n=== Example 5: Error Handling ===\n');

    const extractor = new DOMExtractor();

    // Test 1: Invalid input
    console.log('Test 1: Invalid input');
    try {
        extractor.extractFromHTML(null);
    } catch (error) {
        console.log(`✓ Caught error: ${error.message}`);
    }

    // Test 2: Non-string input
    console.log('\nTest 2: Non-string input');
    try {
        extractor.extractFromHTML(123);
    } catch (error) {
        console.log(`✓ Caught error: ${error.message}`);
    }

    // Test 3: Empty HTML
    console.log('\nTest 3: Empty HTML');
    try {
        const result = extractor.extractFromHTML('');
        console.log(`✓ Handled gracefully - confidence: ${result.confidence}`);
    } catch (error) {
        console.log(`✓ Caught error: ${error.message}`);
    }
}

/**
 * Example 6: Field extraction from different section types
 */
function example6_FieldExtraction() {
    console.log('\n=== Example 6: Field Extraction ===\n');

    const extractor = new DOMExtractor();

    console.log('Available portal selectors:');
    const portals = Object.keys(extractor.contentSelectors);
    
    portals.forEach(portal => {
        const selectors = extractor.contentSelectors[portal];
        console.log(`\n${portal.toUpperCase()}:`);
        console.log(`- Title selectors: ${selectors.title.length}`);
        console.log(`- Company selectors: ${selectors.company.length}`);
        console.log(`- Location selectors: ${selectors.location.length}`);
        console.log(`- Description selectors: ${selectors.description.length}`);
    });
}

/**
 * Example 7: Skills extraction
 */
function example7_SkillsExtraction() {
    console.log('\n=== Example 7: Skills Extraction ===\n');

    const extractor = new DOMExtractor();

    const jobDescription = `
        We're looking for a developer proficient in JavaScript, TypeScript, Python, and Java.
        Experience with React, Vue, Angular frameworks is required.
        Knowledge of Node.js, Express, and Django is a plus.
        Database skills: MongoDB, PostgreSQL, MySQL.
        Cloud platforms: AWS, Azure, GCP.
        Containerization: Docker, Kubernetes.
        Collaboration tools: Git, GitHub, GitLab.
    `;

    const mockContainer = { textContent: jobDescription };
    const skills = extractor.extractSkills(mockContainer);

    console.log('Extracted Skills:');
    console.log(skills.join(', '));
}

/**
 * Example 8: Experience level detection
 */
function example8_ExperienceDetection() {
    console.log('\n=== Example 8: Experience Level Detection ===\n');

    const extractor = new DOMExtractor();

    const testCases = [
        { level: 'Senior', text: 'Senior Software Engineer with 10+ years experience' },
        { level: 'Mid-Level', text: 'Mid-level developer with 5 years experience' },
        { level: 'Junior', text: 'Junior developer with 1 year of experience' },
        { level: 'Entry', text: 'Entry-level role suitable for recent graduates' },
        { level: 'Intern', text: 'Internship position for students' }
    ];

    testCases.forEach(({ level, text }) => {
        const mockContainer = { textContent: text };
        const detected = extractor.extractExperienceLevel(mockContainer);
        console.log(`"${text}"`);
        console.log(`  → Detected: ${detected || 'Not detected'}\n`);
    });
}

/**
 * Example 9: Comparing portal support
 */
function example9_PortalComparison() {
    console.log('\n=== Example 9: Portal Support Matrix ===\n');

    const extractor = new DOMExtractor();
    const requiredFields = ['title', 'company', 'location', 'description', 'salary'];

    console.log('Portal Support Matrix:\n');
    console.log('Portal'.padEnd(20) + requiredFields.map(f => f.padEnd(12)).join(''));
    console.log('-'.repeat(80));

    Object.keys(extractor.contentSelectors).forEach(portal => {
        const selectors = extractor.contentSelectors[portal];
        let row = portal.padEnd(20);
        
        requiredFields.forEach(field => {
            const hasField = selectors[field] && selectors[field].length > 0 ? '✓' : '✗';
            row += hasField.padEnd(12);
        });
        
        console.log(row);
    });
}

/**
 * Example 10: Complete workflow
 */
function example10_CompleteWorkflow() {
    console.log('\n=== Example 10: Complete Extraction Workflow ===\n');

    const extractor = new DOMExtractor();

    const sampleHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>Job Posting - LinkedIn</title></head>
        <body>
            <nav>Navigation bar</nav>
            <main>
                <article data-component-id="job-details">
                    <h1 class="jobs-details-top-card__job-title">Senior Backend Engineer</h1>
                    <span class="jobs-details-top-card__company-name">TechCorp Inc</span>
                    <span class="jobs-details-top-card__location">New York, NY</span>
                    <div class="job-insight">Full-time, On-site</div>
                    
                    <div data-test-id="job-description">
                        <h2>About the Role</h2>
                        <p>We're seeking an experienced backend engineer to lead our platform development.</p>
                        
                        <h2>Responsibilities</h2>
                        <ul>
                            <li>Design and implement scalable APIs</li>
                            <li>Optimize database performance</li>
                            <li>Lead code reviews and mentoring</li>
                        </ul>
                        
                        <h2>Requirements</h2>
                        <ul>
                            <li>7+ years of backend development</li>
                            <li>Strong expertise in Node.js and Python</li>
                            <li>Experience with microservices architecture</li>
                        </ul>
                        
                        <h2>Benefits</h2>
                        <ul>
                            <li>Competitive salary: $150k-$200k</li>
                            <li>Health insurance</li>
                            <li>Stock options</li>
                        </ul>
                    </div>
                </article>
            </main>
            <footer>© 2024 LinkedIn</footer>
            <div class="ads">Advertisement</div>
        </body>
        </html>
    `;

    console.log('STEP 1: Detect Portal');
    const portal = extractor.detectPortal(sampleHTML);
    console.log(`✓ Portal: ${portal}\n`);

    console.log('STEP 2: Extract Job Data');
    const result = extractor.extractFromHTML(sampleHTML);
    console.log(`✓ Extraction complete\n`);

    console.log('STEP 3: Review Results');
    console.log(`- Job Title: ${result.jobTitle}`);
    console.log(`- Company: ${result.company}`);
    console.log(`- Location: ${result.location}`);
    console.log(`- Employment Type: ${result.employmentType}`);
    console.log(`- Responsibilities: ${result.responsibilities.length} items`);
    console.log(`- Requirements: ${result.requirements.length} items`);
    console.log(`- Benefits: ${result.benefits.length} items`);
    console.log(`- Skills Detected: ${result.skills.join(', ')}`);
    console.log(`\nSTEP 4: Validation`);
    console.log(`- Confidence Score: ${result.confidence}/100`);
    console.log(`- Valid: ${result.isValid ? 'Yes ✓' : 'No ✗'}`);
    console.log(`- Extracted At: ${result.extractedAt}`);
}

// Run all examples
function runAllExamples() {
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║        DOM Extractor Service - Usage Examples                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');

    example1_LinkedInExtraction();
    example2_PortalDetection();
    example3_MultiPortalExtraction();
    example4_ConfidenceScoring();
    example5_ErrorHandling();
    example6_FieldExtraction();
    example7_SkillsExtraction();
    example8_ExperienceDetection();
    example9_PortalComparison();
    example10_CompleteWorkflow();

    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    All Examples Completed                             ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
}

// Export examples for use as a module
module.exports = {
    example1_LinkedInExtraction,
    example2_PortalDetection,
    example3_MultiPortalExtraction,
    example4_ConfidenceScoring,
    example5_ErrorHandling,
    example6_FieldExtraction,
    example7_SkillsExtraction,
    example8_ExperienceDetection,
    example9_PortalComparison,
    example10_CompleteWorkflow,
    runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples();
}
