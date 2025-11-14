# Resume Fixer Backend API

Express.js REST API for resume analysis and optimization.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Server runs on `http://localhost:5000`

## API Endpoints

### Resume Analysis
- **POST** `/api/resume/analyze`
  ```json
  {
    "jobRole": "Software Engineer",
    "jobDescription": "...",
    "resumeText": "..."
  }
  ```
  Returns: Analysis results with score, suggestions, matched/missing skills

### Resume Optimization
- **POST** `/api/resume/optimize`
  ```json
  {
    "resumeText": "...",
    "jobDescription": "..."
  }
  ```
  Returns: Optimized resume content

### Suggestions
- **GET** `/api/resume/suggestions?jobRole=Software%20Engineer&resumeText=...`

### Job Roles
- **GET** `/api/job-role/:title` - Get job role details
- **POST** `/api/job-role/parse` - Parse job description
- **GET** `/api/job-role/skills/:role` - Get required skills

### User Management
- **POST** `/api/user/register` - Create new user
- **POST** `/api/user/login` - Login user
- **GET** `/api/user/profile` - Get user profile (protected)
- **PUT** `/api/user/profile` - Update profile (protected)

### Analysis History
- **GET** `/api/analysis/history` - Get analysis history (protected)
- **POST** `/api/analysis/save` - Save analysis (protected)

## Project Structure

```
src/
├── index.js              # Main server file
├── config/
│   └── index.js          # Configuration
├── controllers/          # Request handlers
│   ├── resumeController.js
│   ├── jobRoleController.js
│   └── analysisController.js
├── models/               # Data models
│   ├── Resume.js
│   ├── User.js
│   ├── JobRole.js
│   └── Analysis.js
├── routes/               # API routes
│   ├── resume.js
│   ├── jobRole.js
│   ├── user.js
│   └── analysis.js
├── services/             # Business logic
│   ├── resumeService.js
│   ├── jobRoleService.js
│   └── userService.js
├── middleware/           # Custom middleware
│   ├── errorHandler.js
│   └── auth.js
└── utils/                # Utilities
    ├── textUtils.js
    └── validator.js
```

## Configuration

Create `.env` file:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-secret-key-here
DB_HOST=localhost
DB_PORT=27017
DB_NAME=resume_fixer
API_TIMEOUT=30000
```

## Dependencies

- **express** - Web framework
- **cors** - Enable CORS
- **morgan** - HTTP logging
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **axios** - HTTP client
- **dotenv** - Environment variables

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Testing
```bash
npm test
```

## Services

### ResumeService
- `analyzeResume()` - Analyze resume against job description
- `extractKeywords()` - Extract keywords from text
- `generateSuggestions()` - Generate improvement suggestions
- `optimizeResumeContent()` - Optimize resume text
- `getSuggestions()` - Get role-specific suggestions

### JobRoleService
- `getJobRoleByTitle()` - Get job role details
- `parseJobDescription()` - Extract skills from description
- `extractSkills()` - Find required skills
- `extractKeywords()` - Get key terms
- `extractExperience()` - Get years required
- `getSkillsForRole()` - Get skills by role

### UserService
- `registerUser()` - Create new user
- `loginUser()` - Authenticate user
- `getUserById()` - Get user data
- `updateUser()` - Update user profile

## Error Handling

All endpoints return consistent error format:

```json
{
  "error": {
    "status": 400,
    "message": "Error description"
  }
}
```

## Authentication

Protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

## CORS

CORS is enabled for all origins. Configure in production:

```javascript
cors({
  origin: process.env.ALLOWED_ORIGINS || '*'
})
```

## Troubleshooting

- **Port already in use**: Change PORT in .env
- **Database connection error**: Check DB_HOST and DB_PORT
- **JWT errors**: Verify JWT_SECRET is set
- **CORS errors**: Check frontend origin is allowed

---

For more information, see the main [README.md](../README.md)
