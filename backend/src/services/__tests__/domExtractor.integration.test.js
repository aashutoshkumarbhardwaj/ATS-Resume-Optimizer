/**
 * DOM Extractor Integration Tests
 * Tests extraction from actual job portal HTML samples
 */

const DOMExtractor = require('../domExtractor');

describe('DOMExtractor - Integration Tests', () => {
    let extractor;

    beforeEach(() => {
        extractor = new DOMExtractor();
    });

    describe('LinkedIn Job Extraction', () => {
        const linkedinHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Senior Software Engineer | LinkedIn</title>
                <script>console.log('tracking')</script>
                <style>.hidden { display: none; }</style>
            </head>
            <body>
                <nav class="navbar">Navigation stuff to ignore</nav>
                <header>
                    <div class="linkedin-logo">LinkedIn</div>
                </header>
                
                <main>
                    <div class="jobs-details-top-card">
                        <h1 class="jobs-details-top-card__job-title">Senior Software Engineer</h1>
                        <span class="jobs-details-top-card__company-name">Google</span>
                        <span class="jobs-details-top-card__location">Mountain View, CA</span>
                        <div class="job-insight">Full-time</div>
                        <div class="salary-range">$150,000 - $200,000</div>
                    </div>
                    
                    <div data-test-id="job-description" class="show-more-less-html__markup">
                        <h2>About the role</h2>
                        <p>We are looking for an experienced software engineer to join our team.</p>
                        
                        <h2>Responsibilities</h2>
                        <ul>
                            <li>Design and implement scalable backend systems</li>
                            <li>Lead code reviews and mentor junior engineers</li>
                            <li>Collaborate with product managers on technical requirements</li>
                            <li>Optimize system performance and scalability</li>
                        </ul>
                        
                        <h2>Requirements</h2>
                        <ul>
                            <li>8+ years of software development experience</li>
                            <li>Strong expertise in distributed systems</li>
                            <li>Proficiency in Java, Python, or Go</li>
                            <li>Experience with cloud platforms (AWS, GCP)</li>
                            <li>Bachelor's degree in Computer Science or equivalent</li>
                        </ul>
                        
                        <h2>Preferred Qualifications</h2>
                        <ul>
                            <li>Experience with Kubernetes and Docker</li>
                            <li>Knowledge of machine learning systems</li>
                            <li>Open source contributions</li>
                        </ul>
                        
                        <h2>Benefits</h2>
                        <ul>
                            <li>Comprehensive health, dental, and vision insurance</li>
                            <li>401(k) with company match</li>
                            <li>Unlimited PTO</li>
                            <li>Stock options</li>
                            <li>Fitness center access</li>
                        </ul>
                    </div>
                </main>
                
                <footer>Copyright 2024 LinkedIn</footer>
                <div class="ads">Advertisement space</div>
            </body>
            </html>
        `;

        test('should extract job title from LinkedIn', () => {
            const portal = extractor.detectPortal(linkedinHTML, null);
            expect(portal).toBe('linkedin');
        });

        test('should extract complete LinkedIn job posting', () => {
            // Verify detector finds LinkedIn
            expect(extractor.portalDetectors.linkedin(linkedinHTML)).toBe(true);
            
            // Check selectors exist
            const selectors = extractor.contentSelectors.linkedin;
            expect(selectors).toBeDefined();
            expect(selectors.title.length).toBeGreaterThan(0);
            expect(selectors.company.length).toBeGreaterThan(0);
        });
    });

    describe('Greenhouse Job Extraction', () => {
        const greenhouseHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <nav>Navigation</nav>
                
                <main role="main">
                    <div class="job-advert">
                        <div class="advert-breadcrumb">Home > Jobs > Product Manager</div>
                        <h1 class="app-title">Product Manager</h1>
                        <a class="company-name" href="/company">TechStart Inc</a>
                        <div itemprop="jobLocation">San Francisco, CA</div>
                        <div class="employment-type">Full-time</div>
                        <div class="salary-range">$120,000 - $160,000</div>
                        
                        <div data-testid="job-description">
                            <h2>The Role</h2>
                            <p>Join our product team to drive the future of our platform.</p>
                            
                            <h2>What You'll Do</h2>
                            <ul>
                                <li>Own product roadmap for core platform</li>
                                <li>Work with engineering and design teams</li>
                                <li>Analyze user feedback and metrics</li>
                                <li>Launch new features and improvements</li>
                            </ul>
                            
                            <h2>What We're Looking For</h2>
                            <ul>
                                <li>5+ years of product management experience</li>
                                <li>Track record of successful product launches</li>
                                <li>Strong analytical and communication skills</li>
                                <li>Experience with B2B SaaS</li>
                            </ul>
                            
                            <h2>Bonus Points</h2>
                            <ul>
                                <li>MBA from top business school</li>
                                <li>Experience scaling products to millions of users</li>
                            </ul>
                            
                            <h2>What We Offer</h2>
                            <ul>
                                <li>Competitive salary and equity package</li>
                                <li>Health and wellness benefits</li>
                                <li>Remote work flexibility</li>
                                <li>Professional development budget</li>
                            </ul>
                        </div>
                    </div>
                </main>
                
                <footer>About Greenhouse | Contact | Careers</footer>
            </body>
            </html>
        `;

        test('should detect Greenhouse portal', () => {
            expect(extractor.portalDetectors.greenhouse(greenhouseHTML)).toBe(true);
        });

        test('should have Greenhouse selectors', () => {
            const selectors = extractor.contentSelectors.greenhouse;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('h1.app-title');
            expect(selectors.company).toContain('a.company-name');
        });
    });

    describe('Lever Job Extraction', () => {
        const leverHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div class="posting">
                    <div data-qa="job-title">Full Stack Engineer</div>
                    <div data-qa="company-name">StartupXYZ</div>
                    <div data-qa="job-location">Austin, TX</div>
                    <div data-qa="employment-type">Full-time, On-site</div>
                    <div data-qa="salary">$100,000 - $140,000</div>
                    
                    <section class="section--full">
                        <h2>The Opportunity</h2>
                        <p>Build the next generation of our platform with a talented engineering team.</p>
                        
                        <h2 data-qa="responsibilities-heading">What You'll Do</h2>
                        <div data-qa="responsibilities">
                            <ul>
                                <li>Develop and maintain production systems</li>
                                <li>Collaborate on architectural decisions</li>
                                <li>Participate in code reviews</li>
                                <li>Optimize database queries</li>
                            </ul>
                        </div>
                        
                        <h2 data-qa="requirements-heading">What You'll Need</h2>
                        <ul data-qa="requirements">
                            <li>3+ years of web development experience</li>
                            <li>Strong JavaScript/TypeScript skills</li>
                            <li>Experience with React and Node.js</li>
                            <li>Comfortable with SQL databases</li>
                        </ul>
                        
                        <h2 data-qa="preferred-heading">Nice to Have</h2>
                        <ul data-qa="preferred">
                            <li>Experience with AWS or GCP</li>
                            <li>Knowledge of Docker and Kubernetes</li>
                            <li>Background with startup environments</li>
                        </ul>
                        
                        <h2 data-qa="benefits-heading">What We Offer</h2>
                        <ul data-qa="benefits">
                            <li>Competitive salary and equity</li>
                            <li>Comprehensive health benefits</li>
                            <li>Unlimited PTO</li>
                            <li>Home office setup</li>
                        </ul>
                    </section>
                </div>
            </body>
            </html>
        `;

        test('should detect Lever portal', () => {
            expect(extractor.portalDetectors.lever(leverHTML)).toBe(true);
        });

        test('should have Lever selectors', () => {
            const selectors = extractor.contentSelectors.lever;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('[data-qa="job-title"]');
        });
    });

    describe('Workday Job Extraction', () => {
        const workdayHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div id="jobdetails">
                    <div data-automation-id="jobTitle">Data Engineer</div>
                    <div data-automation-id="jobCompany">DataCorp</div>
                    <div data-automation-id="jobLocation">Chicago, IL</div>
                    <div data-automation-id="employmentType">Full-time</div>
                    <div data-automation-id="salary">$130,000 - $170,000</div>
                    
                    <div data-automation-id="jobDescription">
                        <h2>Job Description</h2>
                        <p>We're seeking a talented data engineer to join our analytics team.</p>
                        
                        <h3>Responsibilities</h3>
                        <ul>
                            <li>Build data pipelines and ETL processes</li>
                            <li>Optimize data warehouse schemas</li>
                            <li>Mentor junior data engineers</li>
                            <li>Implement monitoring and alerting</li>
                        </ul>
                        
                        <h3>Requirements</h3>
                        <ul>
                            <li>5+ years of data engineering experience</li>
                            <li>Proficiency in Python and SQL</li>
                            <li>Experience with Spark or Hadoop</li>
                            <li>Knowledge of cloud data platforms</li>
                        </ul>
                        
                        <h3>Preferred</h3>
                        <ul>
                            <li>Experience with Apache Airflow</li>
                            <li>Knowledge of machine learning pipelines</li>
                            <li>Public cloud certifications</li>
                        </ul>
                        
                        <h3>Benefits</h3>
                        <ul>
                            <li>401(k) match</li>
                            <li>Health, dental, vision</li>
                            <li>Paid time off</li>
                            <li>Professional development fund</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;

        test('should detect Workday portal', () => {
            expect(extractor.portalDetectors.workday(workdayHTML)).toBe(true);
        });

        test('should have Workday selectors', () => {
            const selectors = extractor.contentSelectors.workday;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('[data-automation-id="jobTitle"]');
        });
    });

    describe('Indeed Job Extraction', () => {
        const indeedHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div data-testid="jobsearch-ViewjobPaneWrapper">
                    <h1 class="jobTitle">Marketing Manager</h1>
                    <span class="companyName">MarketingCo</span>
                    <div class="jobLocation">Denver, CO</div>
                    <div class="jobMeta">Full-time</div>
                    <div class="salary">$80,000 - $110,000</div>
                    
                    <div id="jobDescriptionText">
                        <h2>Job Description</h2>
                        <p>Join our marketing team to drive growth and brand awareness.</p>
                        
                        <h3>Responsibilities</h3>
                        <ul>
                            <li>Develop and execute marketing strategies</li>
                            <li>Manage social media and content marketing</li>
                            <li>Analyze marketing metrics and ROI</li>
                            <li>Lead cross-functional campaigns</li>
                        </ul>
                        
                        <h3>Requirements</h3>
                        <ul>
                            <li>4+ years of marketing experience</li>
                            <li>Strong written and verbal communication</li>
                            <li>Experience with marketing analytics tools</li>
                            <li>Project management skills</li>
                        </ul>
                        
                        <h3>Preferred</h3>
                        <ul>
                            <li>Experience with HubSpot or similar platforms</li>
                            <li>Knowledge of SEO and SEM</li>
                            <li>Background in B2B marketing</li>
                        </ul>
                        
                        <h3>Benefits</h3>
                        <ul>
                            <li>Competitive salary</li>
                            <li>Health and wellness benefits</li>
                            <li>Flexible work arrangements</li>
                            <li>Professional development opportunities</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;

        test('should detect Indeed portal', () => {
            expect(extractor.portalDetectors.indeed(indeedHTML)).toBe(true);
        });

        test('should have Indeed selectors', () => {
            const selectors = extractor.contentSelectors.indeed;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('h1[class*="jobTitle"]');
        });
    });

    describe('Ashby Job Extraction', () => {
        const ashbyHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div class="job-posting">
                    <div data-testid="job-title">UX Designer</div>
                    <div data-testid="company-name">DesignStudio</div>
                    <div data-testid="job-location">New York, NY</div>
                    <div data-testid="employment-type">Full-time, Hybrid</div>
                    <div data-testid="salary">$90,000 - $130,000</div>
                    
                    <div data-testid="job-description">
                        <h2>About the Role</h2>
                        <p>We're looking for a talented UX designer to shape our product.</p>
                        
                        <h2>What You'll Do</h2>
                        <ul>
                            <li>Design user interfaces and experiences</li>
                            <li>Conduct user research and testing</li>
                            <li>Collaborate with product and engineering teams</li>
                            <li>Create design systems and documentation</li>
                        </ul>
                        
                        <h2>What We're Looking For</h2>
                        <ul>
                            <li>3+ years of UX/UI design experience</li>
                            <li>Proficiency in Figma or similar tools</li>
                            <li>Strong portfolio demonstrating design thinking</li>
                            <li>Understanding of accessibility and usability</li>
                        </ul>
                        
                        <h2>Nice to Have</h2>
                        <ul>
                            <li>Experience with design systems</li>
                            <li>Knowledge of frontend development</li>
                            <li>Experience with user testing tools</li>
                        </ul>
                        
                        <h2>What We Offer</h2>
                        <ul>
                            <li>Competitive salary and equity</li>
                            <li>Comprehensive benefits</li>
                            <li>Creative freedom and autonomy</li>
                            <li>Work from anywhere (mostly remote)</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;

        test('should detect Ashby portal', () => {
            expect(extractor.portalDetectors.ashby(ashbyHTML)).toBe(true);
        });

        test('should have Ashby selectors', () => {
            const selectors = extractor.contentSelectors.ashby;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('[data-testid="job-title"]');
        });
    });

    describe('SmartRecruiters Job Extraction', () => {
        const smartHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div class="vacancy-page">
                    <h1 itemprop="title">Business Analyst</h1>
                    <span itemprop="hiringOrganization">ConsultingFirm</span>
                    <div itemprop="jobLocation">Boston, MA</div>
                    <div itemprop="employmentType">Full-time</div>
                    <div itemprop="baseSalary">$75,000 - $100,000</div>
                    
                    <div itemprop="description">
                        <h2>About This Role</h2>
                        <p>Help our clients transform their business with data-driven insights.</p>
                        
                        <h2>Key Responsibilities</h2>
                        <ul>
                            <li>Analyze business processes and identify improvements</li>
                            <li>Create detailed requirement specifications</li>
                            <li>Develop data models and reporting solutions</li>
                            <li>Present findings to stakeholders</li>
                        </ul>
                        
                        <h2>Required Skills</h2>
                        <ul>
                            <li>2+ years of business analysis experience</li>
                            <li>Strong SQL and data query skills</li>
                            <li>Excellent analytical and communication abilities</li>
                            <li>Familiarity with JIRA and Confluence</li>
                        </ul>
                        
                        <h2>Preferred Qualifications</h2>
                        <ul>
                            <li>Bachelor's in business, IT, or related field</li>
                            <li>Experience with Tableau or Power BI</li>
                            <li>Background in consulting</li>
                        </ul>
                        
                        <h2>Benefits & Perks</h2>
                        <ul>
                            <li>Competitive compensation package</li>
                            <li>Professional development opportunities</li>
                            <li>Health insurance benefits</li>
                            <li>Collaborative work environment</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;

        test('should detect SmartRecruiters portal', () => {
            expect(extractor.portalDetectors.smartrecruiters(smartHTML)).toBe(true);
        });

        test('should have SmartRecruiters selectors', () => {
            const selectors = extractor.contentSelectors.smartrecruiters;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('.vacancy-page h1');
        });
    });

    describe('Wellfound Job Extraction', () => {
        const wellfoundHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div class="job-posting">
                    <h1 class="job-title">iOS Developer</h1>
                    <span class="company-name">StartupApp</span>
                    <div class="job-location">San Francisco, CA</div>
                    <div class="job-type">Full-time</div>
                    <div class="compensation">$120,000 - $160,000 + equity</div>
                    
                    <div class="job-description">
                        <h2>About Us</h2>
                        <p>We're building the future of mobile applications.</p>
                        
                        <h2>The Role</h2>
                        <ul>
                            <li>Develop and maintain iOS applications</li>
                            <li>Implement new features and improvements</li>
                            <li>Collaborate with product and design teams</li>
                            <li>Optimize app performance</li>
                        </ul>
                        
                        <h2>Requirements</h2>
                        <ul>
                            <li>3+ years of iOS development experience</li>
                            <li>Strong Swift programming skills</li>
                            <li>Experience with iOS frameworks and APIs</li>
                            <li>Git and version control expertise</li>
                        </ul>
                        
                        <h2>Preferred</h2>
                        <ul>
                            <li>Experience with SwiftUI</li>
                            <li>App Store deployment experience</li>
                            <li>Background working at early-stage startups</li>
                        </ul>
                        
                        <h2>Benefits</h2>
                        <ul>
                            <li>Competitive salary and equity package</li>
                            <li>Health, dental, and vision insurance</li>
                            <li>Flexible working hours</li>
                            <li>Learning and development budget</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;

        test('should detect Wellfound portal', () => {
            expect(extractor.portalDetectors.wellfound(wellfoundHTML)).toBe(true);
        });

        test('should have Wellfound selectors', () => {
            const selectors = extractor.contentSelectors.wellfound;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('h1.job-title');
        });
    });

    describe('Naukri Job Extraction', () => {
        const naukriHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <div data-id="jobdetails">
                    <h1 class="jd-header-title">Software Engineer</h1>
                    <span class="jd-header-company">TechCompany India</span>
                    <div class="jd-location">Bangalore, India</div>
                    <div class="emp-type">Full-time, Permanent</div>
                    <div class="sal-wrap">₹15,00,000 - ₹25,00,000 per annum</div>
                    
                    <div class="job-desc">
                        <h2>Job Description</h2>
                        <p>Join our engineering team and build world-class applications.</p>
                        
                        <h2>Responsibilities</h2>
                        <ul>
                            <li>Develop scalable backend systems</li>
                            <li>Write clean, maintainable code</li>
                            <li>Participate in code reviews</li>
                            <li>Work with team on technical design</li>
                        </ul>
                        
                        <h2>Requirements</h2>
                        <ul>
                            <li>B.E./B.Tech in Computer Science or equivalent</li>
                            <li>3-5 years of software development experience</li>
                            <li>Strong knowledge of Java or Python</li>
                            <li>Experience with microservices architecture</li>
                        </ul>
                        
                        <h2>Preferred</h2>
                        <ul>
                            <li>Experience with AWS or GCP</li>
                            <li>Knowledge of containerization (Docker, Kubernetes)</li>
                            <li>Background with fintech or enterprise applications</li>
                        </ul>
                        
                        <h2>Benefits</h2>
                        <ul>
                            <li>Competitive salary and performance bonus</li>
                            <li>Health insurance for employee and family</li>
                            <li>Flexible work arrangements</li>
                            <li>Learning and skill development programs</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `;

        test('should detect Naukri portal', () => {
            expect(extractor.portalDetectors.naukri(naukriHTML)).toBe(true);
        });

        test('should have Naukri selectors', () => {
            const selectors = extractor.contentSelectors.naukri;
            expect(selectors).toBeDefined();
            expect(selectors.title).toContain('h1.jd-header-title');
        });
    });

    describe('Generic Portal Fallback', () => {
        const genericHTML = `
            <!DOCTYPE html>
            <html>
            <body>
                <nav>Skip to content</nav>
                <h1>QA Engineer</h1>
                <div class="company-name">SoftwareCo</div>
                <div class="job-location">Austin, TX</div>
                
                <article class="job-description">
                    <h2>Position Overview</h2>
                    <p>We need a QA engineer to ensure quality across our platform.</p>
                    
                    <h2>Responsibilities</h2>
                    <ul>
                        <li>Create and execute test cases</li>
                        <li>Identify and document bugs</li>
                        <li>Perform regression testing</li>
                        <li>Collaborate with developers</li>
                    </ul>
                    
                    <h2>Requirements</h2>
                    <ul>
                        <li>2+ years QA experience</li>
                        <li>Knowledge of testing frameworks</li>
                        <li>Attention to detail</li>
                    </ul>
                </article>
                
                <footer>Copyright 2024</footer>
            </body>
            </html>
        `;

        test('should fallback to generic portal detection', () => {
            const portal = extractor.detectPortal(genericHTML, null);
            expect(portal).toBe('generic');
        });

        test('should have generic selectors', () => {
            const selectors = extractor.contentSelectors.generic;
            expect(selectors).toBeDefined();
            expect(selectors.title.length).toBeGreaterThan(0);
            expect(selectors.company.length).toBeGreaterThan(0);
        });
    });

    describe('Content Cleanup', () => {
        test('should ignore navigation elements', () => {
            const ignorePatterns = extractor.elementsToIgnore.selectors;
            expect(ignorePatterns).toContain('nav');
            expect(ignorePatterns.some(p => p.includes('navbar'))).toBe(true);
            expect(ignorePatterns.some(p => p.includes('navigation'))).toBe(true);
        });

        test('should ignore advertisement elements', () => {
            const ignorePatterns = extractor.elementsToIgnore.selectors;
            expect(ignorePatterns.some(p => p.includes('ad'))).toBe(true);
        });

        test('should ignore footer elements', () => {
            const ignorePatterns = extractor.elementsToIgnore.selectors;
            expect(ignorePatterns).toContain('footer');
        });

        test('should ignore script and style elements', () => {
            const ignoreTags = extractor.elementsToIgnore.tags;
            expect(ignoreTags).toContain('script');
            expect(ignoreTags).toContain('style');
        });
    });

    describe('Cross-Portal Field Consistency', () => {
        test('all portals should have selectors for required fields', () => {
            const requiredFields = ['title', 'company', 'location', 'description'];
            const portals = Object.keys(extractor.contentSelectors);

            portals.forEach(portal => {
                requiredFields.forEach(field => {
                    expect(extractor.contentSelectors[portal]).toHaveProperty(field);
                    expect(extractor.contentSelectors[portal][field]).toBeTruthy();
                });
            });
        });

        test('should detect correct portal with domain indicators', () => {
            const testCases = [
                { html: 'linkedin.com job posting', portal: 'linkedin' },
                { html: 'greenhouse.io careers', portal: 'greenhouse' },
                { html: 'lever.co job', portal: 'lever' },
                { html: 'workday.com employment', portal: 'workday' },
            ];

            testCases.forEach(({ html, portal }) => {
                expect(extractor.portalDetectors[portal](html)).toBe(true);
            });
        });
    });
});
