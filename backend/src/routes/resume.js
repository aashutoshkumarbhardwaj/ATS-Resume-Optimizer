/**
 * Resume Routes
 */

const express = require('express');
const ResumeController = require('../controllers/resumeController');

const router = express.Router();

// Analyze resume
router.post('/analyze', ResumeController.analyzeResume);

// Get suggestions
router.get('/suggestions', ResumeController.getSuggestions);

// Optimize resume
router.post('/optimize', ResumeController.optimizeResume);

module.exports = router;
