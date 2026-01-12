/**
 * Analysis Model
 * Schema for storing resume analysis results
 */

class Analysis {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.resumeId = data.resumeId;
        this.jobRoleId = data.jobRoleId;
        this.score = data.score || 0; // 0-100
        this.suggestions = data.suggestions || [];
        this.missingSkills = data.missingSkills || [];
        this.matchedSkills = data.matchedSkills || [];
        this.optimizedResume = data.optimizedResume || '';
        this.createdAt = data.createdAt || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            resumeId: this.resumeId,
            jobRoleId: this.jobRoleId,
            score: this.score,
            suggestions: this.suggestions,
            missingSkills: this.missingSkills,
            matchedSkills: this.matchedSkills,
            optimizedResume: this.optimizedResume,
            createdAt: this.createdAt
        };
    }
}

module.exports = Analysis;
