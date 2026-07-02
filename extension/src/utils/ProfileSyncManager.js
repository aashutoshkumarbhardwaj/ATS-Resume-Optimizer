/**
 * Profile Sync Manager
 * Handles downloading profile from Job Orbit and auto-saving changes
 * Requires CONFIG to be loaded first
 */

class ProfileSyncManager {
    /**
     * Get API configuration with fallback
     */
    static getApiConfig() {
        return {
            apiUrl: (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
                ? CONFIG.API_BASE_URL 
                : 'https://ats-resume-optimizer-359j.onrender.com/api',
            timeout: (typeof CONFIG !== 'undefined' && CONFIG.SYNC.REQUEST_TIMEOUT_MS)
                ? CONFIG.SYNC.REQUEST_TIMEOUT_MS
                : 10000,
            debounce: (typeof CONFIG !== 'undefined' && this.getApiConfig().debounce)
                ? this.getApiConfig().debounce
                : 2000
        };
    }

    /**
     * Download profile from backend
     * GET /api/profile
     */
    static async downloadProfile(token) {
        console.log('[ProfileSync] 📥 Downloading profile from backend...');

        try {
            const config = this.getApiConfig();
            const response = await fetch(`${config.apiUrl}/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: config.timeout
            });

            if (!response.ok) {
                console.error('[ProfileSync] ❌ Download failed (HTTP', response.status + ')');
                return {
                    success: false,
                    error: `HTTP ${response.status}`,
                    profile: null
                };
            }

            const data = await response.json();

            if (!data.success || !data.profile) {
                console.log('[ProfileSync] ℹ️ No profile data returned (first login)');
                return {
                    success: true,
                    profile: null,
                    isNew: true
                };
            }

            console.log('[ProfileSync] ✅ Profile downloaded successfully');
            console.log('[ProfileSync] Profile data:', {
                name: data.profile.name || data.profile.full_name,
                email: data.profile.email,
                phone: data.profile.phone,
                hasResume: !!data.profile.default_resume
            });

            return {
                success: true,
                profile: data.profile,
                isNew: false
            };
        } catch (error) {
            console.error('[ProfileSync] ❌ Download error:', error.message);
            return {
                success: false,
                error: error.message,
                profile: null
            };
        }
    }

    /**
     * Save profile to backend
     * PATCH /api/profile
     */
    static async uploadProfile(token, profileData) {
        console.log('[ProfileSync] 📤 Uploading profile to backend...');
        
        // Filter out custom_fields and only send valid fields
        const allowedFields = [
            'full_name', 'first_name', 'last_name', 'email', 'phone',
            'city', 'state', 'zip', 'country',
            'current_title', 'current_company', 'years_of_experience',
            'notice_period', 'expected_salary',
            'linkedin', 'github', 'portfolio',
            'default_resume', 'skills',
            'answer_about_you', 'answer_why_company', 'answer_hire_you',
            'work_environment', 'preferred_location', 'work_authorization'
        ];
        
        const filteredData = {};
        for (const key of allowedFields) {
            if (key in profileData && profileData[key]) {
                filteredData[key] = profileData[key];
            }
        }
        
        console.log('[ProfileSync] Uploading fields:', Object.keys(filteredData));

        try {
            const config = this.getApiConfig();
            const response = await fetch(`${config.apiUrl}/profile`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filteredData),
                timeout: config.timeout
            });

            if (!response.ok) {
                console.error('[ProfileSync] ❌ Upload failed (HTTP', response.status + ')');
                return {
                    success: false,
                    error: `HTTP ${response.status}`
                };
            }

            const data = await response.json();

            console.log('[ProfileSync] ✅ Profile uploaded successfully');

            return {
                success: true,
                profile: data.profile
            };
        } catch (error) {
            console.error('[ProfileSync] ❌ Upload error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Populate form fields from downloaded profile
     */
    static populateForm(profile) {
        if (!profile) {
            console.log('[ProfileSync] ℹ️ No profile to populate');
            return;
        }

        console.log('[ProfileSync] 🔄 Populating form fields...');

        const fieldMap = {
            // Personal Info
            'full_name': profile.full_name || profile.name,
            'first_name': profile.first_name,
            'last_name': profile.last_name,
            'email': profile.email,
            'phone': profile.phone,
            'city': profile.city,
            'state': profile.state,
            'zip': profile.zip,
            'country': profile.country,

            // Professional
            'current_title': profile.current_title || profile.job_title,
            'current_company': profile.current_company || profile.company,
            'years_of_experience': profile.years_of_experience,
            'notice_period': profile.notice_period,
            'expected_salary': profile.expected_salary,

            // Links
            'linkedin': profile.linkedin,
            'github': profile.github,
            'portfolio': profile.portfolio,

            // Resume & Skills
            'default_resume': profile.default_resume,
            'skills': profile.skills,

            // Answers
            'answer_about_you': profile.answer_about_you,
            'answer_why_company': profile.answer_why_company,
            'answer_hire_you': profile.answer_hire_you,

            // Preferences
            'work_environment': profile.work_environment,
            'preferred_location': profile.preferred_location,
            'work_authorization': profile.work_authorization
        };

        let filledCount = 0;
        for (const [fieldId, value] of Object.entries(fieldMap)) {
            if (value) {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = value;
                    filledCount++;
                    console.log('[ProfileSync]   Filled:', fieldId);
                }
            }
        }

        console.log('[ProfileSync] ✅ Populated', filledCount, 'fields');
    }

    /**
     * Extract profile data from form
     */
    static extractFormData() {
        const fields = [
            // Personal
            'full_name', 'first_name', 'last_name', 'email', 'phone',
            'city', 'state', 'zip', 'country',

            // Professional
            'current_title', 'current_company', 'years_of_experience',
            'notice_period', 'expected_salary',

            // Links
            'linkedin', 'github', 'portfolio',

            // Resume & Skills
            'default_resume', 'skills',

            // Answers
            'answer_about_you', 'answer_why_company', 'answer_hire_you',

            // Preferences
            'work_environment', 'preferred_location', 'work_authorization'
        ];

        const data = {};
        let count = 0;

        for (const fieldId of fields) {
            const element = document.getElementById(fieldId);
            if (element && element.value) {
                data[fieldId] = element.value.trim();
                count++;
            }
        }

        console.log('[ProfileSync] 📋 Extracted', count, 'fields from form');
        return data;
    }

    /**
     * Setup auto-save for profile when form changes
     * Debounced to prevent excessive uploads
     * Should be called AFTER form fields are loaded in DOM
     */
    static setupAutoSave(token, debounceMs = this.getApiConfig().debounce) {
        console.log('[ProfileSync] 🔧 Setting up auto-save...');

        // Wait for fields to be in DOM if they're not ready yet
        const ensureFieldsReady = () => {
            return new Promise((resolve) => {
                const checkFields = () => {
                    const requiredField = document.getElementById('full_name');
                    if (requiredField) {
                        resolve();
                    } else {
                        // Retry in 100ms
                        setTimeout(checkFields, 100);
                    }
                };
                checkFields();
            });
        };

        // Ensure fields are ready before attaching listeners
        ensureFieldsReady().then(() => {
            let saveTimeout;
            let lastSaved = {};

            const autoSave = async () => {
                const currentData = this.extractFormData();

                // Check if data actually changed
                if (JSON.stringify(currentData) === JSON.stringify(lastSaved)) {
                    console.log('[ProfileSync] ℹ️ No changes detected, skipping save');
                    return;
                }

                console.log('[ProfileSync] 💾 Auto-saving profile...');

                const result = await this.uploadProfile(token, currentData);

                if (result.success) {
                    lastSaved = currentData;
                    console.log('[ProfileSync] ✅ Auto-save successful');
                    this.showSaveNotification('✅ Profile saved', 'success');
                } else {
                    console.error('[ProfileSync] ❌ Auto-save failed:', result.error);
                    this.showSaveNotification('⚠️ Save failed: ' + result.error, 'error');
                }
            };

            // Get all form fields that should trigger auto-save
            const fields = [
                'full_name', 'first_name', 'last_name', 'email', 'phone',
                'city', 'state', 'zip', 'country',
                'current_title', 'current_company', 'years_of_experience',
                'notice_period', 'expected_salary',
                'linkedin', 'github', 'portfolio',
                'default_resume', 'skills',
                'answer_about_you', 'answer_why_company', 'answer_hire_you',
                'work_environment', 'preferred_location', 'work_authorization'
            ];

            let attachedCount = 0;
            fields.forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) {
                    element.addEventListener('change', () => {
                        console.log('[ProfileSync] 📝 Field changed:', fieldId);

                        // Clear previous timeout
                        clearTimeout(saveTimeout);

                        // Debounce: wait before saving
                        saveTimeout = setTimeout(autoSave, debounceMs);
                    });
                    attachedCount++;

                    // Also handle input event for real-time feedback
                    element.addEventListener('input', () => {
                        // Just log, don't save yet (wait for change/blur)
                    });
                }
            });

            console.log('[ProfileSync] ✅ Auto-save configured for', attachedCount, 'fields');
        });
    }

    /**
     * Show save notification
     */
    static showSaveNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 16px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    /**
     * Full sync flow on login
     */
    static async syncOnLogin(token) {
        console.log('[ProfileSync] 🔄 Starting full sync on login...');

        // Download profile
        const downloadResult = await this.downloadProfile(token);

        if (!downloadResult.success) {
            console.error('[ProfileSync] ❌ Failed to download profile');
            return {
                success: false,
                error: downloadResult.error
            };
        }

        // Populate form with downloaded data
        if (downloadResult.profile) {
            this.populateForm(downloadResult.profile);
        }

        // Setup auto-save for future changes
        this.setupAutoSave(token);

        console.log('[ProfileSync] ✅ Full sync completed');

        return {
            success: true,
            profile: downloadResult.profile,
            isNew: downloadResult.isNew
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileSyncManager;
}
