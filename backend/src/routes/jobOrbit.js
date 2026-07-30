/**
 * Job Orbit Integration Routes
 */

const express = require('express');
const router = express.Router();
const JobOrbitService = require('../services/jobOrbitService');

/**
 * Validate API key
 * POST /api/job-orbit/validate
 */
router.post('/validate', async (req, res) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        const isValid = await JobOrbitService.validateApiKey(apiKey);

        res.json({
            success: isValid,
            message: isValid ? 'API key is valid' : 'Invalid API key'
        });
    } catch (error) {
        console.error('[JobOrbit Route] Validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate API key'
        });
    }
});

/**
 * Sync applications
 * POST /api/job-orbit/sync
 */
router.post('/sync', async (req, res) => {
    try {
        const { apiKey, applications } = req.body;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        if (!applications || !Array.isArray(applications)) {
            return res.status(400).json({
                success: false,
                error: 'Applications array required'
            });
        }

        const result = await JobOrbitService.syncApplications(apiKey, applications);

        res.json(result);
    } catch (error) {
        console.error('[JobOrbit Route] Sync error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync applications'
        });
    }
});

/**
 * Create application
 * POST /api/job-orbit/applications
 */
router.post('/applications', async (req, res) => {
    try {
        const { apiKey, application } = req.body;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        if (!application) {
            return res.status(400).json({
                success: false,
                error: 'Application data required'
            });
        }

        const result = await JobOrbitService.createApplication(apiKey, application);

        res.json(result);
    } catch (error) {
        console.error('[JobOrbit Route] Create application error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create application'
        });
    }
});

/**
 * Get applications
 * GET /api/job-orbit/applications
 */
router.get('/applications', async (req, res) => {
    try {
        const { apiKey } = req.query;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        const filters = {
            status: req.query.status,
            company: req.query.company,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const result = await JobOrbitService.getApplications(apiKey, filters);

        res.json(result);
    } catch (error) {
        console.error('[JobOrbit Route] Get applications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications'
        });
    }
});

/**
 * Get statistics
 * GET /api/job-orbit/statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const { apiKey } = req.query;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        const result = await JobOrbitService.getStatistics(apiKey);

        res.json(result);
    } catch (error) {
        console.error('[JobOrbit Route] Get statistics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

/**
 * Update application status
 * PATCH /api/job-orbit/applications/:id/status
 */
router.patch('/applications/:id/status', async (req, res) => {
    try {
        const { apiKey, status } = req.body;
        const { id } = req.params;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status required'
            });
        }

        const result = await JobOrbitService.updateApplicationStatus(apiKey, id, status);

        res.json(result);
    } catch (error) {
        console.error('[JobOrbit Route] Update status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update application status'
        });
    }
});

/**
 * Delete application
 * DELETE /api/job-orbit/applications/:id
 */
router.delete('/applications/:id', async (req, res) => {
    try {
        const { apiKey } = req.body;
        const { id } = req.params;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required'
            });
        }

        const result = await JobOrbitService.deleteApplication(apiKey, id);

        res.json(result);
    } catch (error) {
        console.error('[JobOrbit Route] Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete application'
        });
    }
});

module.exports = router;
