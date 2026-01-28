/**
 * Content Script
 * Runs on web pages and can interact with the DOM
 */

console.log('Resume Fixer content script loaded');

// Adaptive job description extraction using semantic analysis
const JD_EXTRACTION_CONFIG = {
    // Common job description section patterns
    sectionPatterns: [
        /(?:job\s+)?(?:description|summary|overview)/i,
        /(?:about\s+)?(?:the\s+)?(?:role|position|job)/i,
        /responsibilities/i,
        /requirements?/i,
        /qualifications?/i,
        /skills?/i,
        /experience/i,
        /what\s+(?:you'll|you\s+will)\s+do/i,
        /what\s+we're\s+looking\s+for/i,
        /key\s+responsibilities/i,
        /essential\s+(?:skills|requirements)/i,
        /preferred\s+(?:skills|qualifications)/i
    ],
    
    // Text density thresholds for content identification
    minDescriptionLength: 100,
    maxDescriptionLength: 10000,
    minTextDensity: 0.3, // ratio of text to HTML
    
    // Semantic indicators for different content types
    titleIndicators: ['title', 'position', 'role', 'job'],
    companyIndicators: ['company', 'employer', 'organization', 'corp', 'inc', 'ltd'],
    locationIndicators: ['location', 'city', 'state', 'country', 'remote', 'hybrid'],
    
    // Common job-related keywords for validation
    jobKeywords: [
        'experience', 'skills', 'requirements', 'qualifications', 'responsibilities',
        'bachelor', 'master', 'degree', 'years', 'team', 'work', 'develop',
        'manage', 'lead', 'collaborate', 'implement', 'design', 'analyze'
    ]
};

// Current detected job data
let detectedJob = null;

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_RESUME') {
        const resumeText = extractResumeContent();
        sendResponse({ success: true, resumeText });
    }

    if (request.type === 'HIGHLIGHT_KEYWORDS') {
        highlightKeywords(request.keywords);
        sendResponse({ success: true });
    }

    if (request.type === 'DETECT_JOB') {
        const jobData = detectJobDescription();
        sendResponse(jobData);
    }

    if (request.type === 'GET_DETECTED_JOB') {
        sendResponse({ success: true, job: detectedJob });
    }

    return true;
});

/**
 * Detect and extract job description from the current page using adaptive heuristics
 */
function detectJobDescription() {
    const url = window.location.href;
    
    try {
        // Use adaptive extraction instead of site-specific selectors
        const jobData = extractJobDataAdaptively();
        
        // Calculate confidence score
        const confidence = calculateConfidence(jobData);
        
        if (confidence >= 70) { // Lowered threshold for adaptive approach
            // Extract requirements and skills from description
            const extracted = extractRequirementsAndSkills(jobData.description);
            jobData.requirements = extracted.requirements;
            jobData.skills = extracted.skills;
            jobData.url = url;

            detectedJob = jobData;

            return {
                success: true,
                confidence: confidence,
                payload: jobData
            };
        } else {
            return {
                success: false,
                confidence: confidence,
                message: 'Job description detection confidence too low. Please use manual input.',
                requiresManual: true,
                partialData: jobData
            };
        }
    } catch (error) {
        console.error('Resume Fixer: Error in job detection:', error);
        return {
            success: false,
            confidence: 0,
            message: 'Error occurred during job detection. Please use manual input.',
            requiresManual: true
        };
    }
}

/**
 * Extract job data using adaptive heuristics and semantic analysis
 */
function extractJobDataAdaptively() {
    const jobData = {
        jobTitle: '',
        company: '',
        description: '',
        location: '',
        requirements: [],
        skills: []
    };

    try {
        // Extract job title using semantic analysis
        jobData.jobTitle = extractJobTitle();
        
        // Extract company name
        jobData.company = extractCompanyName();
        
        // Extract job description using multiple strategies
        jobData.description = extractJobDescription();
        
        // Extract location
        jobData.location = extractLocation();

        // Fallback: if description is empty, try to get any substantial text content
        if (!jobData.description || jobData.description.length < JD_EXTRACTION_CONFIG.minDescriptionLength) {
            jobData.description = extractFallbackDescription();
        }

        // Clean up extracted data
        jobData.jobTitle = cleanText(jobData.jobTitle);
        jobData.company = cleanText(jobData.company);
        jobData.location = cleanText(jobData.location);

    } catch (error) {
        console.error('Resume Fixer: Error in adaptive extraction:', error);
    }

    return jobData;
}

/**
 * Fallback description extraction for edge cases
 */
function extractFallbackDescription() {
    // Try to find the main content area
    const mainSelectors = [
        'main', 'article', '[role="main"]', '.main-content', 
        '#main-content', '.content', '#content'
    ];
    
    for (const selector of mainSelectors) {
        try {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent.trim();
                if (text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                    return text;
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }
    
    // Last resort: get the largest text block from body
    const bodyText = document.body.textContent.trim();
    if (bodyText.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
        return bodyText;
    }
    
    return '';
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/^\s+|\s+$/g, '') // Trim
        .replace(/[^\w\s\-\.\,\(\)]/g, '') // Remove special characters except common punctuation
        .substring(0, 500); // Limit length for titles/companies
}

/**
 * Extract job title using semantic heuristics
 */
function extractJobTitle() {
    const candidates = [];
    
    // Strategy 1: Look for h1 tags (most common for job titles)
    const h1Elements = document.querySelectorAll('h1');
    h1Elements.forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 5 && text.length < 100) {
            candidates.push({
                text: text,
                score: calculateTitleScore(text, el),
                element: el
            });
        }
    });
    
    // Strategy 2: Look for elements with title-related attributes or classes
    const titleSelectors = [
        '[class*="title"]', '[class*="job"]', '[class*="position"]', '[class*="role"]',
        '[id*="title"]', '[id*="job"]', '[data-*="title"]', '[data-*="job"]'
    ];
    
    titleSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent.trim();
                if (text.length > 5 && text.length < 100 && !candidates.find(c => c.text === text)) {
                    candidates.push({
                        text: text,
                        score: calculateTitleScore(text, el),
                        element: el
                    });
                }
            });
        } catch (e) {
            // Ignore invalid selectors
        }
    });
    
    // Strategy 3: Look in document title and meta tags
    const docTitle = document.title;
    if (docTitle && docTitle.length > 5) {
        // Extract potential job title from page title (often formatted as "Job Title - Company")
        const titleParts = docTitle.split(/[-|–—]/);
        if (titleParts.length > 1) {
            const potentialTitle = titleParts[0].trim();
            if (potentialTitle.length > 5 && potentialTitle.length < 100) {
                candidates.push({
                    text: potentialTitle,
                    score: calculateTitleScore(potentialTitle, null) + 10, // Bonus for page title
                    element: null
                });
            }
        }
    }
    
    // Return the highest scoring candidate
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].text;
    }
    
    return '';
}

/**
 * Calculate score for potential job title
 */
function calculateTitleScore(text, element) {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Bonus for job-related keywords
    const jobTitleKeywords = [
        'engineer', 'developer', 'manager', 'analyst', 'specialist', 'coordinator',
        'director', 'lead', 'senior', 'junior', 'associate', 'consultant',
        'architect', 'designer', 'scientist', 'researcher', 'administrator'
    ];
    
    jobTitleKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
            score += 15;
        }
    });
    
    // Bonus for element positioning and styling
    if (element) {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        
        // Higher score for elements near the top of the page
        if (rect.top < window.innerHeight * 0.3) {
            score += 10;
        }
        
        // Bonus for larger font sizes
        const fontSize = parseFloat(computedStyle.fontSize);
        if (fontSize > 20) {
            score += 10;
        }
        if (fontSize > 24) {
            score += 5;
        }
        
        // Bonus for bold text
        if (computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 600) {
            score += 5;
        }
        
        // Bonus for h1-h3 tags
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'h1') score += 20;
        else if (tagName === 'h2') score += 15;
        else if (tagName === 'h3') score += 10;
    }
    
    // Penalty for very long or very short text
    if (text.length < 10) score -= 10;
    if (text.length > 80) score -= 15;
    
    return score;
}

/**
 * Extract company name using semantic heuristics
 */
function extractCompanyName() {
    const candidates = [];
    
    // Strategy 1: Look for elements with company-related attributes or classes
    const companySelectors = [
        '[class*="company"]', '[class*="employer"]', '[class*="organization"]',
        '[id*="company"]', '[id*="employer"]', '[data-*="company"]'
    ];
    
    companySelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent.trim();
                if (text.length > 2 && text.length < 100) {
                    candidates.push({
                        text: text,
                        score: calculateCompanyScore(text, el)
                    });
                }
            });
        } catch (e) {
            // Ignore invalid selectors
        }
    });
    
    // Strategy 2: Look for links that might be company names
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        const text = link.textContent.trim();
        const href = link.href;
        
        // Check if link looks like a company profile or careers page
        if (text.length > 2 && text.length < 50 && 
            (href.includes('/company/') || href.includes('/careers') || href.includes('/jobs'))) {
            candidates.push({
                text: text,
                score: calculateCompanyScore(text, link) + 5 // Bonus for being a link
            });
        }
    });
    
    // Strategy 3: Look in page title and meta tags
    const docTitle = document.title;
    if (docTitle) {
        const titleParts = docTitle.split(/[-|–—]/);
        if (titleParts.length > 1) {
            // Company name is often after the job title
            for (let i = 1; i < titleParts.length; i++) {
                const part = titleParts[i].trim();
                if (part.length > 2 && part.length < 50) {
                    candidates.push({
                        text: part,
                        score: calculateCompanyScore(part, null) + 8
                    });
                }
            }
        }
    }
    
    // Return the highest scoring candidate
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].text;
    }
    
    return '';
}

/**
 * Calculate score for potential company name
 */
function calculateCompanyScore(text, element) {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Bonus for company suffixes
    const companySuffixes = ['inc', 'corp', 'ltd', 'llc', 'co', 'company', 'corporation', 'limited'];
    companySuffixes.forEach(suffix => {
        if (lowerText.includes(suffix)) {
            score += 10;
        }
    });
    
    // Penalty for common non-company words
    const nonCompanyWords = ['apply', 'save', 'share', 'view', 'more', 'jobs', 'career', 'login', 'sign'];
    nonCompanyWords.forEach(word => {
        if (lowerText.includes(word)) {
            score -= 15;
        }
    });
    
    // Bonus for capitalized words (company names are usually capitalized)
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(word => word.length > 0 && word[0] === word[0].toUpperCase());
    score += capitalizedWords.length * 3;
    
    return score;
}

/**
 * Extract job description using multiple strategies and text density analysis
 */
function extractJobDescription() {
    const candidates = [];
    
    // Strategy 1: Look for elements with description-related attributes or classes
    const descriptionSelectors = [
        '[class*="description"]', '[class*="content"]', '[class*="detail"]',
        '[id*="description"]', '[id*="content"]', '[data-*="description"]'
    ];
    
    descriptionSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent.trim();
                if (text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                    candidates.push({
                        text: text,
                        score: calculateDescriptionScore(text, el),
                        element: el
                    });
                }
            });
        } catch (e) {
            // Ignore invalid selectors
        }
    });
    
    // Strategy 2: Look for sections with job-related headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
        const headingText = heading.textContent.trim().toLowerCase();
        
        // Check if heading matches job description patterns
        const isJobSection = JD_EXTRACTION_CONFIG.sectionPatterns.some(pattern => 
            pattern.test(headingText)
        );
        
        if (isJobSection) {
            // Find content after this heading
            const content = getContentAfterHeading(heading);
            if (content && content.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                candidates.push({
                    text: content,
                    score: calculateDescriptionScore(content, heading) + 20, // Bonus for semantic heading
                    element: heading
                });
            }
        }
    });
    
    // Strategy 3: Text density analysis - find the largest block of meaningful text
    const textBlocks = findLargeTextBlocks();
    textBlocks.forEach(block => {
        if (block.text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
            candidates.push({
                text: block.text,
                score: calculateDescriptionScore(block.text, block.element) + 10, // Bonus for text density
                element: block.element
            });
        }
    });
    
    // Return the highest scoring candidate
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].text;
    }
    
    return '';
}

/**
 * Get content after a heading element
 */
function getContentAfterHeading(heading) {
    let content = '';
    let currentElement = heading.nextElementSibling;
    
    while (currentElement) {
        // Stop if we hit another heading of the same or higher level
        const currentLevel = parseInt(heading.tagName.charAt(1));
        const nextLevel = parseInt(currentElement.tagName.charAt(1));
        
        if (currentElement.tagName.match(/^H[1-6]$/) && nextLevel <= currentLevel) {
            break;
        }
        
        content += currentElement.textContent + '\n';
        currentElement = currentElement.nextElementSibling;
        
        // Prevent infinite loops and overly long content
        if (content.length > JD_EXTRACTION_CONFIG.maxDescriptionLength) {
            break;
        }
    }
    
    return content.trim();
}

/**
 * Find large blocks of text using density analysis
 */
function findLargeTextBlocks() {
    const blocks = [];
    const elements = document.querySelectorAll('div, section, article, main, p');
    
    elements.forEach(el => {
        const text = el.textContent.trim();
        const html = el.innerHTML;
        
        if (text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
            // Calculate text density (ratio of text to HTML)
            const textDensity = text.length / html.length;
            
            if (textDensity >= JD_EXTRACTION_CONFIG.minTextDensity) {
                blocks.push({
                    text: text,
                    element: el,
                    density: textDensity
                });
            }
        }
    });
    
    // Sort by text length and density
    blocks.sort((a, b) => (b.text.length * b.density) - (a.text.length * a.density));
    
    return blocks.slice(0, 5); // Return top 5 candidates
}

/**
 * Calculate score for potential job description
 */
function calculateDescriptionScore(text, element) {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Bonus for job-related keywords
    let keywordCount = 0;
    JD_EXTRACTION_CONFIG.jobKeywords.forEach(keyword => {
        const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
        const matches = text.match(regex);
        if (matches) {
            keywordCount += matches.length;
        }
    });
    score += Math.min(keywordCount * 5, 50); // Cap at 50 points
    
    // Bonus for length (longer descriptions are usually better)
    if (text.length > 500) score += 10;
    if (text.length > 1000) score += 10;
    if (text.length > 2000) score += 10;
    
    // Penalty for very long descriptions (might be entire page content)
    if (text.length > 8000) score -= 20;
    
    // Bonus for structured content (bullet points, paragraphs)
    const bulletPoints = text.match(/[•\-\*]/g);
    if (bulletPoints) {
        score += Math.min(bulletPoints.length * 2, 20);
    }
    
    const paragraphs = text.split('\n\n').length;
    if (paragraphs > 2) {
        score += Math.min(paragraphs * 2, 15);
    }
    
    return score;
}

/**
 * Extract location using semantic heuristics
 */
function extractLocation() {
    const candidates = [];
    
    // Strategy 1: Look for elements with location-related attributes or classes
    const locationSelectors = [
        '[class*="location"]', '[class*="city"]', '[class*="address"]',
        '[id*="location"]', '[data-*="location"]'
    ];
    
    locationSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent.trim();
                if (text.length > 2 && text.length < 100) {
                    candidates.push({
                        text: text,
                        score: calculateLocationScore(text, el)
                    });
                }
            });
        } catch (e) {
            // Ignore invalid selectors
        }
    });
    
    // Strategy 2: Look for common location patterns in text
    const allText = document.body.textContent;
    const locationPatterns = [
        /\b([A-Z][a-z]+,\s*[A-Z]{2})\b/g, // City, State
        /\b([A-Z][a-z]+,\s*[A-Z][a-z]+)\b/g, // City, Country
        /\b(Remote|Hybrid|On-site)\b/gi
    ];
    
    locationPatterns.forEach(pattern => {
        const matches = allText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                candidates.push({
                    text: match.trim(),
                    score: calculateLocationScore(match.trim(), null) + 5
                });
            });
        }
    });
    
    // Return the highest scoring candidate
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].text;
    }
    
    return '';
}

/**
 * Calculate score for potential location
 */
function calculateLocationScore(text, element) {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Bonus for location keywords
    const locationKeywords = ['remote', 'hybrid', 'on-site', 'onsite', 'city', 'state', 'country'];
    locationKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
            score += 10;
        }
    });
    
    // Bonus for common location patterns
    if (/\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(text)) { // City, State
        score += 15;
    }
    if (/\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(text)) { // City, Country
        score += 15;
    }
    
    // Penalty for non-location words
    const nonLocationWords = ['apply', 'save', 'share', 'view', 'more', 'salary', 'benefits'];
    nonLocationWords.forEach(word => {
        if (lowerText.includes(word)) {
            score -= 10;
        }
    });
    
    return score;
}

/**
 * Calculate confidence score for detected job data using adaptive scoring
 */
function calculateConfidence(jobData) {
    let score = 0;
    
    // Job title scoring (35 points max)
    if (jobData.jobTitle && jobData.jobTitle.length > 3) {
        score += 25;
        
        // Bonus for job-related keywords in title
        const jobTitleKeywords = [
            'engineer', 'developer', 'manager', 'analyst', 'specialist',
            'director', 'lead', 'senior', 'junior', 'associate'
        ];
        const titleLower = jobData.jobTitle.toLowerCase();
        const hasJobKeyword = jobTitleKeywords.some(keyword => titleLower.includes(keyword));
        if (hasJobKeyword) {
            score += 10;
        }
    }
    
    // Company name scoring (20 points max)
    if (jobData.company && jobData.company.length > 2) {
        score += 15;
        
        // Bonus for company indicators
        const companyLower = jobData.company.toLowerCase();
        const companySuffixes = ['inc', 'corp', 'ltd', 'llc', 'company', 'corporation'];
        const hasCompanySuffix = companySuffixes.some(suffix => companyLower.includes(suffix));
        if (hasCompanySuffix) {
            score += 5;
        }
    }
    
    // Description scoring (35 points max)
    if (jobData.description && jobData.description.length > 100) {
        score += 20;
        
        // Bonus for job-related content
        const descLower = jobData.description.toLowerCase();
        let keywordCount = 0;
        JD_EXTRACTION_CONFIG.jobKeywords.forEach(keyword => {
            if (descLower.includes(keyword)) {
                keywordCount++;
            }
        });
        
        // Award points based on keyword density
        const keywordDensity = keywordCount / JD_EXTRACTION_CONFIG.jobKeywords.length;
        score += Math.min(keywordDensity * 15, 15);
        
    } else if (jobData.description && jobData.description.length > 50) {
        score += 10;
    }
    
    // Location scoring (10 points max)
    if (jobData.location && jobData.location.length > 2) {
        score += 8;
        
        // Bonus for location patterns
        const locationLower = jobData.location.toLowerCase();
        if (locationLower.includes('remote') || locationLower.includes('hybrid') || 
            /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(jobData.location)) {
            score += 2;
        }
    }
    
    return Math.min(score, 100); // Cap at 100
}

/**
 * Extract requirements and skills from job description text using enhanced patterns
 */
function extractRequirementsAndSkills(description) {
    const requirements = [];
    const skills = [];
    
    if (!description) {
        return { requirements, skills };
    }

    const lowerDesc = description.toLowerCase();
    
    // Enhanced technical skills detection with synonym handling
    const technicalSkillsMap = {
        'JavaScript': ['javascript', 'js(?!on)', 'ecmascript', 'es6', 'es2015', 'es2020'],
        'TypeScript': ['typescript', 'ts(?!v|x)'],
        'Python': ['python', 'py(?!thon)'],
        'Java': ['java(?!script)', 'jdk', 'jre'],
        'C++': ['c\\+\\+', 'cpp', 'cplusplus'],
        'C#': ['c#', 'csharp', 'c sharp'],
        'Ruby': ['ruby', 'rb'],
        'PHP': ['php', 'php\\d+'],
        'Swift': ['swift', 'swift\\d+'],
        'Kotlin': ['kotlin', 'kt'],
        'Go': ['go', 'golang'],
        'Rust': ['rust', 'rustlang'],
        'Scala': ['scala'],
        'R': ['r programming', '\\br\\b'],
        
        // Frontend Frameworks/Libraries
        'React': ['react', 'reactjs', 'react\\.js'],
        'Angular': ['angular', 'angularjs', 'angular\\d+'],
        'Vue.js': ['vue', 'vuejs', 'vue\\.js'],
        'Svelte': ['svelte', 'sveltekit'],
        'Next.js': ['next\\.?js', 'nextjs'],
        'Nuxt.js': ['nuxt', 'nuxtjs'],
        'Ember.js': ['ember', 'emberjs'],
        'Backbone.js': ['backbone', 'backbonejs'],
        'jQuery': ['jquery', 'jquery\\d+'],
        
        // CSS/Styling
        'HTML': ['html5?', 'html'],
        'CSS': ['css3?', 'css'],
        'Sass/SCSS': ['sass', 'scss'],
        'Less': ['less'],
        'Tailwind CSS': ['tailwind', 'tailwindcss'],
        'Bootstrap': ['bootstrap', 'bootstrap\\d+'],
        'Material-UI': ['material.?ui', 'mui'],
        
        // Build Tools
        'Webpack': ['webpack', 'webpack\\d+'],
        'Vite': ['vite', 'vitejs'],
        'Parcel': ['parcel', 'parceljs'],
        'Rollup': ['rollup', 'rollupjs'],
        'Babel': ['babel', 'babeljs'],
        'Gulp': ['gulp', 'gulpjs'],
        'Grunt': ['grunt', 'gruntjs'],
        
        // Backend Frameworks
        'Node.js': ['node\\.?js', 'nodejs'],
        'Express.js': ['express', 'expressjs'],
        'Fastify': ['fastify'],
        'Koa.js': ['koa', 'koajs'],
        'Django': ['django'],
        'Flask': ['flask'],
        'FastAPI': ['fastapi'],
        'Spring': ['spring', 'spring boot', 'springframework'],
        'ASP.NET': ['asp\\.?net', 'dotnet', '\\.net'],
        'Laravel': ['laravel'],
        'Symfony': ['symfony'],
        'Ruby on Rails': ['rails', 'ruby on rails'],
        'NestJS': ['nestjs'],
        
        // Databases
        'MongoDB': ['mongodb', 'mongo'],
        'PostgreSQL': ['postgresql', 'postgres'],
        'MySQL': ['mysql'],
        'SQLite': ['sqlite'],
        'Redis': ['redis'],
        'Elasticsearch': ['elasticsearch', 'elastic search'],
        'DynamoDB': ['dynamodb', 'dynamo db'],
        'Cassandra': ['cassandra'],
        'Oracle': ['oracle', 'oracle db'],
        'SQL Server': ['sql server', 'mssql'],
        'MariaDB': ['mariadb'],
        'CouchDB': ['couchdb'],
        'Neo4j': ['neo4j'],
        
        // Cloud Platforms
        'AWS': ['aws', 'amazon web services'],
        'Azure': ['azure', 'microsoft azure'],
        'Google Cloud': ['gcp', 'google cloud', 'google cloud platform'],
        'Heroku': ['heroku'],
        'Vercel': ['vercel'],
        'Netlify': ['netlify'],
        'DigitalOcean': ['digitalocean'],
        
        // DevOps & Infrastructure
        'Docker': ['docker'],
        'Kubernetes': ['kubernetes', 'k8s'],
        'Jenkins': ['jenkins'],
        'GitLab CI': ['gitlab ci', 'gitlab-ci'],
        'GitHub Actions': ['github actions'],
        'CircleCI': ['circleci'],
        'Travis CI': ['travis ci', 'travis-ci'],
        'Terraform': ['terraform'],
        'Ansible': ['ansible'],
        'Chef': ['chef'],
        'Puppet': ['puppet'],
        'Vagrant': ['vagrant'],
        'Helm': ['helm'],
        
        // APIs & Protocols
        'REST API': ['rest api', 'restful', 'rest', 'restful api', 'restful services'],
        'GraphQL': ['graphql', 'graph ql'],
        'SOAP': ['soap'],
        'gRPC': ['grpc'],
        'WebSocket': ['websocket', 'web socket'],
        'OAuth': ['oauth', 'oauth\\d+'],
        'JWT': ['jwt', 'json web token'],
        'SAML': ['saml'],
        
        // Data & ML
        'Machine Learning': ['machine learning', 'ml'],
        'Deep Learning': ['deep learning', 'dl'],
        'AI': ['artificial intelligence', 'ai'],
        'TensorFlow': ['tensorflow', 'tf'],
        'PyTorch': ['pytorch'],
        'Keras': ['keras'],
        'Scikit-learn': ['scikit.?learn', 'sklearn'],
        'Pandas': ['pandas'],
        'NumPy': ['numpy'],
        'Matplotlib': ['matplotlib'],
        'Seaborn': ['seaborn'],
        'Jupyter': ['jupyter'],
        'Apache Spark': ['apache spark', 'spark'],
        'Hadoop': ['hadoop'],
        'Kafka': ['kafka'],
        'Airflow': ['airflow'],
        
        // Mobile Development
        'iOS': ['ios development', 'ios'],
        'Android': ['android development', 'android'],
        'React Native': ['react native'],
        'Flutter': ['flutter'],
        'Xamarin': ['xamarin'],
        'Cordova': ['cordova', 'phonegap'],
        
        // Testing
        'Jest': ['jest'],
        'Mocha': ['mocha'],
        'Chai': ['chai'],
        'Cypress': ['cypress'],
        'Selenium': ['selenium'],
        'Puppeteer': ['puppeteer'],
        'Playwright': ['playwright'],
        'JUnit': ['junit'],
        'PyTest': ['pytest'],
        'RSpec': ['rspec']
    };
    
    // Extract technical skills with enhanced matching
    const foundSkills = new Set();
    
    for (const [skillName, patterns] of Object.entries(technicalSkillsMap)) {
        for (const pattern of patterns) {
            const regex = new RegExp('\\b' + pattern + '\\b', 'gi');
            if (regex.test(description)) {
                foundSkills.add(skillName);
                break; // Found one pattern, no need to check others for this skill
            }
        }
    }
    
    skills.push(...Array.from(foundSkills));
    
    // Enhanced requirements extraction with better patterns
    const lines = description.split(/[\n\r]+/);
    const bulletPatterns = [
        /^[\s]*[•\-\*\+►▪▫‣⁃]\s*/,  // Various bullet points
        /^[\s]*\d+[\.\)]\s*/,        // Numbered lists
        /^[\s]*[a-zA-Z][\.\)]\s*/    // Lettered lists
    ];
    
    // Stop words to filter out generic requirements
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
        'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'work', 'working', 'worked',
        'experience', 'strong', 'good', 'excellent', 'great', 'best', 'responsible',
        'duties', 'tasks', 'job', 'role', 'position', 'candidate', 'ability'
    ]);
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Check if line is a bullet point or list item
        const isBulletPoint = bulletPatterns.some(pattern => pattern.test(trimmed));
        
        if (isBulletPoint && trimmed.length > 15 && trimmed.length < 300) {
            // Clean up the requirement text
            let cleanedReq = trimmed.replace(/^[\s]*[•\-\*\+►▪▫‣⁃\d+a-zA-Z\.\)]\s*/, '').trim();
            
            // Filter out requirements that are mostly stop words
            const words = cleanedReq.toLowerCase().split(/\s+/);
            const meaningfulWords = words.filter(word => !stopWords.has(word));
            
            // Only include if at least 40% of words are meaningful
            if (meaningfulWords.length >= words.length * 0.4 && cleanedReq.length > 10) {
                requirements.push(cleanedReq);
            }
        }
        
        // Also look for requirements in sentences with key phrases
        const requirementPhrases = [
            /(?:must have|required|essential|mandatory)[:\s]+([^\.]+)/gi,
            /(?:minimum|at least)\s+(\d+\+?\s+years?[^\.]+)/gi,
            /(?:bachelor|master|phd|degree)[^\.]+/gi,
            /(?:experience (?:with|in))[^\.]+/gi,
            /(?:proficient|skilled|expertise)\s+(?:in|with)[^\.]+/gi
        ];
        
        requirementPhrases.forEach(phrase => {
            const matches = trimmed.match(phrase);
            if (matches) {
                matches.forEach(match => {
                    if (match.length > 15 && match.length < 200) {
                        // Filter out generic matches
                        const words = match.toLowerCase().split(/\s+/);
                        const meaningfulWords = words.filter(word => !stopWords.has(word));
                        
                        if (meaningfulWords.length >= words.length * 0.4) {
                            requirements.push(match.trim());
                        }
                    }
                });
            }
        });
    });
    
    // Remove duplicates and prioritize
    const uniqueRequirements = [...new Set(requirements)];
    const uniqueSkills = [...new Set(skills)];
    
    // Sort skills by priority (technical skills first, then alphabetically)
    const technicalSkillNames = Object.keys(technicalSkillsMap);
    uniqueSkills.sort((a, b) => {
        const aIsTechnical = technicalSkillNames.includes(a);
        const bIsTechnical = technicalSkillNames.includes(b);
        
        if (aIsTechnical && !bIsTechnical) return -1;
        if (!aIsTechnical && bIsTechnical) return 1;
        return a.localeCompare(b);
    });
    
    return { 
        requirements: uniqueRequirements.slice(0, 20), // Limit to top 20
        skills: uniqueSkills.slice(0, 30) // Limit to top 30
    };
}

/**
 * Normalize skill names for consistency
 */
function normalizeSkillName(skill) {
    const skillLower = skill.toLowerCase();
    
    // Common normalizations
    const normalizations = {
        'node.js': 'Node.js',
        'nodejs': 'Node.js',
        'vue.js': 'Vue.js',
        'vuejs': 'Vue.js',
        'react.js': 'React',
        'reactjs': 'React',
        'angular.js': 'Angular',
        'angularjs': 'Angular',
        'c++': 'C++',
        'c#': 'C#',
        'asp.net': 'ASP.NET',
        '.net': '.NET',
        'postgresql': 'PostgreSQL',
        'mongodb': 'MongoDB',
        'mysql': 'MySQL',
        'javascript': 'JavaScript',
        'typescript': 'TypeScript',
        'html5': 'HTML5',
        'css3': 'CSS3',
        'rest api': 'REST API',
        'graphql': 'GraphQL',
        'machine learning': 'Machine Learning',
        'artificial intelligence': 'AI',
        'tensorflow': 'TensorFlow',
        'pytorch': 'PyTorch'
    };
    
    return normalizations[skillLower] || skill;
}

/**
 * Extract resume content from the page
 */
function extractResumeContent() {
    // Try to extract text from common resume locations
    let text = '';

    // Try main content area
    const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
    text = mainContent ? mainContent.innerText : '';

    // If very short, try full body text
    if (text.length < 100) {
        text = document.body.innerText;
    }

    return text;
}

/**
 * Highlight keywords on the page
 */
function highlightKeywords(keywords) {
    if (!keywords || keywords.length === 0) return;

    const bodyText = document.body.innerText;
    keywords.forEach(keyword => {
        highlightText(keyword);
    });
}

/**
 * Highlight specific text on the page
 */
function highlightText(text) {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const nodesToReplace = [];
    let node;

    while (node = walker.nextNode()) {
        if (node.nodeValue.toLowerCase().includes(text.toLowerCase())) {
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        const span = document.createElement('span');
        span.innerHTML = node.nodeValue.replace(
            new RegExp(text, 'gi'),
            match => `<mark style="background-color: #ffeb3b; padding: 2px 4px; border-radius: 3px;">${match}</mark>`
        );
        node.parentNode.replaceChild(span, node);
    });
}

// Inject a button to extract resume from LinkedIn or similar sites
function injectExtractButton() {
    const button = document.createElement('button');
    button.id = 'rf-extract-btn';
    button.textContent = '📄 Extract Resume';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        z-index: 10000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
    `;

    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    button.addEventListener('click', () => {
        const text = extractResumeContent();
        chrome.runtime.sendMessage({
            type: 'SAVE_EXTRACTED_TEXT',
            payload: {
                resumeText: text,
                source: window.location.href
            }
        });
        alert('Resume content extracted! Check the extension popup.');
    });

    document.body.appendChild(button);
}

/**
 * Inject visual indicator when job is detected
 */
function injectJobDetectionIndicator() {
    // Remove existing indicator if present
    const existing = document.getElementById('rf-job-indicator');
    if (existing) {
        existing.remove();
    }

    const indicator = document.createElement('div');
    indicator.id = 'rf-job-indicator';
    indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📄</span>
            <span style="font-weight: 600;">Job Detected!</span>
        </div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
            Click to optimize your resume
        </div>
    `;
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 16px 20px;
        border-radius: 12px;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.5);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    indicator.addEventListener('mouseenter', () => {
        indicator.style.transform = 'translateY(-2px)';
        indicator.style.boxShadow = '0 6px 24px rgba(102, 126, 234, 0.6)';
    });

    indicator.addEventListener('mouseleave', () => {
        indicator.style.transform = 'translateY(0)';
        indicator.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.5)';
    });

    indicator.addEventListener('click', () => {
        // Send message to open popup
        chrome.runtime.sendMessage({
            type: 'OPEN_POPUP',
            payload: detectedJob
        });
    });

    document.body.appendChild(indicator);
}

/**
 * Auto-detect job on any website using adaptive heuristics
 */
function autoDetectJob() {
    // Check if this looks like a job posting page
    if (isJobPostingPage()) {
        console.log('Resume Fixer: Potential job posting detected, attempting extraction...');
        
        // Wait for page to fully load
        setTimeout(() => {
            const result = detectJobDescription();
            if (result.success && result.confidence >= 70) {
                console.log('Resume Fixer: Job detected with confidence', result.confidence);
                injectJobDetectionIndicator();
                
                // Notify service worker
                chrome.runtime.sendMessage({
                    type: 'JOB_DETECTED',
                    payload: result.payload
                });
            } else {
                console.log('Resume Fixer: Job detection failed or low confidence', result.confidence);
                // For debugging: log partial data if available
                if (result.partialData) {
                    console.log('Resume Fixer: Partial data extracted:', result.partialData);
                }
            }
        }, 2000);
    }
}

/**
 * Determine if the current page is likely a job posting
 */
function isJobPostingPage() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent.toLowerCase();
    
    // URL-based indicators
    const jobUrlPatterns = [
        /\/job[s]?\//,
        /\/career[s]?\//,
        /\/position[s]?\//,
        /\/opening[s]?\//,
        /\/vacancy/,
        /\/hiring/,
        /job[-_]?id/,
        /position[-_]?id/
    ];
    
    const hasJobUrl = jobUrlPatterns.some(pattern => pattern.test(url));
    
    // Title-based indicators
    const jobTitleKeywords = [
        'job', 'career', 'position', 'opening', 'vacancy', 'hiring',
        'engineer', 'developer', 'manager', 'analyst', 'specialist'
    ];
    
    const hasJobTitle = jobTitleKeywords.some(keyword => title.includes(keyword));
    
    // Content-based indicators
    const jobContentKeywords = [
        'job description', 'responsibilities', 'requirements', 'qualifications',
        'apply now', 'submit application', 'years of experience', 'bachelor',
        'skills required', 'we are looking for', 'join our team'
    ];
    
    let contentKeywordCount = 0;
    jobContentKeywords.forEach(keyword => {
        if (bodyText.includes(keyword)) {
            contentKeywordCount++;
        }
    });
    
    // Domain-based indicators (known job sites)
    const knownJobSites = [
        'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com', 
        'ziprecruiter.com', 'careerbuilder.com', 'dice.com', 'simplyhired.com',
        'jobvite.com', 'greenhouse.io', 'lever.co', 'workday.com',
        'bamboohr.com', 'smartrecruiters.com', 'icims.com'
    ];
    
    const currentDomain = window.location.hostname.toLowerCase();
    const isKnownJobSite = knownJobSites.some(site => currentDomain.includes(site));
    
    // Scoring system
    let score = 0;
    if (hasJobUrl) score += 30;
    if (hasJobTitle) score += 20;
    if (contentKeywordCount >= 3) score += 25;
    if (contentKeywordCount >= 5) score += 15; // Additional bonus
    if (isKnownJobSite) score += 20;
    
    // Additional checks for job posting structure
    const hasJobStructure = checkJobPostingStructure();
    if (hasJobStructure) score += 20;
    
    console.log('Resume Fixer: Job page detection score:', score);
    return score >= 50; // Threshold for considering it a job posting
}

/**
 * Check if the page has typical job posting structure
 */
function checkJobPostingStructure() {
    // Look for common job posting elements
    const structureIndicators = [
        // Headings that suggest job sections
        'h1, h2, h3, h4, h5, h6',
        // Form elements for applications
        'form[action*="apply"], form[action*="submit"]',
        // Buttons for applying
        'button[class*="apply"], a[class*="apply"], input[value*="apply"]'
    ];
    
    let structureScore = 0;
    
    // Check for job-related headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
        const headingText = heading.textContent.toLowerCase();
        const hasJobHeading = JD_EXTRACTION_CONFIG.sectionPatterns.some(pattern => 
            pattern.test(headingText)
        );
        if (hasJobHeading) {
            structureScore += 10;
        }
    });
    
    // Check for application forms or buttons
    const applyElements = document.querySelectorAll(
        'button, a, input[type="submit"], input[type="button"]'
    );
    
    applyElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        const applyKeywords = ['apply', 'submit application', 'apply now', 'quick apply'];
        if (applyKeywords.some(keyword => text.includes(keyword))) {
            structureScore += 15;
        }
    });
    
    return structureScore >= 20;
}

// Add debugging and validation functions
window.resumeFixerDebug = {
    /**
     * Test the adaptive extraction on the current page
     */
    testExtraction: function() {
        console.log('=== Resume Fixer Debug: Testing Adaptive Extraction ===');
        
        // Test job page detection
        const isJobPage = isJobPostingPage();
        console.log('Is job posting page:', isJobPage);
        
        // Test extraction
        const result = detectJobDescription();
        console.log('Extraction result:', result);
        
        if (result.success) {
            console.log('✅ Extraction successful!');
            console.log('Job Title:', result.payload.jobTitle);
            console.log('Company:', result.payload.company);
            console.log('Location:', result.payload.location);
            console.log('Description length:', result.payload.description.length);
            console.log('Skills found:', result.payload.skills.length);
            console.log('Requirements found:', result.payload.requirements.length);
        } else {
            console.log('❌ Extraction failed');
            if (result.partialData) {
                console.log('Partial data:', result.partialData);
            }
        }
        
        return result;
    },
    
    /**
     * Get extraction candidates for debugging
     */
    getCandidates: function() {
        console.log('=== Resume Fixer Debug: Extraction Candidates ===');
        
        // Test title extraction
        console.log('Title candidates:');
        const titleCandidates = this.getTitleCandidates();
        titleCandidates.forEach((candidate, index) => {
            console.log(`${index + 1}. "${candidate.text}" (score: ${candidate.score})`);
        });
        
        // Test description extraction
        console.log('\nDescription candidates:');
        const descCandidates = this.getDescriptionCandidates();
        descCandidates.slice(0, 3).forEach((candidate, index) => {
            console.log(`${index + 1}. Length: ${candidate.text.length}, Score: ${candidate.score}`);
            console.log(`   Preview: "${candidate.text.substring(0, 100)}..."`);
        });
        
        return { titleCandidates, descCandidates };
    },
    
    getTitleCandidates: function() {
        const candidates = [];
        
        // Get h1 elements
        const h1Elements = document.querySelectorAll('h1');
        h1Elements.forEach(el => {
            const text = el.textContent.trim();
            if (text.length > 5 && text.length < 100) {
                candidates.push({
                    text: text,
                    score: calculateTitleScore(text, el),
                    element: el
                });
            }
        });
        
        return candidates.sort((a, b) => b.score - a.score);
    },
    
    getDescriptionCandidates: function() {
        const candidates = [];
        
        // Find large text blocks
        const textBlocks = findLargeTextBlocks();
        textBlocks.forEach(block => {
            if (block.text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                candidates.push({
                    text: block.text,
                    score: calculateDescriptionScore(block.text, block.element),
                    element: block.element
                });
            }
        });
        
        return candidates.sort((a, b) => b.score - a.score);
    }
};

// Add console command for easy testing
console.log('Resume Fixer: Debug tools available at window.resumeFixerDebug');
console.log('Try: resumeFixerDebug.testExtraction() or resumeFixerDebug.getCandidates()');

// Run auto-detection on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoDetectJob);
} else {
    autoDetectJob();
}

// Re-run detection on URL changes (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        autoDetectJob();
    }
}).observe(document, { subtree: true, childList: true });
