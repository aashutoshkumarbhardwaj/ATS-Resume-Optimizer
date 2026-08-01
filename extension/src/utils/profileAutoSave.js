/**
 * Profile Auto-Save System - Phase 2 Enhancement
 * Auto-saves profile changes with visual feedback
 * No manual save button needed
 */

class ProfileAutoSave {
    constructor() {
        this.debounceTimer = null;
        this.debounceDelay = 1000; // 1 second
        this.savingIndicator = null;
        this.isSaving = false;
        this.lastSavedData = null;
    }

    /**
     * Initialize auto-save for a form
     */
    init(formElement, onSave = null) {
        if (!formElement) return;

        // Listen for all input changes
        formElement.addEventListener('input', (e) => {
            this.handleInputChange(e, formElement, onSave);
        });

        formElement.addEventListener('change', (e) => {
            this.handleInputChange(e, formElement, onSave);
        });

        // Listen for textarea changes
        formElement.addEventListener('keyup', (e) => {
            if (e.target.tagName === 'TEXTAREA') {
                this.handleInputChange(e, formElement, onSave);
            }
        });

        console.log('[ProfileAutoSave] Auto-save initialized for form');
    }

    /**
     * Handle input change with debouncing
     */
    handleInputChange(event, formElement, onSave) {
        // Clear previous timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Show saving indicator
        this.showSavingIndicator();

        // Set new timer
        this.debounceTimer = setTimeout(async () => {
            try {
                // Collect form data
                const formData = this.collectFormData(formElement);

                // Check if data actually changed
                if (this.hasDataChanged(formData)) {
                    // Save the data
                    await this.saveProfile(formData);

                    // Call custom save callback
                    if (onSave) {
                        onSave(formData);
                    }

                    // Show saved indicator
                    this.showSavedIndicator();

                    console.log('[ProfileAutoSave] Profile saved');
                } else {
                    this.hideSavingIndicator();
                }
            } catch (error) {
                console.error('[ProfileAutoSave] Error saving profile:', error);
                this.showErrorIndicator(error.message);
            }
        }, this.debounceDelay);
    }

    /**
     * Collect all form data
     */
    collectFormData(formElement) {
        const formData = new FormData(formElement);
        const data = {};

        for (const [key, value] of formData) {
            if (data[key]) {
                // Handle multiple values (checkboxes, multi-select)
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }

        // Also collect from non-form elements with data attributes
        formElement.querySelectorAll('[data-profile-field]').forEach(el => {
            const key = el.getAttribute('data-profile-field');
            data[key] = el.value || el.textContent;
        });

        return data;
    }

    /**
     * Check if data has changed
     */
    hasDataChanged(newData) {
        if (!this.lastSavedData) return true;

        return JSON.stringify(newData) !== JSON.stringify(this.lastSavedData);
    }

    /**
     * Save profile to storage
     */
    async saveProfile(profileData) {
        return new Promise((resolve, reject) => {
            this.isSaving = true;

            chrome.storage.local.set({
                currentProfile: {
                    ...profileData,
                    lastSaved: Date.now()
                }
            }, () => {
                if (chrome.runtime.lastError) {
                    this.isSaving = false;
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    this.lastSavedData = profileData;
                    this.isSaving = false;
                    resolve();
                }
            });
        });
    }

    /**
     * Show saving indicator
     */
    showSavingIndicator() {
        if (!this.savingIndicator) {
            this.createIndicator();
        }

        this.savingIndicator.textContent = 'Saving...';
        this.savingIndicator.className = 'autosave-indicator saving';
        this.savingIndicator.style.display = 'inline-block';
    }

    /**
     * Show saved indicator
     */
    showSavedIndicator() {
        if (!this.savingIndicator) {
            this.createIndicator();
        }

        this.savingIndicator.textContent = '✓ Saved';
        this.savingIndicator.className = 'autosave-indicator saved';
        this.savingIndicator.style.display = 'inline-block';

        // Hide after 2 seconds
        setTimeout(() => {
            this.hideSavingIndicator();
        }, 2000);
    }

    /**
     * Show error indicator
     */
    showErrorIndicator(errorMessage) {
        if (!this.savingIndicator) {
            this.createIndicator();
        }

        this.savingIndicator.textContent = '✗ Error saving';
        this.savingIndicator.className = 'autosave-indicator error';
        this.savingIndicator.title = errorMessage;
        this.savingIndicator.style.display = 'inline-block';

        // Hide after 3 seconds
        setTimeout(() => {
            this.hideSavingIndicator();
        }, 3000);
    }

    /**
     * Hide saving indicator
     */
    hideSavingIndicator() {
        if (this.savingIndicator) {
            this.savingIndicator.style.display = 'none';
        }
    }

    /**
     * Create indicator element
     */
    createIndicator() {
        this.savingIndicator = document.createElement('span');
        this.savingIndicator.className = 'autosave-indicator';

        // Style the indicator
        const style = `
            .autosave-indicator {
                display: inline-block;
                padding: 4px 8px;
                margin-left: 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.3s ease;
            }

            .autosave-indicator.saving {
                color: #0066cc;
                background: #e6f2ff;
            }

            .autosave-indicator.saved {
                color: #00aa44;
                background: #e6ffe6;
            }

            .autosave-indicator.error {
                color: #dd0000;
                background: #ffe6e6;
            }
        `;

        if (!document.querySelector('style[data-autosave]')) {
            const styleSheet = document.createElement('style');
            styleSheet.setAttribute('data-autosave', '1');
            styleSheet.textContent = style;
            document.head.appendChild(styleSheet);
        }

        // Insert after form or in parent
        const form = document.querySelector('form');
        if (form) {
            form.parentElement.appendChild(this.savingIndicator);
        } else {
            document.body.appendChild(this.savingIndicator);
        }
    }

    /**
     * Load saved profile
     */
    async loadProfile() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['currentProfile'], (result) => {
                const profile = result.currentProfile || {};
                this.lastSavedData = profile;
                resolve(profile);
            });
        });
    }

    /**
     * Clear auto-save
     */
    async clearSaveData() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ currentProfile: {} }, () => {
                this.lastSavedData = null;
                resolve();
            });
        });
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileAutoSave;
}
