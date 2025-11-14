# ATS Resume Optimizer - Chrome Extension

A powerful Chrome extension that automatically detects job descriptions on career websites and optimizes your resume to maximize ATS (Applicant Tracking System) compatibility.

## Features

### 🎯 Automatic Job Detection
- Detects job postings on LinkedIn, Indeed, Glassdoor, Monster, and ZipRecruiter
- Extracts job title, company, requirements, and skills automatically
- Visual indicator when a job is detected

### 📄 Multi-Format Resume Support
- Upload resumes in PDF, DOCX, or TXT format (max 5MB)
- Automatic text extraction from uploaded files
- Paste resume text directly

### 📊 ATS Score Analysis
- Comprehensive ATS compatibility score (0-100)
- Detailed breakdown by keyword match, experience relevance, and skills alignment
- Identifies matched and missing keywords
- Actionable improvement suggestions

### ✨ Intelligent Optimization
- Automatically integrates missing keywords naturally
- Reorders content to prioritize relevant experience
- Enhances action verbs for stronger impact
- Maintains authenticity - no fabricated information

### 💾 Multiple Download Formats
- Download optimized resumes in PDF, DOCX, or TXT
- Professional and modern templates
- ATS-friendly formatting

### 📜 Optimization History
- Track all resume optimizations
- View score improvements over time
- Re-download previous versions

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
PORT=5000
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" (toggle in top right)

3. Click "Load unpacked"

4. Select the `extension` directory from this project

5. The extension icon should appear in your Chrome toolbar

## Usage

### 1. Detect Job Description

- Navigate to a job posting on LinkedIn, Indeed, Glassdoor, Monster, or ZipRecruiter
- The extension will automatically detect the job description
- A visual indicator will appear in the top-right corner
- Click the extension icon to open the popup

### 2. Upload Your Resume

- Click the upload area or drag and drop your resume file
- Supported formats: PDF, DOCX, TXT (max 5MB)
- Or paste your resume text directly

### 3. Analyze Resume

- Click "🔍 Analyze Resume"
- View your ATS score and detailed breakdown
- See matched and missing keywords
- Review improvement suggestions

### 4. Optimize Resume

- Click "✨ Optimize Resume"
- View score improvement and changes made
- Review all modifications with explanations

### 5. Get Your Optimized Resume

**Recommended Method (Preserves Your Formatting):**
- Click "📋 Copy Optimized Text"
- Open your original resume file (Word/Google Docs/PDF editor)
- Select all (Ctrl+A / Cmd+A) and paste (Ctrl+V / Cmd+V)
- Your formatting stays, content is optimized!
- Save and submit

**Alternative Method:**
- Download as PDF, DOCX, or TXT (uses standard template)
- Use for quick applications

## Architecture

### Backend Services

- **Job Description Parser**: Extracts structured data from job postings
- **Resume Parser**: Parses resume into structured sections
- **Resume Analyzer**: Calculates ATS score with multi-factor algorithm
- **Resume Optimizer**: Intelligently enhances resume content
- **Document Generator**: Creates downloadable documents in multiple formats

### Chrome Extension

- **Content Script**: Detects job descriptions on web pages
- **Service Worker**: Manages communication and storage
- **Popup UI**: User interface for analysis and optimization
- **Storage Utility**: Handles data persistence

## API Endpoints

### Analysis

- `POST /api/analysis/analyze` - Analyze resume against job description
- `POST /api/analysis/optimize` - Optimize resume based on analysis

### Documents

- `POST /api/documents/upload` - Upload and extract text from resume file
- `POST /api/documents/generate` - Generate optimized resume document

## ATS Score Calculation

The ATS score is calculated using a weighted formula:

- **Keyword Match (40%)**: Percentage of job keywords found in resume
- **Experience Relevance (25%)**: Relevance of past roles to target role
- **Skills Alignment (20%)**: Match between listed skills and required skills
- **Formatting (10%)**: ATS-friendly formatting
- **Completeness (5%)**: Presence of all standard sections

## Security

- AES-256 encryption for data at rest
- TLS 1.3 for data in transit
- Automatic file cleanup after 24 hours
- No data sharing with third parties

## Technologies

### Backend
- Node.js & Express
- PDF parsing (pdf-parse)
- DOCX parsing (mammoth)
- PDF generation (pdfkit)
- DOCX generation (docx)
- File uploads (multer)

### Extension
- Chrome Extension Manifest V3
- Vanilla JavaScript
- Chrome Storage API
- Chrome Tabs API

## Development

### Backend Development

```bash
cd backend
npm run dev
```

### Testing

```bash
cd backend
npm test
```

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── models/          # Data models
│   │   ├── middleware/      # Express middleware
│   │   └── utils/           # Utility functions
│   └── package.json
├── extension/
│   ├── src/
│   │   ├── background/      # Service worker
│   │   ├── contentScript/   # Content script
│   │   ├── popup/           # Popup UI
│   │   ├── utils/           # Utility functions
│   │   └── assets/          # Icons and images
│   └── manifest.json
└── .kiro/
    └── specs/               # Feature specifications
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.

## Roadmap

- [ ] Support for more job boards
- [ ] AI-powered content suggestions
- [ ] Resume templates library
- [ ] Cover letter generation
- [ ] LinkedIn profile optimization
- [ ] Interview preparation tips

---

Built with ❤️ for job seekers everywhere
