/**
 * Analysis Routes
 */

const express = require('express');
const AnalysisController = require('../controllers/analysisController');

const router = express.Router();

/**
 * POST /api/analysis/analyze
 * Analyze resume against job description
 */
router.post('/analyze', AnalysisController.analyze);

/**
 * POST /api/analysis/optimize
 * Optimize resume based on analysis
 */
router.post('/optimize', AnalysisController.optimize);

/**
 * POST /api/analysis/keywords
 * Get keyword suggestions for a job description
 */
router.post('/keywords', AnalysisController.getKeywordSuggestions);

/**
 * POST /api/analysis/compare
 * Compare two resume versions
 */
router.post('/compare', AnalysisController.compare);

module.exports = router;
