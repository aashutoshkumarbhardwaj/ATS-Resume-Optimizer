/**
 * Supabase Service
 * Handles database operations with Supabase
 */

let supabase = null;

/**
 * Get or initialize Supabase client (lazy loading)
 */
function getSupabaseClient() {
    if (!supabase) {
        const { createClient } = require('@supabase/supabase-js');
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            throw new Error('Supabase credentials missing. Ensure SUPABASE_URL and SUPABASE_SECRET_KEY are set in .env');
        }

        supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
            auth: {
                persistSession: false
            }
        });
    }
    return supabase;
}

/**
 * Initialize database tables
 */
async function initializeTables() {
    try {
        console.log('[Supabase] Initializing tables...');

        // Tables are typically created via Supabase UI or migrations
        // This function serves as a reference for table structure
        
        const tables = {
            profiles: {
                schema: `
                    CREATE TABLE IF NOT EXISTS profiles (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID NOT NULL,
                        email TEXT NOT NULL,
                        provider_id TEXT,
                        
                        -- Personal Info
                        full_name TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        phone TEXT,
                        city TEXT,
                        state TEXT,
                        zip TEXT,
                        country TEXT,
                        
                        -- Professional
                        current_title TEXT,
                        current_company TEXT,
                        years_of_experience TEXT,
                        notice_period TEXT,
                        expected_salary TEXT,
                        
                        -- Links
                        linkedin TEXT,
                        github TEXT,
                        portfolio TEXT,
                        
                        -- Resume & Skills
                        default_resume TEXT,
                        skills TEXT,
                        
                        -- Answers
                        answer_about_you TEXT,
                        answer_why_company TEXT,
                        answer_hire_you TEXT,
                        
                        -- Preferences
                        work_environment TEXT,
                        preferred_location TEXT,
                        work_authorization TEXT,
                        
                        -- Legacy fields
                        subscription_status TEXT DEFAULT 'free',
                        preferences JSONB DEFAULT '{}'::jsonb,
                        
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        deleted_at TIMESTAMP NULL,
                        UNIQUE(user_id),
                        UNIQUE(email)
                    );
                    CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
                    CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
                `
            },
            resumes: {
                schema: `
                    CREATE TABLE IF NOT EXISTS resumes (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        file_format TEXT DEFAULT 'text',
                        content TEXT,
                        content_hash TEXT,
                        ats_score INTEGER,
                        is_default BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        deleted_at TIMESTAMP NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON resumes(profile_id);
                    CREATE INDEX IF NOT EXISTS idx_resumes_updated_at ON resumes(profile_id, updated_at DESC);
                `
            },
            applications: {
                schema: `
                    CREATE TABLE IF NOT EXISTS applications (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                        job_title TEXT NOT NULL,
                        company TEXT NOT NULL,
                        job_url TEXT,
                        job_description TEXT,
                        location TEXT,
                        salary TEXT,
                        status TEXT DEFAULT 'applied',
                        resume_id UUID,
                        notes TEXT,
                        application_date TIMESTAMP DEFAULT NOW(),
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        deleted_at TIMESTAMP NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_applications_profile_id ON applications(profile_id);
                    CREATE INDEX IF NOT EXISTS idx_applications_date ON applications(profile_id, application_date DESC);
                    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(profile_id, status);
                `
            },
            ai_memory: {
                schema: `
                    CREATE TABLE IF NOT EXISTS ai_memory (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                        question_type TEXT NOT NULL,
                        context JSONB DEFAULT '{}'::jsonb,
                        response_content TEXT NOT NULL,
                        feedback_score INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        deleted_at TIMESTAMP NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_ai_memory_profile_id ON ai_memory(profile_id);
                    CREATE INDEX IF NOT EXISTS idx_ai_memory_created_at ON ai_memory(profile_id, created_at DESC);
                `
            },
            user_context_graphs: {
                schema: `
                    CREATE TABLE IF NOT EXISTS user_context_graphs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID NOT NULL,
                        profile_name TEXT,
                        graph_data JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        UNIQUE(user_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_user_context_graphs_user_id ON user_context_graphs(user_id);
                `
            }
        };

        console.log('[Supabase] Table schemas defined (create via Supabase UI or migrations)');
        return tables;
    } catch (error) {
        console.error('[Supabase] Initialization error:', error);
        throw error;
    }
}

/**
 * Get profile by user ID
 */
async function getProfile(userId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Get profile error:', error);
        throw error;
    }
}

/**
 * Create profile
 */
async function createProfile(userId, email, providerId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('profiles')
            .insert([
                {
                    user_id: userId,
                    email,
                    provider_id: providerId,
                    subscription_status: 'free',
                    preferences: {}
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Create profile error:', error);
        throw error;
    }
}

/**
 * Update profile
 */
async function updateProfile(userId, updates) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Update profile error:', error);
        throw error;
    }
}

/**
 * Get resumes
 */
async function getResumes(userId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('resumes')
            .select('*')
            .eq('profile_id', userId)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Get resumes error:', error);
        throw error;
    }
}

/**
 * Create resume
 */
async function createResume(profileId, title, content, fileFormat = 'text') {
    try {
        const crypto = require('crypto');
        const contentHash = crypto.createHash('md5').update(content).digest('hex');

        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('resumes')
            .insert([
                {
                    profile_id: profileId,
                    title,
                    content,
                    file_format: fileFormat,
                    content_hash: contentHash
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Create resume error:', error);
        throw error;
    }
}

/**
 * Update resume
 */
async function updateResume(resumeId, updates) {
    try {
        const sb = getSupabaseClient();
        const updateData = { ...updates, updated_at: new Date().toISOString() };

        // Update content hash if content changed
        if (updates.content) {
            const crypto = require('crypto');
            updateData.content_hash = crypto.createHash('md5')
                .update(updates.content)
                .digest('hex');
        }

        const { data, error } = await sb
            .from('resumes')
            .update(updateData)
            .eq('id', resumeId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Update resume error:', error);
        throw error;
    }
}

/**
 * Delete resume
 */
async function deleteResume(resumeId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('resumes')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', resumeId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Delete resume error:', error);
        throw error;
    }
}

/**
 * Get applications
 */
async function getApplications(userId, filters = {}) {
    try {
        const sb = getSupabaseClient();
        let query = sb
            .from('applications')
            .select('*')
            .eq('profile_id', userId)
            .is('deleted_at', null);

        // Apply filters
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.company) {
            query = query.ilike('company', `%${filters.company}%`);
        }
        if (filters.startDate) {
            query = query.gte('application_date', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('application_date', filters.endDate);
        }

        const { data, error } = await query.order('application_date', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Get applications error:', error);
        throw error;
    }
}

/**
 * Create application
 */
async function createApplication(profileId, applicationData, userId = null) {
    try {
        const sb = getSupabaseClient();
        let createdData = null;
        
        // 1. Try to insert into Job Orbit's "jobs" table for dashboard visibility
        if (userId) {
            try {
                const jd = applicationData.jobDescription || applicationData.job_description || '';
                const existingNotes = applicationData.notes || '';
                const rawFormData = applicationData.formData || applicationData.form_data;
                const formSummary = Array.isArray(rawFormData) && rawFormData.length > 0
                    ? ` | Form Snapshot (${rawFormData.length} fields): ` + rawFormData.map(f => `${f.label || f.id}: ${f.value}`).slice(0, 15).join('; ')
                    : '';
                const combinedNotes = existingNotes ? (jd ? `${existingNotes} | JD: ${jd}${formSummary}` : `${existingNotes}${formSummary}`) : (jd ? `JD: ${jd}${formSummary}` : formSummary.replace(/^ \| /, ''));

                const { data, error } = await sb.from('jobs').insert([{
                    user_id: userId,
                    role: applicationData.jobTitle || 'Unknown Position',
                    company: applicationData.company || 'Unknown Company',
                    url: applicationData.jobUrl || '',
                    location: applicationData.location || '',
                    salary: applicationData.salary || '',
                    status: applicationData.status || 'applied',
                    notes: combinedNotes,
                    applied_date: new Date().toISOString().split('T')[0]
                }]).select().single();
                
                if (error) throw error;
                createdData = data;
                console.log('[Supabase] Successfully synced to Job Orbit jobs table');
            } catch (jobErr) {
                console.warn('[Supabase] Could not sync to Job Orbit jobs table:', jobErr.message);
                throw jobErr; // We want the extension to know it failed so it retries later
            }
        }

        // 2. Try to insert into ATS Resume Optimizer's "applications" table (Legacy)
        try {
            const { data, error } = await sb
                .from('applications')
                .insert([
                    {
                        profile_id: profileId,
                        job_title: applicationData.jobTitle,
                        company: applicationData.company,
                        job_url: applicationData.jobUrl,
                        job_description: applicationData.jobDescription,
                        location: applicationData.location,
                        salary: applicationData.salary,
                        status: applicationData.status || 'applied',
                        resume_id: applicationData.resumeId,
                        notes: applicationData.notes,
                        application_date: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (!error && !createdData) {
                createdData = data;
            }
        } catch (appErr) {
            console.warn('[Supabase] Legacy applications table insert failed:', appErr.message);
        }

        return createdData || {};
    } catch (error) {
        console.error('[Supabase] Create application error:', error);
        throw error;
    }
}

/**
 * Update application
 */
async function updateApplication(applicationId, updates) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('applications')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', applicationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Update application error:', error);
        throw error;
    }
}

/**
 * Delete application
 */
async function deleteApplication(applicationId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('applications')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', applicationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Delete application error:', error);
        throw error;
    }
}

/**
 * Get AI memory entries
 */
async function getAIMemory(userId, filters = {}) {
    try {
        const sb = getSupabaseClient();
        let query = sb
            .from('ai_memory')
            .select('*')
            .eq('profile_id', userId)
            .is('deleted_at', null);

        if (filters.questionType) {
            query = query.eq('question_type', filters.questionType);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(filters.limit || 100)
            .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 100) - 1);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Get AI memory error:', error);
        throw error;
    }
}

/**
 * Create AI memory entry
 */
async function createAIMemory(userId, memoryData) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('ai_memory')
            .insert([
                {
                    profile_id: userId,
                    question_type: memoryData.questionType,
                    context: memoryData.context || {},
                    response_content: memoryData.responseContent,
                    feedback_score: 0
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Create AI memory error:', error);
        throw error;
    }
}

/**
 * Update AI memory entry
 */
async function updateAIMemory(memoryId, updates) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('ai_memory')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', memoryId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Update AI memory error:', error);
        throw error;
    }
}

/**
 * Get user context graph by user ID
 */
async function getContextGraph(userId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('user_context_graphs')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.warn('[Supabase] getContextGraph notice:', error.message);
        }
        if (data && data.graph_data) {
            return data.graph_data;
        }

        // If not in dedicated table, build dynamically from profile, resumes, applications, and ai_memory
        const profile = await getProfile(userId).catch(() => null);
        const applications = await getApplications(userId).catch(() => []);
        const aiMemory = await getAIMemory(userId).catch(() => []);

        return {
            meta: {
                version: '2.0.0',
                userId,
                profileName: profile?.full_name || '',
                updatedAt: new Date().toISOString()
            },
            nodes: {
                identity: {
                    fullName: profile?.full_name || '',
                    firstName: profile?.first_name || '',
                    lastName: profile?.last_name || '',
                    email: profile?.email || '',
                    phone: profile?.phone || '',
                    address: {
                        city: profile?.city || '',
                        state: profile?.state || '',
                        zip: profile?.zip || '',
                        country: profile?.country || 'United States',
                        street: profile?.street_address || ''
                    },
                    socials: {
                        linkedin: profile?.linkedin || '',
                        github: profile?.github || '',
                        portfolio: profile?.portfolio || ''
                    }
                },
                professional: {
                    currentTitle: profile?.current_title || '',
                    currentCompany: profile?.current_company || '',
                    yearsOfExperience: profile?.years_of_experience || '',
                    noticePeriod: profile?.notice_period || 'Immediately',
                    expectedSalary: profile?.expected_salary || '',
                    workAuthorization: profile?.work_authorization || 'Yes',
                    sponsorshipRequired: profile?.require_sponsorship || 'No'
                },
                skills: {
                    all: profile?.skills ? profile.skills.split(/[,;|\n]+/).map(s => s.trim()).filter(Boolean) : []
                },
                education: [],
                experience: [],
                qaGraph: (aiMemory || []).map(m => ({
                    canonicalIntent: m.question_type,
                    question: m.context?.question || m.question_type,
                    answer: m.response_content,
                    confidence: 0.95
                }))
            },
            applicationHistory: (applications || []).map(a => ({
                id: a.id,
                timestamp: a.application_date || a.created_at,
                url: a.job_url,
                company: a.company,
                jobTitle: a.job_title,
                status: a.status,
                formData: a.form_data || []
            }))
        };
    } catch (error) {
        console.error('[Supabase] Get Context Graph error:', error);
        throw error;
    }
}

/**
 * Save / upsert user context graph
 */
async function saveContextGraph(userId, profileName, graphData) {
    try {
        const sb = getSupabaseClient();
        const updatedAt = new Date().toISOString();

        // 1. Upsert into user_context_graphs table
        try {
            const { data, error } = await sb
                .from('user_context_graphs')
                .upsert([
                    {
                        user_id: userId,
                        profile_name: profileName || graphData?.meta?.profileName || 'Candidate',
                        graph_data: graphData,
                        updated_at: updatedAt
                    }
                ], { onConflict: 'user_id' })
                .select()
                .maybeSingle();

            if (!error && data) {
                console.log('[Supabase] ✅ Upserted user_context_graphs table successfully.');
            }
        } catch (e) {
            console.warn('[Supabase] Notice on user_context_graphs upsert:', e.message);
        }

        // 2. Synchronize extracted profile updates back to profiles table
        if (graphData?.nodes?.identity) {
            const ident = graphData.nodes.identity;
            const prof = graphData.nodes.professional || {};
            const profileUpdates = {};
            if (ident.fullName) profileUpdates.full_name = ident.fullName;
            if (ident.firstName) profileUpdates.first_name = ident.firstName;
            if (ident.lastName) profileUpdates.last_name = ident.lastName;
            if (ident.phone) profileUpdates.phone = ident.phone;
            if (ident.address?.city) profileUpdates.city = ident.address.city;
            if (ident.address?.state) profileUpdates.state = ident.address.state;
            if (ident.address?.zip) profileUpdates.zip = ident.address.zip;
            if (ident.address?.country) profileUpdates.country = ident.address.country;
            if (ident.socials?.linkedin) profileUpdates.linkedin = ident.socials.linkedin;
            if (ident.socials?.github) profileUpdates.github = ident.socials.github;
            if (ident.socials?.portfolio) profileUpdates.portfolio = ident.socials.portfolio;
            if (prof.currentTitle) profileUpdates.current_title = prof.currentTitle;
            if (prof.currentCompany) profileUpdates.current_company = prof.currentCompany;
            if (prof.expectedSalary) profileUpdates.expected_salary = prof.expectedSalary;
            if (prof.noticePeriod) profileUpdates.notice_period = prof.noticePeriod;
            if (prof.workAuthorization) profileUpdates.work_authorization = prof.workAuthorization;

            if (Object.keys(profileUpdates).length > 0) {
                await sb.from('profiles').update(profileUpdates).eq('user_id', userId).catch(() => {});
            }
        }

        return graphData;
    } catch (error) {
        console.error('[Supabase] Save Context Graph error:', error);
        throw error;
    }
}

/**
 * Record a single form application snapshot into user context graph
 */
async function recordFormApplication(userId, profileName, formRecord) {
    try {
        const currentGraph = await getContextGraph(userId);
        if (!currentGraph.applicationHistory) currentGraph.applicationHistory = [];

        currentGraph.applicationHistory.unshift({
            id: formRecord.id || ('form_app_' + Date.now()),
            timestamp: formRecord.timestamp || new Date().toISOString(),
            url: formRecord.url || formRecord.jobUrl || '',
            company: formRecord.company || 'Company',
            jobTitle: formRecord.jobTitle || 'Role',
            profileName: profileName || formRecord.profileName || currentGraph.meta?.profileName || 'Candidate',
            platform: formRecord.platform || 'ATS',
            status: formRecord.status || 'applied',
            formData: formRecord.formData || []
        });

        if (currentGraph.applicationHistory.length > 250) {
            currentGraph.applicationHistory = currentGraph.applicationHistory.slice(0, 250);
        }

        await saveContextGraph(userId, profileName, currentGraph);
        return currentGraph;
    } catch (err) {
        console.error('[Supabase] recordFormApplication error:', err);
        throw err;
    }
}

module.exports = {
    getSupabaseClient,
    initializeTables,
    getProfile,
    createProfile,
    updateProfile,
    getResumes,
    createResume,
    updateResume,
    deleteResume,
    getApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    getAIMemory,
    createAIMemory,
    updateAIMemory,
    getContextGraph,
    saveContextGraph,
    recordFormApplication
};
