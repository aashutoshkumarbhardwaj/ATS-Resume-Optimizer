/**
 * API Utilities
 * Handle API communication
 */

const BASE_URL = 'http://localhost:5000/api';

/**
 * Make API call
 */
export async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

/**
 * Analyze resume
 */
export async function analyzeResume(jobRole, jobDescription, resumeText) {
    return apiCall('/resume/analyze', 'POST', {
        jobRole,
        jobDescription,
        resumeText
    });
}

/**
 * Get suggestions
 */
export async function getSuggestions(keyword) {
    return apiCall(`/suggestions?keyword=${encodeURIComponent(keyword)}`);
}
