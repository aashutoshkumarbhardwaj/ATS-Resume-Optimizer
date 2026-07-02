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
            console.warn('[Popup] Missing critical DOM elements:', missing);
            throw new Error(`Missing DOM elements: ${missing.join(', ')}`);
        }
    } catch (error) {
        console.error('[Popup] Failed to initialize DOM elements:', error);
        throw error;
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
        
        // Fast initialization - only load what's needed
        setupEventListeners();
        
        // CRITICAL: Verify token with backend FIRST
        console.log('[Popup] 🔐 Step 1: Verifying authentication...');
        const authResult = await TokenVerifier.fullVerification();
        
        if (authResult.authenticated) {
            console.log('[Popup] ✅ User authenticated:', authResult.user?.email);
            showJobOrbitConnected(authResult.user?.email || 'Connected');
            
            // CRITICAL: Sync profile from Job Orbit
            console.log('[Popup] 📥 Step 2: Syncing profile from Job Orbit...');
            const token = await TokenVerifier.getStoredToken();
            if (token) {
                const syncResult = await ProfileSyncManager.syncOnLogin(token);
                if (syncResult.success) {
                    console.log('[Popup] ✅ Profile synced successfully');
                    if (syncResult.isNew) {
                        console.log('[Popup] ℹ️ First login - empty profile');
                    } else {
                        console.log('[Popup] ✅ Profile populated with', Object.keys(syncResult.profile || {}).length, 'fields');
                    }
                } else {
                    console.warn('[Popup] ⚠️ Profile sync failed:', syncResult.error);
                }

                // CRITICAL: Full data sync (resumes, applications, answers)
                console.log('[Popup] 📥 Step 3: Syncing all data from Job Orbit...');
                const dataSyncResult = await DataSyncManager.fullSync(token);
                if (dataSyncResult.success) {
                    console.log('[Popup] ✅ Full data sync completed');
                    if (dataSyncResult.errors.length > 0) {
                        console.warn('[Popup] ⚠️ Some data sync errors:', dataSyncResult.errors);
                    }
                } else {
                    console.warn('[Popup] ⚠️ Full data sync failed:', dataSyncResult.error);
                }
            }
            
            // Show dashboard with user info
            loadDashboard();
            
            // Check if token is stale and needs refresh
            if (authResult.isStale) {
                console.log('[Popup] ⚠️ Token is stale (expiring soon), will refresh on next action');
            }
        } else {
            console.log('[Popup] ❌ User not authenticated:', authResult.reason);
            showJobOrbitNotConnected();
            
            // Show guest mode dashboard
            showGuestMode();
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
        showError('Failed to initialize popup: ' + error.message);
    } finally {
        PopupState.unmarkTask();
    }
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
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // File upload - with null checks
    if (elements.uploadArea && elements.resumeFile && elements.removeFile) {
        elements.uploadArea.addEventListener('click', () => elements.resumeFile.click());
        elements.resumeFile.addEventListener('change', handleFileUpload);
        elements.removeFile.addEventListener('click', removeUploadedFile);
        
        // Drag and drop
        elements.uploadArea.addEventListener('dragover', handleDragOver);
        elements.uploadArea.addEventListener('dragleave', handleDragLeave);
        elements.uploadArea.addEventListener('drop', handleDrop);
    }
    
    // Buttons - with null checks
    if (elements.analyzeBtn) {
        elements.analyzeBtn.addEventListener('click', handleAnalyze);
    }
    if (elements.optimizeBtn) {
        elements.optimizeBtn.addEventListener('click', handleOptimize);
    }
    
    // Fetch job description button
    const fetchJobDescBtn = document.getElementById('fetchJobDescBtn');
    if (fetchJobDescBtn) {
        fetchJobDescBtn.addEventListener('click', handleFetchJobDescription);
    }
    
    // Download buttons
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => handleDownload(btn.dataset.format));
    });
    
    // Copy optimized text button
    const copyOptimizedBtn = document.getElementById('copyOptimizedBtn');
    if (copyOptimizedBtn) {
        copyOptimizedBtn.addEventListener('click', handleCopyOptimized);
    }

    // Autofill event listeners
    const addCustomFieldBtn = document.getElementById('addCustomFieldBtn');
    if (addCustomFieldBtn) {
        addCustomFieldBtn.addEventListener('click', () => addCustomFieldRow());
    }
    
    const autofillForm = document.getElementById('autofillForm');
    if (autofillForm) {
        autofillForm.addEventListener('submit', handleSaveProfile);
    }
    
    const autofillActiveTabBtn = document.getElementById('autofillActiveTabBtn');
    if (autofillActiveTabBtn) {
        autofillActiveTabBtn.addEventListener('click', handleAutofillTab);
    }

    // Show autofill button again
    const showAutofillButtonBtn = document.getElementById('showAutofillButtonBtn');
    if (showAutofillButtonBtn) {
        showAutofillButtonBtn.addEventListener('click', handleShowAutofillButton);
    }

    // Dismiss autofill notice
    const dismissAutofillNoticeBtn = document.getElementById('dismissAutofillNoticeBtn');
    if (dismissAutofillNoticeBtn) {
        dismissAutofillNoticeBtn.addEventListener('click', handleDismissAutofillNotice);
    }
    
    // Settings listeners
    setupSettingsListeners();
    
    // Listen for storage changes to update UI in real-time
    if (chrome && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes.jobOrbitAuth) {
                console.log('[Popup] Job Orbit auth changed, updating UI');
                checkJobOrbitConnection();
            }
        });
    }
}

/**
 * Tab Switching
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    Object.keys(tabs).forEach(key => {
        if (tabs[key]) {
            tabs[key].classList.toggle('active', key === tabName);
        }
    });
    
    // Load content based on tab
    if (tabName === 'home') {
        loadDashboard();
    }
    
    if (tabName === 'resume') {
        loadResumeTab();
    }
    
    if (tabName === 'account') {
        loadAccountTab();
    }
    
    if (tabName === 'ai') {
        loadSettingsTab();
    }
    
    PopupState.activeTab = tabName;
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
    elements.atsScore.textContent = data.atsScore || 0;
    
    // Score breakdown
    if (data.breakdown) {
        elements.keywordBar.style.width = `${(data.breakdown.keywordMatch * 100)}%`;
        elements.experienceBar.style.width = `${(data.breakdown.experienceRelevance * 100)}%`;
        elements.skillsBar.style.width = `${(data.breakdown.skillsAlignment * 100)}%`;
    }
    
    // Matched keywords
    elements.matchedKeywords.innerHTML = '';
    if (data.matchedKeywords && data.matchedKeywords.length > 0) {
        data.matchedKeywords.slice(0, 10).forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag matched';
            tag.textContent = keyword;
            elements.matchedKeywords.appendChild(tag);
        });
    } else {
        elements.matchedKeywords.innerHTML = '<span style="color: #999; font-size: 11px;">None</span>';
    }
    
    // Missing keywords
    elements.missingKeywords.innerHTML = '';
    if (data.missingKeywords && data.missingKeywords.length > 0) {
        data.missingKeywords.slice(0, 10).forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag missing';
            tag.textContent = keyword;
            elements.missingKeywords.appendChild(tag);
        });
    } else {
        elements.missingKeywords.innerHTML = '<span style="color: #999; font-size: 11px;">None</span>';
    }
    
    // Suggestions
    elements.suggestionsList.innerHTML = '';
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
    elements.originalScore.textContent = data.originalScore || 0;
    elements.optimizedScore.textContent = data.optimizedScore || 0;
    
    const improvement = (data.optimizedScore || 0) - (data.originalScore || 0);
    elements.scoreImprovement.textContent = improvement > 0 ? `+${improvement}` : improvement;
    elements.scoreImprovement.style.background = improvement > 0 ? '#4caf50' : '#999';
    
    // Update resume text area with optimized version
    if (data.optimizedText) {
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
    elements.changesList.innerHTML = '';
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
    elements.historyList.innerHTML = '';
    
    if (!history || history.length === 0) {
        elements.historyList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No optimization history yet</p>';
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
    if (elements.loadingSpinner) {
        elements.loadingSpinner.classList.remove('hidden');
    }
    if (elements.loadingText && message) {
        elements.loadingText.textContent = message;
    }
    console.log('[Popup] Loading:', message);
}

/**
 * Hide Loading
 */
function hideLoading() {
    elements.loadingSpinner.classList.add('hidden');
}

/**
 * Show Error
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

/**
 * Hide Error
 */
function hideError() {
    elements.errorMessage.classList.add('hidden');
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
            
            // Preferences
            const workEnvEl = document.getElementById('work_environment');
            if (workEnvEl) workEnvEl.value = p.work_environment || '';
            
            const locationEl = document.getElementById('preferred_location');
            if (locationEl) locationEl.value = p.preferred_location || '';
            
            const authEl = document.getElementById('work_authorization');
            if (authEl) authEl.value = p.work_authorization || '';
            
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
            document.getElementById('country').value = p.country || '';
            
            // Professional fields
            document.getElementById('current_title').value = p.current_title || '';
            if (document.getElementById('current_company')) document.getElementById('current_company').value = p.current_company || '';
            document.getElementById('years_of_experience').value = p.years_of_experience || '';
            if (document.getElementById('notice_period')) document.getElementById('notice_period').value = p.notice_period || '';
            if (document.getElementById('expected_salary')) document.getElementById('expected_salary').value = p.expected_salary || '';
            
            // Links
            document.getElementById('linkedin').value = p.linkedin || '';
            document.getElementById('github').value = p.github || '';
            document.getElementById('portfolio').value = p.portfolio || '';
            
            // Resume & Skills
            if (document.getElementById('default_resume')) document.getElementById('default_resume').value = p.default_resume || '';
            if (document.getElementById('skills')) document.getElementById('skills').value = p.skills || '';
            
            // Pre-filled Answers
            if (document.getElementById('answer_about_you')) document.getElementById('answer_about_you').value = p.answer_about_you || '';
            if (document.getElementById('answer_why_company')) document.getElementById('answer_why_company').value = p.answer_why_company || '';
            if (document.getElementById('answer_hire_you')) document.getElementById('answer_hire_you').value = p.answer_hire_you || '';
            
            // Job Preferences
            if (document.getElementById('work_environment')) document.getElementById('work_environment').value = p.work_environment || '';
            if (document.getElementById('preferred_location')) document.getElementById('preferred_location').value = p.preferred_location || '';
            if (document.getElementById('work_authorization')) document.getElementById('work_authorization').value = p.work_authorization || '';

            console.log('[Popup] Autofill profile loaded:', p);

            // Load custom fields
            const container = document.getElementById('customFieldsContainer');
            container.innerHTML = '';
            if (p.custom_fields && Array.isArray(p.custom_fields)) {
                p.custom_fields.forEach(field => {
                    addCustomFieldRow(field.key, field.value);
                });
            }
        }

        // Load settings
        const settingsResult = await StorageUtil.getSettings();
        if (settingsResult.success && settingsResult.settings) {
            document.getElementById('settingShowBadge').checked = 
                settingsResult.settings.showAutofillBadge !== false;
        }
    } catch (error) {
        console.error('[Popup] Error loading autofill profile:', error);
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
            
            // Job Preferences
            work_environment: document.getElementById('work_environment')?.value || '',
            preferred_location: document.getElementById('preferred_location')?.value.trim() || '',
            work_authorization: document.getElementById('work_authorization')?.value.trim() || '',
            
            custom_fields: customFields
        };

        console.log('[Popup] 💾 Saving profile with', Object.keys(profileData).length, 'fields');

        // Save profile (to both sync and local)
        const saveResult = await StorageUtil.saveAutofillProfile(profileData);

        if (saveResult.success) {
            console.log('[Popup] ✅ Profile saved to', saveResult.stored);
            
            // Verify it was actually saved
            const verification = await StorageUtil.verifyProfileExists();
            console.log('[Popup] Verification result:', verification);
            
            if (verification.anyExists) {
                hideLoading();
                showNotification('✅ Profile saved successfully! Data synced to both storages.', 'success');
                messageEl.innerHTML = '✅ Profile saved successfully!';
                messageEl.className = 'autofill-status-message success';
                
                // Also sync to backend if authenticated
                const token = await TokenVerifier.getStoredToken();
                if (token) {
                    console.log('[Popup] 📤 Syncing profile to backend...');
                    const syncResult = await ProfileSyncManager.uploadProfile(token, profileData);
                    if (syncResult.success) {
                        console.log('[Popup] ✅ Profile synced to backend');
                        showNotification('✅ Profile synced to Job Orbit!', 'success');
                    } else {
                        console.warn('[Popup] ⚠️ Backend sync failed (will retry later):', syncResult.error);
                    }
                }
                
                // Hide message after 3 seconds
                setTimeout(() => {
                    messageEl.className = 'autofill-status-message hidden';
                }, 3000);
            } else {
                throw new Error('Profile save verification failed - data may not have persisted');
            }
        } else {
            throw new Error('Failed to save profile');
        }
    } catch (error) {
        console.error('[Popup] Error saving profile:', error);
        hideLoading();
        showNotification('❌ Error saving profile: ' + error.message, 'error');
        messageEl.innerHTML = '❌ ' + error.message;
        messageEl.className = 'autofill-status-message error';
    }
}
        
        // Save settings
        const settingsResult = await StorageUtil.getSettings();
        let currentSettings = {};
        if (settingsResult.success) {
            currentSettings = settingsResult.settings;
        }
        currentSettings.showAutofillBadge = document.getElementById('settingShowBadge').checked;
        await StorageUtil.saveSettings(currentSettings);

        if (saveResult.success) {
            showAutofillStatus('Profile saved successfully! ✨', 'success');
            
            // Sync to backend if user is authenticated
            const token = await TokenVerifier.getStoredToken();
            if (token) {
                console.log('[Popup] 📤 Syncing profile to backend...');
                const syncResult = await ProfileSyncManager.uploadProfile(token, profileData);
                if (syncResult.success) {
                    console.log('[Popup] ✅ Profile synced to backend');
                } else {
                    console.warn('[Popup] ⚠️ Backend sync failed (profile saved locally):', syncResult.error);
                }
            }
            
            // Notify content script of settings update so it can add/remove the badge in real-time
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        type: 'SETTINGS_UPDATED',
                        settings: currentSettings
                    }, () => {
                        // Ignore response, tab might not be a job site or loaded
                    });
                }
            });
        } else {
            showAutofillStatus('Failed to save profile: ' + saveResult.error, 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showAutofillStatus('Error: ' + error.message, 'error');
    }
}

function showAutofillStatus(text, type) {
    const messageEl = document.getElementById('autofillMessage');
    messageEl.textContent = text;
    messageEl.className = `autofill-status-message ${type}`;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 3000);
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
function checkJobOrbitConnection() {
    console.log('[Popup] 🔍 Checking Job Orbit connection...');
    
    // Check SYNC storage first (primary)
    chrome.storage.sync.get(['jobOrbitAuth'], (syncResult) => {
        const syncAuth = syncResult.jobOrbitAuth;
        console.log('[Popup] Sync storage:', syncAuth ? '✅ Token found' : '❌ No token');
        
        if (syncAuth && syncAuth.extensionToken) {
            console.log('[Popup] 📋 Token details:', {
                token: syncAuth.extensionToken.substring(0, 20) + '...',
                expiresAt: syncAuth.expiresAt ? new Date(syncAuth.expiresAt).toISOString() : 'N/A',
                user: syncAuth.user?.email,
                receivedAt: syncAuth.receivedAt
            });
        }
        
        // Check LOCAL storage as backup
        chrome.storage.local.get(['jobOrbitAuth'], (localResult) => {
            const localAuth = localResult.jobOrbitAuth;
            console.log('[Popup] Local storage:', localAuth ? '✅ Token found' : '❌ No token');
            
            // Use whichever is more recent
            const auth = syncAuth || localAuth;
            
            if (!auth) {
                console.log('[Popup] ❌ No token in either storage');
                showJobOrbitNotConnected();
                return;
            }
            
            if (!auth.extensionToken) {
                console.error('[Popup] ❌ Token object missing extensionToken');
                showJobOrbitNotConnected();
                return;
            }
            
            // Check if token is expired
            const now = Date.now();
            const expiresAt = auth.expiresAt || (now + 86400000); // Default to 24h if not set
            
            console.log('[Popup] ⏰ Token expiry check:', {
                now: new Date(now).toISOString(),
                expiresAt: new Date(expiresAt).toISOString(),
                expiresInMs: expiresAt - now,
                expiresInMinutes: Math.round((expiresAt - now) / 60000)
            });
            
            if (now > expiresAt) {
                console.log('[Popup] ❌ Token expired, clearing auth');
                chrome.storage.sync.remove(['jobOrbitAuth']);
                chrome.storage.local.remove(['jobOrbitAuth']);
                showJobOrbitNotConnected();
                return;
            }
            
            // Token valid
            console.log('[Popup] ✅ Token valid, showing connected state');
            showJobOrbitConnected(auth.user?.email || 'Connected');
            
            // Check if token is expiring soon (within 1 hour) for proactive refresh
            const timeToExpiry = expiresAt - now;
            const oneHourInMs = 60 * 60 * 1000;
            
            if (timeToExpiry < oneHourInMs && timeToExpiry > 0) {
                console.log('[Popup] ⚠️ Token expiring in', Math.round(timeToExpiry / 60000), 'minutes');
            }
        });
    });
}

/**
 * Show Job Orbit Connected UI
 */
function showJobOrbitConnected(email) {
    const notConnected = document.getElementById('jobOrbitNotConnected');
    const connected = document.getElementById('jobOrbitConnected');
    const userEmail = document.getElementById('jobOrbitUserEmail');
    
    if (notConnected) notConnected.style.display = 'none';
    if (connected) {
        connected.style.display = 'block';
        // Update timestamp
        const syncStatusEl = connected.querySelector('[id="jobOrbitSyncStatus"]');
        if (syncStatusEl) {
            const now = new Date();
            syncStatusEl.textContent = `Last synced: ${now.toLocaleTimeString()}`;
        }
    }
    if (userEmail) userEmail.textContent = email || 'Connected';
    
    console.log('[Popup] Showing connected state for:', email);
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
 */
function handleJobOrbitAuthResponse(authData, tabId) {
    console.log('[Popup] 📥 Processing auth response:', authData);
    
    if (!authData || !authData.extensionToken) {
        console.error('[Popup] ❌ Authentication failed: No token received');
        showNotification('Authentication failed: No token received', 'error');
        return;
    }
    
    try {
        // Calculate expiration time
        const expiresIn = authData.expiresIn || 86400; // Default 24 hours
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        console.log('[Popup] ⏰ Token expiry:', {
            expiresIn: expiresIn,
            expiresAt: new Date(expiresAt).toISOString()
        });
        
        // Prepare auth object
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
        
        console.log('[Popup] 💾 Storing auth object...');
        console.log('[Popup] Token preview:', jobOrbitAuth.extensionToken.substring(0, 30) + '...');
        console.log('[Popup] User:', jobOrbitAuth.user?.email);
        
        // Store in SYNC storage (primary - syncs across Chrome profile)
        chrome.storage.sync.set({ jobOrbitAuth }, () => {
            if (chrome.runtime.lastError) {
                console.error('[Popup] ❌ Sync storage failed:', chrome.runtime.lastError);
                showNotification('Failed to save authentication (sync): ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            console.log('[Popup] ✅ Stored in chrome.storage.sync');
            
            // Also store in LOCAL storage as backup
            chrome.storage.local.set({ jobOrbitAuth }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[Popup] ⚠️ Local storage failed:', chrome.runtime.lastError);
                } else {
                    console.log('[Popup] ✅ Stored in chrome.storage.local');
                }
            });
            
            // Verify storage by reading back immediately
            setTimeout(() => {
                chrome.storage.sync.get(['jobOrbitAuth'], (result) => {
                    if (result.jobOrbitAuth && result.jobOrbitAuth.extensionToken) {
                        console.log('[Popup] ✅ Verification: Token successfully stored and retrieved');
                    } else {
                        console.error('[Popup] ❌ Verification failed: Could not retrieve stored token');
                    }
                });
            }, 100);
            
            showNotification('✅ Connected to Job Orbit!', 'success');
            showJobOrbitConnected(authData.user?.email || 'Connected');
            
            console.log('[Popup] 🔄 Auth tab will close in 1 second...');
            // Close the auth tab after a short delay
            setTimeout(() => {
                chrome.tabs.remove(tabId);
                console.log('[Popup] ✅ Auth tab closed');
                // Refresh the settings UI immediately
                checkJobOrbitConnection();
            }, 1000);
        });
    } catch (error) {
        console.error('[Popup] ❌ Error processing auth response:', error);
        showNotification('Failed to save authentication: ' + error.message, 'error');
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
function handleJobOrbitLogout() {
    chrome.storage.sync.remove(['jobOrbitAuth'], () => {
        showNotification('✅ Logged out from Job Orbit', 'success');
        showJobOrbitNotConnected();
    });
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
