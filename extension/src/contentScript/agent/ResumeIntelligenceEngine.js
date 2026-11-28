/**
 * Resume Intelligence Engine (Phase 6)
 * Supports multiple immutable resume versions (e.g., SWE, AI/ML, Backend, Data Scientist),
 * compares them against a structured JD, explains selection, and identifies missing evidence.
 */
class ResumeIntelligenceEngine {
    static STORAGE_KEY = 'resumeVersions';

    static async loadVersions() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return [];
        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (res) => {
                resolve(Array.isArray(res[this.STORAGE_KEY]) ? res[this.STORAGE_KEY] : []);
            });
        });
    }

    static async saveVersion(version) {
        if (!version || !version.name) return [];
        const existing = await this.loadVersions();
        const id = version.id || `res_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const entry = {
            id,
            name: String(version.name).trim(),
            targetRole: String(version.targetRole || version.name).trim(),
            rawText: String(version.rawText || ''),
            skills: Array.isArray(version.skills) ? version.skills : [],
            experience: Array.isArray(version.experience) ? version.experience : [],
            projects: Array.isArray(version.projects) ? version.projects : [],
            updatedAt: new Date().toISOString()
        };
        const idx = existing.findIndex((r) => r.id === id || r.name.toLowerCase() === entry.name.toLowerCase());
        const updated = [...existing];
        if (idx >= 0) updated[idx] = entry;
        else updated.push(entry);

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise((resolve) => chrome.storage.local.set({ [this.STORAGE_KEY]: updated }, resolve));
        }
        return updated;
    }

    /**
     * Compare multiple resume versions against a structured job description without mutating originals
     */
    static selectBestResume(structuredJob, resumeVersions = [], profile = {}) {
        const JIE = (typeof window !== 'undefined' && window.JobIntelligenceEngine) ||
            (typeof require === 'function' ? require('./JobIntelligenceEngine.js') : null);

        if (!JIE || !Array.isArray(resumeVersions) || resumeVersions.length === 0) {
            return {
                bestResume: null,
                ranked: [],
                explanation: 'No resume versions available to compare.',
                missingEvidence: structuredJob?.required_skills || [],
                recommendations: ['Upload or save at least one resume version to enable automatic selection.']
            };
        }

        const ranked = resumeVersions.map((ver) => {
            const evalResult = JIE.evaluateSuitability(structuredJob, profile, {
                rawText: ver.rawText || '',
                skills: ver.skills || [],
                experience: ver.experience || [],
                projects: ver.projects || []
            });

            // Role-title alignment bonus (capped so skill evidence remains primary)
            const roleBonus = (ver.targetRole && structuredJob.role &&
                structuredJob.role.toLowerCase().includes(ver.targetRole.toLowerCase())) ? 5 : 0;

            return {
                resume: ver,
                score: Math.min(100, evalResult.overallScore + roleBonus),
                evaluation: evalResult
            };
        }).sort((a, b) => b.score - a.score);

        const best = ranked[0];
        const ev = best.evaluation;
        const explanation = `Selected "${best.resume.name}" (${best.score}/100) — covers ${ev.strongMatches.length}/${(structuredJob.required_skills || []).length} required skills (${ev.strongMatches.join(', ') || 'none'}).`;

        const recommendations = [];
        if (ev.missingRequirements.length > 0) {
            recommendations.push(`Highlight authentic experience or projects covering: ${ev.missingRequirements.slice(0, 5).join(', ')}.`);
        }
        if (ev.partialMatches.length > 0) {
            recommendations.push(`Emphasize matching preferred skills: ${ev.partialMatches.slice(0, 4).join(', ')}.`);
        }

        return {
            bestResume: best.resume,
            score: best.score,
            ranked,
            explanation,
            missingEvidence: ev.missingRequirements,
            recommendations
        };
    }
}

if (typeof window !== 'undefined') {
    window.ResumeIntelligenceEngine = ResumeIntelligenceEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResumeIntelligenceEngine;
}
