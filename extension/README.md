# Resume Fixer Chrome Extension

A Chrome extension that helps optimize your resume for specific job roles.

## Quick Start

1. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this folder

2. Click the Resume Fixer icon in the toolbar

3. Fill in:
   - Job Role
   - Job Description
   - Your Resume

4. Click "Analyze & Optimize"

## Features

- ✅ Real-time resume analysis
- ✅ Keyword matching
- ✅ Smart suggestions
- ✅ Resume optimization
- ✅ Local data storage

## Project Structure

```
src/
├── popup/           # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/      # Service worker
│   └── service-worker.js
├── contentScript/   # Page content script
│   └── content-script.js
├── assets/          # Icons and images
│   ├── icons/
│   └── styles/
└── utils/           # Helper functions
    ├── storage.js
    ├── api.js
    └── constants.js
```

## API Integration

The extension communicates with the backend API at `http://localhost:5000/api`

### Endpoints Used
- POST `/api/resume/analyze` - Analyze resume
- POST `/api/resume/optimize` - Optimize resume
- GET `/api/job-role/:title` - Get job role details

## Permissions

The extension requires:
- `activeTab` - Access current tab
- `scripting` - Inject scripts
- `storage` - Store user data locally
- `webRequest` - Make API calls

## Development

### Build
```bash
npm install
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Production
```bash
npm run prod
```

## Testing

1. Open the extension popup
2. Fill in test data
3. Check the console for logs
4. Verify API responses

## Troubleshooting

- **Extension not responding**: Check browser console for errors
- **API errors**: Ensure backend is running on port 5000
- **Storage issues**: Clear extension storage and reload

---

For more information, see the main [README.md](../README.md)
