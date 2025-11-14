# Quick Start Guide

## ⚠️ Important: Port Configuration

The backend server is configured to run on **port 8080** by default.

### Starting the Backend

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Kill any existing processes on port 8080:**
```bash
# On macOS/Linux
lsof -ti:8080 | xargs kill -9

# On Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

3. **Start the server:**
```bash
npm start
```

You should see:
```
Created temp directory
Resume Fixer API running on port 8080
```

### If Port 8080 is Busy

Create a `.env` file in the `backend` directory:
```env
PORT=9000
```

Then update `extension/src/popup/popup.js`:
```javascript
const API_BASE_URL = 'http://localhost:9000/api';
```

## Loading the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension icon should appear in your toolbar

## Testing the Extension

1. Go to a job posting on LinkedIn, Indeed, or Glassdoor
2. The extension should auto-detect the job (look for the indicator)
3. Click the extension icon
4. Upload your resume (PDF, DOCX, or TXT)
5. Click "Analyze Resume"
6. Click "Optimize Resume"
7. Download in your preferred format!

## Troubleshooting

### 403 Forbidden Error
- **Cause**: Backend server not running or wrong port
- **Fix**: Ensure backend is running on port 8080 and check console for errors

### CORS Error
- **Cause**: Browser blocking cross-origin requests
- **Fix**: Backend already configured with CORS. Reload extension after starting backend.

### File Upload Error
- **Cause**: Temp directory doesn't exist
- **Fix**: The server creates it automatically. Check backend/temp folder exists.

### Extension Not Detecting Jobs
- **Cause**: Website structure changed or unsupported site
- **Fix**: Use manual paste mode - copy job description and paste into the text area

## Supported Job Boards

✅ LinkedIn
✅ Indeed  
✅ Glassdoor
✅ Monster
✅ ZipRecruiter

For other sites, use manual paste mode.

## Need Help?

Check the console logs:
- **Backend**: Terminal where you ran `npm start`
- **Extension**: Right-click extension icon → "Inspect popup" → Console tab

## Current Configuration

- **Backend Port**: 8080
- **API Base URL**: http://localhost:8080/api
- **Max File Size**: 5MB
- **Supported Formats**: PDF, DOCX, TXT
- **Cache TTL**: 1 hour
- **File Cleanup**: 24 hours

---

**Ready to optimize your resume!** 🚀
