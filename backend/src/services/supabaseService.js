/**
 * Supabase Service
 * Handles database operations with Supabase
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

/**
 * Get or initialize Supabase client (lazy loading)
 */
function getSupabaseClient() {
    if (!supabase) {
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
async function createApplication(profileId, applicationData) {
    try {
        const sb = getSupabaseClient();
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

        if (error) throw error;
        return data;
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
    updateAIMemory
};
