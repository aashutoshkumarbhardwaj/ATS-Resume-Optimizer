/**
 * Resume Model
 * Schema for storing resume data
 */

class Resume {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.userId = data.userId;
        this.title = data.title;
        this.content = data.content;
        this.jobRole = data.jobRole;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.analyses = data.analyses || [];
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            title: this.title,
            content: this.content,
            jobRole: this.jobRole,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            analyses: this.analyses
        };
    }
}

module.exports = Resume;
