/**
 * Extension Configuration
 * Update this file with your production settings
 */

// IMPORTANT: Replace 'your-app-name' with your actual Render service name
// Your Render URL should look like: https://your-app-name.onrender.com
export const CONFIG = {
    // Production API URL (Render deployment)
    API_BASE_URL: 'https://ats-resume-optimizer-niap.onrender.com/api',
    
    // Development API URL (for local testing)
    DEV_API_BASE_URL: 'http://localhost:3000/api',
    
    // Use production by default
    USE_PRODUCTION: true
};

// Get the current API URL based on configuration
export function getApiBaseUrl() {
    return CONFIG.USE_PRODUCTION ? CONFIG.API_BASE_URL : CONFIG.DEV_API_BASE_URL;
}