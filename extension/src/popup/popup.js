/**
 * Popup Script - Fixed Version
 * Main UI logic for the extension popup
 * Fixed: Auto-close, focus management, performance optimization
 */

// Popup state management
const PopupState = {
    isOpen: true,
    activeTab: 'home',
    tasksPending: 0,
    initialized: false,
    
    markTask: () => PopupState.tasksPending++,
    unmarkTask: () => PopupState.tasksPending--,
    hasActiveTasks: () => PopupState.tasksPending > 0
};

// State
let currentJob = null;
let currentResume = null;
let currentAnalysis = null;
let currentOptimization = null;

// DOM Elements (lazy-loaded)
let tabs = null;
let panels = null;
let elements = null;

// Initialize DOM references with null safety
function initializeDOMElements() {
    if (elements) return; // Already initialized
    
    try {
        // Wait for all elements to be available
        const waitForElements = (timeout = 2000) => {
            return new Promise((resolve) => {
                const startTime = Date.now();
                
                const check = () => {
                    const jobDesc = document.getElementById('jobDescription');
                    const resumeText = document.getElementById('resumeText');
                    const analyzeBtn = document.getElementById('analyzeBtn');
                    
                    if (jobDesc && resumeText && analyzeBtn) {
                        resolve(true);
                    } else if (Date.now() - startTime > timeout) {
                        console.warn('[Popup] Timeout waiting for DOM elements');
                        resolve(false);
                    } else {
                        requestAnimationFrame(check);
                    }
                };
                
                check();
            });
        };
        
        // This is synchronous since we're already in DOMContentLoaded, but just in case
        const allReady = document.getElementById('jobDescription') && 
                        document.getElementById('resumeText') && 
                        document.getElementById('analyzeBtn');
        
        if (!allReady) {
            console.warn('[Popup] ⚠️ Some critical elements not ready, waiting...');
        }
        
        tabs = {
            home: document.getElementById('homeTab'),
            resume: document.getElementById('resumeTab'),
            autofill: document.getElementById('autofillTab'),
            ai: document.getElementById('aiTab'),
            account: document.getElementById('accountTab')
        };

        panels = {
            jobDetection: document.getElementById('jobDetectionPanel'),
            resumeUpload: document.getElementById('resumeUploadPanel'),
            analysis: document.getElementById('analysisPanel'),
            optimization: document.getElementById('optimizationPanel')
        };

        elements = {
            // Job Detection
            detectedJobInfo: document.getElementById('detectedJobInfo'),
            detectedJobTitle: document.getElementById('detectedJobTitle'),
            detectedCompany: document.getElementById('detectedCompany'),
            jobDescription: document.getElementById('jobDescription'),
            
            // Resume Upload
            uploadArea: document.getElementById('uploadArea'),
            resumeFile: document.getElementById('resumeFile'),
            uploadedFileInfo: document.getElementById('uploadedFileInfo'),
            fileName: document.getElementById('fileName'),
            removeFile: document.getElementById('removeFile'),
            resumeText: document.getElementById('resumeText'),
            
            // Buttons
            analyzeBtn: document.getElementById('analyzeBtn'),
            optimizeBtn: document.getElementById('optimizeBtn'),
            
            // Analysis Results
            atsScore: document.getElementById('atsScore'),
            keywordBar: document.getElementById('keywordBar'),
            experienceBar: document.getElementById('experienceBar'),
            skillsBar: document.getElementById('skillsBar'),
            matchedKeywords: document.getElementById('matchedKeywords'),
            missingKeywords: document.getElementById('missingKeywords'),
            suggestionsList: document.getElementById('suggestionsList'),
            
            // Optimization Results
            originalScore: document.getElementById('originalScore'),
            optimizedScore: document.getElementById('optimizedScore'),
            scoreImprovement: document.getElementById('scoreImprovement'),
            changesList: document.getElementById('changesList'),
            
            // History
            historyList: document.getElementById('historyList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            
            // Loading & Error
            loadingSpinner: document.getElementById('loadingSpinner'),
            loadingText: document.getElementById('loadingText'),
            errorMessage: document.getElementById('errorMessage')
        };
        
        // Validate critical elements exist
        const criticalElements = ['jobDescription', 'resumeText', 'analyzeBtn'];
        const missing = criticalElements.filter(key => !elements[key]);
        
        if (missing.length > 0) {
            console.error('[Popup] ❌ CRITICAL: Missing DOM elements:', missing);
            console.error('[Popup] Available elements:', Object.keys(elements).filter(k => elements[k]));
            throw new Error(`Missing critical DOM elements: ${missing.join(', ')}`);
        }
        
        console.log('[Popup] ✅ All DOM elements initialized successfully');
    } catch (error) {
        console.error('[Popup] ❌ Failed to initialize DOM elements:', error);
        // Don't throw - allow popup to partially work
        elements = {};
    }
}

/**
 * Safe DOM manipulation helper - prevents null reference errors
 */
function setElementHTML(element, html) {
    if (element) {
        element.innerHTML = html;
        return true;
    } else {
        console.warn('[Popup] Attempted to set innerHTML on null element');
        return false;
    }
}

function setElementText(element, text) {
    if (element) {
        element.textContent = text;
        return true;
    } else {
        console.warn('[Popup] Attempted to set textContent on null element');
        return false;
    }
}

function setElementValue(element, value) {
    if (element) {
        element.value = value;
        return true;
    } else {
        console.warn('[Popup] Attempted to set value on null element');
        return false;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    init();
    setupAutoClose();
});

/**
 * Setup Auto-Close Logic
 * IMPORTANT: Auto-close is DISABLED during any active tasks (uploads, analysis, optimization)
 * Popup will stay open until user is done with all actions
 */
function setupAutoClose() {
    // Track focus loss but DO NOT auto-close
    // User must manually close the popup when they're done
    window.addEventListener('blur', () => {
        if (PopupState.hasActiveTasks()) {
            console.log('[Popup] Lost focus but tasks pending, staying open...');
        } else {
            console.log('[Popup] Blur event detected (popup will stay open until manually closed)');
        }
    });
    
    // Track focus out but DO NOT auto-close
    window.addEventListener('focusout', (e) => {
        if (PopupState.hasActiveTasks()) {
            console.log('[Popup] FocusOut but tasks pending, staying open...');
        }
    });
    
    // Tab switch - keep popup open even when switching tabs
    // This allows user to work on the job page while popup loads data
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'TAB_SWITCHED') {
            console.log('[Popup] Tab switched - popup stays open (user can switch back)');
            sendResponse({ success: true });
        }
        
        // Handle autofill complete results from content script
        if (request.type === 'AUTOFILL_COMPLETE') {
            console.log('[Popup] Received AUTOFILL_COMPLETE:', request.data);
            handleAutofillResults(request.data);
            sendResponse({ success: true });
        }
        
        // Handle extension token update from auth page
        if (request.type === 'EXTENSION_TOKEN_RECEIVED') {
            console.log('[Popup] Received extension token from auth page');
            sendResponse({ success: true });
            // Refresh the connection status
            setTimeout(() => {
                checkJobOrbitConnection();
            }, 100);
        }
    });
    
    // Cleanup on unload
    window.addEventListener('unload', cleanupPopup);
    window.addEventListener('beforeunload', cleanupPopup);
}

/**
 * Close popup safely
 * NOTE: Manual close only - auto-close removed
 * Popup stays open for user convenience during multi-step workflows
 */
function closePopupSafely() {
    // This function is now manual-close only
    // Auto-close has been removed to prevent disrupting user workflows
    console.log('[Popup] Close requested - not auto-closing, user must close manually');
    return;
}

/**
 * Immediately close popup
 * NOTE: This is manual close only via X button
 */
function closePopupImmediate() {
    console.log('[Popup] Manual close via X button');
    cleanupPopup();
    window.close();
}

/**
 * Cleanup before popup closes
 */
function cleanupPopup() {
    if (!PopupState.initialized) return;
    
    console.log('[Popup] Cleaning up...');
    
    // Clear badge
    try {
        chrome.action.setBadgeText({ text: '' });
    } catch (e) {
        console.log('[Popup] Could not clear badge:', e);
    }
    
    // Cancel pending requests
    if (window.abortController) {
        window.abortController.abort();
    }
    
    // Clear state
    currentJob = null;
    currentResume = null;
    currentAnalysis = null;
    currentOptimization = null;
    PopupState.tasksPending = 0;
    PopupState.initialized = false;
}

async function init() {
    try {
        PopupState.markTask();
        
        console.log('[Popup] 🚀 Initializing...');
        console.log('[Popup] ⏰ Timestamp:', new Date().toISOString());
        
        // Initialize DOM elements FIRST
        console.log('[Popup] 📦 Step 0: Initializing DOM elements...');
        initializeDOMElements();
        console.log('[Popup] ✅ DOM elements initialized');
        
        // Fast initialization - only load what's needed
        console.log('[Popup] 🔌 Step 1: Setting up event listeners...');
        setupEventListeners();
        console.log('[Popup] ✅ Event listeners attached');
        
        // Manually test tab switching
        console.log('[Popup] 🧪 Testing tab switching...');
        testTabSwitching();
        
        // CRITICAL: Check session persistence FIRST
        console.log('[Popup] 💾 Step 2: Checking session persistence...');
        const sessionValid = await SessionManager.isSessionValid();
        
        if (sessionValid.valid) {
            console.log('[Popup] ✅ Valid session found, displaying cached data immediately');
            
            // Show connected UI with cached data immediately
            const cachedData = await SessionManager.getCachedUserData();
            console.log('[Popup] 💾 Loaded cached data:', {
                hasProfile: Object.keys(cachedData.profile || {}).length > 0,
                hasResumes: cachedData.resumes?.length > 0,
                hasApplications: cachedData.applications?.length > 0
            });
            
            showJobOrbitConnected(cachedData.user?.email || 'Connected');
            
            // Verify token with backend in background
            console.log('[Popup] 🔐 Step 3: Verifying token with backend...');
            const authResult = await TokenVerifier.fullVerification();
            
            if (!authResult.authenticated) {
                console.log('[Popup] ⚠️ Backend verification failed, clearing session');
                await SessionManager.clearSession();
                showJobOrbitNotConnected();
                showGuestMode();
            } else {
                console.log('[Popup] ✅ Token verified:', authResult.user?.email);
                
                // Update session with fresh data from backend
                await SessionManager.updateSyncStatus('syncing');
                
                // Full background sync
                console.log('[Popup] 📥 Step 4: Full data sync...');
                const token = await TokenVerifier.getStoredToken();
                if (token) {
                    const dataSyncResult = await DataSyncManager.fullSync(token);
                    if (dataSyncResult.success) {
                        console.log('[Popup] ✅ Full data sync completed');
                        await SessionManager.updateSyncStatus('success', {
                            profile: dataSyncResult.profile,
                            resumes: dataSyncResult.resumes,
                            applications: dataSyncResult.applications,
                            answers: dataSyncResult.answers
                        });
                    } else {
                        console.warn('[Popup] ⚠️ Full data sync failed');
                        await SessionManager.updateSyncStatus('error');
                    }
                }
            }
        } else {
            console.log('[Popup] ❌ No valid session, checking backend auth...');
            
            // CRITICAL: Verify token with backend FIRST
            console.log('[Popup] 🔐 Step 3: Verifying authentication with backend...');
            const authResult = await TokenVerifier.fullVerification();
            
            if (authResult.authenticated) {
                console.log('[Popup] ✅ User authenticated:', authResult.user?.email);
                
                // Create new session
                await SessionManager.createSession({
                    extensionToken: await TokenVerifier.getStoredToken(),
                    user: authResult.user,
                    tokenType: authResult.tokenType,
                    expiresIn: authResult.expiresIn
                });
                
                showJobOrbitConnected(authResult.user?.email || 'Connected');
                
                // CRITICAL: Sync profile from Job Orbit
                console.log('[Popup] 📥 Step 4: Syncing profile from Job Orbit...');
                const token = await TokenVerifier.getStoredToken();
                if (token) {
                    const syncResult = await ProfileSyncManager.syncOnLogin(token);
                    if (syncResult.success) {
                        console.log('[Popup] ✅ Profile synced successfully');
                    }

                    // CRITICAL: Full data sync
                    console.log('[Popup] 📥 Step 5: Syncing all data from Job Orbit...');
                    const dataSyncResult = await DataSyncManager.fullSync(token);
                    if (dataSyncResult.success) {
                        console.log('[Popup] ✅ Full data sync completed');
                    }
                }
            } else {
                console.log('[Popup] ❌ User not authenticated:', authResult.reason);
                showJobOrbitNotConnected();
                showGuestMode();
            }
        }
        
        // Load dashboard on startup (home tab is active by default)
        loadDashboard();
        
        // Defer non-critical loading
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                loadSavedResume();
                loadDetectedJob();
                loadAutofillProfile();
                loadSettings();
                loadJobTracking();
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                loadSavedResume();
                loadDetectedJob();
                loadAutofillProfile();
                loadSettings();
                loadJobTracking();
            }, 100);
        }
        
        // Setup lazy tab loading
        setupLazyTabLoading();
        
        // Check autofill button status
        checkAutofillButtonStatus();
        
        PopupState.initialized = true;
        console.log('[Popup] ✅ Initialized');
    } catch (error) {
        console.error('[Popup] ❌ Initialization error:', error);
        console.error('[Popup] Stack:', error.stack);
        showError('Failed to initialize popup: ' + error.message);
    } finally {
        PopupState.unmarkTask();
    }
}

/**
 * Test tab switching functionality
 */
function testTabSwitching() {
    console.log('[Popup] 🧪 Testing tab switching...');
    
    const tabIds = ['home', 'resume', 'autofill', 'ai', 'account'];
    
    tabIds.forEach(tabId => {
        const tabElement = document.getElementById(`${tabId}Tab`);
        if (tabElement) {
            console.log(`[Popup] ✅ Tab element found: ${tabId}Tab`);
        } else {
            console.error(`[Popup] ❌ Tab element NOT found: ${tabId}Tab`);
        }
    });
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log(`[Popup] Found ${tabButtons.length} tab buttons`);
    
    tabButtons.forEach((btn, i) => {
        const dataTab = btn.dataset.tab;
        console.log(`[Popup] Button ${i + 1}: data-tab="${dataTab}", text="${btn.textContent.trim()}"`);
    });
}

/**
 * Setup lazy loading for tab content
 * Only load when tab becomes visible
 */
function setupLazyTabLoading() {
    let historyLoaded = false;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            if (tabName === 'history' && !historyLoaded) {
                historyLoaded = true;
                loadHistory();
            }
        });
    });
}

/**
 * Setup Event Listeners - Enhanced with tab switching fix
 */
function setupEventListeners() {
    console.log('[Popup] 🔧 Setting up event listeners...');
    
    // Tab switching - with null checks
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log('[Popup] Found', tabButtons.length, 'tab buttons for switching');
    
    if (tabButtons.length === 0) {
        console.warn('[Popup] ⚠️ No tab buttons found - tab switching will not work!');
    }
    
    tabButtons.forEach((btn, index) => {
        const tabName = btn.dataset.tab;
        console.log(`[Popup] Setting up tab button ${index + 1}: ${tabName}`);
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Popup] 👆 Tab button clicked:', tabName);
            switchTab(tabName);
        });
    });
    
    console.log('[Popup] ✅ Tab switching listeners attached');
    
    // File upload - with null checks
    if (elements.uploadArea && elements.resumeFile && elements.removeFile) {
        console.log('[Popup] Setting up file upload listeners');
        elements.uploadArea.addEventListener('click', () => {
            console.log('[Popup] Upload area clicked');
            elements.resumeFile.click();
        });
        elements.resumeFile.addEventListener('change', handleFileUpload);
        elements.removeFile.addEventListener('click', removeUploadedFile);
        
        // Drag and drop
        elements.uploadArea.addEventListener('dragover', handleDragOver);
        elements.uploadArea.addEventListener('dragleave', handleDragLeave);
        elements.uploadArea.addEventListener('drop', handleDrop);
        
        console.log('[Popup] ✅ File upload listeners attached');
    } else {
        console.warn('[Popup] ⚠️ Upload elements missing, file upload disabled');
    }
    
    // Buttons - with null checks
    if (elements.analyzeBtn) {
        console.log('[Popup] Setting up analyze button');
        elements.analyzeBtn.addEventListener('click', handleAnalyze);
    }
    if (elements.optimizeBtn) {
        console.log('[Popup] Setting up optimize button');
        elements.optimizeBtn.addEventListener('click', handleOptimize);
    }
    
    // Fetch job description button
    const fetchJobDescBtn = document.getElementById('fetchJobDescBtn');
    if (fetchJobDescBtn) {
        console.log('[Popup] Setting up fetch job description button');
        fetchJobDescBtn.addEventListener('click', handleFetchJobDescription);
    }
    
    // Download buttons
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => handleDownload(btn.dataset.format));
    });
    
    // Copy optimized text button
    const copyOptimizedBtn = document.getElementById('copyOptimizedBtn');
    if (copyOptimizedBtn) {
        console.log('[Popup] Setting up copy optimized button');
        copyOptimizedBtn.addEventListener('click', handleCopyOptimized);
    }

    // Autofill event listeners
    const addCustomFieldBtn = document.getElementById('addCustomFieldBtn');
    if (addCustomFieldBtn) {
        console.log('[Popup] Setting up add custom field button');
        addCustomFieldBtn.addEventListener('click', () => addCustomFieldRow());
    }
    
    const autofillForm = document.getElementById('autofillForm');
    if (autofillForm) {
        console.log('[Popup] Setting up autofill form submit');
        autofillForm.addEventListener('submit', handleSaveProfile);
    } else {
        console.warn('[Popup] ⚠️ Autofill form not found');
    }
    
    const autofillActiveTabBtn = document.getElementById('autofillActiveTabBtn');
    if (autofillActiveTabBtn) {
        console.log('[Popup] Setting up autofill active tab button');
        autofillActiveTabBtn.addEventListener('click', handleAutofillTab);
    } else {
        console.warn('[Popup] ⚠️ Autofill active tab button not found');
    }

    // Show autofill button again
    const showAutofillButtonBtn = document.getElementById('showAutofillButtonBtn');
    if (showAutofillButtonBtn) {
        console.log('[Popup] Setting up show autofill button');
        showAutofillButtonBtn.addEventListener('click', handleShowAutofillButton);
    }

    // Dismiss autofill notice
    const dismissAutofillNoticeBtn = document.getElementById('dismissAutofillNoticeBtn');
    if (dismissAutofillNoticeBtn) {
        console.log('[Popup] Setting up dismiss autofill notice button');
        dismissAutofillNoticeBtn.addEventListener('click', handleDismissAutofillNotice);
    }
    
    // Settings listeners
    setupSettingsListeners();
    
    // Listen for storage changes to update UI in real-time
    if (chrome && chrome.storage) {
        console.log('[Popup] Setting up storage change listener');
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes.jobOrbitAuth) {
                console.log('[Popup] Job Orbit auth changed, updating UI');
                checkJobOrbitConnection();
            }
        });
    }
    
    console.log('[Popup] ✅ All event listeners setup complete');
}

/**
 * Tab Switching - Enhanced with better error handling
 */
function switchTab(tabName) {
    console.log('[Popup] 📑 Switching to tab:', tabName);
    
    try {
        // Ensure tabs object is initialized
        if (!tabs) {
            console.error('[Popup] ❌ Tabs object not initialized');
            return;
        }
        
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        console.log('[Popup] Found', tabButtons.length, 'tab buttons');
        
        tabButtons.forEach(btn => {
            const isActive = btn.dataset.tab === tabName;
            btn.classList.toggle('active', isActive);
            if (isActive) {
                console.log('[Popup] ✅ Activated button for tab:', tabName);
            }
        });
        
        // Update tab content - check all possible tabs
        const tabIds = ['home', 'resume', 'autofill', 'ai', 'account'];
        console.log('[Popup] 🔍 Checking tab panels:', tabIds);
        
        tabIds.forEach(key => {
            const tabElement = document.getElementById(`${key}Tab`);
            if (tabElement) {
                const shouldBeActive = key === tabName;
                tabElement.classList.toggle('active', shouldBeActive);
                
                if (shouldBeActive) {
                    console.log('[Popup] ✅ Showed panel for:', key);
                    // Ensure panel is visible
                    tabElement.style.display = 'block';
                } else {
                    console.log('[Popup] ⬜ Hid panel for:', key);
                    tabElement.style.display = 'none';
                }
            } else {
                console.warn('[Popup] ⚠️ Tab element not found:', `${key}Tab`);
            }
        });
        
        // Load content based on tab
        console.log('[Popup] 📥 Loading content for tab:', tabName);
        
        if (tabName === 'home') {
            loadDashboard();
        } else if (tabName === 'resume') {
            loadResumeTab();
        } else if (tabName === 'autofill') {
            loadAutofillProfile();
        } else if (tabName === 'account') {
            loadAccountTab();
        } else if (tabName === 'ai') {
            loadSettingsTab();
        }
        
        PopupState.activeTab = tabName;
        console.log('[Popup] ✅ Tab switch complete:', tabName);
        
    } catch (error) {
        console.error('[Popup] ❌ Error switching tab:', error);
        console.error('[Popup] Stack:', error.stack);
    }
}

/**
 * Load Detected Job
 */
async function loadDetectedJob() {
    try {
        PopupState.markTask();
        
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['currentJob'], (result) => {
                resolve(result);
            });
        });
        
        if (result.currentJob) {
            currentJob = result.currentJob;
            displayDetectedJob(result.currentJob);
        }
    } catch (error) {
        console.error('[Popup] Error loading detected job:', error);
    } finally {
        PopupState.unmarkTask();
    }
}

/**
 * Display Detected Job
 */
function displayDetectedJob(job) {
    elements.detectedJobTitle.textContent = job.jobTitle || 'Unknown Position';
    elements.detectedCompany.textContent = job.company || 'Unknown Company';
    elements.detectedJobInfo.classList.remove('hidden');
    
    if (job.description) {
        elements.jobDescription.value = job.description;
    }
}

/**
 * Load Saved Resume
 */
async function loadSavedResume() {
    try {
        PopupState.markTask();
        
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['resume'], (result) => {
                resolve(result);
            });
        });
        
        if (result.resume) {
            currentResume = result.resume;
            elements.resumeText.value = result.resume.text || '';
            
            if (result.resume.metadata) {
                displayUploadedFile(result.resume.metadata.filename);
            }
        }
    } catch (error) {
        console.error('[Popup] Error loading saved resume:', error);
    } finally {
        PopupState.unmarkTask();
    }
}

/**
 * Handle File Upload - with proper response handling
 * IMPORTANT: Popup stays open throughout entire upload process
 */
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError('File size exceeds 5MB limit');
        return;
    }
    
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
        showError('Invalid file type. Please upload PDF, DOCX, or TXT');
        return;
    }
    
    showLoading('Extracting text from file...');
    PopupState.markTask(); // Mark task as active
    
    console.log('[Popup] File upload started:', file.name);
    
    try {
        // Read file as ArrayBuffer and send to background
        const buffer = await file.arrayBuffer();
        const fileName = file.name;
        
        // Send to background for processing
        chrome.runtime.sendMessage({
            type: 'PROCESS_FILE',
            payload: {
                buffer: Array.from(new Uint8Array(buffer)),
                fileName: fileName,
                fileType: file.type,
                fileSize: file.size
            }
        }, async (response) => {
            try {
                if (!response) {
                    throw new Error('No response from background script');
                }
                
                if (response && response.success) {
                    const data = response.data;
                    
                    // Save extracted text
                    elements.resumeText.value = data.extractedText;
                    displayUploadedFile(file.name);
                    
                    // Save to storage
                    chrome.storage.local.set({
                        resume: {
                            text: data.extractedText,
                            metadata: {
                                filename: file.name,
                                size: file.size,
                                format: data.metadata.format
                            }
                        }
                    });
                    
                    currentResume = {
                        text: data.extractedText,
                        metadata: data.metadata
                    };
                    
                    console.log('[Popup] Resume extracted and saved locally');
                    
                    // Parse resume details in background
                    chrome.runtime.sendMessage({
                        type: 'PARSE_RESUME',
                        payload: { resumeText: data.extractedText }
                    }, async (parseResponse) => {
                        try {
                            if (parseResponse && parseResponse.success) {
                                const parsed = parseResponse.data;
                                const c = parsed.contact || {};
                                
                                // Fill ALL autofill form fields
                                const formFields = {
                                    'full_name': c.name || '',
                                    'first_name': c.first_name || '',
                                    'last_name': c.last_name || '',
                                    'email': c.email || '',
                                    'phone': c.phone || '',
                                    'city': c.city || '',
                                    'state': c.state || '',
                                    'zip': c.zip || '',
                                    'country': c.country || '',
                                    'linkedin': c.linkedin || '',
                                    'github': c.github || '',
                                    'portfolio': c.portfolio || '',
                                    'current_title': parsed.current_title || '',
                                    'current_company': parsed.current_company || '',
                                    'years_of_experience': parsed.years_of_experience || '',
                                    'skills': parsed.skills || ''
                                };
                                
                                // Set all fields in the form
                                Object.entries(formFields).forEach(([fieldId, value]) => {
                                    const field = document.getElementById(fieldId);
                                    if (field) {
                                        field.value = value;
                                    }
                                });
                                
                                // Save profile to storage
                                chrome.storage.local.set({ profile: formFields });
                                
                                console.log('[Popup] Profile parsed from resume');
                                
                                // Upload resume to backend if user is authenticated
                                const token = await TokenVerifier.getStoredToken();
                                if (token) {
                                    console.log('[Popup] 📤 Syncing resume to backend...');
                                    const uploadResult = await DataSyncManager.syncNewResume(token, {
                                        title: file.name,
                                        content: data.extractedText,
                                        file_format: data.metadata.format || 'text'
                                    });
                                    
                                    if (uploadResult.success) {
                                        console.log('[Popup] ✅ Resume synced to backend');
                                        showNotification('✅ Resume uploaded to Job Orbit!', 'success');
                                    } else {
                                        console.warn('[Popup] ⚠️ Resume sync failed:', uploadResult.error);
                                        showNotification('⚠️ Resume saved locally (sync failed)', 'info');
                                    }
                                    
                                    // Also sync profile changes to backend
                                    console.log('[Popup] 📤 Syncing profile to backend...');
                                    const profileUpload = await ProfileSyncManager.uploadProfile(token, formFields);
                                    if (profileUpload.success) {
                                        console.log('[Popup] ✅ Profile synced to backend');
                                    } else {
                                        console.warn('[Popup] ⚠️ Profile sync failed:', profileUpload.error);
                                    }
                                } else {
                                    console.log('[Popup] Not authenticated, profile saved locally only');
                                    showNotification('✅ Profile populated from resume (login to sync)', 'info');
                                }
                            } else {
                                console.warn('[Popup] Parse response error:', parseResponse?.error);
                                showNotification('✅ Resume uploaded (parse failed)', 'info');
                            }
                            
                            hideLoading();
                            PopupState.unmarkTask(); // Mark task as complete
                        } catch (parseError) {
                            console.error('[Popup] Error in parse response handling:', parseError);
                            hideLoading();
                            PopupState.unmarkTask(); // Mark task as complete
                        }
                    });
                } else {
                    throw new Error(response?.error || 'Failed to process file');
                }
            } catch (error) {
                console.error('[Popup] Error in file upload response:', error);
                showError(error.message || 'Failed to process file');
                hideLoading();
                PopupState.unmarkTask(); // Mark task as complete
            }
        });
        
    } catch (error) {
        console.error('[Popup] Error uploading file:', error);
        showError('Failed to process file: ' + error.message);
        hideLoading();
        PopupState.unmarkTask(); // Mark task as complete
    }
}

/**
 * Display Uploaded File Info
 */
function displayUploadedFile(filename) {
    elements.fileName.textContent = filename;
    elements.uploadedFileInfo.classList.remove('hidden');
    elements.uploadArea.style.display = 'none';
}

/**
 * Remove Uploaded File
 */
function removeUploadedFile() {
    elements.uploadedFileInfo.classList.add('hidden');
    elements.uploadArea.style.display = 'block';
    elements.resumeFile.value = '';
    currentResume = null;
}

/**
 * Drag and Drop Handlers
 */
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        elements.resumeFile.files = files;
        handleFileUpload({ target: { files } });
    }
}

/**
 * Handle Analyze - with improved error handling
 */
async function handleAnalyze() {
    // Safety check on elements
    if (!elements || !elements.jobDescription || !elements.resumeText) {
        showError('UI not fully initialized. Please refresh the popup.');
        return;
    }
    
    const jobDescription = (elements.jobDescription.value || '').trim();
    const resumeText = (elements.resumeText.value || '').trim();
    
    // Validation
    if (!jobDescription) {
        showError('Please provide a job description');
        return;
    }
    
    if (!resumeText) {
        showError('Please upload or paste your resume');
        return;
    }
    
    // Additional validation - check minimum content
    if (jobDescription.length < 50) {
        showError('Job description too short. Please provide at least 50 characters.');
        return;
    }
    
    if (resumeText.length < 50) {
        showError('Resume too short. Please provide at least 50 characters.');
        return;
    }
    
    showLoading('Analyzing your resume...');
    hideError();
    if (panels && panels.analysis) panels.analysis.classList.add('hidden');
    if (panels && panels.optimization) panels.optimization.classList.add('hidden');
    
    PopupState.markTask();
    
    try {
        // Add timeout for the request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const apiUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
            ? CONFIG.API_BASE_URL 
            : 'https://ats-resume-optimizer-359j.onrender.com/api';
        
        const response = await fetch(`${apiUrl}/analysis/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobDescription,
                resumeText
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response format from server');
        }
        
        currentAnalysis = data;
        
        // Save analysis
        await StorageUtil.saveAnalysis(data).catch(err => {
            console.warn('[Popup] Failed to save analysis to storage:', err);
            // Don't fail the whole operation, just warn
        });
        
        // Display results
        displayAnalysisResults(data);
        
        hideLoading();
        if (panels && panels.analysis) panels.analysis.classList.remove('hidden');
        
    } catch (error) {
        console.error('[Popup] Error analyzing resume:', error);
        
        // Provide more specific error messages
        let userMessage = 'Failed to analyze resume';
        if (error.name === 'AbortError') {
            userMessage = 'Request timed out. Please try again.';
        } else if (error.message.includes('Failed to fetch')) {
            userMessage = 'Cannot connect to backend. Check your connection and try again.';
        } else {
            userMessage = `Failed to analyze resume: ${error.message}`;
        }
        
        showError(userMessage);
        hideLoading();
    } finally {
        PopupState.unmarkTask();
    }
}

/**
 * Handle Fetch Job Description from Current Page
 */
async function handleFetchJobDescription() {
    showLoading('Fetching job description from page...');
    hideError();
    PopupState.markTask();
    
    try {
        // Get active tab
        const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        
        if (tabs.length === 0) {
            showError('No active tab found');
            hideLoading();
            PopupState.unmarkTask();
            return;
        }
        
        const activeTab = tabs[0];
        
        // Send message to content script to fetch job description
        chrome.tabs.sendMessage(activeTab.id, {
            type: 'FETCH_JOB_DESCRIPTION'
        }, (response) => {
            try {
                if (chrome.runtime.lastError) {
                    console.warn('[Popup] Runtime error:', chrome.runtime.lastError);
                    showError('Unable to fetch from this page. Try reloading it first.');
                    hideLoading();
                    PopupState.unmarkTask();
                    return;
                }
                
                if (response && response.success && response.job) {
                    // Update job description textarea
                    elements.jobDescription.value = response.job.description || '';
                    
                    // Save to storage
                    chrome.storage.local.set({ currentJob: response.job });
                    
                    showNotification('✅ Job description fetched! Ready to analyze.', 'success');
                    hideLoading();
                    
                    // Scroll to job description area
                    elements.jobDescription.scrollIntoView({ behavior: 'smooth' });
                } else {
                    showError(response?.message || 'Could not fetch job description');
                    hideLoading();
                }
                
                PopupState.unmarkTask();
            } catch (error) {
                console.error('[Popup] Error in fetch response:', error);
                showError('Error: ' + error.message);
                hideLoading();
                PopupState.unmarkTask();
            }
        });
        
    } catch (error) {
        console.error('[Popup] Error fetching job description:', error);
        showError('Error: ' + error.message);
        hideLoading();
        PopupState.unmarkTask();
    }
}

/**
 * Display Analysis Results
 */
function displayAnalysisResults(data) {
    // ATS Score
    if (elements.atsScore) elements.atsScore.textContent = data.atsScore || 0;
    
    // Score breakdown
    if (data.breakdown) {
        if (elements.keywordBar) elements.keywordBar.style.width = `${(data.breakdown.keywordMatch * 100)}%`;
        if (elements.experienceBar) elements.experienceBar.style.width = `${(data.breakdown.experienceRelevance * 100)}%`;
        if (elements.skillsBar) elements.skillsBar.style.width = `${(data.breakdown.skillsAlignment * 100)}%`;
    }
    
    // Matched keywords
    setElementHTML(elements.matchedKeywords, '');
    if (data.matchedKeywords && data.matchedKeywords.length > 0) {
        data.matchedKeywords.slice(0, 10).forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag matched';
            tag.textContent = keyword;
            elements.matchedKeywords?.appendChild(tag);
        });
    } else {
        setElementHTML(elements.matchedKeywords, '<span style="color: #999; font-size: 11px;">None</span>');
    }
    
    // Missing keywords
    setElementHTML(elements.missingKeywords, '');
    if (data.missingKeywords && data.missingKeywords.length > 0) {
        data.missingKeywords.slice(0, 10).forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag missing';
            tag.textContent = keyword;
            elements.missingKeywords?.appendChild(tag);
        });
    } else {
        setElementHTML(elements.missingKeywords, '<span style="color: #999; font-size: 11px;">None</span>');
    }
    
    // Suggestions
    setElementHTML(elements.suggestionsList, '');
    if (data.suggestions && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = `suggestion-item ${suggestion.priority || 'medium'}`;
            item.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(suggestion.message)}</div>
                <div style="font-size: 11px; color: #666;">${escapeHtml(suggestion.impact || '')}</div>
            `;
            elements.suggestionsList.appendChild(item);
        });
    }
}

/**
 * Handle Optimize
 */
async function handleOptimize() {
    if (!currentAnalysis) {
        showError('Please analyze your resume first');
        return;
    }
    
    showLoading('Optimizing your resume...');
    hideError();
    panels.optimization.classList.add('hidden');
    
    try {
        const apiUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
            ? CONFIG.API_BASE_URL 
            : 'https://ats-resume-optimizer-359j.onrender.com/api';
        
        const response = await fetch(`${apiUrl}/analysis/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resumeText: elements.resumeText.value.trim(),
                jobDescription: elements.jobDescription.value.trim(),
                analysisResult: currentAnalysis,
                preferences: {
                    aggressiveness: 'moderate',
                    preserveFormatting: true,
                    targetScore: 85
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Optimization failed');
        }
        
        const data = await response.json();
        currentOptimization = data;
        
        // Display optimization results
        displayOptimizationResults(data);
        
        // Save to history
        await saveToHistory(data);
        
        hideLoading();
        panels.optimization.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error optimizing resume:', error);
        showError('Failed to optimize resume: ' + error.message);
        hideLoading();
    }
}

/**
 * Display Optimization Results
 */
function displayOptimizationResults(data) {
    // Scores
    if (elements.originalScore) elements.originalScore.textContent = data.originalScore || 0;
    if (elements.optimizedScore) elements.optimizedScore.textContent = data.optimizedScore || 0;
    
    const improvement = (data.optimizedScore || 0) - (data.originalScore || 0);
    if (elements.scoreImprovement) {
        elements.scoreImprovement.textContent = improvement > 0 ? `+${improvement}` : improvement;
        elements.scoreImprovement.style.background = improvement > 0 ? '#4caf50' : '#999';
    }
    
    // Update resume text area with optimized version
    if (data.optimizedText && elements.resumeText) {
        elements.resumeText.value = data.optimizedText;
        elements.resumeText.classList.add('optimized');
        
        // Scroll to top of resume text
        elements.resumeText.scrollTop = 0;
        
        // Show notification
        showNotification('✅ Your resume has been optimized! The changes are now in the text area above. Scroll up to review.', 'success');
        
        // Highlight the text area briefly
        elements.resumeText.style.animation = 'pulse 0.5s ease';
        setTimeout(() => {
            elements.resumeText.style.animation = '';
        }, 500);
    }
    
    // Changes
    setElementHTML(elements.changesList, '');
    if (data.changes && data.changes.length > 0) {
        // Add summary
        const summary = document.createElement('div');
        summary.style.cssText = 'background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 12px;';
        summary.innerHTML = `
            <strong style="color: #2e7d32;">📝 ${data.changes.length} Changes Made</strong>
            <p style="font-size: 12px; margin-top: 4px; color: #555;">
                Your resume has been updated with job-specific keywords and improvements.
                Review the changes below and download your optimized resume.
            </p>
        `;
        elements.changesList.appendChild(summary);
        
        data.changes.forEach((change, index) => {
            const item = document.createElement('div');
            item.className = 'change-item';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <span class="change-type ${change.type}">${change.type.replace(/_/g, ' ')}</span>
                        <div style="margin-top: 6px; font-size: 12px;">${escapeHtml(change.reason)}</div>
                        ${change.original && change.modified ? `
                            <div style="margin-top: 8px; font-size: 11px;">
                                <div style="color: #c62828; text-decoration: line-through; margin-bottom: 4px;">
                                    ${escapeHtml(change.original.substring(0, 100))}${change.original.length > 100 ? '...' : ''}
                                </div>
                                <div style="color: #2e7d32;">
                                    ${escapeHtml(change.modified.substring(0, 100))}${change.modified.length > 100 ? '...' : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <span style="font-size: 20px; margin-left: 8px;">${change.impact === 'high' ? '🔥' : change.impact === 'medium' ? '⭐' : '💡'}</span>
                </div>
            `;
            elements.changesList.appendChild(item);
        });
    } else {
        elements.changesList.innerHTML = '<p style="color: #999; font-size: 12px;">No changes made</p>';
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
        font-size: 13px;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

/**
 * Handle Download
 */
async function handleDownload(format) {
    if (!currentOptimization) {
        showError('Please optimize your resume first');
        return;
    }
    
    showLoading(`Preparing your optimized resume...`);
    
    try {
        const jobTitle = currentJob?.jobTitle || 'Position';
        const optimizedText = currentOptimization.optimizedText || elements.resumeText.value;
        
        // For TXT format, just download the text directly
        if (format === 'txt') {
            const blob = new Blob([optimizedText], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Resume_Optimized_${jobTitle.replace(/\s+/g, '_')}_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            hideLoading();
            showNotification('✅ Resume downloaded as TXT!', 'success');
            return;
        }
        
        // For PDF/DOCX, send the optimized text to preserve original structure
        const apiUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
            ? CONFIG.API_BASE_URL 
            : 'https://ats-resume-optimizer-359j.onrender.com/api';
        
        const response = await fetch(`${apiUrl}/documents/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resumeData: currentOptimization.optimizedData || { 
                    contact: {}, 
                    experience: [], 
                    education: [], 
                    skills: [], 
                    certifications: [] 
                },
                optimizedText: optimizedText, // Send the optimized text
                format,
                template: 'professional',
                jobTitle,
                preserveOriginalStyle: true // Flag to preserve original formatting
            })
        });
        
        if (!response.ok) {
            throw new Error('Document generation failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Resume_Optimized_${jobTitle.replace(/\s+/g, '_')}_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        hideLoading();
        showNotification(`✅ Your optimized resume has been downloaded as ${format.toUpperCase()}!`, 'success');
        
    } catch (error) {
        console.error('Error downloading document:', error);
        showError('Failed to generate document: ' + error.message);
        hideLoading();
    }
}

/**
 * Save to History
 */
async function saveToHistory(optimizationData) {
    const historyEntry = {
        jobTitle: currentJob?.jobTitle || 'Unknown Position',
        company: currentJob?.company || 'Unknown Company',
        originalScore: optimizationData.originalScore,
        optimizedScore: optimizationData.optimizedScore,
        scoreImprovement: optimizationData.scoreImprovement,
        jobDescription: elements.jobDescription.value.trim(),
        optimizedText: optimizationData.optimizedText
    };
    
    await StorageUtil.saveToHistory(historyEntry);
}

/**
 * Load History
 */
async function loadHistory() {
    try {
        const result = await StorageUtil.getHistory();
        if (result.success && result.history) {
            displayHistory(result.history);
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

/**
 * Display History
 */
function displayHistory(history) {
    setElementHTML(elements.historyList, '');
    
    if (!history || history.length === 0) {
        setElementHTML(elements.historyList, '<p style="color: #999; text-align: center; padding: 20px;">No optimization history yet</p>');
        return;
    }
    
    history.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const date = new Date(entry.createdAt).toLocaleDateString();
        const improvement = entry.scoreImprovement > 0 ? `+${entry.scoreImprovement}` : entry.scoreImprovement;
        
        item.innerHTML = `
            <div class="history-item-header">
                <div class="history-item-title">${escapeHtml(entry.jobTitle)}</div>
                <div class="history-item-date">${date}</div>
            </div>
            <div class="history-item-scores">
                ${entry.company} • ${entry.originalScore} → ${entry.optimizedScore} (${improvement})
            </div>
        `;
        
        item.addEventListener('click', () => viewHistoryEntry(entry));
        
        elements.historyList.appendChild(item);
    });
}

/**
 * View History Entry
 */
function viewHistoryEntry(entry) {
    // Switch to optimize tab
    switchTab('optimize');
    
    // Populate fields
    elements.jobDescription.value = entry.jobDescription || '';
    elements.resumeText.value = entry.optimizedText || '';
    
    // Show notification
    showError('Loaded from history');
    setTimeout(hideError, 2000);
}

/**
 * Handle Clear History
 */
async function handleClearHistory() {
    if (!confirm('Are you sure you want to clear all history?')) {
        return;
    }
    
    try {
        await StorageUtil.clearHistory();
        loadHistory();
    } catch (error) {
        console.error('Error clearing history:', error);
        showError('Failed to clear history');
    }
}

/**
 * Debug Token Status - For troubleshooting
 */
function debugTokenStatus() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 JOB ORBIT TOKEN DEBUG REPORT');
    console.log('='.repeat(70));
    
    // Check sync storage
    chrome.storage.sync.get(['jobOrbitAuth'], (syncResult) => {
        console.log('\n📋 SYNC STORAGE (chrome.storage.sync):');
        if (syncResult.jobOrbitAuth) {
            const auth = syncResult.jobOrbitAuth;
            console.log('  ✅ Token found');
            console.log('  Token:', auth.extensionToken ? auth.extensionToken.substring(0, 30) + '...' : 'MISSING');
            console.log('  User:', auth.user?.email || 'MISSING');
            console.log('  Received at:', auth.receivedAt || 'MISSING');
            console.log('  Expires at:', auth.expiresAt ? new Date(auth.expiresAt).toISOString() : 'MISSING');
            console.log('  Time until expiry:', auth.expiresAt ? Math.round((auth.expiresAt - Date.now()) / 60000) + ' minutes' : 'N/A');
            console.log('  Source:', auth.source || 'UNKNOWN');
        } else {
            console.log('  ❌ NO TOKEN FOUND');
        }
        
        // Check local storage
        chrome.storage.local.get(['jobOrbitAuth'], (localResult) => {
            console.log('\n📋 LOCAL STORAGE (chrome.storage.local):');
            if (localResult.jobOrbitAuth) {
                const auth = localResult.jobOrbitAuth;
                console.log('  ✅ Token found (backup)');
                console.log('  Token:', auth.extensionToken ? auth.extensionToken.substring(0, 30) + '...' : 'MISSING');
                console.log('  User:', auth.user?.email || 'MISSING');
                console.log('  Received at:', auth.receivedAt || 'MISSING');
            } else {
                console.log('  ℹ️ NO BACKUP TOKEN');
            }
            
            // Check extension ID
            console.log('\n🆔 EXTENSION INFO:');
            console.log('  Extension ID:', chrome.runtime.id);
            
            // Check service worker status
            console.log('\n🔧 SERVICE WORKER:');
            console.log('  Status: Active (handling messages)');
            console.log('  Message listeners: Registered');
            console.log('  External messages: Enabled');
            
            console.log('\n' + '='.repeat(70));
            console.log('✅ Debug report complete. Check console logs above.\n');
        });
    });
}

// Make debug function globally accessible
window.debugJobOrbitToken = debugTokenStatus;

/**
 * Show Loading
 */
function showLoading(message = 'Processing...') {
    try {
        if (elements?.loadingSpinner) {
            elements.loadingSpinner.classList.remove('hidden');
        }
        if (elements?.loadingText && message) {
            elements.loadingText.textContent = message;
        }
        console.log('[Popup] Loading:', message);
    } catch (error) {
        console.error('[Popup] Error showing loading:', error);
    }
}

/**
 * Hide Loading
 */
function hideLoading() {
    try {
        if (elements?.loadingSpinner) {
            elements.loadingSpinner.classList.add('hidden');
        }
    } catch (error) {
        console.error('[Popup] Error hiding loading:', error);
    }
}

/**
 * Show Error
 */
function showError(message) {
    try {
        if (elements?.errorMessage) {
            elements.errorMessage.textContent = message;
            elements.errorMessage.classList.remove('hidden');
        }
    } catch (error) {
        console.error('[Popup] Error showing message:', error);
    }
}

/**
 * Hide Error
 */
function hideError() {
    try {
        if (elements?.errorMessage) {
            elements.errorMessage.classList.add('hidden');
        }
    } catch (error) {
        console.error('[Popup] Error hiding error:', error);
    }
}

/**
 * Handle Copy Optimized Text
 */
async function handleCopyOptimized() {
    const optimizedText = elements.resumeText.value;
    
    if (!optimizedText) {
        showError('No optimized text to copy');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(optimizedText);
        
        const btn = document.getElementById('copyOptimizedBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#4caf50';
        btn.style.color = 'white';
        
        showNotification('✅ Optimized text copied! Now paste it into your original resume file.', 'success');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 3000);
    } catch (error) {
        console.error('Failed to copy:', error);
        showError('Failed to copy text. Please select and copy manually.');
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


/**
 * API Helper with Retry Logic
 */
class APIHelper {
    static async fetchWithRetry(url, options, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                
                if (response.ok) {
                    return response;
                }
                
                // If error is not retryable, throw immediately
                if (response.status >= 400 && response.status < 500) {
                    const errorData = await response.json().catch(() => ({}));
                    if (!errorData.error?.retryable) {
                        throw new Error(errorData.error?.message || 'Request failed');
                    }
                }
                
                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                
            } catch (error) {
                lastError = error;
                
                // Don't retry on network errors if it's the last attempt
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
            }
        }
        
        throw lastError;
    }
}

/**
 * Enhanced Error Display
 */
function showEnhancedError(error, context = '') {
    let message = error.message || 'An error occurred';
    
    // Add context if provided
    if (context) {
        message = `${context}: ${message}`;
    }
    
    // Check if error is retryable
    if (error.retryable) {
        message += ' (Retrying...)';
    }
    
    showError(message);
    
    // Auto-hide non-critical errors after 5 seconds
    if (!error.critical) {
        setTimeout(hideError, 5000);
    }
}


/**
 * Debounce Utility
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Auto-save with debouncing
 */
const autoSaveJobDescription = debounce((value) => {
    chrome.storage.local.set({ jobDescription: value });
}, 500);

const autoSaveResumeText = debounce((value) => {
    chrome.storage.local.set({ resumeText: value });
}, 500);

// Add auto-save listeners
if (elements.jobDescription) {
    elements.jobDescription.addEventListener('input', (e) => {
        autoSaveJobDescription(e.target.value);
    });
}

if (elements.resumeText) {
    elements.resumeText.addEventListener('input', (e) => {
        autoSaveResumeText(e.target.value);
    });
}

/**
 * Lazy Loading for Heavy Components
 */
function lazyLoadHistory() {
    // Only load history when tab is visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadHistory();
                observer.disconnect();
            }
        });
    });
    
    if (elements.historyList) {
        observer.observe(elements.historyList);
    }
}

// Initialize lazy loading
lazyLoadHistory();

/**
 * Show Autofill Status Message
 * Displays status message in the autofill message element
 */
function showAutofillStatus(message, type = 'info') {
    const messageEl = document.getElementById('autofillMessage');
    if (!messageEl) {
        console.warn('[Popup] autofillMessage element not found');
        showNotification(message, type); // Fallback to notification
        return;
    }
    
    messageEl.innerHTML = message;
    messageEl.className = `autofill-status-message ${type}`;
    messageEl.classList.remove('hidden');
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 4000);
}

/**
 * ============================================================================
 * Autofill Profile Implementation
 * ============================================================================
 */

/**
 * Load saved Autofill Profile
 */
async function loadAutofillProfile() {
    try {
        PopupState.markTask();
        
        console.log('[Popup] 📥 Loading autofill profile...');
        
        // First, verify profile still exists
        const verification = await StorageUtil.verifyProfileExists();
        if (!verification.anyExists) {
            console.warn('[Popup] ⚠️ Profile not found in storage!');
            showNotification('⚠️ Profile data missing. Attempting to restore from backup...', 'warning');
            
            // Try to restore from backup
            const restore = await StorageUtil.restoreProfileFromBackup();
            if (!restore.restored) {
                console.warn('[Popup] ❌ Could not restore profile - it may have been deleted');
                showNotification('Profile was lost. Please fill out your profile again.', 'error');
                return;
            }
        }
        
        // Load profile
        const result = await StorageUtil.getAutofillProfile();
        
        if (result.success && result.profile && Object.keys(result.profile).length > 0) {
            const p = result.profile;
            
            console.log('[Popup] ✅ Profile loaded from', result.source, 'storage');
            console.log('[Popup] Profile data:', { 
                hasEmail: !!p.email, 
                hasName: !!p.full_name,
                fields: Object.keys(p).length 
            });
            
            // Personal fields
            const fullNameEl = document.getElementById('full_name');
            if (fullNameEl) fullNameEl.value = p.full_name || '';
            
            const firstNameEl = document.getElementById('first_name');
            if (firstNameEl) firstNameEl.value = p.first_name || '';
            
            const lastNameEl = document.getElementById('last_name');
            if (lastNameEl) lastNameEl.value = p.last_name || '';
            
            const emailEl = document.getElementById('email');
            if (emailEl) emailEl.value = p.email || '';
            
            const phoneEl = document.getElementById('phone');
            if (phoneEl) phoneEl.value = p.phone || '';
            
            const cityEl = document.getElementById('city');
            if (cityEl) cityEl.value = p.city || '';
            
            const stateEl = document.getElementById('state');
            if (stateEl) stateEl.value = p.state || '';
            
            const zipEl = document.getElementById('zip');
            if (zipEl) zipEl.value = p.zip || '';
            
            const countryEl = document.getElementById('country');
            if (countryEl) countryEl.value = p.country || '';
            
            // Professional fields
            const currentTitleEl = document.getElementById('current_title');
            if (currentTitleEl) currentTitleEl.value = p.current_title || '';
            
            const currentCompanyEl = document.getElementById('current_company');
            if (currentCompanyEl) currentCompanyEl.value = p.current_company || '';
            
            const yearsEl = document.getElementById('years_of_experience');
            if (yearsEl) yearsEl.value = p.years_of_experience || '';
            
            const noticePeriodEl = document.getElementById('notice_period');
            if (noticePeriodEl) noticePeriodEl.value = p.notice_period || '';
            
            const salaryEl = document.getElementById('expected_salary');
            if (salaryEl) salaryEl.value = p.expected_salary || '';
            
            // Links
            const linkedinEl = document.getElementById('linkedin');
            if (linkedinEl) linkedinEl.value = p.linkedin || '';
            
            const githubEl = document.getElementById('github');
            if (githubEl) githubEl.value = p.github || '';
            
            const portfolioEl = document.getElementById('portfolio');
            if (portfolioEl) portfolioEl.value = p.portfolio || '';
            
            // Resume & Skills
            const resumeEl = document.getElementById('default_resume');
            if (resumeEl) resumeEl.value = p.default_resume || '';
            
            const skillsEl = document.getElementById('skills');
            if (skillsEl) skillsEl.value = p.skills || '';
            
            // Answers
            const answerAboutEl = document.getElementById('answer_about_you');
            if (answerAboutEl) answerAboutEl.value = p.answer_about_you || '';
            
            const answerWhyEl = document.getElementById('answer_why_company');
            if (answerWhyEl) answerWhyEl.value = p.answer_why_company || '';
            
            const answerHireEl = document.getElementById('answer_hire_you');
            if (answerHireEl) answerHireEl.value = p.answer_hire_you || '';
            
            // Q&A profile fields
            const keyStrengthEl = document.getElementById('key_strength');
            if (keyStrengthEl) keyStrengthEl.value = p.key_strength || '';
            
            const whyInterestedEl = document.getElementById('why_interested');
            if (whyInterestedEl) whyInterestedEl.value = p.why_interested || '';
            
            console.log('[Popup] ✅ All available profile fields populated');

        } else {
            console.log('[Popup] ℹ️ No autofill profile found (first time or deleted)');
        }
    } catch (error) {
        console.error('[Popup] Error loading autofill profile:', error);
        showNotification('Error loading profile: ' + error.message, 'error');
    } finally {
        PopupState.unmarkTask();
    }
}

/**
 * Add a new custom field input row
 */
function addCustomFieldRow(key = '', value = '') {
    const container = document.getElementById('customFieldsContainer');
    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.innerHTML = `
        <input type="text" class="custom-key" placeholder="Key (e.g. Notice Period)" value="${key}" required>
        <input type="text" class="custom-val" placeholder="Value (e.g. Immediate)" value="${value}" required>
        <button type="button" class="btn-remove-custom" title="Remove Field">✕</button>
    `;
    
    // Add remove event listener
    row.querySelector('.btn-remove-custom').addEventListener('click', () => {
        row.remove();
    });
    
    container.appendChild(row);
}

/**
 * Handle save profile form submit
 * Saves to BOTH sync and local storage for redundancy
 */
async function handleSaveProfile(e) {
    if (e) e.preventDefault();
    
    const messageEl = document.getElementById('autofillMessage');
    messageEl.className = 'autofill-status-message hidden';
    
    try {
        showLoading('Saving profile...');
        
        // Collect custom fields
        const customFields = [];
        const rows = document.querySelectorAll('.custom-field-row');
        rows.forEach(row => {
            const key = row.querySelector('.custom-key').value.trim();
            const value = row.querySelector('.custom-val').value.trim();
            if (key && value) {
                customFields.push({ key, value });
            }
        });

        const profileData = {
            // Personal
            full_name: document.getElementById('full_name').value.trim(),
            first_name: document.getElementById('first_name').value.trim(),
            last_name: document.getElementById('last_name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state')?.value.trim() || '',
            zip: document.getElementById('zip')?.value.trim() || '',
            country: document.getElementById('country').value.trim(),
            
            // Professional
            current_title: document.getElementById('current_title').value.trim(),
            current_company: document.getElementById('current_company')?.value.trim() || '',
            years_of_experience: document.getElementById('years_of_experience').value.trim(),
            notice_period: document.getElementById('notice_period')?.value.trim() || '',
            expected_salary: document.getElementById('expected_salary')?.value.trim() || '',
            
            // Links
            linkedin: document.getElementById('linkedin').value.trim(),
            github: document.getElementById('github').value.trim(),
            portfolio: document.getElementById('portfolio').value.trim(),
            
            // Resume & Skills
            default_resume: document.getElementById('default_resume')?.value.trim() || '',
            skills: document.getElementById('skills')?.value.trim() || '',
            
            // Pre-filled Answers
            answer_about_you: document.getElementById('answer_about_you')?.value.trim() || '',
            answer_why_company: document.getElementById('answer_why_company')?.value.trim() || '',
            answer_hire_you: document.getElementById('answer_hire_you')?.value.trim() || '',
            
            // Q&A profile fields (for SmartAnswerEngine)
            key_strength: document.getElementById('key_strength')?.value.trim() || '',
            why_interested: document.getElementById('why_interested')?.value.trim() || '',
            
            // Job Preferences
            work_environment: document.getElementById('work_environment')?.value || '',
            preferred_location: document.getElementById('preferred_location')?.value.trim() || '',
            work_authorization: document.getElementById('work_authorization')?.value.trim() || '',
            
            custom_fields: customFields
        };

        console.log('[Popup] 💾 Saving profile with', Object.keys(profileData).length, 'fields');

        // DIRECT SAVE - bypass StorageUtil for reliability
        // Save to BOTH local and sync storage with explicit error handling
        const directSaveResult = await new Promise((resolve) => {
            try {
                // Step 1: Save to local storage (primary)
                chrome.storage.local.set({ autofillProfile: profileData, profileSavedAt: Date.now() }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[Popup] ❌ Local storage write failed:', chrome.runtime.lastError);
                        resolve({ success: false, error: chrome.runtime.lastError.message, location: 'local' });
                        return;
                    }
                    
                    console.log('[Popup] ✅ Profile saved to local storage');
                    
                    // Step 2: Also save to sync storage (backup)
                    chrome.storage.sync.set({ autofillProfile: profileData, profileSavedAt: Date.now() }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('[Popup] ⚠️  Sync storage write had error:', chrome.runtime.lastError);
                            // Still resolve success since local saved
                            resolve({ success: true, location: 'local', syncError: chrome.runtime.lastError.message });
                            return;
                        }
                        
                        console.log('[Popup] ✅ Profile saved to sync storage (backup)');
                        resolve({ success: true, location: 'local+sync' });
                    });
                });
            } catch (error) {
                console.error('[Popup] ❌ Error in direct save:', error);
                resolve({ success: false, error: error.message });
            }
        });

        if (!directSaveResult.success) {
            throw new Error(directSaveResult.error || 'Failed to save profile to storage');
        }

        console.log('[Popup] ✅ Profile saved to', directSaveResult.location);
        
        // Verify it was actually saved by reading it back
        const verifyRead = await new Promise((resolve) => {
            chrome.storage.local.get(['autofillProfile'], (result) => {
                if (result.autofillProfile) {
                    resolve({ verified: true, keys: Object.keys(result.autofillProfile).length });
                } else {
                    resolve({ verified: false });
                }
            });
        });

        if (!verifyRead.verified) {
            throw new Error('Profile verification failed - data was not persisted');
        }

        console.log('[Popup] ✅ Profile verified in storage with', verifyRead.keys, 'fields');

        hideLoading();
        showNotification('✅ Profile saved successfully!', 'success');
        messageEl.innerHTML = '✅ Profile saved successfully!';
        messageEl.className = 'autofill-status-message success';
        
        // Also sync to backend if authenticated (but don't fail if it does)
        try {
            const token = await TokenVerifier.getStoredToken();
            if (token) {
                console.log('[Popup] 📤 Syncing profile to backend...');
                const syncResult = await ProfileSyncManager.uploadProfile(token, profileData);
                if (syncResult.success) {
                    console.log('[Popup] ✅ Profile synced to backend');
                    showNotification('✅ Profile synced to Job Orbit!', 'success');
                }
            }
        } catch (backendError) {
            console.warn('[Popup] ⚠️  Backend sync error (local save still succeeded):', backendError);
        }
        
        // Hide message after 3 seconds
        setTimeout(() => {
            messageEl.className = 'autofill-status-message hidden';
        }, 3000);
        
    } catch (error) {
        console.error('[Popup] ❌ Error saving profile:', error);
        hideLoading();
        showNotification('❌ Error saving profile: ' + error.message, 'error');
        messageEl.innerHTML = '❌ ' + error.message;
        messageEl.className = 'autofill-status-message error';
    }
}

/**
 * Handle Autofill Current Tab button
 */
async function handleAutofillTab() {
    const messageEl = document.getElementById('autofillMessage');
    messageEl.className = 'autofill-status-message hidden';
    
    try {
        // Make sure we have the latest profile data
        const profileResult = await StorageUtil.getAutofillProfile();
        if (!profileResult.success || !profileResult.profile) {
            showAutofillStatus('Please fill out and save your profile first.', 'error');
            return;
        }
        
        const profile = profileResult.profile;
        
        // Send message to active tab content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (!activeTab) {
                showAutofillStatus('No active tab found.', 'error');
                return;
            }
            
            // Send request
            showAutofillStatus('Autofilling form...', 'success');
            
            chrome.tabs.sendMessage(activeTab.id, {
                type: 'AUTOFILL_START',
                profile: profile
            }, (response) => {
                if (chrome.runtime.lastError) {
                    showAutofillStatus('Could not connect to page. Try reloading the page first.', 'error');
                    console.error('Runtime error:', chrome.runtime.lastError);
                    return;
                }
                
                if (response && response.success) {
                    showAutofillStatus(`Successfully filled ${response.filledCount} fields! ⚡`, 'success');
                    if (response.missedFields && response.missedFields.length > 0) {
                        showMissedFields(response.missedFields);
                    } else {
                        document.getElementById('missedFieldsSection').classList.add('hidden');
                    }
                } else {
                    showAutofillStatus(response ? response.message : 'Failed to autofill page.', 'error');
                }
            });
        });
    } catch (error) {
        console.error('Error initiating tab autofill:', error);
        showAutofillStatus('Error: ' + error.message, 'error');
    }
}

/**
 * Handle Show Autofill Button on Current Page
 * Re-enables the autofill button if user closed it
 */
async function handleShowAutofillButton() {
    try {
        PopupState.markTask();
        
        // Send message to active tab to re-enable autofill button
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                showNotification('No active tab found', 'error');
                PopupState.unmarkTask();
                return;
            }
            
            const activeTab = tabs[0];
            
            chrome.tabs.sendMessage(activeTab.id, {
                type: 'SHOW_AUTOFILL_BUTTON'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[Popup] Could not send message to tab:', chrome.runtime.lastError);
                    showNotification('Please reload the page first', 'error');
                    PopupState.unmarkTask();
                    return;
                }
                
                if (response && response.success) {
                    showNotification('✅ Autofill button is now visible on the page!', 'success');
                    document.getElementById('autofillHiddenNotice').style.display = 'none';
                    
                    // Clear both hidden and dismissed flags
                    chrome.storage.local.set({ 
                        autofillButtonHidden: false,
                        autofillNoticeDismissed: false
                    });
                } else {
                    showNotification('Could not show autofill button', 'error');
                }
                
                PopupState.unmarkTask();
            });
        });
    } catch (error) {
        console.error('[Popup] Error showing autofill button:', error);
        showNotification('Error: ' + error.message, 'error');
        PopupState.unmarkTask();
    }
}

/**
 * Check if Autofill Button is Hidden and Show Notice
 */
function checkAutofillButtonStatus() {
    try {
        chrome.storage.local.get(['autofillButtonHidden', 'autofillNoticeDismissed'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('[Popup] Storage error:', chrome.runtime.lastError);
                return;
            }
            
            const notice = document.getElementById('autofillHiddenNotice');
            
            // Show notice only if:
            // 1. Button is hidden AND
            // 2. Notice hasn't been dismissed
            if (result.autofillButtonHidden === true && result.autofillNoticeDismissed !== true) {
                notice.style.display = 'block';
                console.log('[Popup] Autofill button is hidden - showing notice');
            } else {
                notice.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('[Popup] Error checking autofill status:', error);
    }
}

/**
 * Handle Dismiss Autofill Notice
 * User clicks X to dismiss the notice without showing the button
 */
function handleDismissAutofillNotice() {
    try {
        const notice = document.getElementById('autofillHiddenNotice');
        notice.style.display = 'none';
        
        // Save that user dismissed the notice (so it doesn't show again this session)
        chrome.storage.local.set({ autofillNoticeDismissed: true }, () => {
            console.log('[Popup] Autofill notice dismissed by user');
        });
    } catch (error) {
        console.error('[Popup] Error dismissing autofill notice:', error);
    }
}


function showMissedFields(fields) {
    const section = document.getElementById('missedFieldsSection');
    const list = document.getElementById('missedFieldsList');
    list.innerHTML = '';
    
    fields.forEach(field => {
        const tag = document.createElement('div');
        tag.className = 'missed-field-tag';
        tag.innerHTML = `
            <span>${field}</span>
            <button type="button" class="btn-add-missed" title="Add as custom field">+</button>
        `;
        
        tag.querySelector('.btn-add-missed').addEventListener('click', () => {
            // Add a new custom field row
            addCustomFieldRow(field, '');
            tag.remove();
            
            // Hide the missed fields section if there are no tags left
            if (list.children.length === 0) {
                section.classList.add('hidden');
            }
            
            // Focus on the newly added custom field value input
            const rows = document.querySelectorAll('.custom-field-row');
            if (rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                const valInput = lastRow.querySelector('.custom-val');
                if (valInput) valInput.focus();
            }
        });
        
        list.appendChild(tag);
    });
    
    section.classList.remove('hidden');
}

/**
 * Handle Autofill Results
 * Called when autofill completes from content script
 */
function handleAutofillResults(result) {
    console.log('[Popup] Processing autofill results:', result);
    
    if (!result) {
        console.error('[Popup] No result data provided');
        return;
    }
    
    // Show results summary
    if (result.filled || result.skipped || result.failed) {
        const messageEl = document.getElementById('autofillMessage');
        if (messageEl) {
            const total = (result.filled || 0) + (result.skipped || 0) + (result.failed || 0);
            const message = `✅ Autofill Complete! Filled: ${result.filled || 0}, Skipped: ${result.skipped || 0}, Failed: ${result.failed || 0}`;
            messageEl.textContent = message;
            messageEl.className = 'autofill-status-message success';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }
    
    // Record application if details are available
    if (result.jobTitle || result.company) {
        const applicationData = {
            company: result.company || 'Unknown Company',
            jobTitle: result.jobTitle || 'Unknown Position',
            date: new Date().toISOString(),
            resumeVersion: 'current',
            status: 'Applied',
            notes: `Auto-filled ${result.filled || 0} fields`
        };
        
        chrome.runtime.sendMessage({
            type: 'SAVE_APPLICATION_RECORD',
            payload: applicationData
        }, (response) => {
            if (response && response.success) {
                console.log('[Popup] Application record saved');
            }
        });
    }
}


/**
 * Job Orbit Integration Functions
 */

/**
 * Check Job Orbit Connection Status
 * This function verifies token exists, is valid, and not expired
 */
/**
 * FIXED: Check Job Orbit connection with race condition handling
 * This function waits for explicit auth message instead of polling storage
 * Falls back to storage check after 2-second timeout
 */
function checkJobOrbitConnection() {
    console.log('[Popup] 🔍 Checking Job Orbit connection...');
    
    return new Promise((resolve) => {
        // Set a timeout - if no message in 2 seconds, check storage
        let timeoutId = setTimeout(() => {
            console.log('[Popup] ⏱️ Timeout waiting for auth message, checking storage...');
            fallbackStorageCheck();
        }, 2000);
        
        // Flag to ensure we only resolve once
        let resolved = false;
        
        function resolveOnce(isConnected) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                console.log('[Popup] ✅ Auth state resolved:', isConnected ? 'LOGGED_IN' : 'GUEST');
                resolve(isConnected);
            }
        }
        
        // Try immediate storage check first (user might have been logged in already)
        console.log('[Popup] Checking storage immediately...');
        chrome.storage.sync.get(['jobOrbitSession', 'jobOrbitAuth'], (syncResult) => {
            if (chrome.runtime.lastError) {
                console.warn('[Popup] Sync error:', chrome.runtime.lastError.message);
            }
            
            const syncSession = syncResult.jobOrbitSession;
            const syncAuth = syncResult.jobOrbitAuth;
            
            if (syncSession && syncSession.extensionToken) {
                const now = Date.now();
                if (syncSession.expiresAt > now) {
                    console.log('[Popup] ✅ Found valid token in sync storage immediately');
                    resolveOnce(true);
                    return;
                }
            }
            
            if (syncAuth && syncAuth.extensionToken) {
                const now = Date.now();
                if ((syncAuth.expiresAt || now + 86400000) > now) {
                    console.log('[Popup] ✅ Found valid auth in sync storage immediately');
                    resolveOnce(true);
                    return;
                }
            }
            
            // Not connected yet in sync, check local
            chrome.storage.local.get(['jobOrbitSession', 'jobOrbitAuth'], (localResult) => {
                if (chrome.runtime.lastError) {
                    console.warn('[Popup] Local error:', chrome.runtime.lastError.message);
                }
                
                const localSession = localResult.jobOrbitSession;
                const localAuth = localResult.jobOrbitAuth;
                const now = Date.now();
                
                if ((localSession && localSession.extensionToken && localSession.expiresAt > now) ||
                    (localAuth && localAuth.extensionToken && (localAuth.expiresAt || now + 86400000) > now)) {
                    console.log('[Popup] ✅ Found valid token in local storage immediately');
                    resolveOnce(true);
                } else {
                    console.log('[Popup] No valid token found, waiting for auth message...');
                    // Will wait for timeout or message
                }
            });
        });
        
        // Helper: Check storage as fallback after timeout
        function fallbackStorageCheck() {
            chrome.storage.sync.get(['jobOrbitSession'], (syncResult) => {
                if (chrome.runtime.lastError) {
                    console.warn('[Popup] Fallback sync error:', chrome.runtime.lastError.message);
                }
                
                if (syncResult.jobOrbitSession) {
                    const session = syncResult.jobOrbitSession;
                    if (session.extensionToken && session.expiresAt > Date.now()) {
                        resolveOnce(true);
                        return;
                    }
                }
                
                // Check local as final fallback
                chrome.storage.local.get(['jobOrbitSession'], (localResult) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Popup] Fallback local error:', chrome.runtime.lastError.message);
                    }
                    
                    const session = localResult.jobOrbitSession;
                    if (session && session.extensionToken && session.expiresAt > Date.now()) {
                        resolveOnce(true);
                    } else {
                        resolveOnce(false);
                    }
                });
            });
        }
    }).then((isConnected) => {
        // Update UI based on connection status
        if (isConnected) {
            const now = Date.now();
            chrome.storage.sync.get(['jobOrbitSession'], (syncResult) => {
                let session = syncResult.jobOrbitSession;
                if (!session) {
                    chrome.storage.local.get(['jobOrbitSession'], (localResult) => {
                        session = localResult.jobOrbitSession;
                        if (session) {
                            showJobOrbitConnected(session.user?.email || 'Connected');
                        }
                    });
                } else {
                    showJobOrbitConnected(session.user?.email || 'Connected');
                }
            });
        } else {
            showJobOrbitNotConnected();
        }
    });
}

/**
 * Show Job Orbit Connected UI with Enhanced Status
 */
async function showJobOrbitConnected(email) {
    const notConnected = document.getElementById('jobOrbitNotConnected');
    const connected = document.getElementById('jobOrbitConnected');
    const userEmail = document.getElementById('jobOrbitUserEmail');
    
    if (notConnected) notConnected.style.display = 'none';
    if (connected) {
        connected.style.display = 'block';
        
        // Update email
        if (userEmail) userEmail.textContent = email || 'Connected';
        
        // Update sync status with cloud sync info
        const syncStatusEl = connected.querySelector('[id="jobOrbitSyncStatus"]');
        if (syncStatusEl) {
            const cachedData = await SessionManager.getCachedUserData();
            
            let statusText = '✅ Synced';
            if (cachedData.syncStatus === 'syncing') {
                statusText = '🔄 Syncing...';
            } else if (cachedData.syncStatus === 'error') {
                statusText = '⚠️ Sync Failed';
            } else if (cachedData.lastSyncAt) {
                const lastSync = new Date(cachedData.lastSyncAt);
                const now = new Date();
                const diffMinutes = Math.round((now - lastSync) / 60000);
                
                if (diffMinutes < 1) {
                    statusText = '✅ Just now';
                } else if (diffMinutes < 60) {
                    statusText = `✅ ${diffMinutes} min ago`;
                } else {
                    statusText = `✅ ${Math.round(diffMinutes / 60)} hours ago`;
                }
            }
            
            syncStatusEl.textContent = statusText;
        }
        
        // Add action buttons
        const buttonsContainer = connected.querySelector('[id="jobOrbitButtons"]');
        if (!buttonsContainer) {
            const newButtonsContainer = document.createElement('div');
            newButtonsContainer.id = 'jobOrbitButtons';
            newButtonsContainer.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #c8e6c9;
            `;
            
            newButtonsContainer.innerHTML = `
                <button id="syncNowBtn" class="btn btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 11px;">🔄 Sync Now</button>
                <button id="manageAccountBtn" class="btn btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 11px;">⚙️ Manage</button>
                <button id="logoutBtn" class="btn btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 11px;">🚪 Logout</button>
            `;
            
            connected.appendChild(newButtonsContainer);
            
            // Add event listeners
            const syncNowBtn = document.getElementById('syncNowBtn');
            const manageAccountBtn = document.getElementById('manageAccountBtn');
            const logoutBtn = document.getElementById('logoutBtn');
            
            if (syncNowBtn) {
                syncNowBtn.addEventListener('click', async () => {
                    console.log('[Popup] 🔄 Manual sync requested');
                    await SessionManager.updateCloudSyncStatus('syncing');
                    showNotification('🔄 Syncing your data...', 'info');
                    
                    try {
                        const token = await TokenVerifier.getStoredToken();
                        if (token) {
                            const syncResult = await DataSyncManager.fullSync(token);
                            if (syncResult.success) {
                                await SessionManager.updateCloudSyncStatus('success');
                                showNotification('✅ Sync completed!', 'success');
                            } else {
                                await SessionManager.updateCloudSyncStatus('error');
                                showNotification('❌ Sync failed', 'error');
                            }
                        }
                        showJobOrbitConnected(email);
                    } catch (error) {
                        console.error('[Popup] Error during sync:', error);
                        showNotification('❌ Sync error: ' + error.message, 'error');
                    }
                });
            }
            
            if (manageAccountBtn) {
                manageAccountBtn.addEventListener('click', () => {
                    console.log('[Popup] 🔧 Manage account clicked');
                    chrome.tabs.create({ url: 'https://job-orbit-flax.vercel.app/settings' });
                });
            }
            
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleJobOrbitLogout);
            }
        }
    }
    
    console.log('[Popup] ✅ Showing connected state for:', email);
}

/**
 * Show Job Orbit Not Connected UI
 */
function showJobOrbitNotConnected() {
    const notConnected = document.getElementById('jobOrbitNotConnected');
    const connected = document.getElementById('jobOrbitConnected');
    
    if (notConnected) notConnected.style.display = 'block';
    if (connected) connected.style.display = 'none';
}

/**
 * Show Guest Mode UI
 */
function showGuestMode() {
    console.log('[Popup] 👤 Showing guest mode');
    
    const authStatus = document.getElementById('authStatus');
    if (authStatus) {
        authStatus.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">👤</span>
                <div style="flex: 1;">
                    <p style="margin: 0; font-weight: 600; color: #666; font-size: 12px;">Guest Mode</p>
                    <p style="margin: 4px 0 0 0; font-size: 10px; color: #999;">Login to access all features</p>
                </div>
            </div>
        `;
        authStatus.style.background = '#f5f5f5';
        authStatus.style.borderLeft = '4px solid #999';
    }
    
    // Update quick actions to show login
    const goToResumeBtn = document.getElementById('goToResumeBtn');
    if (goToResumeBtn) {
        goToResumeBtn.innerHTML = '🔗 Login to Continue';
        goToResumeBtn.onclick = () => {
            switchTab('account');
            setTimeout(() => {
                const loginBtn = document.getElementById('joborbitLoginBtn');
                if (loginBtn) loginBtn.click();
            }, 100);
        };
    }
}

/**
 * Handle Job Orbit OAuth Login
 */
async function handleJobOrbitLogin() {
    try {
        showLoading('Opening Job Orbit...');
        
        // Generate a unique state for CSRF protection
        const state = Math.random().toString(36).substring(7);
        const nonce = Date.now().toString();
        
        // Store state in local storage temporarily
        chrome.storage.local.set({
            jobOrbitAuthState: state,
            jobOrbitAuthNonce: nonce,
            jobOrbitAuthTime: Date.now()
        });
        
        // Open the auth URL in a new tab
        const extensionId = chrome.runtime.id;
        const authUrl = `https://job-orbit-flax.vercel.app/extension-auth?extensionId=${extensionId}&state=${state}&nonce=${nonce}`;
        
        chrome.tabs.create({ url: authUrl }, (tab) => {
            hideLoading();
            console.log('[Popup] Auth tab opened, waiting for response...');
            
            // Listen for messages from the auth page
            const messageListener = (request, sender, sendResponse) => {
                if (request.type === 'JOBORBIT_AUTH_RESPONSE') {
                    console.log('[Popup] Received Job Orbit auth response from:', sender.url);
                    
                    // Validate state to prevent CSRF
                    chrome.storage.local.get(['jobOrbitAuthState', 'jobOrbitAuthTime'], (result) => {
                        const timeDiff = Date.now() - (result.jobOrbitAuthTime || 0);
                        
                        // Check if state is valid and not expired (15 minutes)
                        if (request.state === result.jobOrbitAuthState && timeDiff < 15 * 60 * 1000) {
                            handleJobOrbitAuthResponse(request.data, tab.id);
                        } else {
                            console.error('[Popup] State validation failed. Expected:', result.jobOrbitAuthState, 'Got:', request.state);
                            showNotification('Authentication failed: Invalid or expired state', 'error');
                        }
                        
                        // Clean up
                        chrome.storage.local.remove(['jobOrbitAuthState', 'jobOrbitAuthNonce', 'jobOrbitAuthTime']);
                    });
                    
                    // Remove the listener
                    chrome.runtime.onMessage.removeListener(messageListener);
                    
                    sendResponse({ success: true });
                }
            };
            
            chrome.runtime.onMessage.addListener(messageListener);
            
            // Set a timeout to remove the listener after 15 minutes to prevent memory leaks
            setTimeout(() => {
                chrome.runtime.onMessage.removeListener(messageListener);
                console.log('[Popup] Auth listener timeout after 15 minutes');
            }, 15 * 60 * 1000);
        });
        
    } catch (error) {
        hideLoading();
        console.error('[Popup] Job Orbit login error:', error);
        showNotification('Login failed: ' + error.message, 'error');
    }
}

/**
 * Handle Job Orbit Auth Response
 * Creates a persistent session with cloud sync tracking
 */
async function handleJobOrbitAuthResponse(authData, tabId) {
    console.log('[Popup] 📥 Processing auth response:', authData);
    
    if (!authData || !authData.extensionToken) {
        console.error('[Popup] ❌ Authentication failed: No token received');
        showNotification('Authentication failed: No token received', 'error');
        return;
    }
    
    try {
        showLoading('Setting up your session...');
        
        // Calculate expiration time
        const expiresIn = authData.expiresIn || 86400; // Default 24 hours
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        console.log('[Popup] ⏰ Token expiry:', {
            expiresIn: expiresIn,
            expiresAt: new Date(expiresAt).toISOString()
        });
        
        // Create comprehensive session via SessionManager
        console.log('[Popup] 💾 Creating persistent session...');
        const sessionResult = await SessionManager.createSession({
            extensionToken: authData.extensionToken,
            tokenType: authData.tokenType || 'Bearer',
            expiresIn: expiresIn,
            user: authData.user,
            userId: authData.user?.id,
            profile: authData.profile,
            resumes: authData.resumes,
            applications: authData.applications,
            answers: authData.answers,
            settings: authData.settings
        });
        
        if (!sessionResult.success) {
            throw new Error('Failed to create session');
        }
        
        console.log('[Popup] ✅ Session created and stored:', sessionResult.stored);
        
        // Also maintain backward compatibility with old auth storage
        const jobOrbitAuth = {
            extensionToken: authData.extensionToken,
            expiresAt: expiresAt,
            user: authData.user ? {
                id: authData.user.id,
                email: authData.user.email,
                name: authData.user.name,
                avatar: authData.user.avatar
            } : null,
            receivedAt: new Date().toISOString(),
            source: 'popup-response'
        };
        
        // Store in both storages for backward compatibility
        chrome.storage.sync.set({ jobOrbitAuth }, () => {
            console.log('[Popup] ✅ Stored in chrome.storage.sync');
        });
        
        chrome.storage.local.set({ jobOrbitAuth }, () => {
            console.log('[Popup] ✅ Stored in chrome.storage.local');
        });
        
        hideLoading();
        showNotification('✅ Connected to Job Orbit!', 'success');
        showJobOrbitConnected(authData.user?.email || 'Connected');
        
        console.log('[Popup] 🔄 Auth tab will close in 1 second...');
        // Close the auth tab after a short delay
        setTimeout(() => {
            chrome.tabs.remove(tabId, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[Popup] Could not close auth tab:', chrome.runtime.lastError);
                } else {
                    console.log('[Popup] ✅ Auth tab closed');
                }
            });
            
            // Refresh the settings UI and load dashboard
            setTimeout(() => {
                checkJobOrbitConnection();
                loadDashboard();
            }, 100);
        }, 1000);
        
    } catch (error) {
        console.error('[Popup] ❌ Error processing auth response:', error);
        hideLoading();
        showNotification('Failed to create session: ' + error.message, 'error');
    }
}

/**
 * Verify Job Orbit Token Expiration
 */
function verifyJobOrbitTokenExpiration() {
    chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
        if (result.jobOrbitAuth && result.jobOrbitAuth.expiresAt) {
            const now = Date.now();
            const expiresAt = result.jobOrbitAuth.expiresAt;
            
            // If token expires in less than 5 minutes, refresh it
            if (expiresAt - now < 5 * 60 * 1000) {
                console.log('[Popup] Token expiring soon, should refresh');
                // In a real app, you'd refresh the token here
            }
        }
    });
}

/**
 * Handle Job Orbit Logout
 */
async function handleJobOrbitLogout() {
    try {
        console.log('[Popup] 🚪 Logging out from Job Orbit...');
        showLoading('Logging out...');
        
        // Clear session from SessionManager
        await SessionManager.clearSession();
        
        // Clear legacy auth storage
        chrome.storage.sync.remove(['jobOrbitAuth'], () => {
            chrome.storage.local.remove(['jobOrbitAuth'], () => {
                console.log('[Popup] ✅ Session cleared');
            });
        });
        
        hideLoading();
        showNotification('✅ Logged out from Job Orbit', 'success');
        showJobOrbitNotConnected();
        showGuestMode();
        
        // Reset dashboard
        loadDashboard();
        
    } catch (error) {
        console.error('[Popup] ❌ Logout error:', error);
        hideLoading();
        showNotification('Error logging out: ' + error.message, 'error');
    }
}

/**
 * Handle Job Orbit Sync
 */
function handleJobOrbitSync() {
    const syncBtn = document.getElementById('joborbitSyncBtn');
    if (!syncBtn) return;
    
    // Disable button and show syncing status
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Syncing...';
    
    // Get current auth token
    chrome.storage.sync.get(['jobOrbitAuth'], async (result) => {
        const auth = result.jobOrbitAuth;
        
        if (!auth || !auth.extensionToken) {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Sync Now';
            showNotification('Not authenticated. Please login first.', 'error');
            return;
        }
        
        try {
            console.log('[Popup] Starting sync with Job Orbit...');
            
            // Call backend to trigger sync
            // This would sync applications, answers, etc.
            const response = await fetch('https://ats-resume-optimizer-359j.onrender.com/api/extension-auth/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.extensionToken}`
                },
                body: JSON.stringify({
                    extensionId: chrome.runtime.id
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Popup] Sync completed:', data);
                showNotification('✅ Synced with Job Orbit!', 'success');
                
                // Update sync timestamp
                const syncStatusEl = document.getElementById('jobOrbitSyncStatus');
                if (syncStatusEl) {
                    const now = new Date();
                    syncStatusEl.textContent = `Last synced: ${now.toLocaleTimeString()}`;
                }
            } else {
                console.error('[Popup] Sync failed:', response.status);
                showNotification('Sync failed. Try again.', 'error');
            }
        } catch (error) {
            console.error('[Popup] Sync error:', error);
            showNotification('Sync error: ' + error.message, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Sync Now';
        }
    });
}

/**
 * Display job tracking list (deprecated - kept for reference but not used)
 */
function displayJobTracking(applications) {
    const listContainer = document.getElementById('jobTrackingList');
    
    if (!applications || applications.length === 0) {
        listContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #999;">
                <p style="margin: 0; font-size: 12px;">No applications tracked yet</p>
            </div>
        `;
        document.getElementById('totalApplications').textContent = '0';
        document.getElementById('appliedStatus').textContent = '0';
        return;
    }
    
    // Update stats
    document.getElementById('totalApplications').textContent = applications.length;
    const appliedCount = applications.filter(a => a.status === 'Applied').length;
    document.getElementById('appliedStatus').textContent = appliedCount;
    
    // Build HTML for applications
    const html = applications.map((app, index) => `
        <div style="border-bottom: 1px solid #f0f0f0; padding: 12px; display: flex; gap: 12px; align-items: start;">
            <div style="flex: 1; font-size: 12px;">
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${escapeHtml(app.company || 'Unknown Company')}</div>
                <div style="color: #666; margin-bottom: 4px;">${escapeHtml(app.jobTitle || 'Unknown Position')}</div>
                <div style="color: #999; font-size: 11px; display: flex; gap: 8px;">
                    <span>📍 ${escapeHtml(app.location || 'Location N/A')}</span>
                    ${app.salary ? `<span>💰 ${escapeHtml(app.salary)}</span>` : ''}
                </div>
                ${app.jobUrl ? `<div style="color: #667eea; font-size: 10px; margin-top: 4px;"><a href="${escapeHtml(app.jobUrl)}" target="_blank" style="color: #667eea; text-decoration: none;">View Job →</a></div>` : ''}
            </div>
            <div style="text-align: right;">
                <span style="display: inline-block; padding: 4px 8px; background: #e8f5e9; color: #2e7d32; border-radius: 4px; font-size: 10px; font-weight: 600;">
                    ${app.status || 'Applied'}
                </span>
                <div style="font-size: 10px; color: #999; margin-top: 4px;">
                    ${app.timestamp ? new Date(app.timestamp).toLocaleDateString() : 'N/A'}
                </div>
            </div>
        </div>
    `).join('');
    
    listContainer.innerHTML = html;
}

/**
 * Export applications to CSV
 */
function exportJobsToCSV() {
    chrome.storage.local.get(['applicationHistory'], (result) => {
        const applications = result.applicationHistory || [];
        
        if (applications.length === 0) {
            showNotification('No applications to export', 'info');
            return;
        }
        
        // Create CSV header
        const headers = ['Company', 'Job Title', 'Location', 'Salary', 'Status', 'Applied Date', 'Notes'];
        
        // Create CSV rows
        const rows = applications.map(app => [
            app.company || 'N/A',
            app.jobTitle || 'N/A',
            app.location || 'N/A',
            app.salary || 'N/A',
            app.status || 'Applied',
            app.timestamp ? new Date(app.timestamp).toLocaleDateString() : 'N/A',
            app.notes || ''
        ]);
        
        // Combine headers and rows
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job-applications-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showNotification('✅ Exported to CSV!', 'success');
    });
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    const result = await new Promise((resolve) => {
        chrome.storage.sync.get([
            'autoStartAutofill',
            'showFloatingButton',
            'enableNotifications'
        ], resolve);
    });
    
    document.getElementById('autoStartAutofill').checked = result.autoStartAutofill !== false;
    document.getElementById('showFloatingButton').checked = result.showFloatingButton !== false;
    document.getElementById('enableNotifications').checked = result.enableNotifications !== false;
}

/**
 * Save settings
 */
function saveSettings() {
    const settings = {
        autoStartAutofill: document.getElementById('autoStartAutofill').checked,
        showFloatingButton: document.getElementById('showFloatingButton').checked,
        enableNotifications: document.getElementById('enableNotifications').checked
    };
    
    chrome.storage.sync.set(settings, () => {
        showNotification('✅ Settings saved!', 'success');
    });
}

/**
 * Export all data
 */
function exportAllData() {
    chrome.storage.sync.get(null, (syncData) => {
        chrome.storage.local.get(null, (localData) => {
            const allData = {
                sync: syncData,
                local: localData,
                exportDate: new Date().toISOString()
            };
            
            const json = JSON.stringify(allData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ats-resume-optimizer-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            showNotification('✅ Data exported!', 'success');
        });
    });
}

/**
 * Import data
 */
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.sync) {
                chrome.storage.sync.set(data.sync);
            }
            if (data.local) {
                chrome.storage.local.set(data.local);
            }
            
            showNotification('✅ Data imported successfully!', 'success');
            location.reload();
        } catch (error) {
            showNotification('Failed to import data: ' + error.message, 'error');
        }
    };
    input.click();
}

/**
 * Clear all data
 */
function clearAllData() {
    if (confirm('⚠️ Are you sure? This will delete all your profile, resumes, and application history. This cannot be undone.')) {
        chrome.storage.sync.clear(() => {
            chrome.storage.local.clear(() => {
                showNotification('✅ All data cleared!', 'success');
                location.reload();
            });
        });
    }
}

/**
 * Setup Settings Tab event listeners
 */
function setupSettingsListeners() {
    // Job Orbit login button
    const joborbitLoginBtn = document.getElementById('joborbitLoginBtn');
    if (joborbitLoginBtn) {
        joborbitLoginBtn.addEventListener('click', handleJobOrbitLogin);
    }
    
    // Job Orbit sync button
    const joborbitSyncBtn = document.getElementById('joborbitSyncBtn');
    if (joborbitSyncBtn) {
        joborbitSyncBtn.addEventListener('click', handleJobOrbitSync);
    }
    
    // Job Orbit logout button
    const joborbitLogoutBtn = document.getElementById('joborbitLogoutBtn');
    if (joborbitLogoutBtn) {
        joborbitLogoutBtn.addEventListener('click', handleJobOrbitLogout);
    }
    
    // Settings toggles - auto-save
    ['autoStartAutofill', 'showFloatingButton', 'enableNotifications'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', saveSettings);
        }
    });
    
    // Check if already connected to Job Orbit
    checkJobOrbitConnection();
}

/**
 * Load Job Tracking on tab switch
 */
function loadJobTracking() {
    chrome.storage.local.get(['applicationHistory'], (result) => {
        const applications = result.applicationHistory || [];
        displayJobTracking(applications);
        
        // Check if Job Orbit is connected
        chrome.storage.sync.get(['jobOrbitApiKey'], (result) => {
            if (result.jobOrbitApiKey) {
                document.getElementById('jobOrbitStatus').style.display = 'block';
            }
        });
    });
}

/**
 * Load Dashboard (Home Tab)
 * Displays auth status, quick stats, and action buttons
 */
async function loadDashboard() {
    try {
        PopupState.markTask();
        
        // Get auth status from GuestModeManager
        chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
            if (response && response.user) {
                const userEmail = response.user.email || response.user.id || 'User';
                const userEmailEl = document.getElementById('userEmail');
                if (userEmailEl) {
                    userEmailEl.textContent = userEmail;
                }
            }
        });
        
        // Load application statistics
        chrome.storage.local.get(['applicationHistory'], (result) => {
            const applications = result.applicationHistory || [];
            const totalApps = applications.length;
            const appliedCount = applications.filter(a => a.status === 'Applied').length;
            
            const totalAppsEl = document.getElementById('dashboardTotalApps');
            const appliedEl = document.getElementById('dashboardApplied');
            
            if (totalAppsEl) totalAppsEl.textContent = totalApps;
            if (appliedEl) appliedEl.textContent = appliedCount;
            
            // Load recent applications
            loadDashboardRecentApps(applications);
        });
        
        // Wire up quick action buttons
        setupDashboardActions();
        
        PopupState.unmarkTask();
    } catch (error) {
        console.error('[Popup] Error loading dashboard:', error);
        PopupState.unmarkTask();
    }
}

/**
 * Display recent applications on dashboard
 */
function loadDashboardRecentApps(applications) {
    const container = document.getElementById('dashboardRecentApps');
    if (!container) return;
    
    if (!applications || applications.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #999; padding: 20px 0; font-size: 12px;">
                No applications yet
            </div>
        `;
        return;
    }
    
    // Show last 5 applications
    const recent = applications.slice(-5).reverse();
    const html = recent.map(app => `
        <div style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 11px;">
            <div style="font-weight: 600; color: #333;">${escapeHtml(app.company || 'Unknown')}</div>
            <div style="color: #666; margin: 2px 0;">${escapeHtml(app.jobTitle || 'Unknown Position')}</div>
            <div style="color: #999; font-size: 10px;">
                ${app.timestamp ? new Date(app.timestamp).toLocaleDateString() : 'N/A'}
                ${app.status ? ` • ${app.status}` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

/**
 * Setup dashboard quick action buttons
 */
function setupDashboardActions() {
    const goToResumeBtn = document.getElementById('goToResumeBtn');
    if (goToResumeBtn) {
        goToResumeBtn.addEventListener('click', () => switchTab('resume'));
    }
    
    const goToAutofillBtn = document.getElementById('goToAutofillBtn');
    if (goToAutofillBtn) {
        goToAutofillBtn.addEventListener('click', () => switchTab('autofill'));
    }
    
    const viewApplicationsBtn = document.getElementById('viewApplicationsBtn');
    if (viewApplicationsBtn) {
        viewApplicationsBtn.addEventListener('click', () => switchTab('account'));
    }
}

/**
 * Load Resume Tab
 * Displays job detection, resume upload, and analysis panels
 */
async function loadResumeTab() {
    try {
        PopupState.markTask();
        
        // Ensure panels are initialized and visible
        if (panels && panels.jobDetection) {
            panels.jobDetection.classList.remove('hidden');
        }
        if (panels && panels.resumeUpload) {
            panels.resumeUpload.classList.remove('hidden');
        }
        
        // Load any saved data
        loadDetectedJob();
        loadSavedResume();
        
        // Make sure analysis and optimization panels are hidden initially
        if (panels && panels.analysis) {
            panels.analysis.classList.add('hidden');
        }
        if (panels && panels.optimization) {
            panels.optimization.classList.add('hidden');
        }
        
        PopupState.unmarkTask();
    } catch (error) {
        console.error('[Popup] Error loading resume tab:', error);
        PopupState.unmarkTask();
    }
}

/**
 * Load Account Tab (AI Hub)
 * Displays personal AI answer library
 */
async function loadAccountTab() {
    try {
        PopupState.markTask();
        
        // Load AI answers
        loadAIAnswers();
        
        // Setup AI Hub event listeners
        setupAIHubListeners();
        
        PopupState.unmarkTask();
    } catch (error) {
        console.error('[Popup] Error loading account tab:', error);
        PopupState.unmarkTask();
    }
}

/**
 * Load Settings Tab
 */
async function loadSettingsTab() {
    try {
        PopupState.markTask();
        
        // Load settings
        loadSettings();
        
        // Setup listeners
        setupSettingsListeners();
        
        PopupState.unmarkTask();
    } catch (error) {
        console.error('[Popup] Error loading settings tab:', error);
        PopupState.unmarkTask();
    }
}

/**
 * Load AI Answers from storage
 */
function loadAIAnswers(filter = 'all', searchTerm = '') {
    chrome.storage.local.get(['aiAnswers'], (result) => {
        let answers = result.aiAnswers || [];
        
        // Filter by category
        if (filter !== 'all') {
            answers = answers.filter(a => a.category === filter);
        }
        
        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            answers = answers.filter(a => 
                a.title.toLowerCase().includes(term) ||
                a.text.toLowerCase().includes(term)
            );
        }
        
        displayAIAnswers(answers);
    });
}

/**
 * Display AI Answers
 */
function displayAIAnswers(answers) {
    const container = document.getElementById('aiAnswersList');
    if (!container) return;
    
    if (!answers || answers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #999; padding: 30px 0; font-size: 12px;">
                <p style="margin: 0;">No answers found</p>
                <p style="margin: 4px 0 0 0; font-size: 10px;">Try adjusting your filters or search</p>
            </div>
        `;
        return;
    }
    
    const html = answers.map((answer, index) => `
        <div style="padding: 12px; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; font-size: 12px; margin-bottom: 4px;">${escapeHtml(answer.title)}</div>
                    <div style="font-size: 10px; color: #999;">
                        <span style="display: inline-block; background: #f0f0f0; padding: 2px 8px; border-radius: 12px; margin-right: 4px;">
                            ${getCategoryLabel(answer.category)}
                        </span>
                    </div>
                </div>
                <div style="font-size: 20px;">
                    ${answer.isFavorite ? '⭐' : '☆'}
                </div>
            </div>
            <div style="background: #f9f9f9; padding: 8px; border-radius: 4px; margin-bottom: 8px; max-height: 80px; overflow: hidden; font-size: 11px; color: #555; line-height: 1.4;">
                ${escapeHtml(answer.text)}
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="edit-answer-btn" data-index="${index}" title="Edit" style="padding: 4px 8px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">✏️ Edit</button>
                <button class="copy-answer-btn" data-index="${index}" title="Copy" style="padding: 4px 8px; background: #4caf50; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">📋 Copy</button>
                <button class="regenerate-answer-btn" data-index="${index}" title="Regenerate" style="padding: 4px 8px; background: #2196f3; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">🔄 Regen</button>
                <button class="favorite-answer-btn" data-index="${index}" title="Favorite" style="padding: 4px 8px; background: ${answer.isFavorite ? '#ff9800' : '#ddd'}; color: ${answer.isFavorite ? 'white' : '#333'}; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">⭐ Fav</button>
                <button class="delete-answer-btn" data-index="${index}" title="Delete" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
    
    // Attach event listeners to buttons
    attachAnswerButtonListeners();
}

/**
 * Get category label
 */
function getCategoryLabel(category) {
    const labels = {
        'about-me': 'About Me',
        'company': 'Why Company?',
        'hire-you': 'Hire You?',
        'leadership': 'Leadership',
        'conflict': 'Conflict',
        'achievements': 'Achievements',
        'goals': 'Goals',
        'technical': 'Technical',
        'behavioral': 'Behavioral'
    };
    return labels[category] || category;
}

/**
 * Attach event listeners to answer buttons
 */
function attachAnswerButtonListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-answer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => editAnswer(parseInt(e.target.dataset.index)));
    });
    
    // Copy buttons
    document.querySelectorAll('.copy-answer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => copyAnswer(parseInt(e.target.dataset.index)));
    });
    
    // Regenerate buttons
    document.querySelectorAll('.regenerate-answer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => regenerateAnswer(parseInt(e.target.dataset.index)));
    });
    
    // Favorite buttons
    document.querySelectorAll('.favorite-answer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleFavorite(parseInt(e.target.dataset.index)));
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-answer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteAnswer(parseInt(e.target.dataset.index)));
    });
}

/**
 * Edit Answer
 */
function editAnswer(index) {
    chrome.storage.local.get(['aiAnswers'], (result) => {
        const answers = result.aiAnswers || [];
        const answer = answers[index];
        
        if (!answer) return;
        
        // Populate modal
        document.getElementById('answerCategory').value = answer.category;
        document.getElementById('answerTitle').value = answer.title;
        document.getElementById('answerText').value = answer.text;
        
        // Show modal
        document.getElementById('aiAnswerModal').style.display = 'block';
        
        // Store current edit index
        document.getElementById('aiAnswerModal').dataset.editIndex = index;
    });
}

/**
 * Copy Answer to Clipboard
 */
function copyAnswer(index) {
    chrome.storage.local.get(['aiAnswers'], (result) => {
        const answers = result.aiAnswers || [];
        const answer = answers[index];
        
        if (!answer) return;
        
        navigator.clipboard.writeText(answer.text).then(() => {
            showNotification('✅ Answer copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('Failed to copy', 'error');
        });
    });
}

/**
 * Regenerate Answer using AI
 */
async function regenerateAnswer(index) {
    chrome.storage.local.get(['aiAnswers'], async (result) => {
        const answers = result.aiAnswers || [];
        const answer = answers[index];
        
        if (!answer) return;
        
        showLoading('Regenerating answer with AI...');
        
        try {
            const apiUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                ? CONFIG.API_BASE_URL 
                : 'https://ats-resume-optimizer-359j.onrender.com/api';
            
            const response = await fetch(`${apiUrl}/ai/generate-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: answer.title,
                    category: answer.category,
                    previousAnswer: answer.text
                })
            });
            
            if (!response.ok) throw new Error('Failed to regenerate');
            
            const data = await response.json();
            
            if (data.success && data.answer) {
                // Update answer
                answers[index].text = data.answer;
                chrome.storage.local.set({ aiAnswers: answers }, () => {
                    hideLoading();
                    showNotification('✅ Answer regenerated!', 'success');
                    loadAIAnswers();
                });
            }
        } catch (error) {
            hideLoading();
            showNotification('Failed to regenerate: ' + error.message, 'error');
        }
    });
}

/**
 * Toggle Favorite
 */
function toggleFavorite(index) {
    chrome.storage.local.get(['aiAnswers'], (result) => {
        const answers = result.aiAnswers || [];
        if (answers[index]) {
            answers[index].isFavorite = !answers[index].isFavorite;
            chrome.storage.local.set({ aiAnswers: answers }, () => {
                loadAIAnswers();
            });
        }
    });
}

/**
 * Delete Answer
 */
function deleteAnswer(index) {
    if (!confirm('Are you sure you want to delete this answer?')) return;
    
    chrome.storage.local.get(['aiAnswers'], (result) => {
        const answers = result.aiAnswers || [];
        answers.splice(index, 1);
        chrome.storage.local.set({ aiAnswers: answers }, () => {
            showNotification('✅ Answer deleted', 'success');
            loadAIAnswers();
        });
    });
}

/**
 * Setup AI Hub Event Listeners
 */
function setupAIHubListeners() {
    // Add new answer button
    const addNewAnswerBtn = document.getElementById('addNewAnswerBtn');
    if (addNewAnswerBtn) {
        addNewAnswerBtn.addEventListener('click', () => {
            document.getElementById('aiAnswerModal').style.display = 'block';
            document.getElementById('aiAnswerModal').dataset.editIndex = -1;
            document.getElementById('answerCategory').value = 'about-me';
            document.getElementById('answerTitle').value = '';
            document.getElementById('answerText').value = '';
        });
    }
    
    // Cancel button
    const cancelAnswerBtn = document.getElementById('cancelAnswerBtn');
    if (cancelAnswerBtn) {
        cancelAnswerBtn.addEventListener('click', () => {
            document.getElementById('aiAnswerModal').style.display = 'none';
        });
    }
    
    // Save answer button
    const saveAnswerBtn = document.getElementById('saveAnswerBtn');
    if (saveAnswerBtn) {
        saveAnswerBtn.addEventListener('click', saveAnswer);
    }
    
    // Category filter buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => b.style.background = '#f0f0f0');
            e.target.style.background = '#667eea';
            e.target.style.color = 'white';
            const category = e.target.dataset.category;
            loadAIAnswers(category);
        });
    });
    
    // Search
    const searchInput = document.getElementById('aiHubSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value;
            const activeCategory = document.querySelector('.category-btn[style*="background: rgb(102, 126, 234)"]')?.dataset.category || 'all';
            loadAIAnswers(activeCategory, searchTerm);
        }, 300));
    }
}

/**
 * Save Answer
 */
function saveAnswer() {
    const category = document.getElementById('answerCategory').value;
    const title = document.getElementById('answerTitle').value.trim();
    const text = document.getElementById('answerText').value.trim();
    
    if (!title || !text) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    const editIndex = parseInt(document.getElementById('aiAnswerModal').dataset.editIndex || -1);
    
    chrome.storage.local.get(['aiAnswers'], (result) => {
        let answers = result.aiAnswers || [];
        
        const newAnswer = {
            category,
            title,
            text,
            isFavorite: editIndex !== -1 ? (answers[editIndex]?.isFavorite || false) : false,
            createdAt: editIndex !== -1 ? answers[editIndex].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (editIndex !== -1) {
            answers[editIndex] = newAnswer;
        } else {
            answers.push(newAnswer);
        }
        
        chrome.storage.local.set({ aiAnswers: answers }, () => {
            document.getElementById('aiAnswerModal').style.display = 'none';
            showNotification(editIndex !== -1 ? '✅ Answer updated!' : '✅ Answer saved!', 'success');
            loadAIAnswers();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART Q&A — Scan, Generate, Approve, Fill
// ═══════════════════════════════════════════════════════════════════════════════

/** Current list of detected questions with generated answers */
let qaGeneratedAnswers = [];

/**
 * Build a SmartAnswerEngine-compatible profile object from stored autofill profile.
 */
function buildQAProfile(storedProfile) {
    return {
        firstName:       storedProfile.first_name       || storedProfile.full_name?.split(' ')[0] || '',
        currentTitle:    storedProfile.current_title    || '',
        noticePeriod:    storedProfile.notice_period    || '',
        expectedCTC:     storedProfile.expected_salary  || '',
        workMode:        storedProfile.work_environment || 'flexible',
        keyStrength:     storedProfile.key_strength     || '',
        whyInterested:   storedProfile.why_interested   || storedProfile.answer_why_company || ''
    };
}

/**
 * Render a confidence badge (colour-coded).
 */
function confidenceBadge(score) {
    const isHigh = score >= 80;
    const isMedium = score >= 60 && score < 80;
    const colorBg = isHigh ? 'var(--color-secondary-container)' : isMedium ? 'var(--color-tertiary-container)' : 'var(--color-error-container)';
    const colorText = isHigh ? 'var(--color-on-secondary-container)' : isMedium ? 'var(--color-on-tertiary-container)' : 'var(--color-on-error-container)';
    const colorBorder = isHigh ? 'var(--color-secondary)' : isMedium ? 'var(--color-tertiary)' : 'var(--color-error)';
    const label = isHigh ? 'High' : isMedium ? 'Medium' : 'Low';
    
    return `<span style="
        background: ${colorBg}; color: ${colorText}; border: 1px solid ${colorBorder};
        border-radius: var(--radius-organic); font-family: var(--font-label); font-size: 9px; font-weight: 600; padding: 2px 8px;
        display: inline-block; letter-spacing: 0.03em;
    ">${score}% · ${label}</span>`;
}

/**
 * Render all Q&A cards into #qaCardsContainer.
 */
function renderQACards(results) {
    const container = document.getElementById('qaCardsContainer');
    const emptyState = document.getElementById('qaEmptyState');
    const actionsBar = document.getElementById('qaActionsBar');
    const fillCount = document.getElementById('qaFillCount');

    if (!results || results.length === 0) {
        emptyState.style.display = 'block';
        container.style.display = 'none';
        actionsBar.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    container.style.display = 'block';
    actionsBar.style.display = 'block';
    fillCount.textContent = `${results.length} question${results.length > 1 ? 's' : ''} detected — approve the ones you want to fill`;

    container.innerHTML = results.map((item, idx) => `
        <div id="qa-card-${idx}" style="
            background: var(--color-surface); border: 1px solid var(--color-pencil-grey); border-radius: var(--radius-organic);
            padding: 16px; margin-bottom: 12px; transition: border-color 0.2s;
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
                <p style="font-family: var(--font-heading); font-size: 14px; font-weight: 500; color: var(--color-on-surface); margin: 0; flex: 1; line-height: 1.4;">
                    ${escapeHtml(item.question.length > 120 ? item.question.substring(0, 117) + '...' : item.question)}
                </p>
                ${confidenceBadge(item.confidence)}
            </div>

            <textarea
                id="qa-answer-${idx}"
                style="
                    width: 100%; box-sizing: border-box; border: 1px solid var(--color-pencil-grey);
                    border-radius: var(--radius-organic); padding: 12px; font-size: 14px; line-height: 1.5;
                    color: var(--color-on-surface); resize: vertical; min-height: 80px; max-height: 160px;
                    font-family: var(--font-body); background: transparent; border-bottom: 1.5px solid var(--color-pencil-grey);
                "
            >${escapeHtml(item.answer)}</textarea>

            <div style="display: flex; gap: 8px; margin-top: 12px; align-items: center;">
                <button
                    id="qa-approve-${idx}"
                    onclick="toggleQAApproval(${idx})"
                    style="
                        padding: 6px 12px; border-radius: var(--radius-organic); font-family: var(--font-label); font-size: 11px; cursor: pointer;
                        border: 1px solid var(--color-secondary); background: var(--color-secondary); color: var(--color-on-secondary);
                        font-weight: 600; transition: all 0.15s; letter-spacing: 0.05em; text-transform: uppercase;
                    "
                    data-approved="true"
                >✅ Approved</button>

                <button
                    onclick="regenerateQAAnswer(${idx})"
                    style="
                        padding: 6px 12px; border-radius: var(--radius-organic); font-family: var(--font-label); font-size: 11px; cursor: pointer;
                        border: 1px solid var(--color-pencil-grey); background: transparent; color: var(--color-on-surface-variant);
                        font-weight: 600; transition: all 0.15s; letter-spacing: 0.05em; text-transform: uppercase;
                    "
                >🔄 Regenerate</button>

                <span style="font-family: var(--font-label); font-size: 10px; color: var(--color-on-surface-variant); margin-left: auto;">
                    ${(item.answer.split(/\s+/).filter(Boolean).length)} words
                </span>
            </div>
        </div>
    `).join('');

    // Store results globally
    qaGeneratedAnswers = results;
}

function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Toggle approved/skipped state for a card.
 */
window.toggleQAApproval = function(idx) {
    const btn = document.getElementById(`qa-approve-${idx}`);
    if (!btn) return;
    const isApproved = btn.dataset.approved === 'true';
    if (isApproved) {
        btn.dataset.approved = 'false';
        btn.textContent = '⬜ Skipped';
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-on-surface-variant)';
        btn.style.borderColor = 'var(--color-pencil-grey)';
    } else {
        btn.dataset.approved = 'true';
        btn.textContent = '✅ Approved';
        btn.style.background = 'var(--color-secondary)';
        btn.style.color = 'var(--color-on-secondary)';
        btn.style.borderColor = 'var(--color-secondary)';
    }
};

/**
 * Regenerate the answer for a single card using fresh data.
 */
window.regenerateQAAnswer = function(idx) {
    const item = qaGeneratedAnswers[idx];
    if (!item) return;
    chrome.storage.local.get(['autofillProfile', 'parsedResume'], (data) => {
        const profile = buildQAProfile(data.autofillProfile || {});
        const resumeData = data.parsedResume || {};
        const result = SmartAnswerEngine.generate(item.question, resumeData, profile);
        const ta = document.getElementById(`qa-answer-${idx}`);
        if (ta) {
            ta.value = result.answer;
            qaGeneratedAnswers[idx].answer = result.answer;
        }
    });
};

/**
 * Scan the current tab for application questions and generate answers.
 */
async function scanQuestionsFromPage() {
    const btn       = document.getElementById('scanQuestionsBtn');
    const statusEl  = document.getElementById('qaStatus');
    const container = document.getElementById('qaCardsContainer');
    const emptyState = document.getElementById('qaEmptyState');
    const actionsBar = document.getElementById('qaActionsBar');

    // Reset
    container.style.display = 'none';
    actionsBar.style.display = 'none';
    emptyState.style.display = 'none';
    statusEl.style.display = 'block';
    statusEl.style.background = '#eff6ff';
    statusEl.style.color = '#1d4ed8';
    statusEl.style.border = '1px solid #bfdbfe';
    statusEl.textContent = '🔍 Scanning page for questions...';
    btn.disabled = true;
    btn.textContent = '⏳ Scanning...';

    try {
        // Get active tab
        const [tab] = await new Promise(resolve =>
            chrome.tabs.query({ active: true, currentWindow: true }, resolve)
        );

        if (!tab) throw new Error('No active tab found');

        // Send message to content script
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { type: 'DETECT_QUESTIONS' }, (res) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(res);
                }
            });
        });

        if (!response || !response.success) {
            throw new Error(response?.message || 'Failed to detect questions');
        }

        const questions = response.questions || [];

        if (questions.length === 0) {
            statusEl.style.background = '#fff7ed';
            statusEl.style.color = '#92400e';
            statusEl.style.border = '1px solid #fed7aa';
            statusEl.textContent = '⚠️ No open-ended questions found on this page. Try navigating to an application form.';
            emptyState.style.display = 'block';
            return;
        }

        statusEl.textContent = `⚙️ Generating answers for ${questions.length} question${questions.length > 1 ? 's' : ''}...`;

        // Load resume data + profile from storage
        const stored = await new Promise(resolve =>
            chrome.storage.local.get(['autofillProfile', 'parsedResume'], resolve)
        );

        const profile    = buildQAProfile(stored.autofillProfile || {});
        const resumeData = stored.parsedResume || {};

        // Generate answers via SmartAnswerEngine
        const results = SmartAnswerEngine.generateAll(questions, resumeData, profile);

        statusEl.style.background = '#f0fdf4';
        statusEl.style.color = '#166534';
        statusEl.style.border = '1px solid #bbf7d0';
        statusEl.textContent = `✅ ${results.length} answer${results.length > 1 ? 's' : ''} generated — review and approve below`;

        renderQACards(results);

    } catch (err) {
        console.error('[QA] Scan error:', err);
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#991b1b';
        statusEl.style.border = '1px solid #fecaca';
        if (err.message.includes('Could not establish connection') || err.message.includes('No tab')) {
            statusEl.textContent = '⚠️ Could not reach the page. Make sure you are on a job application page (not a chrome:// URL).';
        } else {
            statusEl.textContent = '❌ Error: ' + err.message;
        }
        emptyState.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Scan Page for Questions';
    }
}

/**
 * Fill all approved answers into the page fields.
 */
async function fillApprovedAnswers() {
    const btn = document.getElementById('fillApprovedBtn');
    const statusEl = document.getElementById('qaStatus');

    btn.disabled = true;
    btn.textContent = '⏳ Filling...';
    statusEl.style.display = 'block';
    statusEl.style.background = '#eff6ff';
    statusEl.style.color = '#1d4ed8';
    statusEl.style.border = '1px solid #bfdbfe';
    statusEl.textContent = '✍️ Filling approved answers into the page...';

    try {
        // Collect approved answers (check button state + get current textarea value)
        const approved = qaGeneratedAnswers
            .map((item, idx) => {
                const approveBtn = document.getElementById(`qa-approve-${idx}`);
                const textarea   = document.getElementById(`qa-answer-${idx}`);
                const isApproved = approveBtn?.dataset.approved === 'true';
                return isApproved ? { fieldIndex: item.fieldIndex, answer: textarea?.value || item.answer } : null;
            })
            .filter(Boolean);

        if (approved.length === 0) {
            statusEl.style.background = '#fff7ed';
            statusEl.style.color = '#92400e';
            statusEl.style.border = '1px solid #fed7aa';
            statusEl.textContent = '⚠️ No approved answers. Click ✅ Approved on the answers you want to fill.';
            return;
        }

        const [tab] = await new Promise(resolve =>
            chrome.tabs.query({ active: true, currentWindow: true }, resolve)
        );

        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { type: 'FILL_ANSWERS', answers: approved }, (res) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(res);
            });
        });

        if (response?.success) {
            statusEl.style.background = '#f0fdf4';
            statusEl.style.color = '#166534';
            statusEl.style.border = '1px solid #bbf7d0';
            statusEl.textContent = `🎉 Successfully filled ${response.filled} answer${response.filled !== 1 ? 's' : ''} on the page!`;
        } else {
            throw new Error(response?.message || 'Fill failed');
        }
    } catch (err) {
        console.error('[QA] Fill error:', err);
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#991b1b';
        statusEl.style.border = '1px solid #fecaca';
        statusEl.textContent = '❌ Error filling answers: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Fill Approved Answers';
    }
}

/**
 * Wire up the Q&A tab buttons once DOM is ready.
 */
function initQATab() {
    const scanBtn   = document.getElementById('scanQuestionsBtn');
    const fillBtn   = document.getElementById('fillApprovedBtn');
    const rescanBtn = document.getElementById('rescanBtn');

    if (scanBtn)   scanBtn.addEventListener('click',   scanQuestionsFromPage);
    if (fillBtn)   fillBtn.addEventListener('click',   fillApprovedAnswers);
    if (rescanBtn) rescanBtn.addEventListener('click', scanQuestionsFromPage);

    console.log('[QA] Smart Q&A tab initialized');
}

// Initialize Q&A tab when popup loads
document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to let other init code run first
    setTimeout(initQATab, 300);
});
