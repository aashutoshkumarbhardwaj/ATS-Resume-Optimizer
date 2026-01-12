/**
 * JobRole Model
 * Schema for storing job role data
 */

class JobRole {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.title = data.title;
        this.description = data.description;
        this.requiredSkills = data.requiredSkills || [];
        this.niceToHaveSkills = data.niceToHaveSkills || [];
        this.keywords = data.keywords || [];
        this.experience = data.experience; // years
        this.createdAt = data.createdAt || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            requiredSkills: this.requiredSkills,
            niceToHaveSkills: this.niceToHaveSkills,
            keywords: this.keywords,
            experience: this.experience,
            createdAt: this.createdAt
        };
    }
}

module.exports = JobRole;
