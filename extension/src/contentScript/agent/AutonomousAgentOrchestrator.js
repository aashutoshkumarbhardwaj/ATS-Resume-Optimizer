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

            // LinkedIn Jobs Easy Apply Mode (auto-scans job cards & steps through Easy Apply modals)
            const LinkedInAgentClass = (typeof window !== 'undefined' && window.LinkedInEasyApplyAgent) || (typeof LinkedInEasyApplyAgent !== 'undefined' ? LinkedInEasyApplyAgent : null);
            if (LinkedInAgentClass && LinkedInAgentClass.isLinkedInJobsPage()) {
                console.log('[AgentOrchestrator] 💼 LinkedIn Jobs detected — starting LinkedInEasyApplyAgent...');
                const liAgent = new LinkedInAgentClass(this);
                const liResult = await liAgent.run(options);
                this.isRunning = false;
                this.setState('COMPLETED', `LinkedIn Easy Apply complete (${liResult.applied} applied)`, '✅');
                return liResult;
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
                    try {
                        formStructure = await this.aue.analyzeApplication();
                    } catch (aueErr) {
                        console.warn('[AgentOrchestrator] ⚠️ AUE analysis error, falling back to direct input scanning:', aueErr);
                    }
                }
                if (!formStructure || !formStructure.fields) {
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
                this.emitProgress('observe', `Page ${currentPage}: ${pageFields.length} fields detected`, { page: currentPage });

                // If on Page 1 and no form fields are detected, scan for Apply button or Job card
                if (pageFields.length === 0 && currentPage === 1) {
                    console.log('[AgentOrchestrator] No application fields on screen yet. Scanning for Apply button or Job card...');
                    const openedApply = await this.handleInitialApplyButton();
                    if (openedApply) {
                        // Re-run perception analysis now that application form / modal has opened
                        formStructure = null;
                        if (this.aue && typeof this.aue.analyzeApplication === 'function') {
                            try {
                                formStructure = await this.aue.analyzeApplication();
                            } catch (aueErr) {
                                console.warn('[AgentOrchestrator] ⚠️ AUE analysis error after apply, falling back:', aueErr);
                            }
                        }
                        if (!formStructure || !formStructure.fields) {
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

                    // Verify if field is already filled — AND validate against Profile & Stale/Corrupted Data!
                    if (this.isFieldAlreadyFilled(field, element)) {
                        const currentVal = (element.value || element.textContent || '').trim();
                        const isCorrupted = this.isStaleOrCorruptedValue(field, currentVal);

                        // Check if field has an authoritative Profile value that differs from what's currently in the DOM
                        let profileExpected = null;
                        if (this.brain && typeof this.brain.getDeterministicValue === 'function') {
                            profileExpected = this.brain.getDeterministicValue(field.label, field.intent || field.semanticIntent?.intent, field);
                        }

                        const differsFromProfile = (() => {
                            if (!profileExpected || String(profileExpected).trim() === '') return false;
                            const expStr = String(profileExpected).trim();
                            const curStr = String(currentVal).trim();
                            if (/phone|mobile|tel/i.test((field.label || '') + ' ' + (field.type || ''))) {
                                const expDigits = expStr.replace(/\D/g, '').slice(-10);
                                const curDigits = curStr.replace(/\D/g, '').slice(-10);
                                return expDigits.length >= 7 && curDigits !== expDigits;
                            }
                            return curStr.toLowerCase() !== expStr.toLowerCase();
                        })();

                        if (!isCorrupted && !differsFromProfile) {
                            console.log(`[AgentOrchestrator] ✅ Field already filled & matches profile: "${field.label}" = "${currentVal}". Leaving as is.`);
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
                            await this.cursor.sleep(150);
                            continue;
                        }

                        console.log(`[AgentOrchestrator] 🔄 Field "${field.label}" has ${isCorrupted ? 'stale/corrupted' : 'mismatched'} value "${currentVal}" (Profile expects "${profileExpected || 'AI answer'}"). Modifying to match profile...`);
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
                    this.emitProgress('plan', `Reasoning: "${(field.label || 'Field').slice(0, 40)}"`);
                    const context = {
                        jobTitle: pageContext.jobTitle,
                        company: pageContext.company,
                        virtualCursor: this.cursor
                    };

                    const resolution = await this.brain.resolveAnswer(field, context);
                    let answer = resolution ? resolution.value : null;

                    // 4. Candidate Question Answering & No Question Left Behind Guarantee:
                    // Every application question, screening prompt, textarea, or required field must be answered!
                    const isRequiredField = field.required || 
                                           (this.engine && typeof this.engine.isRequired === 'function' && this.engine.isRequired(element)) ||
                                           (field.label && (field.label.includes('*') || /\brequired\b/i.test(field.label))) || 
                                           (typeof element.hasAttribute === 'function' && (element.hasAttribute('required') || element.getAttribute('aria-required') === 'true'));

                    const cleanLabel = (field.label || field.name || '').replace(/[\*:]+/g, '').trim();
                    const isQuestionOrScreening = isRequiredField || 
                                                 field.type === 'textarea' || 
                                                 (element && element.tagName === 'TEXTAREA') ||
                                                 cleanLabel.includes('?') || 
                                                 /why|experience|describe|tell|about|salary|notice|sponsor|authoriz|github|linkedin|portfolio|project|cover.*letter|additional|role|position|challenge|achievement|strength|weakness|qualification|hear\s*about/i.test(cleanLabel);

                    if (answer === null || answer === undefined || answer === '') {
                        // Level 5 fallback: Generate answer as the most deserving candidate
                        if (this.brain && typeof this.brain.generateCandidateAnswer === 'function') {
                            console.log(`[AgentOrchestrator] 🧠 Synthesizing answer as most deserving candidate for: "${cleanLabel}"...`);
                            this.cursor.setStatus(`Reasoning: "${cleanLabel.slice(0, 30)}..."`, '🧠', 'thinking');
                            const genRes = await this.brain.generateCandidateAnswer(field, cleanLabel, context);
                            if (genRes && genRes.value) {
                                answer = genRes.value;
                            }
                        }
                    }

                    if (answer === null || answer === undefined || answer === '') {
                        // If still unresolved and it's a question or required field: prompt the user interactively
                        if (isRequiredField || isQuestionOrScreening) {
                            console.log(`[AgentOrchestrator] ⚠️ Question "${field.label}" not auto-resolved. Prompting user...`);
                            this.cursor.setStatus(`Question: "${cleanLabel.slice(0, 35)}..."`, '❓', 'asking');
                            this.cursor.highlightElement(element);

                            let optionsList = (field.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value)).filter(Boolean);
                            if (optionsList.length === 0 && element.tagName === 'SELECT') {
                                optionsList = Array.from(element.options).map(o => o.text.trim()).filter(t => t && !/^(?:select|choose|--|\bselect\s*an\s*option\b)/i.test(t));
                            }
                            optionsList = optionsList.slice(0, 8);

                            const userChoice = await this.cursor.askUser(
                                `${cleanLabel}${isRequiredField ? ' (*)' : ''}`,
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
                            console.log(`[AgentOrchestrator] Secondary optional input "${field.label}" skipped.`);
                            this.stats.skipped++;
                            continue;
                        }
                    }

                    // Auto-push and persist resolved answer across context graph, memory and storage
                    if (answer && this.brain && typeof this.brain.saveToMemory === 'function') {
                        this.brain.saveToMemory(field.label, answer, field);
                    }

                    // 5. Execute Visual Action & Native Typing / Dropdown Selection (ACT phase)
                    this.emitProgress('act', `Filling: "${(field.label || 'Field').slice(0, 40)}"`);
                    const success = await this.executeAction(field, answer, isRequiredField);
                    
                    // 5.5. Closed-Loop Verification & Self-Correction (VERIFY phase - Claude in Chrome pattern)
                    let isVerified = success !== false;
                    if (isVerified && element) {
                        const verification = await this.verifyAndCorrectAction(field, element, answer);
                        isVerified = verification.verified;
                    }

                    if (isVerified) {
                        this.stats.filled++;
                        pageFilledCount++;
                        this.emitProgress('verify', `Verified: "${(field.label || 'Field').slice(0, 35)}" ✅`);
                        this.cursor.setStatus(`Verified: ${field.label || 'Field'} ✅`, '✅', 'idle');
                        this.filledFieldsRecord.push({
                            id: field.id || field.name || field.label,
                            label: field.label,
                            intent: field.intent || field.semanticIntent?.intent,
                            type: field.type,
                            value: answer,
                            status: 'auto_filled',
                            verified: true
                        });
                    } else {
                        console.warn(`[AgentOrchestrator] ⚠️ Field "${field.label}" failed post-action verification.`);
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

                    await this.cursor.sleep(60);
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
            await this.cursor.sleep(600);

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
        } else if (fieldType === 'radio' || element.type === 'radio' || (element.getAttribute && element.getAttribute('role') === 'radio')) {
            return await this.selectRadioButton(field, answer, isRequiredField);
        } else if (fieldType === 'checkbox' || element.type === 'checkbox' || (element.getAttribute && element.getAttribute('role') === 'checkbox')) {
            this.cursor.setStatus(`Clicking: ${field.label}`, '🖱️', 'moving');
            await this.cursor.moveTo(element);
            this.cursor.highlightElement(element);
            await this.cursor.click(element);
            element.click();
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } else {
            // Text inputs, textareas, search inputs, dates, and phone numbers
            const fieldLabel = (field.label || '').toLowerCase();
            const isPhoneField = fieldType === 'tel' || /phone|mobile/i.test(fieldLabel) || field.intent === 'phone';
            const isCountryCodeField = field.intent === 'country_code' || /country\s*code|dial\s*code/i.test(fieldLabel);

            // 2.1. Dedicated Country Code Selection for Phone Numbers
            if (isCountryCodeField || isPhoneField) {
                const userCountryCode = this.brain?.profile?.country_code || '+91';
                const userCountry = this.brain?.profile?.country || 'India';
                await this.handlePhoneCountryCode(element, userCountryCode, userCountry);
                if (isCountryCodeField) return true;
            }

            // 2.2. Value Preparation & Cleansing
            let typeVal = String(answer || '');
            if (/city|town|residing/i.test(fieldLabel)) {
                // Strip degree/technology prefix noise if ever present
                typeVal = typeVal.replace(/^(?:technology|engineering|bachelor|master|science|arts|university|college|school|institute)[\s\-_]*/i, '').trim();
            } else if (isPhoneField) {
                // Strip leading international prefix if country selector handles it
                const digits = typeVal.replace(/\D/g, '');
                if (digits.length > 10 && digits.startsWith('91')) {
                    typeVal = digits.slice(-10);
                } else if (digits.length > 10 && digits.startsWith('1')) {
                    typeVal = digits.slice(-10);
                }
            }

            this.cursor.setStatus(`Typing: ${field.label}...`, '✍️', 'typing');
            await this.cursor.moveTo(element);
            await this.cursor.click(element);

            // Clear element completely before typing
            try {
                if (this.cursor && typeof this.cursor.setNativeValue === 'function') {
                    this.cursor.setNativeValue(element, '');
                } else {
                    element.value = '';
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {}

            await this.cursor.type(element, typeVal, { humanSpeed: true });

            // Enforce React/Vue/Angular native prototype descriptor sync
            try {
                const proto = Object.getPrototypeOf(element);
                const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                    || (typeof window !== 'undefined' && window.HTMLInputElement && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set)
                    || (typeof window !== 'undefined' && window.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set);
                if (nativeSetter) {
                    nativeSetter.call(element, String(typeVal));
                } else {
                    element.value = String(typeVal);
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                // NOTICE: We do NOT dispatch blur here, because premature blur causes autocomplete dropdowns to unmount!
            } catch (e) {}

            // CRITICAL: Inspect and actively select from any dropdown / popoff appearing after typing
            // The agent MUST select from that dropdown before moving to the next field!
            await this.ensureDropdownSelectionAndDismiss(element, typeVal, field, isRequiredField);

            // Now that dropdown selection has been made and committed, safely blur the element
            try {
                element.dispatchEvent(new Event('blur', { bubbles: true }));
            } catch (e) {}

            return true;
        }
    }

    /**
     * Inspect and actively select country code for phone number inputs across ATS platforms
     * (e.g. SmartRecruiters .c-phone-input__country-select, Greenhouse, Lever, Workday, intl-tel-input)
     */
    async handlePhoneCountryCode(phoneElement, targetCode = '+91', targetCountry = 'India') {
        if (!phoneElement) return false;

        const rawCode = String(targetCode || '+91').trim();
        const countryName = String(targetCountry || 'India').trim();
        const cleanDigitsCode = rawCode.replace(/\D/g, '') || '91';
        const withPlusCode = `+${cleanDigitsCode}`;

        // 1. Check parent/container for a country code <select> or custom button trigger
        const container = phoneElement.closest('.c-phone-input, .phone-input, .intl-tel-input, .iti, [class*="phone" i], .form-group, .field') || phoneElement.parentElement;
        if (!container) return false;

        // Check A: Native <select> country code dropdown
        const selectEl = container.querySelector('select[name*="country" i], select[id*="country" i], select[name*="dial" i], select[name*="prefix" i], select[class*="country" i]');
        if (selectEl && this.isElementVisible(selectEl)) {
            const options = Array.from(selectEl.options);
            const matched = options.find(o => {
                const text = (o.text + ' ' + o.value).toLowerCase();
                return text.includes(withPlusCode) || text.includes(countryName.toLowerCase()) || text.includes(`(${cleanDigitsCode})`);
            });
            if (matched) {
                selectEl.value = matched.value;
                matched.selected = true;
                selectEl.dispatchEvent(new Event('input', { bubbles: true }));
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }

        // Check B: Custom button trigger (e.g. SmartRecruiters .c-phone-input__country-select, .iti__selected-flag)
        const triggerBtn = container.querySelector(
            '.c-phone-input__country-select, .iti__selected-flag, [class*="country-select" i], [class*="dial-code" i], [aria-haspopup="listbox"], button[data-testid*="country" i], [class*="country-picker" i]'
        );

        if (!triggerBtn || !this.isElementVisible(triggerBtn)) {
            return false;
        }

        // Check if the trigger already displays the correct country code
        const currentTriggerText = (triggerBtn.textContent || triggerBtn.innerText || '').trim();
        if (currentTriggerText.includes(withPlusCode) || currentTriggerText.includes(countryName)) {
            console.log(`[AgentOrchestrator] ✅ Country code "${withPlusCode}" is already selected on phone input.`);
            return true;
        }

        console.log(`[AgentOrchestrator] 🌐 Opening country code selector for "${withPlusCode}" (${countryName})...`);
        this.cursor.setStatus(`Selecting Country Code: ${withPlusCode}...`, '🌐', 'moving');

        // Click trigger button to open the country dropdown popover
        await this.cursor.moveTo(triggerBtn);
        this.cursor.highlightElement(triggerBtn);
        await this.cursor.click(triggerBtn);
        if (typeof triggerBtn.click === 'function') triggerBtn.click();
        await this.cursor.sleep(400);

        // Check if there is an open search bar inside the popover
        const searchInput = document.querySelector(
            '.c-country-select__search-input, input[placeholder*="country" i], input[placeholder*="search" i], input[type="search"], [role="listbox"] input, input[aria-label*="search" i]'
        );

        if (searchInput && this.isElementVisible(searchInput)) {
            await this.cursor.moveTo(searchInput);
            await this.cursor.click(searchInput);
            // Type the country name to filter list
            await this.cursor.type(searchInput, countryName, { humanSpeed: true });
            await this.cursor.sleep(350);
        }

        // Locate country items in the open popover
        const countryItemSelectors = [
            '.c-country-select__list li',
            '.c-country-select__item',
            '.iti__country',
            '[role="listbox"] [role="option"]',
            '[role="listbox"] li',
            'li[data-country-code]',
            'li[data-dial-code]',
            '.country-list li',
            'ul[class*="country"] li'
        ];

        let visibleItems = [];
        for (const sel of countryItemSelectors) {
            const found = Array.from(document.querySelectorAll(sel)).filter(el => this.isElementVisible(el));
            if (found.length > 0) {
                visibleItems = found;
                break;
            }
        }

        let bestItem = null;
        if (visibleItems.length > 0) {
            // Priority 1: Contains both country name and code (e.g. "India +91")
            bestItem = visibleItems.find(el => {
                const txt = (el.textContent || el.innerText || '').toLowerCase();
                return txt.includes(countryName.toLowerCase()) && (txt.includes(withPlusCode) || txt.includes(cleanDigitsCode));
            });

            // Priority 2: Contains withPlusCode (e.g. "+91")
            if (!bestItem) {
                bestItem = visibleItems.find(el => {
                    const txt = (el.textContent || el.innerText || '').toLowerCase();
                    return txt.includes(withPlusCode);
                });
            }

            // Priority 3: Contains country name (e.g. "India")
            if (!bestItem) {
                bestItem = visibleItems.find(el => {
                    const txt = (el.textContent || el.innerText || '').toLowerCase();
                    return txt.includes(countryName.toLowerCase());
                });
            }

            // Interactive Fallback: If not found or ambiguous, ask user!
            if (!bestItem && this.cursor && typeof this.cursor.askUser === 'function') {
                const choices = visibleItems
                    .map(el => (el.textContent || el.innerText || '').trim())
                    .filter(t => t.length > 0)
                    .slice(0, 8);
                if (choices.length > 0) {
                    this.cursor.setStatus(`Select your Country Code:`, '❓', 'asking');
                    const picked = await this.cursor.askUser(`Select your Country Code:`, choices);
                    if (picked) {
                        bestItem = visibleItems.find(el => (el.textContent || el.innerText || '').trim().toLowerCase() === picked.toLowerCase().trim());
                    }
                }
            }

            if (bestItem) {
                const itemText = (bestItem.textContent || bestItem.innerText || '').trim();
                console.log(`[AgentOrchestrator] ✅ Selecting country code item: "${itemText}"`);
                await this.cursor.moveTo(bestItem);
                this.cursor.highlightElement(bestItem);
                await this.cursor.click(bestItem);
                bestItem.click();
                if (typeof MouseEvent !== 'undefined') {
                    bestItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    bestItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    bestItem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                await this.cursor.sleep(300);
            }
        }

        // Ensure popover is dismissed cleanly
        await this.dismissLingeringPopoffs();
        return !!bestItem;
    }

    /**
     * Inspect and actively select from any dropdown / popoff appearing after typing
     * (e.g. City autocomplete on SmartRecruiters, Google Places, Lever, Workday)
     * The agent MUST select from that dropdown before moving to the next field!
     */
    async ensureDropdownSelectionAndDismiss(element, answer, field = {}, isRequiredField = false) {
        if (!element) return;

        const targetText = String(answer || '').trim().toLowerCase();
        const fieldLabel = (field.label || '').toLowerCase();
        
        // Detect if this field is known to show an autocomplete dropdown
        const isLikelyDropdownField = 
            (typeof element.getAttribute === 'function' && (
                element.getAttribute('role') === 'combobox' ||
                element.getAttribute('aria-autocomplete') ||
                element.getAttribute('aria-haspopup') === 'listbox'
            )) ||
            /city|location|country|state|province|school|university|hear\s*about/i.test(fieldLabel);

        const maxWaitMs = isLikelyDropdownField ? 700 : 80;
        const pollInterval = 80;
        const startTime = Date.now();

        // Common autocomplete suggestions container & item selectors across ATS platforms
        const suggestionSelectors = [
            // Standard ARIA listbox & option
            '[role="listbox"] [role="option"]',
            '[role="listbox"] li',
            '[role="listbox"] > div[tabindex]',
            // SmartRecruiters specific (.oneclick-ui, spl-autocomplete, c-autocomplete)
            '.c-autocomplete__list li',
            '.c-autocomplete__item',
            '.c-autocomplete__menu li',
            '.c-autocomplete__menu > div',
            '.spl-select-options li',
            '.spl-autocomplete-item',
            '.spl-autocomplete__option',
            // Google Places & Typeahead
            '.pac-container .pac-item',
            '.typeahead-dropdown .item',
            '.typeahead .dropdown-item',
            '.suggestions-list li',
            '.suggestions-list [class*="item"]',
            'ul[class*="suggestion"] li',
            'div[class*="suggestion-item"]',
            'ul[class*="autocomplete"] li',
            'div[class*="autocomplete-item"]',
            'ul[class*="options"] li',
            'div[class*="option-item"]',
            // Generic active dropdown menus
            '.dropdown-menu.show li',
            '.dropdown-menu.show a',
            '.dropdown-menu.visible li',
            '[aria-expanded="true"] + [role="listbox"] [role="option"]'
        ];

        let visibleOptions = [];

        // Actively watch via MutationObserver + fast poll until suggestions dropdown appears
        visibleOptions = await this.waitForPopupOptions(suggestionSelectors, maxWaitMs, pollInterval);

        if (visibleOptions.length > 0) {
            console.log(`[AgentOrchestrator] 🎯 Dropdown detected for "${field.label || 'field'}" with ${visibleOptions.length} options! Must select option before moving to next field...`);
            this.cursor.setStatus(`Selecting from dropdown for "${field.label || 'field'}"...`, '🎯', 'moving');

            // Priority 1: Exact text match
            let bestOption = visibleOptions.find(opt => {
                const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                return text === targetText;
            });

            // Priority 2: Option text includes target answer (e.g. "Ghaziabad, Uttar Pradesh, India" includes "ghaziabad")
            if (!bestOption) {
                bestOption = visibleOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return text.includes(targetText);
                });
            }

            // Priority 3: Token overlap match
            if (!bestOption && targetText.length > 2) {
                const targetTokens = targetText.split(/[\s,]+/).filter(w => w.length > 2);
                bestOption = visibleOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return targetTokens.some(tok => text.includes(tok));
                });
            }

            // Priority 4: Scroll inside scrollable pop-up container if option wasn't in initial visible slice
            if (!bestOption && visibleOptions.length > 0) {
                bestOption = await this.scrollPopupForMatchingOption(visibleOptions[0], targetText);
            }

            // Priority 5: Vision AI Set-of-Mark Fallback if DOM matching was ambiguous
            if (!bestOption && visibleOptions.length > 1) {
                const visionPick = await this.locateTargetViaVision(
                    `Select the option that best matches "${answer}" for "${field.label || 'field'}"`,
                    visibleOptions.slice(0, 12)
                );
                if (visionPick && visionPick.element) {
                    bestOption = visionPick.element;
                }
            }

            // Priority 6: Interactive selection if required and match is still ambiguous
            if (!bestOption && isRequiredField && this.cursor && typeof this.cursor.askUser === 'function') {
                const choices = visibleOptions
                    .map(opt => (opt.textContent || opt.innerText || '').trim())
                    .filter(t => t.length > 0)
                    .slice(0, 8);
                if (choices.length > 0) {
                    this.cursor.setStatus(`Select your ${field.label || 'Choice'}:`, '❓', 'asking');
                    const picked = await this.cursor.askUser(`Select option for: ${field.label}`, choices);
                    if (picked) {
                        bestOption = visibleOptions.find(opt => 
                            (opt.textContent || opt.innerText || '').trim().toLowerCase() === picked.toLowerCase().trim()
                        );
                        if (bestOption && this.brain && typeof this.brain.saveToMemory === 'function') {
                            this.brain.saveToMemory(field.label, picked, field);
                        }
                    }
                }
            }

            // Priority 7: Fallback selection — pick the top suggestion provided by the ATS
            if (!bestOption) {
                bestOption = visibleOptions[0];
            }

            if (bestOption) {
                const optText = (bestOption.textContent || bestOption.innerText || '').trim();
                console.log(`[AgentOrchestrator] ✅ Selecting dropdown item: "${optText}"`);
                this.cursor.setStatus(`Selected: "${optText}"`, '🎯', 'moving');

                if (typeof bestOption.scrollIntoView === 'function') {
                    bestOption.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    await this.cursor.sleep(40);
                }

                await this.trustedClick(bestOption);

                await this.cursor.sleep(150);

                // Commit check: Press Enter if element is still focused and dropdown needs confirmation
                try {
                    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                } catch (e) {}

                await this.cursor.sleep(100);
            }
        } else {
            // Check if there is a manual entry link (e.g. "Cannot find your city? Click here to fill in manually")
            if (/city|location/i.test(fieldLabel)) {
                try {
                    const manualLinks = Array.from(document.querySelectorAll('a, button, [role="button"], span')).filter(el => {
                        const txt = (el.textContent || '').trim().toLowerCase();
                        return /cannot\s*find.*city|fill\s*in\s*manually|enter\s*manually/i.test(txt);
                    });
                    if (manualLinks.length > 0 && this.isElementVisible(manualLinks[0])) {
                        console.log('[AgentOrchestrator] ℹ️ Found "fill in manually" link for city. Clicking...');
                        manualLinks[0].click();
                        await this.cursor.sleep(300);
                    }
                } catch (e) {}
            }
        }

        // Final check: Ensure no popoff or listbox remains open before moving to the next field
        await this.dismissLingeringPopoffs();
    }

    /**
     * Dismiss any lingering or unclosed popoffs, open dropdowns, or country code overlays
     */
    async dismissLingeringPopoffs() {
        try {
            // Check if open listboxes, country code menus, or typeahead suggestions are still visible
            const openMenus = Array.from(document.querySelectorAll(
                '[role="listbox"]:not([aria-hidden="true"]), .dropdown-menu.show, .c-autocomplete__list, .c-autocomplete__menu, .spl-select-options, .c-country-select, .c-country-select__menu, .iti__country-list'
            )).filter(el => this.isElementVisible(el));

            if (openMenus.length > 0) {
                // Press Escape to dismiss
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
                document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
                
                // Dispatch click on document body to clear focus
                if (document.body) {
                    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
                await this.cursor.sleep(120);
            }
        } catch (e) {}
    }

    /**
     * Post-action verification and self-correction loop (Claude in Chrome verify-actuator pattern)
     */
    async verifyAndCorrectAction(field, element, expectedAnswer) {
        if (!element) return { verified: true };
        await this.cursor.sleep(80);

        const type = field.type || element.type || (element.tagName ? element.tagName.toLowerCase() : 'text');
        const expectedStr = String(expectedAnswer).trim().toLowerCase();
        let actualStr = '';

        if (element.tagName === 'SELECT') {
            const opt = element.options ? element.options[element.selectedIndex] : null;
            actualStr = opt ? (opt.value || opt.text || '').trim().toLowerCase() : '';
        } else if (type === 'radio' || (element.getAttribute && element.getAttribute('role') === 'radio')) {
            const group = this.getRadioGroup(element);
            const anySelected = group.some(r => {
                if (r.checked || (r.getAttribute && r.getAttribute('aria-checked') === 'true')) return true;
                if (r.shadowRoot && typeof r.shadowRoot.querySelector === 'function') {
                    const inner = r.shadowRoot.querySelector('input[type="radio"], [role="radio"]');
                    if (inner && (inner.checked || (inner.getAttribute && inner.getAttribute('aria-checked') === 'true'))) return true;
                }
                return false;
            });
            return { verified: anySelected, actual: anySelected ? 'selected' : 'unselected' };
        } else if (type === 'checkbox' || (element.getAttribute && element.getAttribute('role') === 'checkbox')) {
            const isChecked = !!(element.checked || (element.getAttribute && element.getAttribute('aria-checked') === 'true'));
            return { verified: isChecked, actual: isChecked ? 'checked' : 'unchecked' };
        } else {
            actualStr = (element.value || element.textContent || '').trim().toLowerCase();
        }

        const matches = actualStr.length > 0 && (actualStr === expectedStr || actualStr.includes(expectedStr) || expectedStr.includes(actualStr));
        const isInvalid = element.getAttribute && element.getAttribute('aria-invalid') === 'true';

        // Check for visible error message container
        const container = (typeof element.closest === 'function')
            ? element.closest('.form-group, [data-automation-id="formField"], .field, fieldset') || element.parentElement
            : element.parentElement;
        const hasErrorNode = container ? !!container.querySelector('.has-error, .is-invalid, .invalid-feedback, .error-message, [role="alert"]') : false;

        if (matches && !isInvalid && !hasErrorNode) {
            return { verified: true, actual: actualStr };
        }

        // Self-Correction Fallback Loop
        console.warn(`[AgentOrchestrator] ⚠️ Verification flag on "${field.label}". Attempting self-correction...`);
        this.cursor.setStatus(`Validating: ${field.label || 'Field'}...`, '🔧', 'moving');

        let correctedVal = expectedAnswer;
        if (type === 'tel' || /phone|mobile/i.test(field.label || '')) {
            const digits = String(expectedAnswer).replace(/\D/g, '');
            correctedVal = digits.length > 10 ? digits.slice(-10) : digits;
        } else if (type === 'date' || /date|birth/i.test(field.label || '')) {
            const dStr = String(expectedAnswer).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
                const [y, m, d] = dStr.split('-');
                correctedVal = `${m}/${d}/${y}`;
            } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
                const [m, d, y] = dStr.split('/');
                correctedVal = `${y}-${m}-${d}`;
            }
        }

        try {
            const proto = Object.getPrototypeOf(element);
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                || (typeof window !== 'undefined' && window.HTMLInputElement && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set);
            if (nativeSetter) {
                nativeSetter.call(element, String(correctedVal));
            } else {
                element.value = String(correctedVal);
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) {}

        await this.cursor.sleep(100);
        const recheckVal = (element.value || '').trim();
        const recheckMatches = recheckVal.length > 0;
        const recheckInvalid = element.getAttribute && element.getAttribute('aria-invalid') === 'true';

        if (recheckMatches && !recheckInvalid) {
            console.log(`[AgentOrchestrator] 🎯 Self-correction succeeded for "${field.label}" with value: ${correctedVal}`);
            this.cursor.setStatus(`Corrected: ${field.label || 'Field'} 🎯`, '🎯', 'idle');
            return { verified: true, corrected: true, value: correctedVal };
        }

        return { verified: recheckMatches, actual: recheckVal, warning: true };
    }

    /**
     * Collect all radio options in a group (supports native, ARIA role="radio", and Shadow DOM)
     */
    getRadioGroup(element) {
        if (!element) return [];
        const name = element.name;
        let radioGroup = [];
        if (name) {
            radioGroup = Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`));
        }
        if (radioGroup.length <= 1) {
            let cur = element;
            let container = null;
            for (let s = 0; s < 8 && cur; s++) {
                if (typeof cur.matches === 'function' && cur.matches('fieldset, [role="radiogroup"], spl-radio-group, [role="listitem"], .form-group, .question, .field, [class*="question" i]')) {
                    container = cur;
                    break;
                }
                cur = cur.parentElement || (typeof cur.getRootNode === 'function' && cur.getRootNode().host ? cur.getRootNode().host : null);
            }
            if (!container) container = element.parentElement;
            if (container && typeof container.querySelectorAll === 'function') {
                const found = Array.from(container.querySelectorAll('input[type="radio"], [role="radio"], spl-radio'));
                if (found.length > 0) radioGroup = found;
            }
        }
        if (radioGroup.length === 0) {
            radioGroup = [element];
        }
        return radioGroup;
    }

    /**
     * Select radio button matching target value (supports native, Google Forms ARIA, and Shadow DOM)
     */
    async selectRadioButton(field, answer, isRequiredField = false) {
        const element = field.element;
        if (!element) return false;

        const radioGroup = this.getRadioGroup(element);
        const ansLower = String(answer || '').trim().toLowerCase();

        // Helper to extract label text associated with a radio button
        const getRadioLabel = (r) => {
            if (!r) return '';
            const aria = r.getAttribute && (r.getAttribute('aria-label') || r.getAttribute('label'));
            if (aria) return aria.trim().toLowerCase();
            const dataVal = r.getAttribute && r.getAttribute('data-value');
            if (dataVal) return dataVal.trim().toLowerCase();

            // Check Shadow DOM host label (SmartRecruiters <spl-radio label="Yes">)
            const root = typeof r.getRootNode === 'function' ? r.getRootNode() : null;
            if (root && root.host) {
                const hostLbl = root.host.getAttribute('label') || root.host.getAttribute('aria-label') || root.host.textContent;
                if (hostLbl && hostLbl.trim()) return hostLbl.trim().toLowerCase();
            }

            let labelText = '';
            if (r.id) {
                const l = document.querySelector(`label[for="${r.id}"]`);
                if (l) labelText = l.textContent || '';
            }
            if (!labelText && typeof r.closest === 'function') {
                const wrapLabel = r.closest('label');
                if (wrapLabel) labelText = wrapLabel.textContent || '';
            }
            if (!labelText && r.nextElementSibling && r.nextElementSibling.tagName === 'LABEL') {
                labelText = r.nextElementSibling.textContent || '';
            }
            if (!labelText && r.textContent && r.textContent.trim().length > 0 && r.textContent.trim().length < 80) {
                labelText = r.textContent;
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
            const isAriaRadio = targetRadio.getAttribute && targetRadio.getAttribute('role') === 'radio';
            if (targetRadio.tagName === 'INPUT') {
                targetRadio.checked = true;
            } else if (targetRadio.shadowRoot && typeof targetRadio.shadowRoot.querySelector === 'function') {
                const innerRadio = targetRadio.shadowRoot.querySelector('input[type="radio"], [role="radio"]');
                if (innerRadio) {
                    if (innerRadio.tagName === 'INPUT') innerRadio.checked = true;
                    if (typeof innerRadio.click === 'function') innerRadio.click();
                    innerRadio.dispatchEvent(new Event('input', { bubbles: true }));
                    innerRadio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            if (isAriaRadio) {
                targetRadio.setAttribute('aria-checked', 'true');
            }
            if (typeof MouseEvent !== 'undefined') {
                targetRadio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                targetRadio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            }
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

        // 2. Radio & Checkbox (supports native inputs and ARIA role="radio" / role="checkbox")
        const role = element.getAttribute ? element.getAttribute('role') : '';
        if (field.type === 'radio' || element.type === 'radio' || role === 'radio') {
            const group = this.getRadioGroup(element);
            return group.some(r => {
                if (r.checked || (r.getAttribute && r.getAttribute('aria-checked') === 'true')) return true;
                if (r.shadowRoot && typeof r.shadowRoot.querySelector === 'function') {
                    const inner = r.shadowRoot.querySelector('input[type="radio"], [role="radio"]');
                    if (inner && (inner.checked || (inner.getAttribute && inner.getAttribute('aria-checked') === 'true'))) return true;
                }
                return false;
            });
        }
        if (field.type === 'checkbox' || element.type === 'checkbox' || role === 'checkbox') {
            return !!(element.checked || (element.getAttribute && element.getAttribute('aria-checked') === 'true'));
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
        const searchInput = document.querySelector('input[type="search"], input[role="searchbox"], [role="listbox"] input, .select-menu input, [class*="search"] input, input[placeholder*="search" i], input[placeholder*="country" i], input[aria-label*="search" i]');
        if (searchInput && this.isElementVisible(searchInput)) {
            await this.cursor.moveTo(searchInput);
            await this.cursor.type(searchInput, targetText, { humanSpeed: true });
            await this.cursor.sleep(300);
        }

        // Collect candidate options from open dropdown or portal
        const optionSelectors = [
            '[role="option"]',
            '.c-country-select__item',
            '.c-country-select__list li',
            '.c-autocomplete__item',
            '.c-autocomplete__list li',
            '.c-autocomplete__menu li',
            '.spl-select-options li',
            '.spl-autocomplete-item',
            '.iti__country',
            '.country-list li',
            'li[data-country-code]',
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
            } else if (!matchedOption && (/^\+?1$/i.test(targetText) || /united\s*states|usa?\b/i.test(targetText))) {
                matchedOption = candidateOptions.find(opt => {
                    const text = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    return text.includes('united states') || text.includes('+1') || text.includes('(1)');
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
                await this.dismissLingeringPopoffs();
                return true;
            } else {
                console.warn(`[AgentOrchestrator] No matching dropdown option found for: "${targetText}"`);
                await this.dismissLingeringPopoffs();
            }
        }

        // Final fallback: try fillFieldRobustly
        if (this.automation && typeof this.automation.fillFieldRobustly === 'function') {
            const res = await this.automation.fillFieldRobustly(element, answer);
            await this.dismissLingeringPopoffs();
            return res;
        }

        await this.dismissLingeringPopoffs();
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

            // Priority patterns for Apply buttons (including SmartRecruiters "I'm interested")
            const isMatch = /^(?:apply|easy\s*apply|quick\s*apply|start\s*application|i['’]m\s*interested|interested)\b/i.test(text) ||
                            /\b(?:apply\s*(?:now|online|for\s*this\s*job|to\s*job|with\s*resume|today|externally|on\s*company\s*site)|i['’]m\s*interested)\b/i.test(text) ||
                            /^(?:apply|easy\s*apply|i['’]m\s*interested)$/i.test(text) ||
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
     * Detect stale, corrupted, or format-mismatched values already inside form fields
     */
    isStaleOrCorruptedValue(field, val) {
        if (!val) return false;
        const v = String(val).trim();
        const label = (field.label || field.name || '').toLowerCase();

        // 1. PDF/LaTeX metadata artifacts (e.g. "This is pdfTeX", "Version")
        if (/\b(?:pdftex|xetex|luatex|latex|overleaf|endobj|flatedecode)\b/i.test(v) || /^version$/i.test(v)) {
            return true;
        }
        // 2. Phone number field containing only a bare dial code like "+1" or "+91"
        if ((field.type === 'tel' || /phone|mobile|contact\s*number/i.test(label)) && v.replace(/\D/g, '').length < 7) {
            return true;
        }
        // 3. Short numeric/academic fields containing essays or wrong formats
        if (/\b(cgpa|gpa|percentage)\b/i.test(label) && (v.split(/\s+/).length > 3 || !/\d/.test(v))) {
            return true;
        }
        if (/\b(year\s*of\s*completion|graduation\s*year|passing\s*year)\b/i.test(label) && !/^(?:19|20)\d{2}$/.test(v)) {
            return true;
        }
        if (/\b(branch|speciali[sz]ation)\b/i.test(label) && v.split(/\s+/).length > 8) {
            return true;
        }
        return false;
    }

    /**
     * Extract Job Title and Company from DOM
     */
    extractPageContext() {
        let jobTitle = '';
        let company = '';

        // Try h1 or Google Forms title heading
        const h1 = document.querySelector('h1, [role="heading"][aria-level="1"], .F9yp7e');
        if (h1) jobTitle = h1.textContent.trim();

        // Try meta tags (excluding generic form hosting names like "Google Docs", "Typeform")
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
            jobTitle = jobTitle || ogTitle.content;
        }

        // Parse "Role Application – Company" or "Role at Company"
        if (jobTitle) {
            const sepMatch = jobTitle.match(/^(.+?)\s+(?:application\s*[-–—|@]\s*|[-–—|@]\s*|at\s+)(.+)$/i);
            if (sepMatch) {
                jobTitle = sepMatch[1].replace(/\bapplication\b/i, '').trim();
                company = sepMatch[2].trim();
            }
        }

        const ogSite = document.querySelector('meta[property="og:site_name"]');
        if (!company && ogSite && ogSite.content) {
            const siteName = ogSite.content.trim();
            if (!/^(?:google\s*docs|google\s*forms|typeform|tally|jotform|greenhouse|lever|workday|smartrecruiters|ashby)$/i.test(siteName)) {
                company = siteName;
            }
        }

        // Hostname fallback
        if (!company) {
            const hostParts = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname.split('.') : [];
            const hostBase = hostParts[hostParts.length - 2] || '';
            if (!/^(?:google|typeform|tally|jotform)$/i.test(hostBase)) {
                company = hostBase || 'the employer';
            }
        }

        return { jobTitle: jobTitle || 'Target Position', company: company || 'your organization' };
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

    /**
     * Broadcast live execution progress to SidePanel & Extension UI
     */
    emitProgress(step, desc, extra = {}) {
        try {
            const total = this.stats.total || 0;
            const processed = (this.stats.filled || 0) + (this.stats.skipped || 0) + (this.stats.failed || 0);
            const percent = extra.percent !== undefined
                ? extra.percent
                : (total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0);

            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'AGENT_PROGRESS',
                    step,
                    desc,
                    stats: { ...this.stats },
                    percent,
                    isRunning: this.isRunning,
                    ...extra
                }).catch(() => {});
            }
        } catch (e) {}
    }

    /**
     * Phase 2: Real-Time MutationObserver + Poll Pop-up Detector
     * Reacts immediately (< 20ms) when a pop-up/portal/dropdown mounts onto the DOM.
     */
    async waitForPopupOptions(selectors = [], maxWaitMs = 700, pollInterval = 80) {
        const scan = () => {
            for (const sel of selectors) {
                try {
                    const found = Array.from(document.querySelectorAll(sel)).filter(el => this.isElementVisible(el));
                    if (found.length > 0) return found;
                } catch (e) {}
            }
            return [];
        };

        const immediate = scan();
        if (immediate.length > 0) return immediate;

        if (typeof MutationObserver === 'undefined' || !document.body) {
            const start = Date.now();
            while (Date.now() - start < maxWaitMs) {
                await this.cursor.sleep(pollInterval);
                const found = scan();
                if (found.length > 0) return found;
            }
            return [];
        }

        return new Promise((resolve) => {
            let resolved = false;
            const finish = (res) => {
                if (resolved) return;
                resolved = true;
                try { observer.disconnect(); } catch (e) {}
                clearTimeout(timer);
                clearInterval(poller);
                resolve(res);
            };

            const observer = new MutationObserver(() => {
                const found = scan();
                if (found.length > 0) finish(found);
            });
            try {
                observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-expanded'] });
            } catch (e) {}

            const poller = setInterval(() => {
                const found = scan();
                if (found.length > 0) finish(found);
            }, pollInterval);

            const timer = setTimeout(() => {
                finish(scan());
            }, maxWaitMs);
        });
    }

    /**
     * Phase 2: Scroll inside a scrollable pop-up / dropdown container to find hidden options
     */
    async scrollPopupForMatchingOption(sampleOptionEl, targetText) {
        if (!sampleOptionEl || !targetText) return null;
        const container = typeof sampleOptionEl.closest === 'function'
            ? sampleOptionEl.closest('[role="listbox"], [role="menu"], ul, .c-country-select__list, .c-autocomplete__menu, [class*="menu" i], [class*="list" i]') || sampleOptionEl.parentElement
            : sampleOptionEl.parentElement;
        if (!container) return null;

        const tokens = targetText.split(/[\s,]+/).filter(w => w.length > 2);
        for (let step = 0; step < 6; step++) {
            const items = Array.from(container.querySelectorAll('[role="option"], li, [data-value], div[tabindex]'));
            const match = items.find(el => {
                const txt = (el.textContent || '').trim().toLowerCase();
                return txt === targetText || txt.includes(targetText) || (tokens.length > 0 && tokens.some(t => txt.includes(t)));
            });
            if (match) {
                if (typeof match.scrollIntoView === 'function') match.scrollIntoView({ block: 'center' });
                return match;
            }
            if (typeof container.scrollTop === 'number') {
                container.scrollTop += 180;
                await this.cursor.sleep(50);
            } else {
                break;
            }
        }
        return null;
    }

    /**
     * Phase 3: Set-of-Mark (SoM) Screenshot + Vision AI Grounding
     * Overlays temporary numbered badges [1..N], captures screenshot, asks Vision AI, removes badges.
     */
    async locateTargetViaVision(goalDescription, candidateElements = []) {
        if (!candidateElements || candidateElements.length === 0) return null;
        if (!this.brain?.llmClient || typeof this.brain.llmClient.completeWithVision !== 'function') return null;
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return null;

        const overlays = [];
        const markMap = new Map();
        try {
            candidateElements.forEach((el, idx) => {
                if (!el || typeof el.getBoundingClientRect !== 'function') return;
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                const id = idx + 1;
                markMap.set(id, { element: el, rect, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

                if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
                    const badge = document.createElement('div');
                    badge.textContent = `[${id}]`;
                    badge.style.cssText = `position:fixed;left:${Math.max(2, rect.left)}px;top:${Math.max(2, rect.top)}px;z-index:2147483647;background:#D97757;color:#fff;font:bold 11px monospace;padding:1px 4px;border-radius:4px;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,0.4);`;
                    document.body.appendChild(badge);
                    overlays.push(badge);
                }
            });

            if (markMap.size === 0) return null;

            const capRes = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (res) => resolve(res || null));
            });

            // Immediately remove SoM badges
            overlays.forEach(b => b.remove());
            overlays.length = 0;

            if (!capRes || !capRes.success || !capRes.dataUrl) return null;

            const visionRes = await this.brain.llmClient.completeWithVision(
                'You are a visual UI grounding agent. Look at the numbered orange [N] badges in the screenshot. Reply ONLY with the integer N of the element that satisfies the goal, or 0 if none match.',
                `Goal: ${goalDescription}`,
                capRes.dataUrl
            );

            const matchNum = visionRes ? parseInt(String(visionRes).replace(/[^\d]/g, ''), 10) : 0;
            if (matchNum && markMap.has(matchNum)) {
                return markMap.get(matchNum);
            }
        } catch (e) {
            overlays.forEach(b => { try { b.remove(); } catch (_) {} });
        }
        return null;
    }

    /**
     * Phase 4: Trusted Hardware-Level Click (CDP Input.dispatchMouseEvent with smooth DOM fallback)
     */
    async trustedClick(element) {
        if (!element) return false;
        await this.cursor.moveTo(element);
        this.cursor.highlightElement(element);
        await this.cursor.click(element);

        const coords = this.cursor?.lastTargetCoords;
        if (coords && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                const cdpRes = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: 'CDP_CLICK', x: coords.x, y: coords.y }, (r) => resolve(r));
                });
                if (cdpRes && cdpRes.success && cdpRes.trusted) {
                    return true;
                }
            } catch (e) {}
        }

        if (this.automation && typeof this.automation.clickHumanLike === 'function') {
            await this.automation.clickHumanLike(element);
        } else if (typeof element.click === 'function') {
            element.click();
        }
        if (typeof MouseEvent !== 'undefined') {
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
        return true;
    }

    async stop(clearSession = true) {
        this.isRunning = false;
        this.setState('STOPPED');
        this.emitProgress('stopped', 'Agent stopped.', { isRunning: false, done: true });
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'CDP_DETACH' }).catch(() => {});
        }
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
