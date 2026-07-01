/**
 * Resumes Routes
 * Handle resume CRUD operations
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest, requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');

// Apply authentication middleware to all routes
router.use(authenticateRequest);

/**
 * GET /resumes
 * Get all resumes for authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const resumes = await supabaseService.getResumes(userId);

        res.json({
            success: true,
            resumes,
            count: resumes.length
        });
    } catch (error) {
        console.error('[Resumes] GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve resumes'
        });
    }
});

/**
 * POST /resumes
 * Create new resume
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, content, file_format } = req.body;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Title and content are required'
            });
        }

        // Validate content is not too long
        if (content.length > 100000) {
            return res.status(400).json({
                success: false,
                error: 'Resume content is too long (max 100,000 characters)'
            });
        }

        // Get profile to get profile_id
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Create resume
        const resume = await supabaseService.createResume(
            profile.id,
            title,
            content,
            file_format || 'text'
        );

        res.status(201).json({
            success: true,
            resume,
            message: 'Resume created successfully'
        });
    } catch (error) {
        console.error('[Resumes] POST error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create resume'
        });
    }
});

/**
 * PATCH /resumes/:id
 * Update resume
 */
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const resumeId = req.params.id;
        const userId = req.user.id;
        const { title, content, file_format } = req.body;

        // Validate at least one field is provided
        if (!title && !content && !file_format) {
            return res.status(400).json({
                success: false,
                error: 'At least one field (title, content, file_format) is required'
            });
        }

        // Validate content if provided
        if (content && content.length > 100000) {
            return res.status(400).json({
                success: false,
                error: 'Resume content is too long (max 100,000 characters)'
            });
        }

        // Get profile to verify ownership
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Prepare update object
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        if (file_format !== undefined) updates.file_format = file_format;

        // Update resume
        const resume = await supabaseService.updateResume(resumeId, updates);

        res.json({
            success: true,
            resume,
            message: 'Resume updated successfully'
        });
    } catch (error) {
        console.error('[Resumes] PATCH error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update resume'
        });
    }
});

/**
 * DELETE /resumes/:id
 * Delete resume
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const resumeId = req.params.id;
        const userId = req.user.id;

        // Get profile to verify ownership
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Delete resume (soft delete)
        await supabaseService.deleteResume(resumeId);

        res.json({
            success: true,
            message: 'Resume deleted successfully'
        });
    } catch (error) {
        console.error('[Resumes] DELETE error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete resume'
        });
    }
});

module.exports = router;
