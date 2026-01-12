/**
 * Analysis Routes
 */

const express = require('express');
const ResumeAnalyzer = require('../services/resumeAnalyzer');
const ResumeOptimizer = require('../services/resumeOptimizer');

const router = express.Router();

/**
 * POST /api/analysis/analyze
 * Analyze resume against job description
 */
router.post('/analyze', async (req, res) => {
    try {
        const { jobDescription, resumeText } = req.body;

        if (!jobDescription || !resumeText) {
            return res.status(400).json({
                error: 'Job description and resume text are required'
            });
        }

        const analysis = await ResumeAnalyzer.analyze(resumeText, jobDescription);

        res.json(analysis);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze resume',
            message: error.message
        });
    }
});

/**
 * POST /api/analysis/optimize
 * Optimize resume based on analysis
 */
router.post('/optimize', async (req, res) => {
    try {
        const { resumeText, jobDescription, analysisResult, preferences } = req.body;

        if (!resumeText || !jobDescription || !analysisResult) {
            return res.status(400).json({
                error: 'Resume text, job description, and analysis result are required'
            });
        }

        const optimization = await ResumeOptimizer.optimize(
            resumeText,
            jobDescription,
            analysisResult,
            preferences
        );

        res.json(optimization);
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({
            error: 'Failed to optimize resume',
            message: error.message
        });
    }
});

module.exports = router;
