/**
 * AI Memory Routes
 * Handle AI response storage and retrieval for learning
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest, requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');

// Apply authentication middleware to all routes
router.use(authenticateRequest);

/**
 * GET /ai-memory
 * Retrieve AI memory entries with optional filtering
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { question_type, limit = 100, offset = 0 } = req.query;

        // Get profile to get profile_id
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Build filters
        const filters = {
            limit: Math.min(parseInt(limit) || 100, 500), // Max 500 per request
            offset: parseInt(offset) || 0
        };
        if (question_type) filters.questionType = question_type;

        // Get AI memory entries
        const entries = await supabaseService.getAIMemory(profile.id, filters);

        res.json({
            success: true,
            entries,
            count: entries.length,
            limit: filters.limit,
            offset: filters.offset
        });
    } catch (error) {
        console.error('[AI Memory] GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve AI memory'
        });
    }
});

/**
 * POST /ai-memory
 * Store new AI response in memory
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { question_type, context, response_content } = req.body;

        // Validate required fields
        if (!question_type || !response_content) {
            return res.status(400).json({
                success: false,
                error: 'question_type and response_content are required'
            });
        }

        // Validate question_type
        const validTypes = ['resume_optimization', 'jd_extraction', 'autofill', 'general'];
        if (!validTypes.includes(question_type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid question_type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Validate content is not too long
        if (response_content.length > 50000) {
            return res.status(400).json({
                success: false,
                error: 'Response content is too long (max 50,000 characters)'
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

        // Create AI memory entry
        const entry = await supabaseService.createAIMemory(profile.id, {
            questionType: question_type,
            context: context || {},
            responseContent: response_content
        });

        res.status(201).json({
            success: true,
            entry,
            message: 'AI response saved to memory'
        });
    } catch (error) {
        console.error('[AI Memory] POST error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save AI response'
        });
    }
});

/**
 * PATCH /ai-memory/:id
 * Update AI memory entry (e.g., update feedback score)
 */
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const entryId = req.params.id;
        const { feedback_score, context } = req.body;

        // Validate feedback_score if provided
        if (feedback_score !== undefined && ![-1, 0, 1].includes(feedback_score)) {
            return res.status(400).json({
                success: false,
                error: 'feedback_score must be -1, 0, or 1'
            });
        }

        // Prepare update object
        const updates = {};
        if (feedback_score !== undefined) updates.feedback_score = feedback_score;
        if (context !== undefined) updates.context = context;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one field (feedback_score, context) is required'
            });
        }

        // Update AI memory entry
        const entry = await supabaseService.updateAIMemory(entryId, updates);

        res.json({
            success: true,
            entry,
            message: 'AI memory entry updated successfully'
        });
    } catch (error) {
        console.error('[AI Memory] PATCH error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update AI memory entry'
        });
    }
});

/**
 * GET /ai-memory/similar
 * Find similar AI memory entries to inform future suggestions
 */
router.get('/similar', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { question_type, keywords } = req.query;

        if (!question_type) {
            return res.status(400).json({
                success: false,
                error: 'question_type is required'
            });
        }

        // Get profile
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Get entries of same type
        const entries = await supabaseService.getAIMemory(profile.id, {
            questionType: question_type,
            limit: 10
        });

        // Filter by keywords if provided
        let filtered = entries;
        if (keywords) {
            const keywordArray = keywords.split(',').map(k => k.trim().toLowerCase());
            filtered = entries.filter(entry => {
                const contextStr = JSON.stringify(entry.context).toLowerCase();
                const responseStr = entry.response_content.toLowerCase();
                return keywordArray.some(kw =>
                    contextStr.includes(kw) || responseStr.includes(kw)
                );
            });
        }

        res.json({
            success: true,
            entries: filtered,
            count: filtered.length
        });
    } catch (error) {
        console.error('[AI Memory] Similar GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to find similar entries'
        });
    }
});

/**
 * DELETE /ai-memory/:id
 * Delete AI memory entry
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const entryId = req.params.id;

        // Delete entry (soft delete via supabaseService)
        const entry = await supabaseService.updateAIMemory(entryId, {
            deleted_at: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'AI memory entry deleted successfully'
        });
    } catch (error) {
        console.error('[AI Memory] DELETE error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete AI memory entry'
        });
    }
});

module.exports = router;
