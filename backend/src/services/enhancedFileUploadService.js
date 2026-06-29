/**
 * Enhanced File Upload Service
 * Integrates with advanced PDF parsing for structured data extraction
 * Used for ATS scoring and auto-fill functionality
 */

const fs = require('fs').promises;
const path = require('path');
const AdvancedPdfParser = require('./advancedPdfParser');
const mammoth = require('mammoth');

class EnhancedFileUploadService {
    constructor() {
        this.pdfParser = new AdvancedPdfParser();
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.supportedFormats = ['pdf', 'docx', 'txt'];
    }

    /**
     * Upload and parse file - returns structured data
     */
    async uploadAndParse(file, options = {}) {
        if (!file) {
            throw new Error('No file provided');
        }

        try {
            // Validate file
            this.validateFile(file);

            const { path: filePath, originalname } = file;
            const fileExt = path.extname(originalname).toLowerCase().replace('.', '');

            let structuredData;

            // Parse based on file type
            if (fileExt === 'pdf') {
                structuredData = await this.pdfParser.parsePdf(filePath, options);
            } else if (fileExt === 'docx') {
                structuredData = await this.parseDocx(filePath);
            } else if (fileExt === 'txt') {
                structuredData = await this.parseTxt(filePath);
            } else {
                throw new Error(`Unsupported file format: ${fileExt}`);
            }

            // Add file metadata
            structuredData.fileMetadata = {
                originalname: originalname,
                size: file.size,
                format: fileExt.toUpperCase(),
                uploadedAt: new Date().toISOString()
            };

            // Cleanup temp file
            await this.cleanupFile(filePath);

            return {
                success: true,
                data: structuredData,
                type: fileExt
            };
        } catch (error) {
            // Cleanup on error
            if (file?.path) {
                await this.cleanupFile(file.path).catch(() => {});
            }
            throw error;
        }
    }

    /**
     * Parse DOCX file
     */
    async parseDocx(filePath) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            const text = result.value || '';

            // Use parser to extract structured data from DOCX text
            return this.extractStructuredFromText(text, 'docx');
        } catch (error) {
            throw new Error(`Failed to parse DOCX: ${error.message}`);
        }
    }

    /**
     * Parse TXT file
     */
    async parseTxt(filePath) {
        try {
            const text = await fs.readFile(filePath, 'utf-8');
            return this.extractStructuredFromText(text, 'txt');
        } catch (error) {
            throw new Error(`Failed to parse TXT: ${error.message}`);
        }
    }

    /**
     * Extract structured data from plain text
     */
    extractStructuredFromText(text, format) {
        if (!text || text.trim().length === 0) {
            throw new Error('File contains no readable text');
        }

        return {
            fullText: text,
            totalPages: 1,
            contact: this.pdfParser.extractContactInfo(text),
            name: '',
            email: this.pdfParser.extractContactInfo(text).email || '',
            phone: this.pdfParser.extractContactInfo(text).phone || '',
            location: this.pdfParser.extractContactInfo(text).location || '',
            summary: this.pdfParser.extractSummary(text),
            experience: this.pdfParser.extractExperience(text),
            education: this.pdfParser.extractEducation(text),
            skills: this.pdfParser.extractSkills(text),
            certifications: this.pdfParser.extractCertifications(text),
            sections: this.pdfParser.identifySections(text),
            metadata: this.pdfParser.extractMetadata(text),
            pdfType: 'text',
            extractionMethod: format === 'pdf' ? 'text' : format,
            confidence: format === 'pdf' ? 0.95 : 0.85,
            isValid: text.length > 10,
            parsedAt: new Date().toISOString()
        };
    }

    /**
     * Get data for ATS scoring
     */
    getDataForAtsScoring(structuredData) {
        return this.pdfParser.getResumeForAtsScoring(structuredData);
    }

    /**
     * Get data for auto-fill forms
     */
    getDataForAutoFill(structuredData) {
        return this.pdfParser.getAutoFillData(structuredData);
    }

    /**
     * Validate file
     */
    validateFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        const { size, originalname } = file;

        // Check file size
        if (size > this.maxFileSize) {
            throw new Error(`File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`);
        }

        // Check file format
        const ext = path.extname(originalname).toLowerCase().replace('.', '');
        if (!this.supportedFormats.includes(ext)) {
            throw new Error(`Unsupported format. Supported: ${this.supportedFormats.join(', ')}`);
        }

        return true;
    }

    /**
     * Cleanup temp file
     */
    async cleanupFile(filePath) {
        try {
            if (filePath) {
                await fs.unlink(filePath);
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }

    /**
     * Process file for analysis workflow
     */
    async processForAnalysis(file) {
        const uploadResult = await this.uploadAndParse(file);
        
        return {
            ...uploadResult,
            atsData: this.getDataForAtsScoring(uploadResult.data),
            autoFillData: this.getDataForAutoFill(uploadResult.data)
        };
    }
}

module.exports = EnhancedFileUploadService;
