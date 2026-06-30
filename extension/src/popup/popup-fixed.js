/**
 * Popup Script - Fixed & Optimized Version
 * Main UI logic for the extension popup
 * 
 * Fixes:
 * - Auto-closes when user switches tabs or loses focus
 * - Fast initialization (<500ms)
 * - Offloads heavy tasks to background script
 * - Only one popup instance
 * - Proper cleanup on close
 */

// Configuration
const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';

// Popup state management
const PopupState = {
    isOpen: true,
    initialized: false,
    tasksPending: 0,
    abortController: new AbortController(),
    
    markTask() { this.tasksPending++; },
    unmarkTask() { this.tasksPending--; },
    hasActiveTasks() { return this.tasksPending > 0; },
    clear() {
        this.tasksPending = 0;
        this.abortController.abort();
    }
};

// Application state
let state = {
    currentJob: null,
    currentResume: null,
    currentAnalysis: null,
    currentOptimization: null
};

// DOM elements (initialized on demand)
let dom = null;

function initDOM() {
    if (dom) return dom;
    
    dom = {
        // Tab buttons and containers
        tabBtns: document.querySelectorAll('.tab-btn'),
        optimizeTab: document.getElementById('optimizeTab'),
        historyTab: document.getElementById('historyTab'),
        autofillTab: document.getElementById('autofillTab'),
        
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
        copyOptimizedBtn: document.getElementById('copyOptimizedBtn'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        
        // Analysis
        atsScore: document.getElementById('atsScore'),
        keywordBar: document.getElementById('keywordBar'),
        experienceBar: document.getElementById('experienceBar'),
        skillsBar: document.getElementById('skillsBar'),
        matchedKeywords: document.getElementById('matchedKeywords'),
        missingKeywords: document.getElementById('missingKeywords'),
        suggestionsList: document.getElementById('suggestionsList'),
        
        // Optimization
        originalScore: document.getElementById('originalScore'),
        optimizedScore: document.getElementById('optimizedScore'),
        scoreImprovement: document.getElementById('scoreImprovement'),
        changesList: document.getElementById('changesList'),
        
        // History & Forms
        historyList: document.getElementById('historyList'),
        autofillForm: document.getElementById('autofillForm'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        autofillActiveTabBtn: document.getElementById('autofillActiveTabBtn'),
        addCustomFieldBtn: document.getElementById('addCustomFieldBtn'),
        customFieldsContainer: document.getElementById('customFieldsContainer'),
        missedFieldsSection: document.getElementById('missedFieldsSection'),
        missedFieldsList: document.getElementById('missedFieldsList'),
        autofillMessage: document.getElementById('autofillMessage'),
        
        // UI State
        loadingSpinner: document.getElementById('loadingSpinner'),
        loadingText: document.getElementById('loadingText'),
        errorMessage: document.getElementById('errorMessage'),
        analysisPanel: document.getElementById('analysisPanel'),
        optimizationPanel: document.getElementById('optimizationPanel')
    };
    
    return dom;
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    init();
    setupAutoClose();
});

window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    try {
        PopupState.markTask();
        console.log('[Popup] Initializing...');
        
        // 1. Setup critical event listeners first
        setupEventListeners();
        
        // 2. Load critical data (fast)
        loadDetectedJob();
        
        // 3. Defer non-critical data loading to idle time
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => deferredInit(), { timeout: 2000 });
        } else {
            setTimeout(deferredInit, 100);
        }
        
        PopupState.initialized = true;
        console.log('[Popup] Initialization complete');
    } catch (error) {
        console.error('[Popup] Init error:', error);
        showError('Failed to initialize');
    } finally {
        PopupState.unmarkTask();
    }
}

function deferredInit() {
    loadSavedResume();
    loadAutofillProfile();
}

// ============================================================================
// AUTO-CLOSE FUNCTIONALITY
// ============================================================================

function setupAutoClose() {
    // Auto-close when window loses focus
    window.addEventListener('blur', () => {
        console.log('[Popup] Window blur, closing...');
        closePopupSafely();
    });
    
    // Listen for tab switch from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'TAB_SWITCHED') {
            console.log('[Popup] Tab switched, closing...');
            closePopupSafely();
        }
        sendResponse({ received: true });
    });
}

function closePopupSafely() {
    if (!PopupState.isOpen) return;
    
    PopupState.isOpen = false;
    console.log('[Popup] Closing safely, pending tasks:', PopupState.tasksPending);
    
    if (!PopupState.hasActiveTasks()) {
        closePopupImmediate();
        return;
    }
    
    // Wait up to 2 seconds for active tasks
    let waited = 0;
    const interval = setInterval(() => {
        waited += 100;
        if (!PopupState.hasActiveTasks() || waited >= 2000) {
            clearInterval(interval);
            closePopupImmediate();
        }
    }, 100);
}

function closePopupImmediate() {
    console.log('[Popup] Closing immediately');
    cleanup();
    window.close();
}

function cleanup() {
    if (!PopupState.initialized) return;
    
    console.log('[Popup] Cleanup');
    PopupState.clear();
    
    // Clear extension badge
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
    
    state = { currentJob: null, currentResume: null, currentAnalysis: null, currentOptimization: null };
}

// ============================================================================
// EVENT SETUP
// ============================================================================

function setupEventListeners() {
    const d = dom;
    
    // Tab navigation
    d.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // File upload
    d.uploadArea.addEventListener('click', () => d.resumeFile.click());
    d.resumeFile.addEventListener('change', handleFileUpload);
    d.removeFile.addEventListener('click', removeUploadedFile);
    
    // Drag and drop
    d.uploadArea.addEventListener('dragover', handleDragOver);
    d.uploadArea.addEventListener('dragleave', handleDragLeave);
    d.uploadArea.addEventListener('drop', handleDrop);
    
    // Main buttons
    d.analyzeBtn.addEventListener('click', handleAnalyze);
    d.optimizeBtn.addEventListener('click', handleOptimize);
    d.clearHistoryBtn.addEventListener('click', handleClearHistory);
    
    // Download buttons
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => handleDownload(btn.dataset.format));
    });
    
    // Copy optimized text
    if (d.copyOptimizedBtn) {
        d.copyOptimizedBtn.addEventListener('click', handleCopyOptimized);
    }
    
    // Autofill form
    if (d.autofillForm) {
        d.autofillForm.addEventListener('submit', handleSaveProfile);
    }
    
    if (d.autofillActiveTabBtn) {
        d.autofillActiveTabBtn.addEventListener('click', handleAutofillTab);
    }
    
    if (d.addCustomFieldBtn) {
        d.addCustomFieldBtn.addEventListener('click', addCustomFieldRow);
    }
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function switchTab(tabName) {
    const d = dom;
    
    // Update buttons
    d.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update content
    d.optimizeTab.classList.toggle('active', tabName === 'optimize');
    d.historyTab.classList.toggle('active', tabName === 'history');
    d.autofillTab.classList.toggle('active', tabName === 'autofill');
    
    // Lazy load history
    if (tabName === 'history') {
        loadHistory();
    }
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadDetectedJob() {
    PopupState.markTask();
    
    chrome.storage.local.get(['currentJob'], (result) => {
        if (result.currentJob) {
            state.currentJob = result.currentJob;
            displayDetectedJob(result.currentJob);
        }
        PopupState.unmarkTask();
    });
}

function loadSavedResume() {
    PopupState.markTask();
    
    chrome.storage.local.get(['resume'], (result) => {
        if (result.resume) {
            state.currentResume = result.resume;
            dom.resumeText.value = result.resume.text || '';
            if (result.resume.metadata) {
                displayUploadedFile(result.resume.metadata.filename);
            }
        }
        PopupState.unmarkTask();
    });
}

function loadAutofillProfile() {
    PopupState.markTask();
    
    chrome.storage.local.get(['autofillProfile'], (result) => {
        if (result.autofillProfile) {
            const profile = result.autofillProfile;
            
            // Populate form fields
            const fields = ['full_name', 'email', 'phone', 'city', 'country', 'linkedin', 'github', 'portfolio', 'current_title', 'years_of_experience'];
            fields.forEach(field => {
                const input = document.getElementById(field);
                if (input && profile[field]) {
                    input.value = profile[field];
                }
            });
        }
        PopupState.unmarkTask();
    });
}

function loadHistory() {
    PopupState.markTask();
    
    chrome.storage.local.get(['analysisHistory'], (result) => {
        const history = result.analysisHistory || [];
        displayHistory(history);
        PopupState.unmarkTask();
    });
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function displayDetectedJob(job) {
    dom.detectedJobTitle.textContent = job.jobTitle || 'Unknown';
    dom.detectedCompany.textContent = job.company || 'Unknown';
    dom.detectedJobInfo.classList.remove('hidden');
    
    if (job.description) {
        dom.jobDescription.value = job.description;
    }
}

function displayUploadedFile(filename) {
    dom.fileName.textContent = filename;
    dom.uploadedFileInfo.classList.remove('hidden');
    dom.uploadArea.style.display = 'none';
}

function displayAnalysisResults(data) {
    dom.atsScore.textContent = data.atsScore || 0;
    
    if (data.breakdown) {
        dom.keywordBar.style.width = `${(data.breakdown.keywordMatch * 100)}%`;
        dom.experienceBar.style.width = `${(data.breakdown.experienceRelevance * 100)}%`;
        dom.skillsBar.style.width = `${(data.breakdown.skillsAlignment * 100)}%`;
    }
    
    // Matched keywords
    dom.matchedKeywords.innerHTML = '';
    if (data.matchedKeywords?.length > 0) {
        data.matchedKeywords.slice(0, 10).forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag matched';
            tag.textContent = keyword;
            dom.matchedKeywords.appendChild(tag);
        });
    }
    
    // Missing keywords
    dom.missingKeywords.innerHTML = '';
    if (data.missingKeywords?.length > 0) {
        data.missingKeywords.slice(0, 10).forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag missing';
            tag.textContent = keyword;
            dom.missingKeywords.appendChild(tag);
        });
    }
    
    // Suggestions
    dom.suggestionsList.innerHTML = '';
    if (data.suggestions?.length > 0) {
        data.suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = `suggestion-item ${suggestion.priority || 'medium'}`;
            item.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(suggestion.message)}</div>
                <div style="font-size: 11px; color: #666;">${escapeHtml(suggestion.impact || '')}</div>
            `;
            dom.suggestionsList.appendChild(item);
        });
    }
}

function displayOptimizationResults(data) {
    dom.originalScore.textContent = data.originalScore || 0;
    dom.optimizedScore.textContent = data.optimizedScore || 0;
    
    const improvement = (data.optimizedScore || 0) - (data.originalScore || 0);
    dom.scoreImprovement.textContent = improvement > 0 ? `+${improvement}` : improvement;
    dom.scoreImprovement.style.background = improvement > 0 ? '#4caf50' : '#999';
    
    // Update resume text
    if (data.optimizedText) {
        dom.resumeText.value = data.optimizedText;
        showNotification('✅ Resume optimized! Review changes above.', 'success');
    }
    
    // Display changes
    dom.changesList.innerHTML = '';
    if (data.changes?.length > 0) {
        const summary = document.createElement('div');
        summary.style.cssText = 'background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 12px;';
        summary.innerHTML = `<strong style="color: #2e7d32;">📝 ${data.changes.length} Changes Made</strong>`;
        dom.changesList.appendChild(summary);
        
        data.changes.forEach(change => {
            const item = document.createElement('div');
            item.className = 'change-item';
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <span class="change-type ${change.type}">${change.type}</span>
                        <div style="margin-top: 6px; font-size: 12px;">${escapeHtml(change.reason)}</div>
                    </div>
                    <span style="font-size: 20px;">${change.impact === 'high' ? '🔥' : '⭐'}</span>
                </div>
            `;
            dom.changesList.appendChild(item);
        });
    }
}

function displayHistory(history) {
    dom.historyList.innerHTML = '';
    
    if (!history || history.length === 0) {
        dom.historyList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No history</p>';
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
        dom.historyList.appendChild(item);
    });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        showError('File exceeds 5MB');
        return;
    }
    
    showLoading('Processing file...');
    PopupState.markTask();
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            // Send to background for processing
            chrome.runtime.sendMessage({
                type: 'PROCESS_FILE',
                payload: {
                    buffer: Array.from(new Uint8Array(e.target.result)),
                    fileName: file.name,
                    fileSize: file.size
                }
            }, (response) => {
                if (response?.success) {
                    dom.resumeText.value = response.data.extractedText;
                    displayUploadedFile(file.name);
                    
                    chrome.storage.local.set({
                        resume: {
                            text: response.data.extractedText,
                            metadata: { filename: file.name, size: file.size }
                        }
                    });
                    
                    state.currentResume = response.data;
                } else {
                    showError(response?.error || 'Failed to process');
                }
                
                hideLoading();
                PopupState.unmarkTask();
            });
        } catch (error) {
            showError('Failed to process file');
            hideLoading();
            PopupState.unmarkTask();
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function handleAnalyze() {
    const job = dom.jobDescription.value.trim();
    const resume = dom.resumeText.value.trim();
    
    if (!job || !resume) {
        showError('Please provide job description and resume');
        return;
    }
    
    showLoading('Analyzing...');
    PopupState.markTask();
    hideError();
    
    chrome.runtime.sendMessage({
        type: 'ANALYZE_RESUME',
        payload: { jobDescription: job, resumeText: resume }
    }, (response) => {
        if (response?.success) {
            state.currentAnalysis = response.data;
            displayAnalysisResults(response.data);
            dom.analysisPanel.classList.remove('hidden');
        } else {
            showError(response?.error || 'Analysis failed');
        }
        
        hideLoading();
        PopupState.unmarkTask();
    });
}

function handleOptimize() {
    if (!state.currentAnalysis) {
        showError('Analyze first');
        return;
    }
    
    showLoading('Optimizing...');
    PopupState.markTask();
    
    chrome.runtime.sendMessage({
        type: 'OPTIMIZE_RESUME',
        payload: {
            resumeText: dom.resumeText.value.trim(),
            jobDescription: dom.jobDescription.value.trim(),
            analysisResult: state.currentAnalysis
        }
    }, (response) => {
        if (response?.success) {
            state.currentOptimization = response.data;
            displayOptimizationResults(response.data);
            dom.optimizationPanel.classList.remove('hidden');
        } else {
            showError(response?.error || 'Optimization failed');
        }
        
        hideLoading();
        PopupState.unmarkTask();
    });
}

async function handleDownload(format) {
    if (!state.currentOptimization) {
        showError('Optimize first');
        return;
    }
    
    showLoading('Preparing download...');
    PopupState.markTask();
    
    try {
        const jobTitle = state.currentJob?.jobTitle || 'Position';
        const text = state.currentOptimization.optimizedText || dom.resumeText.value;
        
        if (format === 'txt') {
            const blob = new Blob([text], { type: 'text/plain' });
            downloadBlob(blob, `Resume_${jobTitle}_${Date.now()}.txt`);
        } else {
            chrome.runtime.sendMessage({
                type: 'GENERATE_DOCUMENT',
                payload: { text, format, jobTitle }
            }, (response) => {
                if (response?.success) {
                    downloadBlob(response.blob, `Resume_${jobTitle}_${Date.now()}.${format}`);
                    showNotification(`✅ Downloaded as ${format.toUpperCase()}!`, 'success');
                } else {
                    showError('Download failed');
                }
            });
        }
    } catch (error) {
        showError('Download error: ' + error.message);
    } finally {
        hideLoading();
        PopupState.unmarkTask();
    }
}

async function handleCopyOptimized() {
    const text = dom.resumeText.value;
    if (!text) {
        showError('No text to copy');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        showNotification('✅ Copied to clipboard!', 'success');
    } catch {
        showError('Copy failed');
    }
}

function handleSaveProfile(e) {
    e?.preventDefault();
    
    const profile = {};
    ['full_name', 'email', 'phone', 'city', 'country', 'linkedin', 'github', 'portfolio', 'current_title', 'years_of_experience'].forEach(field => {
        const input = document.getElementById(field);
        if (input) profile[field] = input.value;
    });
    
    chrome.storage.local.set({ autofillProfile: profile }, () => {
        showNotification('✅ Profile saved!', 'success');
    });
}

function handleAutofillTab() {
    PopupState.markTask();
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'AUTOFILL_FORM' }, (response) => {
            if (response?.success) {
                showNotification('✅ Form filled!', 'success');
            } else {
                showNotification('⚠️ No form found on page', 'error');
            }
            PopupState.unmarkTask();
        });
    });
}

function handleClearHistory() {
    if (!confirm('Clear all history?')) return;
    
    chrome.storage.local.set({ analysisHistory: [] }, () => {
        loadHistory();
        showNotification('✅ History cleared', 'success');
    });
}

// ============================================================================
// DRAG & DROP
// ============================================================================

function handleDragOver(e) {
    e.preventDefault();
    dom.uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dom.uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dom.uploadArea.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length) {
        dom.resumeFile.files = e.dataTransfer.files;
        handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function removeUploadedFile() {
    dom.uploadedFileInfo.classList.add('hidden');
    dom.uploadArea.style.display = 'block';
    dom.resumeFile.value = '';
    state.currentResume = null;
}

function viewHistoryEntry(entry) {
    switchTab('optimize');
    dom.jobDescription.value = entry.jobDescription || '';
    dom.resumeText.value = entry.optimizedText || '';
    showNotification('Loaded from history', 'info');
}

function addCustomFieldRow() {
    // Implementation for adding custom field
    console.log('Add custom field');
}

function showLoading(message = 'Processing...') {
    dom.loadingText.textContent = message;
    dom.loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    dom.loadingSpinner.classList.add('hidden');
}

function showError(message) {
    dom.errorMessage.textContent = message;
    dom.errorMessage.classList.remove('hidden');
}

function hideError() {
    dom.errorMessage.classList.add('hidden');
}

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
        font-size: 13px;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
