/**
 * Unified Autofill Button Manager - FIXED VERSION
 * Defines UnifiedAutofillButton class on window object for global access
 * CRITICAL: This MUST load before content-script.js
 * 
 * FIX: Button now calls AutofillOrchestrator DIRECTLY instead of sending messages
 * This avoids "Unknown request type" errors from messaging
 */

console.log('[FloatingButtonManager] Loading...');

// DEFINE CLASS IMMEDIATELY AND EXPLICITLY ON WINDOW
window.UnifiedAutofillButton = class {
    constructor() {
        console.log('[UnifiedButton] Constructor called');
        this.buttonId = 'ats-unified-autofill-button';
        this.checkInterval = 10000; // 10 seconds
        this.monitorIntervalId = null;
        this.isProcessing = false;
    }

    /**
     * Initialize and inject button
     */
    async init() {
        // Prevent multiple initializations
        if (window.__unifiedAutofillButtonInstance) {
            console.warn('[UnifiedButton] ⚠️ Button already initialized, skipping duplicate');
            return;
        }

        window.__unifiedAutofillButtonInstance = this;

        await this.loadPreferences();
        this.injectButton();
        this.startMonitoring();
        console.log('[UnifiedButton] ✅ Initialized successfully');
    }

    /**
     * Inject unified autofill button into page
     */
    injectButton() {
        // Ensure DOM is ready
        if (!document.body) {
            console.warn('[UnifiedButton] ⚠️ document.body not available, retrying in 500ms');
            setTimeout(() => this.injectButton(), 500);
            return;
        }

        // Remove any duplicate buttons first (defensive)
        const existingButtons = document.querySelectorAll(`#${this.buttonId}`);
        if (existingButtons.length > 1) {
            console.warn('[UnifiedButton] ⚠️ Found duplicate buttons, removing extras');
            for (let i = 1; i < existingButtons.length; i++) {
                existingButtons[i].remove();
            }
        }

        // Don't re-inject if already exists
        if (document.getElementById(this.buttonId)) {
            console.log('[UnifiedButton] Button already in DOM, skipping injection');
            return;
        }

        try {
            const container = document.createElement('div');
            container.id = this.buttonId;
            
            // Create shadow DOM for style isolation
            const shadow = container.attachShadow({ mode: 'open' });
            
            // Create styles
            const style = document.createElement('style');
            style.textContent = `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

                :host {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 2147483647;
                    font-family: 'Inter', sans-serif;
                }
                
                .button-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .autofill-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 18px;
                    background: #99462a; /* primary */
                    color: white;
                    border: 1px solid #d1cdc7; /* pencil-grey */
                    border-radius: 4px 6px 3px 5px; /* organic radius */
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    user-select: none;
                    white-space: nowrap;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                
                .autofill-btn:hover {
                    background: #d97757; /* primary-container */
                    color: #541400; /* on-primary-container */
                    transform: translateY(-2px);
                    border-width: 1.5px;
                }
                
                .autofill-btn:active {
                    transform: scale(0.98);
                }
                
                .autofill-btn.loading {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .autofill-btn.success {
                    background: #596245; /* secondary (sage) */
                    color: white;
                    border-color: #5d6648;
                }
                
                .autofill-btn.error {
                    background: #ba1a1a; /* error */
                    color: white;
                }
                
                .btn-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                }
                
                .btn-icon.spinner {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .close-btn {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 24px;
                    height: 24px;
                    padding: 0;
                    background: rgba(0, 0, 0, 0.6);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                    line-height: 1;
                }
                
                .close-btn:hover {
                    background: rgba(0, 0, 0, 0.8);
                }
                
                .toast-notification {
                    position: absolute;
                    bottom: 60px;
                    right: 0;
                    background: #1f2937;
                    color: white;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 12px;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                    opacity: 0;
                    transform: translateY(10px);
                    transition: all 0.3s ease;
                    pointer-events: none;
                    white-space: nowrap;
                }
                
                .toast-notification.show {
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .hidden {
                    display: none !important;
                }
            `;
            
            // Create button HTML
            const wrapper = document.createElement('div');
            wrapper.className = 'button-wrapper';
            wrapper.innerHTML = `
                <button class="autofill-btn" title="Auto-fill this form with your information">
                    <span class="btn-icon">⚡</span>
                    <span class="btn-text">Autofill Form</span>
                </button>
                <button class="close-btn" title="Dismiss">×</button>
                <div class="toast-notification"></div>
            `;
            
            shadow.appendChild(style);
            shadow.appendChild(wrapper);
            document.body.appendChild(container);
            
            // Get elements from shadow DOM
            const btn = wrapper.querySelector('.autofill-btn');
            const closeBtn = wrapper.querySelector('.close-btn');
            const toast = wrapper.querySelector('.toast-notification');
            
            // Attach event listeners
            btn.addEventListener('click', () => this.performAutofill(toast, btn, wrapper));
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideButton();
            });
            
            console.log('[UnifiedButton] Button injected successfully');
        } catch (error) {
            console.error('[UnifiedButton] Error injecting button:', error);
        }
    }

    /**
     * Perform autofill action - DIRECT ORCHESTRATOR CALL
     * NO MESSAGING - button is in content script context, calls orchestrator directly
     */
    performAutofill(toastEl, btnEl, wrapperEl) {
        if (this.isProcessing) {
            console.log('[UnifiedButton] ⏳ Autofill already in progress, ignoring');
            return;
        }
        this.isProcessing = true;
        
        console.log('[UnifiedButton] 🚀 Starting autofill process...');
        
        // Show loading state
        btnEl.classList.add('loading');
        const textSpan = btnEl.querySelector('.btn-text');
        const originalText = textSpan.textContent;
        textSpan.textContent = 'Filling...';
        const iconSpan = btnEl.querySelector('.btn-icon');
        const originalIcon = iconSpan.textContent;
        iconSpan.textContent = '⏳';
        iconSpan.classList.add('spinner');
        
        try {
            // Get profile from storage
            chrome.storage.local.get(['autofillProfile'], (result) => {
                const profile = result.autofillProfile;
                
                console.log('[UnifiedButton] 📦 Profile:', profile ? `present (${Object.keys(profile).length} keys)` : 'MISSING');
                
                if (!profile || Object.keys(profile).length === 0) {
                    console.warn('[UnifiedButton] ⚠️ No profile in storage');
                    this.showToast(toastEl, 'Please fill profile in popup first!', 'error');
                    btnEl.classList.remove('loading');
                    btnEl.classList.add('error');
                    textSpan.textContent = 'No Profile';
                    iconSpan.textContent = '❌';
                    iconSpan.classList.remove('spinner');
                    
                    setTimeout(() => {
                        btnEl.classList.remove('error');
                        textSpan.textContent = originalText;
                        iconSpan.textContent = originalIcon;
                        this.isProcessing = false;
                    }, 3000);
                    return;
                }
                
                // Call AutofillOrchestrator directly - no messaging!
                console.log('[UnifiedButton] 🚀 Calling AutofillOrchestrator directly...');
                
                try {
                    if (typeof AutofillOrchestrator === 'undefined') {
                        throw new Error('AutofillOrchestrator not available');
                    }
                    
                    const orchestrator = new AutofillOrchestrator();
                    
                    orchestrator.start({ profile }).then(result => {
                        console.log('[UnifiedButton] ✅ Autofill done:', result);
                        
                        const filledCount = (result && result.data) ? (result.data.filled || 0) : 0;
                        
                        if (filledCount > 0) {
                            this.showToast(toastEl, `✅ Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}!`, 'success');
                            btnEl.classList.add('success');
                            textSpan.textContent = 'Complete!';
                            iconSpan.textContent = '✓';
                        } else {
                            this.showToast(toastEl, 'No matching fields found', 'info');
                        }
                        
                        // Reset after 2.5 seconds
                        setTimeout(() => {
                            btnEl.classList.remove('loading', 'success', 'error');
                            textSpan.textContent = originalText;
                            iconSpan.textContent = originalIcon;
                            iconSpan.classList.remove('spinner');
                            this.isProcessing = false;
                        }, 2500);
                    }).catch(error => {
                        console.error('[UnifiedButton] ❌ Orchestrator error:', error.message);
                        this.showToast(toastEl, 'Autofill failed: ' + error.message, 'error');
                        btnEl.classList.remove('loading');
                        btnEl.classList.add('error');
                        textSpan.textContent = 'Error';
                        iconSpan.textContent = '❌';
                        iconSpan.classList.remove('spinner');
                        
                        setTimeout(() => {
                            btnEl.classList.remove('error');
                            textSpan.textContent = originalText;
                            iconSpan.textContent = originalIcon;
                            this.isProcessing = false;
                        }, 3000);
                    });
                    
                } catch (error) {
                    console.error('[UnifiedButton] ❌ Error:', error.message);
                    this.showToast(toastEl, 'Error: ' + error.message, 'error');
                    btnEl.classList.remove('loading');
                    btnEl.classList.add('error');
                    textSpan.textContent = 'Error';
                    iconSpan.textContent = '❌';
                    iconSpan.classList.remove('spinner');
                    this.isProcessing = false;
                }
            });
        } catch (error) {
            console.error('[UnifiedButton] ❌ Outer error:', error.message);
            this.showToast(toastEl, 'Error: ' + error.message, 'error');
            btnEl.classList.remove('loading');
            btnEl.classList.add('error');
            textSpan.textContent = 'Error';
            iconSpan.textContent = '❌';
            iconSpan.classList.remove('spinner');
            this.isProcessing = false;
        }
    }

    /**
     * Show toast notification
     */
    showToast(toastEl, message, type = 'info') {
        toastEl.textContent = message;
        toastEl.classList.add('show');
        
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, 3000);
    }

    /**
     * Start monitoring for button presence
     */
    startMonitoring() {
        this.monitorIntervalId = setInterval(() => {
            const button = document.getElementById(this.buttonId);
            if (!button) {
                console.log('[UnifiedButton] Button missing, re-injecting...');
                this.injectButton();
            }
        }, this.checkInterval);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitorIntervalId) {
            clearInterval(this.monitorIntervalId);
            this.monitorIntervalId = null;
        }
    }

    /**
     * Show button
     */
    show() {
        const button = document.getElementById(this.buttonId);
        if (button) {
            button.classList.remove('hidden');
        }
        chrome.storage.local.set({ autofillButtonHidden: false });
        console.log('[UnifiedButton] Button shown');
    }

    /**
     * Hide button temporarily
     */
    hideButton() {
        const button = document.getElementById(this.buttonId);
        if (button) {
            button.classList.add('hidden');
        }
        console.log('[UnifiedButton] Button hidden');
    }

    /**
     * Remove button completely
     */
    remove() {
        const button = document.getElementById(this.buttonId);
        if (button) {
            button.remove();
        }
        this.stopMonitoring();
        console.log('[UnifiedButton] Button removed');
    }

    /**
     * Load user preferences
     */
    async loadPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['autofillButtonHidden'], (result) => {
                resolve();
            });
        });
    }

    /**
     * Detect if we're on an application form
     */
    static isApplicationForm() {
        const inputs = document.querySelectorAll('input, select, textarea, [role="textbox"]');
        return inputs.length > 0;
    }
};

console.log('[FloatingButtonManager] ✅ UnifiedAutofillButton class defined on window');
console.log('[FloatingButtonManager] typeof window.UnifiedAutofillButton:', typeof window.UnifiedAutofillButton);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.UnifiedAutofillButton;
}
