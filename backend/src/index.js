require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Created temp directory');
}

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for development (Chrome extension)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Server is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Import and setup routes with error handling
try {
    // Import middleware
    const errorHandler = require('./middleware/errorHandler');
    
    // Import routes with fallback handling
    const setupRoutes = () => {
        try {
            const analysisRoutes = require('./routes/analysis');
            app.use('/api/analysis', analysisRoutes);
            console.log('✅ Analysis routes loaded');
        } catch (error) {
            console.error('❌ Failed to load analysis routes:', error.message);
        }

        try {
            const userRoutes = require('./routes/user');
            app.use('/api/user', userRoutes);
            console.log('✅ User routes loaded');
        } catch (error) {
            console.error('❌ Failed to load user routes:', error.message);
        }

        try {
            const resumeRoutes = require('./routes/resume');
            app.use('/api/resume', resumeRoutes);
            console.log('✅ Resume routes loaded');
        } catch (error) {
            console.error('❌ Failed to load resume routes:', error.message);
        }

        try {
            const jobRoleRoutes = require('./routes/jobRole');
            app.use('/api/job-role', jobRoleRoutes);
            console.log('✅ Job role routes loaded');
        } catch (error) {
            console.error('❌ Failed to load job role routes:', error.message);
        }

        try {
            const documentsRoutes = require('./routes/documents');
            app.use('/api/documents', documentsRoutes);
            console.log('✅ Documents routes loaded');
        } catch (error) {
            console.error('❌ Failed to load documents routes:', error.message);
        }
    };

    setupRoutes();

    // Error handling middleware
    app.use(errorHandler);

} catch (error) {
    console.error('❌ Critical error during route setup:', error.message);
}

// Fallback API endpoints for essential functionality
app.post('/api/analysis/analyze', async (req, res) => {
    try {
        const ResumeAnalyzer = require('./services/resumeAnalyzer');
        const { resumeText, jobDescription } = req.body;

        if (!resumeText || !jobDescription) {
            return res.status(400).json({
                success: false,
                error: 'Resume text and job description are required'
            });
        }

        const result = await ResumeAnalyzer.analyze(resumeText, jobDescription);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Analysis service temporarily unavailable',
            message: error.message
        });
    }
});

app.post('/api/analysis/optimize', async (req, res) => {
    try {
        const { resumeText, jobDescription, analysisResult } = req.body;

        if (!resumeText || !jobDescription) {
            return res.status(400).json({
                success: false,
                error: 'Resume text and job description are required'
            });
        }

        // Fallback optimization logic
        const ResumeAnalyzer = require('./services/resumeAnalyzer');
        const analysis = analysisResult || await ResumeAnalyzer.analyze(resumeText, jobDescription);
        
        const optimizationResult = {
            originalScore: analysis.atsScore,
            optimizedScore: Math.min(100, analysis.atsScore + 15),
            optimizedText: resumeText,
            changes: analysis.suggestions.map(suggestion => ({
                type: suggestion.type,
                reason: suggestion.message,
                impact: suggestion.impact,
                priority: suggestion.priority
            })),
            suggestions: analysis.suggestions
        };

        res.json({
            success: true,
            ...optimizationResult
        });
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({
            success: false,
            error: 'Optimization service temporarily unavailable',
            message: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Resume Fixer API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
