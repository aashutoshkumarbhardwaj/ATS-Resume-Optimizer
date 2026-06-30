# 📊 Neon Database Schema - What We Store

**Database:** PostgreSQL on Neon
**Tables:** 2 (users, optimization_history)
**Total Fields:** 30+ fields across both tables

---

## Table 1: `users` - User Profiles

### Purpose
Stores user profile information for autofill functionality. When a user fills out their profile once, this data is saved and used to auto-fill job application forms.

### Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| **id** | UUID | ✅ Auto | Unique user identifier | `550e8400-e29b-41d4-a716-446655440000` |
| **email** | String | ✅ Yes | User email address | `john.doe@example.com` |
| **full_name** | String | ⚠️ Optional | Complete name | `John Doe` |
| **first_name** | String | ⚠️ Optional | First name | `John` |
| **last_name** | String | ⚠️ Optional | Last name | `Doe` |
| **phone** | String | ⚠️ Optional | Phone number | `+1 (555) 123-4567` |
| **city** | String | ⚠️ Optional | City of residence | `San Francisco` |
| **country** | String | ⚠️ Optional | Country of residence | `United States` |
| **linkedin** | String | ⚠️ Optional | LinkedIn profile URL | `https://linkedin.com/in/johndoe` |
| **github** | String | ⚠️ Optional | GitHub profile URL | `https://github.com/johndoe` |
| **portfolio** | String | ⚠️ Optional | Personal website/portfolio | `https://johndoe.dev` |
| **current_title** | String | ⚠️ Optional | Current job title | `Senior Software Engineer` |
| **years_of_experience** | Integer | ⚠️ Optional | Years of experience | `5` |
| **custom_fields** | JSON | ⚠️ Optional | Custom fields (key-value pairs) | `{"notice_period": "2 weeks", "salary_expectation": "$150k"}` |
| **createdAt** | DateTime | ✅ Auto | When profile was created | `2024-06-30T10:30:45.123Z` |
| **updatedAt** | DateTime | ✅ Auto | When profile was last updated | `2024-06-30T14:20:15.456Z` |

### Example Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "full_name": "John Doe",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1 (555) 123-4567",
  "city": "San Francisco",
  "country": "United States",
  "linkedin": "https://linkedin.com/in/johndoe",
  "github": "https://github.com/johndoe",
  "portfolio": "https://johndoe.dev",
  "current_title": "Senior Software Engineer",
  "years_of_experience": 5,
  "custom_fields": {
    "notice_period": "2 weeks",
    "salary_expectation": "$150k",
    "work_authorization": "Citizen"
  },
  "createdAt": "2024-06-30T10:30:45.123Z",
  "updatedAt": "2024-06-30T14:20:15.456Z"
}
```

### Use Case
User fills autofill form once → Data saved to `users` table → Extension auto-fills job forms with this data on career pages

---

## Table 2: `optimization_history` - Resume Optimization Records

### Purpose
Tracks every resume optimization performed. Stores the original resume, optimized version, scores, and all analysis data for future reference.

### Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| **id** | UUID | ✅ Auto | Unique optimization record ID | `660e8400-f39b-41d4-b716-446655440000` |
| **user_email** | String | ✅ Yes | Email of user who optimized | `john.doe@example.com` |
| **job_title** | String | ⚠️ Optional | Position applied for | `Senior Software Engineer` |
| **company** | String | ⚠️ Optional | Company name | `Google` |
| **original_score** | Float | ⚠️ Optional | ATS score before optimization | `65.5` |
| **optimized_score** | Float | ⚠️ Optional | ATS score after optimization | `92.3` |
| **score_improvement** | Float | ⚠️ Optional | Points improved | `26.8` |
| **original_text** | Text | ⚠️ Optional | Resume text before optimization | `"John Doe\nExperienced Software Engineer..."` |
| **optimized_text** | Text | ⚠️ Optional | Resume text after optimization | `"John Doe\nExperienced Software Engineer with expertise..."` |
| **job_description** | Text | ⚠️ Optional | Job description used for analysis | `"We are looking for a Senior Software Engineer..."` |
| **changes_made** | JSON | ⚠️ Optional | Array of all changes made | `[{"type": "added_keyword", "text": "React", "reason": "..."}]` |
| **matched_keywords** | JSON | ⚠️ Optional | Keywords found in resume | `["Python", "AWS", "Docker", "Kubernetes"]` |
| **missing_keywords** | JSON | ⚠️ Optional | Keywords missing from resume | `["Microservices", "CI/CD", "Machine Learning"]` |
| **analysis_result** | JSON | ⚠️ Optional | Full analysis data | `{"breakdown": {...}, "suggestions": [...]}` |
| **createdAt** | DateTime | ✅ Auto | When optimization was performed | `2024-06-30T11:45:30.789Z` |

### Example Record

```json
{
  "id": "660e8400-f39b-41d4-b716-446655440000",
  "user_email": "john.doe@example.com",
  "job_title": "Senior Software Engineer",
  "company": "Google",
  "original_score": 65.5,
  "optimized_score": 92.3,
  "score_improvement": 26.8,
  "original_text": "John Doe\nSoftware Engineer\n5 years experience...",
  "optimized_text": "John Doe\nSenior Software Engineer\n5+ years of proven expertise...",
  "job_description": "We are looking for a Senior Software Engineer...",
  "changes_made": [
    {
      "type": "added_keyword",
      "text": "Kubernetes",
      "reason": "Found in job description, increases ATS relevance"
    },
    {
      "type": "improved_phrasing",
      "original": "Worked with AWS",
      "updated": "Designed and deployed microservices on AWS"
    }
  ],
  "matched_keywords": [
    "Python",
    "AWS",
    "Docker",
    "Kubernetes",
    "React",
    "Node.js"
  ],
  "missing_keywords": [
    "Microservices",
    "CI/CD",
    "Machine Learning",
    "System Design"
  ],
  "analysis_result": {
    "breakdown": {
      "keywordMatch": 0.85,
      "experienceRelevance": 0.92,
      "skillsAlignment": 0.78
    },
    "suggestions": [
      {
        "message": "Add system design experience",
        "impact": "Could improve score by 5-10 points"
      }
    ]
  },
  "createdAt": "2024-06-30T11:45:30.789Z"
}
```

### Use Case
User uploads resume and job description → System analyzes → Creates optimization → Saves everything to `optimization_history` → User can view history later

---

## 📊 Data Flow Diagram

```
User Fills Autofill Form
         ↓
    Save to `users` table
         ↓
Extension retrieves from DB for auto-fill
         
---

User Uploads Resume + Job Description
         ↓
System Analyzes & Optimizes
         ↓
Save to `optimization_history` table
         ↓
User can view history anytime
```

---

## 🔍 Common Queries

### Get User Profile
```sql
SELECT * FROM users WHERE email = 'john.doe@example.com';
```

### Get All Optimizations for User
```sql
SELECT * FROM optimization_history 
WHERE user_email = 'john.doe@example.com' 
ORDER BY createdAt DESC;
```

### Get Optimizations for Specific Company
```sql
SELECT * FROM optimization_history 
WHERE company = 'Google' 
ORDER BY optimized_score DESC;
```

### Get Best Improvements
```sql
SELECT user_email, company, job_title, score_improvement 
FROM optimization_history 
ORDER BY score_improvement DESC 
LIMIT 10;
```

### Count Records by User
```sql
SELECT user_email, COUNT(*) as optimization_count 
FROM optimization_history 
GROUP BY user_email;
```

---

## 💾 Storage Capacity

### Current Usage
- **Users Table:** ~100-200 bytes per record
- **Optimization History:** ~5-10 KB per record (due to full text storage)

### Example
- 100 users: ~20 KB
- 1000 optimization records: ~10 MB

### Neon Free Tier Limit
- **Storage:** Up to 3 GB (plenty for millions of records)
- **Active hours:** Unlimited
- **Auto-pause:** After 15 min inactivity (normal)

---

## 🔐 Data Privacy

### What We Store
✅ Email address
✅ Contact information
✅ Professional profiles (LinkedIn, GitHub)
✅ Job titles and experience
✅ Resume content
✅ Job descriptions analyzed
✅ Optimization history

### What We DON'T Store
❌ Passwords
❌ Payment information
❌ Social security numbers
❌ Sensitive personal data

### Security
- ✅ PostgreSQL encryption at rest
- ✅ SSL/TLS encryption in transit
- ✅ Credentials in `.env` (not committed to git)
- ✅ No sensitive data in code

---

## 🚀 Accessing the Database

### Option 1: Neon Console (Web UI)
1. Go to https://console.neon.tech
2. Sign in
3. Click your project
4. Go to SQL Editor
5. Run queries

### Option 2: Command Line (psql)
```bash
psql 'postgresql://neondb_owner:npg_3gc9hnGPjwCv@ep-flat-queen-atidubx0-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

### Option 3: Node.js Script
```javascript
const sequelize = require('./src/config/database');
const User = require('./src/models/User');

async function getUsers() {
  const users = await User.findAll();
  console.log(users);
}
```

---

## 📈 Scaling

### Current Setup
- ✅ Works for thousands of users
- ✅ Suitable for MVP/growth stage
- ✅ Free tier sufficient

### Future Upgrades
- Neon paid plans available
- Automatic backups enabled
- Read replicas available
- Connection pooling configured

---

## 🔄 Backup Strategy

### Automatic Backups
- ✅ Daily snapshots by Neon
- ✅ 7-day retention
- ✅ Point-in-time recovery available

### Manual Backup
```bash
pg_dump 'postgresql://...' > backup.sql
```

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Database** | PostgreSQL on Neon |
| **Tables** | 2 (users, optimization_history) |
| **Total Fields** | 30+ across both tables |
| **Primary Key** | UUID (auto-generated) |
| **Encryption** | SSL/TLS + at-rest encryption |
| **Backup** | Daily automatic snapshots |
| **Storage Limit** | 3 GB (free tier) |
| **Cost** | Free (up to 3 GB) |

---

## What Happens When Data Is Saved

### User Profile Save
```
Extension → Backend API → PostgreSQL (Neon)
User fills form → Click "Save Profile" → Data stored → Auto-fill ready
```

### Optimization Save
```
Extension → Backend API → Analysis → PostgreSQL (Neon)
User uploads resume → Click "Analyze" → Saves results → History created
```

---

## Access Your Data

### View in Neon Console
1. https://console.neon.tech → Your Project
2. SQL Editor tab
3. Run: `SELECT * FROM users;`
4. Run: `SELECT * FROM optimization_history;`

### Export Data
```sql
-- Export users as CSV
\COPY users TO '/path/to/users.csv' CSV HEADER;

-- Export optimization history
\COPY optimization_history TO '/path/to/history.csv' CSV HEADER;
```

---

**Total Data Stored:** Everything needed to provide resume optimization service + autofill functionality! ✅
