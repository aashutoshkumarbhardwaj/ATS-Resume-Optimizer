/**
 * Resume Analyzer Service
 * Analyzes resume against job description and calculates ATS score
 */

const ResumeParser = require('./resumeParser');
const JobDescriptionParser = require('./jobDescriptionParser');

class ResumeAnalyzer {
    /**
     * Analyze resume against job description
     */
    static async analyze(resumeText, jobDescription) {
        if (!resumeText || !jobDescription) {
            throw new Error('Resume text and job description are required');
        }

        // Parse resume and job description
        const resumeData = ResumeParser.parse(resumeText);
        const jobData = JobDescriptionParser.parse(jobDescription);

        // Perform keyword matching
        const keywordMatch = this.matchKeywords(resumeData, jobData);

        // Calculate ATS score components
        const scoreBreakdown = {
            keywordMatch: this.calculateKeywordMatchScore(keywordMatch),
            experienceRelevance: this.calculateExperienceRelevance(resumeData, jobData),
            skillsAlignment: this.calculateSkillsAlignment(resumeData, jobData),
            formatting: this.calculateFormattingScore(resumeText, resumeData),
            completeness: this.calculateCompletenessScore(resumeData)
        };

        // Calculate final ATS score
        const atsScore = this.calculateATSScore(scoreBreakdown);

        // Generate suggestions
        const suggestions = this.generateSuggestions(resumeData, jobData, keywordMatch, scoreBreakdown);

        return {
            atsScore: Math.round(atsScore),
            matchedKeywords: keywordMatch.matched,
            missingKeywords: keywordMatch.missing,
            matchedSkills: keywordMatch.matchedSkills,
            missingSkills: keywordMatch.missingSkills,
            suggestions,
            breakdown: scoreBreakdown,
            resumeData,
            jobData
        };
    }

    /**
     * Match keywords between resume and job description
     */
    static matchKeywords(resumeData, jobData) {
        const resumeText = JSON.stringify(resumeData).toLowerCase();
        const matched = [];
        const missing = [];
        const matchedSkills = [];
        const missingSkills = [];

        // Create synonym map for better matching
        const synonyms = {
            'javascript': ['js', 'javascript', 'ecmascript'],
            'typescript': ['ts', 'typescript'],
            'node.js': ['node', 'nodejs', 'node.js'],
            'react': ['react', 'reactjs', 'react.js'],
            'angular': ['angular', 'angularjs'],
            'vue': ['vue', 'vuejs', 'vue.js'],
            'python': ['python', 'py'],
            'c++': ['c++', 'cpp'],
            'c#': ['c#', 'csharp'],
            'aws': ['aws', 'amazon web services'],
            'gcp': ['gcp', 'google cloud', 'google cloud platform'],
            'azure': ['azure', 'microsoft azure']
        };

        // Check technical keywords
        const allJobKeywords = [
            ...jobData.keywords.technical,
            ...jobData.keywords.tools
        ];

        for (const keyword of allJobKeywords) {
            const keywordLower = keyword.toLowerCase();
            let found = false;

            // Check exact match
            if (resumeText.includes(keywordLower)) {
                found = true;
            } else {
                // Check synonyms
                for (const [key, syns] of Object.entries(synonyms)) {
                    if (syns.includes(keywordLower)) {
                        // Check if any synonym is in resume
                        for (const syn of syns) {
                            if (resumeText.includes(syn)) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
            }

            if (found) {
                matched.push(keyword);
            } else {
                missing.push(keyword);
            }
        }

        // Check skills specifically
        const resumeSkills = resumeData.skills.map(s => s.toLowerCase());
        const jobSkills = [
            ...jobData.keywords.technical,
            ...jobData.keywords.soft,
            ...jobData.keywords.tools
        ];

        for (const skill of jobSkills) {
            const skillLower = skill.toLowerCase();
            let found = false;

            // Check in skills section
            if (resumeSkills.some(rs => rs.includes(skillLower) || skillLower.includes(rs))) {
                found = true;
            }

            // Check in experience bullets
            if (!found) {
                for (const exp of resumeData.experience) {
                    const expText = exp.bullets.join(' ').toLowerCase();
                    if (expText.includes(skillLower)) {
                        found = true;
                        break;
                    }
                }
            }

            if (found) {
                matchedSkills.push(skill);
            } else {
                missingSkills.push(skill);
            }
        }

        return {
            matched,
            missing,
            matchedSkills,
            missingSkills
        };
    }

    /**
     * Calculate keyword match score (0-1)
     */
    static calculateKeywordMatchScore(keywordMatch) {
        const totalKeywords = keywordMatch.matched.length + keywordMatch.missing.length;
        if (totalKeywords === 0) return 0;

        return keywordMatch.matched.length / totalKeywords;
    }

    /**
     * Calculate experience relevance score (0-1)
     */
    static calculateExperienceRelevance(resumeData, jobData) {
        if (resumeData.experience.length === 0) return 0;

        let relevanceScore = 0;
        const jobKeywords = [
            ...jobData.keywords.technical,
            ...jobData.keywords.tools
        ].map(k => k.toLowerCase());

        // Check how many job keywords appear in experience
        for (const exp of resumeData.experience) {
            const expText = (exp.title + ' ' + exp.bullets.join(' ')).toLowerCase();
            let matchCount = 0;

            for (const keyword of jobKeywords) {
                if (expText.includes(keyword)) {
                    matchCount++;
                }
            }

            const expRelevance = jobKeywords.length > 0 ? matchCount / jobKeywords.length : 0;
            relevanceScore = Math.max(relevanceScore, expRelevance);
        }

        // Bonus for having multiple relevant positions
        if (resumeData.experience.length >= 2) {
            relevanceScore = Math.min(1, relevanceScore * 1.1);
        }

        return relevanceScore;
    }

    /**
     * Calculate skills alignment score (0-1)
     */
    static calculateSkillsAlignment(resumeData, jobData) {
        const resumeSkills = resumeData.skills.map(s => s.toLowerCase());
        const jobSkills = [
            ...jobData.keywords.technical,
            ...jobData.keywords.soft,
            ...jobData.keywords.tools
        ].map(s => s.toLowerCase());

        if (jobSkills.length === 0) return 0.5;

        let matchCount = 0;
        for (const jobSkill of jobSkills) {
            if (resumeSkills.some(rs => rs.includes(jobSkill) || jobSkill.includes(rs))) {
                matchCount++;
            }
        }

        return matchCount / jobSkills.length;
    }

    /**
     * Calculate formatting score (0-1)
     */
    static calculateFormattingScore(resumeText, resumeData) {
        let score = 1.0;

        // Check for proper sections
        const hasExperience = resumeData.experience.length > 0;
        const hasEducation = resumeData.education.length > 0;
        const hasSkills = resumeData.skills.length > 0;
        const hasContact = resumeData.contact.email || resumeData.contact.phone;

        if (!hasExperience) score -= 0.3;
        if (!hasEducation) score -= 0.2;
        if (!hasSkills) score -= 0.2;
        if (!hasContact) score -= 0.3;

        // Penalize if text is too short or too long
        const wordCount = resumeText.split(/\s+/).length;
        if (wordCount < 200) score -= 0.2;
        if (wordCount > 1500) score -= 0.1;

        return Math.max(0, score);
    }

    /**
     * Calculate completeness score (0-1)
     */
    static calculateCompletenessScore(resumeData) {
        let score = 0;

        // Check for essential sections
        if (resumeData.contact.name) score += 0.15;
        if (resumeData.contact.email) score += 0.15;
        if (resumeData.contact.phone) score += 0.1;
        if (resumeData.experience.length > 0) score += 0.25;
        if (resumeData.education.length > 0) score += 0.15;
        if (resumeData.skills.length > 0) score += 0.2;

        return Math.min(1, score);
    }

    /**
     * Calculate final ATS score using weighted formula
     */
    static calculateATSScore(breakdown) {
        const score = (
            breakdown.keywordMatch * 0.40 +
            breakdown.experienceRelevance * 0.25 +
            breakdown.skillsAlignment * 0.20 +
            breakdown.formatting * 0.10 +
            breakdown.completeness * 0.05
        ) * 100;

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Generate improvement suggestions
     */
    static generateSuggestions(resumeData, jobData, keywordMatch, scoreBreakdown) {
        const suggestions = [];

        // Keyword suggestions
        if (keywordMatch.missing.length > 0) {
            const topMissing = keywordMatch.missing.slice(0, 5);
            suggestions.push({
                type: 'keywords',
                priority: 'high',
                message: `Add these key skills to your resume: ${topMissing.join(', ')}`,
                impact: 'Increases keyword match score by up to 20 points'
            });
        }

        // Skills suggestions
        if (keywordMatch.missingSkills.length > 0) {
            const topMissingSkills = keywordMatch.missingSkills.slice(0, 3);
            suggestions.push({
                type: 'skills',
                priority: 'high',
                message: `Highlight experience with: ${topMissingSkills.join(', ')}`,
                impact: 'Improves skills alignment score'
            });
        }

        // Experience suggestions
        if (scoreBreakdown.experienceRelevance < 0.5) {
            suggestions.push({
                type: 'experience',
                priority: 'high',
                message: 'Emphasize relevant experience by adding job-specific keywords to your bullet points',
                impact: 'Increases experience relevance score'
            });
        }

        // Action verb suggestions
        const weakVerbs = ['responsible for', 'worked on', 'helped with', 'duties included'];
        const resumeTextLower = JSON.stringify(resumeData).toLowerCase();
        const hasWeakVerbs = weakVerbs.some(verb => resumeTextLower.includes(verb));

        if (hasWeakVerbs) {
            suggestions.push({
                type: 'action_verbs',
                priority: 'medium',
                message: 'Replace weak phrases with strong action verbs (Led, Developed, Implemented, Achieved)',
                impact: 'Improves readability and ATS parsing'
            });
        }

        // Quantification suggestions
        const hasNumbers = /\d+%|\d+\+|\$\d+/.test(JSON.stringify(resumeData));
        if (!hasNumbers) {
            suggestions.push({
                type: 'quantification',
                priority: 'medium',
                message: 'Add quantifiable achievements (e.g., "Increased efficiency by 30%", "Managed team of 5")',
                impact: 'Makes accomplishments more concrete and impressive'
            });
        }

        // Formatting suggestions
        if (scoreBreakdown.formatting < 0.8) {
            suggestions.push({
                type: 'formatting',
                priority: 'medium',
                message: 'Ensure all standard sections are present: Contact, Experience, Education, Skills',
                impact: 'Improves ATS parsing accuracy'
            });
        }

        // Completeness suggestions
        if (!resumeData.contact.linkedin) {
            suggestions.push({
                type: 'contact',
                priority: 'low',
                message: 'Add your LinkedIn profile URL to increase credibility',
                impact: 'Provides additional context for recruiters'
            });
        }

        if (resumeData.certifications.length === 0 && jobData.keywords.certifications.length > 0) {
            suggestions.push({
                type: 'certifications',
                priority: 'medium',
                message: `Consider adding relevant certifications: ${jobData.keywords.certifications.slice(0, 2).join(', ')}`,
                impact: 'Demonstrates commitment to professional development'
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return suggestions;
    }
}

module.exports = ResumeAnalyzer;
