/**
 * LinkedIn Easy Apply Modal Handler
 * Operates strictly on an active, user-opened LinkedIn Easy Apply modal
 * (no job-card crawling or discovery loops).
 */
class LinkedInEasyApplyAgent {
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
        this.unfollowCompany = true;
    }

    static isLinkedInJobsPage() {
        if (typeof window === 'undefined' || !window.location) return false;
        const host = (window.location.hostname || '').toLowerCase();
        const path = (window.location.pathname || '').toLowerCase();
        return host.includes('linkedin.com') && path.startsWith('/jobs');
    }

    async humanDelay(minMs = 800, maxMs = 1600) {
        const ms = Math.floor(minMs + Math.random() * Math.max(0, maxMs - minMs));
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    queryAllDeep(selector, root = document) {
        const results = [];
        try {
            results.push(...Array.from(root.querySelectorAll(selector)));
            const outlet = root.getElementById ? root.getElementById('interop-outlet') : null;
            if (outlet && outlet.shadowRoot) {
                results.push(...Array.from(outlet.shadowRoot.querySelectorAll(selector)));
            }
        } catch (e) {}
        return results;
    }

    detectSecurityChallenge() {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        return Boolean(
            document.querySelector('#captcha-internal, iframe[src*="checkpoint"], iframe[src*="captcha"]') ||
            bodyText.includes("let's do a quick security check") ||
            bodyText.includes('unusual activity detected')
        );
    }

    findEasyApplyModal() {
        const modals = this.queryAllDeep(
            '[role="dialog"].jobs-easy-apply-modal, .jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], [role="dialog"][aria-labelledby*="easy-apply"]'
        );
        return modals.find((m) => (m && m.offsetParent !== null) || (m && m.getBoundingClientRect && m.getBoundingClientRect().width > 0)) || modals[0] || null;
    }

    extractModalFieldLabel(el, modal) {
        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim()) return aria.trim();
        const id = el.id;
        if (id && modal) {
            const lbl = modal.querySelector(`label[for="${CSS.escape ? CSS.escape(id) : id}"]`);
            if (lbl && lbl.innerText) return lbl.innerText.trim();
        }
        const parentLabel = el.closest('label');
        if (parentLabel && parentLabel.innerText) return parentLabel.innerText.trim();
        const group = el.closest('.fb-dash-form-element, .artdeco-text-input--container, fieldset');
        if (group) {
            const title = group.querySelector('label, legend, .fb-dash-form-element__label, span[data-test-form-element-label]');
            if (title && title.innerText) return title.innerText.trim();
        }
        return el.placeholder || el.name || '';
    }

    async fillModalStep(modal, jobContext = {}) {
        const orch = this.orchestrator;
        const brain = orch.brain;
        const cursor = orch.cursor;

        const radioGroups = Array.from(modal.querySelectorAll('fieldset, [role="radiogroup"]'));
        for (const group of radioGroups) {
            if (!orch.isRunning) return;
            const radios = Array.from(group.querySelectorAll('input[type="radio"]'));
            if (radios.length === 0 || radios.some((r) => r.checked)) continue;

            const legend = group.querySelector('legend, span[data-test-form-element-label], .fb-dash-form-element__label');
            const question = (legend?.innerText || group.getAttribute('aria-label') || '').trim();
            const options = radios.map((r) => {
                const lbl = r.id ? group.querySelector(`label[for="${r.id}"]`) : r.closest('label');
                return (lbl?.innerText || r.value || '').trim();
            }).filter(Boolean);

            if (!question || options.length === 0) continue;
            const res = await brain.resolveAnswer(
                { label: question, type: 'radio', options, element: radios[0] },
                { ...jobContext, virtualCursor: cursor }
            );
            if (res && res.value) {
                const targetVal = String(res.value).trim().toLowerCase();
                const matchIdx = radios.findIndex((r, idx) => {
                    const optTxt = (options[idx] || '').toLowerCase();
                    return optTxt === targetVal || optTxt.includes(targetVal) || targetVal.includes(optTxt);
                });
                const chosenRadio = radios[matchIdx >= 0 ? matchIdx : 0];
                const clickTarget = (chosenRadio.id && group.querySelector(`label[for="${chosenRadio.id}"]`)) || chosenRadio;
                if (cursor) await cursor.moveTo(clickTarget);
                await orch.trustedClick(clickTarget);
                chosenRadio.checked = true;
                chosenRadio.dispatchEvent(new Event('change', { bubbles: true }));
                await this.humanDelay(200, 400);
            }
        }

        const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="file"]), select, textarea'));
        for (const el of inputs) {
            if (!orch.isRunning) return;
            const label = this.extractModalFieldLabel(el, modal);

            if (el.type === 'checkbox') {
                if (this.unfollowCompany && /follow/i.test(label) && el.checked) {
                    if (cursor) await cursor.moveTo(el);
                    await orch.trustedClick(el);
                }
                continue;
            }

            if (el.value && String(el.value).trim() !== '' && el.tagName !== 'SELECT') continue;

            const options = el.tagName === 'SELECT'
                ? Array.from(el.options).map((o) => o.text.trim()).filter((t) => t && !/select an option/i.test(t))
                : [];

            const res = await brain.resolveAnswer(
                { label, type: el.tagName === 'SELECT' ? 'select' : (el.type || 'text'), name: el.name || el.id || '', options, element: el },
                { ...jobContext, virtualCursor: cursor }
            );
            if (!res || res.value === null || res.value === undefined || String(res.value).trim() === '') continue;

            const val = String(res.value).trim();
            if (cursor) await cursor.moveTo(el);

            if (el.tagName === 'SELECT') {
                const matchOpt = Array.from(el.options).find((o) => o.text.trim().toLowerCase() === val.toLowerCase()) ||
                    Array.from(el.options).find((o) => o.text.trim().toLowerCase().includes(val.toLowerCase()));
                if (matchOpt) {
                    el.value = matchOpt.value;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                await orch.trustedClick(el);
                if (cursor && typeof cursor.type === 'function') {
                    await cursor.type(el, val);
                } else {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (typeof orch.ensureDropdownSelectionAndDismiss === 'function') {
                    await orch.ensureDropdownSelectionAndDismiss(el, val, label);
                }
            }
            await this.humanDelay(150, 350);
        }
    }

    async processEasyApplyModal(jobContext = {}) {
        const orch = this.orchestrator;
        const modal = this.findEasyApplyModal();
        if (!modal) return { status: 'no_modal' };

        const MAX_STEPS = 12;
        for (let step = 1; step <= MAX_STEPS; step++) {
            if (!orch.isRunning) return { status: 'stopped' };
            if (this.detectSecurityChallenge()) return { status: 'security_challenge' };

            const activeModal = this.findEasyApplyModal() || modal;
            await this.fillModalStep(activeModal, jobContext);
            await this.humanDelay(500, 1000);

            const buttons = Array.from(activeModal.querySelectorAll('button'));
            const findBtn = (regex) => buttons.find((b) => !b.disabled && regex.test(((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')).trim()));

            // Stop at Submit / Review so the candidate explicitly confirms final submission
            const submitBtn = findBtn(/submit\s*application/i);
            if (submitBtn) {
                return { status: 'ready_for_review', modal: activeModal };
            }

            const nextOrReviewBtn = findBtn(/review\s*your\s*application|continue\s*to\s*next\s*step|\bnext\b|\breview\b/i);
            if (!nextOrReviewBtn) {
                return { status: 'needs_user_review', modal: activeModal };
            }

            if (orch.cursor) await orch.cursor.moveTo(nextOrReviewBtn);
            await orch.trustedClick(nextOrReviewBtn);
            await this.humanDelay(900, 1600);
        }

        return { status: 'max_steps_reached' };
    }

    async run(options = {}) {
        if (!this.findEasyApplyModal()) {
            return { status: 'no_active_modal', message: 'Open an Easy Apply modal on a job first.' };
        }
        return this.processEasyApplyModal({ platform: 'LinkedIn Easy Apply', ...(options.jobContext || {}) });
    }
}

if (typeof window !== 'undefined') {
    window.LinkedInEasyApplyAgent = LinkedInEasyApplyAgent;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinkedInEasyApplyAgent;
}
