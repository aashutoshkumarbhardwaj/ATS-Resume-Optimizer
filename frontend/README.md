# Resume Fixer Frontend

React web application for resume optimization.

## Quick Start

```bash
npm install
npm start
```

App runs on `http://localhost:3000`

## Pages

- **Home** (`/`) - Main analyzer interface
- **Dashboard** (`/dashboard`) - Statistics and insights
- **Analysis** (`/analysis`) - Analysis history and results
- **Settings** (`/settings`) - User preferences
- **Login** (`/login`) - User authentication
- **Register** (`/register`) - New user registration

## Components

### Navigation
- Navbar with menu links

### ResumeUploader
- Drag-and-drop file upload
- Support for PDF, DOC, DOCX, TXT

### AnalysisResults
- Score display with progress bar
- Suggestions list
- Matched/missing skills
- Optimized resume preview

## Project Structure

```
src/
├── index.js                # Entry point
├── App.js                  # Main component
├── components/
│   ├── Navigation.js       # Top navigation
│   ├── ResumeUploader.js   # File upload
│   └── AnalysisResults.js  # Results display
├── pages/
│   ├── HomePage.js         # Main page
│   ├── DashboardPage.js    # Dashboard
│   ├── AnalysisPage.js     # Analysis history
│   ├── SettingsPage.js     # Settings
│   ├── LoginPage.js        # Login form
│   └── RegisterPage.js     # Registration form
├── hooks/
│   └── useApi.js           # API hook
├── utils/
│   └── api.js              # Axios instance
├── styles/
│   ├── index.css           # Global styles
│   ├── App.css
│   ├── Navigation.css
│   ├── HomePage.css
│   ├── DashboardPage.css
│   ├── AnalysisPage.css
│   ├── SettingsPage.css
│   ├── LoginPage.css
│   ├── RegisterPage.css
│   ├── AnalysisResults.css
│   └── ResumeUploader.css
└── assets/
    └── images/
```

## Features

- 🎨 Responsive design
- 🔐 User authentication
- 📊 Dashboard with statistics
- 📈 Analysis history
- 💾 Data persistence
- 🎯 Resume analysis
- 💡 Smart suggestions

## Dependencies

- **react** - UI framework
- **react-dom** - React rendering
- **react-router-dom** - Client-side routing
- **axios** - HTTP client
- **react-scripts** - Build tools

## API Integration

All API calls use the `apiClient` instance:

```javascript
import apiClient from './utils/api';

const response = await apiClient.post('/resume/analyze', data);
```

Base URL: `http://localhost:5000/api`

## Hooks

### useApi
Custom hook for API calls with loading/error states:

```javascript
const { data, loading, error, execute } = useApi(apiFunction);
```

## Styling

Uses CSS Grid and Flexbox for layout. Color scheme:

- Primary: `#667eea` (Indigo)
- Secondary: `#764ba2` (Purple)
- Success: `#2e7d32` (Green)
- Error: `#c62828` (Red)

## Build

### Development
```bash
npm start
```

### Production
```bash
npm run build
```

### Testing
```bash
npm test
```

## Environment Variables

Create `.env` file:

```
REACT_APP_API_URL=http://localhost:5000/api
```

## Authentication

JWT tokens stored in localStorage:

```javascript
localStorage.getItem('token')
localStorage.setItem('token', token)
localStorage.removeItem('token')
```

## Performance

- Code splitting with React.lazy()
- Image optimization
- CSS minification
- Gzip compression

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

- **API connection error**: Ensure backend is running
- **Styling issues**: Clear cache and rebuild
- **Auth issues**: Check JWT token validity
- **Build errors**: Clear node_modules and reinstall

---

For more information, see the main [README.md](../README.md)
