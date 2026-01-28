/**
 * Resume Analyzer Service
 * Analyzes resume against job description and calculates ATS score
 */

const ResumeParser = require('./resumeParser');
const JobDescriptionParser = require('./jobDescriptionParser');
const EnhancedKeywordMatcher = require('./enhancedKeywordMatcher');

class ResumeAnalyzer {
    constructor() {
        this.keywordMatcher = new EnhancedKeywordMatcher();
    }

    /**
     * Analyze resume against job description
     */
    static async analyze(resumeText, jobDescription) {
        const analyzer = new ResumeAnalyzer();
        return analyzer.performAnalysis(resumeText, jobDescription);
    }

    /**
     * Perform the analysis
     */
    async performAnalysis(resumeText, jobDescription) {
        if (!resumeText || !jobDescription) {
            throw new Error('Resume text and job description are required');
        }

        // Parse resume and job description
        const resumeData = ResumeParser.parse(resumeText);
        const jobData = JobDescriptionParser.parse(jobDescription);

        // Perform enhanced keyword matching
        const keywordMatch = this.keywordMatcher.matchKeywords(resumeText, jobDescription);

        // Calculate ATS score components
        const scoreBreakdown = {
            keywordMatch: this.calculateKeywordMatchScore(keywordMatch),
            experienceRelevance: this.calculateExperienceRelevance(resumeData, jobData, keywordMatch),
            skillsAlignment: this.calculateSkillsAlignment(resumeData, jobData, keywordMatch),
            formatting: this.calculateFormattingScore(resumeText, resumeData),
            completeness: this.calculateCompletenessScore(resumeData)
        };

        // Calculate final ATS score
        const atsScore = this.calculateATSScore(scoreBreakdown);

        // Generate enhanced suggestions
        const suggestions = this.generateEnhancedSuggestions(resumeData, jobData, keywordMatch, scoreBreakdown);

        return {
            atsScore: Math.round(atsScore),
            matchedKeywords: keywordMatch.matched,
            missingKeywords: keywordMatch.missing,
            matchedSkills: keywordMatch.matchedSkills,
            missingSkills: keywordMatch.missingSkills,
            suggestions,
            breakdown: scoreBreakdown,
            resumeData,
            jobData,
            keywordDetails: keywordMatch.details,
            matchingConfidence: keywordMatch.confidence
        };
    }

    /**
     * Calculate keyword match score (0-1) using enhanced matching confidence
     */
    calculateKeywordMatchScore(keywordMatch) {
        // Use the confidence from enhanced matching
        return keywordMatch.confidence / 100;
    }

    /**
     * Calculate experience relevance score (0-1) with enhanced keyword matching
     */
    calculateExperienceRelevance(resumeData, jobData, keywordMatch) {
        if (resumeData.experience.length === 0) return 0;

        let relevanceScore = 0;
        const matchedKeywords = keywordMatch.matched.map(k => k.toLowerCase());

        // Check how many matched keywords appear in experience
        for (const exp of resumeData.experience) {
            const expText = (exp.title + ' ' + exp.bullets.join(' ')).toLowerCase();
            let matchCount = 0;

            for (const keyword of matchedKeywords) {
                if (expText.includes(keyword.toLowerCase())) {
                    matchCount++;
                }
            }

            const expRelevance = matchedKeywords.length > 0 ? matchCount / matchedKeywords.length : 0;
            relevanceScore = Math.max(relevanceScore, expRelevance);
        }

        // Bonus for having multiple relevant positions
        if (resumeData.experience.length >= 2) {
            relevanceScore = Math.min(1, relevanceScore * 1.1);
        }

        return relevanceScore;
    }

    /**
     * Calculate skills alignment score (0-1) using enhanced matching
     */
    calculateSkillsAlignment(resumeData, jobData, keywordMatch) {
        // Use the enhanced matching results
        const totalJobSkills = keywordMatch.matched.length + keywordMatch.missing.length;
        if (totalJobSkills === 0) return 0.5;

        return keywordMatch.matched.length / totalJobSkills;
    }

    /**
     * Calculate formatting score (0-1)
     */
    calculateFormattingScore(resumeText, resumeData) {
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
    calculateCompletenessScore(resumeData) {
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
    calculateATSScore(breakdown) {
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
     * Generate enhanced improvement suggestions
     */
    generateEnhancedSuggestions(resumeData, jobData, keywordMatch, scoreBreakdown) {
        const suggestions = [];

        // Enhanced keyword suggestions with prioritization
        if (keywordMatch.missing.length > 0) {
            // Prioritize missing keywords by type and importance
            const prioritizedMissing = this.prioritizeMissingKeywords(keywordMatch.missing);
            const topMissing = prioritizedMissing.slice(0, 5);
            
            suggestions.push({
                type: 'keywords',
                priority: 'high',
                message: `Add these high-priority skills to your resume: ${topMissing.join(', ')}`,
                impact: `Could increase your ATS score by up to ${Math.min(20, topMissing.length * 4)} points`,
                keywords: topMissing
            });
        }

        // Synonym-based suggestions
        const synonymSuggestions = this.generateSynonymSuggestions(keywordMatch);
        if (synonymSuggestions.length > 0) {
            suggestions.push({
                type: 'synonyms',
                priority: 'medium',
                message: `Consider using these alternative terms: ${synonymSuggestions.join(', ')}`,
                impact: 'Improves keyword matching and ATS compatibility',
                keywords: synonymSuggestions
            });
        }

        // Skills gap analysis
        if (keywordMatch.missingSkills.length > 0) {
            const criticalSkills = keywordMatch.missingSkills.filter(skill => 
                this.keywordMatcher.skillPriorities[skill.toLowerCase()] > 70
            ).slice(0, 3);
            
            if (criticalSkills.length > 0) {
                suggestions.push({
                    type: 'skills_gap',
                    priority: 'high',
                    message: `Critical skills missing: ${criticalSkills.join(', ')}`,
                    impact: 'These are high-demand skills for this role',
                    keywords: criticalSkills
                });
            }
        }

        // Experience optimization suggestions
        if (scoreBreakdown.experienceRelevance < 0.6) {
            const matchedKeywords = keywordMatch.matched.slice(0, 5);
            suggestions.push({
                type: 'experience',
                priority: 'high',
                message: `Incorporate these keywords into your experience bullets: ${matchedKeywords.join(', ')}`,
                impact: 'Increases experience relevance score and keyword density',
                keywords: matchedKeywords
            });
        }

        // Context-aware suggestions based on matching details
        const lowConfidenceMatches = keywordMatch.details.filter(d => d.confidence < 80);
        if (lowConfidenceMatches.length > 0) {
            const improvableKeywords = lowConfidenceMatches.map(d => d.jobKeyword).slice(0, 3);
            suggestions.push({
                type: 'keyword_clarity',
                priority: 'medium',
                message: `Use exact terminology for better matching: ${improvableKeywords.join(', ')}`,
                impact: 'Improves keyword matching confidence',
                keywords: improvableKeywords
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

        // Industry-specific suggestions
        const industryKeywords = this.identifyIndustryKeywords(jobData);
        if (industryKeywords.length > 0) {
            suggestions.push({
                type: 'industry_alignment',
                priority: 'medium',
                message: `Consider adding industry-specific terms: ${industryKeywords.slice(0, 3).join(', ')}`,
                impact: 'Better alignment with industry expectations',
                keywords: industryKeywords.slice(0, 3)
            });
        }

        // Sort by priority and impact
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return suggestions.slice(0, 8); // Limit to top 8 suggestions
    }

    /**
     * Prioritize missing keywords based on importance and type
     */
    prioritizeMissingKeywords(missingKeywords) {
        return missingKeywords.sort((a, b) => {
            const priorityA = this.keywordMatcher.skillPriorities[a.toLowerCase()] || 50;
            const priorityB = this.keywordMatcher.skillPriorities[b.toLowerCase()] || 50;
            return priorityB - priorityA;
        });
    }

    /**
     * Generate synonym-based suggestions
     */
    generateSynonymSuggestions(keywordMatch) {
        const suggestions = [];
        
        // Look for opportunities to use more common/preferred terms
        for (const detail of keywordMatch.details) {
            if (detail.matchType === 'synonym' && detail.confidence < 95) {
                const synonyms = this.keywordMatcher.getSynonyms(detail.jobKeyword);
                if (synonyms.length > 0) {
                    suggestions.push(detail.jobKeyword);
                }
            }
        }
        
        return [...new Set(suggestions)].slice(0, 3);
    }

    /**
     * Identify industry-specific keywords
     */
    identifyIndustryKeywords(jobData) {
        const industryKeywords = [];
        
        // This could be enhanced with ML or industry classification
        // For now, use simple heuristics
        const allKeywords = [
            ...jobData.keywords.technical,
            ...jobData.keywords.tools,
            ...jobData.keywords.soft
        ];
        
        // Look for industry indicators
        const techIndicators = ['api', 'cloud', 'agile', 'scrum', 'devops'];
        const financeIndicators = ['compliance', 'risk', 'audit', 'regulatory'];
        const healthcareIndicators = ['hipaa', 'clinical', 'patient', 'medical'];
        
        for (const keyword of allKeywords) {
            const keywordLower = keyword.toLowerCase();
            if (techIndicators.some(indicator => keywordLower.includes(indicator))) {
                industryKeywords.push(keyword);
            }
        }
        
        return [...new Set(industryKeywords)];
    }
}

module.exports = ResumeAnalyzer;
