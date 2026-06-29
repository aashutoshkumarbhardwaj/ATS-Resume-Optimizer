/**
 * Enhanced Resume Routes
 * Handles PDF upload, parsing, ATS scoring, and auto-fill
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const EnhancedResumeController = require('../controllers/enhancedResumeController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../temp'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExt = ['.pdf', '.docx', '.txt'];
        if (allowedExt.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
        }
    }
});

/**
 * POST /api/enhanced-resume/validate
 * Validate PDF file format and size
 */
router.post('/validate', upload.single('file'), async (req, res) => {
    try {
        // Clean up file if uploaded just for validation
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        EnhancedResumeController.validatePdf(req, res);
    } catch (error) {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/enhanced-resume/upload
 * Upload and parse PDF, return structured data
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        await EnhancedResumeController.uploadAndParse(req, res);
    } catch (error) {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/enhanced-resume/upload-analyze
 * Upload PDF, parse it, calculate ATS score against job description
 * 
 * Request body:
 * {
 *   "jobDescription": "Job posting text here..."
 * }
 * 
 * Response includes:
 * - Parsed resume data
 * - ATS score and matching details
 * - Auto-fill data for forms
 */
router.post('/upload-analyze', upload.single('file'), async (req, res) => {
    try {
        await EnhancedResumeController.uploadAndAnalyze(req, res);
    } catch (error) {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/enhanced-resume/upload-autofill
 * Upload PDF and get auto-fill data for job application forms
 */
router.post('/upload-autofill', upload.single('file'), async (req, res) => {
    try {
        await EnhancedResumeController.uploadForAutoFill(req, res);
    } catch (error) {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/enhanced-resume/ats-score
 * Upload PDF and calculate ATS score
 * 
 * Request body:
 * {
 *   "jobDescription": "Job posting text here..."
 * }
 */
router.post('/ats-score', upload.single('file'), async (req, res) => {
    try {
        await EnhancedResumeController.getAtsScore(req, res);
    } catch (error) {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/enhanced-resume/parse
 * Upload PDF and get structured data
 */
router.post('/parse', upload.single('file'), async (req, res) => {
    try {
        await EnhancedResumeController.parsePdf(req, res);
    } catch (error) {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
