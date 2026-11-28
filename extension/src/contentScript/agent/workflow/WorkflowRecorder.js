/**
 * WorkflowRecorder (Phase 4 - DEMONSTRATION / RECORDING & SEMANTIC REPLAY)
 * Captures semantic user demonstrations (role, label, placeholder, state, postcondition)
 * and replays them self-healingly using PageObserver + SelfHealingResolver + ActionExecutor.
 */
var WorkflowRecorder = (typeof window !== 'undefined' && window.WorkflowRecorder) || class WorkflowRecorder {
    static STORAGE_KEY = 'recordedAtsWorkflows';

    constructor() {
        this.isRecording = false;
        this.currentWorkflow = null;
        this._listeners = [];
    }

    static parameterizeValue(val, profile = {}) {
        const str = String(val || '').trim();
        if (!str) return '';
        const map = [
            ['first_name', profile.first_name || profile.firstName],
            ['last_name', profile.last_name || profile.lastName],
            ['full_name', profile.full_name || profile.fullName],
            ['email', profile.email],
            ['phone', profile.phone],
            ['city', profile.city],
            ['linkedin', profile.linkedin],
            ['github', profile.github],
            ['university', profile.university]
        ];
        for (const [key, pVal] of map) {
            if (pVal && str.toLowerCase() === String(pVal).trim().toLowerCase()) {
                return `{{candidate.${key}}}`;
            }
        }
        return str;
    }

    static resolveTemplate(val, profile = {}) {
        const str = String(val || '');
        return str.replace(/\{\{candidate\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
            return profile[key] || profile[key.replace(/_([a-z])/g, (__, c) => c.toUpperCase())] || '';
        });
    }

    startRecording(name = 'Recorded ATS Workflow', profile = {}) {
        const PageObs = (typeof window !== 'undefined' && window.PageObserver) || require('./PageObserver.js');
        const Adapters = (typeof window !== 'undefined' && window.ATSWorkflowAdapters) || require('./ATSWorkflowAdapters.js');
        const obs = PageObs.observe();
        const adapter = Adapters.detect(obs.url);

        this.isRecording = true;
        this.currentWorkflow = {
            id: `wf_${Date.now()}`,
            workflow: name,
            ats: adapter.id,
            url: obs.url,
            createdAt: new Date().toISOString(),
            steps: []
        };

        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            const onChange = (e) => {
                if (!this.isRecording) return;
                const el = e.target;
                if (!el || !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
                const label = PageObs.extractLabel(el);
                const role = PageObs.inferRole(el);
                const action = el.type === 'checkbox' ? (el.checked ? 'check' : 'uncheck') : (el.tagName === 'SELECT' ? 'select' : 'fill');
                this.recordStep({
                    action,
                    target: { role, label, placeholder: el.placeholder || '', nameAttr: el.name || el.id || '' },
                    value: action === 'check' || action === 'uncheck' ? '' : WorkflowRecorder.parameterizeValue(el.value, profile),
                    verify: action === 'select' ? 'option_selected' : (action === 'fill' ? 'value_matches' : 'checked_matches')
                });
            };
            const onClick = (e) => {
                if (!this.isRecording) return;
                const btn = e.target?.closest?.('button, [role="button"], input[type="submit"]');
                if (!btn) return;
                const accName = (btn.getAttribute?.('aria-label') || btn.textContent || '').replace(/\s+/g, ' ').trim();
                if (!accName) return;
                this.recordStep({
                    action: 'click',
                    target: { role: 'button', name: accName, label: accName },
                    verify: 'next_state_detected'
                });
            };
            document.addEventListener('change', onChange, true);
            document.addEventListener('click', onClick, true);
            this._listeners = [['change', onChange], ['click', onClick]];
        }
        return this.currentWorkflow;
    }

    recordStep(step) {
        if (!this.currentWorkflow) return;
        this.currentWorkflow.steps.push(step);
    }

    async stopRecording() {
        this.isRecording = false;
        if (typeof document !== 'undefined') {
            for (const [evt, fn] of this._listeners) {
                document.removeEventListener(evt, fn, true);
            }
        }
        this._listeners = [];
        const wf = this.currentWorkflow;
        if (wf && wf.steps.length > 0) {
            await WorkflowRecorder.saveWorkflow(wf);
        }
        return wf;
    }

    static async listWorkflows() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return [];
        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (r) => resolve(Array.isArray(r[this.STORAGE_KEY]) ? r[this.STORAGE_KEY] : []));
        });
    }

    static async saveWorkflow(wf) {
        const list = await this.listWorkflows();
        const idx = list.findIndex((x) => x.id === wf.id);
        const updated = [...list];
        if (idx >= 0) updated[idx] = wf;
        else updated.push(wf);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise((resolve) => chrome.storage.local.set({ [this.STORAGE_KEY]: updated }, resolve));
        }
        return updated;
    }

    static async deleteWorkflow(id) {
        const list = await this.listWorkflows();
        const updated = list.filter((w) => w.id !== id);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise((resolve) => chrome.storage.local.set({ [this.STORAGE_KEY]: updated }, resolve));
        }
        return updated;
    }

    /**
     * Semantic Replay: resolves each recorded step against live PageObserver + SelfHealingResolver
     */
    static async replay(workflow, profile = {}, deps = {}) {
        const PageObs = deps.PageObserver || (typeof window !== 'undefined' && window.PageObserver) || require('./PageObserver.js');
        const Resolver = deps.SelfHealingResolver || (typeof window !== 'undefined' && window.SelfHealingResolver) || require('./SelfHealingResolver.js');
        const Executor = deps.ActionExecutor || (typeof window !== 'undefined' && window.ActionExecutor) || require('./ActionExecutor.js');

        const results = [];
        for (const step of (workflow.steps || [])) {
            const obs = PageObs.observe();
            const resolved = Resolver.resolve(step.target, obs);
            if (!resolved || resolved.ambiguous) {
                results.push({ step, executed: false, verified: false, reason: resolved?.ambiguous ? 'Ambiguous target' : 'Target not found in live DOM' });
                return { completed: false, results };
            }

            const value = step.value !== undefined ? this.resolveTemplate(step.value, profile) : undefined;
            const execRes = await Executor.execute(
                { action: step.action, target: resolved, params: { value }, verify: step.verify || 'none' },
                { previousObservation: obs, trustedClick: deps.trustedClick }
            );
            results.push({ step, ...execRes, matchReason: resolved.matchReason, confidence: resolved.confidence });
            if (!execRes.verified) {
                return { completed: false, results };
            }
        }
        return { completed: true, results };
    }
};

if (typeof window !== 'undefined') window.WorkflowRecorder = WorkflowRecorder;
if (typeof module !== 'undefined' && module.exports) module.exports = WorkflowRecorder;
