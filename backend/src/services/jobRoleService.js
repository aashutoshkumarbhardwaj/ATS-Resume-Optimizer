/**
 * Job Role Service
 * Business logic for job role operations
 */

class JobRoleService {
    /**
     * Get job role by title
     */
    static async getJobRoleByTitle(title) {
        // Mock implementation - replace with database call
        const jobRoles = {
            'Software Engineer': {
                title: 'Software Engineer',
                requiredSkills: ['JavaScript', 'Python', 'Java', 'Git', 'REST API'],
                niceToHaveSkills: ['React', 'Docker', 'AWS', 'Kubernetes'],
                keywords: ['development', 'coding', 'debugging', 'testing']
            },
            'Data Scientist': {
                title: 'Data Scientist',
                requiredSkills: ['Python', 'SQL', 'Statistics', 'Machine Learning'],
                niceToHaveSkills: ['TensorFlow', 'Spark', 'Tableau', 'R'],
                keywords: ['analysis', 'modeling', 'visualization', 'prediction']
            }
        };
        
        return jobRoles[title] || null;
    }

    /**
     * Parse job description to extract requirements
     */
    static async parseJobDescription(description) {
        const skills = this.extractSkills(description);
        const keywords = this.extractKeywords(description);
        const yearsExperience = this.extractExperience(description);
        
        return {
            skills,
            keywords,
            yearsExperience,
            description
        };
    }

    /**
     * Extract required skills from job description
     */
    static extractSkills(description) {
        const skillList = [
            'javascript', 'python', 'java', 'c++', 'react', 'node.js',
            'sql', 'mongodb', 'docker', 'kubernetes', 'aws', 'azure',
            'git', 'agile', 'scrum', 'leadership', 'communication'
        ];
        
        const foundSkills = [];
        const descLower = description.toLowerCase();
        
        skillList.forEach(skill => {
            if (descLower.includes(skill)) {
                foundSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
            }
        });
        
        return foundSkills;
    }

    /**
     * Extract keywords from job description
     */
    static extractKeywords(description) {
        // Simple keyword extraction
        const words = description.split(/\s+/);
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'be', 'been', 'being'
        ]);
        
        return words
            .filter(word => !stopWords.has(word.toLowerCase()) && word.length > 3)
            .slice(0, 10);
    }

    /**
     * Extract years of experience required
     */
    static extractExperience(description) {
        const match = description.match(/(\d+)\+?\s*years?/i);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Get skills for a specific role
     */
    static async getSkillsForRole(role) {
        const skillsByRole = {
            'software_engineer': {
                required: ['JavaScript', 'Python', 'Git', 'REST APIs'],
                nice: ['React', 'Node.js', 'Docker', 'AWS']
            },
            'data_scientist': {
                required: ['Python', 'SQL', 'Statistics', 'Machine Learning'],
                nice: ['TensorFlow', 'Spark', 'Tableau']
            },
            'frontend_developer': {
                required: ['HTML', 'CSS', 'JavaScript', 'React'],
                nice: ['TypeScript', 'Webpack', 'Testing Frameworks']
            },
            'backend_developer': {
                required: ['Node.js', 'SQL', 'API Design', 'Python'],
                nice: ['Docker', 'Kubernetes', 'AWS', 'Microservices']
            }
        };
        
        return skillsByRole[role.replace(/\s+/g, '_').toLowerCase()] || { required: [], nice: [] };
    }
}

module.exports = JobRoleService;
