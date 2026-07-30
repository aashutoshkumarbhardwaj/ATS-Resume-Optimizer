/**
 * Enhanced Resume Controller
 * Handles PDF uploads with structured parsing, ATS scoring, and auto-fill
 */

const EnhancedFileUploadService = require('../services/enhancedFileUploadService');
const ResumeAnalyzer = require('../services/resumeAnalyzer');

class EnhancedResumeController {
    constructor() {
        this.fileService = new EnhancedFileUploadService();
        this.analyzer = new ResumeAnalyzer();
    }

    /**
     * Upload PDF and get structured data + ATS score
     * POST /api/resume/upload-analyze
     */
    async uploadAndAnalyze(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            // Get job description from body
            const { jobDescription } = req.body;
            if (!jobDescription) {
                return res.status(400).json({
                    success: false,
                    error: 'Job description is required for analysis'
                });
            }

            // Parse file
            const uploadResult = await this.fileService.uploadAndParse(req.file);

            // Calculate ATS score
            const atsData = this.fileService.getDataForAtsScoring(uploadResult.data);
            const analysis = await ResumeAnalyzer.analyze(
                atsData.text,
                jobDescription
            );

            // Get auto-fill data
            const autoFillData = this.fileService.getDataForAutoFill(uploadResult.data);

            return res.json({
                success: true,
                resume: uploadResult.data,
                analysis: {
                    atsScore: analysis.atsScore,
                    matchedKeywords: analysis.matchedKeywords,
                    missingKeywords: analysis.missingKeywords,
                    matchedSkills: analysis.matchedSkills,
                    missingSkills: analysis.missingSkills,
                    suggestions: analysis.suggestions,
                    breakdown: analysis.breakdown,
                    confidence: analysis.matchingConfidence
                },
                autoFill: autoFillData,
                fileMetadata: uploadResult.data.fileMetadata
            });
        } catch (error) {
            console.error('Upload and analyze error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Upload PDF and get structured data only
     * POST /api/resume/upload
     */
    async uploadAndParse(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const uploadResult = await this.fileService.uploadAndParse(req.file);

            return res.json({
                success: true,
                resume: uploadResult.data,
                autoFill: this.fileService.getDataForAutoFill(uploadResult.data),
                fileMetadata: uploadResult.data.fileMetadata
            });
        } catch (error) {
            console.error('Upload error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Upload PDF and get auto-fill data only
     * POST /api/resume/upload-autofill
     */
    async uploadForAutoFill(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const uploadResult = await this.fileService.uploadAndParse(req.file);
            const autoFillData = this.fileService.getDataForAutoFill(uploadResult.data);

            return res.json({
                success: true,
                autoFill: autoFillData,
                contact: uploadResult.data.contact,
                fileMetadata: uploadResult.data.fileMetadata
            });
        } catch (error) {
            console.error('Auto-fill error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get ATS score for uploaded resume
     * POST /api/resume/ats-score
     */
    async getAtsScore(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const { jobDescription } = req.body;
            if (!jobDescription) {
                return res.status(400).json({
                    success: false,
                    error: 'Job description is required'
                });
            }

            // Parse file
            const uploadResult = await this.fileService.uploadAndParse(req.file);
            const atsData = this.fileService.getDataForAtsScoring(uploadResult.data);

            // Calculate ATS score
            const analysis = await ResumeAnalyzer.analyze(
                atsData.text,
                jobDescription
            );

            return res.json({
                success: true,
                atsScore: analysis.atsScore,
                matchedKeywords: analysis.matchedKeywords,
                missingKeywords: analysis.missingKeywords,
                matchedSkills: analysis.matchedSkills,
                missingSkills: analysis.missingSkills,
                suggestions: analysis.suggestions,
                breakdown: analysis.breakdown,
                confidence: analysis.matchingConfidence
            });
        } catch (error) {
            console.error('ATS score error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Parse PDF and return structured data
     * POST /api/resume/parse
     */
    async parsePdf(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const uploadResult = await this.fileService.uploadAndParse(req.file);

            return res.json({
                success: true,
                data: {
                    fullText: uploadResult.data.fullText,
                    contact: uploadResult.data.contact,
                    summary: uploadResult.data.summary,
                    experience: uploadResult.data.experience,
                    education: uploadResult.data.education,
                    skills: uploadResult.data.skills,
                    certifications: uploadResult.data.certifications,
                    sections: uploadResult.data.sections,
                    metadata: uploadResult.data.metadata,
                    pdfType: uploadResult.data.pdfType,
                    extractionMethod: uploadResult.data.extractionMethod,
                    confidence: uploadResult.data.confidence,
                    fileMetadata: uploadResult.data.fileMetadata
                }
            });
        } catch (error) {
            console.error('Parse error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Validate PDF file without processing
     * POST /api/resume/validate
     */
    async validatePdf(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file provided'
                });
            }

            this.fileService.validateFile(req.file);

            return res.json({
                success: true,
                message: 'File is valid',
                file: {
                    name: req.file.originalname,
                    size: req.file.size,
                    format: req.file.originalname.split('.').pop().toUpperCase()
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new EnhancedResumeController();
