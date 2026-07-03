/**
 * Unified Autofill Button Manager
 * Single floating button that handles all autofill functionality
 * - Click to autofill
 * - Shows feedback with toast messages
 * - Close button to dismiss
 * - Persistent across page reloads
 * - Auto-reinjects if removed
 */

class UnifiedAutofillButton {
    constructor() {
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
                :host {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 2147483647;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
                    background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    user-select: none;
                    white-space: nowrap;
                }
                
                .autofill-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
                }
                
                .autofill-btn:active {
                    transform: translateY(0);
                }
                
                .autofill-btn.loading {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .autofill-btn.success {
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
                }
                
                .autofill-btn.error {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
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
     * Perform autofill action
     */
    performAutofill(toastEl, btnEl, wrapperEl) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        console.log('[UnifiedButton] Starting autofill...');
        
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
            chrome.storage.local.get(['profile'], (result) => {
                const profile = result.profile;
                
                if (!profile || Object.keys(profile).length === 0) {
                    // Show error
                    this.showToast(toastEl, 'Please fill out your profile in the popup first!', 'error');
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
                
                // Trigger autofill via content script message
                chrome.runtime.sendMessage({
                    type: 'TRIGGER_AUTOFILL_FROM_BUTTON',
                    source: 'unifiedButton',
                    profile: profile
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[UnifiedButton] Message error:', chrome.runtime.lastError);
                        this.showToast(toastEl, 'Autofill failed', 'error');
                        btnEl.classList.add('error');
                    } else if (response && response.filledCount !== undefined) {
                        const count = response.filledCount;
                        if (count > 0) {
                            this.showToast(toastEl, `✅ Filled ${count} fields!`, 'success');
                            btnEl.classList.add('success');
                            textSpan.textContent = 'Complete!';
                            iconSpan.textContent = '✓';
                        } else {
                            this.showToast(toastEl, 'No matching fields found', 'info');
                        }
                    } else {
                        this.showToast(toastEl, 'Autofill executed', 'success');
                        btnEl.classList.add('success');
                    }
                    
                    // Reset button state
                    setTimeout(() => {
                        btnEl.classList.remove('loading', 'success', 'error');
                        textSpan.textContent = originalText;
                        iconSpan.textContent = originalIcon;
                        iconSpan.classList.remove('spinner');
                        this.isProcessing = false;
                    }, 2500);
                });
            });
        } catch (error) {
            console.error('[UnifiedButton] Autofill error:', error);
            this.showToast(toastEl, 'Autofill failed: ' + error.message, 'error');
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
}

// Compatibility alias for old code
const FloatingButtonManager = UnifiedAutofillButton;

// NOTE: Auto-initialization is handled in content-script.js to prevent duplicate buttons
// This file only exports the class for use in other modules

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatingButtonManager;
}
