/**
 * PageStateClassifier (Phase 2 - UNDERSTAND)
 * Evidence-driven classifier identifying the current application step
 * from headings, labels, inputs, buttons, and confirmation signals.
 */
var PageStateClassifier = (typeof window !== 'undefined' && window.PageStateClassifier) || class PageStateClassifier {
    static STATES = {
        LOGIN: 'LOGIN',
        JOB_DETAILS: 'JOB_DETAILS',
        APPLICATION_START: 'APPLICATION_START',
        PERSONAL_INFORMATION: 'PERSONAL_INFORMATION',
        CONTACT_INFORMATION: 'CONTACT_INFORMATION',
        EDUCATION: 'EDUCATION',
        EXPERIENCE: 'EXPERIENCE',
        SKILLS: 'SKILLS',
        RESUME_UPLOAD: 'RESUME_UPLOAD',
        SCREENING_QUESTIONS: 'SCREENING_QUESTIONS',
        CUSTOM_QUESTIONS: 'CUSTOM_QUESTIONS',
        REVIEW: 'REVIEW',
        SUBMISSION_PENDING: 'SUBMISSION_PENDING',
        SUBMISSION_CONFIRMED: 'SUBMISSION_CONFIRMED',
        CAPTCHA: 'CAPTCHA',
        ACCESS_DENIED: 'ACCESS_DENIED',
        ERROR: 'ERROR',
        UNKNOWN: 'UNKNOWN'
    };

    static classify(observation) {
        if (!observation) {
            return { state: this.STATES.UNKNOWN, confidence: 0, evidence: ['No observation'] };
        }

        const headings = (observation.headings || []).join(' ').toLowerCase();
        const body = (observation.bodyTextSample || '').toLowerCase();
        const labels = (observation.inputs || []).map((i) => `${i.label} ${i.placeholder} ${i.type}`).join(' ').toLowerCase();
        const buttons = (observation.buttons || []).map((b) => b.accessibleName).join(' ').toLowerCase();
        const hasPassword = (observation.inputs || []).some((i) => i.type === 'password');
        const hasFile = (observation.inputs || []).some((i) => i.role === 'file');

        if (observation.captchaDetected) {
            return { state: this.STATES.CAPTCHA, confidence: 0.98, evidence: ['CAPTCHA widget or challenge text detected'] };
        }
        if (/\b(access denied|forbidden|403|unauthorized)\b/i.test(headings + ' ' + body.slice(0, 400))) {
            return { state: this.STATES.ACCESS_DENIED, confidence: 0.92, evidence: ['Access denied text'] };
        }
        if (/\b(thank you for applying|application (?:submitted|received|confirmed)|we have received your application)\b/i.test(headings + ' ' + body)) {
            return { state: this.STATES.SUBMISSION_CONFIRMED, confidence: 0.95, evidence: ['Confirmation message detected'] };
        }
        if (hasPassword && /\b(sign in|log in|login|password)\b/i.test(headings + ' ' + labels + ' ' + buttons)) {
            return { state: this.STATES.LOGIN, confidence: 0.93, evidence: ['Password field and login controls'] };
        }
        if ((observation.validationErrors || []).length > 0 && (observation.inputs || []).length === 0) {
            return { state: this.STATES.ERROR, confidence: 0.85, evidence: observation.validationErrors };
        }
        if (/\b(review your application|review and submit|summary of your application)\b/i.test(headings) ||
            (/\bsubmit application\b/i.test(buttons) && (observation.inputs || []).length <= 2)) {
            return { state: this.STATES.REVIEW, confidence: 0.9, evidence: ['Review heading or final submit button'] };
        }
        if ((observation.inputs || []).length === 0 && /\b(apply for this job|apply now|start application)\b/i.test(buttons)) {
            return { state: this.STATES.JOB_DETAILS, confidence: 0.85, evidence: ['Apply CTA with no form inputs yet'] };
        }
        if (hasFile && /\b(resume|cv|curriculum vitae)\b/i.test(headings + ' ' + labels) && (observation.inputs || []).length <= 3) {
            return { state: this.STATES.RESUME_UPLOAD, confidence: 0.9, evidence: ['Resume file upload input'] };
        }
        if (/\b(education|university|college|degree|graduation)\b/i.test(headings + ' ' + labels)) {
            return { state: this.STATES.EDUCATION, confidence: 0.86, evidence: ['Education-related fields/headings'] };
        }
        if (/\b(work experience|employment history|previous employer|job title)\b/i.test(headings + ' ' + labels)) {
            return { state: this.STATES.EXPERIENCE, confidence: 0.86, evidence: ['Work experience fields/headings'] };
        }
        if (/\b(authorized to work|sponsorship|visa|veteran|disability|relocate|screening)\b/i.test(headings + ' ' + labels)) {
            return { state: this.STATES.SCREENING_QUESTIONS, confidence: 0.85, evidence: ['Screening/compliance questions'] };
        }
        if (/\b(first name|last name|full name|personal information|my information)\b/i.test(headings + ' ' + labels)) {
            return { state: this.STATES.PERSONAL_INFORMATION, confidence: 0.88, evidence: ['Personal info fields'] };
        }
        if (/\b(email|phone|address|city|postal|zip)\b/i.test(headings + ' ' + labels)) {
            return { state: this.STATES.CONTACT_INFORMATION, confidence: 0.84, evidence: ['Contact info fields'] };
        }
        if ((observation.inputs || []).length > 0) {
            return { state: this.STATES.CUSTOM_QUESTIONS, confidence: 0.72, evidence: [`${observation.inputs.length} interactive form fields present`] };
        }
        if (/\b(submit|apply|next|continue)\b/i.test(buttons)) {
            return { state: this.STATES.APPLICATION_START, confidence: 0.65, evidence: ['Navigation buttons present'] };
        }

        return { state: this.STATES.UNKNOWN, confidence: 0.2, evidence: ['Insufficient DOM evidence'] };
    }
};

if (typeof window !== 'undefined') window.PageStateClassifier = PageStateClassifier;
if (typeof module !== 'undefined' && module.exports) module.exports = PageStateClassifier;
