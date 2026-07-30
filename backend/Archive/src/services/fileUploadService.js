/**
 * File Upload Service
 * Handles file uploads and text extraction from various formats
 */

const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class FileUploadService {
    /**
     * Extract text from uploaded file based on format
     */
    static async extractText(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        const { path: filePath, mimetype, originalname, size } = file;

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (size > maxSize) {
            await this.cleanupFile(filePath);
            throw new Error('File size exceeds 5MB limit');
        }

        try {
            let extractedText = '';

            // Extract based on file type
            if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
                extractedText = await this.extractFromPDF(filePath);
            } else if (
                mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                originalname.endsWith('.docx')
            ) {
                extractedText = await this.extractFromDOCX(filePath);
            } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
                extractedText = await this.extractFromTXT(filePath);
            } else {
                await this.cleanupFile(filePath);
                throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT files.');
            }

            // Clean up the uploaded file after extraction
            await this.cleanupFile(filePath);

            return {
                text: extractedText,
                metadata: {
                    filename: originalname,
                    size: size,
                    format: this.getFileFormat(mimetype, originalname)
                }
            };
        } catch (error) {
            // Clean up file on error
            await this.cleanupFile(filePath);
            throw error;
        }
    }

    /**
     * Extract text from PDF file
     */
    static async extractFromPDF(filePath) {
        try {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } catch (error) {
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    /**
     * Extract text from DOCX file
     */
    static async extractFromDOCX(filePath) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            throw new Error(`Failed to extract text from DOCX: ${error.message}`);
        }
    }

    /**
     * Extract text from TXT file
     */
    static async extractFromTXT(filePath) {
        try {
            const text = await fs.readFile(filePath, 'utf-8');
            return text;
        } catch (error) {
            throw new Error(`Failed to read TXT file: ${error.message}`);
        }
    }

    /**
     * Get file format from mimetype or filename
     */
    static getFileFormat(mimetype, filename) {
        if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
            return 'PDF';
        } else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            filename.endsWith('.docx')
        ) {
            return 'DOCX';
        } else if (mimetype === 'text/plain' || filename.endsWith('.txt')) {
            return 'TXT';
        }
        return 'UNKNOWN';
    }

    /**
     * Clean up uploaded file
     */
    static async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.error('Failed to cleanup file:', error);
        }
    }

    /**
     * Validate file before processing
     */
    static validateFile(file) {
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }

        const { mimetype, originalname, size } = file;

        // Check file size
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (size > maxSize) {
            return { valid: false, error: 'File size exceeds 5MB limit' };
        }

        // Check file format
        const supportedFormats = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];

        const supportedExtensions = ['.pdf', '.docx', '.txt'];
        const hasValidMimetype = supportedFormats.includes(mimetype);
        const hasValidExtension = supportedExtensions.some(ext => originalname.endsWith(ext));

        if (!hasValidMimetype && !hasValidExtension) {
            return {
                valid: false,
                error: 'Unsupported file format. Please upload PDF, DOCX, or TXT files.'
            };
        }

        return { valid: true };
    }
}

module.exports = FileUploadService;
