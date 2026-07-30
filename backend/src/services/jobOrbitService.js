/**
 * Job Orbit Integration Service
 * Handles syncing job applications with Job Orbit platform
 */

const axios = require('axios');

const JOB_ORBIT_API_URL = 'https://api.joborbit.com/v1';

class JobOrbitService {
    /**
     * Validate Job Orbit API key
     */
    static async validateApiKey(apiKey) {
        try {
            const response = await axios.get(`${JOB_ORBIT_API_URL}/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            return response.status === 200;
        } catch (error) {
            console.error('[JobOrbit] API validation failed:', error.message);
            return false;
        }
    }

    /**
     * Create job application record on Job Orbit
     */
    static async createApplication(apiKey, applicationData) {
        try {
            const payload = {
                company: applicationData.company,
                jobTitle: applicationData.jobTitle,
                location: applicationData.location,
                salary: applicationData.salary,
                jobUrl: applicationData.jobUrl,
                appliedDate: applicationData.timestamp,
                status: applicationData.status || 'Applied',
                notes: applicationData.notes,
                resumeVersion: applicationData.resumeVersion,
                source: 'ATS Resume Optimizer'
            };

            const response = await axios.post(`${JOB_ORBIT_API_URL}/applications`, payload, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                jobOrbitId: response.data.id,
                data: response.data
            };
        } catch (error) {
            console.error('[JobOrbit] Failed to create application:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync multiple applications with Job Orbit
     */
    static async syncApplications(apiKey, applications) {
        try {
            const results = [];
            
            for (const app of applications) {
                const result = await this.createApplication(apiKey, app);
                results.push({
                    company: app.company,
                    success: result.success,
                    error: result.error
                });
            }

            const successCount = results.filter(r => r.success).length;
            
            return {
                success: true,
                totalApplications: applications.length,
                successCount: successCount,
                results: results
            };
        } catch (error) {
            console.error('[JobOrbit] Batch sync failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get applications from Job Orbit
     */
    static async getApplications(apiKey, filters = {}) {
        try {
            let url = `${JOB_ORBIT_API_URL}/applications`;
            
            // Add query parameters
            const queryParams = [];
            if (filters.status) queryParams.push(`status=${filters.status}`);
            if (filters.company) queryParams.push(`company=${filters.company}`);
            if (filters.startDate) queryParams.push(`startDate=${filters.startDate}`);
            if (filters.endDate) queryParams.push(`endDate=${filters.endDate}`);
            
            if (queryParams.length > 0) {
                url += '?' + queryParams.join('&');
            }

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                applications: response.data.applications || [],
                total: response.data.total || 0
            };
        } catch (error) {
            console.error('[JobOrbit] Failed to fetch applications:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update application status on Job Orbit
     */
    static async updateApplicationStatus(apiKey, jobOrbitId, newStatus) {
        try {
            const response = await axios.patch(
                `${JOB_ORBIT_API_URL}/applications/${jobOrbitId}`,
                { status: newStatus },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('[JobOrbit] Failed to update application:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get application statistics from Job Orbit
     */
    static async getStatistics(apiKey) {
        try {
            const response = await axios.get(`${JOB_ORBIT_API_URL}/applications/statistics`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                total: response.data.total || 0,
                byStatus: response.data.byStatus || {},
                byCompany: response.data.byCompany || {},
                averageTimeToResponse: response.data.averageTimeToResponse || null,
                successRate: response.data.successRate || 0
            };
        } catch (error) {
            console.error('[JobOrbit] Failed to fetch statistics:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete application from Job Orbit
     */
    static async deleteApplication(apiKey, jobOrbitId) {
        try {
            await axios.delete(`${JOB_ORBIT_API_URL}/applications/${jobOrbitId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return { success: true };
        } catch (error) {
            console.error('[JobOrbit] Failed to delete application:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Export applications as CSV
     */
    static formatApplicationsAsCSV(applications) {
        const headers = ['Company', 'Job Title', 'Location', 'Salary', 'Status', 'Applied Date', 'Notes'];
        
        const rows = applications.map(app => [
            app.company || 'N/A',
            app.jobTitle || 'N/A',
            app.location || 'N/A',
            app.salary || 'N/A',
            app.status || 'Applied',
            app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : 'N/A',
            (app.notes || '').replace(/"/g, '""')
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell.toString()}"`).join(','))
            .join('\n');

        return csv;
    }
}

module.exports = JobOrbitService;
