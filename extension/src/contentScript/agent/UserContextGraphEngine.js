/**
 * User Context Graph Engine
 * Builds, evolves, and maintains an enterprise-grade Knowledge & Context Graph for candidate data.
 * Inspired by modern enterprise contextual engines (e.g. Palantir / Notion Knowledge Graphs).
 * 
 * Features:
 * - Dynamic Identity, Professional Background, Skills, and Education nodes.
 * - Bidirectional Semantic Q&A resolution graph with continuous learning.
 * - Comprehensive Application Form History: tracks URL, profile name, company name, job role, and full snapshot of every filled field.
 * - Persistent storage across chrome.storage.local and synchronizes with Supabase / PostgreSQL backend.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.UserContextGraphEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {

    class UserContextGraphEngine {
        constructor(userId = null) {
            this.userId = userId || 'default_user';
            this.profileName = '';
            this.storageKey = 'ats_user_context_graph';
            this.defaultBackendUrl = 'http://localhost:3000/api';
            this.graph = this.createEmptyGraph();
            this.isInitialized = false;
        }

        /**
         * Schema structure for an empty Context Graph
         */
        createEmptyGraph() {
            return {
                meta: {
                    version: '2.0.0',
                    userId: this.userId,
                    profileName: this.profileName || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                nodes: {
                    identity: {
                        fullName: '',
                        firstName: '',
                        lastName: '',
                        preferredName: '',
                        email: '',
                        phone: '',
                        address: {
                            street: '',
                            city: '',
                            state: '',
                            zip: '',
                            country: 'United States'
                        },
                        socials: {
                            linkedin: '',
                            github: '',
                            portfolio: '',
                            website: '',
                            twitter: ''
                        }
                    },
                    professional: {
                        currentTitle: '',
                        currentCompany: '',
                        yearsOfExperience: '',
                        noticePeriod: 'Immediately',
                        expectedSalary: '',
                        workAuthorization: 'Yes',
                        sponsorshipRequired: 'No',
                        willingToRelocate: 'Yes',
                        preferredLocation: 'Remote'
                    },
                    skills: {
                        languages: [],
                        frameworks: [],
                        databases: [],
                        cloud: [],
                        tools: [],
                        all: []
                    },
                    education: [],
                    experience: [],
                    qaGraph: []
                },
                applicationHistory: []
            };
        }

        /**
         * Initialize the Context Graph
         * Loads from local storage, merges seedProfile and memory, and kicks off async remote sync
         */
        async init(seedProfile = {}, seedMemory = []) {
            try {
                // 1. Load cached graph from local storage
                const localData = await new Promise(resolve => {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        chrome.storage.local.get([this.storageKey, 'token', 'authToken', 'extensionToken', 'apiUrl'], resolve);
                    } else {
                        resolve({});
                    }
                });

                if (localData[this.storageKey]) {
                    this.graph = this.deepMergeGraph(this.graph, localData[this.storageKey]);
                }

                // 2. Ingest seed profile if available
                if (seedProfile && Object.keys(seedProfile).length > 0) {
                    this.updateFromProfile(seedProfile);
                }

                // 3. Ingest seed memory items
                if (Array.isArray(seedMemory) && seedMemory.length > 0) {
                    for (const item of seedMemory) {
                        const q = item.question || item.q || '';
                        const a = item.answer || item.a || '';
                        if (q && a) {
                            this.recordQA(q, a, null, { source: 'seed' });
                        }
                    }
                }

                this.isInitialized = true;
                console.log('[UserContextGraph] 🌐 Context Graph initialized for user:', this.graph.meta.profileName || this.userId);

                // 4. Fire-and-forget background sync with remote backend if token exists
                const token = localData.token || localData.authToken || localData.extensionToken;
                if (token) {
                    this.syncWithBackend(token).catch(err => {
                        console.warn('[UserContextGraph] Background backend sync notice:', err.message);
                    });
                }

                return this.graph;
            } catch (error) {
                console.error('[UserContextGraph] ❌ Initialization error:', error);
                this.isInitialized = true;
                return this.graph;
            }
        }

        /**
         * Update identity and professional nodes from a raw profile object
         */
        updateFromProfile(profile = {}) {
            if (!profile) return;
            const ident = this.graph.nodes.identity;
            const prof = this.graph.nodes.professional;

            // Identity
            if (profile.full_name || profile.fullName || profile.name) {
                ident.fullName = (profile.full_name || profile.fullName || profile.name || '').trim();
                this.graph.meta.profileName = ident.fullName;
                this.profileName = ident.fullName;
            }
            if (profile.first_name || profile.firstName) {
                ident.firstName = (profile.first_name || profile.firstName || '').trim();
            }
            if (profile.last_name || profile.lastName) {
                ident.lastName = (profile.last_name || profile.lastName || '').trim();
            }
            if (profile.email || profile.userEmail) {
                ident.email = (profile.email || profile.userEmail || '').trim();
            }
            if (profile.phone || profile.phoneNumber) {
                ident.phone = (profile.phone || profile.phoneNumber || '').trim();
            }

            // Location
            ident.address.city = profile.city || ident.address.city || '';
            ident.address.state = profile.state || ident.address.state || '';
            ident.address.zip = profile.zip || profile.postal_code || ident.address.zip || '';
            ident.address.country = profile.country || ident.address.country || 'United States';
            ident.address.street = profile.street_address || profile.address || ident.address.street || '';

            // Links
            ident.socials.linkedin = profile.linkedin || profile.linkedIn || ident.socials.linkedin || '';
            ident.socials.github = profile.github || profile.gitHub || ident.socials.github || '';
            ident.socials.portfolio = profile.portfolio || profile.website || ident.socials.portfolio || '';

            // Professional
            prof.currentTitle = profile.current_title || profile.currentJobTitle || profile.role || prof.currentTitle || '';
            prof.currentCompany = profile.current_company || profile.company || prof.currentCompany || '';
            prof.yearsOfExperience = profile.years_of_experience || profile.experience || prof.yearsOfExperience || '';
            prof.noticePeriod = profile.notice_period || profile.noticePeriod || prof.noticePeriod || 'Immediately';
            prof.expectedSalary = profile.expected_salary || profile.salary || prof.expectedSalary || '';
            prof.workAuthorization = profile.work_authorization || prof.workAuthorization || 'Yes';
            prof.sponsorshipRequired = profile.require_sponsorship || prof.sponsorshipRequired || 'No';

            // Skills
            if (profile.skills) {
                const rawSkills = Array.isArray(profile.skills) ? profile.skills : String(profile.skills).split(/[,;|\n]+/);
                this.addSkills(rawSkills);
            }

            this.touch();
            this.persistLocally();
        }

        /**
         * Add or update skills in the ontology graph
         */
        addSkills(skillsList = []) {
            const allSet = new Set(this.graph.nodes.skills.all.map(s => s.toLowerCase()));
            for (let s of skillsList) {
                s = String(s).trim();
                if (s && !allSet.has(s.toLowerCase())) {
                    this.graph.nodes.skills.all.push(s);
                    allSet.add(s.toLowerCase());
                }
            }
            this.touch();
        }

        /**
         * Record or reinforce a Question-Answer node in the semantic graph
         */
        recordQA(question, answer, canonicalIntent = null, metadata = {}) {
            if (!question || !answer) return;
            const cleanQ = this.normalizeText(question);
            const cleanAns = String(answer).trim();

            const existing = this.graph.nodes.qaGraph.find(node => {
                return this.normalizeText(node.question) === cleanQ ||
                       (canonicalIntent && node.canonicalIntent === canonicalIntent);
            });

            if (existing) {
                existing.answer = cleanAns;
                existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
                existing.lastUsed = new Date().toISOString();
                if (canonicalIntent) existing.canonicalIntent = canonicalIntent;
                Object.assign(existing, metadata);
            } else {
                this.graph.nodes.qaGraph.push({
                    id: 'qa_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    canonicalIntent: canonicalIntent || this.inferIntent(question),
                    question: question.trim(),
                    answer: cleanAns,
                    confidence: metadata.confidence || 0.95,
                    occurrenceCount: 1,
                    source: metadata.source || 'user_interaction',
                    lastUsed: new Date().toISOString()
                });
            }

            this.touch();
            this.persistLocally();
        }

        /**
         * Query the Context Graph for the best matching answer
         */
        findBestAnswer(questionOrLabel, intent = null) {
            if (!questionOrLabel && !intent) return null;
            const cleanQ = this.normalizeText(questionOrLabel || '');

            // 1. Direct Intent Match from Q&A Graph
            if (intent) {
                const intentMatch = this.graph.nodes.qaGraph.find(n => n.canonicalIntent === intent);
                if (intentMatch) {
                    return { answer: intentMatch.answer, confidence: intentMatch.confidence || 0.9, source: 'qa_graph_intent' };
                }
            }

            // 2. Exact or Substring Question Match from Q&A Graph
            if (cleanQ) {
                const qTokens = cleanQ.split(/\s+/).filter(w => w.length > 2 && !/^(the|and|are|you|for|with|this|that|your|what|how)$/.test(w));
                let bestNode = null;
                let highestOverlap = 0;

                for (const node of this.graph.nodes.qaGraph) {
                    const nodeQ = this.normalizeText(node.question);
                    if (nodeQ === cleanQ || nodeQ.includes(cleanQ) || cleanQ.includes(nodeQ)) {
                        return { answer: node.answer, confidence: 0.95, source: 'qa_graph_exact_or_substring' };
                    }

                    // Semantic token overlap (Jaccard similarity)
                    const nodeTokens = new Set(nodeQ.split(/\s+/).filter(w => w.length > 2 && !/^(the|and|are|you|for|with|this|that|your|what|how)$/.test(w)));
                    if (qTokens.length > 0 && nodeTokens.size > 0) {
                        const common = qTokens.filter(t => nodeTokens.has(t));
                        const score = common.length / Math.max(qTokens.length, nodeTokens.size);
                        if (score > highestOverlap && score >= 0.3) {
                            highestOverlap = score;
                            bestNode = node;
                        }
                    }
                }

                if (bestNode && highestOverlap >= 0.3) {
                    return { answer: bestNode.answer, confidence: 0.85 + (highestOverlap * 0.1), source: 'qa_graph_semantic_overlap' };
                }
            }

            // 3. Identity and Professional Node Fallbacks
            const ident = this.graph.nodes.identity;
            const prof = this.graph.nodes.professional;

            if (intent === 'first_name' && ident.firstName) return { answer: ident.firstName, confidence: 1.0, source: 'identity' };
            if (intent === 'last_name' && ident.lastName) return { answer: ident.lastName, confidence: 1.0, source: 'identity' };
            if (intent === 'full_name' && ident.fullName) return { answer: ident.fullName, confidence: 1.0, source: 'identity' };
            if (intent === 'email' && ident.email) return { answer: ident.email, confidence: 1.0, source: 'identity' };
            if (intent === 'phone' && ident.phone) return { answer: ident.phone, confidence: 1.0, source: 'identity' };
            if (intent === 'city' && ident.address.city) return { answer: ident.address.city, confidence: 1.0, source: 'identity' };
            if (intent === 'state' && ident.address.state) return { answer: ident.address.state, confidence: 1.0, source: 'identity' };
            if (intent === 'zip' && ident.address.zip) return { answer: ident.address.zip, confidence: 1.0, source: 'identity' };
            if (intent === 'country' && ident.address.country) return { answer: ident.address.country, confidence: 1.0, source: 'identity' };
            if (intent === 'linkedin' && ident.socials.linkedin) return { answer: ident.socials.linkedin, confidence: 1.0, source: 'identity' };
            if (intent === 'github' && ident.socials.github) return { answer: ident.socials.github, confidence: 1.0, source: 'identity' };
            if (intent === 'portfolio' && ident.socials.portfolio) return { answer: ident.socials.portfolio, confidence: 1.0, source: 'identity' };

            if (intent === 'current_company' && prof.currentCompany) return { answer: prof.currentCompany, confidence: 1.0, source: 'professional' };
            if (intent === 'current_title' && prof.currentTitle) return { answer: prof.currentTitle, confidence: 1.0, source: 'professional' };
            if (intent === 'years_experience' && prof.yearsOfExperience) return { answer: prof.yearsOfExperience, confidence: 1.0, source: 'professional' };
            if (intent === 'notice_period' && prof.noticePeriod) return { answer: prof.noticePeriod, confidence: 1.0, source: 'professional' };
            if (intent === 'expected_salary' && prof.expectedSalary) return { answer: prof.expectedSalary, confidence: 1.0, source: 'professional' };
            if (intent === 'work_authorization' && prof.workAuthorization) return { answer: prof.workAuthorization, confidence: 1.0, source: 'professional' };

            // 4. Past Application Forms Match (check if same question was answered in recent applications)
            for (const app of this.graph.applicationHistory) {
                if (Array.isArray(app.formData)) {
                    for (const field of app.formData) {
                        if (field && field.value) {
                            if ((intent && field.intent === intent) || (cleanQ && this.normalizeText(field.label || '') === cleanQ)) {
                                return { answer: field.value, confidence: 0.85, source: 'application_history' };
                            }
                        }
                    }
                }
            }

            return null;
        }

        /**
         * Record a filled form submission with complete field snapshot into the Context Graph
         * Tracks URL, profile name, company name, role, and exact form data snapshot.
         */
        async recordFormSubmission(submissionData = {}) {
            try {
                const timestamp = new Date().toISOString();
                const record = {
                    id: 'form_app_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    timestamp: timestamp,
                    url: submissionData.url || (typeof window !== 'undefined' ? window.location.href : ''),
                    company: submissionData.company || 'Company',
                    jobTitle: submissionData.jobTitle || 'Software Engineer',
                    profileName: submissionData.profileName || this.graph.meta.profileName || 'Candidate',
                    platform: submissionData.platform || 'Custom ATS',
                    status: submissionData.status || 'applied',
                    fieldsCount: Array.isArray(submissionData.formData) ? submissionData.formData.length : 0,
                    formData: submissionData.formData || []
                };

                // Deduplicate application history by URL / timestamp
                const existingIdx = this.graph.applicationHistory.findIndex(h => h.url === record.url && h.company === record.company);
                if (existingIdx >= 0) {
                    this.graph.applicationHistory[existingIdx] = record;
                } else {
                    this.graph.applicationHistory.unshift(record);
                }

                // Keep up to 250 most recent form application records
                if (this.graph.applicationHistory.length > 250) {
                    this.graph.applicationHistory = this.graph.applicationHistory.slice(0, 250);
                }

                // Continuous Learning: Enrich Context Graph nodes from the filled fields
                if (Array.isArray(record.formData)) {
                    for (const field of record.formData) {
                        if (field && field.label && field.value) {
                            this.recordQA(field.label, field.value, field.intent, {
                                source: 'form_autofill',
                                company: record.company
                            });
                        }
                    }
                }

                this.touch();
                await this.persistLocally();
                console.log(`[UserContextGraph] 📑 Form submission tracked for "${record.company}" (${record.fieldsCount} fields).`);

                // Sync to backend Supabase / PostgreSQL API
                await this.syncApplicationToBackend(record);

                return record;
            } catch (error) {
                console.error('[UserContextGraph] ❌ Failed to record form submission:', error);
                return null;
            }
        }

        /**
         * Persist Context Graph snapshot to chrome.storage.local
         */
        async persistLocally() {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                try {
                    await new Promise(resolve => {
                        chrome.storage.local.set({ [this.storageKey]: this.graph }, resolve);
                    });
                } catch (e) {
                    console.warn('[UserContextGraph] Local storage persistence error:', e);
                }
            }
        }

        /**
         * Push form submission record directly to backend database
         */
        async syncApplicationToBackend(record) {
            try {
                const token = await this.getStoredToken();
                if (!token || typeof fetch === 'undefined') return;

                const apiUrl = await this.getApiUrl();
                
                // 1. Post to /api/context-graph/record-form
                fetch(`${apiUrl}/context-graph/record-form`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(record)
                }).catch(err => console.warn('[UserContextGraph] Sync /context-graph/record-form skipped:', err.message));

                // 2. Post to standard /api/applications with full formData
                fetch(`${apiUrl}/applications`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        jobTitle: record.jobTitle,
                        company: record.company,
                        jobUrl: record.url,
                        status: record.status || 'applied',
                        profileName: record.profileName,
                        platform: record.platform,
                        formData: record.formData,
                        notes: `Filled ${record.fieldsCount} fields via Autonomous Agent`
                    })
                }).catch(err => console.warn('[UserContextGraph] Sync /api/applications skipped:', err.message));

            } catch (err) {
                console.warn('[UserContextGraph] Backend application sync notice:', err.message);
            }
        }

        /**
         * Synchronize entire Context Graph with backend database
         */
        async syncWithBackend(token = null) {
            try {
                const authToken = token || await this.getStoredToken();
                if (!authToken || typeof fetch === 'undefined') return;

                const apiUrl = await this.getApiUrl();

                // 1. Send our current local graph to backend
                const postRes = await fetch(`${apiUrl}/context-graph`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        profileName: this.graph.meta.profileName,
                        graph: this.graph
                    })
                });

                if (postRes.ok) {
                    const postData = await postRes.json();
                    if (postData && postData.graph) {
                        this.graph = this.deepMergeGraph(this.graph, postData.graph);
                        this.persistLocally();
                        console.log('[UserContextGraph] ✅ Context Graph synced with database.');
                    }
                }
            } catch (e) {
                console.warn('[UserContextGraph] Backend sync skipped:', e.message);
            }
        }

        /**
         * Helper to get stored auth token
         */
        async getStoredToken() {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
            return new Promise(resolve => {
                chrome.storage.local.get(['token', 'authToken', 'extensionToken', 'jobOrbitSession'], res => {
                    const sessionToken = res.jobOrbitSession?.token || res.jobOrbitSession?.session?.access_token;
                    resolve(sessionToken || res.token || res.authToken || res.extensionToken || null);
                });
            });
        }

        /**
         * Helper to get backend base API URL
         */
        async getApiUrl() {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return this.defaultBackendUrl;
            return new Promise(resolve => {
                chrome.storage.local.get(['apiUrl', 'backendUrl'], res => {
                    resolve(res.apiUrl || res.backendUrl || this.defaultBackendUrl);
                });
            });
        }

        /**
         * Helper to update timestamp
         */
        touch() {
            this.graph.meta.updatedAt = new Date().toISOString();
        }

        /**
         * Normalizes a string for comparison
         */
        normalizeText(str) {
            return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        /**
         * Infers canonical intent from label
         */
        inferIntent(label) {
            const norm = this.normalizeText(label);
            if (/first\s*name/i.test(norm)) return 'first_name';
            if (/last\s*name/i.test(norm)) return 'last_name';
            if (/full\s*name|candidate\s*name/i.test(norm)) return 'full_name';
            if (/email/i.test(norm)) return 'email';
            if (/phone|mobile/i.test(norm)) return 'phone';
            if (/linkedin/i.test(norm)) return 'linkedin';
            if (/github/i.test(norm)) return 'github';
            if (/portfolio|website/i.test(norm)) return 'portfolio';
            if (/salary|compensation/i.test(norm)) return 'expected_salary';
            if (/notice|availability/i.test(norm)) return 'notice_period';
            if (/sponsor/i.test(norm)) return 'require_sponsorship';
            if (/authorized|legal/i.test(norm)) return 'work_authorization';
            if (/why\s*(?:do\s*you\s*want|company|join|work\s*here)/i.test(norm)) return 'why_company';
            if (/about\s*yourself|tell\s*me\s*about/i.test(norm)) return 'about_you';
            return 'custom_question';
        }

        /**
         * Merges two graphs intelligently
         */
        deepMergeGraph(localGraph, remoteGraph) {
            if (!remoteGraph) return localGraph;
            const merged = JSON.parse(JSON.stringify(localGraph));

            if (remoteGraph.meta) {
                merged.meta.profileName = remoteGraph.meta.profileName || merged.meta.profileName;
            }

            if (remoteGraph.nodes) {
                // Identity
                if (remoteGraph.nodes.identity) {
                    Object.assign(merged.nodes.identity, remoteGraph.nodes.identity);
                    if (remoteGraph.nodes.identity.address) {
                        Object.assign(merged.nodes.identity.address, remoteGraph.nodes.identity.address);
                    }
                    if (remoteGraph.nodes.identity.socials) {
                        Object.assign(merged.nodes.identity.socials, remoteGraph.nodes.identity.socials);
                    }
                }
                // Professional
                if (remoteGraph.nodes.professional) {
                    Object.assign(merged.nodes.professional, remoteGraph.nodes.professional);
                }
                // Skills
                if (remoteGraph.nodes.skills && Array.isArray(remoteGraph.nodes.skills.all)) {
                    const set = new Set(merged.nodes.skills.all.map(s => s.toLowerCase()));
                    for (const s of remoteGraph.nodes.skills.all) {
                        if (!set.has(s.toLowerCase())) {
                            merged.nodes.skills.all.push(s);
                            set.add(s.toLowerCase());
                        }
                    }
                }
                // QA Graph
                if (Array.isArray(remoteGraph.nodes.qaGraph)) {
                    const qaMap = new Map();
                    for (const q of merged.nodes.qaGraph) qaMap.set(q.canonicalIntent || q.question, q);
                    for (const q of remoteGraph.nodes.qaGraph) {
                        const key = q.canonicalIntent || q.question;
                        if (!qaMap.has(key)) {
                            merged.nodes.qaGraph.push(q);
                        }
                    }
                }
            }

            // Application History
            if (Array.isArray(remoteGraph.applicationHistory)) {
                const appUrls = new Set(merged.applicationHistory.map(a => a.url + a.timestamp));
                for (const app of remoteGraph.applicationHistory) {
                    if (!appUrls.has(app.url + app.timestamp)) {
                        merged.applicationHistory.push(app);
                        appUrls.add(app.url + app.timestamp);
                    }
                }
            }

            return merged;
        }
    }

    return UserContextGraphEngine;
}));
