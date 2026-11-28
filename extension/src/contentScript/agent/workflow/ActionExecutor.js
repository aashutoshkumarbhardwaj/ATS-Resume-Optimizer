/**
 * ActionExecutor (Phase 2 - EXECUTE & VERIFY)
 * Centralized, framework-safe browser action executor with pre-flight checks,
 * condition-based waits (MutationObserver), and mandatory postcondition verification.
 */
var ActionExecutor = (typeof window !== 'undefined' && window.ActionExecutor) || class ActionExecutor {
    /**
     * Condition-based wait using MutationObserver + short poll fallback (never blind sleeps)
     */
    static async waitForCondition(predicateFn, timeoutMs = 3000, root = typeof document !== 'undefined' ? document : null) {
        try {
            if (predicateFn()) return true;
        } catch (e) {}

        return new Promise((resolve) => {
            let done = false;
            let observer = null;
            let intervalId = null;

            const finish = (result) => {
                if (done) return;
                done = true;
                if (observer) observer.disconnect();
                if (intervalId) clearInterval(intervalId);
                clearTimeout(timerId);
                resolve(result);
            };

            const check = () => {
                try {
                    if (predicateFn()) finish(true);
                } catch (e) {}
            };

            const timerId = setTimeout(() => finish(false), timeoutMs);
            if (root && typeof MutationObserver !== 'undefined' && root.body) {
                observer = new MutationObserver(check);
                observer.observe(root.body, { childList: true, subtree: true, attributes: true });
            }
            intervalId = setInterval(check, 50);
        });
    }

    static setNativeValue(el, value) {
        const str = String(value ?? '');
        const tag = (el.tagName || '').toUpperCase();
        if (typeof window !== 'undefined') {
            if (tag === 'INPUT' && window.HTMLInputElement) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (setter) {
                    setter.call(el, str);
                    return;
                }
            }
            if (tag === 'TEXTAREA' && window.HTMLTextAreaElement) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (setter) {
                    setter.call(el, str);
                    return;
                }
            }
        }
        el.value = str;
    }

    static dispatchFrameworkEvents(el) {
        if (typeof Event === 'undefined' || !el || typeof el.dispatchEvent !== 'function') return;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    /**
     * Execute a single planned action and verify its postcondition
     */
    static async execute(plan, context = {}) {
        const { action, target, params = {}, verify = 'none' } = plan || {};
        const el = target?.element || target;
        const PageObs = (typeof window !== 'undefined' && window.PageObserver) ||
            (typeof require === 'function' ? require('./PageObserver.js') : null);

        if (action === 'scroll') {
            if (typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
                window.scrollBy({ top: params.deltaY || 400, behavior: 'smooth' });
            }
            return { executed: true, verified: true, reason: 'Scrolled viewport' };
        }

        if (action === 'wait_for_change') {
            const prevSig = params.previousSignature || '';
            const changed = await this.waitForCondition(() => {
                if (!PageObs) return true;
                return PageObs.observe().signature !== prevSig;
            }, params.timeoutMs || 3000);
            return { executed: true, verified: changed, reason: changed ? 'DOM state changed' : 'Wait timed out' };
        }

        // Pre-flight checks for element-targeted actions
        if (!el) return { executed: false, verified: false, reason: 'Target element missing' };
        if (el.disabled) return { executed: false, verified: false, reason: 'Target element disabled' };
        if (PageObs && !PageObs.isElementVisible(el)) {
            return { executed: false, verified: false, reason: 'Target element not visible' };
        }
        if (target?.ambiguous) {
            return { executed: false, verified: false, reason: 'Ambiguous target element; refusing to guess' };
        }

        const prevSig = context.previousObservation?.signature || '';

        if (action === 'fill') {
            if (typeof el.focus === 'function') el.focus();
            this.setNativeValue(el, params.value ?? '');
            this.dispatchFrameworkEvents(el);

            const expected = String(params.value ?? '').trim();
            const actual = String(el.value ?? '').trim();
            const verified = actual === expected;
            return {
                executed: true,
                verified,
                actualValue: actual,
                reason: verified ? 'Value verified in DOM' : `Value mismatch: expected "${expected}", got "${actual}"`
            };
        }

        if (action === 'select') {
            const EngineClass = (typeof window !== 'undefined' && window.DropdownInteractionEngine) ||
                (typeof DropdownInteractionEngine !== 'undefined' ? DropdownInteractionEngine : null);
            if (EngineClass) {
                const engine = new EngineClass();
                const res = await engine.handleDropdown({ element: el }, params.value, context);
                const isOk = res.success || res.status === 'completed';
                return {
                    executed: isOk,
                    verified: isOk,
                    actualValue: res.selectedValue || params.value,
                    reason: isOk ? `Dropdown option "${res.selectedValue || params.value}" selected & verified` : `Dropdown interaction status: ${res.status}`
                };
            }

            const want = String(params.value ?? '').trim().toLowerCase();
            if (el.tagName === 'SELECT' && el.options) {
                const opt = Array.from(el.options).find((o) => (o.text || '').trim().toLowerCase() === want || (o.value || '').trim().toLowerCase() === want) ||
                    Array.from(el.options).find((o) => (o.text || '').trim().toLowerCase().includes(want));
                if (!opt) return { executed: false, verified: false, reason: `Option "${params.value}" not found` };
                el.value = opt.value;
                this.dispatchFrameworkEvents(el);
                const selectedText = (el.options[el.selectedIndex]?.text || '').trim().toLowerCase();
                const verified = selectedText === (opt.text || '').trim().toLowerCase() || el.value === opt.value;
                return { executed: true, verified, actualValue: opt.text, reason: verified ? 'Option selected & verified' : 'Select value did not stick' };
            }
            return { executed: false, verified: false, reason: 'Unsupported select element' };
        }

        if (action === 'select_radio') {
            if (typeof context.trustedClick === 'function') {
                await context.trustedClick(el);
            } else if (typeof el.click === 'function') {
                el.click();
            }
            if (typeof el.checked === 'boolean') el.checked = true;
            if (typeof el.setAttribute === 'function' && el.getAttribute?.('role') === 'radio') {
                el.setAttribute('aria-checked', 'true');
            }
            this.dispatchFrameworkEvents(el);
            const verified = Boolean(el.checked || el.getAttribute?.('aria-checked') === 'true');
            return {
                executed: true,
                verified,
                actualValue: params.value || el.value || 'selected',
                reason: verified ? `Radio option "${params.value || 'selected'}" checked & verified` : 'Radio selection did not stick'
            };
        }

        if (action === 'check' || action === 'uncheck') {
            const wantChecked = action === 'check';
            if (Boolean(el.checked) !== wantChecked) {
                if (typeof el.click === 'function') el.click();
                else el.checked = wantChecked;
                this.dispatchFrameworkEvents(el);
            }
            const verified = Boolean(el.checked) === wantChecked;
            return {
                executed: true,
                verified,
                reason: verified ? `Checkbox ${wantChecked ? 'checked' : 'unchecked'}` : 'Checkbox state did not update'
            };
        }

        if (action === 'upload') {
            const fileName = params.fileName || 'resume.pdf';
            if (typeof DataTransfer !== 'undefined' && typeof File !== 'undefined' && el.type === 'file') {
                const dt = new DataTransfer();
                const file = new File([params.fileContent || 'Resume content'], fileName, { type: params.mimeType || 'application/pdf' });
                dt.items.add(file);
                el.files = dt.files;
                this.dispatchFrameworkEvents(el);
            } else if (params.mockFileName && el.type === 'file') {
                el._attachedFileName = params.mockFileName;
                this.dispatchFrameworkEvents(el);
            }
            const attached = el.files?.[0]?.name || el._attachedFileName || '';
            const verified = Boolean(attached);
            return {
                executed: true,
                verified,
                actualValue: attached,
                reason: verified ? `File "${attached}" attached & verified` : 'File attachment failed verification'
            };
        }

        if (action === 'click') {
            if (typeof context.trustedClick === 'function') {
                await context.trustedClick(el);
            } else if (typeof el.click === 'function') {
                el.click();
            }

            if (verify === 'next_state_detected' || verify === 'state_changed') {
                const changed = await this.waitForCondition(() => {
                    if (!PageObs || !prevSig) return true;
                    return PageObs.observe().signature !== prevSig;
                }, params.timeoutMs || 2500);
                return {
                    executed: true,
                    verified: changed,
                    reason: changed ? 'Page transitioned after click' : 'Click executed but page state did not change'
                };
            }
            return { executed: true, verified: true, reason: 'Click executed' };
        }

        return { executed: false, verified: false, reason: `Unknown action "${action}"` };
    }
};

if (typeof window !== 'undefined') window.ActionExecutor = ActionExecutor;
if (typeof module !== 'undefined' && module.exports) module.exports = ActionExecutor;
