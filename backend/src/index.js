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
