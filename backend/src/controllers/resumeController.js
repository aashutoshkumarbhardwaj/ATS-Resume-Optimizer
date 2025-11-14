/**
 * Resume Controller
 * Handles resume-related operations
 */

const ResumeService = require('../services/resumeService');

class ResumeController {
    /**
     * Analyze resume
     */
    static async analyzeResume(req, res) {
        try {
            const { jobRole, jobDescription, resumeText } = req.body;

            if (!jobRole || !jobDescription || !resumeText) {
                return res.status(400).json({
                    error: 'Missing required fields: jobRole, jobDescription, resumeText'
                });
            }

            const result = await ResumeService.analyzeResume(
                jobRole,
                jobDescription,
                resumeText
            );

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get resume suggestions
     */
    static async getSuggestions(req, res) {
        try {
            const { jobRole, resumeText } = req.query;

            if (!jobRole || !resumeText) {
                return res.status(400).json({
                    error: 'Missing required parameters: jobRole, resumeText'
                });
            }

            const suggestions = await ResumeService.getSuggestions(jobRole, resumeText);
            res.json({ suggestions });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Optimize resume content
     */
    static async optimizeResume(req, res) {
        try {
            const { resumeText, jobDescription } = req.body;

            if (!resumeText || !jobDescription) {
                return res.status(400).json({
                    error: 'Missing required fields: resumeText, jobDescription'
                });
            }

            const optimized = await ResumeService.optimizeResume(resumeText, jobDescription);
            res.json({ optimizedResume: optimized });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ResumeController;
