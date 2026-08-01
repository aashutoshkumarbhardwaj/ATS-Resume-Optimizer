/**
 * Application Tracker - Phase 2 Enhancement
 * Tracks all job applications automatically
 * Records company, job, date, resume version, status, notes
 */

class ApplicationTracker {
    static APPLICATION_STATUSES = {
        APPLIED: 'Applied',
        VIEWED: 'Viewed by recruiter',
        PHONE_SCREEN: 'Phone screen',
        INTERVIEW: 'Interview scheduled',
        OFFER: 'Offer received',
        REJECTED: 'Rejected',
        WITHDRAWN: 'Withdrawn'
    };

    /**
     * Create new application record
     */
    static async trackApplication(applicationData) {
        const {
            company,
            jobTitle,
            jobUrl,
            resumeVersion,
            notes = '',
            metadata = {}
        } = applicationData;

        if (!company || !jobTitle) {
            return { success: false, error: 'Company and job title required' };
        }

        const application = {
            id: this.generateApplicationId(),
            company,
            jobTitle,
            jobUrl,
            resumeVersion: resumeVersion || 'Latest',
            dateApplied: new Date().toISOString(),
            status: this.APPLICATION_STATUSES.APPLIED,
            notes,
            interviewStage: 0,
            lastUpdated: Date.now(),
            metadata
        };

        try {
            // Save to storage
            await this.saveApplication(application);
            console.log('[ApplicationTracker] Application tracked:', application.id);

            return { success: true, applicationId: application.id };
        } catch (error) {
            console.error('[ApplicationTracker] Error tracking application:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save application to storage
     */
    static async saveApplication(application) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['applications'], (result) => {
                const applications = result.applications || [];

                // Check for duplicates
                const exists = applications.some(a =>
                    a.company.toLowerCase() === application.company.toLowerCase() &&
                    a.jobTitle.toLowerCase() === application.jobTitle.toLowerCase()
                );

                if (!exists) {
                    applications.push(application);

                    chrome.storage.local.set({ applications }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve(); // Application already exists
                }
            });
        });
    }

    /**
     * Update application status
     */
    static async updateApplicationStatus(applicationId, newStatus, notes = '') {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['applications'], (result) => {
                const applications = result.applications || [];
                const application = applications.find(a => a.id === applicationId);

                if (!application) {
                    reject(new Error('Application not found'));
                    return;
                }

                application.status = newStatus;
                application.lastUpdated = Date.now();

                if (newStatus === this.APPLICATION_STATUSES.PHONE_SCREEN) {
                    application.interviewStage = 1;
                } else if (newStatus === this.APPLICATION_STATUSES.INTERVIEW) {
                    application.interviewStage = 2;
                } else if (newStatus === this.APPLICATION_STATUSES.OFFER) {
                    application.interviewStage = 3;
                }

                if (notes) {
                    application.notes = (application.notes || '') + '\n' + notes;
                }

                chrome.storage.local.set({ applications }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Get all applications
     */
    static async getAllApplications() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['applications'], (result) => {
                const applications = result.applications || [];

                // Sort by date applied (newest first)
                applications.sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied));

                resolve(applications);
            });
        });
    }

    /**
     * Get application statistics
     */
    static async getApplicationStats() {
        const applications = await this.getAllApplications();

        const stats = {
            total: applications.length,
            byStatus: {},
            byCompany: {},
            recentApplications: [],
            conversionRates: {}
        };

        // Count by status
        for (const status of Object.values(this.APPLICATION_STATUSES)) {
            stats.byStatus[status] = applications.filter(a => a.status === status).length;
        }

        // Count by company
        applications.forEach(app => {
            stats.byCompany[app.company] = (stats.byCompany[app.company] || 0) + 1;
        });

        // Recent applications (last 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        stats.recentApplications = applications.filter(a =>
            new Date(a.dateApplied).getTime() > sevenDaysAgo
        );

        // Conversion rates
        stats.conversionRates.phoneScreen = applications.length > 0 ?
            Math.round((stats.byStatus[this.APPLICATION_STATUSES.PHONE_SCREEN] / applications.length) * 100) : 0;

        stats.conversionRates.interview = applications.length > 0 ?
            Math.round((stats.byStatus[this.APPLICATION_STATUSES.INTERVIEW] / applications.length) * 100) : 0;

        stats.conversionRates.offer = applications.length > 0 ?
            Math.round((stats.byStatus[this.APPLICATION_STATUSES.OFFER] / applications.length) * 100) : 0;

        return stats;
    }

    /**
     * Search applications
     */
    static async searchApplications(query) {
        const applications = await this.getAllApplications();
        const lowerQuery = query.toLowerCase();

        return applications.filter(a =>
            a.company.toLowerCase().includes(lowerQuery) ||
            a.jobTitle.toLowerCase().includes(lowerQuery) ||
            a.notes.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Delete application
     */
    static async deleteApplication(applicationId) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['applications'], (result) => {
                const applications = (result.applications || []).filter(a => a.id !== applicationId);

                chrome.storage.local.set({ applications }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Export applications as CSV
     */
    static async exportApplicationsAsCSV() {
        const applications = await this.getAllApplications();

        let csv = 'Company,Job Title,Date Applied,Status,Resume Version,Notes\n';

        for (const app of applications) {
            csv += `"${app.company}","${app.jobTitle}","${new Date(app.dateApplied).toLocaleDateString()}","${app.status}","${app.resumeVersion}","${app.notes}"\n`;
        }

        return csv;
    }

    /**
     * Detect and track current application
     */
    static async autoTrackCurrentPage() {
        try {
            // Extract job info from current page
            const jobInfo = this.extractJobInfo();

            if (jobInfo && jobInfo.company && jobInfo.jobTitle) {
                // Auto-track with no notes
                return await this.trackApplication({
                    company: jobInfo.company,
                    jobTitle: jobInfo.jobTitle,
                    jobUrl: window.location.href,
                    resumeVersion: 'Latest',
                    metadata: {
                        platform: jobInfo.platform,
                        autoDetected: true
                    }
                });
            }

            return { success: false, error: 'Could not extract job information' };
        } catch (error) {
            console.error('[ApplicationTracker] Auto-track error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract job information from page
     */
    static extractJobInfo() {
        const url = window.location.href;
        let company = '';
        let jobTitle = '';
        let platform = 'unknown';

        // Detect platform
        if (url.includes('linkedin.com')) {
            platform = 'LinkedIn';
            company = document.querySelector('[data-test-id="job-details-jobs-unified-top-card__company-name"]')?.textContent?.trim() || '';
            jobTitle = document.querySelector('[data-test-id="job-details-jobs-unified-top-card__job-title"]')?.textContent?.trim() || '';
        } else if (url.includes('indeed.com')) {
            platform = 'Indeed';
            company = document.querySelector('[data-company-name]')?.textContent?.trim() || '';
            jobTitle = document.querySelector('h1[class*="jobTitle"]')?.textContent?.trim() || '';
        } else if (url.includes('glassdoor.com')) {
            platform = 'Glassdoor';
            company = document.querySelector('[data-test="employer-name"]')?.textContent?.trim() || '';
            jobTitle = document.querySelector('[data-test="job-title"]')?.textContent?.trim() || '';
        } else if (url.includes('greenhouse')) {
            platform = 'Greenhouse';
            jobTitle = document.querySelector('h1')?.textContent?.trim() || '';
            company = document.querySelector('.company-name')?.textContent?.trim() || '';
        } else if (url.includes('lever.co')) {
            platform = 'Lever';
            company = document.querySelector('.posting-headline')?.textContent?.trim().split(' - ')[0] || '';
            jobTitle = document.querySelector('.posting-headline')?.textContent?.trim().split(' - ')[1] || '';
        } else if (url.includes('workday') || url.includes('bamboohr') || url.includes('oracle')) {
            platform = 'Workday/ATS';
            jobTitle = document.querySelector('h1')?.textContent?.trim() || '';
            company = document.querySelector('[class*="company"]')?.textContent?.trim() || '';
        }

        if (company && jobTitle) {
            return { company, jobTitle, platform };
        }

        return null;
    }

    /**
     * Generate unique application ID
     */
    static generateApplicationId() {
        return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApplicationTracker;
}
