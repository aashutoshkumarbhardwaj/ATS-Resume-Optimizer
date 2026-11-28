/**
 * WorkflowStateMachine & Closed-Loop Planner (Phases 2, 3 & 5)
 * Persistent, state-aware closed-loop engine:
 * OBSERVE -> UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> UPDATE STATE -> OBSERVE AGAIN.
 * Stops safely at REVIEW / USER_APPROVAL before final submission.
 */
var WorkflowStateMachine = (typeof window !== 'undefined' && window.WorkflowStateMachine) || class WorkflowStateMachine {
    static STORAGE_KEY = 'atsWorkflowState';

    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 2;
        this.maxIterations = options.maxIterations || 40;
        this.reset();
    }

    reset() {
        this.state = {
            workflowState: 'APPLICATION_STARTED',
            previousState: null,
            pageState: 'UNKNOWN',
            atsId: 'generic',
            completedActions: [],
            pendingActions: [],
            failedActions: [],
            retryCount: 0,
            lastSuccessfulAction: null,
            expectedNextState: null,
            duplicateActionKeys: new Set(),
            awaitingUserApproval: false,
            aiCallsCount: 0,
            logs: []
        };
    }

    async persist() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
        const serializable = {
            ...this.state,
            duplicateActionKeys: Array.from(this.state.duplicateActionKeys)
        };
        await new Promise((resolve) => chrome.storage.local.set({ [WorkflowStateMachine.STORAGE_KEY]: serializable }, resolve));
    }

    async restore() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return false;
        const saved = await new Promise((resolve) => chrome.storage.local.get([WorkflowStateMachine.STORAGE_KEY], (r) => resolve(r[WorkflowStateMachine.STORAGE_KEY])));
        if (!saved) return false;
        this.state = {
            ...saved,
            duplicateActionKeys: new Set(saved.duplicateActionKeys || [])
        };
        return true;
    }

    transition(newWorkflowState, reason = '') {
        this.state.previousState = this.state.workflowState;
        this.state.workflowState = newWorkflowState;
        this.log(`STATE -> ${newWorkflowState}${reason ? ` (${reason})` : ''}`);
    }

    log(msg) {
        const entry = `[${new Date().toISOString()}] ${msg}`;
        this.state.logs.push(entry);
        if (this.state.logs.length > 100) this.state.logs.shift();
    }

    /**
     * Deterministic-first single-action Planner (Phase 5)
     * Returns exactly ONE next action grounded in the latest observation.
     */
    async planNextAction(observation, classification, adapter, brain, context = {}) {
        const pageState = classification.state;
        this.state.pageState = pageState;

        if (pageState === 'CAPTCHA' || pageState === 'ACCESS_DENIED' || pageState === 'LOGIN') {
            return { action: 'halt', reason: `Human required: ${pageState}` };
        }
        if (pageState === 'SUBMISSION_CONFIRMED') {
            this.transition('CONFIRMED', 'Submission confirmed on page');
            return { action: 'complete', reason: 'Application confirmed' };
        }
        if (pageState === 'REVIEW') {
            this.transition('USER_APPROVAL', 'Reached review page; awaiting explicit candidate approval');
            this.state.awaitingUserApproval = true;
            return { action: 'await_user_approval', reason: 'Review page reached — user approval required before Submit' };
        }

        // 1. Check unfilled inputs in current observation
        for (const input of (observation.inputs || [])) {
            const actionKey = `${observation.url}|${input.role}|${input.label}|${input.index}`;
            if (this.state.duplicateActionKeys.has(actionKey)) continue;

            // File upload (Resume)
            if (input.role === 'file' && !input.value && !input.element?._attachedFileName) {
                return {
                    action: 'upload',
                    actionKey,
                    target: { element: input.element, entry: input },
                    params: { mockFileName: context.resumeFileName || 'Resume.pdf', fileName: context.resumeFileName || 'Resume.pdf' },
                    expectedResult: 'Resume attached',
                    verify: 'file_attached',
                    failureStrategy: 'reobserve_and_retry'
                };
            }

            // Skip already-filled inputs unless they have a validation error
            const isFilled = input.role === 'checkbox' || input.role === 'radio' || input.role === 'radiogroup'
                ? Boolean(input.checked)
                : Boolean(input.value && input.value.trim() !== '');
            if (isFilled) continue;

            const optionLabels = Array.isArray(input.options)
                ? input.options.map((o) => (typeof o === 'string' ? o : o.label)).filter(Boolean)
                : [];

            // Resolve value via PersonalAgentBrain (deterministic first, AI only when needed)
            let resolved = null;
            if (brain && typeof brain.resolveAnswer === 'function') {
                resolved = await brain.resolveAnswer({
                    label: input.label || input.placeholder || input.stableAttrs?.name || '',
                    type: input.type || input.role,
                    name: input.stableAttrs?.name || '',
                    id: input.stableAttrs?.id || '',
                    placeholder: input.placeholder || '',
                    options: optionLabels,
                    element: input.element
                }, context);
                if (resolved && resolved.source && resolved.source.startsWith('llm')) {
                    this.state.aiCallsCount++;
                }
            }

            if (resolved && resolved.value !== null && resolved.value !== undefined && String(resolved.value).trim() !== '') {
                const val = String(resolved.value).trim();
                if (input.role === 'radiogroup' && Array.isArray(input.options)) {
                    const lowerVal = val.toLowerCase();
                    const matchOpt = input.options.find((o) => (o.label || '').toLowerCase() === lowerVal) ||
                        input.options.find((o) => (o.label || '').toLowerCase().includes(lowerVal) || lowerVal.includes((o.label || '').toLowerCase()));
                    if (matchOpt && matchOpt.element) {
                        return {
                            action: 'select_radio',
                            actionKey,
                            target: { element: matchOpt.element, entry: input },
                            params: { value: matchOpt.label },
                            expectedResult: `Radio "${matchOpt.label}" selected for "${input.label}"`,
                            verify: 'checked_matches',
                            failureStrategy: 'reobserve_and_retry'
                        };
                    }
                }
                if (input.tag === 'select') {
                    return {
                        action: 'select',
                        actionKey,
                        target: { element: input.element, entry: input },
                        params: { value: val },
                        expectedResult: `Option "${val}" selected`,
                        verify: 'option_selected',
                        failureStrategy: 'reobserve_and_retry'
                    };
                }
                if (input.role === 'checkbox') {
                    return {
                        action: /^(yes|true|1|agree)$/i.test(val) ? 'check' : 'uncheck',
                        actionKey,
                        target: { element: input.element, entry: input },
                        params: {},
                        expectedResult: `Checkbox updated`,
                        verify: 'checked_matches',
                        failureStrategy: 'reobserve_and_retry'
                    };
                }
                return {
                    action: 'fill',
                    actionKey,
                    target: { element: input.element, entry: input },
                    params: { value: val },
                    expectedResult: `Field "${input.label}" populated`,
                    verify: 'value_matches',
                    failureStrategy: 'reobserve_and_retry'
                };
            } else if (input.required) {
                return {
                    action: 'ask_user',
                    actionKey,
                    target: { element: input.element, entry: input },
                    params: { question: input.label || 'Required field', options: input.options || [] },
                    expectedResult: 'User provides missing required answer',
                    verify: 'none',
                    failureStrategy: 'halt'
                };
            }
        }

        // 2. All fillable fields handled — look for Next / Continue button (NEVER auto-click final Submit!)
        const hints = adapter?.workflowHints ? adapter.workflowHints() : { nextButtonLabels: ['Next', 'Continue', 'Review'] };
        const nextLabels = (hints.nextButtonLabels || ['Next', 'Continue', 'Review']).map((s) => s.toLowerCase());
        const nextBtn = (observation.buttons || []).find((b) => {
            const name = (b.accessibleName || '').toLowerCase();
            return nextLabels.some((lbl) => name.includes(lbl)) && !/submit\s*application/i.test(name);
        });

        if (nextBtn) {
            const btnKey = `${observation.url}|click|${nextBtn.accessibleName}|${nextBtn.index}`;
            if (!this.state.duplicateActionKeys.has(btnKey)) {
                return {
                    action: 'click',
                    actionKey: btnKey,
                    target: { element: nextBtn.element, entry: nextBtn },
                    params: { label: nextBtn.accessibleName },
                    expectedResult: 'Advance to next application step',
                    verify: 'next_state_detected',
                    failureStrategy: 'check_validation_errors'
                };
            }
        }

        // Check if only final Submit button remains -> stop for explicit user approval!
        const submitBtn = (observation.buttons || []).find((b) => /\bsubmit\b/i.test(b.accessibleName || ''));
        if (submitBtn) {
            this.transition('USER_APPROVAL', 'Form complete; awaiting explicit candidate approval before Submit');
            this.state.awaitingUserApproval = true;
            return { action: 'await_user_approval', reason: 'All fields filled — ready for explicit user approval' };
        }

        return { action: 'halt', reason: 'No further deterministic actions available' };
    }

    /**
     * Execute closed-loop cycle: OBSERVE -> UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> UPDATE STATE
     */
    async runClosedLoop(deps = {}) {
        const PageObs = deps.PageObserver || (typeof window !== 'undefined' && window.PageObserver) || require('./PageObserver.js');
        const Classifier = deps.PageStateClassifier || (typeof window !== 'undefined' && window.PageStateClassifier) || require('./PageStateClassifier.js');
        const Executor = deps.ActionExecutor || (typeof window !== 'undefined' && window.ActionExecutor) || require('./ActionExecutor.js');
        const Adapters = deps.ATSWorkflowAdapters || (typeof window !== 'undefined' && window.ATSWorkflowAdapters) || require('./ATSWorkflowAdapters.js');

        const brain = deps.brain;
        const onStep = deps.onStep || (() => {});

        for (let iter = 0; iter < this.maxIterations; iter++) {
            const observation = PageObs.observe();
            const adapter = Adapters.detect(observation.url);
            this.state.atsId = adapter.id;
            const classification = Classifier.classify(observation);

            const plan = await this.planNextAction(observation, classification, adapter, brain, deps.context || {});

            if (plan.action === 'complete' || plan.action === 'await_user_approval' || plan.action === 'halt') {
                onStep({ iter, state: classification.state, observation, plan, verification: { verified: true, reason: plan.reason } });
                await this.persist();
                return { status: this.state.workflowState, pageState: classification.state, reason: plan.reason, state: this.state };
            }

            if (plan.action === 'ask_user') {
                if (typeof deps.askUser === 'function') {
                    const userAns = await deps.askUser(plan.params.question, plan.params.options);
                    if (userAns) {
                        const fillPlan = { action: 'fill', target: plan.target, params: { value: userAns }, verify: 'value_matches' };
                        const execRes = await Executor.execute(fillPlan, { previousObservation: observation, trustedClick: deps.trustedClick });
                        if (execRes.verified) {
                            this.state.duplicateActionKeys.add(plan.actionKey);
                            this.state.completedActions.push({ action: 'fill_user', label: plan.params.question, value: userAns });
                        }
                        onStep({ iter, state: classification.state, observation, plan: fillPlan, verification: execRes });
                        continue;
                    }
                }
                this.transition('NEEDS_REVIEW', `Missing required field: ${plan.params.question}`);
                await this.persist();
                return { status: 'NEEDS_REVIEW', pageState: classification.state, reason: `Missing required field: ${plan.params.question}`, state: this.state };
            }

            const execRes = await Executor.execute(plan, { previousObservation: observation, trustedClick: deps.trustedClick });
            onStep({ iter, state: classification.state, observation, plan, verification: execRes });

            if (execRes.verified) {
                this.state.retryCount = 0;
                if (plan.actionKey) this.state.duplicateActionKeys.add(plan.actionKey);
                this.state.lastSuccessfulAction = { action: plan.action, target: plan.target?.entry?.label || plan.params?.label };
                this.state.completedActions.push(this.state.lastSuccessfulAction);
            } else {
                this.state.retryCount++;
                this.state.failedActions.push({ action: plan.action, reason: execRes.reason });
                if (this.state.retryCount > this.maxRetries) {
                    this.transition('FAILED', `Exceeded max retries (${this.maxRetries}): ${execRes.reason}`);
                    await this.persist();
                    return { status: 'FAILED', pageState: classification.state, reason: execRes.reason, state: this.state };
                }
            }
            await this.persist();
        }

        return { status: 'MAX_ITERATIONS', state: this.state };
    }
};

if (typeof window !== 'undefined') window.WorkflowStateMachine = WorkflowStateMachine;
if (typeof module !== 'undefined' && module.exports) module.exports = WorkflowStateMachine;
