/**
 * Job Role Controller
 * Handles job role-related operations
 */

const JobRoleService = require('../services/jobRoleService');

class JobRoleController {
    /**
     * Get job role by title
     */
    static async getJobRole(req, res) {
        try {
            const { title } = req.params;

            const jobRole = await JobRoleService.getJobRoleByTitle(title);

            if (!jobRole) {
                return res.status(404).json({ error: 'Job role not found' });
            }

            res.json(jobRole);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get job role details from description
     */
    static async parseJobDescription(req, res) {
        try {
            const { description } = req.body;

            if (!description) {
                return res.status(400).json({
                    error: 'Missing required field: description'
                });
            }

            const details = await JobRoleService.parseJobDescription(description);
            res.json(details);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get skills for a job role
     */
    static async getSkillsForRole(req, res) {
        try {
            const { role } = req.params;

            const skills = await JobRoleService.getSkillsForRole(role);
            res.json({ skills });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = JobRoleController;
