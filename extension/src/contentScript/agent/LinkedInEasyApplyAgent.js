/**
 * LinkedIn Easy Apply Autonomous Agent
 * High-precision, observation-driven LinkedIn application engine.
 * Handles single job views, multi-card search feeds, dual-UI/Shadow-DOM modals,
 * Yes/No & screening questions, resume selection, multi-step navigation,
 * native React value dispatch, validation recovery, and automatic Kanban tracking.
 */
var LinkedInEasyApplyAgent = (typeof window !== 'undefined' && window.LinkedInEasyApplyAgent) || class LinkedInEasyApplyAgent {
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
        this.processedJobIds = new Set();
        this.appliedCount = 0;
        this.skippedCount = 0;
        this.failedCount = 0;
        this.maxApplications = 15;
        this.unfollowCompany = true;
        this.autoSubmit = true;
    }

    static isLinkedInJobsPage() {
        if (typeof window === 'undefined' || !window.location) return false;
        const host = (window.location.hostname || '').toLowerCase();
        const path = (window.location.pathname || '').toLowerCase();
        return host.includes('linkedin.com') && (path.startsWith('/jobs') || path.includes('/jobs/view'));
    }

    async humanDelay(minMs = 350, maxMs = 700) {
        const ms = Math.floor(minMs + Math.random() * Math.max(0, maxMs - minMs));
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    emitProgress(statusText) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'LINKEDIN_APPLY_PROGRESS',
                    applied: this.appliedCount,
                    skipped: this.skippedCount,
                    failed: this.failedCount,
                    statusText
                });
            }
        } catch (e) {}
    }

    async recordJobToKanban(company, jobTitle, url, status = 'applied') {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const data = await chrome.storage.local.get(['applications']);
                const list = Array.isArray(data.applications) ? data.applications : [];
                const safeUrl = url || window.location.href;
                const safeCompany = company || 'LinkedIn Company';
                const safeTitle = jobTitle || 'Software Professional';

                const existingIdx = list.findIndex(a => 
                    (a.url && safeUrl && a.url.split('?')[0] === safeUrl.split('?')[0]) ||
                    (a.company?.toLowerCase() === safeCompany.toLowerCase() && a.jobTitle?.toLowerCase() === safeTitle.toLowerCase())
                );

                const newRecord = {
                    id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    company: safeCompany,
                    jobTitle: safeTitle,
                    url: safeUrl,
                    platform: 'LinkedIn Easy Apply',
                    status: status,
                    date: new Date().toISOString()
                };

                if (existingIdx >= 0) {
                    list[existingIdx] = Object.assign({}, list[existingIdx], newRecord);
                } else {
                    list.unshift(newRecord);
                }
                await chrome.storage.local.set({ applications: list.slice(0, 100) });
                console.log(`[LinkedInEasyApply] 📋 Synced "${safeTitle}" at ${safeCompany} to Kanban (${status}).`);
            }
        } catch (e) {
            console.warn('[LinkedInEasyApply] Kanban sync error:', e);
        }
    }

    /**
     * Recursively query main document and ALL nested Shadow DOMs
     */
    queryAllDeep(selector, root = document) {
        const results = [];
        const visited = new Set();
        const walk = (node) => {
            if (!node || visited.has(node)) return;
            visited.add(node);
            try {
                if (typeof node.querySelectorAll === 'function') {
                    results.push(...Array.from(node.querySelectorAll(selector)));
                    const all = node.querySelectorAll('*');
                    for (let i = 0; i < all.length; i++) {
                        if (all[i].shadowRoot) walk(all[i].shadowRoot);
                    }
                }
            } catch (e) {}
        };
        walk(root);
        return results;
    }

    detectSecurityChallenge() {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        return Boolean(
            document.querySelector('#captcha-internal, iframe[src*="checkpoint"], iframe[src*="captcha"]') ||
            bodyText.includes("let's do a quick security check") ||
            bodyText.includes("you've reached the easy apply limit") ||
            bodyText.includes('unusual activity detected')
        );
    }

    findEasyApplyModal() {
        const candidates = this.queryAllDeep(
            '[role="dialog"], [aria-modal="true"], .artdeco-modal, .jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], dialog[open]'
        );
        for (const m of candidates) {
            if (!m) continue;
            const r = typeof m.getBoundingClientRect === 'function' ? m.getBoundingClientRect() : null;
            if (r && r.width > 200 && r.height > 150) {
                const txt = (m.textContent || m.innerText || '').toLowerCase();
                const hasHeader = /apply\s+to|contact\s+info|resume|review|screening|additional/i.test(txt);
                const hasButtons = Boolean(m.querySelector('button[aria-label*="Next" i], button[aria-label*="Review" i], button[aria-label*="Submit" i], button[aria-label="Dismiss" i], .artdeco-button--primary'));
                if (hasHeader || hasButtons) {
                    return m;
                }
            }
        }
        return candidates.find(m => {
            const r = m?.getBoundingClientRect?.();
            return r && r.width > 250 && r.height > 200;
        }) || null;
    }

    async waitForEasyApplyModal(timeoutMs = 5000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const modal = this.findEasyApplyModal();
            if (modal) return modal;
            await this.humanDelay(100, 200);
        }
        return null;
    }

    findEasyApplyButton() {
        const candidates = this.queryAllDeep(
            '.jobs-apply-button, button[aria-label*="Easy Apply" i], button.jobs-apply-button--top-card, [data-view-name*="apply"] button, [data-view-name*="apply"] a, a[aria-label*="Easy Apply" i], button[data-control-name="jobdetails_topcard_easy_apply"], .jobs-s-apply button, a[href*="easy-apply"]'
        );
        for (const btn of candidates) {
            if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
            if (typeof btn.getBoundingClientRect === 'function') {
                const r = btn.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
            }
            const label = ((btn.getAttribute?.('aria-label') || '') + ' ' + (btn.textContent || btn.innerText || '')).replace(/\s+/g, ' ').trim();
            if (/\beasy\s*apply\b/i.test(label) && !/\bapplied\b/i.test(label)) {
                return btn;
            }
        }
        return null;
    }

    scanJobCards() {
        let cards = this.queryAllDeep(
            '.job-card-container, .jobs-search-results__list-item, li.scaffold-layout__list-item, [data-occludable-job-id], [data-job-id], [data-view-name="job-card"], [data-view-name="job-search-card"], div[role="listitem"]'
        );
        if (cards.length === 0) {
            const jobLinks = this.queryAllDeep('a[href*="/jobs/view/"], a[href*="currentJobId="]');
            cards = jobLinks.map((a) => a.closest?.('li, [role="listitem"], div[data-job-id], div[class*="card"]') || a).filter(Boolean);
        }
        const seen = new Set();
        const unique = [];
        for (const card of cards) {
            if (seen.has(card)) continue;
            seen.add(card);
            const linkEl = card.querySelector?.('a[href*="/jobs/view/"], a[href*="currentJobId="]');
            const linkHref = linkEl?.getAttribute?.('href') || card.getAttribute?.('href') || '';
            const hrefId = linkHref.match(/\/jobs\/view\/(\d+)/)?.[1] || linkHref.match(/currentJobId=(\d+)/)?.[1] || '';
            const jobId =
                card.getAttribute?.('data-job-id') ||
                card.getAttribute?.('data-occludable-job-id') ||
                card.querySelector?.('[data-job-id]')?.getAttribute?.('data-job-id') ||
                hrefId ||
                (card.textContent || card.innerText || '').trim().slice(0, 60);
            if (!jobId || this.processedJobIds.has(jobId)) continue;

            const text = (card.textContent || card.innerText || '').toLowerCase().trim();
            if (!text || text.length < 5) continue;
            if (/\bapplied\b/.test(text) || text.includes('no longer accepting')) {
                this.processedJobIds.add(jobId);
                this.skippedCount++;
                continue;
            }
            unique.push({ element: card, jobId });
        }
        console.log(`[LinkedInEasyApply] 📋 Scanned ${unique.length} unapplied job card(s).`);
        return unique;
    }

    extractJobMeta(modal) {
        let company = '';
        let jobTitle = '';

        if (modal) {
            const header = modal.querySelector('h2, [data-test-modal-header], .jobs-easy-apply-modal__header');
            const hText = header?.textContent || header?.innerText || '';
            const m = hText.match(/apply\s+to\s+([^\n\r\t]+)/i);
            if (m) company = m[1].trim();
        }

        if (!company) {
            const compEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a[href*="/company/"]');
            if (compEl) company = (compEl.textContent || compEl.innerText || '').trim();
        }

        const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
        if (titleEl) {
            jobTitle = (titleEl.textContent || titleEl.innerText || '').trim();
        } else {
            jobTitle = (document.title || '').split(/[-|]/)[0].trim();
        }

        return { company: company || 'Company', jobTitle: jobTitle || 'Target Role' };
    }

    setNativeValue(el, val) {
        if (!el) return;
        const proto = el.__proto__ || (typeof window !== 'undefined' && window.HTMLInputElement?.prototype) || {};
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                            (typeof window !== 'undefined' && window.HTMLInputElement && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set) ||
                            (typeof window !== 'undefined' && window.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set) ||
                            (typeof window !== 'undefined' && window.HTMLSelectElement && Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set);
        if (valueSetter) {
            valueSetter.call(el, val);
        } else {
            el.value = val;
        }
        if (typeof el.dispatchEvent === 'function') {
            try {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {}
        }
    }

    /**
     * High-accuracy resolution for Yes/No, Radio, and Binary screening questions
     */
    resolveYesNoOrRadio(questionText, options = [], brain = null) {
        const q = (questionText || '').toLowerCase().trim();
        const optLower = options.map(o => String(o).toLowerCase().trim());
        const isYesNo = optLower.some(o => o === 'yes' || o === 'true') && optLower.some(o => o === 'no' || o === 'false');

        // Sponsorship / Visa requirements -> Candidate does NOT require sponsorship unless profile states otherwise
        if (/require.*sponsor|sponsorship|visa.*support|work.*visa/i.test(q)) {
            const needSponsor = Boolean(brain?.profile?.require_sponsorship);
            return needSponsor ? 'Yes' : 'No';
        }

        // Work authorization / legal eligibility -> YES
        if (/authorized|legally\s*authorized|eligible\s*to\s*work|right\s*to\s*work/i.test(q)) {
            return 'Yes';
        }

        // Age 18+ requirement -> YES
        if (/18\s*years|at\s*least\s*18|legal\s*age/i.test(q)) {
            return 'Yes';
        }

        // Background check / drug screen / reference checks -> YES
        if (/background\s*check|drug\s*screen|reference\s*check|consent.*background|verify.*background/i.test(q)) {
            return 'Yes';
        }

        // Commute / Relocation / On-site / Hybrid comfort -> YES
        if (/comfort.*(?:commute|travel|on-site|onsite|hybrid|in-person)|willing.*(?:commute|relocate|travel)|able\s*to\s*commute|reside/i.test(q)) {
            return 'Yes';
        }

        // Degrees / High school / Bachelor / Graduation -> YES
        if (/bachelor|degree|high\s*school|diploma|graduat|completed.*education/i.test(q)) {
            return 'Yes';
        }

        // Valid Driver's license -> YES
        if (/driver(?:'s)?\s*license|driving\s*license|valid\s*license/i.test(q)) {
            return 'Yes';
        }

        // Experience / Comfort with skills or tools -> YES
        if (/experience\s*(?:with|in)|comfortable\s*using|proficient\s*in|familiar\s*with/i.test(q)) {
            return 'Yes';
        }

        // Prior employment at company -> NO
        if (/previously\s*employed|worked\s*for|former\s*employee|ever\s*worked\s*(?:at|for)/i.test(q)) {
            return 'No';
        }

        // Non-compete agreement -> NO
        if (/non-?compete|restrictive\s*covenant|confidentiality\s*agreement/i.test(q)) {
            return 'No';
        }

        // Misconduct / criminal history / disbarment -> NO
        if (/convicted|felon|misconduct|debarred|terminated\s*for\s*cause/i.test(q)) {
            return 'No';
        }

        // General willingness ("Are you willing / able / comfortable") -> YES
        if (/are\s*you\s*(?:willing|able|comfortable|ready|open)/i.test(q)) {
            return 'Yes';
        }

        // Fallback for general Yes/No: default to Yes for positive qualification
        if (isYesNo) {
            return 'Yes';
        }

        // For non-binary radio: pick first option that is not decline/negative
        const valid = options.find(o => !/decline|prefer\s*not|don't\s*wish/i.test(o));
        return valid || options[0] || null;
    }

    /**
     * Ensure a resume is selected on LinkedIn's Resume step
     */
    async ensureResumeSelected(modal) {
        const orch = this.orchestrator;
        const cards = Array.from(modal.querySelectorAll('.jobs-document-upload-redesign-card, [data-test-document-upload-card]'));
        if (cards.length === 0) return;

        const alreadySelected = cards.some((c) =>
            c.classList?.contains('jobs-document-upload-redesign-card--selected') ||
            c.getAttribute?.('aria-checked') === 'true' ||
            c.querySelector?.('input[type="radio"]:checked, button[aria-label*="Selected" i]')
        );
        if (alreadySelected) return;

        const firstCard = cards[0];
        const selectBtn = firstCard.querySelector?.('button[aria-label*="Choose" i], button[aria-label*="Select" i], label, input[type="radio"]') || firstCard;
        if (orch.cursor) await orch.cursor.moveTo(selectBtn);
        await orch.trustedClick(selectBtn);
        if (typeof selectBtn.click === 'function') selectBtn.click();
        await this.humanDelay(150, 250);
    }

    extractModalFieldLabel(el, modal) {
        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim()) return aria.trim();
        const id = el.id;
        if (id && modal) {
            const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(id) : id;
            const lbl = modal.querySelector(`label[for="${escaped}"]`);
            if (lbl && (lbl.textContent || lbl.innerText)) return (lbl.textContent || lbl.innerText).trim();
        }
        const parentLabel = el.closest('label');
        if (parentLabel && (parentLabel.textContent || parentLabel.innerText)) {
            return (parentLabel.textContent || parentLabel.innerText).trim();
        }
        const group = el.closest('.fb-dash-form-element, .artdeco-text-input--container, fieldset');
        if (group) {
            const title = group.querySelector('label, legend, .fb-dash-form-element__label, span[data-test-form-element-label]');
            if (title && (title.textContent || title.innerText)) {
                return (title.textContent || title.innerText).trim();
            }
        }
        return el.placeholder || el.name || '';
    }

    async fillModalStep(modal, jobContext = {}, isRepair = false) {
        const orch = this.orchestrator;
        const brain = orch.brain;
        const cursor = orch.cursor;

        // 1. Radio Groups (Yes/No, Screening Questions)
        const radioGroups = Array.from(modal.querySelectorAll('fieldset, [role="radiogroup"], .fb-dash-form-element[data-test-form-builder-radios]'));
        for (const group of radioGroups) {
            if (!orch.isRunning) return;
            const radios = Array.from(group.querySelectorAll('input[type="radio"]'));
            if (radios.length === 0) continue;
            if (!isRepair && radios.some((r) => r.checked)) continue;

            const legend = group.querySelector('legend, span[data-test-form-element-label], .fb-dash-form-element__label, label');
            const question = (legend?.textContent || legend?.innerText || group.getAttribute('aria-label') || '').trim();
            const options = radios.map((r) => {
                const escaped = r.id && (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(r.id) : r.id;
                const lbl = escaped ? group.querySelector(`label[for="${escaped}"]`) : null;
                const fallbackLbl = lbl || r.closest('label') || r.parentElement;
                return (fallbackLbl?.textContent || fallbackLbl?.innerText || r.value || '').trim();
            }).filter(Boolean);

            if (options.length === 0) continue;

            let chosenValue = this.resolveYesNoOrRadio(question, options, brain);

            // Level 2 fallback: Consult brain if options aren't standard Yes/No
            if (!chosenValue && brain) {
                const res = await brain.resolveAnswer(
                    { label: question, type: 'radio', options, element: radios[0] },
                    { ...jobContext, virtualCursor: cursor }
                );
                if (res && res.value) chosenValue = String(res.value).trim();
            }

            if (chosenValue) {
                const targetVal = chosenValue.toLowerCase();
                const matchIdx = radios.findIndex((r, idx) => {
                    const optTxt = (options[idx] || '').toLowerCase();
                    return optTxt === targetVal || optTxt.startsWith(targetVal) || targetVal.startsWith(optTxt);
                });
                const chosenRadio = radios[matchIdx >= 0 ? matchIdx : 0];
                const escapedRadioId = chosenRadio.id && (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(chosenRadio.id) : chosenRadio.id;
                const clickTarget = (escapedRadioId && group.querySelector(`label[for="${escapedRadioId}"]`)) || chosenRadio.closest('label') || chosenRadio;

                if (cursor) await cursor.moveTo(clickTarget);
                await orch.trustedClick(clickTarget);
                chosenRadio.checked = true;
                chosenRadio.dispatchEvent(new Event('input', { bubbles: true }));
                chosenRadio.dispatchEvent(new Event('change', { bubbles: true }));
                if (typeof chosenRadio.click === 'function') chosenRadio.click();
                await this.humanDelay(100, 200);
            }
        }

        // 2. Text, Numeric, Textarea, Select Inputs
        const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="file"]), select, textarea'));
        for (const el of inputs) {
            if (!orch.isRunning) return;
            const label = this.extractModalFieldLabel(el, modal);

            // Checkbox handling (Unfollow company / Terms)
            if (el.type === 'checkbox') {
                if (this.unfollowCompany && /follow/i.test(label) && el.checked) {
                    if (cursor) await cursor.moveTo(el);
                    await orch.trustedClick(el);
                } else if (!el.checked && (el.required || /agree|acknowledge|confirm|certify|terms|privacy/i.test(label))) {
                    if (cursor) await cursor.moveTo(el);
                    await orch.trustedClick(el);
                    if (!el.checked && typeof el.click === 'function') el.click();
                }
                continue;
            }

            // Skip fields that already have valid user data (unless in repair mode and field is invalid)
            if (!isRepair && el.value && String(el.value).trim() !== '' && el.tagName !== 'SELECT') continue;
            if (!isRepair && el.tagName === 'SELECT' && el.value && !/select an option/i.test(el.options?.[el.selectedIndex]?.text || '')) {
                continue;
            }

            // Numeric Experience Screening Question
            if (/\b(?:how\s*many\s*years|years\s*of\s*experience|total\s*years)\b/i.test(label) || el.pattern === '[0-9]*' || el.type === 'number') {
                const yoe = String(parseInt(brain?.profile?.years_of_experience || '3', 10) || 3);
                if (cursor) await cursor.moveTo(el);
                await orch.trustedClick(el);
                this.setNativeValue(el, yoe);
                await this.humanDelay(60, 120);
                continue;
            }

            // Standard resolution via PersonalAgentBrain
            const options = el.tagName === 'SELECT'
                ? Array.from(el.options).map((o) => (o.text || o.innerText || '').trim()).filter((t) => t && !/select an option/i.test(t))
                : [];

            let res = null;
            if (brain) {
                res = await brain.resolveAnswer(
                    { label, type: el.tagName === 'SELECT' ? 'select' : (el.type || 'text'), name: el.name || el.id || '', options, element: el },
                    { ...jobContext, virtualCursor: cursor }
                );
            }

            let val = res?.value;
            // Fallback for empty required text fields in repair mode
            if ((val === null || val === undefined || String(val).trim() === '') && isRepair) {
                if (/salary|ctc|compensation/i.test(label)) val = brain?.profile?.expected_salary || 'Open';
                else if (/notice/i.test(label)) val = brain?.profile?.notice_period || 'Immediately';
                else val = 'N/A';
            }

            if (val === null || val === undefined || String(val).trim() === '') continue;
            val = String(val).trim();

            if (cursor) await cursor.moveTo(el);

            if (el.tagName === 'SELECT') {
                const matchOpt = Array.from(el.options).find((o) => (o.text || '').trim().toLowerCase() === val.toLowerCase()) ||
                                 Array.from(el.options).find((o) => (o.text || '').trim().toLowerCase().includes(val.toLowerCase()));
                if (matchOpt) {
                    el.value = matchOpt.value;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                await orch.trustedClick(el);
                if (cursor && typeof cursor.type === 'function') {
                    await cursor.type(el, val);
                } else {
                    this.setNativeValue(el, val);
                }
                if (typeof orch.ensureDropdownSelectionAndDismiss === 'function') {
                    await orch.ensureDropdownSelectionAndDismiss(el, val, label);
                }
            }
            await this.humanDelay(50, 100);
        }
    }

    findModalButton(modal, regex) {
        let buttons = [];
        try {
            if (typeof modal.querySelectorAll === 'function') {
                buttons = Array.from(modal.querySelectorAll('button'));
            }
        } catch (e) {}
        if (buttons.length === 0) {
            buttons = this.queryAllDeep('button, a[role="button"]', modal);
        }
        for (const b of buttons) {
            if (b.disabled || b.getAttribute?.('aria-disabled') === 'true') continue;
            if (typeof b.getBoundingClientRect === 'function') {
                const r = b.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
            }
            const txt = ((b.getAttribute?.('aria-label') || '') + ' ' + (b.innerText || b.textContent || '')).replace(/\s+/g, ' ').trim();
            if (regex.test(txt)) return b;
        }
        return null;
    }

    async dismissModal(modal) {
        const dismissBtn = modal?.querySelector('button[aria-label="Dismiss"], button.artdeco-modal__dismiss') ||
                           this.queryAllDeep('button[aria-label="Dismiss"]')[0];
        if (dismissBtn) {
            await this.orchestrator.trustedClick(dismissBtn);
            await this.humanDelay(300, 500);
            const discardBtn = this.queryAllDeep('button[data-control-name="discard_application_confirm_btn"], button[data-test-dialog-primary-btn]')
                .find((b) => /discard/i.test(b.innerText || b.textContent || ''));
            if (discardBtn) {
                await this.orchestrator.trustedClick(discardBtn);
                await this.humanDelay(300, 500);
            }
        }
    }

    async processEasyApplyModal(jobContext = {}) {
        const orch = this.orchestrator;
        const modal = await this.waitForEasyApplyModal(5000);
        if (!modal) return { status: 'no_modal' };

        const { company, jobTitle } = this.extractJobMeta(modal);
        console.log(`[LinkedInEasyApply] 🚀 Processing modal for "${jobTitle}" at ${company}...`);

        const MAX_STEPS = 12;
        for (let step = 1; step <= MAX_STEPS; step++) {
            if (!orch.isRunning) return { status: 'stopped' };
            if (this.detectSecurityChallenge()) return { status: 'security_challenge' };

            const activeModal = this.findEasyApplyModal() || modal;
            await this.ensureResumeSelected(activeModal);
            await this.fillModalStep(activeModal, { ...jobContext, company, jobTitle });

            // Scroll modal content down so buttons and bottom fields are in full view
            const modalContent = activeModal.querySelector('.jobs-easy-apply-content, .artdeco-modal__content');
            if (modalContent && typeof modalContent.scrollTo === 'function') {
                modalContent.scrollTo({ top: modalContent.scrollHeight, behavior: 'smooth' });
            }
            await this.humanDelay(200, 350);

            // 1. Check for Submit Application Button
            const submitBtn = this.findModalButton(activeModal, /submit\s*application/i);
            if (submitBtn) {
                if (!this.autoSubmit) {
                    await this.recordJobToKanban(company, jobTitle, window.location.href, 'ready_for_review');
                    return { status: 'ready_for_review', company, jobTitle };
                }
                if (typeof submitBtn.scrollIntoView === 'function') submitBtn.scrollIntoView({ block: 'center' });
                if (orch.cursor) await orch.cursor.moveTo(submitBtn);
                await orch.trustedClick(submitBtn);
                if (typeof submitBtn.click === 'function') submitBtn.click();
                await this.humanDelay(800, 1400);

                const doneDismiss = this.queryAllDeep('button[aria-label="Dismiss"], button.artdeco-modal__dismiss')[0];
                if (doneDismiss) {
                    await orch.trustedClick(doneDismiss);
                }
                await this.recordJobToKanban(company, jobTitle, window.location.href, 'applied');
                return { status: 'submitted', company, jobTitle };
            }

            // 2. Check for Next or Review Button (with primary button fallback)
            let nextOrReviewBtn = this.findModalButton(activeModal, /review\s*your\s*application|continue\s*to\s*next\s*step|\bnext\b|\breview\b/i);
            if (!nextOrReviewBtn) {
                // Fail-safe: In LinkedIn modals, the primary action button is styled with artdeco-button--primary in the footer
                const footer = activeModal.querySelector('footer, .artdeco-modal__actionbar');
                if (footer) {
                    nextOrReviewBtn = footer.querySelector('button.artdeco-button--primary:not([disabled])');
                }
            }

            if (!nextOrReviewBtn) {
                console.warn('[LinkedInEasyApply] No Next or Submit button found, dismissing modal.');
                await this.dismissModal(activeModal);
                return { status: 'stuck_no_next_btn', company, jobTitle };
            }

            if (typeof nextOrReviewBtn.scrollIntoView === 'function') nextOrReviewBtn.scrollIntoView({ block: 'center' });
            if (orch.cursor) await orch.cursor.moveTo(nextOrReviewBtn);
            await orch.trustedClick(nextOrReviewBtn);
            if (typeof nextOrReviewBtn.click === 'function') nextOrReviewBtn.click();
            await this.humanDelay(400, 700);

            // Validation Error Recovery Check
            const hasError = activeModal.querySelector('.artdeco-inline-feedback--error, [data-test-form-element-error], .fb-dash-form-element--error');
            if (hasError && step >= 1) {
                console.log('[LinkedInEasyApply] ⚠️ Form validation feedback encountered, applying automatic repair...');
                await this.fillModalStep(activeModal, { ...jobContext, company, jobTitle }, true);
                await this.humanDelay(300, 500);
                await orch.trustedClick(nextOrReviewBtn);
                if (typeof nextOrReviewBtn.click === 'function') nextOrReviewBtn.click();
                await this.humanDelay(600, 1000);
                if (activeModal.querySelector('.artdeco-inline-feedback--error')) {
                    await this.dismissModal(activeModal);
                    return { status: 'validation_error', company, jobTitle };
                }
            }
        }

        await this.dismissModal(this.findEasyApplyModal());
        return { status: 'max_steps_exceeded' };
    }

    async run(options = {}) {
        const orch = this.orchestrator;
        this.maxApplications = options.maxApplications || 15;
        if (typeof options.unfollowCompany === 'boolean') this.unfollowCompany = options.unfollowCompany;
        if (typeof options.autoSubmit === 'boolean') this.autoSubmit = options.autoSubmit;

        this.emitProgress('Scanning LinkedIn jobs...');

        // 1. Direct Execution: Check if Easy Apply Modal is ALREADY open
        if (this.findEasyApplyModal()) {
            this.emitProgress('Found active Easy Apply modal, filling fields...');
            const res = await this.processEasyApplyModal({ platform: 'LinkedIn Easy Apply' });
            if (res.status === 'submitted') {
                this.appliedCount++;
                orch.stats.filled++;
            } else if (res.status === 'ready_for_review') {
                this.emitProgress('Paused at Submit for your review.');
                return { applied: this.appliedCount, skipped: this.skippedCount, failed: this.failedCount, status: 'ready_for_review' };
            } else {
                this.failedCount++;
            }
            this.emitProgress(`Finished active modal (${res.status}).`);
            return { applied: this.appliedCount, skipped: this.skippedCount, failed: this.failedCount, status: res.status };
        }

        // 2. Loop across Job Cards or Single Job View
        while (orch.isRunning && this.appliedCount < this.maxApplications) {
            if (this.detectSecurityChallenge()) {
                this.emitProgress('Paused: Security challenge or Easy Apply limit detected.');
                break;
            }

            let cards = this.scanJobCards();
            if (cards.length === 0) {
                await this.humanDelay(500, 800);
                cards = this.scanJobCards();
            }

            // Case A: Single Job View (/jobs/view/...) or Selected Job Pane
            if (cards.length === 0) {
                const directEasyApply = this.findEasyApplyButton();
                if (directEasyApply) {
                    this.emitProgress('Applying to current LinkedIn job...');
                    if (orch.cursor) await orch.cursor.moveTo(directEasyApply);
                    await orch.trustedClick(directEasyApply);
                    if (typeof directEasyApply.click === 'function') directEasyApply.click();
                    await this.humanDelay(800, 1400);

                    const res = await this.processEasyApplyModal({ platform: 'LinkedIn Easy Apply' });
                    if (res.status === 'submitted') {
                        this.appliedCount++;
                        orch.stats.filled++;
                        this.emitProgress(`Applied to job! (${this.appliedCount} applied)`);
                    } else if (res.status === 'ready_for_review') {
                        this.emitProgress('Paused at Submit for your review.');
                        return { applied: this.appliedCount, skipped: this.skippedCount, failed: this.failedCount, status: 'ready_for_review' };
                    } else {
                        this.failedCount++;
                        this.emitProgress(`Modal finished with status: ${res.status}`);
                    }
                    break;
                }

                // Check pagination
                const nextPageBtn = this.queryAllDeep('button[aria-label="View next page"], button.artdeco-pagination__button--next')[0];
                if (nextPageBtn && !nextPageBtn.disabled) {
                    this.emitProgress('Advancing to next LinkedIn jobs page...');
                    if (orch.cursor) await orch.cursor.moveTo(nextPageBtn);
                    await orch.trustedClick(nextPageBtn);
                    await this.humanDelay(2000, 3000);
                    continue;
                }

                this.emitProgress('No Easy Apply job cards found on this view. Ensure the "Easy Apply" filter is enabled.');
                break;
            }

            // Case B: Multi-Card Job Feed
            for (const { element: card, jobId } of cards) {
                if (!orch.isRunning || this.appliedCount >= this.maxApplications) break;
                if (this.detectSecurityChallenge()) break;

                this.processedJobIds.add(jobId);
                const clickTarget =
                    card.querySelector?.('a.job-card-container__link, a.job-card-list__title--link, a[href*="/jobs/view/"], a[href*="currentJobId="]') ||
                    card;
                if (typeof card.scrollIntoView === 'function') {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                if (orch.cursor) await orch.cursor.moveTo(clickTarget);
                await orch.trustedClick(clickTarget);
                if (typeof clickTarget.click === 'function') clickTarget.click();
                await this.humanDelay(900, 1500);

                const easyApplyBtn = this.findEasyApplyButton();
                if (!easyApplyBtn) {
                    this.skippedCount++;
                    this.emitProgress(`Skipped non-Easy Apply job (${this.appliedCount} applied)`);
                    continue;
                }

                this.emitProgress(`Applying to job ${this.appliedCount + 1}/${this.maxApplications}...`);
                if (orch.cursor) await orch.cursor.moveTo(easyApplyBtn);
                await orch.trustedClick(easyApplyBtn);
                if (typeof easyApplyBtn.click === 'function') easyApplyBtn.click();
                await this.humanDelay(800, 1300);

                const result = await this.processEasyApplyModal({ platform: 'LinkedIn Easy Apply', jobId });
                if (result.status === 'submitted') {
                    this.appliedCount++;
                    orch.stats.filled++;
                    this.emitProgress(`Applied to ${this.appliedCount} job(s)!`);
                } else if (result.status === 'security_challenge') {
                    this.emitProgress('Paused: LinkedIn security check detected.');
                    break;
                } else if (result.status === 'ready_for_review') {
                    this.emitProgress('Paused at Submit for your review.');
                    return { applied: this.appliedCount, skipped: this.skippedCount, failed: this.failedCount, status: 'ready_for_review' };
                } else {
                    this.failedCount++;
                    this.emitProgress(`Skipped incomplete modal (${result.status}).`);
                }

                await this.humanDelay(1200, 2000);
            }

            // Trigger LinkedIn lazy-loading by scrolling the list container
            const listContainer = this.queryAllDeep('.jobs-search-results-list, .scaffold-layout__list')[0];
            if (listContainer && typeof listContainer.scrollBy === 'function') {
                listContainer.scrollBy({ top: 600, behavior: 'smooth' });
                await this.humanDelay(700, 1200);
            }
        }

        this.emitProgress(`Done: ${this.appliedCount} applied, ${this.skippedCount} skipped, ${this.failedCount} failed.`);
        return {
            applied: this.appliedCount,
            skipped: this.skippedCount,
            failed: this.failedCount
        };
    }
};

if (typeof window !== 'undefined') {
    window.LinkedInEasyApplyAgent = LinkedInEasyApplyAgent;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinkedInEasyApplyAgent;
}
