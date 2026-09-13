/**
 * Autonomous Agent Orchestrator
 * Coordinates Application Understanding Engine (Perception),
 * Virtual Cursor Engine (Visual Action), and Personal Agent Brain (Reasoning).
 * Implements the autonomous CUA loop inspired by browser-use.
 */

class AutonomousAgentOrchestrator {
    constructor() {
        const CursorClass = (typeof window !== 'undefined' && window.VirtualCursorEngine) || (typeof VirtualCursorEngine !== 'undefined' ? VirtualCursorEngine : null);
        const BrainClass = (typeof window !== 'undefined' && window.PersonalAgentBrain) || (typeof PersonalAgentBrain !== 'undefined' ? PersonalAgentBrain : null);
        const AutomationClass = (typeof window !== 'undefined' && window.BrowserAutomationModule) || (typeof BrowserAutomationModule !== 'undefined' ? BrowserAutomationModule : null);
        const AUEClass = (typeof window !== 'undefined' && window.ApplicationUnderstandingEngine) || (typeof ApplicationUnderstandingEngine !== 'undefined' ? ApplicationUnderstandingEngine : null);

        this.cursor = CursorClass ? new CursorClass() : null;
        this.brain = BrainClass ? new BrainClass() : null;
        this.automation = AutomationClass ? new AutomationClass() : null;
        this.aue = AUEClass ? new AUEClass() : null;
        this.isRunning = false;
        this.isPaused = false;
        this.state = 'IDLE'; // 'IDLE' | 'PERCEIVING' | 'INSPECTING' | 'FILLING' | 'AWAITING_INPUT' | 'SUBMITTING' | 'COMPLETED' | 'STOPPED'
        this.stats = { filled: 0, skipped: 0, failed: 0, total: 0 };
    }

    /**
     * Formal Finite State Machine (FSM) state transition
     */
    setState(newState, statusText = null, icon = '🤖') {
        this.state = newState;
        console.log(`[AgentOrchestrator] 🔄 State -> ${newState}${statusText ? ` (${statusText})` : ''}`);
        if (statusText && this.cursor && typeof this.cursor.setStatus === 'function') {
            this.cursor.setStatus(statusText, icon, newState === 'AWAITING_INPUT' ? 'asking' : (newState === 'COMPLETED' ? 'idle' : 'moving'));
        }
    }

    /**
     * Start the autonomous visual agent loop
     */
    async start(options = {}) {
        if (this.isRunning) {
            console.warn('[AgentOrchestrator] ⚠️ Agent is already running');
            return;
        }

        // Lazy initialize dependencies if not ready during constructor
        if (!this.cursor) {
            const CursorClass = (typeof window !== 'undefined' && window.VirtualCursorEngine) || (typeof VirtualCursorEngine !== 'undefined' ? VirtualCursorEngine : null);
            if (CursorClass) this.cursor = new CursorClass();
        }
        if (!this.brain) {
            const BrainClass = (typeof window !== 'undefined' && window.PersonalAgentBrain) || (typeof PersonalAgentBrain !== 'undefined' ? PersonalAgentBrain : null);
            if (BrainClass) this.brain = new BrainClass();
        }
        if (!this.automation) {
            const AutomationClass = (typeof window !== 'undefined' && window.BrowserAutomationModule) || (typeof BrowserAutomationModule !== 'undefined' ? BrowserAutomationModule : null);
            if (AutomationClass) this.automation = new AutomationClass();
        }
        if (!this.aue) {
            const AUEClass = (typeof window !== 'undefined' && window.ApplicationUnderstandingEngine) || (typeof ApplicationUnderstandingEngine !== 'undefined' ? ApplicationUnderstandingEngine : null);
            if (AUEClass) this.aue = new AUEClass();
        }

        if (!this.cursor) {
            throw new Error('VirtualCursorEngine is not available. Please reload the webpage.');
        }

        this.isRunning = true;
        this.isPaused = false;
        this.filledFieldsRecord = [];
        this.stats = (options.session && options.session.stats) ? Object.assign({ filled: 0, skipped: 0, failed: 0, total: 0 }, options.session.stats) : { filled: 0, skipped: 0, failed: 0, total: 0 };
        this.sessionId = options.session?.sessionId || `session_${Date.now()}`;
        this.sessionStartedAt = options.session?.startedAt || Date.now();

        if (typeof window !== 'undefined') {
            window.__autonomousAgentOrchestratorInstance = this;
        }

        // Wire HUD stop button callback
        this.cursor.onStop = () => {
            console.log('[AgentOrchestrator] ⏹ Stop requested via Virtual Cursor HUD');
            this.stop(true);
        };

        // Ensure page unload immediately stops the agent and wipes the session so reloads never auto-run
        this.beforeUnloadHandler = () => {
            this.isRunning = false;
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.remove(['autonomousAgentSession']);
                }
            } catch (e) {}
        };
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('beforeunload', this.beforeUnloadHandler);
        }

        console.log('[AgentOrchestrator] 🚀 Launching Autonomous Visual Agent...');
        await this.saveAgentSession({ profile: options.profile });

        try {
            // Step 1: Mount the virtual cursor overlay & thought HUD
            this.cursor.mount();
            if (options.resumeSession) {
                this.cursor.setStatus('Resumed on application page! Scanning fields...', '🔄', 'moving');
            } else {
                this.cursor.setStatus('Initializing Agent...', '🤖', 'moving');
            }

            // Step 2: Initialize Personal Agent Brain
            if (this.brain) {
                await this.brain.init();
                if (options.profile) {
                    this.brain.profile = Object.assign({}, this.brain.profile, options.profile);
                }
            }

            // Extract Job Title and Company Context
            const pageContext = this.extractPageContext();

            // Multi-Page Progression Loop (supports forms spanning up to 15 pages)
            let currentPage = 1;
            const MAX_PAGES = 15;

            while (this.isRunning && currentPage <= MAX_PAGES) {
                console.log(`[AgentOrchestrator] 📄 Processing Page ${currentPage}...`);
                this.cursor.setStatus(`Scanning Page ${currentPage}...`, '🔍', 'moving');

                // Step 2.5: Check for Captcha / Cloudflare security verification
                await this.checkAndHandleCaptcha();

                // Step 3: Run Perception Analysis on Current Page
                let formStructure = null;
                if (this.aue && typeof this.aue.analyzeApplication === 'function') {
                    formStructure = await this.aue.analyzeApplication();
                } else {
                    const rawInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="listbox"]'))
                        .filter(el => this.isJobApplicationField(el));
                    formStructure = {
                        fields: rawInputs.map(el => {
                            const tag = (el.tagName || '').toLowerCase();
                            const role = (typeof el.getAttribute === 'function' ? el.getAttribute('role') : '') || '';
                            return {
                                element: el,
                                type: tag === 'select' ? 'select' : (role === 'combobox' || role === 'listbox' ? 'custom-select' : (el.type || 'text')),
                                label: (this.aue && typeof this.aue.extractLabel === 'function') ? this.aue.extractLabel(el) : ((typeof el.getAttribute === 'function' ? el.getAttribute('aria-label') : '') || el.placeholder || el.name || el.id || ''),
                                name: el.name || el.id || ''
                            };
                        })
                    };
                }

                let pageFields = (formStructure && formStructure.fields) ? formStructure.fields.filter(f => this.isJobApplicationField(f.element)) : [];
                console.log(`[AgentOrchestrator] Page ${currentPage}: ${pageFields.length} application fields detected.`);

                // If on Page 1 and no form fields are detected, scan for Apply button or Job card
                if (pageFields.length === 0 && currentPage === 1) {
                    console.log('[AgentOrchestrator] No application fields on screen yet. Scanning for Apply button or Job card...');
                    const openedApply = await this.handleInitialApplyButton();
                    if (openedApply) {
                        // Re-run perception analysis now that application form / modal has opened
                        if (this.aue && typeof this.aue.analyzeApplication === 'function') {
                            formStructure = await this.aue.analyzeApplication();
                        } else {
                            const rawInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="listbox"]'))
                                .filter(el => this.isJobApplicationField(el));
                            formStructure = {
                                fields: rawInputs.map(el => {
                                    const tag = (el.tagName || '').toLowerCase();
                                    const role = (typeof el.getAttribute === 'function' ? el.getAttribute('role') : '') || '';
                                    return {
                                        element: el,
                                        type: tag === 'select' ? 'select' : (role === 'combobox' || role === 'listbox' ? 'custom-select' : (el.type || 'text')),
                                        label: (this.aue && typeof this.aue.extractLabel === 'function') ? this.aue.extractLabel(el) : ((typeof el.getAttribute === 'function' ? el.getAttribute('aria-label') : '') || el.placeholder || el.name || el.id || ''),
                                        name: el.name || el.id || ''
                                    };
                                })
                            };
                        }
                        pageFields = (formStructure && formStructure.fields) ? formStructure.fields.filter(f => this.isJobApplicationField(f.element)) : [];
                        console.log(`[AgentOrchestrator] Re-scanned after Apply click: ${pageFields.length} application fields detected.`);
                    }
                }

                if (pageFields.length === 0) {
                    // Resilient polling retry (up to 5 seconds) for SPA dynamic rendering (Workday, Lever, Greenhouse)
                    const pollStart = Date.now();
                    while (Date.now() - pollStart < 5000 && pageFields.length === 0 && this.isRunning) {
                        await this.cursor.sleep(600);
                        const retryInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="listbox"]'))
                            .filter(el => this.isJobApplicationField(el));
                        if (retryInputs.length > 0) {
                            pageFields = retryInputs.map(el => ({
                                element: el,
                                type: el.tagName === 'SELECT' ? 'select' : (el.getAttribute('role') === 'combobox' ? 'custom-select' : (el.type || 'text')),
                                label: (this.aue && typeof this.aue.extractLabel === 'function') ? this.aue.extractLabel(el) : ((typeof el.getAttribute === 'function' ? el.getAttribute('aria-label') : '') || el.placeholder || el.name || el.id || ''),
                                name: el.name || el.id || ''
                            }));
                            console.log(`[AgentOrchestrator] 📋 Dynamic poll found ${pageFields.length} application fields.`);
                            break;
                        }
                    }
                }

                if (pageFields.length === 0) {
                    this.cursor.setStatus('No form fields detected on this page', 'ℹ️', 'idle');
                    await this.cursor.sleep(2000);
                    break;
                }

                this.stats.total += pageFields.length;

                let pageFilledCount = 0;

                // Step 4: Execute Autonomous Fill Loop for Current Page in strict visual sequence
                pageFields = this.sortFieldsSequentially(pageFields);
                const processedElements = new Set();

                for (let i = 0; i < pageFields.length; i++) {
                    if (!this.isRunning) break;

                    const field = pageFields[i];
                    const element = field.element || (field.id ? document.getElementById(field.id) : null);

                    // Skip hidden, disabled, non-visible, or already processed elements
                    if (!element || processedElements.has(element) || !this.isElementVisible(element) || element.disabled) {
                        this.stats.skipped++;
                        continue;
                    }
                    processedElements.add(element);

                    // 1. Move Virtual Cursor smoothly and sequentially to element (monotonic downward progression)
                    this.cursor.setStatus(`Checking: ${field.label || 'Field'}...`, '👀', 'moving');
                    await this.cursor.moveTo(element);

                    // Verify if field is already filled with a valid user choice
                    if (this.isFieldAlreadyFilled(field, element)) {
                        const currentVal = (element.value || element.textContent || '').trim();
                        console.log(`[AgentOrchestrator] ✅ Field already filled & valid: "${field.label}" = "${currentVal}". Leaving as is.`);
                        this.cursor.setStatus(`Verified: ${field.label || 'Field'} ✅`, '✅', 'idle');
                        this.cursor.highlightElement(element);
                        // Mark all radio buttons in this group as processed
                        if (element.type === 'radio' && element.name) {
                            const groupRadios = document.querySelectorAll(`input[name="${element.name}"]`);
                            groupRadios.forEach(r => processedElements.add(r));
                        }
                        this.filledFieldsRecord.push({
                            id: field.id || field.name || field.label,
                            label: field.label,
                            intent: field.intent || field.semanticIntent?.intent,
                            type: field.type,
                            value: currentVal,
                            status: 'pre_filled'
                        });
                        if (currentVal.length > 0 && this.brain && typeof this.brain.saveToMemory === 'function') {
                            this.brain.saveToMemory(field.label, currentVal, field);
                        }
                        await this.cursor.sleep(180);
                        continue;
                    }

                    // 2. Handle File / Resume Upload directly if element is file input
                    if (field.type === 'file' || element.type === 'file' || /resume|cv|file\s*upload/i.test(field.label || '')) {
                        if (element.tagName === 'INPUT' && element.type === 'file') {
                            const fileUploaded = await this.handleFileUploadAction(field);
                            if (fileUploaded) {
                                this.stats.filled++;
                                pageFilledCount++;
                                this.filledFieldsRecord.push({
                                    id: field.id || field.name || field.label,
                                    label: field.label,
                                    intent: 'resume_upload',
                                    type: 'file',
                                    value: 'uploaded',
                                    status: 'auto_filled'
                                });
                                await this.cursor.sleep(300);
                                continue;
                            }
                        }
                    }

                    // 3. Ask Personal Agent Brain to resolve answer from database & profile
                    this.cursor.setStatus(`Consulting Personal Agent...`, '🧠', 'thinking');
                    const context = {
                        jobTitle: pageContext.jobTitle,
                        company: pageContext.company,
                        virtualCursor: this.cursor
                    };

                    const resolution = await this.brain.resolveAnswer(field, context);
                    let answer = resolution ? resolution.value : null;

                    // 4. Asterisk (*) & Required Field Guarantee:
                    // If field has an asterisk or is required and not in database, prompt the user so it is NEVER skipped!
                    const isRequiredField = field.required || 
                                           (this.engine && typeof this.engine.isRequired === 'function' && this.engine.isRequired(element)) ||
                                           (field.label && (field.label.includes('*') || /\brequired\b/i.test(field.label))) || 
                                           (typeof element.hasAttribute === 'function' && (element.hasAttribute('required') || element.getAttribute('aria-required') === 'true'));

                    if (answer === null || answer === undefined || answer === '') {
                        if (isRequiredField) {
                            console.log(`[AgentOrchestrator] ⚠️ Asterisk (*) / Required field "${field.label}" not in database. Prompting user...`);
                            this.cursor.setStatus(`Required Question (*): "${field.label}"`, '⚠️', 'asking');
                            this.cursor.highlightElement(element);

                            let optionsList = (field.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value)).filter(Boolean);
                            if (optionsList.length === 0 && element.tagName === 'SELECT') {
                                optionsList = Array.from(element.options).map(o => o.text.trim()).filter(t => t && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(t));
                            }
                            optionsList = optionsList.slice(0, 8);

                            const userChoice = await this.cursor.askUser(
                                `Required Field (*): ${field.label}`,
                                optionsList
                            );

                            if (userChoice && String(userChoice).trim() !== '') {
                                answer = userChoice.trim();
                                if (this.brain && typeof this.brain.saveToMemory === 'function') {
                                    this.brain.saveToMemory(field.label, answer, field);
                                }
                            }
                        }

                        if (answer === null || answer === undefined || answer === '') {
                            console.log(`[AgentOrchestrator] Optional field "${field.label}" skipped.`);
                            this.stats.skipped++;
                            continue;
                        }
                    }

                    // 5. Execute Visual Action & Native Typing / Dropdown Selection
                    const success = await this.executeAction(field, answer, isRequiredField);
                    if (success !== false) {
                        this.stats.filled++;
                        pageFilledCount++;
                        this.filledFieldsRecord.push({
                            id: field.id || field.name || field.label,
                            label: field.label,
                            intent: field.intent || field.semanticIntent?.intent,
                            type: field.type,
                            value: answer,
                            status: 'auto_filled'
                        });
                    } else {
                        this.stats.failed++;
                    }

                    // 6. Dynamically check if new conditional fields were unlocked on the form
                    const knownElements = new Set([
                        ...processedElements,
                        ...pageFields.map(f => f.element || (f.id && typeof document !== 'undefined' ? document.getElementById(f.id) : null)).filter(Boolean)
                    ]);
                    const newlyRevealed = this.detectNewlyRevealedFields(knownElements);
                    if (newlyRevealed.length > 0) {
                        console.log(`[AgentOrchestrator] 💡 Found ${newlyRevealed.length} newly revealed conditional fields. Merging into sequence.`);
                        const remaining = pageFields.slice(i + 1);
                        const mergedRemaining = this.sortFieldsSequentially([...remaining, ...newlyRevealed]);
                        pageFields = [...pageFields.slice(0, i + 1), ...mergedRemaining];
                    }

                    await this.cursor.sleep(250);
                }

                // Step 5: Check for Next / Progression Button to advance to Page N+1
                const advanced = await this.handleNextStepProgression();
                if (advanced) {
                    currentPage++;
                    await this.waitForPageTransition();
                } else {
                    // No Next button found: reached final submit or end of multi-page form
                    await this.handlePreSubmissionReview(pageContext);
                    break;
                }
            }

            if (this.stats.filled > 0) {
                this.cursor.setStatus(`Completed! Filled ${this.stats.filled} fields across ${currentPage} page(s) 🎉`, '✅', 'idle');
            } else {
                this.cursor.setStatus(`Completed scan: ${this.stats.total} fields inspected`, 'ℹ️', 'idle');
            }
            await this.cursor.sleep(3500);

            return { status: 'COMPLETED', stats: this.stats };
        } catch (error) {
            console.error('[AgentOrchestrator] ❌ Execution error:', error);
            this.cursor.setStatus(`Error: ${error.message}`, '❌', 'error');
            await this.cursor.sleep(3000);
            return { status: 'ERROR', error: error.message, stats: this.stats };
        } finally {
            this.stop();
        }
    }

    /**
     * Execute interaction (click, type, select, file upload)
     */
    async executeAction(field, answer, isRequiredField = false) {
        const element = field.element;
        if (!element) return false;
        const fieldType = field.type;

        // 1. File Upload (Resume / Document attachment)
        if (fieldType === 'file' || element.type === 'file' || (element.tagName === 'INPUT' && element.type === 'file')) {
            return await this.handleFileUploadAction(field);
        }

        // 2. Select & Custom Dropdowns
        if (fieldType === 'select' || fieldType === 'custom-select') {
            return await this.selectFromDropdown(field, answer, isRequiredField);
        } else if (fieldType === 'radio' || element.type === 'radio') {
            return await this.selectRadioButton(field, answer, isRequiredField);
        } else if (fieldType === 'checkbox' || element.type === 'checkbox') {
            this.cursor.setStatus(`Clicking: ${field.label}`, '🖱️', 'moving');
            await this.cursor.moveTo(element);
            this.cursor.highlightElement(element);
            await this.cursor.click(element);
            element.click();
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } else {
            // Text inputs, textareas, search inputs, dates
            this.cursor.setStatus(`Typing: ${field.label}...`, '✍️', 'typing');
            await this.cursor.moveTo(element);
            await this.cursor.click(element);
            await this.cursor.type(element, answer, { humanSpeed: true });
            return true;
        }
    }

    /**
     * Accurately select the matching radio button from an option group
     */
    async selectRadioButton(field, answer, isRequiredField = false) {
        const element = field.element || (field.id ? document.getElementById(field.id) : null);
        if (!element) return false;

        const name = element.name;
        let radioGroup = [];
        if (name) {
            radioGroup = Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`));
        }
        if (radioGroup.length === 0) {
            const container = (typeof element.closest === 'function' ? element.closest('fieldset, [role="radiogroup"], .form-group, .question, .field') : null) || element.parentElement;
            if (container) {
                radioGroup = Array.from(container.querySelectorAll('input[type="radio"]'));
            }
        }
        if (radioGroup.length === 0) {
            radioGroup = [element];
        }

        const ansLower = String(answer || '').trim().toLowerCase();

        // Helper to extract label text associated with a radio button
        const getRadioLabel = (r) => {
            let labelText = '';
            if (r.id) {
                const l = document.querySelector(`label[for="${r.id}"]`);
                if (l) labelText = l.textContent || '';
            }
            if (!labelText && r.parentElement) {
                labelText = r.parentElement.textContent || '';
            }
            if (!labelText && r.nextElementSibling && r.nextElementSibling.tagName === 'LABEL') {
                labelText = r.nextElementSibling.textContent || '';
            }
            return (labelText || r.value || '').trim().toLowerCase();
        };

        // Find best matching radio
        let targetRadio = null;

        // 1. Exact match by value or label
        targetRadio = radioGroup.find(r => {
            const val = (r.value || '').trim().toLowerCase();
            const lbl = getRadioLabel(r);
            return val === ansLower || lbl === ansLower;
        });

        // 2. Gender specific matching
        if (!targetRadio && /male|man/i.test(ansLower) && !/fe/i.test(ansLower)) {
            targetRadio = radioGroup.find(r => {
                const val = (r.value || '').trim().toLowerCase();
                const lbl = getRadioLabel(r);
                return /^(male|man|m)$/i.test(val) || (/male/i.test(lbl) && !/female/i.test(lbl));
            });
        } else if (!targetRadio && /female|woman/i.test(ansLower)) {
            targetRadio = radioGroup.find(r => {
                const val = (r.value || '').trim().toLowerCase();
                const lbl = getRadioLabel(r);
                return /^(female|woman|f)$/i.test(val) || /female/i.test(lbl);
            });
        }

        // 3. Boolean Yes / No matching
        if (!targetRadio && /^(yes|true|y)$/i.test(ansLower)) {
            targetRadio = radioGroup.find(r => {
                const val = (r.value || '').trim().toLowerCase();
                const lbl = getRadioLabel(r);
                return /^(yes|true|y)$/i.test(val) || /^(yes|true|y)$/i.test(lbl);
            });
        } else if (!targetRadio && /^(no|false|n)$/i.test(ansLower)) {
            targetRadio = radioGroup.find(r => {
                const val = (r.value || '').trim().toLowerCase();
                const lbl = getRadioLabel(r);
                return /^(no|false|n)$/i.test(val) || /^(no|false|n)$/i.test(lbl);
            });
        }

        // 4. Substring matching
        if (!targetRadio && ansLower.length > 2) {
            targetRadio = radioGroup.find(r => {
                const val = (r.value || '').trim().toLowerCase();
                const lbl = getRadioLabel(r);
                return lbl.includes(ansLower) || ansLower.includes(lbl) || val.includes(ansLower);
            });
        }

        // Prompt user if required and not matched
        if (!targetRadio && isRequiredField && this.cursor && typeof this.cursor.askUser === 'function') {
            const choices = radioGroup.map(r => getRadioLabel(r) || r.value).filter(Boolean);
            if (choices.length > 0) {
                const userChoice = await this.cursor.askUser(`Required Option (*): ${field.label}`, choices);
                if (userChoice) {
                    targetRadio = radioGroup.find(r => getRadioLabel(r) === userChoice.toLowerCase().trim() || r.value === userChoice);
                    if (this.brain && typeof this.brain.saveToMemory === 'function') {
                        this.brain.saveToMemory(field.label, userChoice, field);
                    }
                }
            }
        }

        if (targetRadio) {
            const rLabel = getRadioLabel(targetRadio);
            if (this.cursor) {
                this.cursor.setStatus(`Selecting option: "${rLabel || targetRadio.value}"...`, '🔘', 'moving');
                await this.cursor.moveTo(targetRadio);
                this.cursor.highlightElement(targetRadio);
                await this.cursor.click(targetRadio);
            }
            targetRadio.checked = true;
            if (typeof targetRadio.click === 'function') targetRadio.click();
            targetRadio.dispatchEvent(new Event('input', { bubbles: true }));
            targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }

        return false;
    }

    /**
     * Determine if a field is truly pre-filled with a valid user value
     */
    isFieldAlreadyFilled(field, element) {
        if (!element) return false;

        // 1. File Inputs
        if (field.type === 'file' || element.type === 'file') {
            return !!(element.files && element.files.length > 0);
        }

        // 2. Radio & Checkbox
        if (field.type === 'radio' || field.type === 'checkbox' || element.type === 'radio' || element.type === 'checkbox') {
            if (element.type === 'radio' && element.name) {
                const checkedRadio = document.querySelector(`input[name="${element.name}"]:checked`);
                return !!checkedRadio;
            }
            return !!element.checked;
        }

        // 3. HTML <select> Element
        if (element.tagName === 'SELECT') {
            if (element.selectedIndex < 0) return false;
            const opt = element.options[element.selectedIndex];
            if (!opt) return false;
            const text = (opt.text || '').trim();
            const val = (opt.value || '').trim();
            if (!val && !text) return false;
            return !/^(?:select|choose|--|\bselect\s*an\s*option\b|\bchoose\s*one\b|\bnone\b)$/i.test(text);
        }

        // 4. Custom Dropdowns, Comboboxes & ARIA listboxes
        if (field.type === 'custom-select' || (typeof element.getAttribute === 'function' && (element.getAttribute('role') === 'combobox' || element.getAttribute('role') === 'listbox'))) {
            const ariaSelected = (typeof element.querySelector === 'function') 
                ? element.querySelector('[aria-selected="true"], [class*="singleValue"], .selected-option, .is-selected, [class*="value-container"]')
                : null;
            if (ariaSelected) {
                const text = (ariaSelected.textContent || '').trim();
                return text.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(text) && text.toLowerCase() !== (field.label || '').toLowerCase();
            }

            const valAttr = (typeof element.getAttribute === 'function' ? (element.getAttribute('data-value') || element.getAttribute('aria-valuenow')) : '') || '';
            if (valAttr && !/^(?:select|choose|--)/i.test(valAttr)) return true;

            const innerText = (element.innerText || element.textContent || '').trim();
            if (innerText.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(innerText) && innerText.toLowerCase() !== (field.label || '').toLowerCase()) {
                return true;
            }
            return false;
        }

        // 5. Contenteditable & ARIA textbox
        if ((typeof element.hasAttribute === 'function' && element.hasAttribute('contenteditable')) || (typeof element.getAttribute === 'function' && element.getAttribute('role') === 'textbox')) {
            const text = (element.innerText || element.textContent || '').trim();
            return text.length > 0 && text.toLowerCase() !== (field.label || '').toLowerCase();
        }

        // 6. Text inputs, textareas, search inputs, dates
        const val = (element.value || '').trim();
        const placeholder = (element.placeholder || '').trim();
        if (!val) return false;
        if (placeholder && val.toLowerCase() === placeholder.toLowerCase()) return false;
        return true;
    }

    /**
     * Automatically attach user resume to file input without popping OS file dialog
     */
    async handleFileUploadAction(field) {
        const element = field.element || (field.id ? document.getElementById(field.id) : null);
        if (!element) return false;

        this.cursor.setStatus(`Attaching Resume file...`, '📎', 'moving');
        await this.cursor.moveTo(element);
        this.cursor.highlightElement(element);

        // Fetch stored resume from storage
        let resumeBlob = null;
        let resumeName = 'Resume.pdf';
        let candidateName = '';

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const data = await new Promise((resolve) => {
                chrome.storage.local.get(['resume', 'parsedResume', 'uploadedResume', 'default_resume'], resolve);
            });

            if (data.resume && data.resume.text) {
                resumeBlob = new Blob([data.resume.text], { type: 'application/pdf' });
                candidateName = (data.resume.metadata && data.resume.metadata.filename) || '';
            } else if (data.uploadedResume && data.uploadedResume.content) {
                resumeBlob = new Blob([data.uploadedResume.content], { type: 'application/pdf' });
                candidateName = data.uploadedResume.filename || '';
            } else if (this.brain && this.brain.resumeText) {
                resumeBlob = new Blob([this.brain.resumeText], { type: 'application/pdf' });
            }
        }

        if (!resumeBlob && this.brain && this.brain.resumeText) {
            resumeBlob = new Blob([this.brain.resumeText], { type: 'application/pdf' });
        }

        // Tailor resume filename to target job & applicant name for maximum ATS compatibility
        const pageContext = this.extractPageContext();
        const userName = (this.brain && this.brain.profile && (this.brain.profile.full_name || `${this.brain.profile.first_name || ''} ${this.brain.profile.last_name || ''}`.trim())) || 'Applicant';
        const roleClean = (pageContext.jobTitle || '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);
        const nameClean = userName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
        
        if (roleClean && nameClean && roleClean !== 'Target_Position') {
            resumeName = `${nameClean}_${roleClean}_Resume.pdf`;
        } else if (candidateName) {
            resumeName = candidateName;
        } else {
            resumeName = `${nameClean || 'Applicant'}_Resume.pdf`;
        }

        if (resumeBlob && typeof DataTransfer !== 'undefined' && typeof File !== 'undefined') {
            const file = new File([resumeBlob], resumeName, { type: 'application/pdf' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            element.files = dataTransfer.files;

            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            this.cursor.setStatus(`Attached Resume: "${resumeName}" 🎉`, '📎', 'idle');
            await this.cursor.sleep(600);
            return true;
        }

        console.warn('[AgentOrchestrator] No resume file available in storage to attach.');
        return false;
    }

    /**
     * Select from HTML <select> or custom web dropdowns, comboboxes, and scrollable listboxes
     */
    async selectFromDropdown(field, answer, isRequiredField = false) {
        const element = field.element || (field.id ? document.getElementById(field.id) : null);
        if (!element) return false;

        const targetText = String(answer || '').trim().toLowerCase();
        if (!targetText && !isRequiredField) return false;

        // --- 1. Standard HTML <select> Element ---
        if (element.tagName === 'SELECT') {
            if (this.cursor) {
                this.cursor.setStatus(`Selecting option: "${answer || field.label}"...`, '🖱️', 'moving');
                await this.cursor.moveTo(element);
                this.cursor.highlightElement(element);
                await this.cursor.click(element);
            }

            const options = Array.from(element.options);
            let opt = null;
            if (targetText) {
                // Priority 1: Exact match by text or value
                opt = options.find(o => 
                    o.text.toLowerCase().trim() === targetText ||
                    o.value.toLowerCase().trim() === targetText
                );

                // Priority 2: Gender specific matching (never match female for male)
                if (!opt && /male|man/i.test(targetText) && !/fe/i.test(targetText)) {
                    opt = options.find(o => {
                        const t = o.text.toLowerCase().trim();
                        return (/^(male|man|m)$/i.test(t) || (t.includes('male') && !t.includes('female')));
                    });
                } else if (!opt && /female|woman/i.test(targetText)) {
                    opt = options.find(o => {
                        const t = o.text.toLowerCase().trim();
                        return (/^(female|woman|f)$/i.test(t) || t.includes('female'));
                    });
                }

                // Priority 3: Country code matching
                if (!opt && (targetText.includes('+91') || targetText === '91' || targetText.includes('india'))) {
                    opt = options.find(o => {
                        const t = (o.text + ' ' + o.value).toLowerCase();
                        return t.includes('+91') || t.includes('india') || t.includes('(91)');
                    });
                }

                // Priority 4: Safe substring matching
                if (!opt && !/^(male|man|m|fe)$/i.test(targetText)) {
                    opt = options.find(o =>
                        o.text.toLowerCase().includes(targetText) ||
                        (targetText.length > 4 && targetText.includes(o.text.toLowerCase().trim())) ||
                        o.value.toLowerCase().includes(targetText)
                    );
                }
            }

            if (!opt && isRequiredField && this.cursor && typeof this.cursor.askUser === 'function') {
                const choices = options.map(o => o.text.trim()).filter(t => t && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(t)).slice(0, 8);
                if (choices.length > 0) {
                    const picked = await this.cursor.askUser(`Required Dropdown (*): ${field.label}`, choices);
                    if (picked) {
                        opt = options.find(o => o.text.trim().toLowerCase() === picked.toLowerCase().trim());
                        if (opt && this.brain && typeof this.brain.saveToMemory === 'function') {
                            this.brain.saveToMemory(field.label, picked, field);
                        }
                    }
                }
            }

            if (opt) {
                element.value = opt.value;
                opt.selected = true;
                const idx = options.indexOf(opt);
                if (idx !== -1) element.selectedIndex = idx;
                try {
                    const selectSetter = (typeof window !== 'undefined' && window.HTMLSelectElement) 
                        ? Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
                        : null;
                    if (selectSetter) selectSetter.call(element, opt.value);
                } catch (e) {}
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.blur();
                return true;
            }
            return false;
        }

        // --- 2. Custom Web Dropdowns, Comboboxes & Scrollable Listboxes ---
        this.cursor.setStatus(`Opening dropdown: ${field.label || 'Choice'}...`, '📂', 'moving');
        await this.cursor.moveTo(element);
        this.cursor.highlightElement(element);
        await this.cursor.click(element);

        // Human-like click to trigger framework dropdown state
        if (this.automation && typeof this.automation.clickHumanLike === 'function') {
            await this.automation.clickHumanLike(element);
        } else {
            element.click();
        }

        // Allow popup animation to complete
        await this.cursor.sleep(400);

        // Check if there is an inner search input to filter options
        const searchInput = document.querySelector('input[type="search"], input[role="searchbox"], [role="listbox"] input, .select-menu input, [class*="search"] input');
        if (searchInput && this.isElementVisible(searchInput)) {
            await this.cursor.moveTo(searchInput);
            await this.cursor.type(searchInput, targetText, { humanSpeed: true });
            await this.cursor.sleep(300);
        }

        // Collect candidate options from open dropdown or portal
        const optionSelectors = [
            '[role="option"]',
            '.office-form-theme-dropdown-item',
            '.office-form-question-dropdown-item',
            '.ms-Dropdown-item',
            '[data-automation-id="selectOption"]',
            '.ant-select-item-option',
            '.select-option',
            '[class*="option-item"]',
            '[class*="menu-item"]',
            '.MuiMenuItem-root',
            'li[role="option"]'
        ];

        let candidateOptions = [];
        for (const sel of optionSelectors) {
            const found = Array.from(document.querySelectorAll(sel)).filter(el => this.isElementVisible(el));
            if (found.length > 0) {
                candidateOptions = found;
                break;
            }
        }

        // Fallback: look inside nearby or active listbox containers
        if (candidateOptions.length === 0) {
            const listbox = document.querySelector('[role="listbox"]:not([aria-hidden="true"]), .office-form-theme-listbox, .ms-Dropdown-items, .select-options, ul[role="listbox"]');
            if (listbox) {
                candidateOptions = Array.from(listbox.querySelectorAll('li, div[tabindex], span[tabindex], div')).filter(el => {
                    return this.isElementVisible(el) && (el.textContent || '').trim().length > 0;
                });
            }
        }

        console.log(`[AgentOrchestrator] Found ${candidateOptions.length} dropdown options for "${targetText}".`);

        if (candidateOptions.length > 0) {
            // Priority 1: Exact match
            let matchedOption = candidateOptions.find(opt => {
                const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                return text === targetText;
            });

            // Priority 2: Gender specific matching (never match female for male)
            if (!matchedOption && /male|man/i.test(targetText) && !/fe/i.test(targetText)) {
                matchedOption = candidateOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return (/^(male|man|m)$/i.test(text) || (text.includes('male') && !text.includes('female')));
                });
            } else if (!matchedOption && /female|woman/i.test(targetText)) {
                matchedOption = candidateOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return (/^(female|woman|f)$/i.test(text) || text.includes('female'));
                });
            }

            // Priority 3: Country code matching
            if (!matchedOption && (targetText.includes('+91') || targetText === '91' || targetText.includes('india'))) {
                matchedOption = candidateOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return text.includes('+91') || text.includes('india') || text.includes('(91)');
                });
            }

            // Priority 4: Substring match (avoiding male inside female)
            if (!matchedOption && !/^(male|man|m|fe)$/i.test(targetText)) {
                matchedOption = candidateOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return text.includes(targetText) || (targetText.length > 4 && targetText.includes(text));
                });
            }

            // Priority 5: Token / word overlap match
            if (!matchedOption && !/^(male|man|m|fe)$/i.test(targetText)) {
                const tokens = targetText.split(/\s+/).filter(w => w.length > 2);
                matchedOption = candidateOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return tokens.some(tok => text.includes(tok));
                });
            }

            // Interactive Fallback: If not matched and field is required (or user-promptable), prompt user with visible options
            if (!matchedOption && isRequiredField && this.cursor && typeof this.cursor.askUser === 'function') {
                const choices = candidateOptions
                    .map(opt => (opt.textContent || opt.innerText || '').trim())
                    .filter(t => t.length > 0 && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(t))
                    .slice(0, 8);
                if (choices.length > 0) {
                    this.cursor.setStatus(`Choose option for: "${field.label}"`, '❓', 'asking');
                    const picked = await this.cursor.askUser(`Required Field (*): ${field.label}`, choices);
                    if (picked) {
                        matchedOption = candidateOptions.find(opt => 
                            (opt.textContent || opt.innerText || '').trim().toLowerCase() === picked.toLowerCase().trim()
                        );
                        if (this.brain && typeof this.brain.saveToMemory === 'function') {
                            this.brain.saveToMemory(field.label, picked, field);
                        }
                    }
                }
            }

            if (matchedOption) {
                const optText = (matchedOption.textContent || '').trim();
                this.cursor.setStatus(`Selecting: "${optText}"...`, '🎯', 'moving');

                // SCROLL DOWN into view if inside an overflowing / scrollable container
                const scrollParent = this.getScrollableParent(matchedOption);
                if (scrollParent) {
                    matchedOption.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    await this.cursor.sleep(300);
                }

                // Move virtual cursor smoothly to the scrolled option
                await this.cursor.moveTo(matchedOption);
                this.cursor.highlightElement(matchedOption);
                await this.cursor.click(matchedOption);

                if (this.automation && typeof this.automation.clickHumanLike === 'function') {
                    await this.automation.clickHumanLike(matchedOption);
                } else {
                    matchedOption.click();
                }

                // Dispatch full pointer cascade
                if (typeof MouseEvent !== 'undefined') {
                    matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    matchedOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }

                await this.cursor.sleep(350);
                return true;
            } else {
                console.warn(`[AgentOrchestrator] No matching dropdown option found for: "${targetText}"`);
            }
        }

        // Final fallback: try fillFieldRobustly
        if (this.automation && typeof this.automation.fillFieldRobustly === 'function') {
            return await this.automation.fillFieldRobustly(element, answer);
        }

        return false;
    }

    /**
     * Find nearest scrollable ancestor element
     */
    getScrollableParent(element) {
        if (!element) return null;
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY || style.overflow;
            if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return null;
    }

    /**
     * Detect and click an initial "Apply" / "Apply Now" button on job posting pages before the form opens
     */
    async handleInitialApplyButton() {
        const applySelectors = [
            'button',
            'a.btn',
            'a',
            '[role="button"]',
            'input[type="button"]',
            '[data-automation-id*="apply"]',
            '[data-automation-id="adventureButton"]',
            '[data-testid*="apply"]',
            '.jobs-apply-button',
            '.apply-button',
            '.postings-btn'
        ];

        const candidates = Array.from(document.querySelectorAll(applySelectors.join(',')));
        let applyBtn = candidates.find(el => {
            if (!this.isElementVisible(el)) return false;
            
            // Check text
            const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
            if (!text || text.length > 70) return false;

            // Exclude non-application actions
            if (/already\s*applied|terms\s*apply|how\s*to\s*apply|who\s*can\s*apply|apply\s*filter|apply\s*coupon|apply\s*discount/i.test(text)) {
                return false;
            }

            // Priority patterns for Apply buttons
            const isMatch = /^(?:apply|easy\s*apply|quick\s*apply|start\s*application)\b/i.test(text) ||
                            /\bapply\s*(?:now|online|for\s*this\s*job|to\s*job|with\s*resume|today|externally|on\s*company\s*site)\b/i.test(text) ||
                            /^(?:apply|easy\s*apply)$/i.test(text) ||
                            (el.getAttribute('data-automation-id') || '').includes('apply') ||
                            (el.getAttribute('data-testid') || '').includes('apply') ||
                            el.classList.contains('jobs-apply-button') ||
                            el.classList.contains('postings-btn');
            return isMatch;
        });

        // Fallback: If on a career portal / job board listing and no apply button is visible yet, select the active or first job card
        if (!applyBtn) {
            const jobListingSelectors = [
                '.job-card-container--clickable',
                '.job-card-list__title',
                '.jobs-search-results__list-item',
                '[data-job-id]',
                '.job-card',
                '.job-listing',
                '.posting-title',
                'a[href*="/jobs/"]',
                'a[href*="/job/"]',
                '.career-job-item'
            ];
            const jobCards = Array.from(document.querySelectorAll(jobListingSelectors.join(','))).filter(el => this.isElementVisible(el));
            if (jobCards.length > 0) {
                const targetJob = jobCards[0];
                console.log('[AgentOrchestrator] 📄 Detected job listing card. Clicking to open job description...');
                this.cursor.setStatus('Selecting job listing...', '🔍', 'moving');
                await this.cursor.moveTo(targetJob);
                await this.cursor.click(targetJob);
                targetJob.click();
                await this.cursor.sleep(1500);

                // Re-scan for Apply button now that job details are displayed
                const recheckedCandidates = Array.from(document.querySelectorAll(applySelectors.join(',')));
                applyBtn = recheckedCandidates.find(el => {
                    if (!this.isElementVisible(el)) return false;
                    const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
                    return /^(?:apply|easy\s*apply|quick\s*apply|start\s*application)\b/i.test(text) ||
                           /\bapply\s*(?:now|online|for\s*this\s*job|to\s*job|with\s*resume|today)\b/i.test(text);
                });
            }
        }

        if (applyBtn) {
            const btnText = (applyBtn.textContent || applyBtn.value || 'Apply').trim();
            console.log(`[AgentOrchestrator] 🚀 Found initial Apply button: "${btnText}"`);
            this.cursor.setStatus(`Found "${btnText}"! Opening application form...`, '🚀', 'moving');

            const isNewTab = (applyBtn.getAttribute && applyBtn.getAttribute('target') === '_blank') || 
                             (applyBtn.tagName === 'A' && applyBtn.target === '_blank');
            const targetUrl = applyBtn.href || (applyBtn.getAttribute && applyBtn.getAttribute('href')) || '';

            // Persist session before clicking in case of page navigation or new tab
            await this.saveAgentSession({
                lastAction: 'clicked_apply',
                targetUrl: targetUrl,
                isNewTab: !!isNewTab,
                timestamp: Date.now()
            });

            await this.cursor.moveTo(applyBtn);
            this.cursor.highlightElement(applyBtn);
            await this.cursor.sleep(400);
            await this.cursor.click(applyBtn);

            if (this.automation && typeof this.automation.clickHumanLike === 'function') {
                await this.automation.clickHumanLike(applyBtn);
            } else {
                applyBtn.click();
            }

            // If Apply opened a new tab, notify user and gracefully transfer control
            if (isNewTab) {
                console.log('[AgentOrchestrator] 🚀 Apply opened in a new tab! Transferring agent session...');
                this.cursor.setStatus('Application opened in new tab! Transferring agent...', '🚀', 'moving');
                await this.cursor.sleep(1200);

                const localInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"]'))
                    .filter(el => this.isElementVisible(el) && this.isJobApplicationField(el));
                if (localInputs.length === 0) {
                    this.cursor.setStatus('Agent active in application tab! Check new tab.', '✨', 'idle');
                    await this.cursor.sleep(1800);
                    // Stop local instance only, keeping global session active for the new tab
                    this.stop(false);
                    return true;
                }
            }

            // Wait for application form / modal / drawer to render
            this.cursor.setStatus('Opening application form...', '⏳', 'moving');
            await this.cursor.sleep(1200);

            // Check for secondary gateways (e.g. "Apply as Guest", "Autofill with Resume")
            const secondaryCandidates = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => this.isElementVisible(el));
            const guestBtn = secondaryCandidates.find(el => {
                const txt = (el.textContent || el.value || '').trim().toLowerCase();
                return /apply\s*as\s*guest|continue\s*as\s*guest|autofill\s*with\s*resume|apply\s*without\s*(?:an\s*)?account|quick\s*apply/i.test(txt);
            });
            if (guestBtn) {
                console.log(`[AgentOrchestrator] 🚀 Found guest gateway button: "${guestBtn.textContent.trim()}"`);
                this.cursor.setStatus(`Clicking "${guestBtn.textContent.trim()}"...`, '🚀', 'moving');
                await this.saveAgentSession({ lastAction: 'clicked_guest_gateway', timestamp: Date.now() });
                await this.cursor.moveTo(guestBtn);
                await this.cursor.click(guestBtn);
                guestBtn.click();
                await this.cursor.sleep(1200);
            }

            // Wait up to 7 seconds for fields to appear
            const startTime = Date.now();
            while (Date.now() - startTime < 7000) {
                const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="listbox"]'))
                    .filter(el => this.isElementVisible(el) && this.isJobApplicationField(el));
                if (inputs.length > 0) {
                    console.log(`[AgentOrchestrator] 📋 Detected ${inputs.length} application form fields after Apply click.`);
                    await this.cursor.sleep(500);
                    return true;
                }
                await this.cursor.sleep(400);
            }
            return true;
        }

        return false;
    }

    /**
     * Determine whether the page currently has an active job application form
     */
    hasActiveApplicationForm(fields = []) {
        if (!fields || fields.length === 0) return false;

        // 1. Check if fields are inside an explicit application form or modal
        const insideAppContainer = fields.some(f => {
            const el = f.element;
            if (!el || typeof el.closest !== 'function') return false;
            return !!el.closest('form, [role="dialog"], .modal, .application-form, #application_form, [data-automation-id*="application"], .jobs-easy-apply-modal, .freebirdFormviewerViewFormCard');
        });

        // 2. Check if visible fields have at least 1 core applicant field (name, email, phone, resume, etc.)
        const coreSignals = /name|email|phone|resume|cv|file|experience|education|salary|work.*auth|sponsorship|notice.*period|first.*name|last.*name/i;
        const hasCoreApplicantField = fields.some(f => {
            const label = (f.label || f.name || f.placeholder || '').toLowerCase();
            return coreSignals.test(label) || f.type === 'file';
        });

        return insideAppContainer || hasCoreApplicantField;
    }

    /**
     * Strictly verify that an interactive element belongs to a real job application form
     * and is NOT a website header/navigation, language switcher, site search, or cookie banner.
     */
    isJobApplicationField(element) {
        if (!element) return false;

        // 1. Check if element is inside website navigation, header, footer, or banners
        if (typeof element.closest === 'function') {
            const forbiddenContainer = element.closest(`
                header, nav, footer,
                #header, #nav, #navbar, #footer,
                .header, .nav, .navbar, .footer, .site-header, .site-footer,
                .navigation, .main-nav, .top-bar, .menu,
                .cookie-banner, .cookie-consent, #cookieConsent, #onetrust-consent-sdk,
                .goog-te-gadget, #google_translate_element, .skiptranslate,
                .translation-bar, .language-selector, .locale-picker, .language-menu
            `);

            if (forbiddenContainer) {
                const isFormModal = element.closest('form, [role="dialog"], .application-form, #application_form, [data-automation-id*="application"], .jobs-easy-apply-modal');
                if (!isFormModal || (typeof forbiddenContainer.contains === 'function' && forbiddenContainer.contains(isFormModal))) {
                    return false;
                }

            }
        }

        // 2. Reject website language switchers and translation widgets
        const tag = (element.tagName || '').toLowerCase();
        const className = (typeof element.className === 'string' ? element.className : (typeof element.getAttribute === 'function' ? element.getAttribute('class') : '')) || '';
        const id = element.id || '';
        const name = element.name || '';
        const ariaLabel = (typeof element.getAttribute === 'function' ? element.getAttribute('aria-label') : '') || '';
        const placeholder = element.placeholder || '';
        const testId = (typeof element.getAttribute === 'function' ? element.getAttribute('data-testid') : '') || '';

        const allAttrs = `${className} ${id} ${name} ${ariaLabel} ${placeholder} ${testId}`.toLowerCase();

        // Language / Currency / Translation widgets
        if (/goog-te|google_translate|googtrans|\btranslate\b|skiptranslate/i.test(allAttrs)) {
            return false;
        }

        // Language / Locale switcher (unless it is a question inside the form like "Languages spoken")
        if (/(?:select|choose|change|switch)\s*(?:a\s*)?language|language\s*selector|locale\s*picker|\blang\b|select-language|site-language/i.test(allAttrs)) {
            if (!allAttrs.includes('proficiency') && !allAttrs.includes('spoken') && !allAttrs.includes('known')) {
                return false;
            }
        }

        // If it's a select element whose only options are languages
        if (tag === 'select' && element.options && element.options.length > 1) {
            const optTexts = Array.from(element.options).slice(0, 6).map(o => (o.text || '').toLowerCase().trim());
            const isLanguageDropdown = optTexts.some(t => /^(?:english|español|spanish|french|français|deutsch|german|chinese|japanese|português|arabic)$/i.test(t));
            if (isLanguageDropdown && !allAttrs.includes('proficiency') && !allAttrs.includes('spoken') && !allAttrs.includes('known')) {
                return false;
            }
        }

        // 3. Reject global site search bars
        if (element.type === 'search' || (typeof element.getAttribute === 'function' && element.getAttribute('role') === 'searchbox')) {
            return false;
        }
        if (allAttrs.includes('search-input') || allAttrs.includes('global-search') || allAttrs.includes('site-search')) {
            return false;
        }

        // 4. Reject newsletter subscription fields
        if (/newsletter|subscribe|mailing\s*list/i.test(allAttrs)) {
            return false;
        }

        // 5. Reject Captchas, security verification widgets, honeypots, and token responses
        if (/captcha|recaptcha|hcaptcha|turnstile|challenge-response|cf-turnstile/i.test(allAttrs)) {
            return false;
        }
        if (typeof element.closest === 'function' && element.closest('.h-captcha, .g-recaptcha, .cf-turnstile, [id*="captcha"], [class*="captcha"]')) {
            return false;
        }

        return true;
    }

    /**
     * Sort fields strictly by visual on-screen coordinates (top-to-bottom, left-to-right)
     * Guarantees monotonic downward progression without random jumping or scrolling.
     */
    sortFieldsSequentially(fields) {
        if (!Array.isArray(fields) || fields.length <= 1) return fields;

        const scrollY = (typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : 0);
        const scrollX = (typeof window !== 'undefined' && typeof window.scrollX === 'number' ? window.scrollX : 0);

        return [...fields].sort((a, b) => {
            const elA = a.element || (a.id && typeof document !== 'undefined' ? document.getElementById(a.id) : null);
            const elB = b.element || (b.id && typeof document !== 'undefined' ? document.getElementById(b.id) : null);

            if (!elA || !elB) return 0;

            const rectA = elA.getBoundingClientRect ? elA.getBoundingClientRect() : { top: 0, left: 0 };
            const rectB = b.getBoundingClientRect ? b.getBoundingClientRect() : { top: 0, left: 0 };

            const topA = (rectA.top || 0) + scrollY;
            const topB = (rectB.top || 0) + scrollY;
            const leftA = (rectA.left || 0) + scrollX;
            const leftB = (rectB.left || 0) + scrollX;

            // Same visual row (within 8px): sort left-to-right, otherwise top-to-bottom
            if (Math.abs(topA - topB) > 8) {
                return topA - topB;
            }
            return leftA - leftB;
        });
    }

    /**
     * Detect conditional fields newly unlocked/revealed on the form dynamically
     */
    detectNewlyRevealedFields(alreadyProcessedElements = new Set()) {
        if (typeof document === 'undefined') return [];
        const rawInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="listbox"], [contenteditable="true"]'))
            .filter(el => this.isJobApplicationField(el) && this.isElementVisible(el) && !el.disabled && !alreadyProcessedElements.has(el));

        if (rawInputs.length === 0) return [];

        const newFields = rawInputs.map(el => {
            const tag = (el.tagName || '').toLowerCase();
            const role = (typeof el.getAttribute === 'function' ? el.getAttribute('role') : '') || '';
            return {
                element: el,
                id: el.id || '',
                type: tag === 'select' ? 'select' : (role === 'combobox' || role === 'listbox' ? 'custom-select' : (el.type || 'text')),
                label: (this.aue && typeof this.aue.extractLabel === 'function') ? this.aue.extractLabel(el) : ((typeof el.getAttribute === 'function' ? el.getAttribute('aria-label') : '') || el.placeholder || el.name || el.id || ''),
                name: el.name || el.id || ''
            };
        });

        return this.sortFieldsSequentially(newFields);
    }

    /**
     * Inspect page for Next, Continue, or Submit button
     * Returns true if advanced to next page, false otherwise
     */
    async handleNextStepProgression() {
        const buttonSelectors = [
            'button',
            'input[type="submit"]',
            'input[type="button"]',
            '[role="button"]',
            'a.btn',
            '[data-automation-id="nextButton"]',
            '[data-automation-id="submitButton"]',
            '.office-form-bottom-button',
            '.freebirdFormviewerViewNavigationButtons div[role="button"]'
        ];

        const buttons = Array.from(document.querySelectorAll(buttonSelectors.join(',')));

        // 1. Look for Next / Continue / Proceed button
        const nextBtn = buttons.find(b => {
            const hasGetAttr = typeof b.getAttribute === 'function';
            if (!this.isElementVisible(b) || b.disabled || (hasGetAttr && b.getAttribute('aria-disabled') === 'true')) {
                return false;
            }
            const autoId = hasGetAttr ? (b.getAttribute('data-automation-id') || '') : '';
            if (autoId === 'nextButton') return true;

            const text = (b.textContent || b.value || '').trim().toLowerCase();
            if (/^(next|continue|save\s*&\s*continue|proceed|next\s*step|next\s*page|next\s*section|review\s*application|go\s*to\s*next\s*step)$/i.test(text)) {
                return true;
            }
            if (/^(next|continue)\b/i.test(text) && !/back|prev|cancel/i.test(text)) {
                return true;
            }
            return false;
        });

        if (nextBtn) {
            const btnText = (nextBtn.textContent || nextBtn.value || 'Next Step').trim();
            this.cursor.setStatus(`Advancing to next page: "${btnText}"...`, '🚀', 'moving');

            // Persist session before page transition in case page reloads/navigates
            await this.saveAgentSession({
                stats: this.stats,
                lastAction: 'clicked_next',
                lastUrl: (typeof window !== 'undefined' && window.location ? window.location.href : ''),
                timestamp: Date.now()
            });

            await this.cursor.moveTo(nextBtn);
            this.cursor.highlightElement(nextBtn);
            await this.cursor.click(nextBtn);
            
            await this.cursor.sleep(300);
            if (this.automation && typeof this.automation.clickHumanLike === 'function') {
                await this.automation.clickHumanLike(nextBtn);
            } else {
                nextBtn.click();
            }

            this.cursor.setStatus(`Transitioning to next page...`, '✨', 'idle');
            await this.cursor.sleep(1200);
            return true;
        }

        // 2. Check for Final Submit Button (do not click automatically, notify user ready for review)
        const submitBtn = buttons.find(b => {
            if (!this.isElementVisible(b)) return false;
            const hasGetAttr = typeof b.getAttribute === 'function';
            const autoId = hasGetAttr ? (b.getAttribute('data-automation-id') || '') : '';
            if (autoId === 'submitButton') return true;

            const text = (b.textContent || b.value || '').trim().toLowerCase();
            return /^(submit|submit\s*application|apply\s*now|send\s*application|finish)$/i.test(text);
        });

        if (submitBtn) {
            this.cursor.setStatus('Application Ready for Review! 🚀 (Click Submit to finish)', '🎉', 'idle');
            await this.cursor.moveTo(submitBtn);
            this.cursor.highlightElement(submitBtn);
            await this.cursor.sleep(2500);
            return false;
        }

        return false;
    }

    /**
     * Wait for DOM transition / new fields after clicking Next
     */
    async waitForPageTransition(timeoutMs = 6000) {
        this.cursor.setStatus('Waiting for next page to load...', '⏳', 'moving');
        await this.cursor.sleep(800);

        const startTime = Date.now();
        const initialCount = document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"]').length;

        while (Date.now() - startTime < timeoutMs) {
            // Check for loading spinners / busy state
            const isBusy = document.querySelector('[aria-busy="true"], .spinner, .loading, .office-form-loading, [data-automation-id="loadingSpinner"]');
            if (isBusy && this.isElementVisible(isBusy)) {
                await this.cursor.sleep(400);
                continue;
            }

            // Check if page has visible inputs
            const currentInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="listbox"]'));
            const visibleInputs = currentInputs.filter(el => this.isElementVisible(el));

            if (visibleInputs.length > 0) {
                // If there are unfilled visible fields, or field count changed, transition complete
                const hasUnfilled = visibleInputs.some(el => {
                    const val = (el.value || el.textContent || '').trim();
                    return val.length === 0 || /^(?:select|choose)/i.test(val);
                });

                if (hasUnfilled || visibleInputs.length !== initialCount) {
                    console.log(`[AgentOrchestrator] 📄 Next page ready with ${visibleInputs.length} visible fields.`);
                    await this.cursor.sleep(500);
                    return true;
                }
            }

            await this.cursor.sleep(300);
        }

        console.log('[AgentOrchestrator] Page transition wait complete.');
        return true;
    }

    /**
     * Extract Job Title and Company from DOM
     */
    extractPageContext() {
        let jobTitle = '';
        let company = '';

        // Try h1
        const h1 = document.querySelector('h1');
        if (h1) jobTitle = h1.textContent.trim();

        // Try meta tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
            jobTitle = jobTitle || ogTitle.content;
        }

        const ogSite = document.querySelector('meta[property="og:site_name"]');
        if (ogSite && ogSite.content) {
            company = ogSite.content;
        }

        // Hostname fallback
        if (!company) {
            const hostParts = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname.split('.') : [];
            company = hostParts[hostParts.length - 2] || 'the employer';
        }

        return { jobTitle: jobTitle || 'Target Position', company: company };
    }

    isElementVisible(element) {
        if (!element) return false;
        try {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const style = window.getComputedStyle(element);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            }
            return false;
        } catch (e) {
            return true;
        }
    }

    /**
     * Check for Captcha / Security verifications (Cloudflare, reCAPTCHA, hCaptcha, Arkose)
     * Gracefully pauses the agent only when an active unsolved challenge is present,
     * alerts the user with an audio chime, and auto-resumes once the user solves it.
     */
    async checkAndHandleCaptcha() {
        if (typeof document === 'undefined') return;

        const isUnsolvedCaptcha = () => {
            // 1. Active challenge popups or interactive challenge iframes
            const activeModalSelectors = [
                'iframe[src*="hcaptcha.com/check"]',
                'iframe[title*="hCaptcha challenge"]',
                'iframe[title*="recaptcha challenge"]',
                'iframe[src*="recaptcha/api2/bframe"]',
                'div[style*="visibility: visible"] iframe[src*="cloudflare"]'
            ];
            for (const sel of activeModalSelectors) {
                const el = document.querySelector(sel);
                if (el && this.isElementVisible(el)) return { el, type: 'active_challenge_modal' };
            }

            // 2. Visible unsolved hCaptcha checkbox
            const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha"]');
            if (hcaptchaIframe && this.isElementVisible(hcaptchaIframe)) {
                const responseArea = document.querySelector('textarea[name="h-captcha-response"], [data-hcaptcha-response]');
                const isChecked = hcaptchaIframe.getAttribute('aria-checked') === 'true' ||
                                  (responseArea && responseArea.value && responseArea.value.trim().length > 0);
                if (!isChecked) {
                    return { el: hcaptchaIframe, type: 'hcaptcha_checkbox' };
                }
            }

            // 3. Visible unsolved reCAPTCHA checkbox
            const recaptchaIframe = document.querySelector('iframe[src*="recaptcha"]');
            if (recaptchaIframe && this.isElementVisible(recaptchaIframe)) {
                const recaptchaResponse = document.querySelector('textarea[name="g-recaptcha-response"]');
                if (recaptchaResponse && !recaptchaResponse.value) {
                    return { el: recaptchaIframe, type: 'recaptcha_checkbox' };
                }
            }

            // 4. Visible unsolved Cloudflare Turnstile
            const turnstileIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
            if (turnstileIframe && this.isElementVisible(turnstileIframe)) {
                const turnstileResponse = document.querySelector('input[name="cf-turnstile-response"]');
                if (turnstileResponse && !turnstileResponse.value) {
                    return { el: turnstileIframe, type: 'turnstile_checkbox' };
                }
            }

            return null;
        };

        const activeCaptcha = isUnsolvedCaptcha();
        if (activeCaptcha) {
            console.log('[AgentOrchestrator] ⚠️ Unsolved security challenge detected:', activeCaptcha.type);
            if (this.cursor && typeof this.cursor.playChime === 'function') {
                this.cursor.playChime('alert');
            }
            this.cursor.setStatus('Security Check Detected: Please complete it on screen...', '🛡️', 'asking');
            this.cursor.highlightElement(activeCaptcha.el);

            // Wait until the captcha is resolved or verified
            const maxWaitMs = 120000; // 2 minutes max
            const startWait = Date.now();

            while (this.isRunning && Date.now() - startWait < maxWaitMs) {
                await this.cursor.sleep(1500);
                if (!isUnsolvedCaptcha()) {
                    console.log('[AgentOrchestrator] ✅ Security verification passed / resolved!');
                    if (this.cursor && typeof this.cursor.playChime === 'function') {
                        this.cursor.playChime('prompt');
                    }
                    this.cursor.setStatus('Security check passed! Resuming agent...', '✅', 'moving');
                    await this.cursor.sleep(500);
                    break;
                }
            }
        }
    }

    /**
     * Pre-submission review gate: pulses the submit button and prompts the user to review or auto-submit
     */
    async handlePreSubmissionReview(pageContext) {
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[data-automation-id="submitButton"]',
            'button[id*="submit" i]',
            'button[class*="submit" i]',
            'a[role="button"][id*="submit" i]',
            'button[aria-label*="submit" i]'
        ];

        let submitButton = null;
        for (const sel of submitSelectors) {
            const btn = document.querySelector(sel);
            if (btn && this.isElementVisible(btn) && !btn.disabled) {
                const text = (btn.textContent || btn.value || '').toLowerCase().trim();
                if (/submit|apply|send\s*application|complete\s*application/i.test(text) || btn.type === 'submit') {
                    submitButton = btn;
                    break;
                }
            }
        }

        if (submitButton) {
            await this.cursor.moveTo(submitButton);
            this.cursor.highlightElement(submitButton);
        }

        let shouldAutoSubmit = true;
        if (this.cursor && typeof this.cursor.showReviewModal === 'function') {
            shouldAutoSubmit = await this.cursor.showReviewModal(this.stats);
        }

        if (shouldAutoSubmit && submitButton) {
            this.cursor.setStatus('Submitting Application...', '🚀', 'moving');
            await this.cursor.click(submitButton);
            submitButton.click();
            await this.cursor.sleep(1000);
        }

        // Automatically log this application record
        await this.logApplicationRecord(pageContext, this.stats);
    }

    /**
     * Auto-track completed application into local storage, User Context Graph, and backend database
     */
    async logApplicationRecord(pageContext, stats) {
        try {
            const jobTitle = pageContext.jobTitle || (typeof document !== 'undefined' ? document.title.split('-')[0].trim() : '') || 'Software Engineer';
            const company = pageContext.company || 'Company';
            const jobUrl = (typeof window !== 'undefined' && window.location && window.location.href) || '';
            const location = pageContext.location || '';
            const appliedDate = new Date().toISOString();
            const platformName = pageContext.platform || (this.aue?.platformDetector ? this.aue.platformDetector.detect().name : 'Custom ATS');
            const profileName = this.brain?.profile?.full_name || 'Candidate';
            const filledDataSnapshot = [...(this.filledFieldsRecord || [])];

            const appRecord = {
                id: 'app_' + Date.now(),
                job_title: jobTitle,
                company: company,
                location: location,
                job_url: jobUrl,
                status: 'applied',
                applied_date: appliedDate,
                platform: platformName,
                profile_name: profileName,
                fields_filled: stats ? stats.filled : filledDataSnapshot.length,
                form_data: filledDataSnapshot,
                source: 'AutonomousVisualAgent'
            };

            console.log('[AgentOrchestrator] 📊 Auto-tracking application record with full form data:', appRecord);

            // Feed form snapshot to candidate User Context Graph
            if (this.brain && typeof this.brain.recordFormApplication === 'function') {
                await this.brain.recordFormApplication({
                    url: jobUrl,
                    company: company,
                    jobTitle: jobTitle,
                    profileName: profileName,
                    platform: platformName,
                    status: 'applied',
                    formData: filledDataSnapshot
                });
            }

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['appliedJobs'], (data) => {
                    const existing = Array.isArray(data.appliedJobs) ? data.appliedJobs : [];
                    const filtered = existing.filter(j => j.job_url !== jobUrl && !(j.company === company && j.job_title === jobTitle));
                    filtered.unshift(appRecord);
                    chrome.storage.local.set({ appliedJobs: filtered.slice(0, 100) });
                });

                chrome.storage.local.get(['token', 'authToken', 'extensionToken', 'apiUrl'], async (tokenData) => {
                    const token = tokenData.token || tokenData.authToken || tokenData.extensionToken;
                    if (token && typeof fetch !== 'undefined') {
                        try {
                            const baseUrl = tokenData.apiUrl || 'http://localhost:3000/api';
                            const backendUrl = `${baseUrl}/applications`;
                            await fetch(backendUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    jobTitle: jobTitle,
                                    company: company,
                                    jobUrl: jobUrl,
                                    status: 'applied',
                                    platform: platformName,
                                    profileName: profileName,
                                    formData: filledDataSnapshot,
                                    notes: `Auto-filled and verified ${stats ? stats.filled : filledDataSnapshot.length} fields via Autonomous Agent`
                                })
                            });
                            console.log('[AgentOrchestrator] ✅ Successfully synced application record & form data to backend database!');
                        } catch (err) {
                            console.warn('[AgentOrchestrator] Backend application sync skipped:', err.message);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('[AgentOrchestrator] Failed to log application record:', e);
        }
    }

    async saveAgentSession(extra = {}) {
        try {
            const sessionData = {
                isActive: true,
                sessionId: this.sessionId || (this.sessionId = `session_${Date.now()}`),
                startedAt: this.sessionStartedAt || (this.sessionStartedAt = Date.now()),
                profile: this.brain?.profile || null,
                stats: this.stats || { filled: 0, skipped: 0, failed: 0, total: 0 },
                lastUrl: (typeof window !== 'undefined' && window.location ? window.location.href : ''),
                currentJobTitle: this.currentJobTitle || '',
                currentCompany: this.currentCompany || '',
                timestamp: Date.now(),
                ...extra
            };
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await new Promise(r => chrome.storage.local.set({ autonomousAgentSession: sessionData }, r));
            }
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'AGENT_SESSION_UPDATE', session: sessionData }).catch(() => {});
            }
        } catch (e) {
            console.warn('[AgentOrchestrator] Failed to save agent session:', e);
        }
    }

    async clearAgentSession() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await new Promise(r => chrome.storage.local.remove(['autonomousAgentSession'], r));
            }
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'AGENT_SESSION_STOP' }).catch(() => {});
            }
        } catch (e) {
            console.warn('[AgentOrchestrator] Failed to clear agent session:', e);
        }
    }

    async stop(clearSession = true) {
        this.isRunning = false;
        this.setState('STOPPED');
        if (this.beforeUnloadHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
        if (clearSession) {
            await this.clearAgentSession();
        }
        if (this.cursor) {
            this.cursor.unmount();
        }
        if (typeof window !== 'undefined' && window.__unifiedAutofillButtonInstance) {
            window.__unifiedAutofillButtonInstance.setRunningState(false);
        }
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.AutonomousAgentOrchestrator = AutonomousAgentOrchestrator;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutonomousAgentOrchestrator;
}
