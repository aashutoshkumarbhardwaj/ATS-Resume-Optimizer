/**
 * Documents Routes
 * Handles file upload and document generation
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const FileUploadService = require('../services/fileUploadService');
const DocumentGenerator = require('../services/documentGenerator');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../temp'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|txt)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOCX, and TXT are allowed.'));
        }
    }
});

/**
 * POST /api/documents/upload
 * Upload and extract text from resume file
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded'
            });
        }

        const result = await FileUploadService.extractText(req.file);

        res.json({
            extractedText: result.text,
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Failed to process file',
            message: error.message
        });
    }
});

/**
 * POST /api/documents/generate
 * Generate optimized resume document
 */
router.post('/generate', async (req, res) => {
    try {
        const { resumeData, format, template, jobTitle } = req.body;

        if (!resumeData || !format) {
            return res.status(400).json({
                error: 'Resume data and format are required'
            });
        }

        const result = await DocumentGenerator.generate(
            resumeData,
            format,
            template || 'professional',
            jobTitle || 'Position'
        );

        // Send file
        res.download(result.filePath, result.filename, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // File will be cleaned up by scheduled cleanup job
        });
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            error: 'Failed to generate document',
            message: error.message
        });
    }
});

module.exports = router;
