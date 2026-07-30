/**
 * Profile Routes
 * Handle user profile operations
 * Supports both Supabase and extension tokens
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest, requireAuth } = require('../middleware/auth');
const { verifyExtensionToken } = require('../utils/extensionJWT');
const supabaseService = require('../services/supabaseService');

/**
 * Helper: Extract user ID from either extension or Supabase token
 */
async function extractUserId(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing authorization header');
    }

    const token = authHeader.substring('Bearer '.length);

    // Try extension token first
    try {
        const verified = verifyExtensionToken(token);
        return verified.user_id;
    } catch (e) {
        // Fall through to Supabase
    }

    // Try Supabase via middleware
    if (req.user?.id) {
        return req.user.id;
    }

    throw new Error('Invalid token');
}

/**
 * Middleware: Authenticate extension or Supabase token
 */
const authenticateExtensionOrSupabase = async (req, res, next) => {
    try {
        await authenticateRequest(req, res, () => {
            // After authenticateRequest, try to extract user ID
            next();
        });
    } catch (error) {
        // Still proceed to handler to check extension token
        next();
    }
};

router.use(authenticateExtensionOrSupabase);

/**
 * GET /profile
 * Retrieve authenticated user's profile
 * Works with both extension and Supabase tokens
 */
router.get('/', async (req, res) => {
    try {
        let userId;
        try {
            userId = await extractUserId(req);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: ' + error.message,
                authenticated: false
            });
        }

        console.log('[Profile] GET profile for user:', userId);

        // Try to get existing profile
        let profile = await supabaseService.getProfile(userId);

        // If profile doesn't exist, create one
        if (!profile) {
            console.log('[Profile] Creating new profile for user:', userId);
            profile = await supabaseService.createProfile(
                userId,
                req.user?.email || 'unknown@example.com',
                req.user?.provider || 'extension'
            );
        }

        // Enrich profile with autofill fields if available
        const enrichedProfile = {
            ...profile,
            // Personal Info
            full_name: profile.full_name || null,
            first_name: profile.first_name || null,
            last_name: profile.last_name || null,
            email: profile.email || null,
            phone: profile.phone || null,
            city: profile.city || null,
            state: profile.state || null,
            zip: profile.zip || null,
            country: profile.country || null,

            // Professional
            current_title: profile.current_title || null,
            current_company: profile.current_company || null,
            years_of_experience: profile.years_of_experience || null,
            notice_period: profile.notice_period || null,
            expected_salary: profile.expected_salary || null,

            // Links
            linkedin: profile.linkedin || null,
            github: profile.github || null,
            portfolio: profile.portfolio || null,

            // Resume & Skills
            default_resume: profile.default_resume || null,
            skills: profile.skills || null,

            // Answers
            answer_about_you: profile.answer_about_you || null,
            answer_why_company: profile.answer_why_company || null,
            answer_hire_you: profile.answer_hire_you || null,

            // Preferences
            work_environment: profile.work_environment || null,
            preferred_location: profile.preferred_location || null,
            work_authorization: profile.work_authorization || null
        };

        res.json({
            success: true,
            profile: enrichedProfile
        });
    } catch (error) {
        console.error('[Profile] GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve profile'
        });
    }
});

/**
 * PATCH /profile
 * Update authenticated user's profile
 * Works with both extension and Supabase tokens
 * Accepts all 27 autofill fields
 */
router.patch('/', async (req, res) => {
    try {
        let userId;
        try {
            userId = await extractUserId(req);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: ' + error.message,
                authenticated: false
            });
        }

        console.log('[Profile] PATCH profile for user:', userId);
        console.log('[Profile] Updating fields:', Object.keys(req.body));

        // Define allowed fields for autofill profile
        const allowedFields = [
            // Personal
            'full_name', 'first_name', 'last_name', 'email', 'phone',
            'city', 'state', 'zip', 'country',

            // Professional
            'current_title', 'current_company', 'years_of_experience',
            'notice_period', 'expected_salary',

            // Links
            'linkedin', 'github', 'portfolio',

            // Resume & Skills
            'default_resume', 'skills',

            // Answers
            'answer_about_you', 'answer_why_company', 'answer_hire_you',

            // Preferences
            'work_environment', 'preferred_location', 'work_authorization',

            // Legacy fields
            'subscription_status', 'preferences'
        ];

        // Filter updates to only allowed fields
        const updates = {};
        for (const [key, value] of Object.entries(req.body)) {
            if (allowedFields.includes(key) && value !== undefined && value !== null && value !== '') {
                updates[key] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        // Update profile
        const profile = await supabaseService.updateProfile(userId, updates);

        res.json({
            success: true,
            profile,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('[Profile] PATCH error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile'
        });
    }
});

/**
 * GET /profile/subscription
 * Get subscription status
 * Works with both extension and Supabase tokens
 */
router.get('/subscription', async (req, res) => {
    try {
        let userId;
        try {
            userId = await extractUserId(req);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const profile = await supabaseService.getProfile(userId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        res.json({
            success: true,
            subscription_status: profile.subscription_status
        });
    } catch (error) {
        console.error('[Profile] Subscription GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve subscription status'
        });
    }
});

/**
 * GET /profile/preferences
 * Get user preferences
 * Works with both extension and Supabase tokens
 */
router.get('/preferences', async (req, res) => {
    try {
        let userId;
        try {
            userId = await extractUserId(req);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const profile = await supabaseService.getProfile(userId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        res.json({
            success: true,
            preferences: profile.preferences || {}
        });
    } catch (error) {
        console.error('[Profile] Preferences GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve preferences'
        });
    }
});

/**
 * PUT /profile/preferences
 * Update user preferences
 * Works with both extension and Supabase tokens
 */
router.put('/preferences', async (req, res) => {
    try {
        let userId;
        try {
            userId = await extractUserId(req);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const preferences = req.body;

        // Validate preferences is an object
        if (typeof preferences !== 'object' || Array.isArray(preferences)) {
            return res.status(400).json({
                success: false,
                error: 'Preferences must be a JSON object'
            });
        }

        // Update profile with new preferences
        const profile = await supabaseService.updateProfile(userId, {
            preferences
        });

        res.json({
            success: true,
            preferences: profile.preferences,
            message: 'Preferences updated successfully'
        });
    } catch (error) {
        console.error('[Profile] Preferences PUT error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences'
        });
    }
});

module.exports = router;
