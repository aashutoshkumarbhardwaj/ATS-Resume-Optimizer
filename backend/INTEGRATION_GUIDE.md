# DOM Extraction Service - Integration Guide

## ⚡ Quick Setup

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

This installs the required `node-html-parser` package along with other dependencies.

### Step 2: Run Tests
```bash
# Run all DOM extraction tests
npm test -- domExtractor.test.js

# Run integration tests
npm test -- domExtractor.integration.test.js

# Run all tests
npm test
```

### Step 3: Run Examples
```bash
node src/services/domExtractor.example.js
```

## 📦 What Was Added

### Core Service (`src/services/domExtractor.js`)
- Main extraction class with 365 lines of code
- Support for 9+ job portals
- Intelligent noise filtering
- Confidence scoring and validation

### Test Suites
- **Unit Tests**: 45+ tests covering core functionality
- **Integration Tests**: 35+ tests for each portal
- **Total Coverage**: 80+ test cases

### Documentation
- `DOM_EXTRACTION.md` - Comprehensive documentation
- `DOM_EXTRACTION_SUMMARY.md` - Quick reference
- `domExtractor.example.js` - 10 practical examples
- `jest.config.js` - Jest configuration

### Dependencies Added
- `node-html-parser@^6.1.11` - For DOM parsing in Node.js

## 🚀 Quick Start

### Basic Usage

```javascript
const DOMExtractor = require('./services/domExtractor');

// Create extractor instance
const extractor = new DOMExtractor();

// Extract job data from HTML
const result = extractor.extractFromHTML(htmlContent);

// Check if extraction was successful
if (result.isValid) {
    console.log('Job Title:', result.jobTitle);
    console.log('Company:', result.company);
    console.log('Location:', result.location);
    console.log('Confidence:', result.confidence + '%');
} else {
    console.log('Extraction confidence too low:', result.confidence);
}
```

### Portal Detection

```javascript
const extractor = new DOMExtractor();

// Detect which portal the HTML is from
const portal = extractor.detectPortal(htmlContent);
console.log('Detected portal:', portal);
// Output: 'linkedin', 'greenhouse', 'lever', 'workday', 'ashby', 'smartrecruiters', 'indeed', 'wellfound', 'naukri', or 'generic'
```

## 🔌 API Integration

### Option 1: Add New Route

Create a new route file `src/routes/jobExtraction.js`:

```javascript
const express = require('express');
const router = express.Router();
const DOMExtractor = require('../services/domExtractor');

const extractor = new DOMExtractor();

/**
 * POST /api/job-extraction/extract
 * Extract job data from provided HTML
 */
router.post('/extract', (req, res) => {
    try {
        const { html } = req.body;

        if (!html) {
            return res.status(400).json({
                success: false,
                error: 'HTML content is required'
            });
        }

        const result = extractor.extractFromHTML(html);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/job-extraction/detect-portal
 * Detect job portal from HTML
 */
router.post('/detect-portal', (req, res) => {
    try {
        const { html } = req.body;

        if (!html) {
            return res.status(400).json({
                success: false,
                error: 'HTML content is required'
            });
        }

        const portal = extractor.detectPortal(html);

        res.json({
            success: true,
            portal: portal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
```

Add to `src/index.js`:

```javascript
try {
    const jobExtractionRoutes = require('./routes/jobExtraction');
    app.use('/api/job-extraction', jobExtractionRoutes);
    console.log('✅ Job extraction routes loaded');
} catch (e) {
    console.error('❌ Job extraction routes failed:', e.message);
}
```

### Option 2: Integrate with Existing Analysis Route

Add to `src/routes/analysis.js`:

```javascript
const DOMExtractor = require('../services/domExtractor');
const extractor = new DOMExtractor();

/**
 * Enhanced analysis endpoint with DOM extraction
 */
router.post('/analyze-from-html', (req, res) => {
    try {
        const { html, resumeText } = req.body;

        // Extract job data from HTML
        const jobData = extractor.extractFromHTML(html);

        if (!jobData.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Could not extract sufficient job data',
                confidence: jobData.confidence
            });
        }

        // Reconstruct full job description for analysis
        const jobDescription = `
            Title: ${jobData.jobTitle}
            Company: ${jobData.company}
            Location: ${jobData.location}
            Type: ${jobData.employmentType}
            Salary: ${jobData.salary}
            
            ${jobData.fullDescription}
        `;

        // Pass to existing analysis logic
        const analysis = performAnalysis(resumeText, jobDescription);

        res.json({
            success: true,
            jobData,
            analysis
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

## 📋 File Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── domExtractor.js                    # ✨ NEW - Core service
│   │   ├── domExtractor.example.js            # ✨ NEW - Usage examples
│   │   └── __tests__/
│   │       ├── domExtractor.test.js           # ✨ NEW - Unit tests (45+)
│   │       └── domExtractor.integration.test.js # ✨ NEW - Integration tests (35+)
│   ├── routes/
│   │   ├── analysis.js                        # 🔄 Can integrate here
│   │   ├── resume.js
│   │   ├── documents.js
│   │   └── jobExtraction.js                   # 📝 NEW (optional)
│   └── index.js                               # 🔄 Update to load routes
├── jest.config.js                             # ✨ NEW - Test configuration
├── package.json                               # 🔄 Added node-html-parser
├── DOM_EXTRACTION.md                          # ✨ NEW - Full documentation
├── DOM_EXTRACTION_SUMMARY.md                  # ✨ NEW - Quick reference
└── INTEGRATION_GUIDE.md                       # 📝 THIS FILE

Legend:
✨ NEW - Newly added files
🔄 Updated - Files modified
📝 Documentation - Reference files
```

## 🧪 Testing

### Run Unit Tests
```bash
npm test -- domExtractor.test.js
```

Expected output:
```
PASS  src/services/__tests__/domExtractor.test.js
  DOMExtractor
    Portal Detection (10 tests)
      ✓ should detect LinkedIn portal
      ✓ should detect Greenhouse portal
      ...
    Content Selectors (5 tests)
      ✓ should have selectors for all portals
      ...
    Text Extraction (3 tests)
      ✓ should extract clean text from elements
      ...
    Experience Level Extraction (4 tests)
      ✓ should detect Senior level
      ...
    Skills Extraction (3 tests)
      ✓ should extract technical skills from text
      ...
    Confidence Score Calculation (3 tests)
      ✓ should calculate confidence score for complete job data
      ...
    Post-Processing and Validation (5 tests)
      ✓ should validate extracted data structure
      ...
    Error Handling (2 tests)
      ✓ should throw error for invalid HTML input
      ...

Test Suites: 1 passed, 1 total
Tests: 45 passed, 45 total
```

### Run Integration Tests
```bash
npm test -- domExtractor.integration.test.js
```

### Run All Tests with Coverage
```bash
npm test -- --coverage
```

## 📊 Supported Portals

| # | Portal | Detection | Tests | Example |
|---|--------|-----------|-------|---------|
| 1 | LinkedIn | ✅ | 2 | LinkedIn job pages |
| 2 | Greenhouse | ✅ | 2 | Greenhouse careers |
| 3 | Lever | ✅ | 2 | Lever jobs |
| 4 | Workday | ✅ | 2 | Workday careers |
| 5 | Ashby | ✅ | 2 | Ashby jobs |
| 6 | SmartRecruiters | ✅ | 2 | SmartRecruiters jobs |
| 7 | Indeed | ✅ | 2 | Indeed job pages |
| 8 | Wellfound | ✅ | 2 | Wellfound jobs |
| 9 | Naukri | ✅ | 2 | Naukri jobs |
| 10 | Generic | ✅ | 3 | Standard career pages |

## 🎯 Usage Example

### Complete Workflow

```javascript
const DOMExtractor = require('./services/domExtractor');
const fs = require('fs');

// Read HTML file (or fetch from URL)
const html = fs.readFileSync('job-posting.html', 'utf8');

// Create extractor
const extractor = new DOMExtractor();

// Step 1: Detect portal
const portal = extractor.detectPortal(html);
console.log('📍 Portal detected:', portal);

// Step 2: Extract job data
const jobData = extractor.extractFromHTML(html);

// Step 3: Validate extraction
console.log('✨ Extraction confidence:', jobData.confidence + '%');
console.log('📋 Data valid:', jobData.isValid ? 'Yes' : 'No');

// Step 4: Use extracted data
if (jobData.isValid) {
    console.log('💼 Job Title:', jobData.jobTitle);
    console.log('🏢 Company:', jobData.company);
    console.log('📍 Location:', jobData.location);
    console.log('⏱️  Type:', jobData.employmentType);
    console.log('💰 Salary:', jobData.salary || 'Not specified');
    console.log('📊 Experience:', jobData.experience);
    console.log('🎯 Skills:', jobData.skills.join(', '));
    console.log('✅ Responsibilities:', jobData.responsibilities.length);
    console.log('📋 Requirements:', jobData.requirements.length);
    console.log('🎁 Benefits:', jobData.benefits.length);
}
```

## 🔧 Customization

### Adding New Portal Support

1. **Add Portal Detection** in `buildPortalDetectors()`:
```javascript
myportal: (html, dom) => {
    return html.includes('myportal.com') || 
           dom.querySelector('[data-myportal-id]') !== null;
}
```

2. **Add Portal Selectors** in `buildContentSelectors()`:
```javascript
myportal: {
    title: ['h1.job-title', '[data-job-title]'],
    company: ['.company-name', '[data-company]'],
    // ... other selectors
}
```

3. **Add Tests** in `__tests__/domExtractor.test.js`:
```javascript
test('should detect MyPortal', () => {
    const html = '<div data-myportal-id>...</div>';
    expect(extractor.portalDetectors.myportal(html)).toBe(true);
});
```

## 🐛 Debugging

### Enable Debug Logging

```javascript
const extractor = new DOMExtractor();

// Add console logging in extractFromHTML
const originalDetect = extractor.detectPortal;
extractor.detectPortal = function(html) {
    const portal = originalDetect.call(this, html);
    console.log('[DEBUG] Detected portal:', portal);
    return portal;
};

const result = extractor.extractFromHTML(html);
console.log('[DEBUG] Extraction result:', result);
```

### Common Issues

**Issue**: Low confidence score
- Check if all fields are present in HTML
- Try different job postings
- Verify portal is supported

**Issue**: Empty fields
- Field may not be in HTML
- Selectors may need updating
- Content might be JavaScript-rendered

**Issue**: Wrong portal detected
- Verify URL/domain
- Check HTML structure
- Update detection patterns

## 📈 Performance Optimization

### Reuse Extractor Instance

```javascript
// ✅ Good - Reuse instance
const extractor = new DOMExtractor();

for (let i = 0; i < 100; i++) {
    const result = extractor.extractFromHTML(htmlArray[i]);
    // Process result
}

// ❌ Avoid - Creating new instance each time
for (let i = 0; i < 100; i++) {
    const extractor = new DOMExtractor(); // Inefficient
    const result = extractor.extractFromHTML(htmlArray[i]);
}
```

### Parallel Processing

```javascript
const extractor = new DOMExtractor();
const htmlArray = [...]; // Array of HTML contents

// Process multiple extractions in parallel
const results = await Promise.all(
    htmlArray.map(html => 
        Promise.resolve(extractor.extractFromHTML(html))
    )
);
```

## ✅ Pre-Integration Checklist

- [ ] Install dependencies: `npm install`
- [ ] Run unit tests: `npm test -- domExtractor.test.js`
- [ ] Run integration tests: `npm test -- domExtractor.integration.test.js`
- [ ] Review documentation: `DOM_EXTRACTION.md`
- [ ] Run examples: `node src/services/domExtractor.example.js`
- [ ] Test with real job postings
- [ ] Add to API routes (see Option 1 or 2 above)
- [ ] Update API documentation
- [ ] Deploy to staging
- [ ] Monitor extraction quality
- [ ] Update production

## 📞 Support

### Getting Help

1. **Read Documentation**: `DOM_EXTRACTION.md`
2. **Review Examples**: `domExtractor.example.js`
3. **Check Tests**: `__tests__/domExtractor.test.js`
4. **Debug Issues**: Add logging as shown above

### Reporting Issues

Include:
- HTML sample (anonymized)
- Expected vs. actual output
- Confidence score
- Portal type
- Browser/version if applicable

## 🎉 Next Steps

1. **Install dependencies**: `npm install`
2. **Run tests**: `npm test`
3. **Review examples**: `node domExtractor.example.js`
4. **Integrate with API**: Follow Option 1 or 2 above
5. **Test with real data**: Use actual job postings
6. **Deploy**: Add to production when ready

Enjoy the improved DOM extraction! 🚀
