/**
 * Resume Optimizer Service
 * Generates optimized resume versions based on job requirements
 */

const ResumeParser = require('./resumeParser');
const ResumeAnalyzer = require('./resumeAnalyzer');

class ResumeOptimizer {
    /**
     * Optimize resume for specific job description
     */
    static async optimize(resumeText, jobDescription, analysisResult, preferences = {}) {
        const {
            aggressiveness = 'moderate',
            preserveFormatting = true,
            targetScore = 85
        } = preferences;

        // Parse resume
        const resumeData = ResumeParser.parse(resumeText);
        
        // Track all changes
        const changes = [];
        
        // Create optimized version
        let optimizedData = JSON.parse(JSON.stringify(resumeData));

        // Apply optimizations
        optimizedData = this.integrateKeywords(
            optimizedData,
            analysisResult,
            aggressiveness,
            changes
        );

        // Mutation-only rule: never reorder, rewrite, or modify sections.
        // Apply changes directly to the original text to preserve formatting.
        const optimizedText = this.applyChangesToOriginalText(resumeText, changes);

        // Calculate new ATS score
        const newAnalysis = await ResumeAnalyzer.analyze(optimizedText, jobDescription);

        return {
            optimizedText,
            optimizedData,
            changes,
            originalScore: analysisResult.atsScore,
            optimizedScore: newAnalysis.atsScore,
            scoreImprovement: newAnalysis.atsScore - analysisResult.atsScore
        };
    }

    /**
     * Integrate missing keywords into resume
     */
    static integrateKeywords(resumeData, analysisResult, aggressiveness, changes) {
        const missingKeywords = analysisResult.missingKeywords || [];

        // Determine how many keywords to add based on aggressiveness
        const keywordLimit = {
            conservative: Math.min(3, missingKeywords.length),
            moderate: Math.min(5, missingKeywords.length),
            aggressive: Math.min(8, missingKeywords.length)
        }[aggressiveness];

        const topMissingKeywords = missingKeywords.slice(0, keywordLimit);

        // Integrate keywords into experience bullets (more natural)
        if (resumeData.experience.length > 0 && topMissingKeywords.length > 0) {
            const keywordsToIntegrate = topMissingKeywords.slice(0, 3);
            
            for (let i = 0; i < Math.min(keywordsToIntegrate.length, resumeData.experience.length); i++) {
                const keyword = keywordsToIntegrate[i];
                const exp = resumeData.experience[i];
                
                if (exp.bullets.length > 0) {
                    // Find a bullet that could naturally include this keyword
                    const bulletIndex = 0; // Use first bullet for simplicity
                    const originalBullet = exp.bullets[bulletIndex];
                    
                    // Check keyword density to avoid stuffing
                    const bulletWords = originalBullet.split(/\s+/).length;
                    const keywordWords = keyword.split(/\s+/).length;
                    const density = keywordWords / bulletWords;
                    
                    if (density < 0.15) { // Max 15% keyword density
                        const enhancedBullet = this.integrateKeywordNaturally(originalBullet, keyword);
                        
                        if (enhancedBullet !== originalBullet) {
                            exp.bullets[bulletIndex] = enhancedBullet;
                            changes.push({
                                type: 'keyword_added',
                                location: `experience.${i}.bullets.${bulletIndex}`,
                                original: originalBullet,
                                modified: enhancedBullet,
                                reason: `Integrated "${keyword}" naturally into experience bullet`,
                                impact: 'high'
                            });
                        }
                    }
                }
            }
        }

        return resumeData;
    }

    /**
     * Integrate keyword naturally into a bullet point
     */
    static integrateKeywordNaturally(bullet, keyword) {
        const lowerBullet = bullet.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();

        if (lowerBullet.includes(lowerKeyword)) {
            return bullet;
        }

        const tryInsert = (regex) => {
            const updated = bullet.replace(regex, `$1$2, ${keyword}`);
            return updated === bullet ? bullet : updated;
        };

        let updatedBullet = bullet;

        // Insert into existing tool/tech lists without changing sentence flow
        updatedBullet = tryInsert(/(\busing\b\s+)([^.,;]+)/i);
        if (updatedBullet === bullet) {
            updatedBullet = tryInsert(/(\bwith\b\s+)([^.,;]+)/i);
        }
        if (updatedBullet === bullet) {
            updatedBullet = tryInsert(/(\bin\b\s+)([^.,;]+)/i);
        }

        if (updatedBullet === bullet) {
            return bullet;
        }

        const originalWords = bullet.split(/\s+/).filter(Boolean).length;
        const updatedWords = updatedBullet.split(/\s+/).filter(Boolean).length;
        const maxWords = Math.floor(originalWords * 1.15);

        if (updatedWords > maxWords) {
            return bullet;
        }

        return updatedBullet;
    }

    /**
     * Reorder content to prioritize relevant experience
     */
    static reorderContent(resumeData, analysisResult, changes) {
        if (resumeData.experience.length <= 1) {
            return resumeData;
        }

        const jobKeywords = [
            ...(analysisResult.matchedKeywords || []),
            ...(analysisResult.matchedSkills || [])
        ].map(k => k.toLowerCase());

        // Score each experience by relevance
        const scoredExperience = resumeData.experience.map((exp, index) => {
            const expText = (exp.title + ' ' + exp.bullets.join(' ')).toLowerCase();
            let relevanceScore = 0;

            for (const keyword of jobKeywords) {
                if (expText.includes(keyword)) {
                    relevanceScore++;
                }
            }

            return { exp, index, relevanceScore };
        });

        // Sort by relevance (keep original order for ties)
        scoredExperience.sort((a, b) => {
            if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            return a.index - b.index;
        });

        // Check if reordering is needed
        const needsReorder = scoredExperience.some((item, idx) => item.index !== idx);

        if (needsReorder) {
            const originalOrder = resumeData.experience.map(e => e.title).join(', ');
            resumeData.experience = scoredExperience.map(item => item.exp);
            const newOrder = resumeData.experience.map(e => e.title).join(', ');

            changes.push({
                type: 'content_reordered',
                location: 'experience',
                original: originalOrder,
                modified: newOrder,
                reason: 'Reordered experience to prioritize most relevant positions',
                impact: 'medium'
            });
        }

        // Reorder bullets within each experience
        for (let i = 0; i < resumeData.experience.length; i++) {
            const exp = resumeData.experience[i];
            if (exp.bullets.length <= 1) continue;

            const scoredBullets = exp.bullets.map((bullet, index) => {
                const bulletLower = bullet.toLowerCase();
                let relevanceScore = 0;

                for (const keyword of jobKeywords) {
                    if (bulletLower.includes(keyword)) {
                        relevanceScore++;
                    }
                }

                return { bullet, index, relevanceScore };
            });

            scoredBullets.sort((a, b) => {
                if (b.relevanceScore !== a.relevanceScore) {
                    return b.relevanceScore - a.relevanceScore;
                }
                return a.index - b.index;
            });

            const needsBulletReorder = scoredBullets.some((item, idx) => item.index !== idx);

            if (needsBulletReorder) {
                exp.bullets = scoredBullets.map(item => item.bullet);
                changes.push({
                    type: 'content_reordered',
                    location: `experience.${i}.bullets`,
                    original: 'Original bullet order',
                    modified: 'Reordered to highlight relevant achievements',
                    reason: 'Prioritized bullets with job-relevant keywords',
                    impact: 'medium'
                });
            }
        }

        return resumeData;
    }

    /**
     * Enhance action verbs
     */
    static enhanceActionVerbs(resumeData, changes) {
        const weakPhrases = {
            'responsible for': 'Led',
            'worked on': 'Developed',
            'helped with': 'Contributed to',
            'duties included': 'Managed',
            'was involved in': 'Participated in',
            'assisted in': 'Supported',
            'tasked with': 'Executed'
        };

        const strongVerbs = [
            'Led', 'Developed', 'Implemented', 'Designed', 'Managed', 'Achieved',
            'Improved', 'Increased', 'Reduced', 'Optimized', 'Streamlined',
            'Spearheaded', 'Orchestrated', 'Pioneered', 'Established'
        ];

        for (let i = 0; i < resumeData.experience.length; i++) {
            const exp = resumeData.experience[i];

            for (let j = 0; j < exp.bullets.length; j++) {
                let bullet = exp.bullets[j];
                const originalBullet = bullet;
                let modified = false;

                // Replace weak phrases
                for (const [weak, strong] of Object.entries(weakPhrases)) {
                    const regex = new RegExp(weak, 'gi');
                    if (regex.test(bullet)) {
                        bullet = bullet.replace(regex, strong);
                        modified = true;
                    }
                }

                // Ensure bullet starts with strong action verb
                if (!modified) {
                    const startsWithStrongVerb = strongVerbs.some(verb => 
                        bullet.toLowerCase().startsWith(verb.toLowerCase())
                    );

                    if (!startsWithStrongVerb && !bullet.match(/^[A-Z][a-z]+ed\b/)) {
                        // Try to identify and replace first verb
                        const verbMatch = bullet.match(/^([A-Z][a-z]+ing|[A-Z][a-z]+s)\b/);
                        if (verbMatch) {
                            const randomStrongVerb = strongVerbs[Math.floor(Math.random() * strongVerbs.length)];
                            bullet = bullet.replace(verbMatch[0], randomStrongVerb);
                            modified = true;
                        }
                    }
                }

                if (modified) {
                    exp.bullets[j] = bullet;
                    changes.push({
                        type: 'verb_enhanced',
                        location: `experience.${i}.bullets.${j}`,
                        original: originalBullet,
                        modified: bullet,
                        reason: 'Replaced weak phrases with strong action verbs',
                        impact: 'medium'
                    });
                }
            }
        }

        return resumeData;
    }

    /**
     * Optimize sections
     */
    static optimizeSections(resumeData, analysisResult, changes) {
        // Ensure all required sections exist
        const requiredSections = ['experience', 'education', 'skills'];
        
        // Add certifications section if job requires them
        if (analysisResult.jobData?.keywords?.certifications?.length > 0 && 
            resumeData.certifications.length === 0) {
            
            const suggestedCerts = analysisResult.jobData.keywords.certifications.slice(0, 2);
            changes.push({
                type: 'section_added',
                location: 'certifications',
                original: '',
                modified: 'Certifications section recommended',
                reason: `Job requires certifications: ${suggestedCerts.join(', ')}`,
                impact: 'low'
            });
        }

        // Ensure skills section has minimum entries
        if (resumeData.skills.length < 5) {
            changes.push({
                type: 'section_optimization',
                location: 'skills',
                original: `${resumeData.skills.length} skills`,
                modified: 'Recommend adding more skills',
                reason: 'Skills section should have at least 5-10 relevant skills',
                impact: 'medium'
            });
        }

        return resumeData;
    }

    /**
     * Generate resume text from structured data
     */
    static generateResumeText(resumeData, preserveFormatting) {
        let text = '';

        // Contact Information
        if (resumeData.contact.name) {
            text += `${resumeData.contact.name}\n`;
        }
        
        const contactParts = [];
        if (resumeData.contact.email) contactParts.push(resumeData.contact.email);
        if (resumeData.contact.phone) contactParts.push(resumeData.contact.phone);
        if (resumeData.contact.location) contactParts.push(resumeData.contact.location);
        if (resumeData.contact.linkedin) contactParts.push(resumeData.contact.linkedin);
        
        if (contactParts.length > 0) {
            text += contactParts.join(' | ') + '\n\n';
        }

        // Summary
        if (resumeData.summary) {
            text += 'PROFESSIONAL SUMMARY\n';
            text += resumeData.summary + '\n\n';
        }

        // Experience
        if (resumeData.experience.length > 0) {
            text += 'EXPERIENCE\n\n';
            
            for (const exp of resumeData.experience) {
                text += `${exp.title}`;
                if (exp.company) text += ` | ${exp.company}`;
                if (exp.startDate || exp.endDate) {
                    text += ` | ${exp.startDate} - ${exp.endDate}`;
                }
                text += '\n';
                
                for (const bullet of exp.bullets) {
                    text += `• ${bullet}\n`;
                }
                text += '\n';
            }
        }

        // Education
        if (resumeData.education.length > 0) {
            text += 'EDUCATION\n\n';
            
            for (const edu of resumeData.education) {
                if (edu.degree) text += edu.degree;
                if (edu.field) text += ` in ${edu.field}`;
                text += '\n';
                
                if (edu.institution) text += `${edu.institution}`;
                if (edu.graduationDate) text += ` | ${edu.graduationDate}`;
                text += '\n\n';
            }
        }

        // Skills
        if (resumeData.skills.length > 0) {
            text += 'SKILLS\n';
            text += resumeData.skills.join(', ') + '\n\n';
        }

        // Certifications
        if (resumeData.certifications.length > 0) {
            text += 'CERTIFICATIONS\n';
            for (const cert of resumeData.certifications) {
                text += `• ${cert}\n`;
            }
        }

        return text.trim();
    }

    /**
     * Apply bullet-level changes to original text to preserve formatting
     */
    static applyChangesToOriginalText(resumeText, changes) {
        if (!changes || changes.length === 0) {
            return resumeText;
        }

        let updatedText = resumeText;

        for (const change of changes) {
            if (change.type !== 'keyword_added') continue;
            if (!change.location.includes('bullets')) continue;
            if (!change.original || change.original === change.modified) continue;

            if (updatedText.includes(change.original)) {
                updatedText = updatedText.replace(change.original, change.modified);
            }
        }

        return updatedText;
    }
}

module.exports = ResumeOptimizer;
