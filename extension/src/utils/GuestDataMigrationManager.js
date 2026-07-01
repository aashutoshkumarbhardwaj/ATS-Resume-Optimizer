/**
 * Guest Data Migration Manager
 * Handles migration of local guest data to Supabase on first login
 * Imports: profile, resume, settings, and AI history
 */

class GuestDataMigrationManager {
    /**
     * Check if migration is needed
     * (user just logged in and has guest data)
     */
    static async isMigrationNeeded() {
        try {
            const guestData = await GuestModeManager.collectAllGuestData();
            return guestData && (
                guestData.profile ||
                guestData.resume ||
                guestData.settings ||
                (guestData.ai_history && guestData.ai_history.length > 0)
            );
        } catch (error) {
            console.error('[Migration] Check needed failed:', error);
            return false;
        }
    }

    /**
     * Migrate all guest data to Supabase
     * @param {string} accessToken - Authenticated user's access token
     * @param {string} userId - Authenticated user ID
     */
    static async migrateGuestData(accessToken, userId) {
        try {
            console.log('[Migration] Starting migration for user:', userId);

            const results = {
                profile: null,
                resume: null,
                settings: null,
                ai_history: null,
                errors: []
            };

            // 1. Migrate profile
            const guestProfile = await GuestModeManager.getGuestProfile();
            if (guestProfile) {
                try {
                    results.profile = await GuestDataMigrationManager
                        .migrateProfile(accessToken, guestProfile);
                    console.log('[Migration] Profile migrated');
                } catch (error) {
                    console.error('[Migration] Profile migration failed:', error);
                    results.errors.push(`Profile: ${error.message}`);
                }
            }

            // 2. Migrate resume
            const guestResume = await GuestModeManager.getGuestResume();
            if (guestResume) {
                try {
                    results.resume = await GuestDataMigrationManager
                        .migrateResume(accessToken, guestResume);
                    console.log('[Migration] Resume migrated');
                } catch (error) {
                    console.error('[Migration] Resume migration failed:', error);
                    results.errors.push(`Resume: ${error.message}`);
                }
            }

            // 3. Migrate settings (to profile preferences)
            const guestSettings = await GuestModeManager.getGuestSettings();
            if (guestSettings) {
                try {
                    results.settings = await GuestDataMigrationManager
                        .migrateSettings(accessToken, guestSettings);
                    console.log('[Migration] Settings migrated');
                } catch (error) {
                    console.error('[Migration] Settings migration failed:', error);
                    results.errors.push(`Settings: ${error.message}`);
                }
            }

            // 4. Migrate AI history
            const aiHistory = await GuestModeManager.getAIHistory();
            if (aiHistory && aiHistory.length > 0) {
                try {
                    results.ai_history = await GuestDataMigrationManager
                        .migrateAIHistory(accessToken, aiHistory);
                    console.log('[Migration] AI history migrated');
                } catch (error) {
                    console.error('[Migration] AI history migration failed:', error);
                    results.errors.push(`AI History: ${error.message}`);
                }
            }

            // 5. Clear local guest data only if migration successful
            if (results.errors.length === 0) {
                await GuestModeManager.clearAllGuestData();
                console.log('[Migration] Guest data cleared after successful migration');
            } else {
                console.warn('[Migration] Partial failures, keeping local data');
            }

            console.log('[Migration] Complete', results);
            return results;
        } catch (error) {
            console.error('[Migration] Migration failed:', error);
            throw error;
        }
    }

    /**
     * Migrate user profile
     */
    static async migrateProfile(accessToken, guestProfile) {
        try {
            const profileData = {
                subscription_status: 'free',
                preferences: guestProfile
            };

            const response = await fetch('http://localhost:3000/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.profile;
        } catch (error) {
            console.error('[Migration] Profile migration error:', error);
            throw error;
        }
    }

    /**
     * Migrate resume
     */
    static async migrateResume(accessToken, guestResume) {
        try {
            const resumeData = {
                title: guestResume.title || 'Imported Resume',
                file_format: guestResume.file_format || 'text',
                content: guestResume.text || guestResume.content || ''
            };

            const response = await fetch('http://localhost:3000/api/resumes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(resumeData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.resume;
        } catch (error) {
            console.error('[Migration] Resume migration error:', error);
            throw error;
        }
    }

    /**
     * Migrate settings to profile preferences
     */
    static async migrateSettings(accessToken, guestSettings) {
        try {
            const preferencesData = {
                preferences: {
                    theme: guestSettings.theme || 'light',
                    auto_detect: guestSettings.auto_detect !== false,
                    show_autofill_badge: guestSettings.show_autofill_badge !== false,
                    migrated_from_guest: true,
                    migration_date: new Date().toISOString(),
                    ...guestSettings
                }
            };

            const response = await fetch('http://localhost:3000/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(preferencesData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.profile;
        } catch (error) {
            console.error('[Migration] Settings migration error:', error);
            throw error;
        }
    }

    /**
     * Migrate AI history
     */
    static async migrateAIHistory(accessToken, aiHistory) {
        try {
            const results = [];

            for (const entry of aiHistory) {
                const memoryData = {
                    question_type: entry.question_type || 'general',
                    context: entry.context || {},
                    response_content: entry.response || entry.response_content || '',
                    feedback_score: entry.feedback_score || 0
                };

                try {
                    const response = await fetch('http://localhost:3000/api/ai-memory', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify(memoryData)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        results.push(result);
                    }
                } catch (error) {
                    console.warn('[Migration] Failed to migrate single AI entry:', error);
                }
            }

            return results;
        } catch (error) {
            console.error('[Migration] AI history migration error:', error);
            throw error;
        }
    }

    /**
     * Show migration dialog to user
     * Call from popup when migration is needed
     */
    static async showMigrationDialog() {
        try {
            const guestData = await GuestModeManager.collectAllGuestData();

            // Count what will be imported
            const itemsToImport = [];
            if (guestData.profile) itemsToImport.push('Profile');
            if (guestData.resume) itemsToImport.push('Resume');
            if (guestData.settings) itemsToImport.push('Settings');
            if (guestData.ai_history && guestData.ai_history.length > 0) {
                itemsToImport.push(`${guestData.ai_history.length} AI interactions`);
            }

            return {
                show: true,
                title: 'Import Your Guest Data?',
                message: `We found local data from your guest session. Would you like to import it to your Job Orbit account?`,
                items: itemsToImport,
                buttons: [
                    { id: 'import', label: 'Import', variant: 'primary' },
                    { id: 'skip', label: 'Skip for Now', variant: 'secondary' }
                ]
            };
        } catch (error) {
            console.error('[Migration] Show dialog failed:', error);
            return null;
        }
    }

    /**
     * Get migration status
     */
    static async getStatus() {
        try {
            const needed = await GuestDataMigrationManager.isMigrationNeeded();
            const guestData = await GuestModeManager.collectAllGuestData();

            return {
                migration_needed: needed,
                has_profile: !!guestData.profile,
                has_resume: !!guestData.resume,
                has_settings: !!guestData.settings,
                ai_history_count: guestData.ai_history ? guestData.ai_history.length : 0,
                total_items: 
                    (guestData.profile ? 1 : 0) +
                    (guestData.resume ? 1 : 0) +
                    (guestData.settings ? 1 : 0) +
                    (guestData.ai_history ? guestData.ai_history.length : 0)
            };
        } catch (error) {
            console.error('[Migration] Get status failed:', error);
            return null;
        }
    }
}

// Export for use in popup and background scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuestDataMigrationManager;
}
