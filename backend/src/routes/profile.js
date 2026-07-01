/**
 * Profile Routes
 * Handle user profile operations
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest, requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');

// Apply authentication middleware to all routes
router.use(authenticateRequest);

/**
 * GET /profile
 * Retrieve authenticated user's profile
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Try to get existing profile
        let profile = await supabaseService.getProfile(userId);

        // If profile doesn't exist, create one
        if (!profile) {
            profile = await supabaseService.createProfile(
                userId,
                req.user.email,
                req.user.provider
            );
        }

        res.json({
            success: true,
            profile
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
 */
router.patch('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscription_status, preferences } = req.body;

        // Validate input
        if (subscription_status && !['free', 'premium', 'enterprise'].includes(subscription_status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription status'
            });
        }

        // Prepare update object
        const updates = {};
        if (subscription_status !== undefined) {
            updates.subscription_status = subscription_status;
        }
        if (preferences !== undefined) {
            updates.preferences = preferences;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
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
 */
router.get('/subscription', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
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
 */
router.get('/preferences', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
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
 */
router.put('/preferences', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
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
