# Backend Integration Guide - Job Orbit Routes

**How to integrate Job Orbit routes into your Express backend**

---

## Step 1: Add to Main Index File

**File**: `backend/src/index.js`

Add this line with your other route imports:

```javascript
const jobOrbitRoutes = require('./routes/jobOrbit');
```

Then add this line with your other `app.use()` statements:

```javascript
app.use('/api/job-orbit', jobOrbitRoutes);
```

**Complete Example**:

```javascript
const express = require('express');
const app = express();

// Imports
const analysisRoutes = require('./routes/analysis');
const resumeRoutes = require('./routes/resume');
const jobOrbitRoutes = require('./routes/jobOrbit');  // NEW

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/analysis', analysisRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/job-orbit', jobOrbitRoutes);  // NEW

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Step 2: Verify Dependencies

Check that `axios` is installed in `package.json`:

```bash
npm ls axios
```

If not installed:

```bash
npm install axios
```

---

## Step 3: Test the Routes

### Using cURL

```bash
# Test validate endpoint
curl -X POST http://localhost:3000/api/job-orbit/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"test_key_123"}'

# Test get applications
curl -X GET "http://localhost:3000/api/job-orbit/applications?apiKey=test_key_123"
```

### Using Postman

1. **Create Collection**: "Job Orbit Integration"

2. **Add Request 1**: Validate API Key
   - Method: POST
   - URL: `http://localhost:3000/api/job-orbit/validate`
   - Body (JSON):
   ```json
   {
     "apiKey": "your_job_orbit_api_key"
   }
   ```

3. **Add Request 2**: Sync Applications
   - Method: POST
   - URL: `http://localhost:3000/api/job-orbit/sync`
   - Body (JSON):
   ```json
   {
     "apiKey": "your_job_orbit_api_key",
     "applications": [
       {
         "company": "Google",
         "jobTitle": "Software Engineer",
         "location": "Mountain View, CA",
         "salary": "$250,000",
         "timestamp": "2026-07-02T10:30:00Z",
         "status": "Applied"
       }
     ]
   }
   ```

4. **Add Request 3**: Get Applications
   - Method: GET
   - URL: `http://localhost:3000/api/job-orbit/applications?apiKey=your_job_orbit_api_key&status=Applied`

---

## Step 4: Update API Configuration

### In Extension (popup.js)

Make sure the API_BASE_URL is correct:

```javascript
const API_BASE_URL = 'https://ats-resume-optimizer-359j.onrender.com/api';
// OR for local development:
const API_BASE_URL = 'http://localhost:3000/api';
```

---

## Step 5: Deploy to Production

### If using Render.com (like your backend)

1. Push your changes to GitHub
2. Render automatically redeploys from your connected repository
3. Job Orbit routes will be live immediately

### If using other platform

1. Build the application
2. Deploy using your platform's process
3. Routes will be at: `https://your-domain/api/job-orbit/*`

---

## API Endpoints Reference

### 1. Validate API Key

```
POST /api/job-orbit/validate

Request:
{
  "apiKey": "pk_live_xxx"
}

Response:
{
  "success": true,
  "message": "API key is valid"
}
```

### 2. Sync Applications (Batch)

```
POST /api/job-orbit/sync

Request:
{
  "apiKey": "pk_live_xxx",
  "applications": [
    {
      "company": "Google",
      "jobTitle": "Engineer",
      "location": "Mountain View, CA",
      "salary": "$250K-$350K",
      "jobUrl": "https://...",
      "timestamp": "2026-07-02T10:30:00Z",
      "status": "Applied",
      "notes": "Great benefits"
    }
  ]
}

Response:
{
  "success": true,
  "totalApplications": 1,
  "successCount": 1,
  "results": [...]
}
```

### 3. Create Application

```
POST /api/job-orbit/applications

Request:
{
  "apiKey": "pk_live_xxx",
  "application": {
    "company": "Google",
    "jobTitle": "Engineer",
    ...
  }
}

Response:
{
  "success": true,
  "jobOrbitId": "app_123456",
  "data": {...}
}
```

### 4. Get Applications

```
GET /api/job-orbit/applications?apiKey=pk_live_xxx&status=Applied

Response:
{
  "success": true,
  "applications": [...],
  "total": 10
}
```

### 5. Get Statistics

```
GET /api/job-orbit/statistics?apiKey=pk_live_xxx

Response:
{
  "success": true,
  "total": 50,
  "byStatus": {
    "Applied": 30,
    "Interview": 15,
    "Offer": 3,
    "Rejected": 2
  },
  "successRate": 75
}
```

### 6. Update Application Status

```
PATCH /api/job-orbit/applications/app_123/status

Request:
{
  "apiKey": "pk_live_xxx",
  "status": "Interview"
}

Response:
{
  "success": true,
  "data": {...}
}
```

### 7. Delete Application

```
DELETE /api/job-orbit/applications/app_123

Request:
{
  "apiKey": "pk_live_xxx"
}

Response:
{
  "success": true
}
```

---

## Error Handling

All endpoints return error responses:

```json
{
  "success": false,
  "error": "API key required"
}
```

**Common Errors**:
- `400`: Missing required fields
- `401`: Invalid API key
- `500`: Server error

---

## Testing Workflow

### 1. Local Testing

```bash
# Start backend
npm run dev

# Test in Postman or cURL
# All endpoints should work locally
```

### 2. Staging Testing

```bash
# Deploy to staging environment
# Test all endpoints with real data
# Verify error handling
```

### 3. Production Deployment

```bash
# Deploy to production
# Monitor logs for errors
# Test with real Job Orbit API
```

---

## Troubleshooting

### Issue: "Cannot find module 'routes/jobOrbit'"

**Solution**: Make sure the file exists at `backend/src/routes/jobOrbit.js`

```bash
ls -la backend/src/routes/
# Should see: jobOrbit.js
```

### Issue: "Axios not found"

**Solution**: Install axios

```bash
npm install axios
```

### Issue: "API key validation fails"

**Possible Causes**:
- Invalid API key format
- Job Orbit API down
- Network connectivity issue

**Solution**: 
- Verify API key from Job Orbit dashboard
- Check network connection
- Use cURL to test directly:
```bash
curl -X POST http://localhost:3000/api/job-orbit/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"your_real_api_key"}'
```

---

## Security Notes

### API Key Protection

✅ **DO**:
- Accept API key from request body
- Use HTTPS in production
- Log only error messages, not keys
- Validate key before processing

❌ **DON'T**:
- Log API keys in console
- Store API keys in code
- Send API keys in URLs (use body)
- Hard-code test keys

### Request Validation

Always validate required fields:

```javascript
if (!apiKey) {
  return res.status(400).json({
    success: false,
    error: 'API key required'
  });
}
```

---

## Performance Considerations

### Batch Operations

For syncing many applications, use batch endpoints:

✅ `POST /api/job-orbit/sync` (batch) - More efficient
❌ `POST /api/job-orbit/applications` (single) - One per request

### Caching

Consider caching statistics:

```javascript
// Cache for 1 hour
const cacheDuration = 60 * 60 * 1000;
let cachedStats = null;
let cacheTime = null;

static async getStatistics(apiKey) {
  if (cachedStats && (Date.now() - cacheTime) < cacheDuration) {
    return cachedStats;
  }
  // Fetch from API...
  cachedStats = result;
  cacheTime = Date.now();
  return result;
}
```

---

## Summary

**Integration Checklist**:
- [x] Copy `jobOrbitService.js` to `backend/src/services/`
- [x] Copy `jobOrbit.js` to `backend/src/routes/`
- [ ] Add import to `backend/src/index.js`
- [ ] Add route to `backend/src/index.js`
- [ ] Install axios if needed
- [ ] Test locally with Postman
- [ ] Deploy to production
- [ ] Test with real Job Orbit API
- [ ] Monitor logs for errors

**Status**: Ready for Integration ✅

**Next Step**: Add routes to main `index.js` and deploy

