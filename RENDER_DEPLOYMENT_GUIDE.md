# Deploy Backend to Render - Complete Guide

## Overview

Render is a modern hosting platform that makes deploying Node.js applications simple. This guide will walk you through deploying your Resume Fixer backend to Render.

**Time Required:** ~10-15 minutes

---

## Prerequisites

1. ✅ GitHub account (you already have this)
2. ✅ Render account (free tier available)
3. ✅ Backend pushed to GitHub
4. ✅ `.env` file properly configured

---

## Step 1: Create Render Account

1. Go to [https://render.com](https://render.com)
2. Click "Sign Up"
3. Choose "Sign up with GitHub" (easiest option)
4. Authorize Render to access your GitHub
5. Complete signup

---

## Step 2: Prepare Your Repository

### Update .env File

Make sure your `.env` file has the right settings:

```env
PORT=3000
NODE_ENV=production
API_BASE_URL=https://your-render-service.onrender.com/api
```

### Commit to GitHub

```bash
cd /Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

---

## Step 3: Create Web Service on Render

### 3.1 Go to Render Dashboard
1. Log in to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

### 3.2 Connect GitHub Repository
1. Choose **"Deploy an existing repository"**
2. If GitHub is already connected, select:
   - **Repository:** `ATS-Resume-Optimizer`
   - Click **"Connect"**
3. If not connected:
   - Click "Connect account"
   - Authorize Render on GitHub
   - Then select repository

### 3.3 Configure Service

Fill in the following settings:

| Setting | Value |
|---------|-------|
| **Name** | `resume-fixer-api` |
| **Environment** | `Node` |
| **Region** | `Ohio (us-east)` or closest to you |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### 3.4 Environment Variables

1. Scroll to **"Environment"** section
2. Add the following variables:

```
NODE_ENV=production
PORT=3000
API_BASE_URL=https://your-render-service.onrender.com/api
```

**Note:** You'll get the actual URL after deployment completes. Come back to update this if needed.

### 3.5 Plan Selection

- Choose **Free Plan** to start (no credit card required)
- You can upgrade later if needed

### 3.6 Create Service

Click **"Create Web Service"**

---

## Step 4: Monitor Deployment

1. **Deployment will start automatically**
2. Watch the logs in real-time:
   - Green checkmarks = Success
   - Red X = Error
3. **Wait for:**
   ```
   ✅ Build successful
   ✅ Deployed successfully
   ```

### Common Deployment Logs

**Success:**
```
npm info it worked if it ends with ok
added X packages in Xs
npm info ok
✅ Build successful
✅ Service deployed successfully
```

**If it fails:**
- Check error messages in log
- Most common: Missing environment variables
- See troubleshooting section below

---

## Step 5: Get Your Deployment URL

1. After deployment completes, you'll see a URL like:
   ```
   https://resume-fixer-api-xxxx.onrender.com
   ```

2. **Test the API:**
   ```bash
   curl https://resume-fixer-api-xxxx.onrender.com/health
   ```
   
   Should return:
   ```json
   {
     "status": "Server is running",
     "timestamp": "2024-...",
     "version": "1.0.0"
   }
   ```

---

## Step 6: Update Extension Configuration

### Update Extension API URL

Edit: `extension/src/popup/popup.js`

**Find this line:**
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

**Change it to:**
```javascript
const API_BASE_URL = 'https://resume-fixer-api-xxxx.onrender.com/api';
```

Replace `xxxx` with your actual Render service ID.

### Reload Extension

1. Go to `chrome://extensions/`
2. Find "Resume Fixer"
3. Click refresh icon
4. Test with uploaded resume

---

## Step 7: Handle Auto-Sleep (Free Plan)

**Important for Free Plan:**

Render's free tier spins down services after 15 minutes of inactivity.

**When someone uses your API:**
- First request takes 30-60 seconds (cold start)
- Subsequent requests are fast
- Service stays awake for 15 minutes after last request

**Optional: Prevent Sleep**

Use a free uptime monitor service to ping your API every 14 minutes:

1. Go to [https://www.uptimerobot.com](https://www.uptimerobot.com)
2. Sign up (free tier)
3. Create monitor:
   - **URL:** `https://resume-fixer-api-xxxx.onrender.com/health`
   - **Interval:** 14 minutes
4. Service stays awake 24/7

---

## Step 8: Verify Everything Works

### Test Cases

1. **API Health Check**
   ```bash
   curl https://resume-fixer-api-xxxx.onrender.com/health
   ```
   ✅ Should return status

2. **File Upload**
   - Open extension
   - Upload PDF file
   - Should work without errors

3. **Resume Analysis**
   - Paste job description
   - Paste resume
   - Click "Analyze"
   - Should return results (not "Failed to fetch")

4. **Autofill**
   - Visit job site
   - Badge should appear
   - Should show profile data

---

## Troubleshooting

### Issue: "Failed to fetch" Error

**Possible Causes:**
1. Service still deploying
2. Wrong API URL in extension
3. CORS settings incorrect

**Solution:**
1. Check Render dashboard - is deployment complete?
2. Test URL with curl: `curl https://your-url.onrender.com/health`
3. If no response, wait 2-3 minutes and try again

### Issue: Service Deployed but Not Working

**Check logs:**
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. Look for error messages

**Common Errors:**

**"Cannot find module"**
```
Solution: Run `npm install` locally, commit package-lock.json
git add backend/package-lock.json
git commit -m "Update package lock"
git push
```

**"PORT not defined"**
```
Solution: Add to environment variables in Render dashboard:
PORT=3000
```

**"File upload fails"**
```
Solution: Make sure temp directory exists
Already handled in your code, but verify:
- /backend/temp/ directory exists in repo
- Or temp directory created by code
```

### Issue: Service Goes to Sleep

**Expected on Free Plan**
- This is normal
- Use UptimeRobot (see Step 7) to keep it awake
- Or upgrade to Paid Plan

### Issue: Can't Connect Extension to Deployed Backend

1. Make sure API URL is correct in popup.js
2. Check CORS is enabled (it is in your code)
3. Reload extension after changing URL
4. Clear browser cache
5. Check Render logs for errors

---

## Important Notes

### Free Plan Limitations

| Feature | Free Plan | Paid Plan |
|---------|-----------|-----------|
| Monthly Uptime | 99.9% | 99.95% |
| Memory | 512 MB | 2+ GB |
| Auto Sleep | Yes (after 15 min) | No |
| Bandwidth | Ample | More |
| Cost | Free | $7+/month |

### Your Backend Size

Your backend is **~50-100 MB** installed, which fits easily in free tier.

### Deployment Limits

- Max 12 concurrent deployments per month (free)
- Unlimited deploys if you upgrade

---

## Next Steps

### After Successful Deployment

1. ✅ Test all features
2. ✅ Monitor logs for errors
3. ✅ Share deployment URL with team
4. ✅ Update documentation with new API URL
5. ✅ (Optional) Set up UptimeRobot to prevent sleep
6. ✅ (Optional) Upgrade to paid if needed

### Keep Backend Running

**Local development:**
```bash
npm start  # Still runs on localhost:3000
```

**Production (Render):**
```
Automatically starts via Render
No manual action needed
```

---

## Quick Reference

### Your Deployment Info

| Item | Value |
|------|-------|
| **Service Name** | `resume-fixer-api` |
| **Platform** | Render (Free) |
| **Region** | Ohio (us-east) |
| **Runtime** | Node.js |
| **Start Command** | `npm start` |
| **URL** | `https://resume-fixer-api-xxxx.onrender.com` |
| **Health Check** | `/health` endpoint |

### Useful Links

- **Render Dashboard:** https://dashboard.render.com
- **Your Service Logs:** Will be available after deployment
- **Render Docs:** https://render.com/docs
- **UptimeRobot:** https://www.uptimerobot.com

---

## Success Checklist

- [ ] Render account created
- [ ] Repository pushed to GitHub
- [ ] Web Service created on Render
- [ ] Deployment completed successfully
- [ ] Health check endpoint responds
- [ ] API URL works with curl
- [ ] Extension updated with new API URL
- [ ] Extension reloaded
- [ ] PDF upload works
- [ ] Resume analysis works
- [ ] Badge appears on job sites
- [ ] All features functioning

---

## Support

If deployment fails:

1. **Check Render logs** - Most errors are shown there
2. **Review this guide** - Troubleshooting section above
3. **Common fix:** Delete service and try again
4. **Last resort:** Use local backend (`localhost:3000`)

---

**Status:** Ready to deploy! 🚀

Follow the steps above and your backend will be live on Render within 5-10 minutes.
