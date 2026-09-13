/**
 * PersonaManager
 * 
 * Manages multiple candidate personas (e.g. Frontend Engineer vs Full Stack vs DevOps).
 * Allows users to target distinct roles with tailored headlines, summaries, skill sets,
 * and associated resume PDFs.
 * 
 * Supports automatic persona recommendation based on Job Title & Description keyword matching.
 */

class PersonaManager {
    constructor() {
        this.personas = [];
        this.activePersonaId = null;
    }

    /**
     * Initialize personas from storage
     */
    async init() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            return;
        }

        const data = await new Promise(resolve => {
            chrome.storage.local.get(['personas', 'activePersonaId', 'autofillProfile'], resolve);
        });

        this.personas = Array.isArray(data.personas) && data.personas.length > 0 ? data.personas : [];
        this.activePersonaId = data.activePersonaId || (this.personas[0] ? this.personas[0].id : null);

        // If no personas exist yet, seed a default persona from autofillProfile
        if (this.personas.length === 0 && data.autofillProfile) {
            const defaultPersona = this.createDefaultPersona(data.autofillProfile);
            this.personas.push(defaultPersona);
            this.activePersonaId = defaultPersona.id;
            await this.persist();
        }
    }

    /**
     * Create a default seed persona from current profile
     */
    createDefaultPersona(profile = {}) {
        return {
            id: 'persona_default',
            name: profile.headline || 'Primary Profile',
            targetRoles: ['Software Engineer', 'Developer', 'Full Stack'],
            headline: profile.headline || 'Software Engineer',
            summary: profile.summary || '',
            skills: Array.isArray(profile.skills) ? profile.skills : (typeof profile.skills === 'string' ? profile.skills.split(',').map(s => s.trim()) : []),
            yearsOfExperience: parseInt(profile.yearsOfExperience || '3', 10),
            resumeFilename: 'Resume.pdf',
            isDefault: true,
            createdAt: Date.now()
        };
    }

    /**
     * Get the currently active persona
     */
    getActivePersona() {
        if (!this.activePersonaId && this.personas.length > 0) {
            return this.personas[0];
        }
        return this.personas.find(p => p.id === this.activePersonaId) || this.personas[0] || null;
    }

    /**
     * Set active persona by ID
     */
    async setActivePersona(personaId) {
        const found = this.personas.find(p => p.id === personaId);
        if (found) {
            this.activePersonaId = personaId;
            await this.persist();
            return found;
        }
        return null;
    }

    /**
     * Add or update a persona
     */
    async savePersona(personaData) {
        const id = personaData.id || `persona_${Date.now()}`;
        const existingIndex = this.personas.findIndex(p => p.id === id);

        const updated = {
            ...personaData,
            id,
            updatedAt: Date.now()
        };

        if (existingIndex >= 0) {
            this.personas[existingIndex] = updated;
        } else {
            this.personas.push(updated);
        }

        if (!this.activePersonaId) {
            this.activePersonaId = id;
        }

        await this.persist();
        return updated;
    }

    /**
     * Delete a persona by ID
     */
    async deletePersona(personaId) {
        if (this.personas.length <= 1) {
            throw new Error('Cannot delete the only remaining persona.');
        }
        this.personas = this.personas.filter(p => p.id !== personaId);
        if (this.activePersonaId === personaId) {
            this.activePersonaId = this.personas[0].id;
        }
        await this.persist();
        return true;
    }

    /**
     * Find best matching persona based on job title & keywords
     */
    matchBestPersona(jobTitle = '', jobDescription = '') {
        if (this.personas.length === 0) return null;
        if (this.personas.length === 1) return this.personas[0];

        const text = `${jobTitle} ${jobDescription}`.toLowerCase();
        let bestScore = -1;
        let bestPersona = this.getActivePersona();

        for (const persona of this.personas) {
            let score = 0;
            // Check target roles
            (persona.targetRoles || []).forEach(role => {
                const r = role.toLowerCase().trim();
                if (r && text.includes(r)) score += 5;
            });
            // Check skill keywords
            (persona.skills || []).forEach(skill => {
                const s = skill.toLowerCase().trim();
                if (s && text.includes(s)) score += 2;
            });

            if (score > bestScore) {
                bestScore = score;
                bestPersona = persona;
            }
        }

        return bestPersona;
    }

    /**
     * Persist personas to local storage
     */
    async persist() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise(resolve => {
                chrome.storage.local.set({
                    personas: this.personas,
                    activePersonaId: this.activePersonaId
                }, resolve);
            });
        }
    }
}

if (typeof window !== 'undefined') {
    window.PersonaManager = PersonaManager;
    window.__personaManagerInstance = new PersonaManager();
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonaManager;
}
