/**
 * Job Role Routes
 */

const express = require('express');
const JobRoleController = require('../controllers/jobRoleController');

const router = express.Router();

// Get job role by title
router.get('/:title', JobRoleController.getJobRole);

// Parse job description
router.post('/parse', JobRoleController.parseJobDescription);

// Get skills for role
router.get('/skills/:role', JobRoleController.getSkillsForRole);

module.exports = router;
