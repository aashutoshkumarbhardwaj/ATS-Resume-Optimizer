/**
 * Content Script
 * Runs on web pages and can interact with the DOM
 */

console.log('Resume Fixer content script loaded');

// Site-specific selectors for job description detection
const SITE_SELECTORS = {
    'linkedin.com': {
        jobTitle: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title',
        company: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name',
        description: '.jobs-description__content, .jobs-box__html-content',
        location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet'
    },
    'indeed.com': {
        jobTitle: '.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"]',
        company: '[data-company-name="true"], .jobsearch-InlineCompanyRating-companyHeader',
        description: '#jobDescriptionText, .jobsearch-jobDescriptionText',
        location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle'
    },
    'glassdoor.com': {
        jobTitle: '[data-test="job-title"], .job-title',
        company: '[data-test="employer-name"], .employer-name',
        description: '.jobDescriptionContent, [data-test="job-description"]',
        location: '[data-test="location"], .location'
    },
    'monster.com': {
        jobTitle: '.job-header-title, h1[data-test-id="svx-job-title"]',
        company: '.company-name, [data-test-id="svx-company-name"]',
        description: '.job-description, [data-test-id="job-description"]',
        location: '.location, [data-test-id="location"]'
    },
    'ziprecruiter.com': {
        jobTitle: '.job_title, h1.job-title',
        company: '.hiring_company_text, .company-name',
        description: '.job_description, .jobDescriptionSection',
        location: '.location, .job-location'
    }
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
 * Detect and extract job description from the current page
 */
function detectJobDescription() {
    const currentDomain = window.location.hostname.toLowerCase();
    const url = window.location.href;
    
    // Find matching site selector
    let siteKey = null;
    for (const site in SITE_SELECTORS) {
        if (currentDomain.includes(site)) {
            siteKey = site;
            break;
        }
    }

    if (!siteKey) {
        return {
            success: false,
            confidence: 0,
            message: 'Unsupported website. Please use manual input.',
            requiresManual: true
        };
    }

    const selectors = SITE_SELECTORS[siteKey];
    const jobData = {
        jobTitle: '',
        company: '',
        description: '',
        location: '',
        url: url,
        requirements: [],
        skills: []
    };

    // Extract job title
    const titleElement = document.querySelector(selectors.jobTitle);
    if (titleElement) {
        jobData.jobTitle = titleElement.innerText.trim();
    }

    // Extract company name
    const companyElement = document.querySelector(selectors.company);
    if (companyElement) {
        jobData.company = companyElement.innerText.trim();
    }

    // Extract job description
    const descriptionElement = document.querySelector(selectors.description);
    if (descriptionElement) {
        jobData.description = descriptionElement.innerText.trim();
    }

    // Extract location
    const locationElement = document.querySelector(selectors.location);
    if (locationElement) {
        jobData.location = locationElement.innerText.trim();
    }

    // Calculate confidence score
    const confidence = calculateConfidence(jobData);

    if (confidence >= 80) {
        // Extract requirements and skills from description
        const extracted = extractRequirementsAndSkills(jobData.description);
        jobData.requirements = extracted.requirements;
        jobData.skills = extracted.skills;

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
}

/**
 * Calculate confidence score for detected job data
 */
function calculateConfidence(jobData) {
    let score = 0;
    
    // Job title is critical (40 points)
    if (jobData.jobTitle && jobData.jobTitle.length > 3) {
        score += 40;
    }
    
    // Company name is important (20 points)
    if (jobData.company && jobData.company.length > 2) {
        score += 20;
    }
    
    // Description is essential (30 points)
    if (jobData.description && jobData.description.length > 100) {
        score += 30;
    } else if (jobData.description && jobData.description.length > 50) {
        score += 15;
    }
    
    // Location is nice to have (10 points)
    if (jobData.location && jobData.location.length > 2) {
        score += 10;
    }
    
    return score;
}

/**
 * Extract requirements and skills from job description text
 */
function extractRequirementsAndSkills(description) {
    const requirements = [];
    const skills = [];
    
    if (!description) {
        return { requirements, skills };
    }

    const lowerDesc = description.toLowerCase();
    
    // Common technical skills to look for
    const technicalSkills = [
        'javascript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'php', 'swift', 'kotlin',
        'react', 'angular', 'vue', 'node\\.?js', 'express', 'django', 'flask', 'spring',
        'mongodb', 'postgresql', 'mysql', 'sql', 'nosql', 'redis',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins',
        'git', 'github', 'gitlab', 'jira', 'agile', 'scrum',
        'html', 'css', 'typescript', 'rest api', 'graphql',
        'machine learning', 'ai', 'data science', 'tensorflow', 'pytorch'
    ];
    
    // Extract technical skills
    technicalSkills.forEach(skill => {
        const regex = new RegExp('\\b' + skill + '\\b', 'gi');
        if (regex.test(description)) {
            const match = description.match(regex);
            if (match && !skills.includes(match[0])) {
                skills.push(match[0]);
            }
        }
    });
    
    // Extract requirements (lines starting with bullet points or numbers)
    const lines = description.split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();
        // Check if line starts with bullet, number, or requirement keywords
        if (trimmed.match(/^[•\-\*\d+\.]/)) {
            if (trimmed.length > 10 && trimmed.length < 200) {
                requirements.push(trimmed);
            }
        }
    });
    
    return { requirements, skills };
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
 * Auto-detect job on supported sites
 */
function autoDetectJob() {
    const jobSites = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com'];
    const currentDomain = window.location.hostname.toLowerCase();

    if (jobSites.some(site => currentDomain.includes(site))) {
        console.log('Resume Fixer: Job site detected, attempting auto-detection...');
        
        // Wait for page to fully load
        setTimeout(() => {
            const result = detectJobDescription();
            if (result.success && result.confidence >= 80) {
                console.log('Resume Fixer: Job detected with confidence', result.confidence);
                injectJobDetectionIndicator();
                
                // Notify service worker
                chrome.runtime.sendMessage({
                    type: 'JOB_DETECTED',
                    payload: result.payload
                });
            } else {
                console.log('Resume Fixer: Job detection failed or low confidence', result.confidence);
            }
        }, 2000);
    }
}

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
