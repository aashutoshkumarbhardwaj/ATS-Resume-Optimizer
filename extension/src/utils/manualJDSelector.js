/**
 * Manual JD Selector - Phase 2 Enhancement
 * Allows users to manually select and extract job description
 * Hover, highlight, click workflow
 */

class ManualJDSelector {
    constructor() {
        this.isSelecting = false;
        this.selectedElement = null;
        this.highlightStyle = null;
        this.originalText = '';
    }

    /**
     * Start manual JD selection mode
     */
    start(callback) {
        if (this.isSelecting) return;

        this.isSelecting = true;
        this.callback = callback;

        // Create and inject selection overlay
        this.createSelectionUI();

        // Add hover listeners
        document.addEventListener('mouseover', (e) => this.handleHover(e));
        document.addEventListener('mouseout', (e) => this.handleMouseOut(e));
        document.addEventListener('click', (e) => this.handleClick(e), true);

        console.log('[ManualJDSelector] Selection mode started');
        this.showInstructions();
    }

    /**
     * Stop selection mode
     */
    stop() {
        this.isSelecting = false;

        // Remove listeners
        document.removeEventListener('mouseover', this.handleHover);
        document.removeEventListener('mouseout', this.handleMouseOut);
        document.removeEventListener('click', this.handleClick);

        // Remove UI
        this.removeSelectionUI();

        console.log('[ManualJDSelector] Selection mode stopped');
    }

    /**
     * Handle hover over elements
     */
    handleHover(event) {
        if (!this.isSelecting) return;

        const target = event.target;

        // Remove previous highlighting
        if (this.selectedElement) {
            this.removeHighlight(this.selectedElement);
        }

        // Skip certain elements
        if (this.shouldSkip(target)) return;

        // Highlight current element
        this.highlightElement(target);
        this.selectedElement = target;
    }

    /**
     * Handle mouse out
     */
    handleMouseOut(event) {
        if (!this.isSelecting) return;

        // Don't remove highlight immediately
        // User might click
    }

    /**
     * Handle click on element
     */
    handleClick(event) {
        if (!this.isSelecting) return;

        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        const text = this.extractText(target);

        if (text && text.length > 100) {
            // Valid selection
            this.extractJobDescription(target);
        } else {
            this.showError('Please select a larger text area');
        }
    }

    /**
     * Highlight an element
     */
    highlightElement(element) {
        if (!element) return;

        const rect = element.getBoundingClientRect();

        // Create highlight overlay
        const highlight = document.createElement('div');
        highlight.className = 'jd-selector-highlight';
        highlight.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: rgba(74, 144, 226, 0.1);
            border: 2px solid #4A90E2;
            pointer-events: none;
            z-index: 2147483647;
            border-radius: 4px;
            box-shadow: 0 0 0 1px #4A90E2;
        `;

        document.body.appendChild(highlight);
        this.highlightStyle = highlight;

        // Change cursor
        element.style.cursor = 'pointer';
    }

    /**
     * Remove highlight
     */
    removeHighlight(element) {
        if (this.highlightStyle) {
            this.highlightStyle.remove();
            this.highlightStyle = null;
        }

        if (element) {
            element.style.cursor = '';
        }
    }

    /**
     * Extract text from element
     */
    extractText(element) {
        if (!element) return '';

        // Clone to avoid modifying DOM
        const clone = element.cloneNode(true);

        // Remove script, style, nav, footer
        clone.querySelectorAll('script, style, nav, footer, button, [role="banner"]').forEach(el => el.remove());

        return clone.textContent.trim();
    }

    /**
     * Extract job description from selected element
     */
    async extractJobDescription(element) {
        try {
            this.stop();
            this.showLoading('Extracting job description...');

            const text = this.extractText(element);

            if (!text || text.length < 100) {
                throw new Error('Selected text is too short');
            }

            // Try to parse job info
            const jobInfo = this.parseJobInfo(text, element);

            // Clean up loading indicator
            this.removeLoadingUI();

            // Call callback
            if (this.callback) {
                this.callback({
                    success: true,
                    description: text,
                    jobInfo,
                    source: 'manual_selection'
                });
            }

            this.showSuccess('Job description extracted successfully!');

        } catch (error) {
            console.error('[ManualJDSelector] Error extracting:', error);
            this.showError(error.message);
        }
    }

    /**
     * Parse job information from text
     */
    parseJobInfo(text, element) {
        const jobInfo = {
            description: text,
            title: '',
            company: '',
            location: ''
        };

        // Look for patterns in text
        const titleMatch = text.match(/(?:position|title|role):\s*(.+)/i);
        if (titleMatch) {
            jobInfo.title = titleMatch[1].split('\n')[0];
        }

        const companyMatch = text.match(/(?:company|employer):\s*(.+)/i);
        if (companyMatch) {
            jobInfo.company = companyMatch[1].split('\n')[0];
        }

        const locationMatch = text.match(/(?:location|city):\s*(.+)/i);
        if (locationMatch) {
            jobInfo.location = locationMatch[1].split('\n')[0];
        }

        // Fallback: get from page title
        if (!jobInfo.title) {
            const h1 = document.querySelector('h1');
            if (h1) jobInfo.title = h1.textContent.trim();
        }

        if (!jobInfo.company) {
            const companyEl = document.querySelector('[class*="company"]');
            if (companyEl) jobInfo.company = companyEl.textContent.trim();
        }

        return jobInfo;
    }

    /**
     * Check if element should be skipped
     */
    shouldSkip(element) {
        const skipTags = ['BUTTON', 'A', 'SCRIPT', 'STYLE', 'IMG'];
        if (skipTags.includes(element.tagName)) return true;

        // Skip navigation/footer
        if (element.tagName.match(/NAV|FOOTER|HEADER/)) return true;

        // Skip hidden elements
        if (element.style.display === 'none') return true;
        if (element.style.visibility === 'hidden') return true;

        return false;
    }

    /**
     * Create selection UI
     */
    createSelectionUI() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'jd-selector-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.1);
            z-index: 2147483646;
            cursor: crosshair;
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;

        // Create instructions
        const instructions = document.createElement('div');
        instructions.className = 'jd-selector-instructions';
        instructions.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 2147483648;
                max-width: 300px;
            ">
                <h4 style="margin: 0 0 8px 0;">Select Job Description</h4>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">
                    Hover over text to highlight, then click to select
                </p>
                <button id="jd-selector-cancel" style="
                    padding: 8px 12px;
                    background: #f0f0f0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">Cancel</button>
            </div>
        `;

        document.body.appendChild(instructions);
        this.instructions = instructions;

        // Add cancel button listener
        document.getElementById('jd-selector-cancel').addEventListener('click', () => {
            this.stop();
        });
    }

    /**
     * Remove selection UI
     */
    removeSelectionUI() {
        if (this.overlay) this.overlay.remove();
        if (this.instructions) this.instructions.remove();
        if (this.highlightStyle) this.highlightStyle.remove();
    }

    /**
     * Show instructions
     */
    showInstructions() {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #0066cc;
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            z-index: 2147483649;
            font-size: 12px;
        `;
        msg.textContent = '🔍 Hover and click to select job description';
        document.body.appendChild(msg);

        setTimeout(() => msg.remove(), 5000);
    }

    /**
     * Show loading indicator
     */
    showLoading(text) {
        const loader = document.createElement('div');
        loader.className = 'jd-selector-loading';
        loader.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px 30px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 2147483650;
            ">
                <div style="text-align: center;">
                    <div style="margin-bottom: 10px;">⏳</div>
                    <p style="margin: 0; font-size: 14px;">${text}</p>
                </div>
            </div>
        `;
        document.body.appendChild(loader);
        this.loader = loader;
    }

    /**
     * Remove loading indicator
     */
    removeLoadingUI() {
        if (this.loader) {
            this.loader.remove();
            this.loader = null;
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showNotification(message, '#00aa44');
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, '#dd0000');
    }

    /**
     * Show notification
     */
    showNotification(message, color) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            z-index: 2147483649;
            font-size: 12px;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 4000);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManualJDSelector;
}
