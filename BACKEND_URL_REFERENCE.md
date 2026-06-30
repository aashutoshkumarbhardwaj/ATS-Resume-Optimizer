# Backend URL Reference

## Production Backend URL

```
https://ats-resume-optimizer-359j.onrender.com
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/analysis/analyze` | POST | Analyze resume against job description |
| `/api/analysis/optimize` | POST | Optimize resume for job description |
| `/api/documents/upload` | POST | Upload resume file (PDF/DOCX/TXT) |
| `/api/documents/generate` | POST | Generate optimized resume (PDF/DOCX/TXT) |
| `/api/resume/parse` | POST | Parse resume text to extract data |

## All Files Using This URL

### Frontend Files (6 total)

1. **`extension/src/popup/popup.js`**
   ```javascript
   const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
   ```

2. **`extension/src/background/service-worker.js`**
   ```javascript
   const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
   ```

3. **`extension/src/utils/api.js`**
   ```javascript
   const BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
   ```

4. **`extension/src/utils/constants.js`**
   ```javascript
   export const API_CONFIG = {
       BASE_URL: 'https://ats-resume-optimizer-359j.onrender.com/api',
       TIMEOUT: 30000,
   };
   ```

5. **`extension/config.js`**
   ```javascript
   DEV_API_BASE_URL: 'https://ats-resume-optimizer-359j.onrender.com/api',
   ```

6. **`extension/src/popup/popup-fixed.js`**
   ```javascript
   const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
   ```

## Test Endpoints

### Health Check
```bash
curl https://ats-resume-optimizer-359j.onrender.com/health
```

Response:
```json
{
  "status": "Server is running",
  "timestamp": "2024-...",
  "version": "1.0.0"
}
```

### Resume Analysis
```bash
curl -X POST https://ats-resume-optimizer-359j.onrender.com/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "resumeText": "Your resume text here",
    "jobDescription": "Job description here"
  }'
```

### File Upload
```bash
curl -X POST https://ats-resume-optimizer-359j.onrender.com/api/documents/upload \
  -F "file=@path/to/resume.pdf"
```

## Important Notes

### Cold Start
- First request: 30-60 seconds
- Subsequent: 1-2 seconds
- Service wakes on first request

### Auto-Sleep
- Happens after 15 minutes of inactivity (free tier)
- Normal behavior for free plan
- Service wakes automatically on next request

### CORS
- Enabled for all origins
- Allows cross-origin requests from extension

### File Upload
- Max size: 5MB
- Formats: PDF, DOCX, TXT
- Stored in `/backend/temp/` on Render

## When to Use This URL

✅ Always use: `https://ats-resume-optimizer-359j.onrender.com/api`

❌ Don't use: `http://localhost:3000/api`

The Render URL is production and handles all requests.

## Updating the URL in Future

If you need to change the backend URL in the future:

1. Update all 6 files listed above
2. Change the URL in each file
3. Reload extension
4. Test all features

That's it! The extension will use the new URL.

## Connection Test

To verify extension can reach backend:

1. Open extension popup
2. Open DevTools (F12)
3. Go to Console
4. Try "Analyze" with any content
5. Should see logs like:
   ```
   [Background] Analyzing resume...
   [Background] Analysis complete
   ```

If you see "Failed to fetch" instead, the URL is wrong or backend is down.

## Platform Info

| Item | Value |
|------|-------|
| Platform | Render |
| Plan | Free |
| Region | Ohio (us-east) |
| Runtime | Node.js |
| Domain | ats-resume-optimizer-359j.onrender.com |

## Dashboard

Access Render dashboard: https://dashboard.render.com

From there you can:
- View logs
- Check status
- Manage environment variables
- Redeploy
- Upgrade plan
- Set up monitoring

## Support

If backend issues occur:

1. Check Render dashboard logs
2. Verify URL is correct in extension
3. Test with curl command above
4. Wait 30-60 seconds for cold start
5. Check if service is sleeping (happens after 15 min inactivity)

---

**Backend URL: `https://ats-resume-optimizer-359j.onrender.com`**

All files have been updated to use this URL. ✅
