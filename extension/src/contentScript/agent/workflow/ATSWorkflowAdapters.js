/**
 * ATSWorkflowAdapters (Phase 7 - MODULAR ATS ADAPTERS)
 * Specialized adapters for Greenhouse, Lever, Ashby, Workday, SmartRecruiters, iCIMS, and Generic forms.
 * Note: Excludes unauthorized LinkedIn automation per project policy.
 */
var ATSWorkflowAdapters = (typeof window !== 'undefined' && window.ATSWorkflowAdapters) || class ATSWorkflowAdapters {
    static ADAPTERS = [
        {
            id: 'greenhouse',
            name: 'Greenhouse',
            match: (url = '', doc = null) => /greenhouse\.io/i.test(url) || Boolean(doc?.querySelector?.('#application_form, [data-gh-job-id]')),
            workflowHints: () => ({ singlePageUsually: true, submitButtonLabels: ['Submit Application'] }),
            mapField: (f) => {
                const k = `${f.stableAttrs?.id || ''} ${f.stableAttrs?.name || ''} ${f.label || ''}`.toLowerCase();
                if (/first_name|first name/.test(k)) return 'FIRST_NAME';
                if (/last_name|last name/.test(k)) return 'LAST_NAME';
                if (/email/.test(k)) return 'EMAIL';
                if (/phone/.test(k)) return 'PHONE';
                if (/resume/.test(k) && f.role === 'file') return 'RESUME';
                return null;
            }
        },
        {
            id: 'lever',
            name: 'Lever',
            match: (url = '', doc = null) => /lever\.co/i.test(url) || Boolean(doc?.querySelector?.('.application-form, [data-lever-id]')),
            workflowHints: () => ({ singlePageUsually: true, submitButtonLabels: ['Submit application'] }),
            mapField: (f) => {
                const k = `${f.stableAttrs?.name || ''} ${f.label || ''}`.toLowerCase();
                if (/^name$|full name/.test(k)) return 'FULL_NAME';
                if (/email/.test(k)) return 'EMAIL';
                if (/phone/.test(k)) return 'PHONE';
                if (/org|current company/.test(k)) return 'CURRENT_COMPANY';
                if (/resume/.test(k) && f.role === 'file') return 'RESUME';
                return null;
            }
        },
        {
            id: 'ashby',
            name: 'Ashby',
            match: (url = '', doc = null) => /ashbyhq\.com|ashby\.com/i.test(url) || Boolean(doc?.querySelector?.('[data-ashby-job-board]')),
            workflowHints: () => ({ singlePageUsually: true, submitButtonLabels: ['Submit Application'] }),
            mapField: (f) => {
                const k = `${f.label || ''} ${f.stableAttrs?.name || ''}`.toLowerCase();
                if (/name/.test(k) && !/company|university|college/.test(k)) return 'FULL_NAME';
                if (/email/.test(k)) return 'EMAIL';
                if (/resume/.test(k) && f.role === 'file') return 'RESUME';
                return null;
            }
        },
        {
            id: 'workday',
            name: 'Workday',
            match: (url = '', doc = null) => /myworkdayjobs\.com|workday\.com/i.test(url) || Boolean(doc?.querySelector?.('[data-automation-id="applyManually"]')),
            workflowHints: () => ({ multiStep: true, nextButtonLabels: ['Save and Continue', 'Next'], submitButtonLabels: ['Submit'] }),
            mapField: (f) => {
                const aid = (f.stableAttrs?.['data-automation-id'] || '').toLowerCase();
                if (aid.includes('firstname')) return 'FIRST_NAME';
                if (aid.includes('lastname')) return 'LAST_NAME';
                if (aid.includes('email')) return 'EMAIL';
                if (aid.includes('phone')) return 'PHONE';
                return null;
            }
        },
        {
            id: 'smartrecruiters',
            name: 'SmartRecruiters',
            match: (url = '', doc = null) => /smartrecruiters\.com/i.test(url) || Boolean(doc?.querySelector?.('spl-input, spl-radio, [data-test="smartrecruiters"]')),
            workflowHints: () => ({ multiStep: true, nextButtonLabels: ['Next', 'Continue'], submitButtonLabels: ['Submit'] }),
            mapField: (f) => {
                const k = `${f.label || ''} ${f.stableAttrs?.name || ''}`.toLowerCase();
                if (/first\s*name/.test(k)) return 'FIRST_NAME';
                if (/last\s*name/.test(k)) return 'LAST_NAME';
                if (/email/.test(k)) return 'EMAIL';
                return null;
            }
        },
        {
            id: 'icims',
            name: 'iCIMS',
            match: (url = '', doc = null) => /icims\.com/i.test(url) || Boolean(doc?.querySelector?.('#icims_content_iframe')),
            workflowHints: () => ({ multiStep: true, nextButtonLabels: ['Continue', 'Next'], submitButtonLabels: ['Submit'] }),
            mapField: () => null
        },
        {
            id: 'generic',
            name: 'Generic Application Form',
            match: () => true,
            workflowHints: () => ({ multiStep: true, nextButtonLabels: ['Next', 'Continue', 'Save and Continue'], submitButtonLabels: ['Submit Application', 'Submit'] }),
            mapField: () => null
        }
    ];

    static detect(url = '', doc = typeof document !== 'undefined' ? document : null) {
        for (const adapter of this.ADAPTERS) {
            if (adapter.match(url, doc)) return adapter;
        }
        return this.ADAPTERS[this.ADAPTERS.length - 1];
    }
};

if (typeof window !== 'undefined') window.ATSWorkflowAdapters = ATSWorkflowAdapters;
if (typeof module !== 'undefined' && module.exports) module.exports = ATSWorkflowAdapters;
