/**
 * Popup Script - Fixed Version
 * Main UI logic for the extension popup
 * Fixed: Auto-close, focus management, performance optimization
 */

// Configuration
const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';

// Popup state management
const PopupState = {
    isOpen: true,
    activeTab: 'optimize',
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
            optimize: document.getElementById('optimizeTab'),
            history: document.getElementById('historyTab'),
            autofill: document.getElementById('autofillTab')
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
        
        // Fast initialization - only load what's needed
        setupEventListeners();
        
        // Defer non-critical loading
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                loadSavedResume();
                loadDetectedJob();
                loadAutofillProfile();
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                loadSavedResume();
                loadDetectedJob();
                loadAutofillProfile();
            }, 100);
        }
        
        // Load history only when tab is active
        setupLazyTabLoading();
        
        PopupState.initialized = true;
        console.log('[Popup] Initialized');
    } catch (error) {
        console.error('[Popup] Initialization error:', error);
        showError('Failed to initialize popup');
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
    
    // File upload
    elements.uploadArea.addEventListener('click', () => elements.resumeFile.click());
    elements.resumeFile.addEventListener('change', handleFileUpload);
    elements.removeFile.addEventListener('click', removeUploadedFile);
    
    // Drag and drop
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    
    // Buttons
    elements.analyzeBtn.addEventListener('click', handleAnalyze);
    elements.optimizeBtn.addEventListener('click', handleOptimize);
    elements.clearHistoryBtn.addEventListener('click', handleClearHistory);
    
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
        tabs[key].classList.toggle('active', key === tabName);
    });
    
    // Load history if switching to history tab
    if (tabName === 'history') {
        loadHistory();
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
        }, (response) => {
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
                    
                    console.log('[Popup] Resume uploaded and saved successfully');
                    
                    // Parse resume details in background
                    chrome.runtime.sendMessage({
                        type: 'PARSE_RESUME',
                        payload: { resumeText: data.extractedText }
                    }, (parseResponse) => {
                        try {
                            if (parseResponse && parseResponse.success) {
                                const parsed = parseResponse.data;
                                const c = parsed.contact || {};
                                
                                // Fill inputs in the Autofill tab
                                const formFields = {
                                    'full_name': c.name || '',
                                    'first_name': c.first_name || '',
                                    'last_name': c.last_name || '',
                                    'email': c.email || '',
                                    'phone': c.phone || '',
                                    'city': c.city || '',
                                    'country': c.country || '',
                                    'linkedin': c.linkedin || '',
                                    'github': c.github || '',
                                    'portfolio': c.portfolio || '',
                                    'current_title': parsed.current_title || '',
                                    'years_of_experience': parsed.years_of_experience || ''
                                };
                                
                                // Set all fields
                                Object.entries(formFields).forEach(([fieldId, value]) => {
                                    const field = document.getElementById(fieldId);
                                    if (field) {
                                        field.value = value;
                                    }
                                });
                                
                                // Save profile to storage
                                chrome.storage.local.set({ profile: formFields });
                                
                                console.log('[Popup] Profile parsed and saved from resume');
                                
                                // Show success notification
                                showNotification('✅ Profile populated from resume!', 'success');
                            } else {
                                console.warn('[Popup] Parse response error:', parseResponse?.error);
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
        
        const response = await fetch(`${API_BASE_URL}/analysis/analyze`, {
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
        const response = await fetch(`${API_BASE_URL}/analysis/optimize`, {
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
        const response = await fetch(`${API_BASE_URL}/documents/generate`, {
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
 * Show Loading
 */
function showLoading(message = 'Processing...') {
    elements.loadingText.textContent = message;
    elements.loadingSpinner.classList.remove('hidden');
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
        
        const result = await StorageUtil.getAutofillProfile();
        if (result.success && result.profile) {
            const p = result.profile;
            document.getElementById('full_name').value = p.full_name || '';
            document.getElementById('first_name').value = p.first_name || '';
            document.getElementById('last_name').value = p.last_name || '';
            document.getElementById('email').value = p.email || '';
            document.getElementById('phone').value = p.phone || '';
            document.getElementById('city').value = p.city || '';
            document.getElementById('country').value = p.country || '';
            document.getElementById('linkedin').value = p.linkedin || '';
            document.getElementById('github').value = p.github || '';
            document.getElementById('portfolio').value = p.portfolio || '';
            document.getElementById('current_title').value = p.current_title || '';
            document.getElementById('years_of_experience').value = p.years_of_experience || '';

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
 */
async function handleSaveProfile(e) {
    if (e) e.preventDefault();
    
    const messageEl = document.getElementById('autofillMessage');
    messageEl.className = 'autofill-status-message hidden';
    
    try {
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
            full_name: document.getElementById('full_name').value.trim(),
            first_name: document.getElementById('first_name').value.trim(),
            last_name: document.getElementById('last_name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            city: document.getElementById('city').value.trim(),
            country: document.getElementById('country').value.trim(),
            linkedin: document.getElementById('linkedin').value.trim(),
            github: document.getElementById('github').value.trim(),
            portfolio: document.getElementById('portfolio').value.trim(),
            current_title: document.getElementById('current_title').value.trim(),
            years_of_experience: document.getElementById('years_of_experience').value.trim(),
            custom_fields: customFields
        };

        // Save profile
        const saveResult = await StorageUtil.saveAutofillProfile(profileData);
        
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
 * Render missed fields under the form
 */
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
