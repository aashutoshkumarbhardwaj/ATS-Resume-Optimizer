/**
 * Personal Agent Brain
 * Manages candidate personal knowledge, resume context, and reasoning
 * via stored database profile, Job Orbit session, SmartAnswerEngine, and LLMs.
 * Inspired by OpenClaw's personal digital assistant architecture.
 */

function getFreeLLMClientClass() {
    if (typeof window !== 'undefined' && window.FreeLLMClient) return window.FreeLLMClient;
    if (typeof FreeLLMClient !== 'undefined') return FreeLLMClient;
    if (typeof require !== 'undefined') {
        try { return require('./FreeLLMClient.js'); } catch (e) {}
    }
    return null;
}

function getUserContextGraphEngineClass() {
    if (typeof window !== 'undefined' && window.UserContextGraphEngine) return window.UserContextGraphEngine;
    if (typeof UserContextGraphEngine !== 'undefined') return UserContextGraphEngine;
    if (typeof require !== 'undefined') {
        try { return require('./UserContextGraphEngine.js'); } catch (e) {}
    }
    return null;
}

function getSmartAnswerEngine() {
    if (typeof window !== 'undefined' && window.SmartAnswerEngine) return window.SmartAnswerEngine;
    if (typeof SmartAnswerEngine !== 'undefined') return SmartAnswerEngine;
    if (typeof require !== 'undefined') {
        try { return require('../../utils/smartAnswerEngine.js'); } catch (e) {}
    }
    return null;
}

class PersonalAgentBrain {
    constructor() {
        const ClientClass = getFreeLLMClientClass();
        this.llmClient = ClientClass ? new ClientClass() : null;
        const GraphClass = getUserContextGraphEngineClass();
        this.contextGraphEngine = GraphClass ? new GraphClass() : null;
        this.profile = {};
        this.resumeData = {};
        this.resumeText = '';
        this.aiMemory = [];
        this.activePersona = null;
        this.answerCache = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize profile data, memory, and LLM configuration
     * Uses targeted storage reads to minimize memory footprint and latency.
     */
    async init() {
        try {
            const targetKeys = [
                'jobOrbitSession', 'jobOrbitSyncData', 'autofillProfile',
                'userProfile', 'currentProfile', 'profile', 'user_profile', 'candidate_profile',
                'parsedResume', 'uploadedResume', 'resume', 'default_resume', 'resumeData',
                'ai_memory', 'aiAnswers', 'aiAnswerMemory', 'qa_cache', 'cf_qa_cache', 'activePersona', 'personas',
                'cf_worker_url', 'cfWorkerUrl', 'cloudflare_worker_url', 'cloudflareWorkerUrl',
                'cf_account_id', 'cfAccountId', 'cf_api_token', 'cfApiToken', 'cf_model', 'cfModel',
                'gemini_api_key', 'ai_agent_provider', 'groq_api_key',
                'geminiApiKey', 'groqApiKey', 'llmProvider'
            ];

            // Step 1: Read targeted keys from local storage
            const localData = await new Promise(resolve => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(targetKeys, resolve);
                } else {
                    resolve({});
                }
            });

            // Step 2: Read targeted sync storage
            const syncData = await new Promise(resolve => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.get(['jobOrbitSession', 'autofillProfile', 'activePersona', 'gemini_api_key', 'ai_agent_provider', 'groq_api_key', 'geminiApiKey', 'groqApiKey', 'llmProvider'], resolve);
                } else {
                    resolve({});
                }
            });

            // Extract Job Orbit Session & Auth
            const session = syncData.jobOrbitSession || localData.jobOrbitSession || {};
            const sessionProfile = session.cachedProfile || {};
            const sessionUser = session.user || {};
            const syncStore = localData.jobOrbitSyncData || {};
            const dbProfile = syncStore.profile || {};
            const autoProfile = syncData.autofillProfile || localData.autofillProfile || {};
            const userModelProfile = syncData.userProfile || localData.userProfile || {};
            const legacyProfile = localData.currentProfile || localData.profile || localData.user_profile || localData.candidate_profile || {};

            // Candidate objects in priority order (user custom profiles -> synced DB profiles -> session -> legacy)
            const profileSources = [
                autoProfile,
                autoProfile.customFields,
                userModelProfile,
                dbProfile,
                dbProfile.customFields,
                sessionProfile,
                sessionProfile.customFields,
                sessionUser,
                localData.currentProfile,
                legacyProfile
            ].filter(Boolean);

            const isPdfArtifact = (val) => /\b(?:pdftex|xetex|luatex|latex|overleaf|endobj|flatedecode|fontdescriptor|mediabox|creator|producer)\b/i.test(String(val || '')) || /^version$/i.test(String(val || '').trim());
            const pickVal = (...keys) => {
                for (const src of profileSources) {
                    for (const k of keys) {
                        if (src && src[k] !== undefined && src[k] !== null && String(src[k]).trim() !== '') {
                            const val = String(src[k]).trim();
                            if (!isPdfArtifact(val)) return val;
                        }
                    }
                }
                return '';
            };

            // Consolidate rich profile object (prioritize most specific non-empty values)
            this.profile = {
                // Identity
                full_name: pickVal('full_name', 'fullName', 'name', 'candidate_name'),
                first_name: pickVal('first_name', 'firstName', 'given_name', 'givenName'),
                last_name: pickVal('last_name', 'lastName', 'family_name', 'familyName', 'surname'),
                preferred_name: pickVal('preferred_name', 'preferredName', 'nickname'),
                gender: pickVal('gender', 'sex') || 'Male',
                
                // Contact
                email: pickVal('email', 'userEmail', 'user_email', 'contact_email'),
                phone: pickVal('phone', 'phoneNumber', 'phone_number', 'mobile', 'mobileNumber', 'mobile_number', 'contact', 'contactNumber', 'contact_number', 'mobilePhone', 'cellPhone', 'cell_phone', 'tel'),
                country_code: pickVal('country_code', 'countryCode', 'dial_code', 'dialCode', 'phone_country_code'),
                
                // Location
                city: pickVal('city', 'location', 'currentCity'),
                state: pickVal('state', 'province', 'region'),
                country: pickVal('country', 'currentCountry') || '',
                zip: pickVal('zip', 'postal_code', 'postalCode', 'pinCode', 'pincode', 'zipCode'),
                street_address: pickVal('street_address', 'address', 'addressLine1', 'address_line1', 'street'),
                address_line2: pickVal('address_line2', 'addressLine2', 'apt', 'suite', 'unit', 'building'),
                
                // Online Presence & Portfolio
                linkedin: pickVal('linkedin', 'linkedIn', 'linkedinUrl', 'linkedin_url'),
                github: pickVal('github', 'gitHub', 'githubUrl', 'github_url'),
                portfolio: pickVal('portfolio', 'website', 'personalWebsite', 'portfolioUrl', 'portfolio_link'),
                twitter: pickVal('twitter', 'x', 'twitterUrl', 'twitter_url', 'x_url'),
                resume_url: pickVal('resume_url', 'resume_link', 'resumeUrl', 'default_resume') || pickVal('portfolio', 'linkedin', 'github'),
                
                // Professional Background
                current_title: pickVal('current_title', 'currentJobTitle', 'jobTitle', 'title', 'role', 'current_role'),
                current_company: pickVal('current_company', 'currentCompany', 'company', 'employer'),
                years_of_experience: pickVal('years_of_experience', 'yearsOfExperience', 'yearsExperience', 'experience_years', 'experience'),
                notice_period: pickVal('notice_period', 'noticePeriod', 'availability') || 'Immediately',
                expected_salary: pickVal('expected_salary', 'expectedSalary', 'salary', 'currentSalary'),
                skills: pickVal('skills', 'skill_list', 'technicalSkills'),
                
                // Education
                degree: pickVal('degree', 'highest_degree', 'education', 'highestEducation', 'qualification'),
                university: pickVal('university', 'college', 'school', 'institution'),
                graduation_year: pickVal('graduation_year', 'graduationYear', 'gradYear'),
                
                // Legal & Work Auth
                work_authorization: pickVal('work_authorization', 'workAuthorization', 'authorized_to_work', 'visaStatus') || 'Yes',
                require_sponsorship: pickVal('require_sponsorship', 'sponsorshipRequired', 'requireSponsorship') || 'No',

                // Pre-filled Smart Q&A Answers from Database / Profile
                answer_about_you: pickVal('answer_about_you', 'aboutYou', 'about_you', 'summary', 'bio', 'introduction'),
                answer_why_company: pickVal('answer_why_company', 'why_company', 'why_interested', 'whyInterested'),
                answer_hire_you: pickVal('answer_hire_you', 'hire_you', 'key_strength', 'keyStrength'),
                key_strength: pickVal('key_strength', 'keyStrength', 'strength'),
                why_interested: pickVal('why_interested', 'whyInterested', 'interest')
            };

            // Auto-detect Country and Country Code
            const phoneStr = this.profile.phone || '';
            if (!this.profile.country_code) {
                if (phoneStr.startsWith('+91') || phoneStr.startsWith('91') || /india/i.test(this.profile.country)) {
                    this.profile.country_code = '+91';
                } else if (phoneStr.startsWith('+1') || /united states|usa|us/i.test(this.profile.country)) {
                    this.profile.country_code = '+1';
                } else if (phoneStr.startsWith('+44') || /united kingdom|uk/i.test(this.profile.country)) {
                    this.profile.country_code = '+44';
                } else {
                    this.profile.country_code = '+91';
                }
            }
            if (!this.profile.country) {
                if (this.profile.country_code === '+91' || phoneStr.startsWith('+91') || /bengaluru|bangalore|delhi|mumbai|hyderabad|chennai|pune|noida|gurgaon|kolkata|ahmedabad|karnataka|maharashtra|tamil nadu|uttar pradesh/i.test(this.profile.city || '')) {
                    this.profile.country = 'India';
                } else {
                    this.profile.country = 'India';
                }
            }

            // Derive first/last name if only full_name is present
            if (!this.profile.first_name && this.profile.full_name) {
                const parts = this.profile.full_name.trim().split(/\s+/);
                this.profile.first_name = parts[0] || '';
                this.profile.last_name = parts.slice(1).join(' ') || '';
            } else if (!this.profile.full_name && this.profile.first_name) {
                this.profile.full_name = `${this.profile.first_name} ${this.profile.last_name || ''}`.trim();
            }

            // Extract Resume Data
            this.resumeData = localData.parsedResume || 
                              localData.resumeData ||
                              syncStore.resumes?.[0] || 
                              session.cachedResumes?.[0] || 
                              localData.uploadedResume || 
                              localData.resume || {};

            // Extract Plain Resume Text
            this.resumeText = localData.resume_text || 
                             this.resumeData.content || 
                             this.resumeData.rawText || 
                             localData.default_resume || '';

            // Augment missing profile fields from resume if available
            if (!this.profile.skills && Array.isArray(this.resumeData.skills) && this.resumeData.skills.length > 0) {
                this.profile.skills = this.resumeData.skills.join(', ');
            }
            if (!this.profile.current_title && this.resumeData.experience?.[0]?.title) {
                this.profile.current_title = this.resumeData.experience[0].title;
            }
            if (!this.profile.current_company && this.resumeData.experience?.[0]?.company) {
                this.profile.current_company = this.resumeData.experience[0].company;
            }
            if (!this.profile.degree && this.resumeData.education?.[0]?.degree) {
                this.profile.degree = this.resumeData.education[0].degree;
            }
            if (!this.profile.university && this.resumeData.education?.[0]?.institution) {
                this.profile.university = this.resumeData.education[0].institution;
            }

            // Build candidate verified past employers list
            this.knownCompanies = new Set();
            if (this.profile.current_company) {
                this.knownCompanies.add(this.profile.current_company.toLowerCase().trim());
            }
            if (Array.isArray(this.resumeData.experience)) {
                this.resumeData.experience.forEach(exp => {
                    if (exp && exp.company) {
                        this.knownCompanies.add(exp.company.toLowerCase().trim());
                    }
                });
            }
            if (Array.isArray(this.profile.work_history)) {
                this.profile.work_history.forEach(exp => {
                    if (exp && (exp.company || exp.name)) {
                        this.knownCompanies.add((exp.company || exp.name).toLowerCase().trim());
                    }
                });
            }

            // Augment missing contact and identity from plain resume text if missing
            if (!this.profile.phone && this.resumeText) {
                const phoneMatch = this.resumeText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
                if (phoneMatch) this.profile.phone = phoneMatch[0];
            }
            if (!this.profile.email && this.resumeText) {
                const emailMatch = this.resumeText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) this.profile.email = emailMatch[0];
            }
            if (!this.profile.full_name && this.resumeText) {
                const lines = this.resumeText.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length > 0 && lines[0].length < 40 && !/@|http|\d/.test(lines[0])) {
                    this.profile.full_name = lines[0];
                }
            }
            if (!this.profile.linkedin && this.resumeText) {
                const liMatch = this.resumeText.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\/]+)/i);
                if (liMatch) this.profile.linkedin = liMatch[0].startsWith('http') ? liMatch[0] : `https://${liMatch[0]}`;
            }
            if (!this.profile.github && this.resumeText) {
                const ghMatch = this.resumeText.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?github\.com\/([a-zA-Z0-9_\-\.]+)/i);
                if (ghMatch) this.profile.github = ghMatch[0].startsWith('http') ? ghMatch[0] : `https://${ghMatch[0]}`;
            }
            if (!this.profile.twitter && this.resumeText) {
                const twMatch = this.resumeText.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i);
                if (twMatch) this.profile.twitter = twMatch[0].startsWith('http') ? twMatch[0] : `https://${twMatch[0]}`;
            }
            if (!this.profile.portfolio && this.resumeText) {
                const portMatch = this.resumeText.match(/(?:portfolio|website|site)[:\s]*(https?:\/\/[^\s,;<>"\']+)/i) ||
                    this.resumeText.match(/https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]+/i);
                if (portMatch) {
                    const u = portMatch[1] || portMatch[0];
                    if (!u.includes('linkedin.com') && !u.includes('github.com') && !u.includes('twitter.com') && !u.includes('x.com')) {
                        this.profile.portfolio = u;
                    }
                }
            }

            // Consolidate AI Memory / Answers from all DB and storage sources
            const rawMemory = [
                ...(localData.ai_memory || []),
                ...(localData.aiAnswers || []),
                ...(localData.aiAnswerMemory || []),
                ...(syncStore.answers || []),
                ...(session.cachedAnswers || [])
            ];

            const seenQuestions = new Set();
            this.aiMemory = [];
            for (const item of rawMemory) {
                if (!item) continue;
                const q = (item.question || item.context?.question || item.question_type || item.prompt || item.q || '').trim();
                const a = (item.answer || item.editedAnswer || item.originalAnswer || item.response_content || item.content || item.text || item.a || '').trim();
                if (q && a && !isPdfArtifact(a)) {
                    const normQ = q.toLowerCase();
                    if (!seenQuestions.has(normQ)) {
                        seenQuestions.add(normQ);
                        this.aiMemory.push({ question: q, answer: a });
                    }
                }
            }

            // Pre-seed high-speed persistent Q&A Cache from storage and memory (filtering stale/corrupted entries)
            const persistentCache = Object.assign({}, localData.qa_cache || {}, localData.cf_qa_cache || {});
            for (const [k, v] of Object.entries(persistentCache)) {
                if (k && v && !isPdfArtifact(v)) this.answerCache.set(String(k).toLowerCase().trim(), String(v).trim());
            }
            for (const item of this.aiMemory) {
                if (item && item.question && item.answer && !isPdfArtifact(item.answer)) {
                    this.answerCache.set(item.question.toLowerCase().trim(), String(item.answer).trim());
                }
            }
            console.log(`[PersonalAgentBrain] ⚡ Seeded local Q&A cache with ${this.answerCache.size} verified responses.`);

            // Configure LLM Client with Cloudflare AI Worker, Gemini, and Groq keys
            if (!this.llmClient) {
                const ClientClass = getFreeLLMClientClass();
                if (ClientClass) this.llmClient = new ClientClass();
            }

            const activeCfWorkerUrl = localData.cf_worker_url || syncData.cf_worker_url || localData.cfWorkerUrl || syncData.cfWorkerUrl || localData.cloudflare_worker_url || '';
            const activeCfAccountId = localData.cf_account_id || syncData.cf_account_id || localData.cfAccountId || syncData.cfAccountId || '';
            const activeCfApiToken = localData.cf_api_token || syncData.cf_api_token || localData.cfApiToken || syncData.cfApiToken || localData.cloudflare_api_token || '';
            const activeCfModel = localData.cf_model || syncData.cf_model || localData.cfModel || '@cf/meta/llama-3.3-70b-instruct';

            const activeGeminiKey = localData.gemini_api_key || syncData.gemini_api_key || localData.geminiApiKey || syncData.geminiApiKey || '';
            const activeGroqKey = localData.groq_api_key || syncData.groq_api_key || localData.groqApiKey || syncData.groqApiKey || '';
            let activeProvider = localData.ai_agent_provider || syncData.ai_agent_provider || localData.llmProvider || syncData.llmProvider;
            if (!activeProvider) {
                activeProvider = (activeCfWorkerUrl || (activeCfAccountId && activeCfApiToken)) ? 'cloudflare' : (activeGeminiKey ? 'gemini' : (activeGroqKey ? 'groq' : 'cloudflare'));
            }

            if (this.llmClient) {
                this.llmClient.configure({
                    provider: activeProvider || this.llmClient.provider,
                    cfWorkerUrl: activeCfWorkerUrl || this.llmClient.cfWorkerUrl,
                    cfAccountId: activeCfAccountId || this.llmClient.cfAccountId,
                    cfApiToken: activeCfApiToken || this.llmClient.cfApiToken,
                    cfModel: activeCfModel || this.llmClient.cfModel,
                    geminiApiKey: activeGeminiKey || this.llmClient.geminiApiKey,
                    groqApiKey: activeGroqKey || this.llmClient.groqApiKey
                });
                console.log(`[PersonalAgentBrain] 🤖 LLM Client configured: provider=${this.llmClient.provider}, hasCloudflare=${!!(this.llmClient.cfWorkerUrl || this.llmClient.cfApiToken)}, hasGemini=${!!this.llmClient.geminiApiKey}, hasGroq=${!!this.llmClient.groqApiKey}`);
            }

            // Initialize User Context Graph
            if (this.contextGraphEngine) {
                await this.contextGraphEngine.init(this.profile, this.aiMemory);
            }

            this.authToken = session.extensionToken || localData.jobOrbitAuth?.extensionToken || syncData.jobOrbitAuth?.extensionToken || null;
            this.isInitialized = true;
            console.log('[PersonalAgentBrain] 🧠 Brain initialized with consolidated database profile:', {
                name: this.profile.full_name,
                email: this.profile.email,
                phone: this.profile.phone,
                country: this.profile.country,
                country_code: this.profile.country_code,
                gender: this.profile.gender,
                keysCount: Object.values(this.profile).filter(Boolean).length,
                memoryCount: this.aiMemory.length
            });
        } catch (e) {
            console.error('[PersonalAgentBrain] ❌ Initialization failed:', e);
            this.isInitialized = true;
        }
    }

    /**
     * Calculate earliest start date by adding candidate notice period to current date
     */
    calculateEarliestStartDate(formatHint = 'YYYY-MM-DD') {
        const notice = (this.profile.notice_period || 'Immediately').toLowerCase().trim();
        let daysToAdd = 1; // Default to 1 day for Immediate

        if (/(\d+)\s*month/i.test(notice)) {
            const m = notice.match(/(\d+)\s*month/i);
            daysToAdd = parseInt(m[1], 10) * 30;
        } else if (/(\d+)\s*week/i.test(notice)) {
            const w = notice.match(/(\d+)\s*week/i);
            daysToAdd = parseInt(w[1], 10) * 7;
        } else if (/(\d+)\s*day/i.test(notice)) {
            const d = notice.match(/(\d+)\s*day/i);
            daysToAdd = Math.max(1, parseInt(d[1], 10));
        } else if (/\b(?:immediate|now|none)\b/i.test(notice)) {
            daysToAdd = 1;
        } else {
            daysToAdd = 15;
        }

        const target = new Date();
        target.setDate(target.getDate() + daysToAdd);

        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');

        if (formatHint === 'date_input' || formatHint === 'YYYY-MM-DD') {
            return `${yyyy}-${mm}-${dd}`;
        }
        if (formatHint === 'DD/MM/YYYY' || formatHint === 'DD-MM-YYYY') {
            return `${dd}/${mm}/${yyyy}`;
        }
        if (formatHint === 'MM/DD/YYYY') {
            return `${mm}/${dd}/${yyyy}`;
        }

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[target.getMonth()]} ${target.getDate()}, ${yyyy}`;
    }

    /**
     * Get candidate country code (e.g. +91 or 91)
     */
    getCountryCode(formatWithPlus = true) {
        let code = this.profile.country_code || '';
        if (!code) {
            const country = (this.profile.country || '').toLowerCase();
            const phone = (this.profile.phone || '');
            if (country.includes('india') || phone.startsWith('+91') || phone.startsWith('91')) {
                code = '+91';
            } else if (country.includes('united states') || country.includes('usa') || phone.startsWith('+1')) {
                code = '+1';
            } else if (country.includes('uk') || phone.startsWith('+44')) {
                code = '+44';
            } else {
                code = '+91';
            }
        }
        if (!formatWithPlus) {
            return code.replace(/^\+/, '');
        }
        return code.startsWith('+') ? code : `+${code}`;
    }

    /**
     * Check if candidate previously worked for a target company
     */
    isCandidateFormerEmployee(targetCompany) {
        if (!targetCompany || !this.knownCompanies) return false;
        const normTarget = targetCompany.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        for (const comp of this.knownCompanies) {
            const normComp = comp.replace(/[^a-z0-9]/g, ' ').trim();
            if (normComp && (normTarget.includes(normComp) || normComp.includes(normTarget))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if candidate is eligible to work in target country
     */
    isEligibleInCountry(targetCountry) {
        const candCountry = (this.profile.country || 'India').toLowerCase();
        const normTarget = (targetCountry || '').toLowerCase();
        if (normTarget.includes(candCountry) || candCountry.includes(normTarget)) {
            return true;
        }
        if (/india/i.test(candCountry) && /india/i.test(normTarget)) {
            return true;
        }
        return this.profile.work_authorization === 'Yes';
    }

    /**
     * Clean boilerplate noise from raw form field labels
     */
    cleanQuestionLabel(rawLabel) {
        if (!rawLabel) return '';
        let cleaned = String(rawLabel).trim();
        // Remove question numbering prefixes: "1. ", "Question 1:", "Q1:"
        cleaned = cleaned.replace(/^(?:question\s*\d+[:.]?|\bq\d+[:.]?|\d+[\).:-]\s*)/i, '');
        // Remove trailing asterisks and required notes
        cleaned = cleaned.replace(/\s*\*+\s*$/g, '').replace(/\s*\((?:required|optional)\)\s*/gi, '');
        // Remove common form placeholders and framework artifacts
        const boilerplate = [
            'please enter your answer',
            'enter your answer',
            'please enter a url',
            'enter a url',
            'single line text',
            'multiline text',
            'required',
            'this question is required',
            'please provide an answer',
            'enter answer'
        ];
        for (const phrase of boilerplate) {
            const reg = new RegExp(phrase, 'gi');
            cleaned = cleaned.replace(reg, '');
        }
        return cleaned.trim().replace(/\s+/g, ' ');
    }

    /**
     * Detect whether a field/question expects a multi-word narrative or reasoned answer
     * rather than a single-word profile attribute (like city, title, name, or Yes/No).
     */
    isOpenEndedNarrativeQuestion(cleanLabel, fieldData = {}) {
        const label = (cleanLabel || '').trim();
        // Screening & short numeric questions (Yes/No, N/A, years of experience) are NOT open-ended essays
        if (/\b(if\s*not\s*(?:type|enter|write)?\s*n\/?a|suggest\s*you\s*apply|if\s*yes\s*(?:to\s*(?:the\s*)?above|please\s*provide)|ever\s*worked\s*for|previously\s*(?:worked|employed)|essential\s*functions\s*of\s*the\s*position|authorized\s*to\s*work|eligib(?:le)?\s*to\s*work|require.*sponsorship|how\s*many\s*years|years\s*of\s*(?:work\s*)?experience)\b/i.test(label)) {
            return false;
        }
        if (fieldData.type === 'textarea' || (fieldData.element && fieldData.element.tagName === 'TEXTAREA')) {
            return true;
        }
        if (/\b(why|describe|explain|tell\s+(?:us|me)|elaborate|what\s+makes|what\s+excites|what\s+attracts|how\s+(?:did|do|would|have)|share\s+(?:an?|your)|experience\s+with|familiarity\s+with|project|challenge|achievement|cover\s*letter|additional\s+(?:info|information|comments|notes)|motivation|strength|weakness)\b/i.test(label)) {
            return true;
        }
        if (label.includes('?') && label.split(/\s+/).length >= 5) {
            return true;
        }
        return false;
    }

    /**
     * Evaluate & sanitize an AI-generated answer before displaying or filling (Phase 5):
     * - Strips generic ChatGPT/corporate clichés
     * - Respects field maxLength
     * - Flags potential experience-inflation hallucinations
     */
    evaluateGeneratedAnswer(answer, questionText = '', fieldData = {}, context = {}) {
        if (!answer) return { valid: false, text: '', warnings: ['Empty answer'] };
        let text = String(answer).trim().replace(/^["']|["']$/g, '');
        const warnings = [];

        // Strip common AI filler openers
        const clichePatterns = [
            /^(?:i am writing to express my (?:keen |strong )?interest in[^.]*\.\s*)/i,
            /^(?:based on my background and experience,\s*)/i,
            /^(?:as a highly motivated (?:and results-driven )?[^,]*,\s*)/i,
            /^(?:i am thrilled to apply for[^.]*\.\s*)/i
        ];
        for (const pat of clichePatterns) {
            text = text.replace(pat, '');
        }
        text = text.trim();
        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        // Check for exaggerated years of experience vs profile
        const profYears = parseFloat(this.profile?.years_of_experience ?? this.profile?.yearsOfExperience ?? 0) || 0;
        const claimedMatch = text.match(/\b(\d+)\+?\s+years?\s+of\s+(?:professional\s+)?experience\b/i);
        if (claimedMatch && parseInt(claimedMatch[1], 10) > profYears + 1) {
            warnings.push(`Answer claimed ${claimedMatch[1]} years of experience, but profile lists ${profYears}.`);
        }

        // Enforce field maxLength cleanly at sentence or word boundary
        const maxLen = parseInt(fieldData?.maxLength || fieldData?.element?.maxLength || 0, 10);
        if (maxLen > 0 && text.length > maxLen) {
            const sliced = text.slice(0, maxLen);
            const lastStop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf(' '));
            text = (lastStop > maxLen * 0.6 ? sliced.slice(0, lastStop + (sliced[lastStop] === '.' ? 1 : 0)) : sliced).trim();
            warnings.push(`Trimmed to field limit (${maxLen} chars).`);
        }

        return {
            valid: text.length > 0 && this.isValidAnswerForField(text, questionText, fieldData),
            text,
            warnings
        };
    }

    /**
     * Validate that a cached/memory answer is appropriate for the target field
     */
    isValidAnswerForField(ans, cleanLabel, fieldData = {}) {
        if (ans === null || ans === undefined) return false;
        const str = String(ans).trim();
        if (!str) return false;

        const label = String(cleanLabel || '').toLowerCase();
        const p = this.profile || {};

        // 1. Never allow a person's name to fill a college/company/academic/numeric/contact field
        const isNonPersonField = /\b(university|college|school|institution|alma\s*mater|company|employer|organization|org|project|manager|referrer|reference|branch|speciali[sz]ation|degree|cgpa|gpa|percentage|marks|year|graduation|completion|passing|stipend|salary|ctc|compensation|city|state|country|email|phone|mobile|url|link|github|linkedin|portfolio)\b/i.test(label);
        if (isNonPersonField) {
            const normStr = str.toLowerCase();
            const fullName = String(p.full_name || '').trim().toLowerCase();
            const firstName = String(p.first_name || '').trim().toLowerCase();
            if ((fullName && normStr === fullName) || (firstName && normStr === firstName && !/\bfirst\s*name\b/i.test(label))) {
                return false;
            }
        }

        // 2. Reject handle/password-like strings (e.g. "Aashutosh@21") for non-username/password fields
        const isAuthOrHandleField = /\b(user\s*name|handle|password|passcode|pin|secret|referral\s*code|promo\s*code)\b/i.test(label) || fieldData.type === 'password';
        if (!isAuthOrHandleField && /^[a-z0-9_.-]+@\d{1,4}$/i.test(str)) {
            return false;
        }

        // 3. Reject non-numeric text in strictly numeric / year / CGPA / stipend fields
        const isNumericField = /\b(cgpa|gpa|percentage|marks|year\s*of\s*completion|graduation\s*year|passing\s*year|completion\s*year|stipend|hourly\s*(?:rate|compensation)|expected\s*salary|expected\s*ctc)\b/i.test(label) || fieldData.type === 'number';
        if (isNumericField && !/\d/.test(str)) {
            return false;
        }

        if (this.isOpenEndedNarrativeQuestion(cleanLabel, fieldData)) {
            // A narrative question must never be answered with a 1-2 word stub (e.g. "India", "4", "Yes")
            if (str.split(/\s+/).length < 3 || str.length < 15) {
                return false;
            }
        }
        return true;
    }

    /**
     * Resolve the best answer for any detected form field
     * Multi-tier resolution:
     * 0. Persistent Q&A cache
     * 1. Deterministic profile match from database
     * 1.5. Enterprise User Context Graph
     * 2. Intelligent option/dropdown matcher
     * 3. AI Memory lookup from previous applications
     * 4. Semantic Synonym Map
     * 5. Candidate Question Reasoning Engine (Cloudflare AI / LLM / Dynamic RAG / Interactive)
     */
    async resolveAnswer(fieldData, context = {}) {
        if (!this.isInitialized) await this.init();

        const rawLabel = fieldData.label || fieldData.name || '';
        const cleanLabel = this.cleanQuestionLabel(rawLabel);
        const intent = fieldData.semanticIntent?.intent || 'unknown';
        const cacheKey = (cleanLabel || rawLabel).toLowerCase().trim();

        // 0. Level 0: Instant Local Answer Cache (<5ms response time, zero network calls)
        if (cacheKey && this.answerCache.has(cacheKey)) {
            const cached = this.answerCache.get(cacheKey);
            if (this.isValidAnswerForField(cached, cleanLabel || rawLabel, fieldData)) {
                return { value: cached, source: 'local_qa_cache' };
            } else {
                this.answerCache.delete(cacheKey);
            }
        }

        // 1. Level 1: Deterministic Exact Match (from unified database/profile)
        const deterministicVal = this.getDeterministicValue(rawLabel, intent, fieldData);
        if (deterministicVal !== null && deterministicVal !== undefined && String(deterministicVal).trim() !== '') {
            if (this.isValidAnswerForField(deterministicVal, cleanLabel || rawLabel, fieldData)) {
                if (cacheKey) this.answerCache.set(cacheKey, deterministicVal);
                return { value: deterministicVal, source: 'deterministic_profile' };
            }
        }

        // 1.5. Level 1.5: Query Enterprise User Context Graph (tracks semantic nodes & past form answers)
        if (this.contextGraphEngine) {
            const graphMatch = this.contextGraphEngine.findBestAnswer(cleanLabel || rawLabel, intent);
            if (graphMatch && this.isValidAnswerForField(graphMatch.answer, cleanLabel || rawLabel, fieldData)) {
                if (cacheKey) this.answerCache.set(cacheKey, graphMatch.answer);
                return { value: graphMatch.answer, source: 'user_context_graph' };
            }
        }

        // 2. Level 2: Options / Select / Radio Matcher
        if (fieldData.options && fieldData.options.length > 0) {
            const matchedOption = await this.matchOption(fieldData, context);
            if (matchedOption) {
                return { value: matchedOption, source: 'option_matcher' };
            }
        }

        // 3. Level 3: Check AI Memory / Previously Answered Questions from DB (protected against boilerplate & 1-word stubs)
        const memoryAnswer = this.findInMemory(cleanLabel || rawLabel);
        if (memoryAnswer && this.isValidAnswerForField(memoryAnswer, cleanLabel || rawLabel, fieldData)) {
            if (cacheKey) this.answerCache.set(cacheKey, memoryAnswer);
            return { value: memoryAnswer, source: 'ai_memory' };
        }

        // 4. Level 4: Semantic Synonym Map (Zero-API local lookup for short profile fields ONLY)
        const semanticMapMatch = this.matchSemanticSynonym(cleanLabel || rawLabel, fieldData);
        if (semanticMapMatch && this.isValidAnswerForField(semanticMapMatch, cleanLabel || rawLabel, fieldData)) {
            if (cacheKey) this.answerCache.set(cacheKey, semanticMapMatch);
            return { value: semanticMapMatch, source: 'local_semantic_map' };
        }

        // 5. Level 5: Candidate Question Reasoning Engine ("Most Deserving Candidate")
        // If not found in static profile, synthesize a bespoke answer using AI (Cloudflare / LLM / Chrome Built-in AI),
        // dynamic resume-grounded synthesis (SmartAnswerEngine), or interactive user guidance.
        const candidateAnswer = await this.generateCandidateAnswer(fieldData, cleanLabel || rawLabel, context);
        if (candidateAnswer && candidateAnswer.value) {
            if (cacheKey) this.answerCache.set(cacheKey, candidateAnswer.value);
            return candidateAnswer;
        }

        return { value: null, source: 'unresolved' };
    }

    /**
     * Fast semantic synonym matcher for standard profile keys (NEVER hijacks open-ended questions)
     */
    matchSemanticSynonym(cleanLabel, fieldData = {}) {
        if (!cleanLabel) return null;
        if (this.isOpenEndedNarrativeQuestion(cleanLabel, fieldData)) {
            return null;
        }
        // Also skip if it's a long question sentence (>= 6 words)
        if (cleanLabel.trim().split(/\s+/).length >= 6) {
            return null;
        }

        const p = this.profile;
        const lowerQ = cleanLabel.toLowerCase();
        const isNonPersonNameQ = /\b(college|university|school|institution|company|employer|organization|org|project|manager|referrer|reference|user|file|first|last|middle|nick|preferred)\b/i.test(lowerQ);

        const semanticMap = [
            { keys: ['phone'], synonyms: ['phone', 'mobile', 'cell', 'contact number', 'telephone', 'whatsapp'] },
            { keys: ['country_code'], synonyms: ['country code', 'dial code', 'calling code', 'phone prefix', 'isd code'] },
            { keys: ['email'], synonyms: ['email', 'email address'] },
            { keys: ['university'], synonyms: ['university', 'college', 'school', 'alma mater', 'institution'] },
            { keys: ['current_company'], synonyms: ['current company', 'current employer', 'present company'] },
            ...(!isNonPersonNameQ ? [{ keys: ['full_name'], synonyms: ['full name', 'applicant name', 'candidate name', 'full legal name', 'your name'] }] : []),
            { keys: ['city', 'street_address'], synonyms: ['city', 'current city', 'reside in', 'street address', 'current location', 'town'] },
            { keys: ['years_of_experience'], synonyms: ['years of experience', 'years experience', 'total experience', 'yoe', 'how many years'] },
            { keys: ['current_title'], synonyms: ['current title', 'job title', 'designation', 'current role', 'current position'] },
            { keys: ['notice_period'], synonyms: ['notice period', 'earliest start date', 'how soon can you join', 'availability date'] },
            { keys: ['expected_salary'], synonyms: ['expected salary', 'target compensation', 'expected ctc', 'salary expectation'] },
            { keys: ['skills'], synonyms: ['technical skills', 'core skills', 'tech stack'] },
            { keys: ['gender'], synonyms: ['gender', 'sex'] },
            { keys: ['degree'], synonyms: ['highest degree', 'degree', 'highest education'] },
            { keys: ['resume_url'], synonyms: ['resume link', 'cv link', 'curriculum vitae link'] },
            { keys: ['linkedin'], synonyms: ['linkedin'] },
            { keys: ['github'], synonyms: ['github', 'github url'] },
            { keys: ['twitter'], synonyms: ['twitter', 'x profile', 'x (fka twitter)', 'twitter profile'] },
            { keys: ['portfolio'], synonyms: ['portfolio', 'personal website', 'website url'] },
            { keys: ['work_authorization'], synonyms: ['authorized to work', 'legal to work', 'work eligibility', 'eligible to work'] },
            { keys: ['require_sponsorship'], synonyms: ['require sponsorship', 'visa sponsorship'] }
        ];

        for (const item of semanticMap) {
            for (const syn of item.synonyms) {
                if (new RegExp(`\\b${syn}\\b`, 'i').test(lowerQ)) {
                    for (const k of item.keys) {
                        if (p[k] && String(p[k]).trim() !== '') {
                            return p[k];
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Candidate Question Reasoning Engine ("Most Deserving Candidate")
     * Dynamically synthesizes high-caliber, articulate candidate responses using:
     * 1. Multi-choice Option Matcher
     * 2. LLM Reasoning with Elite Candidate Persona (Gemini / Groq / Chrome Built-in AI)
     * 3. Dynamic Resume-Grounded Synthesizer (Zero-API / Offline RAG)
     * 4. Interactive User Fallback (with pre-selected recommended choice)
     * AND automatically pushes and saves the answer to memory, context graph, and local storage!
     */
    async generateCandidateAnswer(fieldData, cleanLabel, context = {}) {
        const p = this.profile;
        const rawLabel = fieldData.label || fieldData.name || cleanLabel || '';
        const questionText = cleanLabel || rawLabel;
        if (!questionText || questionText.trim().length === 0) return null;

        // 1. If options exist (select / radio / combobox), pick the best candidate option
        if (fieldData.options && fieldData.options.length > 0) {
            const matchedOpt = await this.matchOption(fieldData, context);
            if (matchedOpt) {
                this.saveToMemory(questionText, matchedOpt, fieldData);
                return { value: matchedOpt, source: 'option_matcher' };
            }
        }

        // 2. LLM Reasoning with "Most Deserving Candidate" Persona (Cloudflare AI Worker / Chrome Built-in / Groq / Gemini)
        if (this.llmClient && (this.llmClient.cfWorkerUrl || (this.llmClient.cfAccountId && this.llmClient.cfApiToken) || this.llmClient.provider === 'cloudflare' || this.llmClient.geminiApiKey || this.llmClient.groqApiKey || this.llmClient.provider === 'window_ai')) {
            try {
                let optionsPrompt = '';
                if (fieldData.options && fieldData.options.length > 0) {
                    const opts = fieldData.options.map(o => typeof o === 'string' ? o : (o.label || o.value)).filter(Boolean);
                    optionsPrompt = `\nOptions to choose from (Return EXACTLY one of these strings):\n${JSON.stringify(opts)}`;
                }

                const companyName = context.company || 'the hiring company';
                const jobRole = context.jobTitle || 'this role';
                const skillsArr = Array.isArray(this.resumeData.skills) ? this.resumeData.skills : (p.skills ? String(p.skills).split(/[,;]+/) : []);
                const topSkills = skillsArr.slice(0, 6).join(', ');
                const topAchievement = this.resumeData.experience?.[0]?.bullets?.[0] || '';

                const systemPrompt = `You are an elite, top-tier candidate applying for the role of ${jobRole} at ${companyName}.
You embody the most qualified, articulate, proactive, and deserving candidate for this job.
Rules:
1. Answer in the first-person ('I') directly, authentically, and assertively.
2. Tone: Highly confident, results-oriented, professional, articulate, and enthusiastic.
3. NEVER use generic clichés or repetitive filler like 'Based on my background and experience' or 'I am writing to express my interest'.
4. For open-ended questions / textareas: Write 2-3 compelling, specific sentences (~50-80 words) highlighting relevant skills (${topSkills}), concrete outcomes, and genuine excitement for ${companyName}.
5. For short questions (e.g., years, tools, links, availability): Output ONLY the direct, concise answer.
6. For multiple choice options: Output ONLY the single best option matching an elite candidate.
7. Return ONLY the final answer text with no quotes, markdown, or commentary.`;

                const prompt = `Application Question: "${questionText}"${optionsPrompt}

Candidate Knowledge Base:
- Full Name: ${p.full_name}
- Current Title: ${p.current_title || 'Software Engineer'}
- Years of Experience: ${p.years_of_experience || '3+'}
- Core Skills: ${topSkills}
- Primary Achievement: ${topAchievement}
- Location: ${p.city}, ${p.country}
- Work Authorization: Authorized to work in ${p.country}
- Target Company: ${companyName}
- Target Position: ${jobRole}`;

                const res = await this.llmClient.complete(systemPrompt, prompt);
                if (res && res.trim() && !res.includes('UNKNOWN') && res.trim().length > 0) {
                    const evalRes = this.evaluateGeneratedAnswer(res, questionText, fieldData, context);
                    if (evalRes.valid) {
                        this.saveToMemory(questionText, evalRes.text, fieldData);
                        return { value: evalRes.text, source: 'llm_deserving_candidate', warnings: evalRes.warnings };
                    }
                    console.warn(`[PersonalAgentBrain] ⚠️ LLM answer failed validation/evaluation. Falling back.`);
                }
            } catch (err) {
                console.warn('[PersonalAgentBrain] LLM candidate reasoning error:', err);
            }
        }

        // 3. Dynamic Resume-Grounded Synthesizer (Zero-API / Offline RAG)
        // ONLY run narrative essay synthesizer on genuine open-ended narrative questions (never on short factual/date/numeric fields)
        const isShortFactual = /\b(cgpa|gpa|percentage|marks|year\s*of\s*completion|graduation\s*year|passing\s*year|branch|speciali[sz]ation|stipend|hourly\s*(?:rate|compensation)|college|university|school|institution|degree|roll\s*no|enrollment|register\s*number|pan|aadhaar|passport|license|start\s*month|start\s*date)\b/i.test(questionText);
        const SmartEngine = (!isShortFactual && this.isOpenEndedNarrativeQuestion(questionText, fieldData)) ? getSmartAnswerEngine() : null;
        if (SmartEngine) {
            try {
                const smartRes = SmartEngine.generate(questionText, this.resumeData, this.profile, context);
                if (smartRes && smartRes.answer && smartRes.answer.trim().length > 0) {
                    const dynamicAnswer = smartRes.answer.trim();
                    this.saveToMemory(questionText, dynamicAnswer, fieldData);
                    return { value: dynamicAnswer, source: 'smart_candidate_synthesizer' };
                }
            } catch (err) {
                console.warn('[PersonalAgentBrain] Smart candidate synthesis error:', err);
            }
        }

        // 4. Interactive User Fallback (Prompt user with AI recommendations)
        // If question could not be generated and virtual cursor is active, prompt user
        if (context.virtualCursor && typeof context.virtualCursor.askUser === 'function') {
            const displayQuestion = questionText;
            console.log(`[PersonalAgentBrain] ❓ Prompting user for question: "${displayQuestion}"`);
            let optionsList = (fieldData.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value)).filter(Boolean).slice(0, 8);
            
            const userChoice = await context.virtualCursor.askUser(
                displayQuestion,
                optionsList
            );

            if (userChoice && String(userChoice).trim() !== '') {
                const ans = userChoice.trim();
                this.saveToMemory(displayQuestion, ans, fieldData);
                return { value: ans, source: 'user_interactive' };
            }
        }

        return null;
    }

    /**
     * Fast deterministic lookup against consolidated profile & resume data
     */
    getDeterministicValue(rawLabel, intent, fieldData = {}) {
        const p = this.profile;
        const cleanLabel = this.cleanQuestionLabel(rawLabel).toLowerCase();
        const placeholder = (fieldData.placeholder || '').toLowerCase();
        const inputType = (fieldData.type || '').toLowerCase();
        const nameAttr = (fieldData.name || '').toLowerCase();
        const idAttr = (fieldData.id || '').toLowerCase();

        // Screening questions with explicit instructions (N/A, conditional follow-up, ex-employee, ADA essential functions)
        if (/if\s*not\s*(?:type|enter|write)?\s*n\/?a|suggest\s*you\s*apply|referr(?:ed|al)\s*(?:you|by)/i.test(cleanLabel)) {
            return p.referred_by || 'N/A';
        }
        if (/if\s*yes\s*(?:to\s*(?:the\s*)?above|please\s*provide)/i.test(cleanLabel)) {
            return 'N/A';
        }
        if (/ever\s*worked\s*for|previously\s*(?:worked|employed)|former\s*employee/i.test(cleanLabel)) {
            let targetComp = fieldData.context?.company || '';
            if (!targetComp) {
                const m = cleanLabel.match(/(?:at|for|with)\s+([a-z0-9\s&.,-]+?)(?:\s+or|\?|$)/i);
                if (m) targetComp = m[1].trim();
            }
            return this.isCandidateFormerEmployee(targetComp) ? 'Yes' : 'No';
        }
        if (/essential\s*functions\s*of\s*the\s*position/i.test(cleanLabel)) {
            return 'Yes';
        }

        // Guard: If this is an open-ended narrative question, NEVER match short 1-word profile fields
        // (such as city, country, current_title, current_company, name, gender)
        if (this.isOpenEndedNarrativeQuestion(cleanLabel, fieldData)) {
            if (/about\s*(?:your)?self|introduction|tell\s*(?:me|us)\s*about\s*yourself|bio/i.test(cleanLabel)) {
                return p.answer_about_you || null;
            }
            if (/why\s*(?:this\s*)?company|why\s*(?:do\s*you\s*want\s*to\s*work|us)|interested\s*in\s*(?:this\s*)?(?:field|role)/i.test(cleanLabel)) {
                return p.answer_why_company || p.why_interested || null;
            }
            if (/why\s*should\s*we\s*hire\s*you|what\s*makes\s*you\s*(?:a\s*)?(?:good|great)\s*fit|key\s*strength/i.test(cleanLabel)) {
                return p.answer_hire_you || p.key_strength || null;
            }
            if (/authorized\s*to\s*work|legal.*work|eligib.*work/i.test(cleanLabel)) {
                if (/in\s+([a-zA-Z]+)/i.test(cleanLabel)) {
                    const match = cleanLabel.match(/in\s+([a-zA-Z]+)/i);
                    if (match && match[1]) return this.isEligibleInCountry(match[1]) ? 'Yes' : 'No';
                }
                return p.work_authorization || 'Yes';
            }
            if (/require.*sponsorship|sponsor.*visa/i.test(cleanLabel)) {
                return p.require_sponsorship || 'No';
            }
            return null;
        }

        // --- 1. Names (strictly guard against matching University Name, Company Name, Project Name, Referrer Name) ---
        if (intent === 'first_name' || /first\s*name|given\s*name|forename|fname/i.test(cleanLabel)) {
            return p.first_name || (p.full_name ? p.full_name.split(' ')[0] : null);
        }
        if (intent === 'last_name' || /last\s*name|surname|family\s*name|lname/i.test(cleanLabel)) {
            return p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : null);
        }
        if (/university|college|school|institution|alma\s*mater/i.test(cleanLabel)) {
            return p.university || null;
        }
        if (/current\s*company|current\s*employer|present\s*company|company\s*name|employer\s*name/i.test(cleanLabel)) {
            return p.current_company || null;
        }
        const isNonPersonName = /first|last|middle|company|school|university|college|institution|employer|project|manager|referrer|reference|subsidiary|parent|user|file|org|sur|preferred|nick/i.test(cleanLabel) ||
                                /company|university|college|project|employer/i.test(placeholder);
        if (
            intent === 'full_name' ||
            /full\s*name|candidate\s*name|applicant\s*name|your\s*name|legal\s*name/i.test(cleanLabel) ||
            (/\bname\b/i.test(cleanLabel) && !isNonPersonName) ||
            (/full\s*name|candidate\s*name|your\s*name/i.test(placeholder) && !isNonPersonName)
        ) {
            return p.full_name || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : null);
        }

        // --- 2. Contact: Email, Phone, Country Code ---
        if (intent === 'email' || /e-?mail/i.test(cleanLabel) || /e-?mail/i.test(placeholder) || inputType === 'email') {
            return p.email || (this.resumeText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || null);
        }

        // Country code / Dialing code
        if (
            intent === 'country_code' ||
            /country\s*code|dial(?:ing)?\s*code|phone\s*prefix|isd\s*code|\bisd\b|calling\s*code|\bintl(?:_|\s*)?code/i.test(cleanLabel) ||
            /country\s*code|dial(?:ing)?\s*code|\bisd\b/i.test(placeholder) ||
            /country.*code|dial.*code|isd|intl.*code/i.test(nameAttr) ||
            /country.*code|dial.*code|isd|intl.*code/i.test(idAttr)
        ) {
            const withPlus = !/^\d+$/.test(placeholder) && !/digits\s*only/i.test(placeholder);
            return this.getCountryCode(withPlus);
        }

        // Main Phone Number (Clean 10-digit phone if separate country code or short format)
        if (
            intent === 'phone' ||
            /phone|mobile|cell|contact|telephone|tel\b|phno|whatsapp/i.test(cleanLabel) ||
            /phone|mobile|cell|contact/i.test(placeholder) ||
            inputType === 'tel' ||
            /phone|mobile|contact/i.test(nameAttr) ||
            /phone|mobile|contact/i.test(idAttr)
        ) {
            let ph = p.phone || (this.resumeText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || null);
            if (ph && (fieldData.maxLength === 10 || /10\s*digit/i.test(placeholder) || /10\s*digit/i.test(cleanLabel))) {
                ph = ph.replace(/^\+91[\s-]?|^91[\s-]?|^\+1[\s-]?/, '').replace(/\D/g, '');
            }
            return ph;
        }

        // --- 3. Location & Address ---
        if (/address\s*line\s*2|apartment|apt|suite|unit\b|building|flat/i.test(cleanLabel)) {
            return p.address_line2 || '';
        }
        if (/street\s*address|address\s*line\s*1|address\s*1|residential\s*address|home\s*address|current\s*address|(?:^|\b)address\b/i.test(cleanLabel)) {
            return p.street_address || p.address || p.city || null;
        }
        if (/(?:^|\b)city\b|current\s*city|residing\s*city|town/i.test(cleanLabel)) {
            let cityVal = p.city || null;
            if (cityVal) {
                cityVal = cityVal.replace(/^(?:technology|engineering|bachelor|master|science|arts|university|college|school|institute)[\s\-_]*/i, '').trim();
            }
            return cityVal || null;
        }
        if (/country(?:\s*[\/\-]?\s*region)?|nationality/i.test(cleanLabel)) {
            return p.country || 'India';
        }
        if (/(?:^|\b)state\b|province|\bregion\b|state\/province/i.test(cleanLabel)) {
            return p.state || null;
        }
        if (/postal|zip|pin\s*code|pincode|zipcode/i.test(cleanLabel)) {
            return p.zip || null;
        }

        // --- 4. Resume & Links ---
        if (/resume|cv|curriculum\s*vitae/i.test(cleanLabel) || /paste.*resume|upload.*resume|host.*resume/i.test(cleanLabel)) {
            return p.resume_url || p.resume_link || p.portfolio || p.linkedin || p.github || (p.full_name ? `https://${p.full_name.toLowerCase().replace(/\s+/g, '')}-resume.dev` : null);
        }
        if (intent === 'linkedin' || /linkedin/i.test(cleanLabel)) {
            return p.linkedin || (this.resumeText ? this.resumeText.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-\/]+/i)?.[0] : null) || null;
        }
        if (intent === 'github' || /github/i.test(cleanLabel)) {
            return p.github || (this.resumeText ? this.resumeText.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?github\.com\/[a-zA-Z0-9_\-\.]+/i)?.[0] : null) || null;
        }
        if (intent === 'twitter' || /twitter|\bx\b.*(?:profile|handle|fka|url)|x\s*\(fka\s*twitter\)/i.test(cleanLabel)) {
            return p.twitter || (this.resumeText ? this.resumeText.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i)?.[0] : null) || null;
        }
        if (intent === 'portfolio' || /portfolio|personal\s*website|website|blog|personal\s*site/i.test(cleanLabel)) {
            return p.portfolio || p.website || p.github || null;
        }
        if (inputType === 'url' || placeholder.includes('url') || placeholder.includes('link') || placeholder.includes('http')) {
            if (/resume/i.test(cleanLabel)) return p.resume_url || p.portfolio || p.linkedin;
            if (/github/i.test(cleanLabel)) return p.github;
            if (/linkedin/i.test(cleanLabel)) return p.linkedin;
            if (/twitter|x\s*\(fka/i.test(cleanLabel)) return p.twitter;
            if (/portfolio|website/i.test(cleanLabel)) return p.portfolio || p.website;
            return p.portfolio || p.linkedin || p.github || p.resume_url || null;
        }

        // --- 5. Gender ---
        if (intent === 'gender' || /\bgender\b|\bsex\b/i.test(cleanLabel)) {
            return p.gender || 'Male';
        }

        // --- 6. Earliest Start Date & Notice Period Reasoning ---
        if (/earliest\s*(?:start|joining|date|available)|start\s*date|joining\s*date|when\s*can\s*you\s*start|available\s*(?:start\s*)?date|earliest\s*date/i.test(cleanLabel)) {
            const isDateField = inputType === 'date' || /yyyy|dd[\/-]mm|mm[\/-]dd|date/i.test(placeholder) || /date/i.test(nameAttr);
            const formatHint = inputType === 'date' ? 'date_input' : (/dd[\/-]mm/i.test(placeholder) ? 'DD/MM/YYYY' : (/mm[\/-]dd/i.test(placeholder) ? 'MM/DD/YYYY' : 'YYYY-MM-DD'));
            if (isDateField || /date/i.test(cleanLabel)) {
                return this.calculateEarliestStartDate(formatHint);
            }
            return this.calculateEarliestStartDate('text');
        }

        // --- 7. Ex-Employee / Former Employee Reasoning ---
        if (/ex[- ]employee|former\s*employee|previously\s*(?:been\s*)?(?:worked|employed)|ever\s*(?:been\s*)?(?:worked|employed)|previous\s*employment/i.test(cleanLabel)) {
            let targetComp = fieldData.context?.company || '';
            if (!targetComp) {
                const compMatch = cleanLabel.match(/(?:at|of|for|with)\s+([A-Za-z0-9\s&.,-]+?)(?:\?|$)/i);
                if (compMatch) targetComp = compMatch[1].trim();
            }
            if (!targetComp && typeof window !== 'undefined' && window.location) {
                targetComp = window.location.hostname;
            }
            const worked = this.isCandidateFormerEmployee(targetComp);
            return worked ? 'Yes' : 'No';
        }

        // --- 8. Work Authorization & Country Eligibility ---
        if (/authorized\s*to\s*work|legal.*work|eligib/i.test(cleanLabel)) {
            if (/in\s+([a-zA-Z]+)/i.test(cleanLabel)) {
                const match = cleanLabel.match(/in\s+([a-zA-Z]+)/i);
                if (match && match[1]) {
                    return this.isEligibleInCountry(match[1]) ? 'Yes' : 'No';
                }
            }
            return p.work_authorization || 'Yes';
        }
        if (/require.*sponsorship|sponsor.*visa/i.test(cleanLabel)) {
            return p.require_sponsorship || 'No';
        }

        // --- 9. Professional Experience & Notice Period ---
        if (/current\s*(?:job\s*)?title|current\s*role|job\s*title|designation|current\s*position|present\s*role|position\s*applied/i.test(cleanLabel)) {
            return p.current_title || null;
        }
        if (/current\s*company|current\s*employer|present\s*company|organization|company\s*name|employer/i.test(cleanLabel)) {
            return p.current_company || null;
        }
        if (fieldData.type !== 'textarea' && !/describe|explain|tell\s*(?:us|me)|experience\s+with/i.test(cleanLabel)) {
            if (/years?\s*of\s*experience|total\s*experience|experience\s+in\s+years|how\s*many\s*years|yoe|overall\s*experience/i.test(cleanLabel)) {
                return p.years_of_experience || '3+';
            }
        }
        if (/notice\s*period|availability|how\s*soon|joining\s*time/i.test(cleanLabel)) {
            return p.notice_period || 'Immediately';
        }
        if (/salary|compensation|expected\s*(?:pay|ctc)|desired\s*(?:salary|pay)|remuneration/i.test(cleanLabel)) {
            return p.expected_salary || null;
        }

        // --- 10. Skills ---
        if (/skills?|technical\s*skills?|core\s*competenc|technologies|tech\s*stack/i.test(cleanLabel)) {
            return p.skills || null;
        }

        // --- 11. Education (Degree, Branch/Specialisation, CGPA, Graduation Year) ---
        if (/\b(cgpa|gpa)\b/i.test(cleanLabel)) {
            if (p.cgpa || p.gpa) return p.cgpa || p.gpa;
            if (this.resumeData?.education?.[0]?.gpa) return String(this.resumeData.education[0].gpa);
            if (this.resumeText) {
                const m = this.resumeText.match(/(?:cgpa|gpa)[:\s-]*(\d+(?:\.\d+)?)/i);
                if (m) return m[1];
            }
            return null;
        }
        if (/\b(branch|speciali[sz]ation|stream)\b/i.test(cleanLabel)) {
            if (p.branch || p.major) return p.branch || p.major;
            if (this.resumeData?.education?.[0]?.major) return this.resumeData.education[0].major;
            if (this.resumeText) {
                const m = this.resumeText.match(/\b(Computer Science(?:\s*(?:and|&)\s*Engineering)?|CSE|Information Technology|Electronics(?:\s*(?:and|&)\s*Communication)?|ECE|Artificial Intelligence|Machine Learning|Data Science|Mechanical Engineering)\b/i);
                if (m) return m[1];
            }
            return p.degree || null;
        }
        if (/degree|education|major|qualification|highest\s*degree/i.test(cleanLabel)) {
            return p.degree || null;
        }
        if (/university|college|school|institution|alma\s*mater/i.test(cleanLabel)) {
            return p.university || null;
        }
        if (/graduation\s*year|grad\s*year|passing\s*year|year\s*of\s*completion|batch/i.test(cleanLabel)) {
            if (p.graduation_year) return p.graduation_year;
            if (this.resumeData?.education?.[0]?.year) return String(this.resumeData.education[0].year);
            if (this.resumeText) {
                const m = this.resumeText.match(/(?:202[0-9]|2030)\b/);
                if (m) return m[0];
            }
            return null;
        }

        // --- 12. Pre-filled Q&A Answers from Profile ---
        if (/about\s*(?:your)?self|introduction|tell\s*(?:me|us)\s*about\s*yourself|bio/i.test(cleanLabel)) {
            return p.answer_about_you || null;
        }
        if (/why\s*(?:this\s*)?company|why\s*(?:do\s*you\s*want\s*to\s*work|us)|interested\s*in\s*(?:this\s*)?(?:field|role)/i.test(cleanLabel)) {
            return p.answer_why_company || p.why_interested || null;
        }
        if (/why\s*should\s*we\s*hire\s*you|what\s*makes\s*you\s*(?:a\s*)?(?:good|great)\s*fit|key\s*strength/i.test(cleanLabel)) {
            return p.answer_hire_you || p.key_strength || null;
        }

        return null;
    }

    /**
     * Select best option from radio / select choices
     */
    async matchOption(fieldDataOrLabel, optionsOrContext, maybeContext) {
        let fieldData = {};
        let options = [];
        let context = {};

        if (typeof fieldDataOrLabel === 'string') {
            fieldData = { label: fieldDataOrLabel };
            options = Array.isArray(optionsOrContext) ? optionsOrContext : [];
            context = maybeContext || {};
        } else {
            fieldData = fieldDataOrLabel || {};
            options = fieldData.options || (Array.isArray(optionsOrContext) ? optionsOrContext : []);
            context = (optionsOrContext && !Array.isArray(optionsOrContext)) ? optionsOrContext : (maybeContext || {});
        }

        if (!options || options.length === 0) return null;
        const label = (fieldData.label || fieldData.name || '').toLowerCase();
        const p = this.profile;

        // 1. Check direct profile value match against option labels/values
        const profileVal = this.getDeterministicValue(label, fieldData.semanticIntent?.intent, Object.assign({}, fieldData, { context }));
        if (profileVal !== null && profileVal !== undefined && String(profileVal).trim() !== '') {
            const pStr = String(profileVal).toLowerCase().trim();
            // Try exact match first
            let directOpt = options.find(o => {
                const optText = (typeof o === 'string' ? o : (o.label || o.value || '')).toLowerCase().trim();
                return optText === pStr;
            });
            // Try word boundary / substring match next (avoiding 'male' inside 'female' or 'man' inside 'woman')
            if (!directOpt && !/^(male|man|m|fe)$/i.test(pStr)) {
                directOpt = options.find(o => {
                    const optText = (typeof o === 'string' ? o : (o.label || o.value || '')).toLowerCase().trim();
                    const words = optText.split(/[\s,()\/_-]+/);
                    return words.includes(pStr) || (pStr.length > 4 && optText.includes(pStr));
                });
            }
            if (directOpt) return typeof directOpt === 'string' ? directOpt : (directOpt.value || directOpt.label);
        }

        // 2. Gender Selection (Direct matching Male/Female, NEVER default to Decline if known)
        if (/\bgender\b|\bsex\b/i.test(label)) {
            const userGender = (p.gender || 'Male').toLowerCase();
            if (/male|man/i.test(userGender) && !/fe/i.test(userGender)) {
                const maleOpt = options.find(o => {
                    const t = String(o.label || o.value || o).trim().toLowerCase();
                    return /^(male|man|m)$/i.test(t) || (t.includes('male') && !t.includes('female'));
                });
                if (maleOpt) return typeof maleOpt === 'string' ? maleOpt : (maleOpt.value || maleOpt.label);
            } else if (/female|woman/i.test(userGender)) {
                const femOpt = options.find(o => {
                    const t = String(o.label || o.value || o).trim().toLowerCase();
                    return /^(female|woman|f)$/i.test(t) || t.includes('female');
                });
                if (femOpt) return typeof femOpt === 'string' ? femOpt : (femOpt.value || femOpt.label);
            }
        }

        // 3. Country Code Dropdown (e.g., India (+91), +91, 91)
        if (/country\s*code|dial(?:ing)?\s*code|calling\s*code|phone\s*prefix|\bisd\b/i.test(label)) {
            const dialWithPlus = this.getCountryCode(true); // +91
            const dialDigits = this.getCountryCode(false);  // 91
            const opt = options.find(o => {
                const text = String(o.label || o.value || o).toLowerCase();
                return text.includes(dialWithPlus) || text.includes(`+${dialDigits}`) || text.includes(`(${dialDigits})`) || text.includes('india');
            });
            if (opt) return typeof opt === 'string' ? opt : (opt.value || opt.label);
        }

        // 4. Ex-Employee / Former Employee Options (Answer 'No' unless candidate worked there)
        if (/ex[- ]employee|former\s*employee|previously\s*(?:been\s*)?(?:worked|employed)|ever\s*(?:been\s*)?(?:worked|employed)|previous\s*employment/i.test(label)) {
            let targetComp = context?.company || '';
            if (!targetComp) {
                const compMatch = label.match(/(?:at|of|for|with)\s+([A-Za-z0-9\s&.,-]+?)(?:\?|$)/i);
                if (compMatch) targetComp = compMatch[1].trim();
            }
            if (!targetComp && typeof window !== 'undefined' && window.location) {
                targetComp = window.location.hostname;
            }
            const worked = this.isCandidateFormerEmployee(targetComp);
            const targetChoice = worked ? 'yes' : 'no';
            const opt = options.find(o => new RegExp(`^${targetChoice}$`, 'i').test(String(o.label || o.value || o).trim()));
            if (opt) return typeof opt === 'string' ? opt : (opt.value || opt.label);
        }

        // 5. Work Authorization & Country Eligibility
        if (/authorized|legal.*work|eligib/i.test(label)) {
            let isEligible = true;
            if (/in\s+([a-zA-Z]+)/i.test(label)) {
                const match = label.match(/in\s+([a-zA-Z]+)/i);
                if (match && match[1]) {
                    isEligible = this.isEligibleInCountry(match[1]);
                }
            }
            const choice = isEligible ? 'yes' : 'no';
            const opt = options.find(o => new RegExp(`^(${choice}|true|authorized|eligible)$`, 'i').test(String(o.label || o.value || o).trim()));
            if (opt) return typeof opt === 'string' ? opt : (opt.value || opt.label);
        }

        if (/require.*sponsor|sponsorship/i.test(label)) {
            const noOpt = options.find(o => /^(no|false|not\s*required|no\s*sponsorship)$/i.test(String(o.label || o.value || o).trim()));
            if (noOpt) return typeof noOpt === 'string' ? noOpt : (noOpt.value || noOpt.label);
        }

        // 6. Notice Period & Availability Options
        if (/notice\s*period|availability|start\s*date|earliest\s*date|join(?:ing)?|how\s*soon/i.test(label)) {
            const userNotice = (p.notice_period || 'Immediately').toLowerCase();
            const opt = options.find(o => {
                const text = String(o.label || o.value || o).toLowerCase();
                if (/immediate|now/i.test(userNotice) && /immediate|now|less\s*than/i.test(text)) return true;
                if (/30\s*day|1\s*month/i.test(userNotice) && (/30\s*day/i.test(text) || /1\s*month/i.test(text))) return true;
                if (/15\s*day|2\s*week/i.test(userNotice) && (/15\s*day/i.test(text) || /2\s*week/i.test(text))) return true;
                if (/60\s*day|2\s*month/i.test(userNotice) && (/60\s*day/i.test(text) || /2\s*month/i.test(text))) return true;
                if (/90\s*day|3\s*month/i.test(userNotice) && (/90\s*day/i.test(text) || /3\s*month/i.test(text))) return true;
                return false;
            });
            if (opt) return typeof opt === 'string' ? opt : (opt.value || opt.label);
        }

        // 7. Demographics Decline Option (Fallback ONLY if gender not matched)
        if (/race|ethnic|disability|veteran/i.test(label) || (/\bgender\b/i.test(label) && !p.gender)) {
            const declineOpt = options.find(o => /decline|prefer\s*not|choose\s*not|do\s*not\s*wish/i.test(String(o.label || o.value || o).trim()));
            if (declineOpt) return typeof declineOpt === 'string' ? declineOpt : (declineOpt.value || declineOpt.label);
        }

        // 8. Check AI Memory for this question
        const memAnswer = this.findInMemory(label);
        if (memAnswer) {
            const mStr = String(memAnswer).toLowerCase().trim();
            const memOpt = options.find(o => {
                const optText = (typeof o === 'string' ? o : (o.label || o.value || '')).toLowerCase().trim();
                return optText === mStr || optText.includes(mStr) || mStr.includes(optText);
            });
            if (memOpt) return typeof memOpt === 'string' ? memOpt : (memOpt.value || memOpt.label);
        }

        return null;
    }

    /**
     * Synthesize a customized, professional answer using LLM
     */
    async synthesizeAnswer(fieldData, context) {
        const question = fieldData.label || fieldData.name || '';
        const jobTitle = context.jobTitle || 'Target Role';
        const company = context.company || 'the company';

        // Only proceed if LLM is actually available with valid configuration
        if (!this.llmClient || (!this.llmClient.geminiApiKey && !this.llmClient.groqApiKey && this.llmClient.provider !== 'window_ai')) {
            return null;
        }

        const systemPrompt = `You are a world-class professional career assistant. 
Generate a compelling, authentic, and concise answer (1-3 sentences) for a job application question.
Write in the first-person ("I"). Do NOT use placeholders, bracketed text, or quotes.
Respect character limits. Only output the exact text to be typed into the field.`;

        const userPrompt = `Job Application Context:
Role: ${jobTitle}
Company: ${company}

Candidate Information:
Name: ${this.profile.full_name || 'Candidate'}
Background: ${this.profile.current_title || 'Software Professional'} with ${this.profile.years_of_experience || 'experience'} in ${this.profile.skills || 'technology'}.
Notice Period: ${this.profile.notice_period || 'Immediately'}
Location: ${this.profile.city || ''}, ${this.profile.country || 'India'}
Resume Highlights: ${this.resumeText ? this.resumeText.slice(0, 1000) : ''}

Application Question:
"${question}"

Generate the direct answer:`;

        try {
            const result = await this.llmClient.complete(systemPrompt, userPrompt);
            if (result && result.trim().length > 0) {
                if (fieldData.maxLength && result.length > fieldData.maxLength) {
                    return result.slice(0, fieldData.maxLength - 3) + '...';
                }
                return result.trim();
            }
        } catch (err) {
            console.warn('[PersonalAgentBrain] LLM completion error:', err);
        }

        return null;
    }

    /**
     * Level 5: Semantic and LLM Profile Understanding
     * Matches any question to candidate's profile keys via semantic dictionary or LLM
     */
    async matchWithSemanticOrLLM(fieldData, cleanLabel, context) {
        const p = this.profile;
        if (!cleanLabel || cleanLabel.trim().length === 0) return null;

        // 1. Semantic Synonym Map (Zero API local fallback)
        const lowerQ = cleanLabel.toLowerCase();
        const isNonPersonNameQ = /\b(college|university|school|institution|company|employer|organization|org|project|manager|referrer|reference|user|file|first|last|middle|nick|preferred)\b/i.test(lowerQ);

        const semanticMap = [
            { keys: ['phone'], synonyms: ['phone', 'mobile', 'cell', 'contact', 'tele', 'call', 'whatsapp', 'reach'] },
            { keys: ['country_code'], synonyms: ['country code', 'dial code', 'calling code', 'phone prefix', 'isd code'] },
            { keys: ['email'], synonyms: ['email', 'mail', 'inbox'] },
            { keys: ['university'], synonyms: ['university', 'college', 'school', 'institution', 'campus'] },
            { keys: ['current_company'], synonyms: ['company', 'employer', 'organization', 'firm', 'workplace'] },
            ...(!isNonPersonNameQ ? [{ keys: ['full_name'], synonyms: ['full name', 'applicant name', 'candidate name', 'who are you', 'full legal name'] }] : []),
            { keys: ['city', 'street_address'], synonyms: ['city', 'location', 'reside', 'live', 'address', 'town', 'where do you live', 'based in', 'currently based'] },
            { keys: ['years_of_experience'], synonyms: ['experience', 'years', 'yoe', 'how long have you worked'] },
            { keys: ['current_title'], synonyms: ['title', 'role', 'designation', 'position', 'profession'] },
            { keys: ['notice_period'], synonyms: ['notice', 'available', 'start date', 'join', 'joining', 'how soon'] },
            { keys: ['expected_salary'], synonyms: ['salary', 'ctc', 'compensation', 'pay', 'remuneration', 'rate', 'budget'] },
            { keys: ['skills'], synonyms: ['skills', 'tools', 'tech', 'technologies', 'stack', 'languages', 'frameworks'] },
            { keys: ['gender'], synonyms: ['gender', 'sex'] },
            { keys: ['degree'], synonyms: ['degree', 'education', 'qualification', 'major', 'study'] },
            { keys: ['resume_url'], synonyms: ['resume', 'cv', 'curriculum vitae', 'profile link'] },
            { keys: ['linkedin'], synonyms: ['linkedin'] },
            { keys: ['github'], synonyms: ['github', 'git', 'repo'] },
            { keys: ['twitter'], synonyms: ['twitter', 'x', 'x.com', 'x profile', 'x (fka twitter)', 'twitter profile'] },
            { keys: ['portfolio'], synonyms: ['portfolio', 'website', 'site', 'blog'] },
            { keys: ['work_authorization'], synonyms: ['authorized', 'legally', 'eligibility', 'eligible'] },
            { keys: ['require_sponsorship'], synonyms: ['sponsorship', 'visa'] }
        ];

        for (const item of semanticMap) {
            for (const syn of item.synonyms) {
                if (new RegExp(`\\b${syn}\\b`, 'i').test(lowerQ)) {
                    for (const k of item.keys) {
                        if (p[k] && String(p[k]).trim() !== '') {
                            return { value: p[k], source: 'local_semantic_map' };
                        }
                    }
                }
            }
        }

        // 2. LLM Reasoning (Google Gemini 1.5 Flash / 2.0 Flash)
        if (this.llmClient && (this.llmClient.geminiApiKey || this.llmClient.groqApiKey || this.llmClient.provider === 'window_ai')) {
            try {
                let optionsPrompt = '';
                if (fieldData.options && fieldData.options.length > 0) {
                    const opts = fieldData.options.map(o => typeof o === 'string' ? o : (o.label || o.value)).filter(Boolean);
                    optionsPrompt = `\nOptions to choose from (Your response MUST be an exact match to one of these):\n${JSON.stringify(opts)}`;
                }

                const prompt = `Form Question: "${cleanLabel}"${optionsPrompt}

Candidate Knowledge Base:
- Name: ${p.full_name}
- Email: ${p.email}
- Phone: ${p.phone}
- Country Code: ${this.getCountryCode(true)}
- Location: ${p.city}, ${p.country}
- Current Company: ${p.current_company || 'None'}
- Past Employers / Work History: ${Array.from(this.knownCompanies || []).join(', ') || p.current_company || 'None'}
- Job Title: ${p.current_title}
- Total Experience: ${p.years_of_experience}
- Notice Period: ${p.notice_period}
- Earliest Joining Date: ${this.calculateEarliestStartDate('YYYY-MM-DD')}
- Gender: ${p.gender || 'Male'}
- Work Authorization in ${p.country}: Yes
- Target Company Applying To: ${context?.company || 'Unknown'}

Reasoning Rules:
1. If the question asks if the candidate is an ex-employee / former employee / previously worked for ${context?.company || 'this company'}, and the company is NOT in Past Employers, answer "No".
2. If the question asks if the candidate is authorized or eligible to work in ${p.country || 'India'}, answer "Yes".
3. If the question asks for earliest start date or joining date, provide ${this.calculateEarliestStartDate('YYYY-MM-DD')}.
4. If options are listed above, pick the single option that matches best and return ONLY that option string.
5. If open-ended text question, write a concise 1-2 sentence professional first-person response.
6. If impossible to answer, reply UNKNOWN.`;

                const res = await this.llmClient.complete(
                    'You are an intelligent form reasoning agent. Output ONLY the raw answer string with no quotes, markdown, or explanations.',
                    prompt
                );
                if (res && res.trim() && !res.includes('UNKNOWN') && res.trim().length > 0) {
                    return { value: res.trim(), source: 'llm_semantic_understanding' };
                }
            } catch (err) {
                console.warn('[PersonalAgentBrain] LLM semantic error:', err);
            }
        }

        return null;
    }

    isComplexQuestion(label) {
        return /why|describe|explain|tell\s*us|summary|cover\s*letter|project|challenge|interest|experience/i.test(label);
    }

    /**
     * Look up previous answers in memory, protected against generic boilerplate false positives
     */
    findInMemory(rawLabel) {
        if (!this.aiMemory || !this.aiMemory.length) return null;
        const cleanQ = this.cleanQuestionLabel(rawLabel).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        if (!cleanQ || cleanQ.length < 3) return null;

        const stopWords = new Set([
            'what', 'is', 'your', 'the', 'for', 'you', 'are', 'in', 'to', 'of', 'and', 'a', 'an',
            'please', 'enter', 'below', 'above', 'here', 'provide', 'give', 'indicate', 'type',
            'text', 'single', 'line', 'answer', 'required', 'question'
        ]);
        const contentWords = cleanQ.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
        if (contentWords.length === 0) return null;

        // 1. Exact cleaned match
        for (const item of this.aiMemory) {
            if (!item || !item.answer) continue;
            const itemClean = this.cleanQuestionLabel(item.question || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
            if (!itemClean || itemClean.length < 3) continue;
            if (itemClean === cleanQ) {
                return item.answer;
            }
        }

        // 2. High-confidence word-boundary Jaccard match (>= 0.85 similarity, never substring-matching short words)
        if (contentWords.length >= 2) {
            const querySet = new Set(contentWords);
            for (const item of this.aiMemory) {
                if (!item || !item.answer) continue;
                const itemClean = this.cleanQuestionLabel(item.question || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
                const itemWords = itemClean.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
                if (itemWords.length === 0) continue;
                const itemSet = new Set(itemWords);
                const common = [...querySet].filter(w => itemSet.has(w)).length;
                const jaccard = common / Math.max(querySet.size, itemSet.size);
                if (jaccard >= 0.85) {
                    return item.answer;
                }
            }
        }

        return null;
    }

    /**
     * Map question text and field attributes to structured profile keys (both snake_case and camelCase)
     */
    extractSemanticProfileUpdates(question, answer, fieldData = {}) {
        if (!question || !answer) return {};
        const q = String(question).toLowerCase();
        const normAns = String(answer).trim();
        const updates = {};

        // 1. Names & Identity
        if (/first\s*name|given\s*name/i.test(q)) {
            updates.first_name = normAns;
            updates.firstName = normAns;
        } else if (/last\s*name|family\s*name|surname/i.test(q)) {
            updates.last_name = normAns;
            updates.lastName = normAns;
        } else if (/full\s*name|candidate\s*name|applicant\s*name|^name\b/i.test(q) && !/company|school|university|degree|middle/i.test(q)) {
            updates.full_name = normAns;
            const parts = normAns.split(/\s+/);
            if (parts.length > 1) {
                updates.first_name = parts[0];
                updates.firstName = parts[0];
                updates.last_name = parts.slice(1).join(' ');
                updates.lastName = parts.slice(1).join(' ');
            }
        }

        // 2. Contact Information
        if (/email/i.test(q) || fieldData.type === 'email') {
            updates.email = normAns;
        } else if (/phone|mobile|cell|contact\s*number|telephone/i.test(q) || fieldData.type === 'tel') {
            updates.phone = normAns;
        }

        // 3. Address & Location
        if (/\bcity\b/i.test(q)) {
            updates.city = normAns;
        } else if (/\bstate\b|province|region/i.test(q)) {
            updates.state = normAns;
        } else if (/\bcountry\b/i.test(q)) {
            updates.country = normAns;
        } else if (/zip|postal\s*code|pin\s*code/i.test(q)) {
            updates.zip = normAns;
            updates.pinCode = normAns;
        } else if (/street|address\s*line|current\s*address/i.test(q)) {
            updates.street_address = normAns;
            updates.address = normAns;
        }

        // 4. Online Presence & Portfolios
        if (/linkedin/i.test(q)) {
            updates.linkedin = normAns;
            updates.linkedIn = normAns;
        } else if (/github/i.test(q)) {
            updates.github = normAns;
        } else if (/portfolio|personal\s*website/i.test(q)) {
            updates.portfolio = normAns;
            updates.personalWebsite = normAns;
        } else if (/twitter|x\s*\(fka/i.test(q)) {
            updates.twitter = normAns;
        } else if (/website/i.test(q) && !updates.portfolio) {
            updates.portfolio = normAns;
            updates.personalWebsite = normAns;
        } else if (/resume|cv/i.test(q) && /(link|url)/i.test(q)) {
            updates.resume_url = normAns;
        }

        // 5. Employment, Experience & Compensation
        if (/current\s*(?:job\s*)?title|current\s*role/i.test(q)) {
            updates.current_title = normAns;
        } else if (/current\s*company|current\s*employer/i.test(q)) {
            updates.current_company = normAns;
            updates.currentCompany = normAns;
        } else if (/years\s*(?:of\s*)?experience|experience\s*level/i.test(q)) {
            updates.years_of_experience = normAns;
            updates.yearsExperience = normAns;
        } else if (/notice\s*period|availability|how\s*soon/i.test(q)) {
            updates.notice_period = normAns;
            updates.noticePeriod = normAns;
        } else if (/expected\s*salary|desired\s*salary|compensation|salary/i.test(q)) {
            updates.expected_salary = normAns;
            updates.expectedSalary = normAns;
        }

        // 6. Education
        if (/degree|highest\s*education|qualification/i.test(q)) {
            updates.degree = normAns;
        } else if (/university|college|institution|school/i.test(q)) {
            updates.university = normAns;
        } else if (/graduation\s*year|grad\s*year|year\s*of\s*passing/i.test(q)) {
            updates.graduation_year = normAns;
        } else if (/\bgpa\b|grade/i.test(q)) {
            updates.gpa = normAns;
        }

        // 7. Work Authorization & Legal
        if (/authorized\s*to\s*work|legal.*work|eligib/i.test(q)) {
            updates.work_authorization = normAns;
            updates.workAuthorization = normAns;
        } else if (/require\s*sponsorship|visa\s*sponsorship/i.test(q)) {
            updates.require_sponsorship = normAns;
            updates.sponsorshipRequired = /yes|true|require/i.test(normAns);
        }

        // 8. Demographics & EEO
        if (/gender/i.test(q)) {
            updates.gender = normAns;
        } else if (/race|ethnicity/i.test(q)) {
            updates.ethnicity = normAns;
        } else if (/veteran/i.test(q)) {
            updates.veteran_status = normAns;
        } else if (/disability/i.test(q)) {
            updates.disability_status = normAns;
        }

        // 9. Narrative Answers
        if (/tell\s*(?:me|us)\s*about\s*yourself|summary|bio|introduction/i.test(q)) {
            updates.answer_about_you = normAns;
            updates.aboutYou = normAns;
            updates.summary = normAns;
        } else if (/why\s*(?:do\s*you\s*want\s*to\s*work|join|interested\s*in)/i.test(q)) {
            updates.answer_why_company = normAns;
            updates.why_interested = normAns;
        } else if (/why\s*should\s*we\s*hire\s*you|key\s*strength/i.test(q)) {
            updates.answer_hire_you = normAns;
            updates.key_strength = normAns;
        }

        return updates;
    }

    /**
     * Store question-answer pairs and update structured profile in storage
     */
    saveToMemory(question, answer, fieldData = {}) {
        if (!question || !answer) return;
        const cleanQ = this.cleanQuestionLabel(question);
        const normAns = String(answer).trim();
        if (!this.isValidAnswerForField(normAns, cleanQ || question, fieldData)) {
            return;
        }

        // Check if question already exists in memory; update or push
        const existingIdx = this.aiMemory.findIndex(item => {
            if (!item) return false;
            const itemQ = this.cleanQuestionLabel(item.question || '');
            return itemQ.toLowerCase() === cleanQ.toLowerCase();
        });

        const entry = {
            question: cleanQ,
            rawQuestion: question,
            answer: normAns,
            timestamp: Date.now()
        };

        if (existingIdx >= 0) {
            this.aiMemory[existingIdx] = entry;
        } else {
            this.aiMemory.push(entry);
        }

        // Extract semantic key-value profile updates
        const updates = this.extractSemanticProfileUpdates(cleanQ || question, normAns, fieldData);
        if (Object.keys(updates).length > 0) {
            Object.assign(this.profile, updates);
            console.log(`[PersonalAgentBrain] 💾 Learned structured attributes from user:`, updates);
        }

        // Continuously update User Context Graph
        if (this.contextGraphEngine) {
            this.contextGraphEngine.recordQA(cleanQ || question, normAns, fieldData?.intent || fieldData?.semanticIntent?.intent, {
                fieldId: fieldData?.id,
                source: 'user_learning'
            });
        }

        // Immediately update memory cache
        this.answerCache.set(cleanQ.toLowerCase().trim(), normAns);
        if (question) this.answerCache.set(question.toLowerCase().trim(), normAns);

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['userProfile', 'autofillProfile', 'profile', 'qa_cache'], (res) => {
                const userProf = Object.assign({}, res.userProfile || {}, updates);
                const autofillProf = Object.assign({}, res.autofillProfile || {}, updates);
                const plainProf = Object.assign({}, res.profile || {}, updates);
                const qaCache = Object.assign({}, res.qa_cache || {});
                qaCache[cleanQ.toLowerCase().trim()] = normAns;
                if (question && question.toLowerCase().trim() !== cleanQ.toLowerCase().trim()) {
                    qaCache[question.toLowerCase().trim()] = normAns;
                }

                chrome.storage.local.set({
                    ai_memory: this.aiMemory,
                    aiAnswers: this.aiMemory,
                    aiAnswerMemory: this.aiMemory,
                    qa_cache: qaCache,
                    userProfile: userProf,
                    autofillProfile: autofillProf,
                    profile: plainProf
                }, () => {
                    console.log(`[PersonalAgentBrain] ✅ Permanently persisted Q&A, cache (${Object.keys(qaCache).length} items), and profile updates to storage.`);
                });
            });

            if (chrome.storage.sync) {
                chrome.storage.sync.get(['userProfile', 'autofillProfile'], (res) => {
                    if (!chrome.runtime || !chrome.runtime.lastError) {
                        const userProf = Object.assign({}, res?.userProfile || {}, updates);
                        const autofillProf = Object.assign({}, res?.autofillProfile || {}, updates);
                        chrome.storage.sync.set({
                            userProfile: userProf,
                            autofillProfile: autofillProf
                        });
                    }
                });
            }

            // Sync to backend database if user is logged in
            if (this.authToken && typeof DataSyncManager !== 'undefined' && typeof DataSyncManager.syncSaveAnswer === 'function') {
                DataSyncManager.syncSaveAnswer(this.authToken, {
                    question_type: cleanQ.slice(0, 50),
                    context: { question: cleanQ },
                    response_content: normAns
                }).catch(err => console.warn('[PersonalAgentBrain] Backend sync answer failed:', err));
            }
        }
    }

    /**
     * Record a completed application form snapshot into the User Context Graph
     */
    async recordFormApplication(formRecord) {
        if (this.contextGraphEngine) {
            return await this.contextGraphEngine.recordFormSubmission(formRecord);
        }
        return null;
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.PersonalAgentBrain = PersonalAgentBrain;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonalAgentBrain;
}
