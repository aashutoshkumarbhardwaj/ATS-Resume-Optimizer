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
                'ai_memory', 'aiAnswers', 'activePersona', 'personas',
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

            const pickVal = (...keys) => {
                for (const src of profileSources) {
                    for (const k of keys) {
                        if (src && src[k] !== undefined && src[k] !== null && String(src[k]).trim() !== '') {
                            return String(src[k]).trim();
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
                const liMatch = this.resumeText.match(/linkedin\.com\/in\/[\w.-]+/i);
                if (liMatch) this.profile.linkedin = `https://${liMatch[0]}`;
            }
            if (!this.profile.github && this.resumeText) {
                const ghMatch = this.resumeText.match(/github\.com\/[\w.-]+/i);
                if (ghMatch) this.profile.github = `https://${ghMatch[0]}`;
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
                if (q && a) {
                    const normQ = q.toLowerCase();
                    if (!seenQuestions.has(normQ)) {
                        seenQuestions.add(normQ);
                        this.aiMemory.push({ question: q, answer: a });
                    }
                }
            }

            // Configure LLM Client with local and sync keys
            if (!this.llmClient) {
                const ClientClass = getFreeLLMClientClass();
                if (ClientClass) this.llmClient = new ClientClass();
            }

            const activeGeminiKey = localData.gemini_api_key || syncData.gemini_api_key || localData.geminiApiKey || syncData.geminiApiKey || '';
            const activeGroqKey = localData.groq_api_key || syncData.groq_api_key || localData.groqApiKey || syncData.groqApiKey || '';
            const activeProvider = localData.ai_agent_provider || syncData.ai_agent_provider || localData.llmProvider || syncData.llmProvider || 'gemini';

            if (this.llmClient) {
                this.llmClient.configure({
                    provider: activeProvider,
                    geminiApiKey: activeGeminiKey,
                    groqApiKey: activeGroqKey
                });
                console.log(`[PersonalAgentBrain] 🤖 LLM Client configured: provider=${activeProvider}, hasGeminiKey=${!!activeGeminiKey}, hasGroqKey=${!!activeGroqKey}`);
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
     * Resolve the best answer for any detected form field
     * Multi-tier resolution:
     * 1. Deterministic profile match from database
     * 2. Intelligent option/dropdown matcher
     * 3. AI Memory lookup from previous applications
     * 4. SmartAnswerEngine Client-Side RAG (zero API, uses real resume)
     * 5. Semantic Profile Matching & LLM Understanding
     * 6. Interactive Fallback ("if not able to find, ask me")
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
            if (cached && String(cached).trim() !== '') {
                return { value: cached, source: 'local_qa_cache' };
            }
        }

        // 1. Level 1: Deterministic Exact Match (from unified database/profile)
        const deterministicVal = this.getDeterministicValue(rawLabel, intent, fieldData);
        if (deterministicVal !== null && deterministicVal !== undefined && String(deterministicVal).trim() !== '') {
            if (cacheKey) this.answerCache.set(cacheKey, deterministicVal);
            return { value: deterministicVal, source: 'deterministic_profile' };
        }

        // 1.5. Level 1.5: Query Enterprise User Context Graph (tracks semantic nodes & past form answers)
        if (this.contextGraphEngine) {
            const graphMatch = this.contextGraphEngine.findBestAnswer(cleanLabel || rawLabel, intent);
            if (graphMatch && graphMatch.answer) {
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

        // 3. Level 3: Check AI Memory / Previously Answered Questions from DB (protected against boilerplate false positives)
        const memoryAnswer = this.findInMemory(cleanLabel || rawLabel);
        if (memoryAnswer) {
            if (cacheKey) this.answerCache.set(cacheKey, memoryAnswer);
            return { value: memoryAnswer, source: 'ai_memory' };
        }

        // 4. Level 4: SmartAnswerEngine Client-Side RAG (uses actual resume data)
        const SmartEngine = (typeof window !== 'undefined' && window.SmartAnswerEngine) || 
                            (typeof SmartAnswerEngine !== 'undefined' ? SmartAnswerEngine : null);
        if (SmartEngine && (fieldData.type === 'textarea' || this.isComplexQuestion(cleanLabel) || cleanLabel.includes('?'))) {
            try {
                const smartRes = SmartEngine.generate(cleanLabel, this.resumeData, this.profile);
                if (smartRes && smartRes.answer && smartRes.confidence >= 75) {
                    if (cacheKey) this.answerCache.set(cacheKey, smartRes.answer);
                    return { value: smartRes.answer, source: 'smart_answer_rag' };
                }
            } catch (err) {
                console.warn('[PersonalAgentBrain] SmartAnswerEngine error:', err);
            }
        }

        // 5. Level 5: Semantic Understanding & LLM Reasoning (User-requested LLM fallback)
        const semanticOrLLMAnswer = await this.matchWithSemanticOrLLM(fieldData, cleanLabel || rawLabel, context);
        if (semanticOrLLMAnswer && semanticOrLLMAnswer.value) {
            if (cacheKey) this.answerCache.set(cacheKey, semanticOrLLMAnswer.value);
            return semanticOrLLMAnswer;
        }

        // 6. Level 6: Interactive Fallback ("if not able to find, ask me")
        // The user specifically requested: if not in database, ask the user what to do!
        if (context.virtualCursor && typeof context.virtualCursor.askUser === 'function') {
            const displayQuestion = cleanLabel || rawLabel || 'Please provide an answer for this field:';
            console.log(`[PersonalAgentBrain] ❓ Asking user for unknown field: "${displayQuestion}"`);
            const optionsList = (fieldData.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value)).slice(0, 5);
            const userChoice = await context.virtualCursor.askUser(
                displayQuestion,
                optionsList
            );

            if (userChoice && String(userChoice).trim() !== '') {
                // Save to memory with CLEAN question so future applications match accurately!
                this.saveToMemory(displayQuestion, userChoice.trim());
                return { value: userChoice.trim(), source: 'user_interactive' };
            }
        }

        return { value: null, source: 'unresolved' };
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

        // --- 1. Names ---
        if (intent === 'first_name' || /first\s*name|given\s*name|forename|fname/i.test(cleanLabel)) {
            return p.first_name || (p.full_name ? p.full_name.split(' ')[0] : null);
        }
        if (intent === 'last_name' || /last\s*name|surname|family\s*name|lname/i.test(cleanLabel)) {
            return p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : null);
        }
        if (
            intent === 'full_name' ||
            /full\s*name|candidate\s*name|applicant\s*name|your\s*name|legal\s*name/i.test(cleanLabel) ||
            (/\bname\b/i.test(cleanLabel) && !/first|last|middle|company|school|user|file|org|sur/i.test(cleanLabel)) ||
            /full\s*name|candidate\s*name|your\s*name|\bname\b/i.test(placeholder)
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
            return p.city || null;
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
            return p.linkedin || null;
        }
        if (intent === 'github' || /github/i.test(cleanLabel)) {
            return p.github || null;
        }
        if (intent === 'portfolio' || /portfolio|personal\s*website|website|blog|personal\s*site/i.test(cleanLabel)) {
            return p.portfolio || p.github || null;
        }
        if (inputType === 'url' || placeholder.includes('url') || placeholder.includes('link') || placeholder.includes('http')) {
            if (/resume/i.test(cleanLabel)) return p.resume_url || p.portfolio || p.linkedin;
            if (/github/i.test(cleanLabel)) return p.github;
            if (/linkedin/i.test(cleanLabel)) return p.linkedin;
            if (/portfolio|website/i.test(cleanLabel)) return p.portfolio;
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
        if (/years?\s*of\s*experience|total\s*experience|experience\s*(?:in\s*years)?|how\s*many\s*years|yoe|overall\s*experience/i.test(cleanLabel)) {
            return p.years_of_experience || '3+';
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

        // --- 11. Education ---
        if (/degree|education|major|qualification|highest\s*degree/i.test(cleanLabel)) {
            return p.degree || null;
        }
        if (/university|college|school|institution|alma\s*mater/i.test(cleanLabel)) {
            return p.university || null;
        }
        if (/graduation\s*year|grad\s*year|passing\s*year|batch/i.test(cleanLabel)) {
            return p.graduation_year || null;
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
        const semanticMap = [
            { keys: ['phone'], synonyms: ['phone', 'mobile', 'cell', 'contact', 'tele', 'call', 'whatsapp', 'reach'] },
            { keys: ['country_code'], synonyms: ['country code', 'dial code', 'calling code', 'phone prefix', 'isd code'] },
            { keys: ['email'], synonyms: ['email', 'mail', 'inbox'] },
            { keys: ['full_name'], synonyms: ['name', 'applicant', 'candidate', 'who are you', 'full legal name'] },
            { keys: ['city', 'street_address'], synonyms: ['city', 'location', 'reside', 'live', 'address', 'town', 'where do you live', 'based in', 'currently based'] },
            { keys: ['years_of_experience'], synonyms: ['experience', 'years', 'yoe', 'how long have you worked'] },
            { keys: ['current_title'], synonyms: ['title', 'role', 'designation', 'position', 'profession'] },
            { keys: ['current_company'], synonyms: ['company', 'employer', 'organization', 'firm', 'workplace'] },
            { keys: ['notice_period'], synonyms: ['notice', 'available', 'start date', 'join', 'joining', 'how soon'] },
            { keys: ['expected_salary'], synonyms: ['salary', 'ctc', 'compensation', 'pay', 'remuneration', 'rate', 'budget'] },
            { keys: ['skills'], synonyms: ['skills', 'tools', 'tech', 'technologies', 'stack', 'languages', 'frameworks'] },
            { keys: ['gender'], synonyms: ['gender', 'sex'] },
            { keys: ['degree'], synonyms: ['degree', 'education', 'qualification', 'major', 'study'] },
            { keys: ['university'], synonyms: ['university', 'college', 'school', 'institution', 'campus'] },
            { keys: ['resume_url'], synonyms: ['resume', 'cv', 'curriculum vitae', 'profile link'] },
            { keys: ['linkedin'], synonyms: ['linkedin'] },
            { keys: ['github'], synonyms: ['github', 'git', 'repo'] },
            { keys: ['portfolio'], synonyms: ['portfolio', 'website', 'site', 'blog'] },
            { keys: ['work_authorization'], synonyms: ['authorized', 'legally', 'eligibility', 'eligible'] },
            { keys: ['require_sponsorship'], synonyms: ['sponsorship', 'visa'] }
        ];

        const lowerQ = cleanLabel.toLowerCase();
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

        // 2. High-confidence content keyword match (>80% overlap on non-stop words)
        if (contentWords.length >= 2) {
            for (const item of this.aiMemory) {
                if (!item || !item.answer) continue;
                const itemClean = this.cleanQuestionLabel(item.question || '').toLowerCase();
                const matchedCount = contentWords.filter(w => itemClean.includes(w)).length;
                if (matchedCount / contentWords.length >= 0.8) {
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

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['userProfile', 'autofillProfile', 'profile'], (res) => {
                const userProf = Object.assign({}, res.userProfile || {}, updates);
                const autofillProf = Object.assign({}, res.autofillProfile || {}, updates);
                const plainProf = Object.assign({}, res.profile || {}, updates);

                chrome.storage.local.set({
                    ai_memory: this.aiMemory,
                    aiAnswers: this.aiMemory,
                    aiAnswerMemory: this.aiMemory,
                    userProfile: userProf,
                    autofillProfile: autofillProf,
                    profile: plainProf
                }, () => {
                    console.log(`[PersonalAgentBrain] ✅ Permanently persisted Q&A and profile updates to storage.`);
                });
            });

            if (chrome.storage.sync) {
                chrome.storage.sync.get(['userProfile', 'autofillProfile'], (res) => {
                    if (!chrome.runtime.lastError) {
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
