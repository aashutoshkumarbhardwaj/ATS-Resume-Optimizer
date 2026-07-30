/**
 * Resume Service
 * Business logic for resume operations
 */

const Analysis = require('../models/Analysis');

class ResumeService {
    /**
     * Analyze resume against job description
     */
    static async analyzeResume(jobRole, jobDescription, resumeText) {
        try {
            // Extract keywords from job description
            const jobKeywords = this.extractKeywords(jobDescription);
            
            // Extract keywords from resume
            const resumeKeywords = this.extractKeywords(resumeText);
            
            // Calculate match score
            const matchedKeywords = jobKeywords.filter(kw => 
                resumeKeywords.some(rk => rk.toLowerCase().includes(kw.toLowerCase()))
            );
            
            const score = (matchedKeywords.length / jobKeywords.length) * 100;
            
            // Generate suggestions
            const suggestions = this.generateSuggestions(
                jobRole,
                jobDescription,
                resumeText,
                matchedKeywords,
                jobKeywords
            );
            
            // Optimize resume
            const optimizedResume = this.optimizeResumeContent(resumeText, jobDescription);
            
            return {
                score: Math.round(score),
                suggestions,
                matchedSkills: matchedKeywords,
                missingSkills: jobKeywords.filter(kw => !matchedKeywords.includes(kw)),
                optimizedResume
            };
        } catch (error) {
            throw new Error(`Resume analysis failed: ${error.message}`);
        }
    }

    /**
     * Extract keywords from text
     */
    static extractKeywords(text) {
        const keywords = [];
        const words = text.toLowerCase().split(/\s+/);
        
        // Common tech keywords
        const techKeywords = [
            'javascript', 'python', 'java', 'c++', 'react', 'node', 'express',
            'mongodb', 'sql', 'docker', 'aws', 'git', 'linux', 'api', 'rest',
            'agile', 'scrum', 'leadership', 'communication', 'teamwork'
        ];
        
        // Extract matching keywords
        return words.filter(word => 
            techKeywords.some(tk => tk.includes(word) || word.includes(tk))
        );
    }

    /**
     * Generate suggestions for resume improvement
     */
    static generateSuggestions(jobRole, jobDescription, resumeText, matched, all) {
        const suggestions = [];
        
        // Missing skills suggestion
        const missing = all.filter(k => !matched.includes(k));
        if (missing.length > 0) {
            suggestions.push(
                `Add experience with: ${missing.slice(0, 3).join(', ')}`
            );
        }
        
        // Format suggestions
        suggestions.push(
            `Tailor your resume to match the ${jobRole} role requirements`
        );
        suggestions.push(
            'Use action verbs (developed, designed, implemented, etc.) in your bullet points'
        );
        suggestions.push(
            'Quantify achievements with metrics and numbers'
        );
        suggestions.push(
            'Include relevant certifications and technologies'
        );
        
        // Keywords suggestion
        suggestions.push(
            `Ensure resume contains key terms from job posting: ${matched.slice(0, 3).join(', ')}`
        );
        
        return suggestions;
    }

    /**
     * Optimize resume content
     */
    static optimizeResumeContent(resumeText, jobDescription) {
        let optimized = resumeText;
        
        // Add power words if missing
        const powerWords = ['led', 'managed', 'achieved', 'improved', 'designed', 'developed'];
        const hasActionVerbs = powerWords.some(word => optimized.toLowerCase().includes(word));
        
        if (!hasActionVerbs) {
            optimized = optimized.replace(/Responsible for/gi, 'Led and managed');
            optimized = optimized.replace(/Worked on/gi, 'Designed and implemented');
        }
        
        return optimized;
    }

    /**
     * Get suggestions for specific keywords
     */
    static async getSuggestions(jobRole, resumeText) {
        const suggestions = [];
        
        // Role-based suggestions
        const roleSuggestions = {
            'software engineer': [
                'Highlight programming languages and frameworks',
                'Include system design and architecture experience',
                'Mention performance optimization achievements'
            ],
            'data scientist': [
                'Include machine learning models you\'ve built',
                'Highlight statistical analysis and insights',
                'Mention data visualization tools used'
            ],
            'product manager': [
                'Emphasize product strategy and roadmapping',
                'Include user research and A/B testing experience',
                'Highlight cross-functional collaboration'
            ]
        };
        
        const role = jobRole.toLowerCase();
        for (const [key, value] of Object.entries(roleSuggestions)) {
            if (role.includes(key)) {
                suggestions.push(...value);
                break;
            }
        }
        
        return suggestions;
    }
}

module.exports = ResumeService;
