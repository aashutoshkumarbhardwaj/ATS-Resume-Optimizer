/**
 * Resumes Routes
 * Handle resume CRUD operations
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
            next();
        });
    } catch (error) {
        next();
    }
};

router.use(authenticateExtensionOrSupabase);

/**
 * GET /resumes
 * Get all resumes for authenticated user
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
                error: 'Unauthorized'
            });
        }

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
 * Works with both extension and Supabase tokens
 */
router.post('/', async (req, res) => {
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
 * Works with both extension and Supabase tokens
 */
router.patch('/:id', async (req, res) => {
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

        const resumeId = req.params.id;
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
 * Works with both extension and Supabase tokens
 */
router.delete('/:id', async (req, res) => {
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

        const resumeId = req.params.id;

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
