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
        this.agentState = 'idle'; // 'idle' | 'running'
        this.activeOrchestrator = null;
        this.agentBtn = null;
        this.instantBtn = null;
        this.toast = null;
        this.wrapperEl = null;
    }

    /**
     * Initialize and inject button
     */
    async init() {
        // Guard against child iframes: The main floating controller UI belongs in the top-level window
        if (typeof window !== 'undefined' && window.self !== window.top) {
            console.log('[UnifiedButton] Child frame detected — skipping floating button creation in iframe.');
            return;
        }

        // Prevent multiple initializations
        if (window.__unifiedAutofillButtonInstance) {
            console.warn('[UnifiedButton] ⚠️ Button already initialized, skipping duplicate');
            return;
        }

        window.__unifiedAutofillButtonInstance = this;

        await this.loadPreferences();
        this.injectButton();
        this.startMonitoring();
        this.setupStorageListeners();
        this.checkAndResumeSession();
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
                    gap: 6px;
                    background: rgba(17, 24, 39, 0.85);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    padding: 4px 6px;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
                }
                
                .autofill-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 9px 14px;
                    color: white;
                    border: none;
                    border-radius: 18px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    user-select: none;
                    white-space: nowrap;
                    letter-spacing: 0.02em;
                }

                .agent-btn {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
                }

                .agent-btn:hover {
                    background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.6);
                }

                .stop-btn {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
                    box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5) !important;
                    animation: stopBtnPulse 2s infinite ease-in-out !important;
                }

                .stop-btn:hover {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
                    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.75) !important;
                    transform: translateY(-1px);
                }

                @keyframes stopBtnPulse {
                    0%, 100% { box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5); }
                    50% { box-shadow: 0 0 18px rgba(239, 68, 68, 0.85); }
                }

                .instant-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: #e5e7eb;
                }

                .instant-btn:hover {
                    background: rgba(255, 255, 255, 0.18);
                    color: #ffffff;
                }
                
                .autofill-btn:active {
                    transform: scale(0.97);
                }
                
                .autofill-btn.loading {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .autofill-btn.success {
                    background: #10b981;
                    color: white;
                }
                
                .autofill-btn.error {
                    background: #ef4444;
                    color: white;
                }
                
                .btn-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }
                
                .btn-icon.spinner {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .close-btn {
                    width: 20px;
                    height: 20px;
                    padding: 0;
                    background: rgba(255, 255, 255, 0.15);
                    color: #9ca3af;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    line-height: 1;
                    margin-left: 2px;
                }
                
                .close-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                    color: #ffffff;
                }
                
                .toast-notification {
                    position: absolute;
                    bottom: 50px;
                    right: 0;
                    background: #111827;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
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
                <button class="autofill-btn agent-btn" id="run-agent-btn" title="Run Autonomous AI Agent with Visual Virtual Cursor">
                    <span class="btn-icon">🤖</span>
                    <span class="btn-text">Run Agent</span>
                </button>
                <button class="autofill-btn instant-btn" id="instant-fill-btn" title="Instant Fast Autofill">
                    <span class="btn-icon">⚡</span>
                    <span class="btn-text">Instant</span>
                </button>
                <button class="close-btn" title="Dismiss">×</button>
                <div class="toast-notification"></div>
            `;
            
            shadow.appendChild(style);
            shadow.appendChild(wrapper);
            document.body.appendChild(container);
            
            // Get elements from shadow DOM
            const agentBtn = wrapper.querySelector('#run-agent-btn');
            const instantBtn = wrapper.querySelector('#instant-fill-btn');
            const closeBtn = wrapper.querySelector('.close-btn');
            const toast = wrapper.querySelector('.toast-notification');

            this.agentBtn = agentBtn;
            this.instantBtn = instantBtn;
            this.toast = toast;
            this.wrapperEl = wrapper;
            
            // Attach event listeners
            agentBtn.addEventListener('click', () => {
                if (this.agentState === 'running') {
                    this.stopAutonomousAgent();
                } else {
                    this.performAutofill(toast, agentBtn, wrapper, 'autonomous');
                }
            });
            instantBtn.addEventListener('click', () => this.performAutofill(toast, instantBtn, wrapper, 'simple'));
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
     * Switch button appearance between Idle (Run Agent) and Running (Stop Agent)
     */
    setRunningState(isRunning) {
        this.agentState = isRunning ? 'running' : 'idle';
        if (!this.agentBtn && this.buttonId) {
            const host = document.getElementById(this.buttonId);
            if (host && host.shadowRoot) {
                this.agentBtn = host.shadowRoot.querySelector('#run-agent-btn');
                this.instantBtn = host.shadowRoot.querySelector('#instant-fill-btn');
                this.toast = host.shadowRoot.querySelector('.toast-notification');
                this.wrapperEl = host.shadowRoot.querySelector('.button-wrapper');
            }
        }

        if (!this.agentBtn) return;

        const iconSpan = this.agentBtn.querySelector('.btn-icon');
        const textSpan = this.agentBtn.querySelector('.btn-text');

        if (isRunning) {
            this.agentBtn.classList.remove('agent-btn', 'loading', 'success', 'error');
            this.agentBtn.classList.add('stop-btn');
            this.agentBtn.title = 'Stop Autonomous AI Agent';
            if (iconSpan) {
                iconSpan.textContent = '⏹';
                iconSpan.classList.remove('spinner');
            }
            if (textSpan) textSpan.textContent = 'Stop Agent';
            if (this.instantBtn) this.instantBtn.style.display = 'none';
        } else {
            this.isProcessing = false;
            this.agentBtn.classList.remove('stop-btn', 'loading', 'success', 'error');
            this.agentBtn.classList.add('agent-btn');
            this.agentBtn.title = 'Run Autonomous AI Agent with Visual Virtual Cursor';
            if (iconSpan) {
                iconSpan.textContent = '🤖';
                iconSpan.classList.remove('spinner');
            }
            if (textSpan) textSpan.textContent = 'Run Agent';
            if (this.instantBtn) this.instantBtn.style.display = 'flex';
        }
    }

    /**
     * Stop Autonomous Agent immediately and reset UI
     */
    stopAutonomousAgent() {
        console.log('[UnifiedButton] ⏹ Stopping autonomous agent on user request...');
        if (this.activeOrchestrator && typeof this.activeOrchestrator.stop === 'function') {
            this.activeOrchestrator.stop(true);
            this.activeOrchestrator = null;
        }
        if (typeof window !== 'undefined' && window.__autonomousAgentOrchestratorInstance && typeof window.__autonomousAgentOrchestratorInstance.stop === 'function') {
            window.__autonomousAgentOrchestratorInstance.stop(true);
            window.__autonomousAgentOrchestratorInstance = null;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ autonomousAgentSession: { isActive: false, stoppedAt: Date.now() } });
        }
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'AGENT_SESSION_STOP' }).catch(() => {});
        }

        this.setRunningState(false);
        if (this.toast) {
            this.showToast(this.toast, '⏹ Agent stopped', 'info');
        }
    }

    /**
     * Check if an active agent session exists from a previous page navigation or redirect, and auto-resume
     */
    checkAndResumeSession() {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
            chrome.storage.local.get(['autonomousAgentSession'], (result) => {
                const session = result.autonomousAgentSession;
                if (session && session.isActive) {
                    const age = Date.now() - (session.timestamp || 0);
                    // Check if session is fresh (within 3 minutes)
                    if (age < 180000) {
                        console.log(`[UnifiedButton] 🔄 Active session found across page navigation! Age: ${Math.round(age/1000)}s. Resuming agent...`);
                        this.setRunningState(true);
                        setTimeout(() => {
                            if (this.agentState === 'running') {
                                this.performAutofill(this.toast, this.agentBtn, this.wrapperEl, 'autonomous', { resumeSession: true, session });
                            }
                        }, 1200);
                    } else {
                        console.log('[UnifiedButton] Stale agent session detected (> 3m). Resetting session...');
                        chrome.storage.local.set({ autonomousAgentSession: { isActive: false } });
                    }
                }
            });
        } catch (e) {
            console.warn('[UnifiedButton] Error checking agent session:', e);
        }
    }

    /**
     * Resume session triggered from background worker or runtime message
     */
    resumeSession(session) {
        console.log('[UnifiedButton] 🚀 Explicit resumeSession signal received');
        this.setRunningState(true);
        setTimeout(() => {
            this.performAutofill(this.toast, this.agentBtn, this.wrapperEl, 'autonomous', { resumeSession: true, session });
        }, 500);
    }

    /**
     * Listen for storage changes to sync button state across tabs
     */
    setupStorageListeners() {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return;
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.autonomousAgentSession) {
                    const newVal = changes.autonomousAgentSession.newValue;
                    if (newVal && newVal.isActive === false && this.agentState === 'running') {
                        console.log('[UnifiedButton] ⏹ Agent session deactivated. Reverting button UI to idle.');
                        this.setRunningState(false);
                    }
                }
            });
        } catch (e) {}
    }

    /**
     * Perform autofill action - DIRECT ORCHESTRATOR CALL
     * NO MESSAGING - button is in content script context, calls orchestrator directly
     */
    performAutofill(toastEl, btnEl, wrapperEl, mode = 'autonomous', customOptions = {}) {
        if (this.isProcessing && !customOptions.resumeSession) {
            console.log('[UnifiedButton] ⏳ Autofill already in progress, ignoring duplicate call');
            return;
        }
        this.isProcessing = true;
        
        console.log(`[UnifiedButton] 🚀 Starting autofill process in ${mode} mode...`);

        if (mode === 'autonomous') {
            this.setRunningState(true);
        } else {
            // Show simple loading state for instant mode
            btnEl.classList.add('loading');
            const textSpan = btnEl.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Filling...';
            const iconSpan = btnEl.querySelector('.btn-icon');
            if (iconSpan) {
                iconSpan.textContent = '⏳';
                iconSpan.classList.add('spinner');
            }
        }
        
        try {
            // Get profile from storage (check multiple storage keys)
            chrome.storage.local.get(['autofillProfile', 'user_profile', 'profile', 'candidate_profile'], (result) => {
                const profile = result.autofillProfile || result.user_profile || result.profile || result.candidate_profile || {};
                
                console.log('[UnifiedButton] 📦 Profile:', profile ? `present (${Object.keys(profile).length} keys)` : 'MISSING');
                
                if (!profile || Object.keys(profile).length === 0) {
                    console.warn('[UnifiedButton] ⚠️ No profile in storage');
                    this.showToast(toastEl, 'Please fill profile in popup first!', 'error');
                    this.setRunningState(false);
                    return;
                }
                
                // Call AutofillOrchestrator directly - no messaging!
                console.log(`[UnifiedButton] 🚀 Calling AutofillOrchestrator in ${mode} mode...`);
                
                try {
                    const OrchClass = (typeof window !== 'undefined' && window.AutofillOrchestrator) || (typeof AutofillOrchestrator !== 'undefined' ? AutofillOrchestrator : null);
                    if (!OrchClass) {
                        throw new Error('AutofillOrchestrator not available. Please reload the webpage (Ctrl+R / Cmd+R).');
                    }
                    
                    const orchestrator = new OrchClass();
                    this.activeOrchestrator = orchestrator;
                    
                    const startOptions = Object.assign({ profile, mode }, customOptions);
                    orchestrator.start(startOptions).then(result => {
                        console.log('[UnifiedButton] ✅ Autofill done:', result);
                        
                        const filledCount = (result && result.data) ? (result.data.filled || 0) : ((result && result.stats) ? result.stats.filled : 0);
                        
                        if (filledCount > 0) {
                            this.showToast(toastEl, `✅ Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}!`, 'success');
                        } else {
                            this.showToast(toastEl, 'Scan complete', 'info');
                        }
                        
                        this.setRunningState(false);
                    }).catch(error => {
                        console.error('[UnifiedButton] ❌ Orchestrator error:', error.message);
                        this.showToast(toastEl, 'Autofill failed: ' + error.message, 'error');
                        this.setRunningState(false);
                    });
                    
                } catch (error) {
                    console.error('[UnifiedButton] ❌ Error:', error.message);
                    this.showToast(toastEl, 'Error: ' + error.message, 'error');
                    this.setRunningState(false);
                }
            });
        } catch (error) {
            console.error('[UnifiedButton] ❌ Outer error:', error.message);
            this.showToast(toastEl, 'Error: ' + error.message, 'error');
            this.setRunningState(false);
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
