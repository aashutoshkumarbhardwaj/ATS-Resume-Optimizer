/**
 * Content Script
 * Runs on web pages and can interact with the DOM
 */

(function() {
if (window.resumeFixerScriptInjected) return;
window.resumeFixerScriptInjected = true;

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
    ],
    
    // Minimum job keyword matches required to consider it a valid job description
    minJobKeywordMatches: 3,
    
    // URL patterns that indicate job posting pages
    jobPagePatterns: [
        /linkedin\.com.*\/jobs?/i,
        /indeed\.com/i,
        /glassdoor\.com/i,
        /monster\.com/i,
        /dice\.com/i,
        /ziprecruiter\.com/i,
        /workable\.com/i,
        /greenhouse\.io/i,
        /lever\.co/i,
        /(?:career|job|position|vacancy)s?\/\d+/i,
        /apply|recruit|hiring|vacancy/i
    ]
};

// Current detected job data
let detectedJob = null;

/**
 * Extension Context Validation & Safe Messaging with Reconnection
 * Handles extension reload/invalidation gracefully with automatic reconnection
 */

// Track connection state
let isContextValid = true;
let messageQueue = [];
let isReconnecting = false;

function isExtensionContextValid() {
    try {
        void chrome.runtime.id;
        return true;
    } catch (error) {
        return false;
    }
}

// Connection keep-alive - prevents service worker from being terminated
function startKeepAliveInterval() {
    let consecutiveFailures = 0;
    
    // DON'T start pinging if context is already invalid
    if (!isExtensionContextValid()) {
        console.warn('[Content] ⚠️ Extension context invalid at startup, keep-alive disabled');
        return;
    }
    
    setInterval(() => {
        // Silently skip if context invalid - don't spam logs
        if (!isExtensionContextValid()) {
            consecutiveFailures++;
            return;
        }
        
        consecutiveFailures = 0;
        
        try {
            chrome.runtime.sendMessage({ type: 'PING', silent: true }, (response) => {
                if (chrome.runtime.lastError) {
                    // Silently ignore - don't spam console
                }
            });
        } catch (e) {
            // Silently ignore
        }
    }, 30000);
}

// Attempt to reconnect when context becomes invalid
async function reconnectToExtension() {
    if (isReconnecting) return; // Prevent concurrent reconnection attempts
    isReconnecting = true;
    
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            // Try to send a test message
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'PING', silent: true }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            // Connection restored
            isContextValid = true;
            isReconnecting = false;
            console.log('[Content] ✅ Context reconnected successfully');
            
            // Flush queued messages
            while (messageQueue.length > 0) {
                const { message, callback } = messageQueue.shift();
                safeSendMessage(message, callback);
            }
            
            return true;
        } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            }
        }
    }
    
    isReconnecting = false;
    console.error('[Content] ❌ Failed to reconnect after 5 attempts');
    return false;
}

function safeSendMessage(message, callback) {
    // Check context validity
    if (!isExtensionContextValid()) {
        console.warn('[Content] ⚠️ Extension context invalid, attempting reconnection...');
        isContextValid = false;
        
        // Queue the message for retry
        messageQueue.push({ message, callback });
        
        // Try to reconnect
        reconnectToExtension().then((reconnected) => {
            if (!reconnected && callback) {
                callback({ error: 'Extension context invalidated and reconnection failed' });
            }
        });
        return;
    }
    
    try {
        chrome.runtime.sendMessage(message, (response) => {
            // Check context again in callback
            if (!isExtensionContextValid()) {
                console.warn('[Content] ⚠️ Context invalidated in callback, queuing for retry');
                messageQueue.push({ message, callback });
                if (!isReconnecting) {
                    reconnectToExtension();
                }
                return;
            }
            
            if (chrome.runtime.lastError) {
                console.warn('[Content] Message error:', chrome.runtime.lastError.message);
                
                // Handle specific errors
                if (chrome.runtime.lastError.message.includes('context')) {
                    isContextValid = false;
                    messageQueue.push({ message, callback });
                    if (!isReconnecting) {
                        reconnectToExtension();
                    }
                } else if (callback) {
                    callback({ error: chrome.runtime.lastError.message });
                }
                return;
            }
            
            if (callback) callback(response);
        });
    } catch (error) {
        console.error('[Content] Error sending message:', error.message);
        if (callback) callback({ error: error.message });
    }
}

// Start keep-alive when script loads
startKeepAliveInterval();

// Setup message listener
console.log('[Content] 📡 Setting up message listener...');

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Content] 📬 Message received. Type:', request.type, 'Sender:', sender.id ? 'Extension' : 'Content');
    
    // Validate context at start of listener
    if (!isExtensionContextValid()) {
        console.warn('[Content] ⚠️ Extension context invalidated in message listener');
        sendResponse({ error: 'Extension context invalidated' });
        return;
    }
    
    if (request.type === 'EXTRACT_RESUME') {
        try {
            const resumeText = extractResumeContent();
            sendResponse({ success: true, resumeText });
        } catch (err) {
            console.error('[Content] Error extracting resume:', err);
            sendResponse({ success: false, message: err.message });
        }
    } else if (request.type === 'HIGHLIGHT_KEYWORDS') {
        try {
            highlightKeywords(request.keywords);
            sendResponse({ success: true });
        } catch (err) {
            console.error('[Content] Error highlighting keywords:', err);
            sendResponse({ success: false, message: err.message });
        }
    } else if (request.type === 'DETECT_JOB') {
        try {
            const jobData = detectJobDescription();
            sendResponse(jobData);
        } catch (err) {
            console.error('[Content] Error detecting job:', err);
            sendResponse({ success: false, message: err.message });
        }
    } else if (request.type === 'GET_DETECTED_JOB') {
        sendResponse({ success: true, job: detectedJob });
    } else if (request.type === 'PERFORM_AUTOFILL') {
        try {
            const result = performAutofill(request.profile);
            
            // Handle async response (from Google Forms)
            if (result instanceof Promise) {
                result.then((response) => {
                    if (!isExtensionContextValid()) {
                        console.warn('[Content] Context invalidated in async response');
                        return;
                    }
                    console.log('[Content] Async autofill completed:', response);
                    sendResponse({ 
                        success: true, 
                        filledCount: response.filledCount,
                        missedFields: response.missedFields
                    });
                }).catch((error) => {
                    console.error('[Content] Async autofill error:', error);
                    sendResponse({ success: false, message: error.message });
                });
                return true; // Keep channel open for async
            } else {
                // Sync response
                sendResponse({ 
                    success: true, 
                    filledCount: result.filledCount,
                    missedFields: result.missedFields
                });
            }
        } catch (err) {
            console.error('[Content] Autofill error:', err);
            sendResponse({ success: false, message: err.message });
        }
        return true; // Keep channel open for async
    } else if (request.type === 'SETTINGS_UPDATED') {
        try {
            if (request.settings && request.settings.showAutofillBadge === false) {
                removeAutofillBadge();
            } else {
                // Show the button if it exists
                const btn = document.getElementById('ats-unified-autofill-button');
                if (btn) {
                    btn.classList.remove('hidden');
                    console.log('[Content] ✅ Autofill button shown');
                }
            }
            sendResponse({ success: true });
        } catch (err) {
            console.error('[Content] Error updating settings:', err);
            sendResponse({ success: false, message: err.message });
        }
    } else if (request.type === 'SHOW_AUTOFILL_BUTTON') {
        // User clicked "Show Autofill Button" in popup
        if (isExtensionContextValid()) {
            chrome.storage.local.set({ autofillButtonHidden: false }, () => {
                if (!isExtensionContextValid()) {
                    console.warn('[Content] Context invalidated in storage callback');
                    return;
                }
                // Show the button if it exists
                const btn = document.getElementById('ats-unified-autofill-button');
                if (btn) {
                    btn.classList.remove('hidden');
                    console.log('[Content] ✅ Autofill button re-enabled by user');
                }
                sendResponse({ success: true });
            });
        }
        return true;
    } else if (request.type === 'FETCH_JOB_DESCRIPTION') {
        // User clicked "Fetch Job Description" button in popup
        try {
            const jobData = detectJobDescription();
            if (jobData && jobData.success) {
                // Save to storage so popup can access it
                if (isExtensionContextValid()) {
                    chrome.storage.local.set({
                        currentJob: jobData,
                        manuallyFetched: true
                    }, () => {
                        if (!isExtensionContextValid()) {
                            console.warn('[Content] Context invalidated in storage callback');
                            return;
                        }
                        console.log('[Content] Job description fetched and saved');
                        sendResponse({ 
                            success: true, 
                            job: jobData,
                            message: 'Job description fetched successfully!' 
                        });
                    });
                } else {
                    sendResponse({ 
                        success: false, 
                        message: 'Could not find job description on this page' 
                    });
                }
            } else {
                sendResponse({ 
                    success: false, 
                    message: 'Could not find job description on this page' 
                });
            }
        } catch (error) {
            console.error('[Content] Error fetching job description:', error);
            sendResponse({ 
                success: false, 
                message: 'Error: ' + error.message 
            });
        }
        return true;
    } else if (request.type === 'TRIGGER_AUTOFILL_FROM_POPUP' || request.type === 'TRIGGER_AUTOFILL_FROM_BUTTON') {
        // Handle autofill trigger from popup or button
        console.log('[Content] 📬 Received autofill trigger:', request.type);
        
        try {
            if (typeof AutofillOrchestrator === 'undefined') {
                console.error('[Content] ❌ AutofillOrchestrator not available');
                sendResponse({ success: false, error: 'AutofillOrchestrator not loaded', filledCount: 0 });
                return true;
            }
            
            // Get profile from request or storage
            let profile = request.profile;
            
            if (!profile) {
                console.log('[Content] 🔍 No profile in message, loading from storage...');
                // Load profile from storage if not in request
                chrome.storage.local.get(['autofillProfile'], (storageResult) => {
                    if (!isExtensionContextValid()) {
                        console.warn('[Content] Context invalidated during storage read');
                        sendResponse({ success: false, error: 'Extension context invalidated', filledCount: 0 });
                        return;
                    }
                    
                    profile = storageResult.autofillProfile;
                    console.log('[Content] 📦 Loaded profile from storage. Keys:', profile ? Object.keys(profile).length : 0);
                    executeAutofill(profile);
                });
            } else {
                console.log('[Content] 📦 Profile from message. Keys:', Object.keys(profile).length);
                executeAutofill(profile);
            }
            
            function executeAutofill(userProfile) {
                console.log('[Content] 🚀 Executing autofill with profile:', userProfile ? 'present' : 'MISSING');
                
                if (!userProfile || Object.keys(userProfile).length === 0) {
                    console.warn('[Content] ⚠️ No profile data available for autofill');
                    sendResponse({ 
                        success: false, 
                        error: 'No profile saved. Please save your profile first in the popup.',
                        filledCount: 0,
                        missedFields: []
                    });
                    return;
                }
                
                try {
                    const orchestrator = new AutofillOrchestrator();
                    
                    console.log('[Content] 🎯 Starting orchestrator with profile...');
                    orchestrator.start({ profile: userProfile }).then(result => {
                        console.log('[Content] ✅ Autofill complete:', result);
                        
                        // Extract count from result
                        let filledCount = 0;
                        let missedFields = [];
                        
                        if (result && result.data) {
                            filledCount = result.data.filled || 0;
                            missedFields = result.data.missedFields || [];
                        }
                        
                        sendResponse({ 
                            success: true, 
                            result,
                            filledCount,
                            missedFields
                        });
                    }).catch(error => {
                        console.error('[Content] ❌ Autofill orchestrator error:', error);
                        sendResponse({ 
                            success: false, 
                            error: error.message,
                            filledCount: 0,
                            missedFields: []
                        });
                    });
                } catch (error) {
                    console.error('[Content] ❌ Error creating orchestrator:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message,
                        filledCount: 0,
                        missedFields: []
                    });
                }
            }
            
            return true; // Keep channel open for async
        } catch (error) {
            console.error('[Content] ❌ Error triggering autofill:', error);
            sendResponse({ 
                success: false, 
                error: error.message,
                filledCount: 0,
                missedFields: []
            });
            return true;
        }
    } else if (request.type === 'DETECT_QUESTIONS') {
        // Scan page for open-ended application questions
        try {
            const questions = detectApplicationQuestions();
            sendResponse({ success: true, questions });
        } catch (err) {
            sendResponse({ success: false, questions: [], message: err.message });
        }
        return false;

    } else if (request.type === 'FILL_ANSWERS') {
        // Fill approved answers into their fields robustly
        (async () => {
            try {
                const answers = request.answers || [];
                const mapping = [];
                
                answers.forEach(({ fieldIndex, answer, id }) => {
                    const el = window.__qaDetectedFields?.[fieldIndex];
                    if (el && answer) {
                        mapping.push({ element: el, answer, id });
                    }
                });

                if (mapping.length > 0) {
                    const automator = new BrowserAutomationModule();
                    const results = await automator.fillBatch(mapping, (curr, total, status) => {
                        console.log(`[Content] Q&A Fill Progress: ${curr}/${total} - ${status}`);
                        // We could send a progress message back here if needed
                    });
                    sendResponse({ success: true, filled: results.filled, details: results });
                } else {
                    sendResponse({ success: true, filled: 0 });
                }
            } catch (err) {
                console.error('[Content] Error in FILL_ANSWERS:', err);
                sendResponse({ success: false, filled: 0, message: err.message });
            }
        })();
        return true; // Keep message channel open for async response

    } else {
        // Unknown message type - log it but don't error
        console.log('[Content] ℹ️ Received unknown message type:', request.type);
        sendResponse({ error: 'Unknown message type: ' + request.type });
        return false;
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Smart Q&A: Question Detection + Field Filling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Question-like label patterns
 */
const QUESTION_LABEL_PATTERNS = [
    /\?$/,
    /\bwhy\b/i, /\bhow\b/i, /\bdescribe\b/i, /\btell us\b/i, /\bexplain\b/i,
    /\bwhat.{0,20}(experience|skills|background|motivat|bring)/i,
    /\bplease (share|provide|describe|tell)/i,
    /\bcover letter\b/i, /\badditional.{0,15}(information|comment)/i,
    /\bsalary\b/i, /\bnotice period\b/i, /\bavailability\b/i,
    /\bachievement\b/i, /\bstrength\b/i, /\bweakness\b/i,
    /\bgoal\b/i, /\bself.?introduc/i
];

/**
 * Returns the label text for a form field element.
 * Checks: <label for=id>, aria-label, placeholder, preceding sibling/parent text.
 */
function getLabelForField(el) {
    // 1. <label for="id">
    if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return label.textContent.trim();
    }
    // 2. aria-label / aria-labelledby
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.getAttribute('aria-labelledby')) {
        const ref = document.getElementById(el.getAttribute('aria-labelledby'));
        if (ref) return ref.textContent.trim();
    }
    // 3. placeholder
    if (el.placeholder && el.placeholder.length > 5) return el.placeholder.trim();
    // 4. Closest wrapping label
    const wrappingLabel = el.closest('label');
    if (wrappingLabel) return wrappingLabel.textContent.replace(el.value || '', '').trim();
    // 5. Preceding sibling or parent text (up to 3 levels)
    let parent = el.parentElement;
    for (let i = 0; i < 4 && parent; i++) {
        // Prefer a <label>, <p>, <span>, <h*> sibling that comes before
        const siblings = Array.from(parent.children);
        const myIdx = siblings.indexOf(el);
        for (let j = myIdx - 1; j >= Math.max(0, myIdx - 3); j--) {
            const sib = siblings[j];
            if (sib && /^(LABEL|P|SPAN|H[1-6]|DIV|LI)$/.test(sib.tagName)) {
                const txt = sib.textContent.trim();
                if (txt.length > 4 && txt.length < 250) return txt;
            }
        }
        parent = parent.parentElement;
    }
    return '';
}

/**
 * Detect all open-ended question fields on the current page.
 * Returns array of { question, fieldIndex, tagName, placeholder, ... }
 * and stores field elements in window.__qaDetectedFields for later filling.
 */
function detectApplicationQuestions() {
    window.__qaDetectedFields = window.__qaDetectedFields || [];
    window.__qaDetectedFields = []; // Reset
    
    let questions = [];
    
    try {
        const engine = new QuestionExtractionEngine();
        questions = engine.extractAll();
    } catch (e) {
        console.error('[Content] Error running QuestionExtractionEngine:', e);
        return [];
    }

    const results = [];
    
    questions.forEach((q, idx) => {
        // Skip fields that are already filled with substantial content (>20 chars)
        if ((q.element.value || '').trim().length > 20) return;
        
        const fieldIndex = window.__qaDetectedFields.length;
        window.__qaDetectedFields.push(q.element);
        
        results.push({
            id: q.id,
            question: q.questionText,
            fieldIndex,
            tagName: q.fieldType,
            placeholder: q.placeholder,
            helpText: q.helpText,
            required: q.required,
            maxLength: q.maxLength,
            sectionHeading: q.sectionHeading,
            nearbyLabels: q.nearbyLabels,
            validationHints: q.validationHints
        });
    });

    console.log(`[Content] Q&A: Detected ${results.length} question field(s) using Extraction Engine`);
    return results;
}

// fillAnswerIntoField replaced by BrowserAutomationModule

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
        
        const hasMinDescription = jobData.description && jobData.description.trim().length > 50;
        
        if (confidence >= 35 || hasMinDescription) { // Lowered threshold for adaptive approach
            // Extract requirements and skills from description
            const extracted = extractRequirementsAndSkills(jobData.description);
            jobData.requirements = extracted.requirements;
            jobData.skills = extracted.skills;
            jobData.url = url;
            
            // Extract the job board source (e.g. Wellfound, LinkedIn, Foundit)
            const hostname = new URL(url).hostname;
            let source = 'Direct Website';
            const knownJobSitesMap = {
                'wellfound.com': 'Wellfound',
                'linkedin.com': 'LinkedIn',
                'indeed.com': 'Indeed',
                'glassdoor.com': 'Glassdoor',
                'monster.com': 'Monster',
                'ziprecruiter.com': 'ZipRecruiter',
                'careerbuilder.com': 'CareerBuilder',
                'foundit': 'Foundit', // foundit.in, foundit.com, etc.
                'naukri.com': 'Naukri'
            };
            
            for (const [key, value] of Object.entries(knownJobSitesMap)) {
                if (hostname.includes(key)) {
                    source = value;
                    break;
                }
            }
            jobData.source = source;

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
 * Fallback description extraction - avoids form pages and raw body dump
 */
function extractFallbackDescription() {
    // Try to find the main content area (skip forms)
    const mainSelectors = [
        'main', 'article', '[role="main"]', '.main-content', 
        '#main-content', '.content', '#content'
    ];
    
    for (const selector of mainSelectors) {
        try {
            const element = document.querySelector(selector);
            if (element && !isFormElement(element)) {
                const text = getCleanText(element);
                if (text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                    return text;
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }
    
    // Last resort: get largest non-form text block
    const allBlocks = Array.from(document.querySelectorAll('div, section, article'))
        .filter(el => !isFormElement(el))
        .map(el => ({ el, text: getCleanText(el) }))
        .filter(({ text }) => text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength)
        .sort((a, b) => b.text.length - a.text.length);
    
    if (allBlocks.length > 0) {
        return allBlocks[0].text.substring(0, JD_EXTRACTION_CONFIG.maxDescriptionLength);
    }
    
    return '';
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/\b\d+\s*[a-zA-Z]+\s*ago\b/gi, '') // Strip relative time like "3w ago", "2 days ago"
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

    // Massive penalty for known job boards to prevent them from being extracted as the company
    const jobBoards = ['wellfound', 'linkedin', 'indeed', 'glassdoor', 'monster', 'ziprecruiter', 'careerbuilder', 'foundit', 'naukri', 'dice', 'simplyhired'];
    jobBoards.forEach(board => {
        if (lowerText.includes(board)) {
            score -= 100;
        }
    });
    
    // Bonus for capitalized words (company names are usually capitalized)
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(word => word.length > 0 && word[0] === word[0].toUpperCase());
    score += capitalizedWords.length * 3;
    
    return score;
}

/**
 * Check if an element is a form/registration area (to skip it)
 */
function isFormElement(el) {
    // Skip if it IS a form
    if (el.tagName === 'FORM') return true;
    // Skip if it contains several inputs (registration form, not JD)
    const inputs = el.querySelectorAll('input, select, textarea');
    if (inputs.length >= 3) return true;
    // Skip if it's inside a form
    if (el.closest('form')) return true;
    return false;
}

/**
 * Get clean text from element, stripping out style/script tags content
 */
function getCleanText(el) {
    // Clone to avoid mutating DOM
    const clone = el.cloneNode(true);
    // Remove style, script, noscript, input, select, textarea, label, button elements
    clone.querySelectorAll('style, script, noscript, input, select, textarea, button, label, .helpPopup').forEach(e => e.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * Extract job description using multiple strategies and text density analysis
 */
function extractJobDescription() {
    const candidates = [];
    
    // First, check if this looks like a job page
    const isLikelyJobPage = isJobPostingPage();
    
    // Strategy 1: Look for elements with description-related attributes or classes
    const descriptionSelectors = [
        '[class*="description"]', '[class*="job-detail"]', '[class*="jobDetail"]',
        '[class*="posting"]', '[class*="vacancy"]', '[class*="job-content"]',
        '[id*="description"]', '[id*="job-detail"]', '[id*="jobDescription"]'
    ];
    
    descriptionSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (isFormElement(el)) return;
                const text = getCleanText(el);
                if (text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                    candidates.push({
                        text: text,
                        score: calculateDescriptionScore(text, el, true),
                        element: el,
                        source: 'semantic'
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
        if (isFormElement(heading)) return;
        const headingText = heading.textContent.trim().toLowerCase();
        
        // Check if heading matches job description patterns
        const isJobSection = JD_EXTRACTION_CONFIG.sectionPatterns.some(pattern => 
            pattern.test(headingText)
        );
        
        if (isJobSection) {
            // Find content after this heading
            const content = getContentAfterHeading(heading);
            if (content && content.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                // Clean CSS from heading content
                const cleanContent = content.replace(/\.helpPopup\s*\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
                candidates.push({
                    text: cleanContent,
                    score: calculateDescriptionScore(cleanContent, heading, isLikelyJobPage) + 30, // Bonus for semantic heading
                    element: heading,
                    source: 'heading'
                });
            }
        }
    });
    
    // Strategy 3: Text density analysis - find the largest block of meaningful text
    // Only use this if we're on a job page or if we found semantic markers
    if (isLikelyJobPage || candidates.length > 0) {
        const textBlocks = findLargeTextBlocks();
        textBlocks.forEach(block => {
            if (isFormElement(block.element)) return;
            if (block.text.length >= JD_EXTRACTION_CONFIG.minDescriptionLength) {
                candidates.push({
                    text: block.text,
                    score: calculateDescriptionScore(block.text, block.element, isLikelyJobPage) + 15,
                    element: block.element,
                    source: 'density'
                });
            }
        });
    }
    
    // Filter candidates by minimum score threshold
    const validCandidates = candidates.filter(c => c.score >= 30);
    
    if (validCandidates.length > 0) {
        validCandidates.sort((a, b) => b.score - a.score);
        console.log(`[Content] Selected job description from: ${validCandidates[0].source} (score: ${validCandidates[0].score})`);
        return validCandidates[0].text;
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
 * Check if current page is likely a job posting page
 */
function isJobPostingPage() {
    const url = window.location.href.toLowerCase();
    const htmlContent = document.documentElement.innerHTML.toLowerCase();
    
    // Check URL patterns
    const urlMatches = JD_EXTRACTION_CONFIG.jobPagePatterns.some(pattern => pattern.test(url));
    
    // Check for job-related meta tags or structured data
    const hasJobMetaTags = 
        document.querySelector('meta[property="og:title"][content*="job"]') ||
        document.querySelector('meta[name="description"][content*="job posting"]') ||
        document.querySelector('script[type="application/ld+json"]');
    
    // Check for common job site indicators in page
    const hasJobSiteIndicators = 
        /linkedin|indeed|glassdoor|monster|dice|ziprecruiter/i.test(htmlContent);
    
    return urlMatches || !!hasJobMetaTags || hasJobSiteIndicators;
}

/**
 * Calculate score for potential job description
 * Higher score = more likely to be actual job description
 */
function calculateDescriptionScore(text, element, isJobPage = false) {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // ❌ Heavily penalize CSS/style content (from .helpPopup etc.)
    if (/\.helpPopup\s*\{/.test(text) || /background-color\s*:/.test(text) || /z-index\s*:/.test(text)) {
        return -100;
    }
    
    // ✅ Bonus if on known job page
    if (isJobPage) {
        score += 20;
    }
    
    // ✅ Count job-related keywords for validation
    let jobKeywordMatches = 0;
    JD_EXTRACTION_CONFIG.jobKeywords.forEach(keyword => {
        const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
        const matches = text.match(regex);
        if (matches) {
            jobKeywordMatches += matches.length;
        }
    });
    
    // Require minimum keyword matches unless on known job page
    if (!isJobPage && jobKeywordMatches < JD_EXTRACTION_CONFIG.minJobKeywordMatches) {
        return -50; // Not enough job keywords - likely not a job description
    }
    
    // ✅ Award points based on keyword density
    score += Math.min(jobKeywordMatches * 5, 30);
    
    // ✅ Check for job description section patterns
    let hasDescriptionHeading = false;
    const parent = element.parentElement;
    if (parent) {
        const prevHeading = parent.querySelector('h1, h2, h3, h4, h5, h6');
        if (prevHeading) {
            hasDescriptionHeading = JD_EXTRACTION_CONFIG.sectionPatterns.some(pattern =>
                pattern.test(prevHeading.textContent)
            );
        }
    }
    
    if (hasDescriptionHeading) {
        score += 25;
    }
    
    // ✅ Check for job-specific vocabulary patterns
    const jobPatterns = [
        /\b(experience|expertise|background|track record)\b/gi,
        /\b(responsibilities|duties|accountable for)\b/gi,
        /\b(qualifications|requirements|must have|should have)\b/gi,
        /\b(skills|technical|proficiency|competencies)\b/gi,
        /\b(education|degree|bachelor|master|certification)\b/gi,
        /\b(apply|apply now|submit|join our team|become|join)\b/gi
    ];
    
    let patternMatches = 0;
    jobPatterns.forEach(pattern => {
        if (pattern.test(text)) {
            patternMatches++;
        }
    });
    
    score += Math.min(patternMatches * 5, 20);
    
    // ✅ Penalize if text looks like navigation or metadata
    const badPatterns = [
        /cookie|privacy|terms|disclaimer|copyright/gi,
        /menu|navigation|sidebar|footer/gi,
        /advertisement|ad|sponsored/gi
    ];
    
    badPatterns.forEach(pattern => {
        if (pattern.test(text)) {
            score -= 30;
        }
    });
    
    // ✅ Text length bonus (longer = more likely to be full description)
    if (text.length > 500) score += 15;
    if (text.length > 1000) score += 10;
    if (text.length > 2000) score += 10;
    
    return Math.max(score, 0); // Never go below 0
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
        if (!isExtensionContextValid()) {
            console.warn('[Content] Extension context invalid, skipping');
            return;
        }
        const text = extractResumeContent();
        safeSendMessage({
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
 * Extract required years of experience from job description with 99% high-accuracy heuristic engine
 */
function extractExperienceFromText(text) {
    if (!text) return "Not specified";
    
    // Normalize text: remove HTML tags if present, replace multiple whitespace
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    // Tier 1: Fresher / Entry Level / 0 Years Detection
    const fresherRegex = /\b(?:fresher[s]?|entry[\s-]level|no\s+prior\s+experience|no\s+experience\s+(?:required|needed)|0[\s-]1\s*years?)\b/i;
    if (fresherRegex.test(cleanText)) {
        return "Fresher / 0-1 Years";
    }

    // Tier 2: Explicit YOE Shorthands (e.g., "3+ YOE", "3-5 YOE", "3 YOE", "3+ Yrs Exp", "3+ yrs")
    const yoeRegex = /\b(\d+(?:\s*(?:-|to|–|—)\s*\d+)?\+?\s*(?:yoe|yrs?\s*exp|years?\s*exp|years?\s*of\s*exp))\b/i;
    const yoeMatch = cleanText.match(yoeRegex);
    if (yoeMatch && yoeMatch[1]) {
        return yoeMatch[1].trim();
    }

    // Tier 3: Years pattern constructor supporting digits and word numbers
    const numWords = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen";
    const num = `(?:\\d+|${numWords})`;
    const range = `${num}(?:\\s*(?:-|to|and|–|—)\\s*${num})?\\+?`;
    
    // Pattern A: "Experience: 3-5 years" or "Required Experience: 3+ yrs"
    const patternA = new RegExp(`(?:experience|required|qualification|background|minimum|at least)\\s*(?::|\\s+of)?\\s*(?:minimum|at least)?\\s*(${range}\\s*(?:years?|yrs?))\\b`, 'i');
    const matchA = cleanText.match(patternA);
    if (matchA && matchA[1]) {
        return matchA[1].trim();
    }

    // Pattern B: "3+ years of experience", "3+ years relevant experience", "3+ years working with", "3+ years in React"
    const patternB = new RegExp(`\\b(${range}\\s*(?:years?|yrs?)(?:'|’)?)\\b(?:\\s+\\w+){0,6}\\s+(?:experience|exp|in\\b|working|role|software|engineering|development|industry)`, 'i');
    const matchB = cleanText.match(patternB);
    if (matchB && matchB[1]) {
        return matchB[1].trim();
    }

    // Pattern C: "Minimum 3 years" or "At least 3 years"
    const patternC = new RegExp(`(?:minimum|at\\s+least|min)\\s+(?:of\\s+)?(${range}\\s*(?:years?|yrs?))\\b`, 'i');
    const matchC = cleanText.match(patternC);
    if (matchC && matchC[1]) {
        return matchC[1].trim();
    }

    // Pattern D: Fallback near keywords like "building", "professional", "proven"
    const patternD = new RegExp(`\\b(${range}\\s*(?:years?|yrs?))\\b(?:\\s+(?:of|in|with|building|designing|managing|coding|programming|professional))`, 'i');
    const matchD = cleanText.match(patternD);
    if (matchD && matchD[1]) {
        return matchD[1].trim();
    }

    // Pattern E: Any standalone "X+ years", "X-Y years", "X yrs" with sanity validation (0-30 years)
    const patternE = new RegExp(`\\b(${range}\\s*(?:years?|yrs?))\\b`, 'i');
    const matchE = cleanText.match(patternE);
    if (matchE && matchE[1]) {
        const digits = matchE[1].match(/\d+/g);
        if (digits) {
            const firstVal = parseInt(digits[0], 10);
            if (firstVal >= 0 && firstVal <= 30) {
                return matchE[1].trim();
            }
        } else {
            return matchE[1].trim();
        }
    }

    return "Not specified";
}

/**
 * Inject visual indicator when job is detected
 */
function injectJobDetectionIndicator(experienceText = null) {
    // Remove existing indicator if present
    const existing = document.getElementById('rf-job-indicator');
    if (existing) {
        existing.remove();
    }

    const indicator = document.createElement('div');
    indicator.id = 'rf-job-indicator';
    
    const subText = experienceText 
        ? `Requires: <strong>${experienceText}</strong>`
        : `Experience: Not explicitly specified`;
        
    indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📄</span>
            <span style="font-weight: 600;">Job Detected!</span>
        </div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
            ${subText}
        </div>
        <button id="rf-mark-applied-btn" style="margin-top: 8px; padding: 4px 8px; background: white; color: #667eea; border-radius: 4px; border: none; cursor: pointer; font-size: 11px; width: 100%; font-weight: bold;">
            ✅ Mark as Applied
        </button>
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

    indicator.addEventListener('click', (e) => {
        if (!isExtensionContextValid()) {
            console.warn('[Content] Extension context invalid, skipping');
            return;
        }
        
        // Handle "Mark as Applied" button click separately
        if (e.target && e.target.id === 'rf-mark-applied-btn') {
            e.stopPropagation();
            
            const btn = e.target;
            btn.innerText = '⏳ Saving...';
            btn.style.opacity = '0.7';
            
            safeSendMessage({
                type: 'TRACK_MANUAL_APPLICATION',
                payload: detectedJob
            });
            
            setTimeout(() => {
                btn.innerText = '✅ Saved!';
                btn.style.background = '#e6fffa';
                btn.style.color = '#319795';
            }, 500);
            return;
        }

        // Default action: open popup
        safeSendMessage({
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
            
            // Show the tracking button even if we only have partial data
            if (result.success || result.partialData) {
                console.log('Resume Fixer: Job detected with confidence', result.confidence);
                
                const payload = result.payload || result.partialData || {};
                // Ensure detectedJob is updated so TRACK_MANUAL_APPLICATION has data
                detectedJob = payload;
                
                let experienceText = null;
                if (payload.description) {
                    experienceText = extractExperienceFromText(payload.description);
                }
                
                injectJobDetectionIndicator(experienceText);
                
                // Notify service worker
                if (isExtensionContextValid()) {
                    safeSendMessage({
                        type: 'JOB_DETECTED',
                        payload: payload
                    });
                }
            } else {
                console.log('Resume Fixer: Job detection completely failed', result.confidence);
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
        /position[-_]?id/,
        /test[-_]?form/
    ];
    
    const hasJobUrl = jobUrlPatterns.some(pattern => pattern.test(url));
    
    // Title-based indicators
    const jobTitleKeywords = [
        'job', 'career', 'position', 'opening', 'vacancy', 'hiring',
        'engineer', 'developer', 'manager', 'analyst', 'specialist', 'portal', 'apply'
    ];
    
    const hasJobTitle = jobTitleKeywords.some(keyword => title.includes(keyword));
    
    // Content-based indicators
    const jobContentKeywords = [
        'job description', 'responsibilities', 'requirements', 'qualifications',
        'apply now', 'submit application', 'years of experience', 'bachelor',
        'skills required', 'we are looking for', 'join our team', 'personal information'
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
    return score >= 25; // Threshold for considering it a job posting
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
        const applyKeywords = ['apply', 'submit application', 'apply now', 'quick apply', 'submit'];
        if (applyKeywords.some(keyword => text.includes(keyword))) {
            structureScore += 15;
        }
    });
    
    return structureScore >= 10;
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
        // Note: Button is initialized once at startup and persists across URL changes
        // No need to re-inject on URL changes
    }
}).observe(document, { subtree: true, childList: true });

/**
 * ============================================================================
 * Autofill Content Script Implementation
 * ============================================================================
 */

const FIELD_MAP = {
  full_name:   ['\\bfull\\s*name\\b', '^name$', 'complete\\s*name', 'applicant\\s*name', 'your\\s*name'],
  first_name:  ['\\bfirst\\s*name\\b', '^fname$', 'given\\s*name', 'forename'],
  last_name:   ['\\blast\\s*name\\b', '^lname$', 'surname', 'family\\s*name'],
  email:       ['email', 'e\\.?mail', 'email\\s*address'],
  phone:       ['phone', 'mobile', 'telephone', 'cell', 'contact\\s*no', 'ph\\.?no'],
  linkedin:    ['linkedin', 'linked\\.?in', 'profile\\s*url'],
  city:        ['city', 'town', 'location'],
  country:     ['country', 'nation'],
  github:      ['github', 'git-hub'],
  portfolio:   ['portfolio', 'website', 'homepage', 'personal\\s*(?:site|page|web)'],
  years_of_experience: ['years?\\s*of?\\s*(?:work\\s*)?experience', 'yoe', 'experience\\s*years'],
  current_title: ['current\\s*(?:job\\s*)?title', 'current\\s*role', 'designation', 'job\\s*title']
};

function detectFieldType(input) {
  const signals = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label'),
    input.getAttribute('autocomplete'),
    input.closest('label')?.textContent,
    document.querySelector(`label[for="${input.id}"]`)?.textContent,
  ].filter(Boolean).join(' ').toLowerCase();

  for (const [fieldType, patterns] of Object.entries(FIELD_MAP)) {
    if (patterns.some(p => new RegExp(p, 'i').test(signals))) {
      return fieldType;
    }
  }
  return null;
}

function fillField(input, value) {
  if (!value) return false;
  input.focus();

  // For React/Vue/Angular-controlled inputs, use the prototype property descriptor
  let prototype = HTMLInputElement.prototype;
  if (input.tagName === 'TEXTAREA') {
    prototype = HTMLTextAreaElement.prototype;
  } else if (input.tagName === 'SELECT') {
    prototype = HTMLSelectElement.prototype;
  }

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }

  // Trigger all the events React/Angular/Vue listen to
  ['input', 'change', 'blur'].forEach(eventType => {
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
  });

  animateFilledField(input);
  input.blur();
  return true;
}

function performAutofill(profile) {
    if (!profile || typeof profile !== 'object') {
        console.error('[Content] Invalid profile data:', profile);
        return { success: false, filledCount: 0, missedFields: [] };
    }
    
    console.log('[Content] 🔄 Starting autofill with profile:', {
        hasFullName: !!profile.full_name,
        hasEmail: !!profile.email,
        fieldCount: Object.keys(profile).length,
        hasCustomFields: Array.isArray(profile.custom_fields) && profile.custom_fields.length > 0
    });
    
    // Try both traditional forms and Google Forms
    let filledCount = 0;
    const missedFields = [];
    
    // Strategy 1: Traditional HTML inputs
    console.log('[Content] 📝 Filling traditional HTML form fields...');
    const inputs = document.querySelectorAll('input, textarea, select');
    let traditionalCount = 0;
    
    inputs.forEach((input, index) => {
        // Skip hidden inputs, buttons, submits, search, etc.
        if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || 
            input.type === 'image' || input.type === 'search' || input.disabled) {
            return;
        }
        
        const fieldType = detectFieldType(input);
        let valueToFill = null;
        
        // 1. Check standard fields
        if (fieldType && profile[fieldType]) {
            valueToFill = profile[fieldType];
        }
        
        // 2. Check custom fields if not filled
        if (!valueToFill && profile.custom_fields && Array.isArray(profile.custom_fields)) {
            const contextText = getFieldContext(input);
            const matchedCustom = profile.custom_fields.find(field => {
                const cleanKey = field.key.trim().toLowerCase();
                return cleanKey && contextText.toLowerCase().includes(cleanKey);
            });
            if (matchedCustom) {
                valueToFill = matchedCustom.value;
            }
        }
        
        // Fill field if match found and it's empty
        if (valueToFill && !input.value) {
            const filled = fillField(input, valueToFill);
            if (filled) {
                filledCount++;
                traditionalCount++;
            }
        } else if (!valueToFill) {
            // Track unfilled/missed fields
            if (!input.value && (input.tagName === 'TEXTAREA' || input.tagName === 'SELECT' || 
                ['text', 'email', 'tel', 'url', 'number'].includes(input.type))) {
                const label = getCleanLabel(input);
                if (label && !missedFields.includes(label)) {
                    missedFields.push(label);
                }
            }
        }
    });
    
    console.log(`[Content] ✅ Traditional forms: ${traditionalCount} fields filled out of ${inputs.length}`);
    
    // Strategy 2: Google Forms (iframe-based form fields) - now async with retry logic
    console.log('[Content] 📋 Starting Google Forms autofill (async)...');
    
    // Return a promise that handles both traditional and Google Forms
    return fillGoogleFormFieldsAsync(profile, missedFields).then((googleFormCount) => {
        filledCount += googleFormCount;
        console.log(`[Content] ✅ Google Forms: ${googleFormCount} fields filled`);
        console.log(`[Content] 🏁 Autofill complete: Total ${filledCount} fields filled, ${missedFields.length} fields missed`);
        
        return { success: true, filledCount, missedFields };
    }).catch((error) => {
        console.error('[Content] Error during Google Forms autofill:', error);
        console.log(`[Content] 🏁 Autofill complete (partial): Total ${filledCount} fields filled, ${missedFields.length} fields missed`);
        
        return { success: true, filledCount, missedFields };
    });
}

/**
 * Async wrapper for Google Forms autofill
 */
function fillGoogleFormFieldsAsync(profile, missedFields) {
    return new Promise(async (resolve) => {
        try {
            const googleFormCount = await performGoogleFormAutofill(profile, missedFields);
            resolve(googleFormCount || 0);
        } catch (error) {
            console.error('[Content] Error in fillGoogleFormFieldsAsync:', error);
            resolve(0);
        }
    });
}

/**
 * Fill Google Forms fields - ENTERPRISE VERSION
 * Handles:
 * - Lazy-loaded form questions
 * - React-controlled inputs
 * - Dynamic field detection
 * - All field types (text, textarea, select, radio, checkbox, date, etc.)
 * - Visible label matching instead of dynamic IDs
 * - Retry mechanism when new fields appear
 */
function fillGoogleFormFields(profile, missedFields) {
    let filledCount = 0;
    const startTime = Date.now();
    const maxRetries = 5;
    let retryCount = 0;
    
    try {
        console.log('[Content] ⭐ Starting Google Forms autofill (ENTERPRISE)...');
        
        // Wait for Google Form to be fully rendered
        return waitForGoogleFormReady().then(() => {
            return performGoogleFormAutofill(profile, missedFields);
        }).catch(error => {
            console.error('[Content] ❌ Google Forms autofill error:', error);
            return 0;
        });
        
    } catch (error) {
        console.error('[Content] ❌ Error initializing Google Forms autofill:', error);
        return filledCount;
    }
}

/**
 * Wait for Google Form to be fully loaded and ready
 */
async function waitForGoogleFormReady() {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.log('[Content] ⚠️ Google Forms timeout - proceeding anyway');
            resolve();
        }, 5000);
        
        // Check if form is already ready
        const isFormReady = () => {
            const formContainer = document.querySelector('[role="form"]') || 
                                 document.querySelector('form[method="POST"][action*="formResponse"]') ||
                                 document.querySelector('[data-form-id]');
            return !!formContainer;
        };
        
        if (isFormReady()) {
            clearTimeout(timeout);
            console.log('[Content] ✅ Google Form detected and ready');
            resolve();
            return;
        }
        
        // Wait for form to appear
        const observer = new MutationObserver(() => {
            if (isFormReady()) {
                observer.disconnect();
                clearTimeout(timeout);
                console.log('[Content] ✅ Google Form loaded (via MutationObserver)');
                resolve();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });
    });
}

/**
 * Perform the actual autofill with retry logic for lazy-loaded fields
 */
async function performGoogleFormAutofill(profile, missedFields, retryCount = 0) {
    let filledCount = 0;
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second between retries
    
    console.log(`[Content] 🔄 Google Forms autofill attempt ${retryCount + 1}/${maxRetries + 1}`);
    
    // Detect if this is actually a Google Form
    const isGoogleForm = document.querySelector('form[method="POST"][action*="formResponse"]') ||
                        document.querySelector('[role="form"]') ||
                        window.location.href.includes('docs.google.com/forms') ||
                        document.querySelector('[data-spreadsheet-id]');
    
    if (!isGoogleForm) {
        console.log('[Content] ℹ️ Not a Google Form, skipping');
        return 0;
    }
    
    // Get all visible form fields using multiple detection strategies
    const fieldsToFill = detectAllGoogleFormFields();
    console.log(`[Content] 🔍 Detected ${fieldsToFill.length} form fields`);
    
    const initialFieldCount = fieldsToFill.length;
    
    // Fill each detected field
    for (const field of fieldsToFill) {
        const result = fillGoogleFormField(field, profile, missedFields);
        if (result.filled) {
            filledCount++;
        }
    }
    
    console.log(`[Content] ✅ Filled ${filledCount} fields on this pass`);
    
    // Wait a moment and check if new fields appeared (lazy loading)
    if (retryCount < maxRetries) {
        await delay(retryDelay);
        
        const newFieldsCount = detectAllGoogleFormFields().length;
        if (newFieldsCount > initialFieldCount) {
            console.log(`[Content] 🔄 New fields detected (${initialFieldCount} → ${newFieldsCount}), retrying...`);
            const additionalFilled = await performGoogleFormAutofill(profile, missedFields, retryCount + 1);
            filledCount += additionalFilled;
        }
    }
    
    return filledCount;
}

/**
 * Detect all Google Form fields using multiple strategies
 */
function detectAllGoogleFormFields() {
    const fields = [];
    const seen = new Set();
    
    // Strategy 1: Traditional input/textarea/select elements
    console.log('[Content] 🔍 Strategy 1: HTML form elements');
    const htmlElements = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    htmlElements.forEach(element => {
        if (!seen.has(element) && isElementVisible(element) && !element.disabled) {
            fields.push({
                type: 'html',
                element: element,
                label: extractVisibleLabel(element),
                ariaLabel: element.getAttribute('aria-label'),
                placeholder: element.getAttribute('placeholder')
            });
            seen.add(element);
        }
    });
    console.log(`[Content] Found ${htmlElements.length} HTML elements`);
    
    // Strategy 2: Google Forms specific divs with data attributes
    console.log('[Content] 🔍 Strategy 2: Google Forms data attributes');
    const dataElements = document.querySelectorAll('[data-value], [data-spreadsheet-id], [jsaction*="setValue"]');
    dataElements.forEach(element => {
        if (!seen.has(element) && isElementVisible(element)) {
            fields.push({
                type: 'data-attr',
                element: element,
                label: extractVisibleLabel(element),
                ariaLabel: element.getAttribute('aria-label')
            });
            seen.add(element);
        }
    });
    console.log(`[Content] Found ${dataElements.length} data-attribute elements`);
    
    // Strategy 3: Contenteditable divs (text inputs in Google Forms)
    console.log('[Content] 🔍 Strategy 3: Contenteditable divs');
    const editableDivs = document.querySelectorAll('[contenteditable="true"]');
    editableDivs.forEach(div => {
        if (!seen.has(div) && isElementVisible(div)) {
            fields.push({
                type: 'contenteditable',
                element: div,
                label: extractVisibleLabel(div),
                ariaLabel: div.getAttribute('aria-label')
            });
            seen.add(div);
        }
    });
    console.log(`[Content] Found ${editableDivs.length} contenteditable divs`);
    
    // Strategy 4: Role-based elements (radio buttons, checkboxes, etc.)
    console.log('[Content] 🔍 Strategy 4: Role-based elements');
    const roleElements = document.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]');
    roleElements.forEach(element => {
        if (!seen.has(element) && isElementVisible(element)) {
            fields.push({
                type: 'role',
                element: element,
                label: extractVisibleLabel(element),
                ariaLabel: element.getAttribute('aria-label')
            });
            seen.add(element);
        }
    });
    console.log(`[Content] Found ${roleElements.length} role-based elements`);
    
    // Strategy 5: Form question containers with embedded fields
    console.log('[Content] 🔍 Strategy 5: Form question containers');
    const questionContainers = document.querySelectorAll('[role="listitem"], [data-question-id], .freebirdFormviewerComponentsQuestionBaseRoot');
    questionContainers.forEach(container => {
        const input = container.querySelector('input, textarea, select, [contenteditable], [role="textbox"]');
        if (input && !seen.has(input) && isElementVisible(input) && !input.disabled) {
            fields.push({
                type: 'container-input',
                element: input,
                label: extractVisibleLabel(container),
                ariaLabel: input.getAttribute('aria-label') || container.getAttribute('aria-label')
            });
            seen.add(input);
        }
    });
    console.log(`[Content] Found ${questionContainers.length} question containers`);
    
    console.log(`[Content] Total unique fields detected: ${fields.length}`);
    return fields;
}

/**
 * Fill a single Google Form field
 */
function fillGoogleFormField(fieldInfo, profile, missedFields) {
    try {
        const { element, type, label, ariaLabel } = fieldInfo;
        const visibleLabel = label || ariaLabel || element.innerText || element.textContent;
        
        console.log(`[Content] 📌 Processing field: "${visibleLabel}"`);
        
        // Detect field type from label
        const fieldType = detectGoogleFormFieldType(visibleLabel);
        
        // Get value to fill
        let valueToFill = null;
        let fieldMatchKey = null;
        
        if (fieldType && profile[fieldType]) {
            valueToFill = profile[fieldType];
            fieldMatchKey = fieldType;
            console.log(`[Content]   ✅ Matched standard field: ${fieldType}`);
        } else if (profile.custom_fields && Array.isArray(profile.custom_fields)) {
            // Check custom fields
            const matchedCustom = profile.custom_fields.find(field => {
                const cleanKey = field.key.trim().toLowerCase();
                const labelLower = visibleLabel.toLowerCase();
                return cleanKey && (labelLower.includes(cleanKey) || cleanKey.includes(labelLower.split(' ')[0]));
            });
            if (matchedCustom) {
                valueToFill = matchedCustom.value;
                fieldMatchKey = matchedCustom.key;
                console.log(`[Content]   ✅ Matched custom field: ${fieldMatchKey}`);
            }
        }
        
        // If no value found, track as missed field
        if (!valueToFill) {
            const cleanLabel = visibleLabel.trim().substring(0, 50);
            if (cleanLabel && !missedFields.includes(cleanLabel)) {
                missedFields.push(cleanLabel);
                console.log(`[Content]   ⚠️ No matching data, added to missed fields`);
            }
            return { filled: false };
        }
        
        // Fill the field based on its type
        return fillFieldByType(element, type, valueToFill);
        
    } catch (error) {
        console.error('[Content] Error filling field:', error);
        return { filled: false };
    }
}

/**
 * Fill field by its type
 */
function fillFieldByType(element, fieldType, value) {
    try {
        if (fieldType === 'html') {
            return fillHtmlElement(element, value);
        } else if (fieldType === 'contenteditable') {
            return fillContenteditableDiv(element, value);
        } else if (fieldType === 'data-attr') {
            return fillDataAttributeElement(element, value);
        } else if (fieldType === 'role') {
            return fillRoleElement(element, value);
        } else if (fieldType === 'container-input') {
            return fillHtmlElement(element, value);
        }
        return { filled: false };
    } catch (error) {
        console.error('[Content] Error in fillFieldByType:', error);
        return { filled: false };
    }
}

/**
 * Fill standard HTML elements (input, textarea, select)
 */
function fillHtmlElement(element, value) {
    try {
        if (!value) return { filled: false };
        
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'select') {
            return fillSelect(element, value);
        } else if (tagName === 'textarea') {
            return fillTextarea(element, value);
        } else {
            const inputType = element.getAttribute('type') || 'text';
            
            if (inputType === 'checkbox' || inputType === 'radio') {
                return fillCheckboxOrRadio(element, value);
            } else if (inputType === 'date') {
                return fillDateInput(element, value);
            } else {
                return fillInput(element, value);
            }
        }
    } catch (error) {
        console.error('[Content] Error filling HTML element:', error);
        return { filled: false };
    }
}

/**
 * Fill text input with React event support
 */
function fillInput(element, value) {
    try {
        if (element.value === value) {
            return { filled: false };
        }
        
        element.focus();
        
        // Use property descriptor for React compatibility
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descriptor?.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }
        
        // Trigger all necessary events
        ['input', 'change', 'blur', 'keyup', 'keydown', 'keypress'].forEach(eventType => {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        animateFilledField(element);
        element.blur();
        
        console.log(`[Content]   ✅ Filled input`);
        return { filled: true };
    } catch (error) {
        console.error('[Content] Error filling input:', error);
        return { filled: false };
    }
}

/**
 * Fill textarea with React event support
 */
function fillTextarea(element, value) {
    try {
        if (element.value === value) {
            return { filled: false };
        }
        
        element.focus();
        
        const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        if (descriptor?.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }
        
        ['input', 'change', 'blur'].forEach(eventType => {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        animateFilledField(element);
        element.blur();
        
        console.log(`[Content]   ✅ Filled textarea`);
        return { filled: true };
    } catch (error) {
        console.error('[Content] Error filling textarea:', error);
        return { filled: false };
    }
}

/**
 * Fill select dropdown
 */
function fillSelect(element, value) {
    try {
        // Find matching option
        let option = Array.from(element.options).find(opt => 
            opt.text.toLowerCase().includes(value.toLowerCase()) ||
            opt.value.toLowerCase().includes(value.toLowerCase())
        );
        
        if (!option) {
            console.log(`[Content]   ⚠️ No matching option found for: ${value}`);
            return { filled: false };
        }
        
        element.value = option.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`[Content]   ✅ Filled select with: ${option.text}`);
        return { filled: true };
    } catch (error) {
        console.error('[Content] Error filling select:', error);
        return { filled: false };
    }
}

/**
 * Fill checkbox or radio button
 */
function fillCheckboxOrRadio(element, value) {
    try {
        // Check if label matches the value
        const label = element.getAttribute('aria-label') || element.nextElementSibling?.textContent || '';
        const shouldCheck = label.toLowerCase().includes(value.toLowerCase()) ||
                           value.toLowerCase() === 'true' ||
                           value.toLowerCase() === 'yes';
        
        if (element.type === 'checkbox') {
            element.checked = shouldCheck;
        } else if (element.type === 'radio') {
            element.checked = shouldCheck;
        }
        
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`[Content]   ✅ Filled ${element.type}: ${shouldCheck ? 'checked' : 'unchecked'}`);
        return { filled: shouldCheck };
    } catch (error) {
        console.error('[Content] Error filling checkbox/radio:', error);
        return { filled: false };
    }
}

/**
 * Fill date input
 */
function fillDateInput(element, value) {
    try {
        // Parse date - support multiple formats
        let dateValue = value;
        if (typeof value === 'string') {
            // Try to parse YYYY-MM-DD
            if (!value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Try to convert common formats
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    dateValue = date.toISOString().split('T')[0];
                }
            }
        }
        
        element.value = dateValue;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`[Content]   ✅ Filled date: ${dateValue}`);
        return { filled: true };
    } catch (error) {
        console.error('[Content] Error filling date:', error);
        return { filled: false };
    }
}

/**
 * Fill contenteditable div
 */
function fillContenteditableDiv(element, value) {
    try {
        if (element.textContent.trim()) {
            return { filled: false };
        }
        
        element.focus();
        element.textContent = value;
        
        ['input', 'change', 'blur'].forEach(eventType => {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        element.blur();
        
        console.log(`[Content]   ✅ Filled contenteditable div`);
        return { filled: true };
    } catch (error) {
        console.error('[Content] Error filling contenteditable:', error);
        return { filled: false };
    }
}

/**
 * Fill data-attribute element
 */
function fillDataAttributeElement(element, value) {
    try {
        // For Google Forms specific elements
        element.setAttribute('data-value', value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`[Content]   ✅ Filled data-attribute element`);
        return { filled: true };
    } catch (error) {
        console.error('[Content] Error filling data-attribute element:', error);
        return { filled: false };
    }
}

/**
 * Fill role-based element (radio, checkbox, etc.)
 */
function fillRoleElement(element, value) {
    try {
        const role = element.getAttribute('role');
        const label = element.getAttribute('aria-label') || element.innerText || '';
        
        if (role === 'radio' || role === 'checkbox') {
            const shouldSelect = label.toLowerCase().includes(value.toLowerCase());
            if (shouldSelect) {
                element.click();
                console.log(`[Content]   ✅ Clicked ${role}: ${label}`);
                return { filled: true };
            }
        } else if (role === 'option') {
            if (label.toLowerCase().includes(value.toLowerCase())) {
                element.click();
                console.log(`[Content]   ✅ Clicked option: ${label}`);
                return { filled: true };
            }
        }
        
        return { filled: false };
    } catch (error) {
        console.error('[Content] Error filling role element:', error);
        return { filled: false };
    }
}

/**
 * Extract visible label from element and its context
 */
function extractVisibleLabel(element) {
    try {
        const labels = [];
        
        // Direct attributes
        if (element.getAttribute('aria-label')) {
            labels.push(element.getAttribute('aria-label'));
        }
        if (element.placeholder) {
            labels.push(element.placeholder);
        }
        if (element.title) {
            labels.push(element.title);
        }
        
        // Associated label
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) {
                labels.push(label.textContent.trim());
            }
        }
        
        // Parent label
        const parentLabel = element.closest('label');
        if (parentLabel) {
            labels.push(parentLabel.textContent.trim());
        }
        
        // Nearby question text
        let parent = element.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            const text = parent.innerText || parent.textContent;
            if (text && text.length > 0 && text.length < 200) {
                labels.push(text.trim());
            }
            parent = parent.parentElement;
        }
        
        return labels.filter(l => l && l.length > 0).join(' | ');
    } catch (error) {
        return '';
    }
}

/**
 * Check if element is visible
 */
function isElementVisible(element) {
    try {
        if (element.offsetParent === null) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    } catch (error) {
        return true; // Assume visible if check fails
    }
}

/**
 * Utility delay function
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect field type from Google Forms aria-label
 */
function detectGoogleFormFieldType(ariaLabel) {
    const lowerLabel = ariaLabel.toLowerCase();
    
    for (const [fieldType, patterns] of Object.entries(FIELD_MAP)) {
        if (patterns.some(p => new RegExp(p, 'i').test(lowerLabel))) {
            return fieldType;
        }
    }
    return null;
}

function getFieldContext(input) {
    let contextParts = [];
    
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) contextParts.push(label.textContent);
    }
    const parentLabel = input.closest('label');
    if (parentLabel) contextParts.push(parentLabel.textContent);
    
    if (input.placeholder) contextParts.push(input.placeholder);
    if (input.name) contextParts.push(input.name);
    if (input.id) contextParts.push(input.id);
    
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) contextParts.push(ariaLabel);
    
    const ariaLabelledby = input.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
        const labelledByEl = document.getElementById(ariaLabelledby);
        if (labelledByEl) contextParts.push(labelledByEl.textContent);
    }
    
    let sibling = input.previousSibling;
    while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && (sibling.tagName === 'LABEL' || sibling.classList.contains('label'))) {
            contextParts.push(sibling.textContent);
            break;
        }
        if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) {
            contextParts.push(sibling.textContent);
            break;
        }
        sibling = sibling.previousSibling;
    }
    
    const parent = input.parentElement;
    if (parent) {
        const parentText = parent.innerText || parent.textContent;
        if (parentText) {
            const cleanText = parentText.split('\n')[0].trim();
            if (cleanText.length > 0 && cleanText.length < 100) {
                contextParts.push(cleanText);
            }
        }
    }
    
    return contextParts.join(' ').toLowerCase();
}

function getCleanLabel(input) {
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label && label.textContent.trim()) {
            return cleanLabelText(label.textContent);
        }
    }
    const parentLabel = input.closest('label');
    if (parentLabel && parentLabel.textContent.trim()) {
        return cleanLabelText(parentLabel.textContent);
    }
    
    if (input.placeholder) {
        return cleanLabelText(input.placeholder);
    }
    
    if (input.name) {
        return capitalizeName(input.name);
    }
    
    if (input.id) {
        return capitalizeName(input.id);
    }
    
    return null;
}

function cleanLabelText(text) {
    return text.replace(/[*:]/g, '').replace(/\s+/g, ' ').trim();
}

function capitalizeName(name) {
    return name
        .replace(/[-_]/g, ' ')
        .replace(/\b[a-z]/g, letter => letter.toUpperCase())
        .trim();
}

function animateFilledField(input) {
    input.classList.add('autofilled-field');
    
    if (!document.getElementById('autofill-animation-styles')) {
        const styles = document.createElement('style');
        styles.id = 'autofill-animation-styles';
        styles.innerHTML = `
            @keyframes autofill-flash {
                0% { background-color: rgba(76, 175, 80, 0.4); box-shadow: 0 0 8px rgba(76, 175, 80, 0.6); }
                100% { background-color: transparent; }
            }
            .autofilled-field {
                animation: autofill-flash 1.5s ease-out;
                border-color: #4caf50 !important;
            }
        `;
        document.head.appendChild(styles);
    }
    
    setTimeout(() => {
        input.classList.remove('autofilled-field');
    }, 1500);
}

/**
 * Unified Autofill Badge Management
 * These functions are kept for backward compatibility
 * All functionality is now handled by UnifiedAutofillButton
 */

async function initAutofillBadge() {
    console.log('[Content] Badge initialization delegated to UnifiedAutofillButton');
    // Unified button will be initialized separately
    return;
}

function removeAutofillBadge() {
    // Remove old badge if it exists
    try {
        const oldBadge = document.getElementById('resume-fixer-autofill-widget');
        if (oldBadge) {
            oldBadge.remove();
        }
    } catch (e) {
        console.error('[Content] Error removing old badge:', e);
    }
    
    // Also hide unified button if it exists
    try {
        const unifiedBtn = document.getElementById('ats-unified-autofill-button');
        if (unifiedBtn) {
            unifiedBtn.classList.add('hidden');
        }
    } catch (e) {
        console.error('[Content] Error hiding unified button:', e);
    }
}

function injectAutofillBadge() {
    // Unified button is now injected by UnifiedAutofillButton
    // This function kept for backward compatibility
    console.log('[Content] Badge injection delegated to UnifiedAutofillButton');
}

// ============================================
// UNIFIED BUTTON INITIALIZATION - SINGLE POINT
// ============================================
// Initialize UnifiedAutofillButton ONCE and ONLY ONCE
// Uses synchronous initialization to ensure deterministic execution

function initializeAutofillButton() {
    // Guard: Prevent multiple initialization attempts
    if (window.__autofillButtonInitialized) {
        console.log('[Content] ℹ️ Autofill button already initialized, skipping duplicate');
        return;
    }
    window.__autofillButtonInitialized = true;
    
    console.log('[Content] 🔍 Starting autofill button initialization...');
    
    // Wait for class to be available with retry logic
    let attempts = 0;
    const maxAttempts = 50; // 50 attempts * 100ms = 5 seconds
    
    function checkAndInitialize() {
        attempts++;
        
        // Verify UnifiedAutofillButton class is available
        if (typeof window.UnifiedAutofillButton === 'undefined') {
            if (attempts % 10 === 0) {
                console.log(`[Content] ⏳ Still waiting for UnifiedAutofillButton (attempt ${attempts}/${maxAttempts})`);
            }
            
            if (attempts < maxAttempts) {
                // Class not available yet, retry soon
                setTimeout(checkAndInitialize, 100);
                return;
            } else {
                // Gave up after 5 seconds
                console.error('[Content] ❌ FATAL: UnifiedAutofillButton class not found after 5 seconds');
                console.error('[Content] ❌ Check: floatingButtonManager.js loads BEFORE content-script.js in manifest.json');
                console.error('[Content] Available on window:', Object.keys(window).filter(k => k.includes('Button') || k.includes('Autofill')));
                return;
            }
        }
        
        console.log('[Content] ✅ UnifiedAutofillButton class is available');
        createButton();
    }
    
    // Create button when DOM is ready
    function createButton() {
        try {
            if (window.__unifiedAutofillButtonInstance) {
                console.log('[Content] ℹ️ Button instance already exists, skipping creation');
                return;
            }
            
            console.log('[Content] 🔨 Creating new UnifiedAutofillButton instance...');
            
            // Create and initialize button
            const unifiedButton = new window.UnifiedAutofillButton();
            unifiedButton.init().catch((err) => {
                console.error('[Content] ❌ Error initializing button:', err);
            });
            
            console.log('[Content] ✅ UnifiedAutofillButton initialized successfully');
        } catch (err) {
            console.error('[Content] ❌ Error creating UnifiedAutofillButton:', err);
            console.error('[Content] Stack:', err.stack);
        }
    }
    
    // Check class availability
    console.log('[Content] Checking if UnifiedAutofillButton is available...');
    console.log('[Content] typeof window.UnifiedAutofillButton:', typeof window.UnifiedAutofillButton);
    checkAndInitialize();
}

// Call at script load time - but ensure DOM is ready first
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutofillButton);
} else {
    // DOM is already ready
    initializeAutofillButton();
}

})();
