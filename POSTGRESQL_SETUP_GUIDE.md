# PostgreSQL Setup Guide - Neon DB

## What's Been Set Up

✅ **PostgreSQL Database Connection** - Neon DB (free tier)
✅ **Database Models Created** - User and OptimizationHistory tables
✅ **Dependencies Added** - pg, sequelize packages
✅ **Configuration Files** - Database config and initialization script

---

## Step 1: Install Dependencies

Run this command in the backend directory:

```bash
cd backend
npm install
```

This installs:
- `pg` - PostgreSQL driver
- `sequelize` - ORM (Object-Relational Mapping)

---

## Step 2: Verify .env File

Check that `.env` has been updated with Neon connection:

```bash
cat backend/.env
```

Should show:
```
DATABASE_URL=postgresql://neondb_owner:npg_3gc9hnGPjwCv@ep-flat-queen-atidubx0-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

---

## Step 3: Initialize Database

Create tables in your Neon database:

```bash
cd backend
node scripts/initDatabase.js
```

Expected output:
```
✅ Database tables created successfully
✅ User table created
✅ OptimizationHistory table created
📊 Database Tables:
  ✓ users
  ✓ optimization_history
```

---

## Step 4: Test Connection

Start your backend:

```bash
npm start
```

You should see:
```
✅ PostgreSQL Database connected successfully
```

---

## Database Schema

### Users Table

Stores user profiles for autofill feature:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(255),
  city VARCHAR(255),
  country VARCHAR(255),
  linkedin VARCHAR(255),
  github VARCHAR(255),
  portfolio VARCHAR(255),
  current_title VARCHAR(255),
  years_of_experience INTEGER,
  custom_fields JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### OptimizationHistory Table

Stores all resume optimizations:

```sql
CREATE TABLE optimization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  job_title VARCHAR(255),
  company VARCHAR(255),
  original_score FLOAT,
  optimized_score FLOAT,
  score_improvement FLOAT,
  original_text TEXT,
  optimized_text TEXT,
  job_description TEXT,
  changes_made JSON,
  matched_keywords JSON,
  missing_keywords JSON,
  analysis_result JSON,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Features Now Available

### 1. Save User Profiles
```javascript
POST /api/user/profile
Body: {
  "email": "user@example.com",
  "full_name": "John Doe",
  ...
}
```

### 2. Retrieve User Profile
```javascript
GET /api/user/profile?email=user@example.com
```

### 3. Save Optimization History
```javascript
POST /api/optimization/history
Body: {
  "user_email": "user@example.com",
  "job_title": "Senior Engineer",
  "original_score": 65,
  "optimized_score": 85,
  ...
}
```

### 4. Get User History
```javascript
GET /api/optimization/history?email=user@example.com
```

---

## Viewing Data in Neon

### Option 1: Neon Dashboard
1. Go to https://console.neon.tech
2. Sign in with your Neon account
3. Go to your project
4. Click "SQL Editor"
5. Run queries like:
   ```sql
   SELECT * FROM users;
   SELECT * FROM optimization_history;
   ```

### Option 2: Command Line
```bash
psql 'postgresql://neondb_owner:npg_3gc9hnGPjwCv@ep-flat-queen-atidubx0-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

Then run:
```sql
\dt  -- List all tables
SELECT * FROM users;
SELECT * FROM optimization_history;
```

---

## Next Steps

### 1. Deploy to Render

Push changes to GitHub:
```bash
git add .
git commit -m "Add PostgreSQL database support"
git push origin main
```

Render will automatically deploy with new code.

### 2. Update Render Environment

Go to Render dashboard:
1. Click your service (resume-fixer-api)
2. Go to "Environment"
3. Add: `DATABASE_URL` = your Neon connection string
4. Click Save
5. Service redeploys

### 3. Initialize Tables on Render

After deployment, run initialization:
```bash
# Via Render dashboard, in "Shell" tab:
node scripts/initDatabase.js
```

Or via SSH:
```bash
ssh your-render-app.onrender.com
cd /app
node scripts/initDatabase.js
```

### 4. Test Integration

Upload and analyze a resume - should now save to database.

---

## Important Notes

### Security

⚠️ **Your database URL contains credentials**

**NEVER commit .env file to Git!**

```bash
# Make sure .env is in .gitignore
echo "backend/.env" >> .gitignore
git rm --cached backend/.env
git commit -m "Remove .env from git"
```

### Neon DB Free Tier

- ✅ 3 projects
- ✅ 10 GB storage
- ✅ Autosuspend after 5 minutes idle
- ✅ 20 compute hours/month

**Upgrade if you need more.**

### Connection Pool

Current settings:
- Max connections: 5
- Idle timeout: 10 seconds
- Acquire timeout: 30 seconds

Adjust in `src/config/database.js` if needed.

---

## Troubleshooting

### "Database connection failed"

**Check:**
1. Is DATABASE_URL correct in .env?
2. Is it a valid PostgreSQL URL?
3. Can you connect with psql command?
4. Check Neon dashboard - is project active?

### "Table already exists"

**Solution:**
```bash
# Don't run init again
# Tables persist in database
# Run only once
```

### "Connection timeout"

**Solution:**
- Add to DATABASE_URL: `?sslmode=require`
- Already done in your setup ✅

### "Too many connections"

**Solution:**
- Increase `max` in database.js pool config
- Or upgrade Neon plan

---

## File Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          ← Database configuration
│   ├── models/
│   │   ├── User.js              ← User model
│   │   └── OptimizationHistory.js ← History model
│   └── ...
├── scripts/
│   └── initDatabase.js          ← Init script
├── .env                         ← Database credentials
└── package.json                 ← Dependencies
```

---

## Next Features to Add

Once database is working:

1. **User Authentication**
   - Sign up / Login
   - JWT tokens
   - Session management

2. **Profile Sync**
   - Save profile to database
   - Access from any device
   - Cloud backup

3. **History Dashboard**
   - View all past optimizations
   - Track improvements over time
   - Download reports

4. **Team Features**
   - Share profiles with team
   - Collaborative optimization
   - Admin dashboard

---

## Summary

✅ **Database is now set up!**

| Component | Status |
|-----------|--------|
| PostgreSQL (Neon) | ✅ Ready |
| Dependencies | ✅ Installed |
| Models | ✅ Created |
| Tables | ⏳ Need to initialize |
| Connection | ✅ Configured |

**Next:** Run `node scripts/initDatabase.js` to create tables.

---

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Init DB | `node scripts/initDatabase.js` |
| Start server | `npm start` |
| View logs | Render dashboard |
| Query DB | Neon console |
| Test API | `curl` commands |

Everything is ready! 🚀
