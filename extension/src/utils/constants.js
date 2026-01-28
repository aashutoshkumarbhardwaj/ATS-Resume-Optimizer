/**
 * Constants
 * Extension-wide constants and configurations
 */

// API Configuration - Update this with your Render URL
export const API_CONFIG = {
    BASE_URL: 'https://your-app-name.onrender.com/api', // Replace 'your-app-name' with your actual Render service name
    TIMEOUT: 30000,
};

// Storage Keys
export const STORAGE_KEYS = {
    JOB_ROLE: 'jobRole',
    JOB_DESCRIPTION: 'jobDescription',
    RESUME_TEXT: 'resumeText',
    USER_PREFERENCES: 'userPreferences',
    ANALYSIS_HISTORY: 'analysisHistory',
};

// Messages
export const MESSAGES = {
    SUCCESS: 'Operation completed successfully!',
    ERROR: 'An error occurred. Please try again.',
    LOADING: 'Processing your request...',
};

// Resume Keywords - Common resume action verbs
export const RESUME_KEYWORDS = {
    LEADERSHIP: ['led', 'managed', 'directed', 'oversaw', 'supervised', 'coordinated'],
    ACHIEVEMENT: ['achieved', 'improved', 'increased', 'exceeded', 'optimized', 'enhanced'],
    TECHNICAL: ['developed', 'implemented', 'designed', 'engineered', 'built', 'created'],
    ANALYSIS: ['analyzed', 'evaluated', 'assessed', 'examined', 'investigated'],
};

// Common Skills by Role
export const SKILLS_BY_ROLE = {
    'Software Engineer': [
        'JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js',
        'Git', 'Docker', 'AWS', 'REST API', 'SQL', 'NoSQL'
    ],
    'Data Scientist': [
        'Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'NumPy',
        'SQL', 'Statistics', 'Data Visualization', 'Scikit-learn', 'Apache Spark'
    ],
    'Product Manager': [
        'Product Strategy', 'Agile', 'User Research', 'Roadmapping',
        'Analytics', 'Cross-functional Leadership', 'A/B Testing'
    ],
    'DevOps Engineer': [
        'Docker', 'Kubernetes', 'AWS', 'Azure', 'CI/CD', 'Linux',
        'Infrastructure as Code', 'Terraform', 'Jenkins', 'Monitoring'
    ],
};
