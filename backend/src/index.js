require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Import routes
const resumeRoutes = require('./routes/resume');
const jobRoleRoutes = require('./routes/jobRole');
const userRoutes = require('./routes/user');
const analysisRoutes = require('./routes/analysis');
const documentsRoutes = require('./routes/documents');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8080;

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
    res.json({ status: 'Server is running' });
});

// Routes
app.use('/api/resume', resumeRoutes);
app.use('/api/job-role', jobRoleRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/documents', documentsRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`Resume Fixer API running on port ${PORT}`);
});

module.exports = app;
