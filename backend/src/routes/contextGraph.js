/**
 * User Context Graph Routes
 * Enterprise ontology-driven Knowledge Graph for candidates.
 * Tracks identity, skills, professional background, semantic Q&A nodes,
 * and comprehensive form submission histories with full field snapshots.
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest } = require('../middleware/auth');
const { verifyExtensionToken } = require('../utils/extensionJWT');
const supabaseService = require('../services/supabaseService');

/**
 * Middleware: Authenticate either via Supabase Bearer token or Extension JWT
 */
const authenticateExtensionOrSupabase = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid authorization header'
        });
    }

    const token = authHeader.substring('Bearer '.length);

    // 1. Try Extension JWT first
    try {
        const verified = verifyExtensionToken(token);
        req.user = {
            id: verified.user_id || verified.userId || verified.sub,
            email: verified.email || verified.user_email,
            type: 'extension'
        };
        return next();
    } catch (e) {
        // Not extension token, proceed to Supabase
    }

    // 2. Try Supabase JWT
    return authenticateRequest(req, res, next);
};

router.use(authenticateExtensionOrSupabase);

/**
 * GET /api/context-graph
 * Retrieve the current candidate's Context Graph
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User ID not found' });
        }

        const graph = await supabaseService.getContextGraph(userId);
        return res.json({
            success: true,
            graph
        });
    } catch (error) {
        console.error('[ContextGraph Route] GET error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve context graph'
        });
    }
});

/**
 * POST /api/context-graph
 * Upsert or merge candidate's Context Graph
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User ID not found' });
        }

        const { profileName, graph } = req.body;
        if (!graph) {
            return res.status(400).json({ success: false, error: 'Missing graph data payload' });
        }

        const savedGraph = await supabaseService.saveContextGraph(userId, profileName, graph);
        return res.json({
            success: true,
            message: 'Context Graph persisted successfully',
            graph: savedGraph
        });
    } catch (error) {
        console.error('[ContextGraph Route] POST error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to save context graph'
        });
    }
});

/**
 * POST /api/context-graph/record-form
 * Record an application form submission snapshot into Context Graph
 */
router.post('/record-form', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User ID not found' });
        }

        const { url, company, jobTitle, profileName, platform, status, formData } = req.body;

        if (!company && !url) {
            return res.status(400).json({
                success: false,
                error: 'Company and URL are required to record form submission'
            });
        }

        const formRecord = {
            id: req.body.id || ('form_app_' + Date.now()),
            timestamp: req.body.timestamp || new Date().toISOString(),
            url: url || '',
            company: company || 'Company',
            jobTitle: jobTitle || 'Software Engineer',
            profileName: profileName || 'Candidate',
            platform: platform || 'ATS',
            status: status || 'applied',
            formData: formData || []
        };

        const updatedGraph = await supabaseService.recordFormApplication(userId, profileName, formRecord);

        return res.json({
            success: true,
            message: 'Form application snapshot recorded to Context Graph',
            record: formRecord,
            totalHistoryCount: updatedGraph.applicationHistory?.length || 0
        });
    } catch (error) {
        console.error('[ContextGraph Route] record-form error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to record form application'
        });
    }
});

module.exports = router;
