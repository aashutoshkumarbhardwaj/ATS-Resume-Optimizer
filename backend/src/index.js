/**
 * Backend API — Minimal startup version
 * Starts express server immediately, then lazy-loads all routes.
 * This prevents any heavy service (pdfkit, mongoose, sequelize, NLP) from
 * blocking the event loop before the server is listening.
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Create temp dir ──────────────────────────────────────────────────────────
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ── Middleware ───────────────────────────────────────────────────────────────
const observabilityMiddleware = require('./middleware/observability');
app.use(observabilityMiddleware);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check (always fast) ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Start listening IMMEDIATELY ──────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Resume Fixer API listening on port ${PORT}`);
    console.log(`📊 http://localhost:${PORT}/health\n`);
    // Load routes asynchronously so they don't block the event loop
    setImmediate(loadRoutes);
});

// ── Upload endpoint (inline, no extra service deps) ─────────────────────────
const upload = multer({ dest: tempDir });

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
        const FileUploadService = require('./services/fileUploadService');
        const result = await FileUploadService.processUpload(req.file);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('[Upload] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/resume/parse', async (req, res) => {
    try {
        const ResumeParser = require('./services/resumeParser');
        const { resumeText } = req.body;
        if (!resumeText) return res.status(400).json({ success: false, error: 'resumeText required' });
        const parsed = ResumeParser.parse(resumeText);
        res.json({ success: true, data: parsed });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/analysis/analyze', async (req, res) => {
    try {
        if (req.telemetry) req.telemetry.startTrace('resumeAnalyzer.analyze', 'agent');
        
        const ResumeAnalyzer = require('./services/resumeAnalyzer');
        const { resumeText, jobDescription } = req.body;
        if (!resumeText || !jobDescription) {
            if (req.telemetry) req.telemetry.recordError(new Error('resumeText and jobDescription required'), 'VALIDATION_ERROR');
            return res.status(400).json({ success: false, error: 'resumeText and jobDescription required' });
        }
        const analyzer = new ResumeAnalyzer();
        const result   = await analyzer.analyze(resumeText, jobDescription);
        
        if (req.telemetry) req.telemetry.endTrace('resumeAnalyzer.analyze');
        
        // Mock LLM Latency usage since backend uses heuristic currently
        if (req.telemetry) req.telemetry.recordLLMCall(1420, 350, 42);

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Analyze] Error:', err.message);
        if (req.telemetry) req.telemetry.recordError(err, 'ANALYZER_ERROR');
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Async route loader (runs after server is already listening) ───────────────
async function loadRoutes() {
    const routeMap = [
        ['/api/analysis',      './routes/analysis'],
        ['/api/resume',        './routes/resume'],
        ['/api/documents',     './routes/documents'],
    ];

    for (const [prefix, mod] of routeMap) {
        try {
            const router = require(mod);
            app.use(prefix, router);
            console.log(`✅ ${prefix} routes loaded`);
        } catch (e) {
            console.error(`⚠️  ${prefix} routes skipped: ${e.message}`);
        }
    }

    // Optional: Job Orbit routes
    try { app.use('/api/job-orbit', require('./routes/jobOrbit')); console.log('✅ /api/job-orbit routes loaded'); }
    catch (e) { console.warn('⚠️  job-orbit routes skipped:', e.message); }

    // Optional: Supabase cloud routes
    const cloudRoutes = [
        ['/api/profile',         './routes/profile'],
        ['/api/resumes',         './routes/resumes'],
        ['/api/applications',    './routes/applications'],
        ['/api/ai-memory',       './routes/ai-memory'],
        ['/api/auth',            './routes/auth'],
        ['/api/extension-auth',  './routes/extension-auth'],
    ];
    for (const [prefix, mod] of cloudRoutes) {
        try { app.use(prefix, require(mod)); console.log(`✅ ${prefix} routes loaded`); }
        catch (e) { /* silently skip */ }
    }

    // Optional: MongoDB routes
    if (process.env.MONGODB_URI) {
        try {
            const mongoose = require('mongoose');
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ MongoDB connected');
            app.use('/api/user',     require('./routes/user'));
            app.use('/api/job-role', require('./routes/jobRole'));
        } catch (e) {
            console.warn('⚠️  MongoDB routes skipped:', e.message);
        }
    }

    // 404 handler — must be registered after all routes
    app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    });

    console.log('\n✨ All routes loaded');
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

module.exports = app;
