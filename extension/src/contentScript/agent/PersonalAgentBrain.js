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
        this.isInitialized = false;
    }

    /**
     * Initialize profile data, memory, and LLM configuration
     * Aggregates data from ALL database, session, and local storage sources:
     * - jobOrbitSession (authoritative session from Job Orbit login)
     * - jobOrbitSyncData (synced profile, resumes, answers from backend DB)
     * - autofillProfile (extension popup profile)
     * - currentProfile, user_profile, candidate_profile
     * - parsedResume, uploadedResume, resume
     * - aiAnswers, ai_memory
     */
    async init() {
        try {
            // Step 1: Read all keys from local storage
            const localData = await new Promise(resolve => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(null, resolve);
                } else {
                    resolve({});
                }
            });

            // Step 2: Read sync storage (Job Orbit session or synced profiles)
            const syncData = await new Promise(resolve => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.get(null, resolve);
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
                
                // Contact
                email: pickVal('email', 'userEmail', 'user_email', 'contact_email'),
                phone: pickVal('phone', 'phoneNumber', 'phone_number', 'mobile', 'mobileNumber', 'mobile_number', 'contact', 'contactNumber', 'contact_number', 'mobilePhone', 'cellPhone', 'cell_phone', 'tel'),
                
                // Location
                city: pickVal('city', 'location', 'currentCity'),
                state: pickVal('state', 'province', 'region'),
                country: pickVal('country', 'currentCountry') || 'United States',
                zip: pickVal('zip', 'postal_code', 'postalCode', 'pinCode', 'pincode', 'zipCode'),
                street_address: pickVal('street_address', 'address', 'addressLine1', 'street'),
                
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

            // Configure LLM Client
            if (!this.llmClient) {
                const ClientClass = getFreeLLMClientClass();
                if (ClientClass) this.llmClient = new ClientClass();
            }

            if (this.llmClient) {
                this.llmClient.configure({
                    provider: localData.ai_agent_provider || 'gemini',
                    geminiApiKey: localData.gemini_api_key || '',
                    groqApiKey: localData.groq_api_key || ''
                });
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
                keysCount: Object.values(this.profile).filter(Boolean).length,
                memoryCount: this.aiMemory.length
            });
        } catch (e) {
            console.error('[PersonalAgentBrain] ❌ Initialization failed:', e);
            this.isInitialized = true;
        }
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

        // 1. Level 1: Deterministic Exact Match (from unified database/profile)
        const deterministicVal = this.getDeterministicValue(rawLabel, intent, fieldData);
        if (deterministicVal !== null && deterministicVal !== undefined && String(deterministicVal).trim() !== '') {
            return { value: deterministicVal, source: 'deterministic_profile' };
        }

        // 1.5. Level 1.5: Query Enterprise User Context Graph (tracks semantic nodes & past form answers)
        if (this.contextGraphEngine) {
            const graphMatch = this.contextGraphEngine.findBestAnswer(cleanLabel || rawLabel, intent);
            if (graphMatch && graphMatch.answer) {
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
            return { value: memoryAnswer, source: 'ai_memory' };
        }

        // 4. Level 4: SmartAnswerEngine Client-Side RAG (uses actual resume data)
        const SmartEngine = (typeof window !== 'undefined' && window.SmartAnswerEngine) || 
                            (typeof SmartAnswerEngine !== 'undefined' ? SmartAnswerEngine : null);
        if (SmartEngine && (fieldData.type === 'textarea' || this.isComplexQuestion(cleanLabel) || cleanLabel.includes('?'))) {
            try {
                const smartRes = SmartEngine.generate(cleanLabel, this.resumeData, this.profile);
                if (smartRes && smartRes.answer && smartRes.confidence >= 75) {
                    return { value: smartRes.answer, source: 'smart_answer_rag' };
                }
            } catch (err) {
                console.warn('[PersonalAgentBrain] SmartAnswerEngine error:', err);
            }
        }

        // 5. Level 5: Semantic Understanding & LLM Reasoning (User-requested LLM fallback)
        const semanticOrLLMAnswer = await this.matchWithSemanticOrLLM(fieldData, cleanLabel || rawLabel, context);
        if (semanticOrLLMAnswer && semanticOrLLMAnswer.value) {
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

        // --- 2. Contact: Email & Phone / Mobile (100% Synonyms) ---
        if (intent === 'email' || /e-?mail/i.test(cleanLabel) || /e-?mail/i.test(placeholder) || inputType === 'email') {
            return p.email || (this.resumeText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || null);
        }
        if (
            intent === 'phone' ||
            /phone|mobile|cell|contact|telephone|tel\b|phno|whatsapp/i.test(cleanLabel) ||
            /phone|mobile|cell|contact/i.test(placeholder) ||
            inputType === 'tel' ||
            /phone|mobile|contact/i.test(nameAttr) ||
            /phone|mobile|contact/i.test(idAttr)
        ) {
            return p.phone || (this.resumeText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || null);
        }

        // --- 3. Location & Address ---
        if (/street\s*address|address\s*line|residential\s*address|home\s*address|current\s*address|(?:^|\b)address\b/i.test(cleanLabel)) {
            return p.street_address || p.city || null;
        }
        if (/(?:^|\b)city\b|current\s*city|residing\s*city|town/i.test(cleanLabel)) {
            return p.city || null;
        }
        if (/country(?:\s*[\/\-]?\s*region)?|nationality/i.test(cleanLabel)) {
            return p.country || 'United States';
        }
        if (/(?:^|\b)state\b|province|\bregion\b|state\/province/i.test(cleanLabel)) {
            return p.state || null;
        }
        if (/postal|zip|pin\s*code|pincode|zipcode/i.test(cleanLabel)) {
            return p.zip || null;
        }

        // --- 4. Resume & Links ---
        // Specifically handles "Upload your Resume: Host your resume on an accessible link..."
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
        // Generic URL input where placeholder or type says URL
        if (inputType === 'url' || placeholder.includes('url') || placeholder.includes('link') || placeholder.includes('http')) {
            if (/resume/i.test(cleanLabel)) return p.resume_url || p.portfolio || p.linkedin;
            if (/github/i.test(cleanLabel)) return p.github;
            if (/linkedin/i.test(cleanLabel)) return p.linkedin;
            if (/portfolio|website/i.test(cleanLabel)) return p.portfolio;
            return p.portfolio || p.linkedin || p.github || p.resume_url || null;
        }

        // --- 5. Professional Experience ---
        if (/current\s*(?:job\s*)?title|current\s*role|job\s*title|designation|current\s*position|present\s*role|position\s*applied/i.test(cleanLabel)) {
            return p.current_title || null;
        }
        if (/current\s*company|current\s*employer|present\s*company|organization|company\s*name|employer/i.test(cleanLabel)) {
            return p.current_company || null;
        }
        if (/years?\s*of\s*experience|total\s*experience|experience\s*(?:in\s*years)?|how\s*many\s*years|yoe|overall\s*experience/i.test(cleanLabel)) {
            return p.years_of_experience || '3+';
        }
        if (/notice\s*period|availability|earliest\s*start|how\s*soon|joining\s*time|when\s*can\s*you\s*start/i.test(cleanLabel)) {
            return p.notice_period || 'Immediately';
        }
        if (/salary|compensation|expected\s*(?:pay|ctc)|desired\s*(?:salary|pay)|remuneration/i.test(cleanLabel)) {
            return p.expected_salary || null;
        }

        // --- 6. Skills ---
        if (/skills?|technical\s*skills?|core\s*competenc|technologies|tech\s*stack/i.test(cleanLabel)) {
            return p.skills || null;
        }

        // --- 7. Education ---
        if (/degree|education|major|qualification|highest\s*degree/i.test(cleanLabel)) {
            return p.degree || null;
        }
        if (/university|college|school|institution|alma\s*mater/i.test(cleanLabel)) {
            return p.university || null;
        }
        if (/graduation\s*year|grad\s*year|passing\s*year|batch/i.test(cleanLabel)) {
            return p.graduation_year || null;
        }

        // --- 8. Work Authorization ---
        if (/authorized\s*to\s*work|legal.*work|eligib/i.test(cleanLabel)) {
            return p.work_authorization || 'Yes';
        }
        if (/require.*sponsorship|sponsor.*visa/i.test(cleanLabel)) {
            return p.require_sponsorship || 'No';
        }

        // --- 9. Pre-filled Q&A Answers from Profile ---
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
    async matchOption(fieldData, context) {
        const options = fieldData.options;
        if (!options || options.length === 0) return null;
        const label = (fieldData.label || fieldData.name || '').toLowerCase();

        // 1. Check direct profile value match against option labels/values
        const profileVal = this.getDeterministicValue(label, fieldData.semanticIntent?.intent, fieldData);
        if (profileVal !== null && profileVal !== undefined && String(profileVal).trim() !== '') {
            const pStr = String(profileVal).toLowerCase().trim();
            const directOpt = options.find(o => {
                const optText = (typeof o === 'string' ? o : (o.label || o.value || '')).toLowerCase().trim();
                return optText === pStr || optText.includes(pStr) || pStr.includes(optText);
            });
            if (directOpt) return typeof directOpt === 'string' ? directOpt : (directOpt.value || directOpt.label);
        }

        // 2. Check work authorization patterns
        if (/authorized|legal.*work|eligib/i.test(label)) {
            const yesOpt = options.find(o => /^(yes|true|authorized|eligible)$/i.test(String(o.label || o.value || o).trim()));
            if (yesOpt) return typeof yesOpt === 'string' ? yesOpt : (yesOpt.value || yesOpt.label);
        }

        if (/require.*sponsor|sponsorship/i.test(label)) {
            const noOpt = options.find(o => /^(no|false|not\s*required|no\s*sponsorship)$/i.test(String(o.label || o.value || o).trim()));
            if (noOpt) return typeof noOpt === 'string' ? noOpt : (noOpt.value || noOpt.label);
        }

        // 3. Check notice period / availability
        if (/notice\s*period|availability|start\s*date/i.test(label)) {
            const immOpt = options.find(o => /immediate|less\s*than|15\s*days|now/i.test(String(o.label || o.value || o).trim()));
            if (immOpt) return typeof immOpt === 'string' ? immOpt : (immOpt.value || immOpt.label);
        }

        // 4. Check gender / ethnicity / disability default decline options if found
        if (/gender|race|ethnic|disability|veteran/i.test(label)) {
            const declineOpt = options.find(o => /decline|prefer\s*not|choose\s*not|do\s*not\s*wish/i.test(String(o.label || o.value || o).trim()));
            if (declineOpt) return typeof declineOpt === 'string' ? declineOpt : (declineOpt.value || declineOpt.label);
        }

        // 5. Check memory for this question
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
     * Returns NULL if no LLM is configured - NEVER returns a canned repeating sentence!
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
            { keys: ['email'], synonyms: ['email', 'mail', 'inbox'] },
            { keys: ['full_name'], synonyms: ['name', 'applicant', 'candidate', 'who are you', 'full legal name'] },
            { keys: ['city', 'street_address'], synonyms: ['city', 'location', 'reside', 'live', 'address', 'town', 'where do you live', 'based in', 'currently based'] },
            { keys: ['years_of_experience'], synonyms: ['experience', 'years', 'yoe', 'how long have you worked'] },
            { keys: ['current_title'], synonyms: ['title', 'role', 'designation', 'position', 'profession'] },
            { keys: ['current_company'], synonyms: ['company', 'employer', 'organization', 'firm', 'workplace'] },
            { keys: ['notice_period'], synonyms: ['notice', 'available', 'start date', 'join', 'joining', 'how soon'] },
            { keys: ['expected_salary'], synonyms: ['salary', 'ctc', 'compensation', 'pay', 'remuneration', 'rate', 'budget'] },
            { keys: ['skills'], synonyms: ['skills', 'tools', 'tech', 'technologies', 'stack', 'languages', 'frameworks'] },
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

        // 2. LLM Synthesis (if API key or window.ai available)
        if (this.llmClient && (this.llmClient.geminiApiKey || this.llmClient.groqApiKey || this.llmClient.provider === 'window_ai')) {
            try {
                const prompt = `Form Question: "${cleanLabel}"
Candidate Data:
${JSON.stringify({
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    current_title: p.current_title,
    current_company: p.current_company,
    years_of_experience: p.years_of_experience,
    skills: p.skills,
    location: `${p.city}, ${p.country}`,
    salary: p.expected_salary,
    notice: p.notice_period,
    linkedin: p.linkedin,
    portfolio: p.portfolio,
    resume_url: p.resume_url
}, null, 2)}

Provide the exact string answer to type into this field based ONLY on candidate data. If it's an open-ended question, write a concise 1-2 sentence professional first-person response. If impossible to answer, reply UNKNOWN.`;

                const res = await this.llmClient.complete(
                    'You are an intelligent form filler. Output ONLY the raw answer string with no quotes or explanations.',
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
