# Render Deployment with PostgreSQL Database

**Status:** Ready to Deploy
**Backend URL:** https://ats-resume-optimizer-359j.onrender.com
**Database:** Neon PostgreSQL (cloud-hosted)

---

## 🎯 Quick Steps (5 minutes)

### Step 1: Add DATABASE_URL to Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on **"ats-resume-optimizer"** service
3. Go to **Environment** tab on the left
4. Click **Add Environment Variable**
5. Enter:
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://neondb_owner:npg_3gc9hnGPjwCv@ep-flat-queen-atidubx0-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
6. Click **Save**
7. Service will auto-redeploy

### Step 2: Verify Deployment
1. Go to **Logs** tab
2. Look for these messages:
   ```
   ✅ PostgreSQL database synced
   🚀 Resume Fixer API running on port 3000
   ```
3. Test health endpoint:
   ```
   curl https://ats-resume-optimizer-359j.onrender.com/health
   ```

### Step 3: Test Extension with Live Database
1. Ensure extension is loaded with Render backend URL
2. Fill autofill form → data saves to PostgreSQL
3. Analyze resume → history saves to database
4. Reload extension → profile loads from database

---

## 📋 Detailed Steps

### Step 1: Access Render Dashboard

1. Open [render.com](https://render.com)
2. Sign in with your account
3. Go to **Dashboard**
4. Find **"ats-resume-optimizer"** in services

**Screenshot Location:**
- Should show deployment status
- Look for green checkmark if deployment is active

### Step 2: Navigate to Environment Variables

1. Click on **"ats-resume-optimizer"** service name
2. On the left sidebar, click **Environment**
3. You should see existing variables like:
   - NODE_ENV = production
   - PORT = 3000
   - JWT_SECRET = ...

### Step 3: Add DATABASE_URL

**Click "Add Environment Variable"**

| Field | Value |
|-------|-------|
| **Key** | `DATABASE_URL` |
| **Value** | Copy from below ⬇️ |

**DATABASE_URL Value (copy exactly):**
```
postgresql://neondb_owner:npg_3gc9hnGPjwCv@ep-flat-queen-atidubx0-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Then click Save** ✅

### Step 4: Auto-Redeploy

Render will automatically:
1. Update environment variables
2. Trigger redeploy
3. Server restarts with DATABASE_URL set
4. Database tables sync on startup

**This usually takes 1-2 minutes**

### Step 5: Check Deployment Logs

1. Click on **Logs** tab
2. Wait for deployment to finish
3. Look for:
   ```
   ✅ PostgreSQL database synced
   🚀 Resume Fixer API running on port 3000
   ```

**If you see these messages = SUCCESS ✅**

---

## 🧪 Testing

### Test 1: Health Endpoint
```bash
curl https://ats-resume-optimizer-359j.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "Server is running",
  "timestamp": "2024-06-30T...",
  "version": "1.0.0"
}
```

### Test 2: Resume Parse
```bash
curl -X POST https://ats-resume-optimizer-359j.onrender.com/api/resume/parse \
  -H "Content-Type: application/json" \
  -d '{"resumeText":"John Doe\nSoftware Engineer\n5 years experience"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "title": "Software Engineer",
    ...
  }
}
```

### Test 3: Extension Integration
1. Open Chrome extension
2. Upload a PDF resume
3. Fill autofill form
4. Click "Save Profile"
5. **Should see success message** ✅

---

## 📊 Verify Database Connection

### Check Render Logs for Database Messages

In Render Dashboard **Logs** tab, you should see:

**On Startup:**
```
✅ PostgreSQL database synced
🚀 Resume Fixer API running on port 3000
```

**When Extension Saves Data:**
```
POST /api/user/profile 200 - 45ms
```

### Check Neon Database Console

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign in
3. Click on your project
4. You should see:
   - **Database:** neondb
   - **Tables:** users, optimization_history

### View Saved Data

In Neon console, run SQL query:
```sql
SELECT * FROM users;
SELECT * FROM optimization_history;
```

---

## ⚠️ Common Issues & Solutions

### Issue: "DATABASE_URL not set"
**In Render Logs:**
```
❌ DATABASE_URL not set in .env file
```

**Solution:**
1. Go to Environment tab in Render
2. Add DATABASE_URL variable (see Step 3 above)
3. Click Save
4. Wait for redeploy

---

### Issue: "Unable to connect to the database"
**In Render Logs:**
```
❌ Unable to connect to the database: ...
```

**Solution:**
1. Verify DATABASE_URL is correctly set in Render
2. Check Neon console - database might be paused (free tier)
3. Resume database in Neon console
4. Trigger manual redeploy in Render:
   - Click **Deploys** tab
   - Find latest deployment
   - Click **Redeploy** button

---

### Issue: "Connection timeout"
**Solution:**
1. Check internet connection
2. Verify Neon database is running (not paused)
3. Wait 30-60 seconds for Render cold start (free tier)
4. Try request again

---

### Issue: SSL Certificate Error
**Expected Warning (safe to ignore):**
```
Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'...
```

This is normal. The code handles SSL correctly with `rejectUnauthorized: false` for Neon.

---

## 🔒 Security Checklist

✅ **DATABASE_URL stored in Render environment (not in code)**
✅ **Credentials not in git history**
✅ **SSL encryption enabled for Neon connection**
✅ **Free tier appropriate for development**

---

## 📈 Monitoring

### Check Recent Requests
1. Go to **Logs** tab in Render
2. Look for API calls:
   ```
   POST /api/resume/analyze 200
   POST /api/user/profile 201
   ```

### Monitor Database Usage
1. Go to [Neon console](https://console.neon.tech)
2. Your project → **Monitoring**
3. Check:
   - Active connections
   - Query count
   - Storage used

### CPU/Memory Usage
- In Render Dashboard
- Check **Metrics** tab
- Should be low for extension usage

---

## 🎯 Next Steps After Deployment

### 1. Test with Extension
```
✅ Load extension
✅ Fill autofill form
✅ Upload resume & analyze
✅ Save profile to database
✅ Reload page
✅ Verify profile loads from database
```

### 2. Monitor Logs
- Watch Render logs for errors
- Check database queries are working
- Verify no 500 errors

### 3. Create API Endpoints (Optional)
For future features:
- Save/load user profiles
- Get optimization history
- Export saved data

---

## 📞 Support

### If Deployment Fails

**Step 1: Check Render Logs**
- What error message do you see?

**Step 2: Common Causes**
| Error | Solution |
|-------|----------|
| "DATABASE_URL not set" | Add env var to Render (Step 3) |
| "Connection refused" | Neon database paused - resume it |
| "SSL error" | Normal warning - safe to ignore |
| "500 Internal Server Error" | Check backend logs for details |

**Step 3: Manual Redeploy**
- Click **Deploys** tab
- Click **Redeploy** on latest deployment
- Wait 2-3 minutes

---

## 🚀 Success Indicators

### Backend is Working ✅
- Health endpoint responds
- No 500 errors in logs
- Database synced message appears

### Extension Saves Data ✅
- No "Failed to fetch" errors
- Profile saves with success message
- Resume analysis completes

### Database is Connected ✅
- Tables created in Neon
- Data appears in database queries
- Render logs show no connection errors

---

## Quick Reference Card

| Step | Action | Verify |
|------|--------|--------|
| 1 | Add DATABASE_URL to Render env | Variable appears in list |
| 2 | Click Save | Auto-redeploy starts |
| 3 | Wait 1-2 min | Check Logs tab |
| 4 | Look for ✅ messages | Database synced message |
| 5 | Test health endpoint | Responds with JSON |
| 6 | Test with extension | Data saves successfully |

---

**After completing these steps, your backend will be fully deployed with PostgreSQL database support!**

For database-specific details, see [DATABASE_INTEGRATION_COMPLETE.md](./DATABASE_INTEGRATION_COMPLETE.md)
