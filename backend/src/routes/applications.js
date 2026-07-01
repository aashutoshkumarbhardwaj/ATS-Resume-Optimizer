/**
 * Applications Routes
 * Handle job application tracking
 */

const express = require('express');
const router = express.Router();
const { authenticateRequest, requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');

// Apply authentication middleware to all routes
router.use(authenticateRequest);

/**
 * GET /applications
 * Get all applications for authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, company, startDate, endDate } = req.query;

        // Get profile to get profile_id
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Build filters
        const filters = {};
        if (status) filters.status = status;
        if (company) filters.company = company;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        // Get applications
        const applications = await supabaseService.getApplications(profile.id, filters);

        res.json({
            success: true,
            applications,
            count: applications.length
        });
    } catch (error) {
        console.error('[Applications] GET error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve applications'
        });
    }
});

/**
 * POST /applications
 * Create new application record
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            job_title,
            company,
            job_url,
            job_description,
            location,
            salary,
            status,
            resume_id,
            notes
        } = req.body;

        // Validate required fields
        if (!job_title || !company) {
            return res.status(400).json({
                success: false,
                error: 'Job title and company are required'
            });
        }

        // Validate status if provided
        const validStatuses = ['applied', 'interviewing', 'rejected', 'offered', 'withdrawn'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
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

        // Create application
        const application = await supabaseService.createApplication(profile.id, {
            jobTitle: job_title,
            company,
            jobUrl: job_url,
            jobDescription: job_description,
            location,
            salary,
            status: status || 'applied',
            resumeId: resume_id,
            notes
        });

        res.status(201).json({
            success: true,
            application,
            message: 'Application recorded successfully'
        });
    } catch (error) {
        console.error('[Applications] POST error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create application record'
        });
    }
});

/**
 * PATCH /applications/:id
 * Update application
 */
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { status, notes } = req.body;

        // Validate status if provided
        const validStatuses = ['applied', 'interviewing', 'rejected', 'offered', 'withdrawn'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Prepare update object
        const updates = {};
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one field (status, notes) is required'
            });
        }

        // Update application
        const application = await supabaseService.updateApplication(applicationId, updates);

        res.json({
            success: true,
            application,
            message: 'Application updated successfully'
        });
    } catch (error) {
        console.error('[Applications] PATCH error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update application'
        });
    }
});

/**
 * DELETE /applications/:id
 * Delete application
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const applicationId = req.params.id;

        // Delete application (soft delete)
        await supabaseService.deleteApplication(applicationId);

        res.json({
            success: true,
            message: 'Application deleted successfully'
        });
    } catch (error) {
        console.error('[Applications] DELETE error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete application'
        });
    }
});

/**
 * GET /applications/stats
 * Get application statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get profile
        const profile = await supabaseService.getProfile(userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        // Get all applications
        const applications = await supabaseService.getApplications(profile.id);

        // Calculate statistics
        const stats = {
            total: applications.length,
            by_status: {},
            by_company: {},
            earliest_application: null,
            latest_application: null,
            applications_per_day: 0
        };

        applications.forEach(app => {
            // Count by status
            stats.by_status[app.status] = (stats.by_status[app.status] || 0) + 1;

            // Count by company
            stats.by_company[app.company] = (stats.by_company[app.company] || 0) + 1;
        });

        // Get earliest and latest
        if (applications.length > 0) {
            const sorted = [...applications].sort(
                (a, b) => new Date(a.application_date) - new Date(b.application_date)
            );
            stats.earliest_application = sorted[0].application_date;
            stats.latest_application = sorted[sorted.length - 1].application_date;

            // Calculate applications per day
            const timespan = new Date(stats.latest_application) - new Date(stats.earliest_application);
            const days = Math.ceil(timespan / (1000 * 60 * 60 * 24)) + 1;
            stats.applications_per_day = (applications.length / days).toFixed(2);
        }

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[Applications] Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics'
        });
    }
});

module.exports = router;
