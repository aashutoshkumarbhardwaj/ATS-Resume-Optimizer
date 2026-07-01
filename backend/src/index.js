require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL database
const sequelize = require('./config/database');
const User = require('./models/User');
const OptimizationHistory = require('./models/OptimizationHistory');

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
    origin: '*',
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

// ── Routes (only load services that don't require MongoDB) ──────────────────

// Analysis routes — pure JS, no DB
try {
    const analysisRoutes = require('./routes/analysis');
    app.use('/api/analysis', analysisRoutes);
    console.log('✅ Analysis routes loaded');
} catch (e) {
    console.error('❌ Analysis routes failed:', e.message);
}

// Resume routes — multer + resumeParser, no DB
try {
    const resumeRoutes = require('./routes/resume');
    app.use('/api/resume', resumeRoutes);
    console.log('✅ Resume routes loaded');
} catch (e) {
    console.error('❌ Resume routes failed:', e.message);
}

// Documents routes — multer upload, no DB
try {
    const documentsRoutes = require('./routes/documents');
    app.use('/api/documents', documentsRoutes);
    console.log('✅ Documents routes loaded');
} catch (e) {
    console.error('❌ Documents routes failed:', e.message);
}

// Job Orbit routes — no DB required, pure axios API calls
try {
    const jobOrbitRoutes = require('./routes/jobOrbit');
    app.use('/api/job-orbit', jobOrbitRoutes);
    console.log('✅ Job Orbit routes loaded');
} catch (e) {
    console.error('❌ Job Orbit routes failed:', e.message);
}

// User / job-role routes require MongoDB — only load if URI is configured
if (process.env.MONGODB_URI) {
    try {
        const mongoose = require('mongoose');
        mongoose.connect(process.env.MONGODB_URI)
            .then(() => console.log('✅ MongoDB connected'))
            .catch(err => console.error('❌ MongoDB connection error:', err.message));

        const userRoutes    = require('./routes/user');
        const jobRoleRoutes = require('./routes/jobRole');
        app.use('/api/user',     userRoutes);
        app.use('/api/job-role', jobRoleRoutes);
        console.log('✅ User + Job-role routes loaded');
    } catch (e) {
        console.error('❌ DB-dependent routes failed:', e.message);
    }
} else {
    console.log('ℹ️  MONGODB_URI not set — user/job-role routes skipped (not needed for extension)');
}

// Error handler middleware
try {
    const errorHandler = require('./middleware/errorHandler');
    app.use(errorHandler);
} catch (e) { /* ignore */ }

// ── Inline fallback endpoints (always available) ────────────────────────────

app.post('/api/resume/parse', async (req, res) => {
    try {
        const ResumeParser = require('./services/resumeParser');
        const { resumeText } = req.body;
        if (!resumeText) return res.status(400).json({ success: false, error: 'resumeText is required' });
        const parsed = ResumeParser.parse(resumeText);
        res.json({ success: true, data: parsed });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

process.on('SIGTERM', () => { console.log('SIGTERM'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT');  process.exit(0); });

// Initialize database and start server
async function startServer() {
    try {
        // Sync database models
        await sequelize.sync({ alter: false });
        console.log('✅ PostgreSQL database synced');
        
        app.listen(PORT, () => {
            console.log(`🚀 Resume Fixer API running on port ${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;
