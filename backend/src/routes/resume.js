/**
 * Resume Routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ResumeController = require('../controllers/resumeController');
const ResumeImproveService = require('../services/resumeImproveService');

const router = express.Router();

// Configure multer for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../temp'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// Analyze resume
router.post('/analyze', ResumeController.analyzeResume);

// Get suggestions
router.get('/suggestions', ResumeController.getSuggestions);

// Optimize resume
router.post('/optimize', ResumeController.optimizeResume);

/**
 * POST /api/resume/improve
 * Improve resume file in place
 */
router.post('/improve', upload.single('file'), async (req, res) => {
    try {
        const { optimizedText, mode, max_words_added_per_line, allow_shrink_font } = req.body;

        if (!req.file || !optimizedText) {
            return res.status(400).json({
                error: 'File and optimizedText are required'
            });
        }

        const result = await ResumeImproveService.improveFile(req.file, {
            optimizedText,
            mode,
            maxWordsAddedPerLine: Number(max_words_added_per_line) || 3,
            allowShrinkFont: allow_shrink_font !== 'false'
        });

        const downloadId = ResumeImproveService.storeDownload(result.filePath);

        res.json({
            status: 'success',
            download_url: `/api/resume/download/${downloadId}`,
            changes: result.changes
        });
    } catch (error) {
        console.error('Improve error:', error);
        res.status(500).json({
            error: 'Failed to improve resume',
            message: error.message
        });
    } finally {
        if (req.file?.path) {
            fs.unlink(req.file.path).catch(() => {});
        }
    }
});

/**
 * GET /api/resume/download/:id
 * Download improved resume
 */
router.get('/download/:id', (req, res) => {
    const filePath = ResumeImproveService.getDownloadPath(req.params.id);
    if (!filePath) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, (err) => {
        if (err) {
            console.error('Download error:', err);
        }
    });
});

module.exports = router;
