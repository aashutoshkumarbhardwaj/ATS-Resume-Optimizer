/**
 * Floating Button Manager - Phase 2
 * Manages persistent floating autofill button
 * Auto-reinjects if missing, never permanently hidden
 */

class FloatingButtonManager {
    constructor() {
        this.buttonId = 'ats-autofill-floating-button';
        this.checkInterval = 10000; // 10 seconds
        this.monitorIntervalId = null;
    }

    /**
     * Initialize and inject button
     */
    async init() {
        await this.loadPreferences();
        this.injectButton();
        this.startMonitoring();
    }

    /**
     * Inject floating button into page
     */
    injectButton() {
        // Don't re-inject if already exists
        if (document.getElementById(this.buttonId)) {
            return;
        }

        try {
            const button = document.createElement('div');
            button.id = this.buttonId;
            button.className = 'ats-autofill-float-btn-container';

            button.innerHTML = `
                <button class="ats-autofill-float-btn" title="Auto-fill Application Form">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>Autofill</span>
                </button>
            `;

            // Style the button
            this.styleButton(button);

            // Add event listener
            button.querySelector('button').addEventListener('click', () => {
                this.handleButtonClick();
            });

            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'ats-autofill-float-close';
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideButton();
            });

            button.appendChild(closeBtn);
            document.body.appendChild(button);

            console.log('[FloatingButton] Button injected successfully');
        } catch (error) {
            console.error('[FloatingButton] Error injecting button:', error);
        }
    }

    /**
     * Style the floating button
     */
    styleButton(container) {
        const styles = `
            #${this.buttonId} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }

            .ats-autofill-float-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
                transition: all 0.3s ease;
            }

            .ats-autofill-float-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
            }

            .ats-autofill-float-btn:active {
                transform: translateY(0);
            }

            .ats-autofill-float-close {
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
            }

            .ats-autofill-float-close:hover {
                background: rgba(0, 0, 0, 0.8);
            }

            #${this.buttonId}.hidden {
                display: none;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    /**
     * Start monitoring for button presence
     */
    startMonitoring() {
        this.monitorIntervalId = setInterval(() => {
            const button = document.getElementById(this.buttonId);

            if (!button || button.offsetParent === null) {
                if (!button) {
                    console.log('[FloatingButton] Button missing, re-injecting...');
                    this.injectButton();
                }
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
            button.style.display = 'flex';
        }

        chrome.storage.local.set({ autofillButtonHidden: false });
        console.log('[FloatingButton] Button shown');
    }

    /**
     * Hide button (NOT permanently - will re-inject)
     */
    hideButton() {
        const button = document.getElementById(this.buttonId);
        if (button) {
            button.classList.add('hidden');
            button.style.display = 'none';
        }

        // Don't save as permanently hidden - it will re-appear
        console.log('[FloatingButton] Button hidden (temporary)');
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
        console.log('[FloatingButton] Button removed');
    }

    /**
     * Load user preferences
     */
    async loadPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['autofillButtonHidden'], (result) => {
                if (result.autofillButtonHidden) {
                    // Even if previously hidden, we'll show it fresh
                    // This ensures it's never permanently hidden
                }
                resolve();
            });
        });
    }

    /**
     * Handle button click
     */
    handleButtonClick() {
        console.log('[FloatingButton] Button clicked');

        // Send message to trigger autofill
        chrome.runtime.sendMessage({
            type: 'TRIGGER_AUTOFILL_FROM_BUTTON',
            source: 'floatingButton'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[FloatingButton] Error:', chrome.runtime.lastError);
            }
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

// Auto-initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (FloatingButtonManager.isApplicationForm()) {
            const manager = new FloatingButtonManager();
            manager.init().catch(err => console.error('FloatingButton init error:', err));
        }
    });
} else {
    // DOM already loaded
    if (FloatingButtonManager.isApplicationForm()) {
        const manager = new FloatingButtonManager();
        manager.init().catch(err => console.error('FloatingButton init error:', err));
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatingButtonManager;
}
