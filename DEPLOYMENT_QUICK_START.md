# Deploy to Render - Quick Start (5 Minutes)

## TL;DR - Just Do This

### 1. Push to GitHub
```bash
cd backend
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Go to Render
- Visit: https://render.com
- Sign up with GitHub
- Click "New +" → "Web Service"

### 3. Configure
| Setting | Value |
|---------|-------|
| Repository | ATS-Resume-Optimizer |
| Name | resume-fixer-api |
| Environment | Node |
| Branch | main |
| Root Directory | **backend** |
| Build Command | `npm install` |
| Start Command | `npm start` |

### 4. Add Environment Variables
```
NODE_ENV=production
PORT=3000
```

### 5. Click "Create Web Service"
Wait 5-10 minutes for deployment...

### 6. Get Your URL
You'll see: `https://resume-fixer-api-xxxxx.onrender.com`

### 7. Update Extension
File: `extension/src/popup/popup.js`

Change:
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

To:
```javascript
const API_BASE_URL = 'https://resume-fixer-api-xxxxx.onrender.com/api';
```

### 8. Reload Extension
- `chrome://extensions/`
- Click refresh on Resume Fixer
- Done! ✅

---

## Verify It Works

Test with curl:
```bash
curl https://resume-fixer-api-xxxxx.onrender.com/health
```

Should see:
```json
{"status": "Server is running"}
```

---

## Common Issues

### "Failed to fetch" in extension
- Wrong API URL in popup.js
- Service still deploying
- Wait 2-3 minutes

### Deployment fails
- Check Render logs
- Make sure `backend` is root directory
- All dependencies installed locally

### Can't find Render logs
- Dashboard → Your service → Logs tab

---

## That's It!

Your backend is now deployed to Render and your extension uses it! 🚀

See `RENDER_DEPLOYMENT_GUIDE.md` for detailed info.
